// =============================================================
// KOLO v2 — Onboarding (multi-slides)
// =============================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Lock, Mic, Sparkles, Compass, Check, Plus, X as XIcon } from 'lucide-react';
import { V2Logo } from '../V2Layout';
import v2api from '../v2api';
import '../../styles/v2.css';

const STEPS = 10;
const ROLES = ['Mandataire immobilier', 'Agent immobilier', 'Directeur de réseau / agence'];
const CRM_TOOLS = ['Orisha (AC3)', 'Hektor', 'Netty', 'Whise', 'Sweepbright', 'Adapt-Immo', 'Apimo', 'Dôme', 'ImmoSign', 'Autre'];
const PLATFORMS = ['Leboncoin', 'Seloger', 'Bienlci', 'Jinka', 'Belles Demeures', 'Lux-Residence', 'Gens de confiance', 'Ouest France', 'Logic-immo', 'Figaro Immo', 'Etre-proprio'];
const ACTIVITIES = ['Transaction', 'Location', 'Syndic', 'Gestion', 'Location de vacances'];
const REVENUE = ['Moins de 10 000€', 'Entre 10 000€ et 30 000€', 'Entre 30 000€ et 60 000€', 'Plus de 60 000€'];
const MAIN_ACTIVITY = ['Transaction & Location', 'Location uniquement', 'Transaction uniquement'];
const TEAM_SIZES = ['1 collaborateur', '2 à 5', '6 à 20', '21 à 100', '100+'];

const POPULAR_SECTORS = [
  'Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Nantes', 'Lille', 'Nice',
  'Strasbourg', 'Montpellier', 'Rennes', 'Rouen', 'Grenoble', 'Dijon', 'Angers',
  'Saint-Étienne', 'Brest', 'Le Havre', 'Reims', 'Toulon', 'Le Mans', 'Aix-en-Provence',
  'Clermont-Ferrand', 'Tours', 'Limoges', 'Villeurbanne', 'Amiens', 'Metz', 'Besançon',
  'Perpignan', 'Caen', 'Orléans', 'Mulhouse', 'Boulogne-Billancourt', 'Nancy',
];

const Choice = ({ children, selected, onClick, testid }) => (
  <button className={`v2-choice ${selected ? 'selected' : ''}`} onClick={onClick} data-testid={testid}>
    <span>{children}</span>
    <span className="check">{selected ? <Check size={14} /> : null}</span>
  </button>
);
const Chip = ({ children, selected, onClick, testid }) => (
  <button className={`v2-chip ${selected ? 'selected' : ''}`} onClick={onClick} data-testid={testid}>{children}</button>
);

