// KOLO — BLOC B / Veille (cartes « Biens en vente à surveiller »)
//
// Ce que ce fichier ne fait JAMAIS (règles du code, à ne pas modifier) :
//   - Jamais « mandat à récupérer »
//   - Jamais « le vendeur est prêt à changer d'agence »
//   - Jamais « opportunité »
//   - Jamais « à démarcher »
//   - Jamais « mandat exclusif » / « mandat simple » en surimpression
//   - Jamais de barre de progression sur la pile de veille
//   - Jamais d'insertion dans la pile d'opportunités de mandat
//   - Rose #EC8690 interdit — ambre #F59E0B réservé
//
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Eye, ExternalLink, Clock, TrendingDown, ArrowLeft, Home } from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';
import './b1.css';
import './b1Veille.css';

// ---------------------------------------------------------------------------
// API helpers (extension de b1api)
// ---------------------------------------------------------------------------
const API = process.env.REACT_APP_BACKEND_URL;

async function _req(path, opts = {}) {
  const t = (() => { try { return localStorage.getItem('kolo_v2_session') || localStorage.getItem('kolo_token') || ''; } catch { return ''; } })();
  const r = await fetch(`${API}${path}`, {
    method: opts.method || 'GET',
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await r.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : null;
  if (!r.ok) {
    const e = new Error(data?.detail?.code || data?.detail || `HTTP ${r.status}`);
    e.status = r.status;
    e.data = data;
    throw e;
  }
  return data;
}

export const veilleApi = {
  fileDuJour: () => _req('/api/me/veille'),
  patchStatut: (listingId, statut) =>
    _req(`/api/me/veille/${encodeURIComponent(listingId)}/statut`, { method: 'PATCH', body: { statut } }),
  suivis: () => _req('/api/me/veille/suivis'),
};

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
const fmt = (n) => {
  if (n == null || n === '') return '—';
  try { return Number(n).toLocaleString('fr-FR'); } catch { return String(n); }
};
const absPct = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.abs(Math.round(n));
};

// ---------------------------------------------------------------------------
// Fait de baisse de prix — pluralisation, jamais « 1 fois »
// ---------------------------------------------------------------------------
export function baisseTexte(count, pctAbs) {
  if (!count || count < 1) return null;
  if (pctAbs == null) return null;
  return count === 1
    ? b1t('veille.fait.baisse.une', { pct: pctAbs })
    : b1t('veille.fait.baisse.plusieurs', { n: count, pct: pctAbs });
}

// ---------------------------------------------------------------------------
// VeilleCard (unité de swipe)
// ---------------------------------------------------------------------------
export function VeilleCard({ card, onSkip, onWatch }) {
  const pctAbs = absPct(card.price_drop_pct);
  const dom = card.days_on_market;
  const baisse = baisseTexte(card.price_drop_count, pctAbs);
  const carac = b1t('veille.carac', {
    prix: fmt(card.prix),
    prix_m2: fmt(card.prix_m2),
    surface: fmt(card.surface),
    classe: card.energy_class || card.classe_dpe || '—',
  });
  const openLien = (e) => {
    e.stopPropagation();
    if (card.url_annonce) window.open(card.url_annonce, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="b1-veille-card" data-testid="b1-veille-card">
      <div className="b1-veille-bandeau" data-testid="b1-veille-bandeau">
        {b1t('veille.bandeau')}
      </div>
      <div className="b1-veille-photo">
        {card.thumbnail_url ? (
          <img src={card.thumbnail_url} alt="" loading="lazy" />
        ) : (
          <Home size={72} strokeWidth={1.4} />
        )}
      </div>
      <div className="b1-veille-body">
        <p className="b1-veille-adresse">{card.adresse || '—'}</p>
        <p className="b1-veille-complement">
          {[card.floor != null && card.floor !== '' ? `Étage ${card.floor}` : null,
            card.surface != null ? `${card.surface} m²` : null,
            card.rooms != null && card.rooms !== '' ? `${card.rooms} pièces` : null]
            .filter(Boolean).join(' · ')}
        </p>
        {dom != null && (
          <div className="b1-veille-fait" data-testid="b1-veille-fait-dom">
            <Clock size={16} />
            <span>{b1t('veille.fait.dom', { n: dom })}</span>
          </div>
        )}
        {baisse && (
          <div className="b1-veille-fait" data-testid="b1-veille-fait-baisse">
            <TrendingDown size={16} />
            <span>{baisse}</span>
          </div>
        )}
        <div className="b1-veille-carac">{carac}</div>
        {card.url_annonce && (
          <button className="b1-veille-lien" onClick={openLien} data-testid="b1-veille-lien">
            <ExternalLink size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
            {b1t('veille.voir_annonce')}
          </button>
        )}
        <span className="b1-veille-source">{b1t('veille.source')}</span>
      </div>
      <div className="b1-veille-actions">
        <button
          className="b1-veille-action-btn b1-veille-action-btn--skip"
          data-testid="b1-veille-skip"
          aria-label={b1t('veille.action.passer')}
          onClick={() => onSkip(card)}
        >
          <X size={22} />
        </button>
        <button
          className="b1-veille-action-btn b1-veille-action-btn--watch"
          data-testid="b1-veille-watch"
          aria-label={b1t('veille.action.suivre')}
          onClick={() => onWatch(card)}
        >
          <Eye size={22} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intercalaire — s'affiche entre la dernière opportunité de mandat et la pile
// de veille (si applicable). Sinon rien.
// ---------------------------------------------------------------------------
export function VeilleIntercalaire({ onOuvrir, onPlusTard }) {
  return (
    <div className="b1-veille-inter" data-testid="b1-veille-intercalaire">
      <h2 className="b1-veille-inter-titre">{b1t('veille.intercalaire.titre')}</h2>
      <p className="b1-veille-inter-sous">{b1t('veille.intercalaire.sous')}</p>
      <button className="b1-veille-inter-cta" data-testid="b1-veille-inter-cta" onClick={onOuvrir}>
        {b1t('veille.intercalaire.cta')}
      </button>
      <button className="b1-veille-inter-lien" data-testid="b1-veille-inter-plus-tard" onClick={onPlusTard}>
        {b1t('veille.intercalaire.plus_tard')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paywall (Découverte → deeplink)
// ---------------------------------------------------------------------------
export function VeillePaywall() {
  const navigate = useNavigate();
  return (
    <div className="b1-root">
      <div className="b1-screen">
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{
            width: 96, height: 96, borderRadius: 999,
            background: 'var(--veille-amber-tint)', color: 'var(--veille-amber-dark)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <Eye size={44} />
          </div>
          <h1 className="b1-h1">{b1t('veille.paywall.titre')}</h1>
          <p className="b1-lead" style={{ marginTop: 8 }}>{b1t('veille.paywall.sous')}</p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="b1-veille-inter-cta"
          data-testid="b1-veille-paywall-cta"
          onClick={() => navigate('/app-v2/settings/subscription')}
        >
          {b1t('veille.paywall.cta')}
        </button>
        <button
          className="b1-veille-inter-lien"
          data-testid="b1-veille-paywall-retour"
          onClick={() => navigate('/app-b1')}
        >
          {b1t('veille.paywall.retour')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page dédiée : liste des biens marqués « à suivre »
// ---------------------------------------------------------------------------
export function MesVeilleSuivisPage() {
  const navigate = useNavigate();
  const [suivis, setSuivis] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await veilleApi.suivis();
      setSuivis(r.suivis || []);
    } catch (e) {
      if (e.status === 402) { navigate('/app-b1/veille/paywall'); return; }
      setSuivis([]);
    } finally { setLoading(false); }
  }, [navigate]);
  useEffect(() => { load(); }, [load]);

  const retirer = async (card) => {
    try {
      await veilleApi.patchStatut(card.listing_id, 'veille_ignoree');
      setSuivis((s) => s.filter((x) => x.listing_id !== card.listing_id));
    } catch (_) {}
  };

  return (
    <div className="b1-root">
      <div className="b1-screen">
        <div className="b1-screen-header">
          <button className="b1-back-btn" onClick={() => navigate(-1)} aria-label="Retour" data-testid="b1-veille-suivis-back">
            <ArrowLeft size={20} />
          </button>
          <div className="b1-h2" style={{ fontSize: 17 }}>{b1t('veille.section.titre')}</div>
          <div style={{ width: 40 }} />
        </div>
        <p className="b1-small">{b1t('veille.section.sous')}</p>
        {loading && <p className="b1-small">{b1t('sys.un_instant')}</p>}
        {!loading && suivis.length === 0 && (
          <div className="b1-card" data-testid="b1-veille-suivis-vide">
            <p className="b1-lead">{b1t('veille.vide.section')}</p>
          </div>
        )}
        {suivis.map((card) => {
          const pctAbs = absPct(card.price_drop_pct);
          const baisse = baisseTexte(card.price_drop_count, pctAbs);
          return (
            <div className="b1-veille-suivi-item" key={card.listing_id} data-testid={`b1-veille-suivi-${card.listing_id}`}>
              <p className="b1-veille-suivi-adresse">{card.adresse || '—'}</p>
              {card.days_on_market != null && (
                <div className="b1-veille-suivi-fait">{b1t('veille.fait.dom', { n: card.days_on_market })}</div>
              )}
              {baisse && <div className="b1-veille-suivi-fait">{baisse}</div>}
              <div className="b1-veille-suivi-actions">
                {card.url_annonce && (
                  <button className="b1-veille-suivi-lien" onClick={() => window.open(card.url_annonce, '_blank', 'noopener,noreferrer')} data-testid={`b1-veille-suivi-lien-${card.listing_id}`}>
                    {b1t('veille.voir_annonce')}
                  </button>
                )}
                <button className="b1-veille-suivi-retirer" onClick={() => retirer(card)} data-testid={`b1-veille-suivi-retirer-${card.listing_id}`}>
                  {b1t('veille.section.retirer')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page pile de veille (accessible via l'intercalaire ou par deeplink)
// ---------------------------------------------------------------------------
export function VeillePileDuJourPage() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await veilleApi.fileDuJour();
        if (cancelled) return;
        setCards(r.cartes || []);
        setEmpty((r.cartes || []).length === 0);
      } catch (e) {
        if (cancelled) return;
        if (e.status === 402) { navigate('/app-b1/veille/paywall'); return; }
        setCards([]);
        setEmpty(true);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const advance = async (card, statut) => {
    try { await veilleApi.patchStatut(card.listing_id, statut); } catch (_) {}
    setIdx((i) => i + 1);
  };

  const cur = cards[idx];
  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen">
          <div className="b1-screen-header">
            <button className="b1-back-btn" onClick={() => navigate('/app-b1')} aria-label="Retour" data-testid="b1-veille-back">
              <ArrowLeft size={20} />
            </button>
            <div className="b1-h2" style={{ fontSize: 17 }}>{b1t('veille.bandeau')}</div>
            <div style={{ width: 40 }} />
          </div>
          {loading && <p className="b1-small" style={{ textAlign: 'center' }}>{b1t('sys.un_instant')}</p>}
          {!loading && empty && (
            <div className="b1-card" data-testid="b1-veille-empty">
              <p className="b1-lead">{b1t('veille.vide.jour')}</p>
            </div>
          )}
          {!loading && !empty && cur && (
            <VeilleCard
              card={cur}
              onSkip={(c) => advance(c, 'veille_ignoree')}
              onWatch={(c) => advance(c, 'veille_a_surveiller')}
            />
          )}
          {!loading && !empty && !cur && (
            <div className="b1-card" data-testid="b1-veille-fin">
              <p className="b1-lead">{b1t('veille.vide.jour')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
