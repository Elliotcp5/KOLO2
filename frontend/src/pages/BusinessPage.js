import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, ChevronDown } from 'lucide-react';
import { API_URL } from '../config/api';
import { useLocale } from '../context/LocaleContext';
import PremiumBackdrop from '../components/PremiumBackdrop';
import '../styles/landing.css';
import '../styles/premium-backdrop.css';
import '../styles/business.css';

const TEXT = {
  fr: {
    navBack: 'Retour',
    navContact: 'Nous contacter',
    eyebrow: 'KOLO pour les entreprises',
    heroTitleStart: "L'assistant IA quotidien",
    heroTitleGrad: 'pour votre réseau immobilier.',
    heroSub: "Plus de ventes pour vos agents. La solution la plus simple et la plus compétitive du marché.",
    heroCTA: 'Demander une offre',

    sec1TitleStart: 'Plus de ventes.',
    sec1TitleGrad: 'Mécaniquement.',
    sec1Body: "Chaque agent suit le bon prospect, au bon moment, avec le bon message. Un agent qui n'oublie plus une relance signe en moyenne 2 à 3 ventes de plus par mois. Multipliez par tous vos agents.",

    sec2TitleStart: "L'entreprise qu'ils",
    sec2TitleGrad: 'veulent rejoindre.',
    sec2Body: "Offrez à vos agents un outil moderne, mobile, qui leur simplifie vraiment la vie. Un argument différenciant pour attirer les meilleurs profils et fidéliser ceux qui font tourner votre entreprise.",

    sec3TitleStart: 'L\'offre la plus compétitive',
    sec3TitleGrad: 'et la plus rapide à déployer.',
    sec3Body: "Tarif unique négocié pour votre entreprise, sans engagement long, sans coût caché. Déploiement en quelques jours, formation des agents en 15 minutes. Vous activez quand vous voulez.",

    sec4TitleStart: 'Sécurisé,',
    sec4TitleGrad: 'souverain, RGPD.',
    sec4Body: "Cloud souverain européen, chiffrement de bout en bout, conformité RGPD intégrale. Vos données restent en France. DPO disponible.",

    ctaTitleStart: 'Parlons de',
    ctaTitleGrad: 'votre entreprise.',
    ctaSub: 'On revient vers vous sous 48 h avec une proposition adaptée.',
    formFirstName: 'Prénom',
    formLastName: 'Nom',
    formEmail: 'Email professionnel',
    formPhone: 'Téléphone',
    formCompany: 'Nom de l\'entreprise',
    formSize: 'Nombre d\'agents',
    formSizePh: 'Sélectionner',
    formSector: 'Secteur d\'activité',
    formSectorPh: 'Sélectionner',
    formMessage: 'Message (optionnel)',
    formMessagePh: 'Parlez-nous de vos besoins…',
    formSubmit: 'Envoyer',
    formSubmitting: 'Envoi…',
    formSuccess: 'Merci. Votre demande a bien été reçue, notre équipe revient vers vous sous 48 h.',
    formError: 'Une erreur est survenue. Réessayez ou écrivez-nous à contact@trykolo.io',
    sizes: ['0 à 50 agents', '50 à 100 agents', '100 à 500 agents', '500 à 5 000 agents', '5 000 à 10 000 agents', '10 000+ agents'],
    sectors: [
      { key: 'network', label: 'Réseau Immobilier' },
      { key: 'agency', label: 'Agence Immobilière' },
      { key: 'group', label: 'Groupement d\'agences immobilières' },
      { key: 'property_fund', label: 'Foncière' },
      { key: 'developer', label: 'Promoteur Immobilier' },
      { key: 'land_developer', label: 'Développeur Foncier' },
      { key: 'other', label: 'Autre' },
    ],
    legal: 'Vos données ne sont jamais cédées à des tiers.',
  },
  en: {
    navBack: 'Back',
    navContact: 'Contact us',
    eyebrow: 'KOLO for businesses',
    heroTitleStart: 'The daily AI assistant',
    heroTitleGrad: 'for your real estate business.',
    heroSub: "More sales for your agents. The simplest and most competitive solution on the market.",
    heroCTA: 'Request an offer',

    sec1TitleStart: 'More sales.',
    sec1TitleGrad: 'Mechanically.',
    sec1Body: "Each agent follows the right prospect, at the right moment, with the right message. An agent who never forgets a follow-up closes on average 2-3 more deals per month. Multiply that by all your agents.",

    sec2TitleStart: 'The business they',
    sec2TitleGrad: 'want to join.',
    sec2Body: "Give your agents a modern, mobile tool that actually makes their life easier. A real differentiator to attract top talent and retain those who drive your business.",

    sec3TitleStart: 'The most competitive offer',
    sec3TitleGrad: 'and the fastest to deploy.',
    sec3Body: "Single negotiated rate for your business, no long-term commitment, no hidden costs. Deployed in a few days, agents trained in 15 minutes. Activate whenever you want.",

    sec4TitleStart: 'Secure,',
    sec4TitleGrad: 'sovereign, GDPR.',
    sec4Body: "Sovereign European cloud, end-to-end encryption, full GDPR compliance. Your data stays in France. DPO available.",

    ctaTitleStart: 'Let\'s talk about',
    ctaTitleGrad: 'your business.',
    ctaSub: 'We\'ll come back to you within 48 hours with a tailored proposal.',
    formFirstName: 'First name',
    formLastName: 'Last name',
    formEmail: 'Work email',
    formPhone: 'Phone',
    formCompany: 'Company name',
    formSize: 'Number of agents',
    formSizePh: 'Select',
    formSector: 'Business sector',
    formSectorPh: 'Select',
    formMessage: 'Message (optional)',
    formMessagePh: 'Tell us about your needs…',
    formSubmit: 'Send',
    formSubmitting: 'Sending…',
    formSuccess: 'Thank you. Your request has been received, our team will come back to you within 48 hours.',
    formError: 'Something went wrong. Try again or email us at contact@trykolo.io',
    sizes: ['0 to 50 agents', '50 to 100 agents', '100 to 500 agents', '500 to 5,000 agents', '5,000 to 10,000 agents', '10,000+ agents'],
    sectors: [
      { key: 'network', label: 'Real estate network' },
      { key: 'agency', label: 'Real estate agency' },
      { key: 'group', label: 'Group of real estate agencies' },
      { key: 'property_fund', label: 'Property fund' },
      { key: 'developer', label: 'Real estate developer' },
      { key: 'land_developer', label: 'Land developer' },
      { key: 'other', label: 'Other' },
    ],
    legal: 'Your data is never shared with third parties.',
  },
  it: {
    navBack: 'Indietro',
    navContact: 'Contattaci',
    eyebrow: 'KOLO per le aziende',
    heroTitleStart: "L'assistente IA quotidiano",
    heroTitleGrad: 'per la tua azienda immobiliare.',
    heroSub: "Più vendite per i tuoi agenti. La soluzione più semplice e competitiva sul mercato.",
    heroCTA: 'Richiedi un\'offerta',

    sec1TitleStart: 'Più vendite.',
    sec1TitleGrad: 'Meccanicamente.',
    sec1Body: "Ogni agente segue il prospect giusto, nel momento giusto, con il messaggio giusto. Un agente che non dimentica mai un follow-up chiude in media 2-3 affari in più al mese. Moltiplicalo per tutti i tuoi agenti.",

    sec2TitleStart: "L'azienda che",
    sec2TitleGrad: 'vogliono in.',
    sec2Body: "Offri ai tuoi agenti uno strumento moderno e mobile che semplifica davvero la loro vita. Un vero elemento di differenziazione per attrarre i migliori talenti e fidelizzare chi fa girare la tua azienda.",

    sec3TitleStart: "L'offerta più competitiva",
    sec3TitleGrad: 'e la più rapida da implementare.',
    sec3Body: "Tariffa unica negoziata per la tua azienda, senza vincoli a lungo termine, senza costi nascosti. Operativo in pochi giorni, agenti formati in 15 minuti. Attivi quando vuoi.",

    sec4TitleStart: 'Sicuro,',
    sec4TitleGrad: 'sovrano, GDPR.',
    sec4Body: "Cloud europeo sovrano, crittografia end-to-end, piena conformità GDPR. I tuoi dati restano in Francia. DPO disponibile.",

    ctaTitleStart: 'Parliamo del',
    ctaTitleGrad: 'tuo business.',
    ctaSub: 'Torneremo da te entro 48 ore con una proposta su misura.',
    formFirstName: 'Nome',
    formLastName: 'Cognome',
    formEmail: 'Email professionale',
    formPhone: 'Telefono',
    formCompany: "Nome dell'azienda",
    formSize: 'Numero di agenti',
    formSizePh: 'Seleziona',
    formSector: 'Settore di attività',
    formSectorPh: 'Seleziona',
    formMessage: 'Messaggio (opzionale)',
    formMessagePh: 'Raccontaci le tue esigenze…',
    formSubmit: 'Invia',
    formSubmitting: 'Invio…',
    formSuccess: 'Grazie. La tua richiesta è stata ricevuta, il nostro team ti contatterà entro 48 ore.',
    formError: 'Si è verificato un errore. Riprova o scrivici a contact@trykolo.io',
    sizes: ['0-50 agenti', '50-100 agenti', '100-500 agenti', '500-5.000 agenti', '5.000-10.000 agenti', '10.000+ agenti'],
    sectors: [
      { key: 'network', label: 'Rete immobiliare' },
      { key: 'agency', label: 'Agenzia immobiliare' },
      { key: 'group', label: 'Gruppo di agenzie immobiliari' },
      { key: 'property_fund', label: 'Fondo immobiliare' },
      { key: 'developer', label: 'Sviluppatore immobiliare' },
      { key: 'land_developer', label: 'Sviluppatore fondiario' },
      { key: 'other', label: 'Altro' },
    ],
    legal: 'I tuoi dati non vengono mai condivisi con terzi.',
  },
  de: {
    navBack: 'Zurück',
    navContact: 'Kontakt aufnehmen',
    eyebrow: 'KOLO für Unternehmen',
    heroTitleStart: 'Der tägliche KI-Assistent',
    heroTitleGrad: 'für Ihr Immobilienunternehmen.',
    heroSub: "Mehr Verkäufe für Ihre Makler. Die einfachste und wettbewerbsfähigste Lösung am Markt.",
    heroCTA: 'Angebot anfordern',

    sec1TitleStart: 'Mehr Verkäufe.',
    sec1TitleGrad: 'Mechanisch.',
    sec1Body: "Jeder Makler verfolgt den richtigen Interessenten, im richtigen Moment, mit der richtigen Nachricht. Ein Makler, der nie ein Follow-up vergisst, schließt durchschnittlich 2-3 Deals mehr pro Monat ab. Multipliziert mit allen Ihren Maklern.",

    sec2TitleStart: 'Das Unternehmen, in das',
    sec2TitleGrad: 'sie wollen.',
    sec2Body: "Bieten Sie Ihren Maklern ein modernes, mobiles Tool, das ihr Leben wirklich vereinfacht. Ein echtes Differenzierungsmerkmal, um die besten Talente anzuziehen und diejenigen zu binden, die Ihr Unternehmen am Laufen halten.",

    sec3TitleStart: 'Das wettbewerbsfähigste Angebot',
    sec3TitleGrad: 'und das am schnellsten einsetzbare.',
    sec3Body: "Einheitlicher verhandelter Tarif für Ihr Unternehmen, keine langfristige Verpflichtung, keine versteckten Kosten. Einsatzbereit in wenigen Tagen, Makler in 15 Minuten geschult. Sie aktivieren, wann Sie wollen.",

    sec4TitleStart: 'Sicher,',
    sec4TitleGrad: 'souverän, DSGVO.',
    sec4Body: "Souveräne europäische Cloud, Ende-zu-Ende-Verschlüsselung, vollständige DSGVO-Konformität. Ihre Daten bleiben in Frankreich. DSB verfügbar.",

    ctaTitleStart: 'Sprechen wir über',
    ctaTitleGrad: 'Ihr Unternehmen.',
    ctaSub: 'Wir melden uns innerhalb von 48 Stunden mit einem maßgeschneiderten Angebot.',
    formFirstName: 'Vorname',
    formLastName: 'Nachname',
    formEmail: 'Geschäftliche E-Mail',
    formPhone: 'Telefon',
    formCompany: 'Firmenname',
    formSize: 'Anzahl der Makler',
    formSizePh: 'Auswählen',
    formSector: 'Tätigkeitsbereich',
    formSectorPh: 'Auswählen',
    formMessage: 'Nachricht (optional)',
    formMessagePh: 'Erzählen Sie uns von Ihren Bedürfnissen…',
    formSubmit: 'Senden',
    formSubmitting: 'Senden…',
    formSuccess: 'Danke. Ihre Anfrage ist eingegangen, unser Team meldet sich innerhalb von 48 Stunden bei Ihnen.',
    formError: 'Etwas ist schiefgelaufen. Versuchen Sie es erneut oder schreiben Sie an contact@trykolo.io',
    sizes: ['0-50 Makler', '50-100 Makler', '100-500 Makler', '500-5.000 Makler', '5.000-10.000 Makler', '10.000+ Makler'],
    sectors: [
      { key: 'network', label: 'Immobiliennetzwerk' },
      { key: 'agency', label: 'Immobilienagentur' },
      { key: 'group', label: 'Gruppe von Immobilienagenturen' },
      { key: 'property_fund', label: 'Immobilienfonds' },
      { key: 'developer', label: 'Immobilienentwickler' },
      { key: 'land_developer', label: 'Bodenentwickler' },
      { key: 'other', label: 'Sonstige' },
    ],
    legal: 'Ihre Daten werden niemals an Dritte weitergegeben.',
  },
};