const SectorPicker = ({ selected = [], onChange }) => {
  const [custom, setCustom] = useState('');
  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter(x => x !== val));
    else onChange([...selected, val]);
  };
  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!selected.includes(v)) onChange([...selected, v]);
    setCustom('');
  };
  const remove = (val) => onChange(selected.filter(x => x !== val));
  const customs = selected.filter(s => !POPULAR_SECTORS.includes(s));
  return (
    <div data-testid="onb-sectors">
      {selected.length > 0 && (
        <div className="v2-multi" style={{ marginBottom: 14 }} data-testid="onb-sectors-selected">
          {selected.map(s => (
            <button key={s} className="v2-chip-remove" onClick={() => remove(s)} data-testid={`onb-sector-selected-${s}`}>
              {s}
              <span className="xicon"><XIcon size={11} strokeWidth={2.5} /></span>
            </button>
          ))}
        </div>
      )}
      <div className="v2-multi" data-testid="onb-sectors-suggestions">
        {POPULAR_SECTORS.map(s => (
          <Chip key={s} selected={selected.includes(s)} onClick={() => toggle(s)} testid={`onb-sector-${s}`}>{s}</Chip>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          className="v2-input"
          placeholder="Ajouter une ville ou un code postal (ex. 69003)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          data-testid="onb-sectors-custom-input"
        />
        <button
          type="button"
          className="v2-btn primary"
          style={{ padding: '13px 16px' }}
          onClick={addCustom}
          disabled={!custom.trim()}
          data-testid="onb-sectors-custom-add"
          aria-label="Ajouter"
        >
          <Plus size={16} />
        </button>
      </div>
      {customs.length > 0 && (
        <p style={{ fontSize: 11.5, color: 'var(--v2-muted-2)', marginTop: 10 }}>
          {customs.length} secteur(s) personnalisé(s) ajouté(s)
        </p>
      )}
    </div>
  );
};

export default function V2OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('kolo_locale') || 'fr'; } catch (_) { return 'fr'; }
  });
  const [data, setData] = useState({
    accepted_terms: false, role: null, activities: [], company_name: '', team_size: '',
    annual_revenue: '', main_activity: '', sectors: [], crm_tool: '', diffusion_platforms: [],
    phone: '', phone_country: 'FR',
  });
  const set = (patch) => setData(d => ({ ...d, ...patch }));
  const toggle = (k, v) => setData(d => ({ ...d, [k]: d[k].includes(v) ? d[k].filter(x => x !== v) : [...d[k], v] }));

  const setLanguage = (code) => {
    try { localStorage.setItem('kolo_locale', code); } catch (_) {}
    setLang(code);
  };

  const next = () => setStep(s => Math.min(STEPS - 1, s + 1));
  const prev = () => setStep(s => Math.max(0, s - 1));
  const finish = async () => {
    try { await v2api.saveOnboarding({ ...data, language: lang }); navigate('/app-v2'); }
    catch (e) { alert(e.message); }
  };

  const isDirector = data.role === 'Directeur de réseau / agence';

  return (
    <div className="v2-onb-shell">
      <div className="v2-onb-progress"><div style={{ width: `${((step + 1) / STEPS) * 100}%` }} /></div>
      <div className="v2-onb-content">
        {step === 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}><V2Logo size={56} /></div>
            <div className="v2-onb-eyebrow">Welcome · Bienvenue · Willkommen · Benvenuto</div>
            <h1 className="v2-onb-title">Choisis ta langue.</h1>
            <p className="v2-onb-body">L'app et l'onboarding s'adaptent à ton choix. Tu pourras toujours la changer plus tard dans tes paramètres.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 22 }} data-testid="onb-lang-grid">
              {[
                { code: 'fr', flag: '🇫🇷', label: 'Je parle Français' },
                { code: 'en', flag: '🇬🇧', label: 'I speak English' },
                { code: 'de', flag: '🇩🇪', label: 'Ich spreche Deutsch' },
                { code: 'it', flag: '🇮🇹', label: 'Parlo italiano' },
              ].map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={`v2-choice ${lang === l.code ? 'selected' : ''}`}
                  onClick={() => setLanguage(l.code)}
                  data-testid={`onb-lang-${l.code}`}
                  style={{ flexDirection: 'column', textAlign: 'center', padding: '18px 12px', gap: 6 }}
                >
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{l.flag}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{l.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}><V2Logo size={56} /></div>
            <div className="v2-onb-eyebrow"><Lock size={11} style={{ display: 'inline', verticalAlign: -1 }} /> Privacy first</div>
            <h1 className="v2-onb-title">Tes données restent les tiennes.</h1>
            <p className="v2-onb-body">
              Les informations de tes clients sont ce que tu as de plus précieux. Tout ce que tu confies à KOLO est privé, chiffré au repos comme en transit, et jamais cédé à des tiers.
            </p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 22, fontSize: 13.5, color: 'var(--v2-muted)' }}>
              <input type="checkbox" checked={data.accepted_terms} onChange={(e) => set({ accepted_terms: e.target.checked })} data-testid="onb-accept-terms" style={{ marginTop: 3 }} />
              J'ai lu et j'accepte les <a href="/terms" target="_blank" rel="noopener" style={{ color: 'var(--v2-accent)' }}>CGU</a> et la <a href="/privacy" target="_blank" rel="noopener" style={{ color: 'var(--v2-accent)' }}>Charte de confidentialité</a>.
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <div className="v2-onb-eyebrow">Étape 1</div>
            <h1 className="v2-onb-title">Quel est ton rôle ?</h1>
            {ROLES.map(r => <Choice key={r} selected={data.role === r} onClick={() => set({ role: r })} testid={`onb-role-${r}`}>{r}</Choice>)}
          </>
        )}
        {step === 3 && (
          <>
            <div className="v2-onb-eyebrow">Étape 2</div>
            <h1 className="v2-onb-title">{isDirector ? 'Présente ton organisation' : 'Précise ton activité'}</h1>
            {isDirector ? (
              <>
                <div className="v2-field"><label className="v2-label">Nom du réseau ou de l'agence</label>
                  <input className="v2-input" value={data.company_name} onChange={(e) => set({ company_name: e.target.value })} data-testid="onb-company" /></div>
                <div className="v2-field"><label className="v2-label">Taille de l'équipe</label>
                  <select className="v2-select" value={data.team_size} onChange={(e) => set({ team_size: e.target.value })} data-testid="onb-team-size">
                    <option value="">Sélectionner</option>{TEAM_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div className="v2-field"><label className="v2-label">Activités (plusieurs possibles)</label>
                  <div className="v2-multi">{ACTIVITIES.map(a => <Chip key={a} selected={data.activities.includes(a)} onClick={() => toggle('activities', a)} testid={`onb-act-${a}`}>{a}</Chip>)}</div></div>
              </>
            ) : (
              <>
                <div className="v2-field"><label className="v2-label">Ton chiffre d'affaires annuel</label>
                  <div className="v2-multi">{REVENUE.map(r => <Chip key={r} selected={data.annual_revenue === r} onClick={() => set({ annual_revenue: r })} testid={`onb-rev-${r}`}>{r}</Chip>)}</div></div>
                <div className="v2-field"><label className="v2-label">Ton activité principale</label>
                  <div className="v2-multi">{MAIN_ACTIVITY.map(a => <Chip key={a} selected={data.main_activity === a} onClick={() => set({ main_activity: a })} testid={`onb-main-${a}`}>{a}</Chip>)}</div></div>
              </>
            )}
          </>
        )}
        {step === 4 && (
          <>
            <div className="v2-onb-eyebrow">Étape 3</div>
            <h1 className="v2-onb-title">Comment tu t'appelles ?</h1>
            <p className="v2-onb-body">Pour personnaliser ton copilote.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
              <div className="v2-field"><label className="v2-label">Prénom</label><input className="v2-input" placeholder="Prénom" data-testid="onb-first" /></div>
              <div className="v2-field"><label className="v2-label">Nom</label><input className="v2-input" placeholder="Nom" data-testid="onb-last" /></div>
            </div>
          </>
        )}
        {step === 5 && (
          <>
            <div className="v2-onb-eyebrow">Étape 4</div>
            <h1 className="v2-onb-title">Ton numéro de téléphone ?</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10 }}>
              <select className="v2-select" value={data.phone_country} onChange={(e) => set({ phone_country: e.target.value })} data-testid="onb-tel-cc">
                <option value="FR">🇫🇷 +33</option><option value="BE">🇧🇪 +32</option><option value="CH">🇨🇭 +41</option>
                <option value="LU">🇱🇺 +352</option><option value="CA">🇨🇦 +1</option>
              </select>
              <input className="v2-input" type="tel" value={data.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="6 12 34 56 78" data-testid="onb-tel" />
            </div>
          </>
        )}
        {step === 6 && (
          <>
            <div className="v2-onb-eyebrow">Étape 5</div>
            <h1 className="v2-onb-title">Ta zone de prospection ?</h1>
            <p className="v2-onb-body">Sélectionne tes villes ou ajoute un code postal personnalisé.</p>
            <SectorPicker selected={data.sectors} onChange={(v) => set({ sectors: v })} />
            <p style={{ fontSize: 12.5, color: 'var(--v2-muted)', marginTop: 12 }}>Astuce : ta zone te débloque l'accès direct aux DPE et annonces du secteur.</p>
          </>
        )}
        {step === 7 && (
          <>
            <div className="v2-onb-eyebrow">Étape 6</div>
            <h1 className="v2-onb-title">Ton outil de gestion ?</h1>
            {CRM_TOOLS.map(t => <Choice key={t} selected={data.crm_tool === t} onClick={() => set({ crm_tool: t })} testid={`onb-crm-${t}`}>{t}</Choice>)}
          </>
        )}
        {step === 8 && (
          <>
            <div className="v2-onb-eyebrow">Étape 7</div>
            <h1 className="v2-onb-title">Tes plateformes de diffusion ?</h1>
            <div className="v2-multi" style={{ marginTop: 12 }}>
              {PLATFORMS.map(p => <Chip key={p} selected={data.diffusion_platforms.includes(p)} onClick={() => toggle('diffusion_platforms', p)} testid={`onb-pl-${p}`}>{p}</Chip>)}
            </div>
          </>
        )}
        {step === 9 && (
          <>
            <div className="v2-onb-eyebrow">Tu es prêt</div>
            <h1 className="v2-onb-title">Prêt à booster ton business.</h1>
            <p className="v2-onb-body">Avec KOLO c'est simple : tu poses une question, ton copilote répond.</p>
            <div className="v2-card ai-card" style={{ marginTop: 18 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--v2-accent)' }}><Mic size={16} /> <strong>Parle à ton assistant</strong></div>
              <p style={{ fontSize: 13.5, color: 'var(--v2-muted)', marginTop: 6 }}>Pour capter la réalité du terrain et valoriser ton suivi au quotidien.</p>
            </div>
            <div className="v2-card" style={{ marginTop: 10 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={16} /> <strong>Détecte les signaux</strong></div>
              <p style={{ fontSize: 13.5, color: 'var(--v2-muted)', marginTop: 6 }}>KOLO extrait les infos clés et les signaux du terrain.</p>
            </div>
            <div className="v2-card" style={{ marginTop: 10 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Compass size={16} /> <strong>Construit ton plan d'action</strong></div>
              <p style={{ fontSize: 13.5, color: 'var(--v2-muted)', marginTop: 6 }}>À partir de ton activité réelle, KOLO te guide vers les prochaines actions.</p>
            </div>
          </>
        )}
      </div>
      <div className="v2-onb-footer">
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && <button className="v2-btn secondary" onClick={prev} data-testid="onb-prev">Retour</button>}
          {step < STEPS - 1 ? (
            <button className="v2-btn primary full" onClick={next} disabled={step === 1 && !data.accepted_terms} data-testid="onb-next">
              Continuer <ChevronRight size={16} />
            </button>
          ) : (
            <button className="v2-btn primary full" onClick={finish} data-testid="onb-finish">
              Démarrer avec KOLO
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
