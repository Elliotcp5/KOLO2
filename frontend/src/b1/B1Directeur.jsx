// KOLO — BLOC D1 : écrans du directeur (Répartition, Mon équipe, Mon agence).
// Accès conditionné à `user.role === 'directeur'`. Aucune mention de montant,
// d'URL de paiement, ni de fournisseur. La création d'organisation ne se fait
// JAMAIS depuis l'app iOS — l'utilisateur atterrit ici parce que l'admin
// l'a rattaché à une organisation via le back-office.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, MapPin, Building2, RefreshCw, Trash2, Mail, X, Check } from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';
import './b1.css';

// ---------------------------------------------------------------------------
// Bottom tab bar réservé au directeur
// ---------------------------------------------------------------------------
export function DirecteurTabBar({ active }) {
  const navigate = useNavigate();
  const tabs = [
    { id: 'repartition', to: '/app-b1/directeur/repartition', Icon: RefreshCw, label: b1t('dir.nav.repartition') },
    { id: 'equipe', to: '/app-b1/directeur/equipe', Icon: Users, label: b1t('dir.nav.equipe') },
    { id: 'agence', to: '/app-b1/directeur/agence', Icon: Building2, label: b1t('dir.nav.agence') },
  ];
  return (
    <nav className="b1-tabbar" data-testid="d1-directeur-tabbar" aria-label="Navigation directeur">
      {tabs.map((t) => (
        <button
          key={t.id}
          className="b1-tab"
          data-active={active === t.id}
          data-testid={`d1-tab-${t.id}`}
          onClick={() => navigate(t.to)}
          aria-label={t.label}
        >
          <t.Icon size={22} />
        </button>
      ))}
    </nav>
  );
}

