import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Shield, Users, Layers, Database, Lock, MapPin, Check } from 'lucide-react';
import { API_URL } from '../config/api';
import { useLocale } from '../context/LocaleContext';
import '../styles/business.css';

const TEXT = {
  fr: {
    navBack: 'Retour',
    navContact: 'Nous contacter',
    eyebrow: 'KOLO pour les réseaux',
    heroTitle1: 'L\'assistant quotidien',
    heroTitle2: 'pour votre réseau immobilier.',
    heroSub: 'KOLO s\'adapte à votre organisation. Une offre sur mesure, modulaire et sécurisée — pensée pour les grands réseaux.',
    heroCTA: 'Demander une offre sur mesure',
    heroSecondary: 'Voir l\'offre individuelle',
    badge1: 'Cloud souverain 🇫🇷',
    badge2: 'Données chiffrées',
    badge3: 'RGPD',

    featuresEyebrow: 'Comment ça marche',
    featuresTitle: 'Simple pour vos agents.\nPuissant pour vos directeurs.',
    f1Title: 'Modulaire par design',
    f1Desc: 'Activez uniquement les fonctionnalités dont votre réseau a besoin. Une offre adaptée à chaque structure, sans surcharge.',
    f2Title: 'Tableau de bord administrateur',
    f2Desc: 'Vos administrateurs accèdent à une vision complète du réseau. Statistiques, performance par agence, extractions Excel sécurisées.',
    f3Title: 'Confidentialité par défaut',
    f3Desc: 'Chaque agent ne voit que ses propres prospects. Aucune fuite entre collaborateurs, sauf réaffectation explicite par l\'administrateur.',
    f4Title: 'Marque blanche',
    f4Desc: 'Votre logo, vos couleurs, votre identité. KOLO devient votre outil interne, propre à votre réseau.',

    securityEyebrow: 'Sécurité',
    securityTitle: 'Vos données restent en France.',
    securitySub: 'Nous avons choisi un cloud souverain européen, conforme aux standards les plus exigeants de l\'immobilier d\'affaires.',
    s1: 'Hébergement en France, datacenters certifiés ISO 27001',
    s2: 'Chiffrement de bout en bout (TLS 1.3, AES-256 au repos)',
    s3: 'Conformité RGPD intégrale — DPO disponible sur demande',
    s4: 'Sauvegardes quotidiennes, restauration en moins de 4 h',
    s5: 'Audits de sécurité réguliers et logs d\'accès complets',

    ctaTitle: 'Discutons de votre réseau.',
    ctaSub: 'Remplissez ce formulaire et nous reviendrons vers vous sous 48 h avec une proposition adaptée à votre structure.',
    formFirstName: 'Prénom',
    formLastName: 'Nom',
    formEmail: 'Email professionnel',
    formPhone: 'Téléphone',
    formCompany: 'Nom du réseau / agence',
    formSize: 'Nombre d\'agents',
    formSizePh: 'Sélectionner',
    formMessage: 'Message (optionnel)',
    formMessagePh: 'Parlez-nous de vos besoins, de vos contraintes, de vos délais…',
    formSubmit: 'Envoyer la demande',
    formSubmitting: 'Envoi en cours…',
    formSuccess: 'Merci. Votre demande a bien été reçue, notre équipe revient vers vous sous 48 h.',
    formError: 'Une erreur est survenue. Réessayez ou écrivez-nous à contact@trykolo.io',
    sizes: ['1 – 10 agents', '11 – 50 agents', '51 – 100 agents', '101 – 500 agents', '500+ agents'],
    legal: 'En envoyant ce formulaire, vous acceptez d\'être contacté par notre équipe commerciale. Vos données ne sont jamais cédées à des tiers.',
  },
  en: {
    navBack: 'Back',
    navContact: 'Contact us',
    eyebrow: 'KOLO for networks',
    heroTitle1: 'The daily assistant',
    heroTitle2: 'for your real estate network.',
    heroSub: 'KOLO adapts to your organization. A tailored, modular and secure offer — designed for large networks.',
    heroCTA: 'Request a custom offer',
    heroSecondary: 'View individual plans',
    badge1: 'Sovereign cloud 🇫🇷',
    badge2: 'Encrypted data',
    badge3: 'GDPR',

    featuresEyebrow: 'How it works',
    featuresTitle: 'Simple for your agents.\nPowerful for your directors.',
    f1Title: 'Modular by design',
    f1Desc: 'Enable only the features your network needs. A tailored offer for every structure, no clutter.',
    f2Title: 'Administrator dashboard',
    f2Desc: 'Your administrators get a full view of the network. Stats per agency, performance, secure Excel exports.',
    f3Title: 'Privacy by default',
    f3Desc: 'Each agent only sees their own prospects. No leaks between colleagues, unless the administrator explicitly reassigns.',
    f4Title: 'White label',
    f4Desc: 'Your logo, your colors, your identity. KOLO becomes your internal tool, unique to your network.',

    securityEyebrow: 'Security',
    securityTitle: 'Your data stays in France.',
    securitySub: 'We chose a sovereign European cloud, compliant with the highest standards of professional real estate.',
    s1: 'Hosted in France, ISO 27001 certified datacenters',
    s2: 'End-to-end encryption (TLS 1.3, AES-256 at rest)',
    s3: 'Full GDPR compliance — DPO available on request',
    s4: 'Daily backups, restore in under 4 hours',
    s5: 'Regular security audits and complete access logs',

    ctaTitle: 'Let\'s talk about your network.',
    ctaSub: 'Fill out this form and we\'ll come back to you within 48 h with a proposal tailored to your structure.',
    formFirstName: 'First name',
    formLastName: 'Last name',
    formEmail: 'Work email',
    formPhone: 'Phone',
    formCompany: 'Network / agency name',
    formSize: 'Number of agents',
    formSizePh: 'Select',
    formMessage: 'Message (optional)',
    formMessagePh: 'Tell us about your needs, constraints, timeline…',
    formSubmit: 'Send request',
    formSubmitting: 'Sending…',
    formSuccess: 'Thank you. Your request has been received, our team will come back to you within 48 h.',
    formError: 'Something went wrong. Try again or email us at contact@trykolo.io',
    sizes: ['1 – 10 agents', '11 – 50 agents', '51 – 100 agents', '101 – 500 agents', '500+ agents'],
    legal: 'By submitting this form, you agree to be contacted by our sales team. Your data is never shared with third parties.',
  },
};

