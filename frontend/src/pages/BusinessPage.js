import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { API_URL } from '../config/api';
import { useLocale } from '../context/LocaleContext';
import '../styles/business.css';

const TEXT = {
  fr: {
    navBack: 'Retour',
    navContact: 'Nous contacter',
    eyebrow: 'KOLO pour les réseaux',
    heroTitle: 'KOLO pour votre réseau immobilier.',
    heroSub: 'Un assistant quotidien, modulaire et sécurisé. Pensé pour les grands réseaux.',
    heroCTA: 'Demander une offre',

    sec1Title: 'Modulaire.\nÀ votre image.',
    sec1Body: 'Activez uniquement ce dont vos agents ont besoin. KOLO devient votre outil interne, à votre nom, à vos couleurs.',

    sec2Title: 'Une vision réseau,\nsans compromis sur la confidentialité.',
    sec2Body: 'Vos administrateurs voient l\'ensemble. Vos agents ne voient que leurs prospects. Les extractions sont sécurisées et tracées.',

    sec3Title: 'Vos données restent\nen France.',
    sec3Body: 'Cloud souverain européen. Chiffrement de bout en bout. Conformité RGPD intégrale.',

    ctaTitle: 'Parlons de votre réseau.',
    ctaSub: 'On revient vers vous sous 48 h avec une proposition adaptée.',
    formFirstName: 'Prénom',
    formLastName: 'Nom',
    formEmail: 'Email professionnel',
    formPhone: 'Téléphone',
    formCompany: 'Nom du réseau',
    formSize: 'Nombre d\'agents',
    formSizePh: 'Sélectionner',
    formMessage: 'Message (optionnel)',
    formMessagePh: 'Parlez-nous de vos besoins…',
    formSubmit: 'Envoyer',
    formSubmitting: 'Envoi…',
    formSuccess: 'Merci. Votre demande a bien été reçue, notre équipe revient vers vous sous 48 h.',
    formError: 'Une erreur est survenue. Réessayez ou écrivez-nous à contact@trykolo.io',
    sizes: ['1 – 10', '11 – 50', '51 – 100', '101 – 500', '500+'],
    legal: 'Vos données ne sont jamais cédées à des tiers.',
  },
  en: {
    navBack: 'Back',
    navContact: 'Contact us',
    eyebrow: 'KOLO for networks',
    heroTitle: 'KOLO for your real estate network.',
    heroSub: 'A daily assistant, modular and secure. Designed for large networks.',
    heroCTA: 'Request an offer',

    sec1Title: 'Modular.\nIn your image.',
    sec1Body: 'Enable only what your agents need. KOLO becomes your internal tool — your name, your colors.',

    sec2Title: 'A network-wide view,\nwithout compromising privacy.',
    sec2Body: 'Your administrators see the whole picture. Your agents only see their own prospects. Exports are secure and audited.',

    sec3Title: 'Your data stays\nin France.',
    sec3Body: 'Sovereign European cloud. End-to-end encryption. Full GDPR compliance.',

    ctaTitle: 'Let\'s talk about your network.',
    ctaSub: 'We\'ll come back to you within 48 hours with a tailored proposal.',
    formFirstName: 'First name',
    formLastName: 'Last name',
    formEmail: 'Work email',
    formPhone: 'Phone',
    formCompany: 'Network name',
    formSize: 'Number of agents',
    formSizePh: 'Select',
    formMessage: 'Message (optional)',
    formMessagePh: 'Tell us about your needs…',
    formSubmit: 'Send',
    formSubmitting: 'Sending…',
    formSuccess: 'Thank you. Your request has been received, our team will come back to you within 48 hours.',
    formError: 'Something went wrong. Try again or email us at contact@trykolo.io',
    sizes: ['1 – 10', '11 – 50', '51 – 100', '101 – 500', '500+'],
    legal: 'Your data is never shared with third parties.',
  },
};