function BackHeader({ label }) {
  const navigate = useNavigate();
  return (
    <div className="b1-screen-header">
      <button className="b1-back-btn" data-testid="d1-back-btn" onClick={() => navigate('/app-b1')} aria-label="Retour">
        <ArrowLeft size={20} />
      </button>
      <div className="b1-h2" style={{ fontSize: 17 }}>{label}</div>
      <div style={{ width: 40 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Répartition
// ---------------------------------------------------------------------------
export function DirecteurRepartitionPage() {
  const [orga, setOrga] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => {
    b1api.getMyOrganisation().then((r) => setOrga(r.organisation)).catch(() => {});
  }, []);
  const mode = orga?.mode_repartition || 'manuel';
  const runAuto = async () => {
    setBusy(true); setToast('');
    try {
      const r = await b1api.autoResteRepartir();
      setToast(b1t('dir.repartition.toast.resume', {
        attribuees: r.attribuees || 0,
        ignorees: r.ignorees || 0,
      }));
    } catch (_e) {
      setToast(b1t('sys.connexion_perdue'));
    } finally { setBusy(false); }
  };
  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen">
          <BackHeader label={b1t('dir.repartition.titre')} />
          <p className="b1-lead">{b1t('dir.repartition.sous')}</p>

          {mode === 'auto' && (
            <div className="b1-card" data-testid="d1-bandeau-auto" style={{ background: 'var(--b1-accent-light)', marginTop: 12 }}>
              <div className="b1-small">{b1t('dir.repartition.bandeau_auto')}</div>
            </div>
          )}
          {mode === 'mixte' && (
            <div className="b1-card" data-testid="d1-bandeau-mixte" style={{ background: 'var(--b1-accent-light)', marginTop: 12 }}>
              <div className="b1-small">{b1t('dir.repartition.bandeau_mixte')}</div>
            </div>
          )}

          <div className="b1-card" style={{ marginTop: 16 }} data-testid="d1-repartition-vide">
            <p className="b1-lead">{b1t('dir.repartition.vide')}</p>
          </div>

          <button
            className="b1-pill b1-pill--ghost b1-pill--fullwidth"
            data-testid="d1-repartition-auto-reste"
            style={{ marginTop: 16 }}
            disabled={busy}
            onClick={runAuto}
          >
            {busy ? b1t('sys.un_instant') : b1t('dir.repartition.auto_reste')}
          </button>

          {toast && (
            <div className="b1-card" data-testid="d1-repartition-toast" style={{ marginTop: 12, background: 'var(--b1-accent-light)' }}>
              <div className="b1-small" style={{ color: 'var(--b1-text)' }}>{toast}</div>
            </div>
          )}
        </div>
        <DirecteurTabBar active="repartition" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mon équipe
// ---------------------------------------------------------------------------
export function DirecteurEquipePage() {
  const [equipe, setEquipe] = useState([]);
  const [alerte, setAlerte] = useState(0);
  const [periode, setPeriode] = useState('mois');
  const [invitations, setInvitations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await b1api.getEquipe(periode);
      setEquipe(r.equipe || []);
      setAlerte(r.alerte_48h_total || 0);
      setForbidden(false);
    } catch (e) {
      if (e?.status === 403) setForbidden(true);
    }
    try {
      const r = await b1api.listInvitations();
      setInvitations((r.invitations || []).filter((i) => i.statut !== 'acceptee' && i.statut !== 'annulee'));
    } catch (_e) { /* noop */ }
  }, [periode]);

  useEffect(() => { refresh(); }, [refresh]);

  const inviter = async () => {
    setSaving(true);
    try {
      await b1api.createInvitation(email.trim().toLowerCase());
      setToast(b1t('dir.equipe.toast.envoyee', { email }));
      setEmail('');
      setShowModal(false);
      await refresh();
    } catch (e) {
      const code = String(e?.message || '');
      if (code === 'deja_invite') setToast(b1t('dir.equipe.toast.deja_invite'));
      else if (code === 'deja_membre') setToast(b1t('dir.equipe.toast.deja_membre'));
      else if (code === 'plafond_sieges') setToast(b1t('dir.equipe.toast.plafond'));
      else setToast(code);
    } finally {
      setSaving(false);
    }
  };

  const retirer = async (userId) => {
    try {
      await b1api.retirerConseiller(userId);
      setToast(b1t('dir.equipe.toast.retire'));
      setConfirmRetirer(null);
      await refresh();
    } catch (_e) { /* noop */ }
  };
  const [confirmRetirer, setConfirmRetirer] = useState(null);

  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen">
          <BackHeader label={b1t('dir.equipe.titre')} />
          <p className="b1-lead">{b1t('dir.equipe.sous')}</p>

          {forbidden ? (
            <div className="b1-card" data-testid="d1-forbidden" style={{ marginTop: 16, background: 'rgba(220,38,38,0.05)' }}>
              <div className="b1-h2" style={{ fontSize: 17 }}>{b1t('dir.acces_refuse.titre')}</div>
              <p className="b1-lead" style={{ marginTop: 8 }}>{b1t('dir.acces_refuse.sous')}</p>
            </div>
          ) : (
            <>
          {/* Sélecteur période */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }} data-testid="d1-periode-selector">
            <button
              className={`b1-pill ${periode === 'mois' ? 'b1-pill--primary' : 'b1-pill--ghost'}`}
              data-testid="d1-periode-mois"
              onClick={() => setPeriode('mois')}
            >
              {b1t('dir.equipe.periode.mois')}
            </button>
            <button
              className={`b1-pill ${periode === 'semaine' ? 'b1-pill--primary' : 'b1-pill--ghost'}`}
              data-testid="d1-periode-semaine"
              onClick={() => setPeriode('semaine')}
            >
              {b1t('dir.equipe.periode.semaine')}
            </button>
          </div>

          {alerte > 0 && (
            <div className="b1-card" data-testid="d1-alerte-48h" style={{ marginTop: 16, background: 'rgba(220,38,38,0.08)' }}>
              <div className="b1-small" style={{ color: 'var(--b1-danger)' }}>
                {alerte === 1
                  ? b1t('dir.equipe.alerte_48h_one', { n: alerte })
                  : b1t('dir.equipe.alerte_48h', { n: alerte })}
              </div>
            </div>
          )}

          {/* Tableau équipe — compact mobile-first */}
          <div style={{ marginTop: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }} data-testid="d1-equipe-table">
            {equipe.length === 0 && invitations.length === 0 ? (
              <div className="b1-card"><p className="b1-lead">{b1t('dir.equipe.vide')}</p></div>
            ) : (
              <table style={{ minWidth: 600, width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--b1-border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', whiteSpace: 'nowrap' }}>{b1t('dir.equipe.col.conseiller')}</th>
                    <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{b1t('dir.equipe.col.attribuees')}</th>
                    <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{b1t('dir.equipe.col.ignorees')}</th>
                    <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{b1t('dir.equipe.col.a_demarcher')}</th>
                    <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{b1t('dir.equipe.col.demarchees')}</th>
                    <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{b1t('dir.equipe.col.mandats')}</th>
                    <th style={{ padding: '8px 6px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {equipe.map((m) => (
                    <tr key={m.user_id} data-testid={`d1-equipe-row-${m.user_id}`} style={{ borderBottom: '1px solid var(--b1-border)' }}>
                      <td style={{ padding: '10px 4px' }}>
                        <div style={{ fontWeight: 600 }}>{m.prenom} {m.nom}</div>
                        <div className="b1-small">
                          {b1t(`role.${m.role || 'conseiller'}`)} · {b1t('dir.equipe.taux_traitement', { pct: m.taux_traitement_pct })}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }} data-testid={`d1-cell-attrib-${m.user_id}`}>{m.attribuees}</td>
                      <td style={{ textAlign: 'center' }}>{m.ignorees}</td>
                      <td style={{ textAlign: 'center' }}>{m.a_demarcher}</td>
                      <td style={{ textAlign: 'center' }}>{m.demarchees}</td>
                      <td style={{ textAlign: 'center' }}>{m.mandats}</td>
                      <td style={{ textAlign: 'right', padding: '10px 4px' }}>
                        {m.role !== 'directeur' && (
                          <button
                            className="b1-back-btn"
                            data-testid={`d1-retirer-${m.user_id}`}
                            onClick={() => setConfirmRetirer(m)}
                            aria-label={b1t('dir.equipe.action.retirer')}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {invitations.map((i) => (
                    <tr key={i.id} data-testid={`d1-invit-row-${i.id}`} style={{ borderBottom: '1px solid var(--b1-border)', opacity: 0.7 }}>
                      <td style={{ padding: '10px 4px' }}>
                        <div>{i.email}</div>
                        <div className="b1-small">
                          {i.statut === 'envoyee'
                            ? b1t('dir.equipe.statut.invite')
                            : i.statut === 'expiree'
                            ? b1t('dir.equipe.statut.expire')
                            : i.statut}
                        </div>
                      </td>
                      <td colSpan={5}></td>
                      <td style={{ textAlign: 'right', padding: '10px 4px' }}>
                        <button
                          className="b1-back-btn"
                          data-testid={`d1-annuler-invit-${i.id}`}
                          onClick={async () => { await b1api.annulerInvitation(i.id); await refresh(); }}
                          aria-label={b1t('dir.equipe.action.annuler_invit')}
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <button
            className="b1-pill b1-pill--primary b1-pill--fullwidth"
            data-testid="d1-inviter-cta"
            style={{ marginTop: 20 }}
            onClick={() => setShowModal(true)}
          >
            <Mail size={16} style={{ marginRight: 8 }} />
            {b1t('dir.equipe.inviter')}
          </button>

          {toast && (
            <div className="b1-card" data-testid="d1-toast" style={{ marginTop: 12, background: 'var(--b1-accent-light)' }}>
              <div className="b1-small" style={{ color: 'var(--b1-text)' }}>{toast}</div>
            </div>
          )}
            </>
          )}
        </div>
        <DirecteurTabBar active="equipe" />

        {showModal && (
          <div className="b1-sheet-backdrop" onClick={() => setShowModal(false)}>
            <div className="b1-sheet" onClick={(e) => e.stopPropagation()} data-testid="d1-invit-modal">
              <div className="b1-sheet-handle" />
              <h2 className="b1-h2">{b1t('dir.equipe.modal.titre')}</h2>
              <p className="b1-lead" style={{ marginTop: 8 }}>{b1t('dir.equipe.modal.sous')}</p>
              <div className="b1-input-label" style={{ marginTop: 20 }}>{b1t('dir.equipe.modal.email')}</div>
              <input
                className="b1-input"
                type="email"
                autoComplete="email"
                data-testid="d1-invit-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                className="b1-pill b1-pill--primary b1-pill--fullwidth"
                style={{ marginTop: 16 }}
                data-testid="d1-invit-envoyer"
                disabled={saving || !email.includes('@')}
                onClick={inviter}
              >
                <Check size={16} style={{ marginRight: 8 }} />
                {b1t('dir.equipe.modal.cta')}
              </button>
            </div>
          </div>
        )}

        {confirmRetirer && (
          <div className="b1-sheet-backdrop" onClick={() => setConfirmRetirer(null)}>
            <div className="b1-sheet" onClick={(e) => e.stopPropagation()} data-testid="d1-retirer-modal">
              <div className="b1-sheet-handle" />
              <h2 className="b1-h2">{b1t('dir.equipe.action.retirer')}</h2>
              <p className="b1-lead" style={{ marginTop: 8 }}>
                {`${confirmRetirer.prenom} ${confirmRetirer.nom}`}
              </p>
              <p className="b1-small" style={{ marginTop: 8 }}>
                {b1t('dir.equipe.toast.retire')}
              </p>
              <button
                className="b1-pill b1-pill--danger b1-pill--fullwidth"
                style={{ marginTop: 20 }}
                data-testid="d1-retirer-confirm"
                onClick={() => retirer(confirmRetirer.user_id)}
              >
                {b1t('dir.equipe.action.retirer')}
              </button>
              <button
                className="b1-pill b1-pill--ghost b1-pill--fullwidth"
                style={{ marginTop: 8 }}
                data-testid="d1-retirer-annuler"
                onClick={() => setConfirmRetirer(null)}
              >
                {b1t('profil.suppr.annuler')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mon agence
// ---------------------------------------------------------------------------
export function DirecteurAgencePage() {
  const [orga, setOrga] = useState(null);
  const [values, setValues] = useState({});
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    b1api.getMyOrganisation().then((r) => {
      setOrga(r.organisation);
      setValues({
        nom: r.organisation?.nom || '',
        adresse: r.organisation?.adresse || '',
        telephone: r.organisation?.telephone || '',
        mode_repartition: r.organisation?.mode_repartition || 'manuel',
        directeur_prospecte: !!r.organisation?.directeur_prospecte,
      });
    }).catch((e) => {
      if (e?.status === 403) setForbidden(true);
    });
  }, []);

  const setV = (k, v) => setValues((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await b1api.patchMyOrganisation(values);
      setOrga(r.organisation);
      setToast(b1t('dir.agence.toast.sauve'));
    } catch (_e) { /* noop */ } finally {
      setSaving(false);
    }
  };

  if (!orga) {
    return (
      <div className="b1-root">
        <div className="b1-shell">
          <div className="b1-screen">
            <BackHeader label={b1t('dir.agence.titre')} />
            {forbidden ? (
              <div className="b1-card" data-testid="d1-agence-forbidden" style={{ marginTop: 12, background: 'rgba(220,38,38,0.05)' }}>
                <div className="b1-h2" style={{ fontSize: 17 }}>{b1t('dir.acces_refuse.titre')}</div>
                <p className="b1-lead" style={{ marginTop: 8 }}>{b1t('dir.acces_refuse.sous')}</p>
              </div>
            ) : (
              <p className="b1-lead">{b1t('sys.un_instant')}</p>
            )}
          </div>
          <DirecteurTabBar active="agence" />
        </div>
      </div>
    );
  }

  const libres = Math.max(0, (orga.sieges_total || 0) - (orga.sieges_utilises || 0));
  const prochaineFmt = orga.prochaine_facturation
    ? new Date(orga.prochaine_facturation).toLocaleDateString()
    : '—';

  return (
    <div className="b1-root">
      <div className="b1-shell">
        <div className="b1-screen">
          <BackHeader label={b1t('dir.agence.titre')} />

          {/* Infos */}
          <div className="b1-card" style={{ marginTop: 12 }} data-testid="d1-agence-infos">
            <div className="b1-input-label">{b1t('dir.agence.section.infos')}</div>
            <div className="b1-input-label" style={{ marginTop: 12 }}>{b1t('dir.agence.champ.nom')}</div>
            <input className="b1-input" data-testid="d1-agence-nom" value={values.nom} onChange={(e) => setV('nom', e.target.value)} />
            <div className="b1-input-label" style={{ marginTop: 12 }}>{b1t('dir.agence.champ.adresse')}</div>
            <input className="b1-input" data-testid="d1-agence-adresse" value={values.adresse} onChange={(e) => setV('adresse', e.target.value)} />
            <div className="b1-input-label" style={{ marginTop: 12 }}>{b1t('dir.agence.champ.telephone')}</div>
            <input className="b1-input" data-testid="d1-agence-tel" value={values.telephone} onChange={(e) => setV('telephone', e.target.value)} />
          </div>

          {/* Zones */}
          <div className="b1-card" style={{ marginTop: 12 }} data-testid="d1-agence-zones">
            <div className="b1-input-label">{b1t('dir.agence.section.zones')}</div>
            <div className="b1-lead" style={{ marginTop: 8 }}>
              {(orga.zones || []).length === 0 ? '—' : (orga.zones || []).join(' · ')}
            </div>
          </div>

          {/* Sièges */}
          <div className="b1-card" style={{ marginTop: 12 }} data-testid="d1-agence-sieges">
            <div className="b1-input-label">{b1t('dir.agence.section.sieges')}</div>
            <div className="b1-lead" style={{ marginTop: 8 }}>
              {b1t('dir.agence.sieges.compteur', { utilises: orga.sieges_utilises, total: orga.sieges_total })}
            </div>
            <div className="b1-small" style={{ marginTop: 4 }}>
              {b1t('dir.agence.sieges.libres', { n: libres })}
            </div>
          </div>

          {/* Mode de répartition */}
          <div className="b1-card" style={{ marginTop: 12 }} data-testid="d1-agence-mode">
            <div className="b1-input-label">{b1t('dir.agence.section.reparties')}</div>
            {['manuel', 'auto', 'mixte'].map((m) => (
              <label key={m} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--b1-border)' }}>
                <input
                  type="radio"
                  name="mode"
                  value={m}
                  data-testid={`d1-mode-${m}`}
                  checked={values.mode_repartition === m}
                  onChange={() => setV('mode_repartition', m)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{b1t(`dir.agence.mode.${m}.titre`)}</div>
                  <div className="b1-small">{b1t(`dir.agence.mode.${m}.sous`)}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Directeur prospecte aussi */}
          <div className="b1-card" style={{ marginTop: 12 }} data-testid="d1-agence-prospecte">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <input
                type="checkbox"
                data-testid="d1-directeur-prospecte"
                checked={!!values.directeur_prospecte}
                onChange={(e) => setV('directeur_prospecte', e.target.checked)}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{b1t('dir.agence.prospecte.titre')}</div>
                <div className="b1-small">{b1t('dir.agence.prospecte.sous')}</div>
              </div>
            </label>
          </div>

          <button
            className="b1-pill b1-pill--primary b1-pill--fullwidth"
            style={{ marginTop: 16 }}
            data-testid="d1-agence-save"
            disabled={saving}
            onClick={save}
          >
            {b1t('dir.agence.enregistrer')}
          </button>

          {/* Plan et facturation — AUCUN montant, aucun fournisseur */}
          {orga.prochaine_facturation && (
            <div className="b1-card" style={{ marginTop: 12 }} data-testid="d1-agence-plan">
              <div className="b1-input-label">{b1t('dir.agence.plan.titre')}</div>
              <div className="b1-lead" style={{ marginTop: 8 }}>
                {b1t('dir.agence.plan.prochaine', { date: prochaineFmt })}
              </div>
            </div>
          )}

          {/* Support */}
          <button
            className="b1-pill b1-pill--ghost b1-pill--fullwidth"
            style={{ marginTop: 12 }}
            data-testid="d1-agence-support"
            onClick={() => { window.location.href = 'mailto:contact@trykolo.io'; }}
          >
            {b1t('dir.agence.support')}
          </button>

          {toast && (
            <div className="b1-card" data-testid="d1-agence-toast" style={{ marginTop: 12, background: 'var(--b1-accent-light)' }}>
              <div className="b1-small">{toast}</div>
            </div>
          )}
        </div>
        <DirecteurTabBar active="agence" />
      </div>
    </div>
  );
}

export default {
  DirecteurRepartitionPage,
  DirecteurEquipePage,
  DirecteurAgencePage,
};