const BusinessPage = () => {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const t = TEXT[locale] || TEXT.en;

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    size: '',
    message: '',
  });
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch(`${API_URL}/api/enterprise/demo-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, locale }),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('success');
      setForm({ first_name: '', last_name: '', email: '', phone: '', company: '', size: '', message: '' });
    } catch (_) {
      setStatus('error');
    }
  };

  return (
    <div className="biz-page">
      {/* NAV */}
      <nav className="biz-nav">
        <button onClick={() => navigate('/')} className="biz-nav-back" data-testid="biz-nav-back">
          <ArrowLeft size={16} strokeWidth={2} />
          <span>{t.navBack}</span>
        </button>
        <a href="/" className="biz-nav-logo">KOLO<span className="biz-logo-dot"></span></a>
        <a href="#contact" className="biz-nav-cta" data-testid="biz-nav-contact">
          {t.navContact}
        </a>
      </nav>

      {/* HERO */}
      <section className="biz-hero">
        <div className="biz-container">
          <div className="biz-eyebrow">{t.eyebrow}</div>
          <h1 className="biz-hero-title">
            {t.heroTitle1}<br/>
            <span className="biz-grad">{t.heroTitle2}</span>
          </h1>
          <p className="biz-hero-sub">{t.heroSub}</p>
          <div className="biz-hero-actions">
            <a href="#contact" className="biz-btn-primary" data-testid="biz-hero-cta">
              {t.heroCTA} <ArrowRight size={18} />
            </a>
            <button onClick={() => navigate('/pricing')} className="biz-btn-ghost" data-testid="biz-hero-pricing">
              {t.heroSecondary}
            </button>
          </div>
          <div className="biz-trust-badges">
            <span><MapPin size={14} strokeWidth={2} /> {t.badge1}</span>
            <span><Lock size={14} strokeWidth={2} /> {t.badge2}</span>
            <span><Shield size={14} strokeWidth={2} /> {t.badge3}</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="biz-features">
        <div className="biz-container">
          <div className="biz-section-eyebrow">{t.featuresEyebrow}</div>
          <h2 className="biz-section-title">
            {t.featuresTitle.split('\n').map((line, i) => (
              <React.Fragment key={i}>{line}{i === 0 && <br />}</React.Fragment>
            ))}
          </h2>

          <div className="biz-features-grid">
            <div className="biz-feature">
              <div className="biz-feature-icon"><Layers size={22} strokeWidth={1.8} /></div>
              <h3>{t.f1Title}</h3>
              <p>{t.f1Desc}</p>
            </div>
            <div className="biz-feature">
              <div className="biz-feature-icon"><Database size={22} strokeWidth={1.8} /></div>
              <h3>{t.f2Title}</h3>
              <p>{t.f2Desc}</p>
            </div>
            <div className="biz-feature">
              <div className="biz-feature-icon"><Users size={22} strokeWidth={1.8} /></div>
              <h3>{t.f3Title}</h3>
              <p>{t.f3Desc}</p>
            </div>
            <div className="biz-feature">
              <div className="biz-feature-icon"><Shield size={22} strokeWidth={1.8} /></div>
              <h3>{t.f4Title}</h3>
              <p>{t.f4Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="biz-security">
        <div className="biz-container">
          <div className="biz-security-grid">
            <div className="biz-security-text">
              <div className="biz-section-eyebrow">{t.securityEyebrow}</div>
              <h2 className="biz-section-title">{t.securityTitle}</h2>
              <p className="biz-security-sub">{t.securitySub}</p>
            </div>
            <ul className="biz-security-list">
              {[t.s1, t.s2, t.s3, t.s4, t.s5].map((item, i) => (
                <li key={i}><Check size={18} strokeWidth={2.4} /><span>{item}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section className="biz-contact" id="contact">
        <div className="biz-container">
          <h2 className="biz-section-title">{t.ctaTitle}</h2>
          <p className="biz-section-sub">{t.ctaSub}</p>

          {status === 'success' ? (
            <div className="biz-form-success" data-testid="biz-form-success">
              <Check size={32} strokeWidth={2} />
              <p>{t.formSuccess}</p>
            </div>
          ) : (
            <form className="biz-form" onSubmit={onSubmit}>
              <div className="biz-form-row">
                <label>
                  <span>{t.formFirstName} *</span>
                  <input name="first_name" value={form.first_name} onChange={onChange} required data-testid="biz-form-firstname" />
                </label>
                <label>
                  <span>{t.formLastName} *</span>
                  <input name="last_name" value={form.last_name} onChange={onChange} required data-testid="biz-form-lastname" />
                </label>
              </div>
              <div className="biz-form-row">
                <label>
                  <span>{t.formEmail} *</span>
                  <input type="email" name="email" value={form.email} onChange={onChange} required data-testid="biz-form-email" />
                </label>
                <label>
                  <span>{t.formPhone} *</span>
                  <input type="tel" name="phone" value={form.phone} onChange={onChange} required data-testid="biz-form-phone" />
                </label>
              </div>
              <div className="biz-form-row">
                <label>
                  <span>{t.formCompany} *</span>
                  <input name="company" value={form.company} onChange={onChange} required data-testid="biz-form-company" />
                </label>
                <label>
                  <span>{t.formSize} *</span>
                  <select name="size" value={form.size} onChange={onChange} required data-testid="biz-form-size">
                    <option value="">{t.formSizePh}</option>
                    {t.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label className="biz-form-full">
                <span>{t.formMessage}</span>
                <textarea name="message" rows={4} value={form.message} onChange={onChange} placeholder={t.formMessagePh} data-testid="biz-form-message" />
              </label>

              <p className="biz-form-legal">{t.legal}</p>
              {status === 'error' && <p className="biz-form-error">{t.formError}</p>}

              <button type="submit" className="biz-btn-primary biz-btn-submit" disabled={status === 'submitting'} data-testid="biz-form-submit">
                {status === 'submitting' ? t.formSubmitting : t.formSubmit}
                {status !== 'submitting' && <ArrowRight size={18} />}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="biz-footer">
        <div className="biz-container">
          <span>© 2026 KOLO.IO LTD</span>
          <a href="mailto:contact@trykolo.io">contact@trykolo.io</a>
        </div>
      </footer>
    </div>
  );
};

export default BusinessPage;
