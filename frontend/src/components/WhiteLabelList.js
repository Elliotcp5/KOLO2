import React, { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../config/api';
import { toast } from 'sonner';
import {
  Building2, ExternalLink, Edit3, Trash2, RefreshCw, Copy, FileText,
  Sparkles, X, Check, AlertCircle, CreditCard, Eye,
} from 'lucide-react';

const auth = () => {
  const t = localStorage.getItem('kolo_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const api = async (path, options = {}) => {
  const r = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...auth(), ...(options.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
  return data;
};

const fmtEur = (cents) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);

const VAT_BY_COUNTRY = {
  FR: 20, BE: 21, LU: 17, CH: 8.1, MC: 20, DE: 19, ES: 21, IT: 22, PT: 23,
  NL: 21, GB: 20, IE: 23, AT: 20, DK: 25, SE: 25, FI: 24, PL: 23, CZ: 21,
};

const computeAnnualHT = (org) => {
  const seats = Number(org.seats || 0);
  const monthly = Number(org.monthly_price_per_seat_eur || 0);
  const promo = Math.min(12, Math.max(0, Number(org.promo_months_free || 0)));
  return seats * monthly * (12 - promo);
};

const WhiteLabelList = ({ onCreate }) => {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [billingFor, setBillingFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api('/api/admin/whitelabel/list');
      setOrgs(d.orgs || []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (org) => {
    if (!window.confirm(`Supprimer définitivement « ${org.name} » ? Cette action est irréversible et déconnectera tous ses membres.`)) return;
    try {
      await api(`/api/admin/whitelabel/${org.org_id}`, { method: 'DELETE' });
      toast.success(`« ${org.name} » supprimée`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const copyInvite = async (org) => {
    try {
      const d = await api(`/api/admin/whitelabel/${org.org_id}/invite-link`);
      await navigator.clipboard.writeText(d.invite_url);
      toast.success('Lien d\'invitation copié');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="whitelabel-list-tab">
      <div className="admin-section-header">
        <div>
          <h1>Mes marques blanches</h1>
          <p className="admin-section-sub">Toutes les instances marque blanche que tu as déployées. Accède, modifie, supprime, génère des factures.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} className="admin-btn" data-testid="wl-list-refresh"><RefreshCw size={14} /> Actualiser</button>
          <button onClick={onCreate} className="admin-btn primary" data-testid="wl-list-create" style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', color: 'white', border: 'none' }}>
            <Sparkles size={14} /> Créer une nouvelle marque
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin-empty">Chargement…</div>
      ) : orgs.length === 0 ? (
        <div className="admin-empty" data-testid="wl-list-empty" style={{ textAlign: 'center', padding: 40 }}>
          <Building2 size={40} style={{ margin: '0 auto 12px', color: 'var(--ink-soft)' }} />
          <p style={{ marginBottom: 16 }}>Aucune marque blanche pour le moment.</p>
          <button onClick={onCreate} className="org-btn-primary" style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}>
            <Sparkles size={14} /> Créer ma première marque blanche
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }} data-testid="wl-list-grid">
          {orgs.map((o) => {
            const annualHt = computeAnnualHT(o);
            const vatPct = VAT_BY_COUNTRY[o.billing_country || 'FR'] ?? 20;
            const ttc = annualHt + Math.round((annualHt * vatPct) / 100);
            return (
              <div key={o.org_id} className="admin-stat-card" data-testid={`wl-card-${o.slug || o.org_id}`} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {o.logo_url ? (
                    <img src={o.logo_url} alt={o.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', background: '#f7f7fa', padding: 4, border: '1px solid var(--border)' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: o.primary_color || '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 18 }}>
                      {(o.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{o.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontFamily: 'monospace' }}>/{o.slug}{o.custom_subdomain && ` · ${o.custom_subdomain}.kolo.io`}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <div style={{ color: 'var(--ink-mid)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Sièges</div>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{o.seats_used || 0} / {o.seats || 0}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--ink-mid)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Annuel HT</div>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{fmtEur(annualHt)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--ink-mid)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Pays / TVA</div>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{o.billing_country || 'FR'} · {vatPct}%</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--ink-mid)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>Statut</div>
                    <div style={{ fontWeight: 700, color: o.billing_status === 'active' ? '#22C55E' : '#F59E0B' }}>{o.billing_status || 'trialing'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <a href={`/org?org_id=${o.org_id}`} className="admin-icon-btn" data-testid={`wl-view-space-${o.slug}`} title="Entrer dans l'espace du réseau (Mode super admin)"
                     style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(236,72,153,0.10))', color: '#6D28D9', textDecoration: 'none', fontWeight: 700, border: '1px solid rgba(139,92,246,0.3)' }}>
                    <Eye size={13} /> Voir l'espace
                  </a>
                  <a href={`/register?org=${o.slug}`} target="_blank" rel="noopener noreferrer" className="admin-icon-btn" data-testid={`wl-preview-${o.slug}`} title="Aperçu inscription brandée"
                     style={{ background: 'rgba(139,92,246,0.08)', color: '#6D28D9', textDecoration: 'none' }}>
                    <ExternalLink size={13} /> Aperçu
                  </a>
                  <button onClick={() => copyInvite(o)} className="admin-icon-btn" data-testid={`wl-invite-${o.slug}`} title="Copier le lien d'invitation">
                    <Copy size={13} /> Lien
                  </button>
                  <button onClick={() => setBillingFor(o)} className="admin-icon-btn" data-testid={`wl-billing-${o.slug}`} title="Facturation">
                    <FileText size={13} /> Facture
                  </button>
                  <button onClick={() => setEditing(o)} className="admin-icon-btn" data-testid={`wl-edit-${o.slug}`} title="Modifier">
                    <Edit3 size={13} /> Modifier
                  </button>
                  <button onClick={() => remove(o)} className="admin-icon-btn" data-testid={`wl-delete-${o.slug}`} title="Supprimer" style={{ color: '#EF4444' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && <EditModal org={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {billingFor && <BillingModal org={billingFor} onClose={() => setBillingFor(null)} />}
    </div>
  );
};

// =========================================================================
// Edit modal
// =========================================================================
const EditModal = ({ org, onClose, onSaved }) => {
  const [name, setName] = useState(org.name || '');
  const [primary, setPrimary] = useState(org.primary_color || '#8B5CF6');
  const [secondary, setSecondary] = useState(org.secondary_color || '#EC4899');
  const [logo, setLogo] = useState(org.logo_url || '');
  const [tagline, setTagline] = useState(org.tagline || '');
  const [seats, setSeats] = useState(org.seats || 50);
  const [priceCents, setPriceCents] = useState(org.monthly_price_per_seat_eur || 1900);
  const [country, setCountry] = useState(org.billing_country || 'FR');
  const [promo, setPromo] = useState(org.promo_months_free || 0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/admin/whitelabel/${org.org_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name, primary_color: primary, secondary_color: secondary, logo_url: logo,
          tagline, seats, monthly_price_per_seat_eur: priceCents,
          billing_country: country, promo_months_free: promo,
        }),
      });
      toast.success('Marque blanche mise à jour');
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 16, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }} data-testid="wl-edit-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800, margin: 0 }}>Modifier « {org.name} »</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-mid)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Lbl label="Nom"><input value={name} onChange={(e) => setName(e.target.value)} className="admin-input" /></Lbl>
          <Lbl label="Logo URL"><input value={logo} onChange={(e) => setLogo(e.target.value)} className="admin-input" /></Lbl>
          <Lbl label="Couleur primaire"><input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="admin-input" /></Lbl>
          <Lbl label="Couleur secondaire"><input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="admin-input" /></Lbl>
          <div style={{ gridColumn: '1/-1' }}><Lbl label="Tagline"><input value={tagline} onChange={(e) => setTagline(e.target.value)} className="admin-input" /></Lbl></div>
          <Lbl label="Sièges"><input type="number" value={seats} onChange={(e) => setSeats(Number(e.target.value) || 0)} className="admin-input" /></Lbl>
          <Lbl label="Prix / siège / mois (€)"><input type="number" step="0.01" value={priceCents / 100} onChange={(e) => setPriceCents(Math.round((parseFloat(e.target.value) || 0) * 100))} className="admin-input" /></Lbl>
          <Lbl label="Pays facturation">
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="admin-input">
              {Object.keys(VAT_BY_COUNTRY).map((c) => <option key={c} value={c}>{c} · TVA {VAT_BY_COUNTRY[c]}%</option>)}
            </select>
          </Lbl>
          <Lbl label="Promo (mois offerts)">
            <select value={promo} onChange={(e) => setPromo(Number(e.target.value))} className="admin-input">
              {[0, 1, 2, 3, 6].map((p) => <option key={p} value={p}>{p === 0 ? 'Aucune' : `${p} mois`}</option>)}
            </select>
          </Lbl>
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="admin-btn">Annuler</button>
          <button onClick={save} disabled={saving} data-testid="wl-edit-save" className="admin-btn primary" style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', color: 'white', border: 'none' }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
};

const Lbl = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, color: 'var(--ink-mid)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    {children}
  </label>
);

// =========================================================================
// Billing modal — generate invoice + bank transfer details
// =========================================================================
const BillingModal = ({ org, onClose }) => {
  const [generating, setGenerating] = useState(false);
  const [invoice, setInvoice] = useState(null);

  const generate = async () => {
    setGenerating(true);
    try {
      const d = await api(`/api/admin/whitelabel/${org.org_id}/invoice`, { method: 'POST' });
      setInvoice(d.invoice);
      toast.success('Facture générée');
    } catch (e) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  const annualHt = computeAnnualHT(org);
  const vatPct = VAT_BY_COUNTRY[org.billing_country || 'FR'] ?? 20;
  const vat = Math.round((annualHt * vatPct) / 100);
  const ttc = annualHt + vat;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }} data-testid="wl-billing-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800, margin: 0 }}>Facturation — {org.name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-mid)' }}><X size={20} /></button>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(236,72,153,0.05))', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <Row label="Sièges" value={`${org.seats || 0}`} />
          <Row label="Prix / siège / mois" value={fmtEur(org.monthly_price_per_seat_eur)} />
          <Row label="Promotion" value={org.promo_months_free > 0 ? `${org.promo_months_free} mois offerts` : 'Aucune'} />
          <Row label="Mois facturés" value={`${12 - (org.promo_months_free || 0)} / 12`} />
          <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '8px 0' }} />
          <Row label="Total HT / an" value={fmtEur(annualHt)} bold />
          <Row label={`TVA (${vatPct}%)`} value={fmtEur(vat)} />
          <Row label="Total TTC / an" value={fmtEur(ttc)} bold primary />
        </div>

        {!invoice ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--ink-mid)', marginBottom: 14, lineHeight: 1.5 }}>
              Pour les montants ≥ 1 000 €, nos clients règlent généralement par <strong>virement bancaire</strong>.
              Génère ta facture officielle puis transmets-la à ta comptabilité.
            </p>
            <button
              onClick={generate}
              disabled={generating}
              data-testid="wl-generate-invoice-btn"
              className="org-btn-primary"
              style={{ width: '100%', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', justifyContent: 'center' }}
            >
              <FileText size={16} /> {generating ? 'Génération…' : 'Générer ma facture'}
            </button>
          </>
        ) : (
          <div data-testid="wl-invoice-result">
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Check size={20} color="#16A34A" />
              <div>
                <div style={{ fontWeight: 700, color: '#15803D' }}>Facture {invoice.invoice_number}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-mid)' }}>Émise le {new Date(invoice.issued_at).toLocaleDateString('fr-FR')} · échéance {new Date(invoice.due_at).toLocaleDateString('fr-FR')}</div>
              </div>
            </div>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Coordonnées bancaires</h3>
            <div style={{ background: '#f8f8fc', borderRadius: 10, padding: 14, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7 }}>
              <div><strong>Bénéficiaire :</strong> {invoice.beneficiary || 'KOLO SAS'}</div>
              <div><strong>IBAN :</strong> {invoice.iban || 'FR76 1010 7001 9300 0123 4567 890'}</div>
              <div><strong>BIC :</strong> {invoice.bic || 'CCMBFRPP'}</div>
              <div><strong>Référence :</strong> {invoice.reference}</div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 10, lineHeight: 1.5 }}>
              <AlertCircle size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Indique impérativement la référence dans le libellé du virement pour un traitement rapide.
            </p>

            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              {invoice.pdf_url && (
                <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer" className="admin-btn" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                  <FileText size={14} /> Télécharger PDF
                </a>
              )}
              <button onClick={() => { navigator.clipboard.writeText(invoice.iban || ''); toast.success('IBAN copié'); }} className="admin-btn" style={{ flex: 1 }}>
                <Copy size={14} /> Copier IBAN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Row = ({ label, value, bold, primary }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: bold ? 14 : 13 }}>
    <span style={{ color: 'var(--ink-mid)', fontWeight: bold ? 600 : 400 }}>{label}</span>
    <span style={{ color: primary ? '#15803D' : 'var(--ink)', fontWeight: bold ? 800 : 600, fontFamily: 'var(--font-heading)' }}>{value}</span>
  </div>
);

export default WhiteLabelList;