const BusinessPage = () => {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const t = TEXT[locale] || TEXT.en;

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', company: '', size: '', business_sector: '', message: '',
  });
  const [status, setStatus] = useState('idle');

  // Custom dropdown state (replaces broken native <select>)
  const [sizeOpen, setSizeOpen] = useState(false);
  const sizeRef = useRef(null);
  const [sectorOpen, setSectorOpen] = useState(false);
  const sectorRef = useRef(null);

  useEffect(() => {
    if (!sizeOpen && !sectorOpen) return;
    const onDocClick = (e) => {
      if (sizeRef.current && !sizeRef.current.contains(e.target)) setSizeOpen(false);
      if (sectorRef.current && !sectorRef.current.contains(e.target)) setSectorOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setSizeOpen(false); setSectorOpen(false); } };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [sizeOpen, sectorOpen]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.size) {
      setStatus('error');
      setSizeOpen(true);
      return;
    }
    setStatus('submitting');
    try {
      const res = await fetch(`${API_URL}/api/enterprise/demo-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, locale }),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('success');
      setForm({ first_name: '', last_name: '', email: '', phone: '', company: '', size: '', business_sector: '', message: '' });
    } catch (_) {
      setStatus('error');
    }
  };

  // Reusable two-line title: dark first line + gradient second line (signature KOLO style)
  const TwoLineTitle = ({ start, grad }) => (
    <h2 className="biz-big-title">
      {start}<br/><span className="biz-grad">{grad}</span>
    </h2>
  );

  return (
    <div className="biz-page landing-page">
      <PremiumBackdrop />
      <nav className="biz-nav">
        <button onClick={() => navigate('/')} className="biz-nav-back" data-testid="biz-nav-back">
          <ArrowLeft size={16} strokeWidth={2} />
          <span>{t.navBack}</span>
        </button>
        <a href="/" className="biz-nav-logo"><span className="biz-logo-dot"></span>KOLO</a>
        <a href="#contact" className="biz-nav-cta" data-testid="biz-nav-contact">
          {t.navContact}
        </a>
      </nav>

      {/* HERO */}
      <section className="biz-hero">
        <div className="biz-container">
          <div className="biz-eyebrow">{t.eyebrow}</div>
          <h1 className="biz-hero-title">
            {t.heroTitleStart}<br/><span className="biz-grad">{t.heroTitleGrad}</span>
          </h1>
          <p className="biz-hero-sub">{t.heroSub}</p>
          <a href="#contact" className="biz-btn-primary" data-testid="biz-hero-cta">
            {t.heroCTA} <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* SECTION 1 — Modular */}
      <section className="biz-section">
        <div className="biz-container biz-section-inner">
          <TwoLineTitle start={t.sec1TitleStart} grad={t.sec1TitleGrad} />
          <p className="biz-big-body">{t.sec1Body}</p>
        </div>
      </section>

      {/* SECTION 2 — Network view + privacy (dark, gradient highlight is bright) */}
      <section className="biz-section biz-section-dark">
        <div className="biz-container biz-section-inner">
          <TwoLineTitle start={t.sec2TitleStart} grad={t.sec2TitleGrad} />
          <p className="biz-big-body">{t.sec2Body}</p>
        </div>
      </section>

      {/* SECTION 3 — Competitive pricing + easy onboarding */}
      <section className="biz-section">
        <div className="biz-container biz-section-inner">
          <TwoLineTitle start={t.sec3TitleStart} grad={t.sec3TitleGrad} />
          <p className="biz-big-body">{t.sec3Body}</p>
        </div>
      </section>

      {/* SECTION 4 — Security (condensed) */}
      <section className="biz-section biz-section-dark">
        <div className="biz-container biz-section-inner">
          <TwoLineTitle start={t.sec4TitleStart} grad={t.sec4TitleGrad} />
          <p className="biz-big-body">{t.sec4Body}</p>
        </div>
      </section>

      {/* CONTACT */}
      <section className="biz-contact" id="contact">
        <div className="biz-container">
          <TwoLineTitle start={t.ctaTitleStart} grad={t.ctaTitleGrad} />
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
                <div className="biz-form-field" ref={sizeRef}>
                  <label htmlFor="biz-size-trigger">{t.formSize}</label>
                  <button
                    type="button"
                    id="biz-size-trigger"
                    className={`biz-select-trigger ${sizeOpen ? 'open' : ''} ${form.size ? 'has-value' : ''}`}
                    onClick={() => setSizeOpen(o => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={sizeOpen}
                    data-testid="biz-form-size"
                  >
                    <span>{form.size || t.formSizePh}</span>
                    <ChevronDown size={18} strokeWidth={2} />
                  </button>
                  {sizeOpen && (
                    <ul className="biz-select-menu" role="listbox" data-testid="biz-form-size-menu">
                      {t.sizes.map(s => (
                        <li
                          key={s}
                          role="option"
                          aria-selected={form.size === s}
                          className={form.size === s ? 'selected' : ''}
                          onClick={() => {
                            setForm({ ...form, size: s });
                            setSizeOpen(false);
                          }}
                          data-testid={`biz-form-size-opt-${s}`}
                        >
                          {s}
                          {form.size === s && <Check size={16} strokeWidth={2.4} />}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="biz-form-field biz-form-full" ref={sectorRef}>
                  <label htmlFor="biz-sector-trigger">{t.formSector}</label>
                  <button
                    type="button"
                    id="biz-sector-trigger"
                    className={`biz-select-trigger ${sectorOpen ? 'open' : ''} ${form.business_sector ? 'has-value' : ''}`}
                    onClick={() => setSectorOpen(o => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={sectorOpen}
                    data-testid="biz-form-sector"
                  >
                    <span>{(t.sectors.find(s => s.key === form.business_sector) || {}).label || t.formSectorPh}</span>
                    <ChevronDown size={18} strokeWidth={2} />
                  </button>
                  {sectorOpen && (
                    <ul className="biz-select-menu" role="listbox" data-testid="biz-form-sector-menu">
                      {t.sectors.map(s => (
                        <li
                          key={s.key}
                          role="option"
                          aria-selected={form.business_sector === s.key}
                          className={form.business_sector === s.key ? 'selected' : ''}
                          onClick={() => {
                            setForm({ ...form, business_sector: s.key });
                            setSectorOpen(false);
                          }}
                          data-testid={`biz-form-sector-opt-${s.key}`}
                        >
                          {s.label}
                          {form.business_sector === s.key && <Check size={16} strokeWidth={2.4} />}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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