const BusinessPage = () => {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const t = TEXT[locale] || TEXT.en;

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', company: '', size: '', message: '',
  });
  const [status, setStatus] = useState('idle');

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

  const renderTitle = (str) => str.split('\n').map((line, i) => (
    <React.Fragment key={i}>{line}{i < str.split('\n').length - 1 && <br />}</React.Fragment>
  ));

  return (
    <div className="biz-page">
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

      {/* HERO — radically simplified */}
      <section className="biz-hero">
        <div className="biz-container">
          <div className="biz-eyebrow">{t.eyebrow}</div>
          <h1 className="biz-hero-title">{t.heroTitle}</h1>
          <p className="biz-hero-sub">{t.heroSub}</p>
          <a href="#contact" className="biz-btn-primary" data-testid="biz-hero-cta">
            {t.heroCTA} <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* SECTION 1 — Modular */}
      <section className="biz-section">
        <div className="biz-container biz-section-inner">
          <h2 className="biz-big-title">{renderTitle(t.sec1Title)}</h2>
          <p className="biz-big-body">{t.sec1Body}</p>
        </div>
      </section>

      {/* SECTION 2 — Network view + privacy */}
      <section className="biz-section biz-section-dark">
        <div className="biz-container biz-section-inner">
          <h2 className="biz-big-title">{renderTitle(t.sec2Title)}</h2>
          <p className="biz-big-body">{t.sec2Body}</p>
        </div>
      </section>

      {/* SECTION 3 — Security */}
      <section className="biz-section">
        <div className="biz-container biz-section-inner">
          <h2 className="biz-big-title">{renderTitle(t.sec3Title)}</h2>
          <p className="biz-big-body">{t.sec3Body}</p>
        </div>
      </section>

      {/* CONTACT */}
      <section className="biz-contact" id="contact">
        <div className="biz-container">
          <h2 className="biz-big-title">{t.ctaTitle}</h2>
          <p className="biz-big-body biz-contact-sub">{t.ctaSub}</p>

          {status === 'success' ? (
            <div className="biz-form-success" data-testid="biz-form-success">
              <Check size={28} strokeWidth={2} />
              <p>{t.formSuccess}</p>
            </div>
          ) : (
            <form className="biz-form" onSubmit={onSubmit}>
              <div className="biz-form-row">
                <label><span>{t.formFirstName}</span>
                  <input name="first_name" value={form.first_name} onChange={onChange} required data-testid="biz-form-firstname" /></label>
                <label><span>{t.formLastName}</span>
                  <input name="last_name" value={form.last_name} onChange={onChange} required data-testid="biz-form-lastname" /></label>
              </div>
              <div className="biz-form-row">
                <label><span>{t.formEmail}</span>
                  <input type="email" name="email" value={form.email} onChange={onChange} required data-testid="biz-form-email" /></label>
                <label><span>{t.formPhone}</span>
                  <input type="tel" name="phone" value={form.phone} onChange={onChange} required data-testid="biz-form-phone" /></label>
              </div>
              <div className="biz-form-row">
                <label><span>{t.formCompany}</span>
                  <input name="company" value={form.company} onChange={onChange} required data-testid="biz-form-company" /></label>
                <label><span>{t.formSize}</span>
                  <select name="size" value={form.size} onChange={onChange} required data-testid="biz-form-size">
                    <option value="">{t.formSizePh}</option>
                    {t.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></label>
              </div>
              <label className="biz-form-full"><span>{t.formMessage}</span>
                <textarea name="message" rows={3} value={form.message} onChange={onChange} placeholder={t.formMessagePh} data-testid="biz-form-message" /></label>

              {status === 'error' && <p className="biz-form-error">{t.formError}</p>}

              <button type="submit" className="biz-btn-primary biz-btn-submit" disabled={status === 'submitting'} data-testid="biz-form-submit">
                {status === 'submitting' ? t.formSubmitting : t.formSubmit}
                {status !== 'submitting' && <ArrowRight size={18} />}
              </button>
              <p className="biz-form-legal">{t.legal}</p>
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
