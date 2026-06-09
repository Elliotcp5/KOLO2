import React, { useState } from 'react';
import { Sparkles, Loader2, Globe, Check, X, ExternalLink, Copy, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../config/api';
import BrandPreviewCarousel from './BrandPreviewCarousel';

const auth = () => {
  const t = localStorage.getItem('kolo_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/**
 * White-Label Wizard for super admins.
 * Step 1: scan a website URL → LLM extracts brand identity.
 * Step 2: review and tweak the proposed config.
 * Step 3: create the org + invite link for the client admin.
 */
const WhiteLabelTab = () => {
  const { locale } = useLocale();
  const [step, setStep] = useState(1);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scan, setScan] = useState(null);
  const [config, setConfig] = useState({
    name: '', primary_color: '#8B5CF6', secondary_color: '#EC4899',
    logo_url: '', sector: 'immobilier', font_family: 'Inter',
    tagline: '', pitch: '', contact_email: '', seats: 50, plan: 'enterprise',
    custom_subdomain: '', monthly_price_per_seat_eur: 1900,
    billing_country: 'FR', promo_months_free: 0,
  });
  const [createdOrg, setCreatedOrg] = useState(null);

  const startScan = async (e) => {
    e?.preventDefault?.();
    if (!websiteUrl.trim()) return;
    setScanning(true);
    setScan(null);
    try {
      const r = await fetch(`${API_URL}/api/admin/whitelabel/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ website_url: websiteUrl.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Scan failed');
      setScan(d);
      setConfig({
        ...config,
        name: d.suggestion.name || '',
        primary_color: d.suggestion.primary_color || '#8B5CF6',
        secondary_color: d.suggestion.secondary_color || '#EC4899',
        logo_url: d.suggestion.logo_url || '',
        sector: d.suggestion.sector || 'immobilier',
        font_family: d.suggestion.font_family || 'Inter',
        tagline: d.suggestion.tagline || '',
        pitch: d.suggestion.pitch || '',
        agent_count_estimate: d.suggestion.agent_count_estimate || '',
      });
      setStep(2);
      toast.success('Identité visuelle analysée ✓');
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setScanning(false);
    }
  };

  const create = async () => {
    if (!config.name.trim()) { toast.error('Nom requis'); return; }
    setCreating(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/whitelabel/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ ...config, website_url: scan?.website_url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Creation failed');
      setCreatedOrg(d);
      setStep(3);
      toast.success(`Marque blanche ${config.name} créée ✓`);
    } catch (e) {
      toast.error(e.message || 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const reset = () => {
    setStep(1); setWebsiteUrl(''); setScan(null); setCreatedOrg(null);
    setConfig({ name: '', primary_color: '#8B5CF6', secondary_color: '#EC4899', logo_url: '', sector: 'immobilier', font_family: 'Inter', tagline: '', pitch: '', contact_email: '', seats: 50, plan: 'enterprise', custom_subdomain: '', monthly_price_per_seat_eur: 1900, billing_country: 'FR', promo_months_free: 0 });
  };

  return (
    <div data-testid="whitelabel-tab" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="admin-section-header">
        <div>
          <h1>Marque blanche AI</h1>
          <p className="admin-section-sub">Crée une instance KOLO marque blanche en quelques clics. L'IA analyse le site du client et propose une identité visuelle complète.</p>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        {[
          { n: 1, l: 'Site' },
          { n: 2, l: 'Configuration' },
          { n: 3, l: 'Livraison' },
        ].map((s, i, arr) => (
          <React.Fragment key={s.n}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 999,
              background: step >= s.n ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(0,0,0,0.04)',
              color: step >= s.n ? 'white' : '#6B7280',
              fontWeight: 700, fontSize: 13,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: step >= s.n ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                display: 'grid', placeItems: 'center', fontSize: 12,
              }}>{step > s.n ? <Check size={12} /> : s.n}</span>
              {s.l}
            </div>
            {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: step > s.n ? '#8B5CF6' : 'rgba(0,0,0,0.08)' }} />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={startScan} className="admin-stat-card" style={{ padding: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
            <Sparkles size={16} style={{ display: 'inline', marginRight: 8, color: '#8B5CF6' }} />
            Analyser un site web
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-mid)', marginBottom: 16 }}>
            {"Colle l'URL du site de l'entreprise ou de l'agence. L'IA extrait automatiquement les couleurs, logo, polices et secteur."}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Globe size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                data-testid="whitelabel-url-input"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://iadfrance.fr"
                required
                style={{
                  width: '100%', padding: '12px 12px 12px 36px',
                  border: '1px solid var(--border)', borderRadius: 10,
                  fontSize: 14, fontFamily: 'var(--font-body)',
                  background: 'var(--bg)',
                }}
              />
            </div>
            <button
              type="submit"
              data-testid="whitelabel-scan-btn"
              disabled={scanning || !websiteUrl.trim()}
              className="org-btn-primary"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', minWidth: 140 }}
            >
              {scanning ? <><Loader2 size={14} className="spin" /> Analyse…</> : <><Sparkles size={14} /> Analyser</>}
            </button>
          </div>
        </form>
      )}

      {step === 2 && scan && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18 }}>
          {/* Form */}
          <div className="admin-stat-card" style={{ padding: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
              Configuration <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(139,92,246,0.12)', color: '#6D28D9', marginLeft: 8 }}>IA</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Nom de la marque" value={config.name} onChange={(v) => setConfig({ ...config, name: v })} testid="wl-name" />
              <Field label="Secteur" value={config.sector} onChange={(v) => setConfig({ ...config, sector: v })} testid="wl-sector" />
              <Field label="Couleur primaire" value={config.primary_color} onChange={(v) => setConfig({ ...config, primary_color: v })} type="color" testid="wl-primary" />
              <Field label="Couleur secondaire" value={config.secondary_color} onChange={(v) => setConfig({ ...config, secondary_color: v })} type="color" testid="wl-secondary" />
              <FontSelect label="Police" value={config.font_family} onChange={(v) => setConfig({ ...config, font_family: v })} testid="wl-font" />
              <Field label="Logo URL" value={config.logo_url} onChange={(v) => setConfig({ ...config, logo_url: v })} testid="wl-logo" />
              <Field label="Email contact admin" value={config.contact_email} onChange={(v) => setConfig({ ...config, contact_email: v })} type="email" testid="wl-email" />
              <Field label="Sièges (collaborateurs)" value={config.seats} onChange={(v) => setConfig({ ...config, seats: parseInt(v) || 0 })} type="number" testid="wl-seats" />
              <Field label="Sous-domaine (ex: iad)" value={config.custom_subdomain} onChange={(v) => setConfig({ ...config, custom_subdomain: v.toLowerCase().replace(/[^a-z0-9-]/g, '') })} testid="wl-subdomain" />
              <Field label="Prix par siège / mois (€)" value={config.monthly_price_per_seat_eur ? (config.monthly_price_per_seat_eur / 100) : 19} onChange={(v) => setConfig({ ...config, monthly_price_per_seat_eur: Math.round((parseFloat(v) || 0) * 100) })} type="number" testid="wl-price" />
              <div style={{ gridColumn: '1/-1' }}><Field label="Tagline" value={config.tagline} onChange={(v) => setConfig({ ...config, tagline: v })} testid="wl-tagline" /></div>
              <div style={{ gridColumn: '1/-1' }}><Field label="Pitch / présentation courte" value={config.pitch} onChange={(v) => setConfig({ ...config, pitch: v })} testid="wl-pitch" multiline /></div>
            </div>

            {/* Récapitulatif facturation TTC/HT */}
            <PriceSummary config={config} setConfig={setConfig} />

            <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(1)} className="admin-btn">Retour</button>
              <button
                data-testid="whitelabel-create-btn"
                onClick={create}
                disabled={creating || !config.name.trim()}
                className="org-btn-primary"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}
              >
                {creating ? <><Loader2 size={14} className="spin" /> Création…</> : <><Building2 size={14} /> Créer l'instance</>}
              </button>
            </div>
          </div>

          {/* Live iPhone preview carousel */}
          <div className="admin-stat-card" style={{ padding: 18, alignSelf: 'start', position: 'sticky', top: 16 }}>
            <BrandPreviewCarousel config={config} locale={locale} />
            {(scan.raw?.colors_found || []).length > 0 && (
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                <strong style={{ display: 'block', marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF' }}>Couleurs détectées sur le site</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(scan.raw?.colors_found || []).map((c) => (
                    <button
                      key={c}
                      data-testid={`wl-scan-color-${c}`}
                      onClick={() => setConfig({ ...config, primary_color: c })}
                      style={{ width: 24, height: 24, borderRadius: 6, background: c, border: '1px solid rgba(0,0,0,0.12)', cursor: 'pointer', boxShadow: '0 2px 4px -2px rgba(0,0,0,0.15)' }}
                      title={`Utiliser ${c} en couleur primaire`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && createdOrg && (
        <div className="admin-stat-card" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #22C55E, #16A34A)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', boxShadow: '0 10px 24px -8px rgba(34,197,94,0.5)' }}>
            <Check size={32} color="white" strokeWidth={3} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{createdOrg.org.name} est prête ! 🎉</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-mid)', marginBottom: 22 }}>L'instance KOLO marque blanche a été configurée. Partage le lien d'invitation à l'admin client.</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 600, margin: '0 auto 16px', padding: '10px 14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10 }}>
            <input value={createdOrg.invite_url} readOnly style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'monospace', fontSize: 12, outline: 'none', color: 'var(--ink)' }} />
            <button onClick={() => { navigator.clipboard.writeText(createdOrg.invite_url); toast.success('Copié'); }} className="admin-icon-btn" data-testid="wl-copy-invite"><Copy size={14} /></button>
            <a href={createdOrg.invite_url} target="_blank" rel="noopener noreferrer" className="admin-icon-btn"><ExternalLink size={14} /></a>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={reset} className="admin-btn" data-testid="wl-create-another">Créer une autre marque blanche</button>
            <button
              onClick={() => { navigator.clipboard.writeText(createdOrg.invite_url); toast.success('Lien copié'); }}
              data-testid="wl-copy-invite-btn"
              className="admin-btn"
              style={{ background: 'rgba(139,92,246,0.1)', color: '#6D28D9', border: '1px solid rgba(139,92,246,0.3)' }}
            >
              <Copy size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} /> Copier le lien d'invitation
            </button>
            <a
              href={`/register?org=${createdOrg.org.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="wl-preview-brand"
              className="org-btn-primary"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}
            >
              <Sparkles size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} /> Aperçu inscription brandée
            </a>
          </div>
        </div>
      )}

      <style>{`.spin { animation: kw-spin 0.8s linear infinite; } @keyframes kw-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const Field = ({ label, value, onChange, type = 'text', testid, multiline = false }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, color: 'var(--ink-mid)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    {multiline ? (
      <textarea data-testid={testid} value={value || ''} onChange={(e) => onChange(e.target.value)} rows={3}
        style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', background: 'var(--bg)' }} />
    ) : type === 'color' ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
        <input data-testid={testid} type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'monospace', background: 'var(--bg)' }} />
      </div>
    ) : (
      <input data-testid={testid} type={type} value={value || ''} onChange={(e) => onChange(e.target.value)}
        style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--bg)' }} />
    )}
  </label>
);

// Curated premium font list (web-safe + Google Fonts loaded in landing.css)
const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter — neutre moderne' },
  { value: 'Poppins', label: 'Poppins — friendly & rond' },
  { value: 'Montserrat', label: 'Montserrat — élégant' },
  { value: 'Manrope', label: 'Manrope — geometric' },
  { value: 'DM Sans', label: 'DM Sans — minimal' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans — premium' },
  { value: 'Space Grotesk', label: 'Space Grotesk — tech' },
  { value: 'Outfit', label: 'Outfit — variable contemporain' },
  { value: 'Roboto', label: 'Roboto — corporate' },
  { value: 'Lato', label: 'Lato — humaniste' },
  { value: 'Nunito', label: 'Nunito — arrondi doux' },
  { value: 'Work Sans', label: 'Work Sans — éditorial' },
  { value: 'Playfair Display', label: 'Playfair Display — serif chic (titres)' },
  { value: 'Lora', label: 'Lora — serif éditorial' },
  { value: 'Merriweather', label: 'Merriweather — serif premium' },
  { value: 'SF Pro Display', label: 'SF Pro — Apple system' },
  { value: 'system-ui', label: 'System UI — natif OS' },
];

const FontSelect = ({ label, value, onChange, testid }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, color: 'var(--ink-mid)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    <select
      data-testid={testid}
      value={value || 'Inter'}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '10px 12px',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 13,
        fontFamily: value || 'Inter',
        background: 'var(--bg)',
        color: 'var(--ink)',
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236B7280\' stroke-width=\'2\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        backgroundSize: '14px',
        paddingRight: 36,
      }}
    >
      {FONT_OPTIONS.map((f) => (
        <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
      ))}
    </select>
  </label>
);

// VAT rates by country (EU + main European markets). Values are %.
const VAT_RATES = [
  { code: 'FR', label: '🇫🇷 France', vat: 20 },
  { code: 'BE', label: '🇧🇪 Belgique', vat: 21 },
  { code: 'LU', label: '🇱🇺 Luxembourg', vat: 17 },
  { code: 'CH', label: '🇨🇭 Suisse', vat: 8.1 },
  { code: 'MC', label: '🇲🇨 Monaco', vat: 20 },
  { code: 'DE', label: '🇩🇪 Allemagne', vat: 19 },
  { code: 'ES', label: '🇪🇸 Espagne', vat: 21 },
  { code: 'IT', label: '🇮🇹 Italie', vat: 22 },
  { code: 'PT', label: '🇵🇹 Portugal', vat: 23 },
  { code: 'NL', label: '🇳🇱 Pays-Bas', vat: 21 },
  { code: 'GB', label: '🇬🇧 Royaume-Uni', vat: 20 },
  { code: 'IE', label: '🇮🇪 Irlande', vat: 23 },
  { code: 'AT', label: '🇦🇹 Autriche', vat: 20 },
  { code: 'DK', label: '🇩🇰 Danemark', vat: 25 },
  { code: 'SE', label: '🇸🇪 Suède', vat: 25 },
  { code: 'FI', label: '🇫🇮 Finlande', vat: 24 },
  { code: 'PL', label: '🇵🇱 Pologne', vat: 23 },
  { code: 'CZ', label: '🇨🇿 République tchèque', vat: 21 },
  { code: 'OTHER', label: '🌍 Hors UE / Autres', vat: 0 },
];

const fmtEur = (cents) => {
  const eur = (cents || 0) / 100;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(eur);
};

const PROMO_OPTIONS = [
  { value: 0, label: 'Aucune' },
  { value: 1, label: '1 mois offert' },
  { value: 2, label: '2 mois offerts' },
  { value: 3, label: '3 mois offerts' },
  { value: 6, label: '6 mois offerts' },
];

const PriceSummary = ({ config, setConfig }) => {
  const seats = Number(config.seats || 0);
  const pricePerSeatCents = Number(config.monthly_price_per_seat_eur || 0); // monthly per-seat, in cents
  const country = VAT_RATES.find((c) => c.code === (config.billing_country || 'FR')) || VAT_RATES[0];
  const vatPct = country.vat;
  const promoMonths = Math.min(12, Math.max(0, Number(config.promo_months_free || 0)));
  const billedMonths = Math.max(0, 12 - promoMonths);

  // Annual billing — yearly amounts
  const annualHtCents = seats * pricePerSeatCents * billedMonths;
  const annualGrossCents = seats * pricePerSeatCents * 12;
  const promoDiscountCents = annualGrossCents - annualHtCents;
  const vatCents = Math.round((annualHtCents * vatPct) / 100);
  const ttcCents = annualHtCents + vatCents;

  const hasValues = seats > 0 && pricePerSeatCents > 0;

  return (
    <div style={{ marginTop: 20 }}>
      <div
        data-testid="wl-price-summary"
        style={{
          padding: 18,
          borderRadius: 14,
          border: '1px solid rgba(139,92,246,0.25)',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(236,72,153,0.05))',
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1fr) 1fr 1fr',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-mid)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pays de facturation</span>
          <select
            data-testid="wl-country"
            value={config.billing_country || 'FR'}
            onChange={(e) => setConfig({ ...config, billing_country: e.target.value })}
            style={{
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13,
              background: 'var(--bg)',
              color: 'var(--ink)',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236B7280\' stroke-width=\'2\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
              backgroundSize: '14px',
              paddingRight: 32,
            }}
          >
            {VAT_RATES.map((c) => (
              <option key={c.code} value={c.code}>{c.label} · TVA {c.vat}%</option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: 'var(--ink-mid)', marginTop: 2 }}>
            {hasValues
              ? `${seats} sièges × ${fmtEur(pricePerSeatCents)} × ${billedMonths} mois facturés`
              : 'Renseignez sièges + prix au-dessus'}
          </span>
        </label>

        <div style={{ textAlign: 'center' }} data-testid="wl-price-ht">
          <div style={{ fontSize: 11, color: 'var(--ink-mid)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Prix HT / an</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>
            {hasValues ? fmtEur(annualHtCents) : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-mid)', marginTop: 2 }}>
            {promoMonths > 0 && hasValues
              ? <>au lieu de <s>{fmtEur(annualGrossCents)}</s></>
              : 'hors taxes · facturation annuelle'}
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            padding: '12px 14px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(20,184,166,0.08))',
            border: '1px solid rgba(34,197,94,0.25)',
          }}
          data-testid="wl-price-ttc"
        >
          <div style={{ fontSize: 11, color: '#15803D', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Prix TTC / an</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800, color: '#15803D' }}>
            {hasValues ? fmtEur(ttcCents) : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#15803D', marginTop: 2 }}>
            {vatPct > 0 ? `incl. TVA ${vatPct}% (${fmtEur(vatCents)})` : 'hors UE — TVA non appliquée'}
          </div>
        </div>
      </div>

      {/* Promotion appliquée — subtle dropdown below the main summary */}
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '8px 14px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.02)',
          border: '1px dashed var(--border)',
          fontSize: 12,
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-mid)' }}>
          <span style={{ fontWeight: 600 }}>Promotion appliquée</span>
          <select
            data-testid="wl-promo"
            value={config.promo_months_free || 0}
            onChange={(e) => setConfig({ ...config, promo_months_free: Number(e.target.value) })}
            style={{
              padding: '5px 26px 5px 10px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
              background: 'var(--bg)',
              color: 'var(--ink)',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236B7280\' stroke-width=\'2\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
              backgroundSize: '12px',
            }}
          >
            {PROMO_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        {promoMonths > 0 && hasValues && (
          <span style={{ color: '#15803D', fontWeight: 600 }} data-testid="wl-promo-saved">
            Économie : −{fmtEur(promoDiscountCents)}
          </span>
        )}
      </div>
    </div>
  );
};

export default WhiteLabelTab;
