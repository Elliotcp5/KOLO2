import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useLocale } from '../context/LocaleContext';
import PremiumBackdrop from '../components/PremiumBackdrop';
import PhoneMockup from '../components/PhoneMockup';
import LanguageSwitcher from '../components/LanguageSwitcher';
import '../styles/landing.css';
import '../styles/premium-backdrop.css';
import '../styles/iphone-mockup.css';

// Maps our internal locale to Apple's storefront + badge language codes.
const APP_STORE_LOCALE_MAP = {
  fr: { storefront: 'fr', badge: 'fr-fr', alt: "Télécharger dans l'App Store" },
  en: { storefront: 'us', badge: 'en-us', alt: 'Download on the App Store' },
  de: { storefront: 'de', badge: 'de-de', alt: 'Laden im App Store' },
  it: { storefront: 'it', badge: 'it-it', alt: 'Scarica su App Store' },
};

const APP_STORE_APP_ID = '6761818371';

// Localized "or" caption shown above the badge.
const APP_STORE_CAPTION = {
  fr: 'Ou téléchargez l\'app iOS',
  en: 'Or download the iOS app',
  de: 'Oder lade die iOS-App herunter',
  it: 'O scarica l\'app per iOS',
};

const AppStoreBadge = ({ locale, variant = 'default' }) => {
  // Never show this badge inside the native iOS app — they're already there.
  if (Capacitor.isNativePlatform && Capacitor.isNativePlatform()) return null;

  const loc = APP_STORE_LOCALE_MAP[locale] || APP_STORE_LOCALE_MAP.en;
  const href = `https://apps.apple.com/${loc.storefront}/app/kolo-ai-real-estate/id${APP_STORE_APP_ID}`;
  const badgeSrc = `https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/${loc.badge}`;

  const wrapStyle = variant === 'centered'
    ? { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '24px' }
    : { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '20px' };

  return (
    <div style={wrapStyle} data-testid="app-store-badge-wrap">
      <span style={{
        fontSize: '13px',
        color: 'var(--ink-mid, #6b7280)',
        letterSpacing: '0.02em',
        opacity: 0.85,
      }}>
        {APP_STORE_CAPTION[locale] || APP_STORE_CAPTION.en}
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={loc.alt}
        data-testid="app-store-download-btn"
        style={{
          display: 'inline-block',
          transition: 'transform 0.18s ease, filter 0.18s ease',
          willChange: 'transform',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
          e.currentTarget.style.filter = 'drop-shadow(0 8px 18px rgba(0,0,0,0.18))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.filter = 'none';
        }}
      >
        <img
          src={badgeSrc}
          alt={loc.alt}
          height={variant === 'centered' ? 56 : 48}
          style={{
            height: variant === 'centered' ? '56px' : '48px',
            width: 'auto',
            display: 'block',
            borderRadius: '8px',
          }}
        />
      </a>
    </div>
  );
};

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'it', label: 'IT' },
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
  { code: 'pl', label: 'PL' },
];

const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'GBP', symbol: '£', label: 'GBP' },
];

// Pricing data for landing page
const LANDING_PRICING = {
  pro: {
    EUR: { monthly: '9,99€', symbol: '€' },
    USD: { monthly: '$10.99', symbol: '$' },
    GBP: { monthly: '£8.99', symbol: '£' },
  },
  pro_plus: {
    EUR: { monthly: '24,99€', symbol: '€' },
    USD: { monthly: '$27.99', symbol: '$' },
    GBP: { monthly: '£21.99', symbol: '£' },
  }
};

// Landing page specific translations
const LANDING_TEXTS = {
  fr: {
    upTo30Prospects: "Jusqu'à 30 prospects",
    oneAiSuggestionDay: "1 suggestion IA/jour",
    taskManagement: "Gestion des tâches",
    startFree: "Commencer gratuitement",
    popular: "Populaire",
    unlimitedProspects: "Prospects illimités",
    unlimitedAiSuggestions: "Suggestions IA illimitées",
    oneClickSms: "SMS 1-clic IA",
    interactionHistory: "Historique des interactions",
    contextualNotes: "Notes contextuelles",
    everythingInPro: "Tout ce qui est dans PRO",
    hotLeadsAuto: "Prospects chauds identifiés auto",
    commissionTracking: "Suivi de vos commissions",
    weeklyEmailReport: "Rapport hebdo par email",
    prioritySupport: "Support prioritaire",
    legalNotice: "Mentions légales",
    blogLink: "Blog"
  },
  en: {
    upTo30Prospects: "Up to 30 prospects",
    oneAiSuggestionDay: "1 AI suggestion/day",
    taskManagement: "Task management",
    startFree: "Start for free",
    popular: "Popular",
    unlimitedProspects: "Unlimited prospects",
    unlimitedAiSuggestions: "Unlimited AI suggestions",
    oneClickSms: "1-click AI SMS",
    interactionHistory: "Interaction history",
    contextualNotes: "Contextual notes",
    everythingInPro: "Everything in PRO",
    hotLeadsAuto: "Hot leads auto-identified",
    commissionTracking: "Commission tracking",
    weeklyEmailReport: "Weekly email report",
    prioritySupport: "Priority support",
    legalNotice: "Legal Notice",
    blogLink: "Blog"
  },
  de: {
    upTo30Prospects: "Bis zu 30 Interessenten",
    oneAiSuggestionDay: "1 KI-Vorschlag/Tag",
    taskManagement: "Aufgabenverwaltung",
    startFree: "Kostenlos starten",
    popular: "Beliebt",
    unlimitedProspects: "Unbegrenzte Interessenten",
    unlimitedAiSuggestions: "Unbegrenzte KI-Vorschläge",
    oneClickSms: "1-Klick-KI-SMS",
    interactionHistory: "Interaktionsverlauf",
    contextualNotes: "Kontextuelle Notizen",
    everythingInPro: "Alles in PRO",
    hotLeadsAuto: "Heiße Leads automatisch erkannt",
    commissionTracking: "Provisionsverfolgung",
    weeklyEmailReport: "Wöchentlicher E-Mail-Bericht",
    prioritySupport: "Prioritäts-Support",
    legalNotice: "Impressum",
    blogLink: "Blog"
  },
  it: {
    upTo30Prospects: "Fino a 30 prospect",
    oneAiSuggestionDay: "1 suggerimento IA/giorno",
    taskManagement: "Gestione attività",
    startFree: "Inizia gratis",
    popular: "Popolare",
    unlimitedProspects: "Prospect illimitati",
    unlimitedAiSuggestions: "Suggerimenti IA illimitati",
    oneClickSms: "SMS IA 1-clic",
    interactionHistory: "Cronologia interazioni",
    contextualNotes: "Note contestuali",
    everythingInPro: "Tutto in PRO",
    hotLeadsAuto: "Lead caldi identificati auto",
    commissionTracking: "Monitoraggio commissioni",
    weeklyEmailReport: "Report settimanale via email",
    prioritySupport: "Supporto prioritario",
    legalNotice: "Note legali",
    blogLink: "Blog"
  }
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { locale, changeLanguage, t, currency, symbol, changeCurrency } = useLocale();
  const lt = LANDING_TEXTS[locale] || LANDING_TEXTS.en;
  const [scrolled, setScrolled] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [email, setEmail] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Reveal animation on scroll
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    
    reveals.forEach(el => observer.observe(el));
    return () => reveals.forEach(el => observer.unobserve(el));
  }, []);

  const handleCTA = (e) => {
    e.preventDefault();
    if (email) {
      // Redirect to register with email pre-filled
      navigate('/register', { state: { email } });
    } else {
      navigate('/register');
    }
  };

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const currentLang = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

  // ====================================================================
  // FAQ B2B — orienté entreprises (foncières, promoteurs, réseaux)
  // Inline multilingue pour ne pas dépendre de translations.js
  // ====================================================================
  const B2B_FAQ = {
    fr: [
      {
        q: "KOLO remplace-t-il notre CRM existant (Salesforce, HubSpot, etc.) ?",
        a: "Non. KOLO est complémentaire à votre CRM. Il s'occupe spécifiquement de la couche que les CRM gèrent mal : le suivi commercial intelligent — relances automatisées, priorisation des prospects chauds, prise de notes IA. KOLO se connecte à votre CRM via API et enrichit la donnée sans la dupliquer."
      },
      {
        q: "Combien de temps pour déployer KOLO sur une équipe de 20 commerciaux ?",
        a: "Le pilote complet (onboarding équipe, paramétrage des canaux, formation manager) prend en moyenne 5 à 7 jours ouvrés. L'adoption complète atteint 80% en 3 semaines. Nous accompagnons chaque déploiement avec un Customer Success Manager dédié."
      },
      {
        q: "Quel ROI attendre la première année ?",
        a: "Sur la base de nos déploiements 2025, nos clients constatent : +15 à +25% de CA par commercial, +30 à +40% de taux de réponse sur les relances, et 6 à 9 heures gagnées par semaine et par commercial sur les tâches administratives."
      },
      {
        q: "Les données de nos commerciaux sont-elles sécurisées ?",
        a: "Oui. Toutes les données sont hébergées en Europe (Francfort, Paris) sur infrastructure conforme RGPD. Chiffrement AES-256 au repos, TLS 1.3 en transit, certifications SOC 2 Type II en cours. Vous gardez la pleine propriété de vos données et pouvez les exporter à tout moment."
      },
      {
        q: "Quelle est la tarification pour une entreprise ?",
        a: "La tarification est sur devis et dépend du nombre de commerciaux, du niveau d'intégration avec vos outils existants (CRM, Google Workspace, Outlook, WhatsApp Business) et des options Marque Blanche. Réservez une démo de 30 minutes — nous établirons une proposition adaptée à votre contexte sous 48h."
      }
    ],
    en: [
      {
        q: "Does KOLO replace our existing CRM (Salesforce, HubSpot, etc.)?",
        a: "No. KOLO is complementary to your CRM. It specifically handles the layer that CRMs handle poorly: intelligent sales follow-up — automated nudges, hot-lead prioritization, AI note-taking. KOLO connects to your CRM via API and enriches the data without duplicating it."
      },
      {
        q: "How long does it take to roll out KOLO to a 20-person sales team?",
        a: "The full pilot (team onboarding, channel setup, manager training) takes on average 5 to 7 business days. Full adoption hits 80% within 3 weeks. Every rollout is supported by a dedicated Customer Success Manager."
      },
      {
        q: "What ROI should we expect in the first year?",
        a: "Based on our 2025 deployments, our clients observe: +15 to +25% revenue per rep, +30 to +40% reply rate on follow-ups, and 6 to 9 hours saved per week per rep on administrative tasks."
      },
      {
        q: "Is our reps' data secure?",
        a: "Yes. All data is hosted in Europe (Frankfurt, Paris) on GDPR-compliant infrastructure. AES-256 encryption at rest, TLS 1.3 in transit, SOC 2 Type II certification in progress. You retain full ownership and can export your data anytime."
      },
      {
        q: "What is the pricing for an enterprise?",
        a: "Pricing is on a quote basis, depending on the number of reps, the level of integration with your existing tools (CRM, Google Workspace, Outlook, WhatsApp Business) and White-Label options. Book a 30-minute demo — we'll send a tailored proposal within 48 hours."
      }
    ],
    it: [
      {
        q: "KOLO sostituisce il nostro CRM esistente (Salesforce, HubSpot, ecc.)?",
        a: "No. KOLO è complementare al tuo CRM. Si occupa specificamente del livello che i CRM gestiscono male: il follow-up commerciale intelligente — solleciti automatici, prioritizzazione dei lead caldi, presa di note IA. KOLO si collega al tuo CRM via API e arricchisce i dati senza duplicarli."
      },
      {
        q: "Quanto tempo per implementare KOLO su un team di 20 commerciali?",
        a: "Il pilota completo (onboarding team, configurazione canali, formazione manager) richiede in media 5-7 giorni lavorativi. L'adozione completa raggiunge l'80% in 3 settimane. Accompagniamo ogni implementazione con un Customer Success Manager dedicato."
      },
      {
        q: "Quale ROI aspettarsi il primo anno?",
        a: "Sulla base delle nostre implementazioni 2025, i nostri clienti constatano: +15/+25% di fatturato per commerciale, +30/+40% di tasso di risposta sui follow-up, e 6-9 ore risparmiate a settimana per commerciale sulle attività amministrative."
      },
      {
        q: "I dati dei nostri commerciali sono al sicuro?",
        a: "Sì. Tutti i dati sono ospitati in Europa (Francoforte, Parigi) su infrastruttura conforme GDPR. Crittografia AES-256 a riposo, TLS 1.3 in transito, certificazione SOC 2 Type II in corso. Mantieni la piena proprietà dei tuoi dati e puoi esportarli in qualsiasi momento."
      },
      {
        q: "Qual è il prezzo per un'azienda?",
        a: "Il prezzo è su preventivo e dipende dal numero di commerciali, dal livello di integrazione con i tuoi strumenti (CRM, Google Workspace, Outlook, WhatsApp Business) e dalle opzioni White-Label. Prenota una demo di 30 minuti — invieremo una proposta personalizzata entro 48 ore."
      }
    ],
    de: [
      {
        q: "Ersetzt KOLO unser bestehendes CRM (Salesforce, HubSpot usw.)?",
        a: "Nein. KOLO ergänzt Ihr CRM. Es kümmert sich speziell um die Schicht, die CRMs schlecht handhaben: intelligentes Vertriebs-Follow-up — automatisierte Erinnerungen, Priorisierung heißer Leads, KI-Notizen. KOLO verbindet sich per API mit Ihrem CRM und reichert die Daten an, ohne sie zu duplizieren."
      },
      {
        q: "Wie lange dauert das Rollout für ein 20-köpfiges Vertriebsteam?",
        a: "Der vollständige Pilot (Team-Onboarding, Kanal-Setup, Manager-Schulung) dauert durchschnittlich 5 bis 7 Werktage. Die volle Akzeptanz erreicht 80% in 3 Wochen. Jedes Rollout wird von einem dedizierten Customer Success Manager begleitet."
      },
      {
        q: "Welcher ROI ist im ersten Jahr zu erwarten?",
        a: "Basierend auf unseren Implementierungen 2025 beobachten unsere Kunden: +15 bis +25% Umsatz pro Vertriebler, +30 bis +40% Antwortrate bei Follow-ups, und 6 bis 9 Stunden pro Woche und Vertriebler bei administrativen Aufgaben eingespart."
      },
      {
        q: "Sind die Daten unserer Vertriebler sicher?",
        a: "Ja. Alle Daten werden in Europa (Frankfurt, Paris) auf DSGVO-konformer Infrastruktur gehostet. AES-256-Verschlüsselung im Ruhezustand, TLS 1.3 in Transit, SOC 2 Type II-Zertifizierung in Arbeit. Sie behalten die volle Eigentumsrechte und können Ihre Daten jederzeit exportieren."
      },
      {
        q: "Wie ist die Preisgestaltung für ein Unternehmen?",
        a: "Die Preise sind auf Anfrage und hängen von der Anzahl der Vertriebler, dem Integrationsgrad mit Ihren bestehenden Tools (CRM, Google Workspace, Outlook, WhatsApp Business) und den White-Label-Optionen ab. Buchen Sie eine 30-minütige Demo — wir senden Ihnen ein maßgeschneidertes Angebot innerhalb von 48 Stunden."
      }
    ],
    es: [
      {
        q: "¿KOLO reemplaza nuestro CRM existente (Salesforce, HubSpot, etc.)?",
        a: "No. KOLO es complementario a tu CRM. Se ocupa específicamente de la capa que los CRM gestionan mal: el seguimiento comercial inteligente — recordatorios automáticos, priorización de leads calientes, toma de notas con IA. KOLO se conecta a tu CRM vía API y enriquece los datos sin duplicarlos."
      },
      {
        q: "¿Cuánto tiempo lleva implementar KOLO en un equipo de 20 comerciales?",
        a: "El piloto completo (onboarding del equipo, configuración de canales, formación de manager) tarda en promedio 5-7 días laborables. La adopción completa alcanza el 80% en 3 semanas. Acompañamos cada implementación con un Customer Success Manager dedicado."
      },
      {
        q: "¿Qué ROI esperar el primer año?",
        a: "Basado en nuestros despliegues 2025, nuestros clientes constatan: +15 a +25% de facturación por comercial, +30 a +40% de tasa de respuesta en follow-ups, y 6 a 9 horas ahorradas a la semana por comercial en tareas administrativas."
      },
      {
        q: "¿Están seguros los datos de nuestros comerciales?",
        a: "Sí. Todos los datos están alojados en Europa (Fráncfort, París) en infraestructura conforme al RGPD. Cifrado AES-256 en reposo, TLS 1.3 en tránsito, certificación SOC 2 Type II en curso. Conservas la plena propiedad de tus datos y puedes exportarlos en cualquier momento."
      },
      {
        q: "¿Cuál es el precio para una empresa?",
        a: "El precio es bajo cotización y depende del número de comerciales, el nivel de integración con tus herramientas existentes (CRM, Google Workspace, Outlook, WhatsApp Business) y las opciones White-Label. Reserva una demo de 30 minutos — enviaremos una propuesta personalizada en 48 horas."
      }
    ],
    pt: [
      {
        q: "O KOLO substitui o nosso CRM existente (Salesforce, HubSpot, etc.)?",
        a: "Não. O KOLO é complementar ao seu CRM. Trata especificamente da camada que os CRMs gerem mal: o follow-up comercial inteligente — lembretes automáticos, priorização de leads quentes, toma de notas com IA. O KOLO conecta-se ao seu CRM via API e enriquece os dados sem duplicá-los."
      },
      {
        q: "Quanto tempo demora a implementar o KOLO numa equipa de 20 comerciais?",
        a: "O piloto completo (onboarding da equipa, configuração de canais, formação de manager) demora em média 5-7 dias úteis. A adoção completa atinge 80% em 3 semanas. Acompanhamos cada implementação com um Customer Success Manager dedicado."
      },
      {
        q: "Que ROI esperar no primeiro ano?",
        a: "Com base nas nossas implementações de 2025, os nossos clientes constatam: +15 a +25% de faturação por comercial, +30 a +40% de taxa de resposta em follow-ups, e 6 a 9 horas poupadas por semana por comercial em tarefas administrativas."
      },
      {
        q: "Os dados dos nossos comerciais estão seguros?",
        a: "Sim. Todos os dados são hospedados na Europa (Frankfurt, Paris) em infraestrutura conforme o RGPD. Encriptação AES-256 em repouso, TLS 1.3 em trânsito, certificação SOC 2 Type II em curso. Mantém a propriedade total dos seus dados e pode exportá-los a qualquer momento."
      },
      {
        q: "Qual é o preço para uma empresa?",
        a: "O preço é sob orçamento e depende do número de comerciais, do nível de integração com as suas ferramentas existentes (CRM, Google Workspace, Outlook, WhatsApp Business) e das opções White-Label. Reserve uma demo de 30 minutos — enviaremos uma proposta personalizada em 48 horas."
      }
    ],
    pl: [
      {
        q: "Czy KOLO zastępuje nasz istniejący CRM (Salesforce, HubSpot itp.)?",
        a: "Nie. KOLO jest komplementarne do Twojego CRM. Zajmuje się konkretnie warstwą, którą CRM-y obsługują słabo: inteligentnym follow-upem sprzedażowym — automatycznymi przypomnieniami, priorytetyzacją gorących leadów, notatkami AI. KOLO łączy się z Twoim CRM przez API i wzbogaca dane bez duplikowania ich."
      },
      {
        q: "Ile czasu zajmuje wdrożenie KOLO w zespole 20 handlowców?",
        a: "Pełny pilotaż (onboarding zespołu, konfiguracja kanałów, szkolenie managera) trwa średnio 5-7 dni roboczych. Pełna adopcja osiąga 80% w 3 tygodnie. Każde wdrożenie wspieramy dedykowanym Customer Success Managerem."
      },
      {
        q: "Jakiego ROI oczekiwać w pierwszym roku?",
        a: "Na podstawie naszych wdrożeń z 2025, nasi klienci obserwują: +15 do +25% przychodu na handlowca, +30 do +40% wzrostu wskaźnika odpowiedzi przy follow-upach, oraz 6-9 godzin tygodniowo oszczędzonych przez handlowca na zadaniach administracyjnych."
      },
      {
        q: "Czy dane naszych handlowców są bezpieczne?",
        a: "Tak. Wszystkie dane są hostowane w Europie (Frankfurt, Paryż) na infrastrukturze zgodnej z RODO. Szyfrowanie AES-256 w spoczynku, TLS 1.3 w tranzycie, certyfikacja SOC 2 Type II w toku. Zachowujesz pełną własność i możesz wyeksportować dane w dowolnym momencie."
      },
      {
        q: "Jaka jest cena dla firmy?",
        a: "Cena jest na zapytanie i zależy od liczby handlowców, poziomu integracji z istniejącymi narzędziami (CRM, Google Workspace, Outlook, WhatsApp Business) i opcji White-Label. Zarezerwuj 30-minutowe demo — prześlemy dopasowaną propozycję w ciągu 48 godzin."
      }
    ]
  };

  const faqs = B2B_FAQ[locale] || B2B_FAQ.en;

  const features = [
    { icon: '✓', text: t('landingFeature1') },
    { icon: '✓', text: t('landingFeature2') },
    { icon: '✓', text: t('landingFeature3') },
    { icon: '✓', text: t('landingFeature4') },
    { icon: '✓', text: t('landingFeature5') },
    { icon: '✓', text: t('landingFeature6') },
    { icon: '✓', text: t('landingFeature7') }
  ];

  return (
    <div className="landing-page">
      {/* Premium animated backdrop (orbs + dot grid + spotlight) */}
      <PremiumBackdrop />

      {/* SVG Gradient Definition */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#004AAD" />
            <stop offset="100%" stopColor="#CB6CE6" />
          </linearGradient>
        </defs>
      </svg>

      {/* NAVBAR - Minimaliste */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <a href="/" className="nav-logo">
          <span className="logo-dot"></span>KOLO
        </a>
        
        <div className="nav-actions">
          <button className="nav-login" onClick={() => navigate('/login')}>
            {t('loginButton')}
          </button>
          <button className="nav-cta" onClick={() => navigate('/business#contact')} data-testid="nav-book-demo-btn">
            <span className="cta-full">
              {(() => {
                const T = { fr: 'Booker une démo', en: 'Book a demo', it: 'Prenota una demo', de: 'Demo buchen', es: 'Reservar una demo', pt: 'Reservar uma demo', pl: 'Zarezerwuj demo' };
                return T[locale] || T.en;
              })()}
            </span>
            <span className="cta-short">
              {(() => {
                const T = { fr: 'Démo', en: 'Demo', it: 'Demo', de: 'Demo', es: 'Demo', pt: 'Demo', pl: 'Demo' };
                return T[locale] || T.en;
              })()}
            </span>
          </button>
        </div>
      </nav>

      {/* HERO — B2B first: foncières, promoteurs, réseaux d'agents */}
      <section className="hero">
        <div className="container">
          <h1>
            {(() => {
              const HERO_TITLE = {
                fr: { l1: "Le suivi commercial intelligent", l2: "pour votre entreprise en croissance." },
                en: { l1: "Smart sales follow-up", l2: "for your growing company." },
                it: { l1: "Il follow-up commerciale intelligente", l2: "per la tua azienda in crescita." },
                de: { l1: "Intelligentes Vertriebs-Follow-up", l2: "für Ihr wachsendes Unternehmen." },
                es: { l1: "El seguimiento comercial inteligente", l2: "para tu empresa en crecimiento." },
                pt: { l1: "O seguimento comercial inteligente", l2: "para a sua empresa em crescimento." },
                pl: { l1: "Inteligentny follow-up sprzedażowy", l2: "dla Twojej rozwijającej się firmy." }
              };
              const h = HERO_TITLE[locale] || HERO_TITLE.en;
              return <>{h.l1} <br/><span className="grad-text">{h.l2}</span></>;
            })()}
          </h1>
          <p className="hero-sub">
            {(() => {
              const HERO_SUB = {
                fr: "Foncières, promoteurs, réseaux d'agents : pilotez votre force commerciale avec une IA qui relance, priorise et accélère le closing, sans remplacer votre CRM.",
                en: "Real-estate funds, developers, agency networks: steer your sales force with an AI that follows up, prioritizes and accelerates closing, without replacing your CRM.",
                it: "Fondi immobiliari, sviluppatori, reti di agenti: guida la tua forza commerciale con un'IA che fa follow-up, prioritizza e accelera la chiusura, senza sostituire il tuo CRM.",
                de: "Immobilienfonds, Bauträger, Agenturnetzwerke: Steuern Sie Ihre Vertriebsmannschaft mit einer KI, die nachfasst, priorisiert und Abschlüsse beschleunigt, ohne Ihr CRM zu ersetzen.",
                es: "Fondos inmobiliarios, promotores, redes de agentes: pilota tu fuerza comercial con una IA que hace follow-up, prioriza y acelera el cierre, sin reemplazar tu CRM.",
                pt: "Fundos imobiliários, promotores, redes de agentes: pilote a sua força comercial com uma IA que faz follow-up, prioriza e acelera o fecho, sem substituir o seu CRM.",
                pl: "Fundusze nieruchomości, deweloperzy, sieci agentów: zarządzaj zespołem sprzedaży z AI, które robi follow-up, priorytetyzuje i przyspiesza zamykanie, bez zastępowania CRM."
              };
              return HERO_SUB[locale] || HERO_SUB.en;
            })()}
          </p>
          <div className="hero-cta-row">
            <button
              className="hero-btn-main"
              onClick={() => navigate('/business#contact')}
              data-testid="hero-cta-btn"
            >
              {(() => {
                const BTN = {
                  fr: 'Booker une démo',
                  en: 'Book a demo',
                  it: 'Prenota una demo',
                  de: 'Demo buchen',
                  es: 'Reservar una demo',
                  pt: 'Reservar uma demo',
                  pl: 'Zarezerwuj demo'
                };
                return BTN[locale] || BTN.en;
              })()}
              <ArrowRight size={18} />
            </button>
            <span className="hero-micro-inline">
              {(() => {
                const MICRO = {
                  fr: '30 minutes, réponse sous 48h',
                  en: '30 minutes, response in 48h',
                  it: '30 minuti, risposta entro 48h',
                  de: '30 Minuten, Antwort in 48 Stunden',
                  es: '30 minutos, respuesta en 48h',
                  pt: '30 minutos, resposta em 48h',
                  pl: '30 minut, odpowiedź w 48 godzin'
                };
                return MICRO[locale] || MICRO.en;
              })()}
            </span>
          </div>
        </div>
      </section>

      {/* PRODUCT SHOWCASE — realistic iPhone with animated KOLO app */}
      <section className="phone-showcase">
        <div className="container">
          <PhoneMockup />
        </div>
      </section>

      {/* PROBLEM SECTION REMOVED — leedflow-style: less is more */}

      {/* SANS / AVEC — comparison block (leedflow-style) */}
      <section className="section">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">
              {locale === 'fr' ? 'Pourquoi KOLO ?' :
               locale === 'de' ? 'Warum KOLO?' :
               locale === 'it' ? 'Perché KOLO?' :
               'Why KOLO?'}
            </div>
            <h2 className="section-title">
              {locale === 'fr' ? 'Combien de ventes avez-vous perdues sans le savoir ?' :
               locale === 'de' ? 'Wie viele Verkäufe haben Sie verloren, ohne es zu wissen?' :
               locale === 'it' ? 'Quante vendite hai perso senza saperlo?' :
               'How many deals have you lost without knowing it?'}
            </h2>
          </div>

          <div className="compare-grid">
            <div className="compare-col compare-bad">
              <div className="compare-label">
                {locale === 'fr' ? 'Sans KOLO…' :
                 locale === 'de' ? 'Ohne KOLO…' :
                 locale === 'it' ? 'Senza KOLO…' :
                 'Without KOLO…'}
              </div>
              <ul className="compare-list">
                <li><X size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? "Votre CRM vous dit qui rappeler, mais pas ce que vous lui aviez promis, ni comment renouer la conversation sans paraître artificiel." :
                   locale === 'de' ? "Ihr CRM sagt Ihnen, wen Sie zurückrufen sollen, aber nicht, was Sie versprochen hatten, noch wie Sie das Gespräch wiederaufnehmen, ohne künstlich zu wirken." :
                   locale === 'it' ? "Il tuo CRM ti dice chi richiamare, ma non cosa avevi promesso, né come riprendere la conversazione senza sembrare artificiale." :
                   locale === 'es' ? "Tu CRM te dice a quién llamar, pero no qué le habías prometido, ni cómo retomar la conversación sin parecer artificial." :
                   locale === 'pt' ? "O seu CRM diz-lhe a quem ligar, mas não o que tinha prometido, nem como retomar a conversa sem parecer artificial." :
                   locale === 'pl' ? "Twój CRM mówi, do kogo oddzwonić, ale nie co obiecałeś ani jak nawiązać rozmowę bez sztucznego efektu." :
                   "Your CRM tells you who to call back, but not what you had promised them, nor how to rekindle the conversation naturally."}
                </span></li>
                <li><X size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Des clients qui attendent un rappel qui ne vient pas.' :
                   locale === 'de' ? 'Kunden, die auf einen Rückruf warten, der nie kommt.' :
                   locale === 'it' ? 'Clienti che aspettano una richiamata che non arriva.' :
                   locale === 'es' ? 'Clientes que esperan una llamada que nunca llega.' :
                   locale === 'pt' ? 'Clientes que esperam um retorno que nunca chega.' :
                   locale === 'pl' ? 'Klienci, którzy czekają na telefon, który nigdy nie przychodzi.' :
                   'Clients waiting for a call back that never comes.'}
                </span></li>
                <li><X size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Des relances oubliées.' :
                   locale === 'de' ? 'Vergessene Nachfassaktionen.' :
                   locale === 'it' ? 'Follow-up dimenticati.' :
                   locale === 'es' ? 'Follow-ups olvidados.' :
                   locale === 'pt' ? 'Follow-ups esquecidos.' :
                   locale === 'pl' ? 'Zapomniane follow-upy.' :
                   'Forgotten follow-ups.'}
                </span></li>
                <li><X size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? "Des millions d'euros de chiffre d'affaires perdus." :
                   locale === 'de' ? 'Millionen Euro an verlorenen Umsätzen.' :
                   locale === 'it' ? 'Milioni di euro di fatturato persi.' :
                   locale === 'es' ? 'Millones de euros de facturación perdidos.' :
                   locale === 'pt' ? 'Milhões de euros de faturação perdidos.' :
                   locale === 'pl' ? 'Miliony euro utraconego przychodu.' :
                   'Millions of euros in lost revenue.'}
                </span></li>
              </ul>
            </div>

            <div className="compare-col compare-good">
              <div className="compare-label compare-label-good">
                {locale === 'fr' ? 'Avec KOLO' :
                 locale === 'de' ? 'Mit KOLO' :
                 locale === 'it' ? 'Con KOLO' :
                 'With KOLO'}
              </div>
              <ul className="compare-list">
                <li><Check size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Chaque prospect est suivi et résumé automatiquement.' :
                   locale === 'de' ? 'Jeder Interessent wird automatisch verfolgt und zusammengefasst.' :
                   locale === 'it' ? 'Ogni potenziale cliente è seguito e riassunto automaticamente.' :
                   'Every prospect is tracked and summarized automatically.'}
                </span></li>
                <li><Check size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Vos relances ajoutées à votre agenda.' :
                   locale === 'de' ? 'Ihre Erinnerungen werden Ihrem Kalender hinzugefügt.' :
                   locale === 'it' ? 'I tuoi follow-up aggiunti al tuo calendario.' :
                   'Your follow-ups added to your calendar.'}
                </span></li>
                <li><Check size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Plus aucun oubli.' :
                   locale === 'de' ? 'Keine Versäumnisse mehr.' :
                   locale === 'it' ? 'Niente più dimenticanze.' :
                   'No more forgotten leads.'}
                </span></li>
                <li><Check size={18} strokeWidth={2.4} /><span>
                  {locale === 'fr' ? 'Plus aucune opportunité qui vous file entre les doigts.' :
                   locale === 'de' ? 'Keine Chance entgleitet Ihnen mehr.' :
                   locale === 'it' ? 'Nessuna opportunità ti sfugge più di mano.' :
                   'No more opportunities slipping through your fingers.'}
                </span></li>
              </ul>
            </div>
          </div>

          <div className="centered" style={{ marginTop: '48px', marginBottom: 0 }}>
            <button className="hero-btn-main" onClick={() => navigate('/business#contact')} data-testid="why-cta-btn">
              {(() => {
                const BTN = {
                  fr: 'Booker une démo',
                  en: 'Book a demo',
                  it: 'Prenota una demo',
                  de: 'Demo buchen',
                  es: 'Reservar una demo',
                  pt: 'Reservar uma demo',
                  pl: 'Zarezerwuj demo'
                };
                return BTN[locale] || BTN.en;
              })()}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="section section-alt" id="features">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">{t('theSolution')}</div>
            <h2 className="section-title">
              {t('solutionTitle1')} {t('solutionTitle2')}
            </h2>
          </div>

          {/* Feature 1 */}
          <div className="feature-block">
            <div className="reveal-left">
              <div className="feature-tag">{t('feature1Tag')}</div>
              <h3 className="feature-title">
                {t('feature1Title')}
              </h3>
              <p className="feature-body">
                {t('feature1Desc')}
              </p>
              <ul className="feature-points">
                <li>{t('feature1Point1')}</li>
                <li>{t('feature1Point2')}</li>
                <li>{t('feature1Point3')}</li>
              </ul>
            </div>
            <div className="feature-visual reveal-right">
              <div className="mockup-relances">
                <div className="mock-topbar">
                  <div className="mock-topbar-title">✦ {t('mockTodayFollowups')}</div>
                  <div className="mock-topbar-sub">{t('mock3Prospects')}</div>
                </div>
                <div className="mock-list">
                  <div className="mock-row">
                    <div className="mock-av">ML</div>
                    <div className="mock-info">
                      <div className="mock-name">Marie Leblanc</div>
                      <div className="mock-ai-msg">{t('mockViewed3x')}</div>
                    </div>
                    <span className="mock-urgent urgent-red">🔥 {t('mockNow')}</span>
                  </div>
                  <div className="mock-row">
                    <div className="mock-av b">TM</div>
                    <div className="mock-info">
                      <div className="mock-name">Thomas Moreau</div>
                      <div className="mock-ai-msg">{t('mockNoResponse')}</div>
                    </div>
                    <span className="mock-urgent urgent-amb">⚡ {t('mockToday')}</span>
                  </div>
                  <div className="mock-row">
                    <div className="mock-av c">SC</div>
                    <div className="mock-info">
                      <div className="mock-name">Sophie Curel</div>
                      <div className="mock-ai-msg">{t('mockJustVisited')}</div>
                    </div>
                    <span className="mock-urgent urgent-grn">✓ {t('mockTonight')}</span>
                  </div>
                </div>
                <div className="mock-ai-insight">
                  <span className="ai-spark">✦</span>
                  <div>
                    <div className="ai-ins-label">{t('mockInsightIA')}</div>
                    <div className="ai-ins-text">{t('mockInsightText')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 REMOVED — only one feature block, leedflow-style */}
        </div>
      </section>

      {/* PRICING / DEMO — B2B-first: no public price, book a demo */}
      <section className="section" id="pricing">
        <div className="container">
          <div className="centered reveal">
            <div className="section-tag">
              {(() => {
                const TAG = { fr: 'Pour votre entreprise', en: 'For your company', it: 'Per la tua azienda', de: 'Für Ihr Unternehmen', es: 'Para tu empresa', pt: 'Para a sua empresa', pl: 'Dla Twojej firmy' };
                return TAG[locale] || TAG.en;
              })()}
            </div>
            <h2 className="section-title">
              {(() => {
                const T1 = { fr: 'Une offre sur mesure,', en: 'A tailored offer,', it: "Un'offerta su misura,", de: 'Ein maßgeschneidertes Angebot,', es: 'Una oferta a medida,', pt: 'Uma oferta à medida,', pl: 'Oferta dopasowana,' };
                const T2 = { fr: 'pour votre force commerciale.', en: 'for your sales force.', it: 'per la tua forza commerciale.', de: 'für Ihre Vertriebsmannschaft.', es: 'para tu fuerza comercial.', pt: 'para a sua força comercial.', pl: 'dla Twojego zespołu sprzedaży.' };
                return <>{T1[locale] || T1.en} <span className="grad-text">{T2[locale] || T2.en}</span></>;
              })()}
            </h2>
            <p className="section-body" style={{ maxWidth: 620, margin: '14px auto 0' }}>
              {(() => {
                const SUB = {
                  fr: "Tarification calculée selon le nombre de commerciaux, vos intégrations CRM existantes et les options Marque Blanche. Réservez 30 minutes avec notre équipe, nous établissons une proposition sous 48h.",
                  en: "Pricing is calculated based on number of reps, your existing CRM integrations and White-Label options. Book 30 minutes with our team, we send a tailored proposal within 48 hours.",
                  it: "Tariffe calcolate in base al numero di commerciali, alle integrazioni CRM esistenti e alle opzioni White-Label. Prenota 30 minuti con il nostro team, invieremo una proposta entro 48 ore.",
                  de: "Preisgestaltung basierend auf Anzahl der Vertriebler, bestehenden CRM-Integrationen und White-Label-Optionen. Buchen Sie 30 Minuten mit unserem Team, Angebot innerhalb von 48 Stunden.",
                  es: "Precio calculado según el número de comerciales, tus integraciones CRM existentes y las opciones White-Label. Reserva 30 minutos con nuestro equipo, propuesta personalizada en 48 horas.",
                  pt: "Preço calculado de acordo com o número de comerciais, integrações de CRM existentes e opções White-Label. Reserve 30 minutos com a nossa equipa, proposta personalizada em 48 horas.",
                  pl: "Cena obliczana na podstawie liczby handlowców, istniejących integracji CRM i opcji White-Label. Zarezerwuj 30 minut z naszym zespołem, dopasowana propozycja w ciągu 48 godzin."
                };
                return SUB[locale] || SUB.en;
              })()}
            </p>
          </div>

          {/* CTA principal — bouton standard du site */}
          <div className="centered reveal" style={{ marginTop: '40px' }}>
            <button
              className="hero-btn-main"
              onClick={() => navigate('/business#contact')}
              data-testid="pricing-book-demo-btn"
            >
              {(() => {
                const B = { fr: 'Booker une démo', en: 'Book a demo', it: 'Prenota una demo', de: 'Demo buchen', es: 'Reservar una demo', pt: 'Reservar uma demo', pl: 'Zarezerwuj demo' };
                return B[locale] || B.en;
              })()}
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Independent professional — discret, en cohérence avec la landing */}
          <div className="centered reveal" style={{ marginTop: '72px', paddingTop: '36px', borderTop: '1px solid rgba(15,23,42,0.08)' }}>
            <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 14px', lineHeight: 1.55 }}>
              {(() => {
                const T = {
                  fr: "Indépendant ? KOLO existe aussi en application iOS, à partir de 9,99€/mois.",
                  en: "Solo professional? KOLO is also available as an iOS app, from €9.99/month.",
                  it: "Indipendente? KOLO è disponibile anche come app iOS, da 9,99€/mese.",
                  de: "Selbstständig? KOLO ist auch als iOS-App verfügbar, ab 9,99€/Monat.",
                  es: "¿Independiente? KOLO también está disponible como app iOS, desde 9,99€/mes.",
                  pt: "Independente? O KOLO também está disponível como aplicação iOS, a partir de 9,99€/mês.",
                  pl: "Niezależny? KOLO jest również dostępne jako aplikacja iOS, od 9,99€/miesiąc."
                };
                return T[locale] || T.en;
              })()}
            </p>
            <AppStoreBadge locale={locale} variant="default" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section section-alt" id="faq">
        <div className="container-sm">
          <div className="centered reveal">
            <div className="section-tag">FAQ</div>
            <h2 className="section-title">
              {t('faqSectionTitle')}
            </h2>
          </div>
          <div className="faq-list reveal">
            {faqs.map((faq, i) => (
              <div className={`faq-item ${expandedFaq === i ? 'open' : ''}`} key={i}>
                <button className="faq-q" onClick={() => toggleFaq(i)}>
                  {faq.q}
                  <span className="faq-icon">{expandedFaq === i ? '−' : '+'}</span>
                </button>
                <div className="faq-a" style={{ maxHeight: expandedFaq === i ? '300px' : '0' }}>
                  <div className="faq-a-inner">{faq.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA — B2B-first */}
      <section className="cta-final">
        <div className="container">
          <h2 className="cta-title reveal">
            {(() => {
              const T1 = {
                fr: "Arrêtez de perdre des deals",
                en: "Stop losing deals",
                it: "Smetti di perdere deal",
                de: "Hören Sie auf, Deals zu verlieren",
                es: "Deja de perder oportunidades",
                pt: "Pare de perder negócios",
                pl: "Przestań tracić transakcje"
              };
              const T2 = {
                fr: "à cause d'un suivi commercial défaillant.",
                en: "due to broken sales follow-up.",
                it: "a causa di un follow-up commerciale debole.",
                de: "wegen mangelhaftem Vertriebs-Follow-up.",
                es: "por un seguimiento comercial deficiente.",
                pt: "por causa de um seguimento comercial deficiente.",
                pl: "z powodu słabego follow-upu sprzedażowego."
              };
              return <>{T1[locale] || T1.en} <span className="grad-text">{T2[locale] || T2.en}</span></>;
            })()}
          </h2>
          <p className="cta-sub reveal">
            {(() => {
              const S = {
                fr: "Rejoignez les entreprises qui closent plus, plus vite.",
                en: "Join the companies that close more, faster.",
                it: "Unisciti alle aziende che chiudono di più, più velocemente.",
                de: "Schließen Sie sich Unternehmen an, die mehr und schneller abschließen.",
                es: "Únete a las empresas que cierran más, más rápido.",
                pt: "Junte-se às empresas que fecham mais, mais rápido.",
                pl: "Dołącz do firm, które zamykają więcej, szybciej."
              };
              return S[locale] || S.en;
            })()}
          </p>
          <div className="reveal">
            <button className="btn-final" onClick={() => navigate('/business#contact')} data-testid="final-cta-book-demo">
              {(() => {
                const B = { fr: 'Réserver une démo', en: 'Book a demo', it: 'Prenota una demo', de: 'Demo buchen', es: 'Reservar una demo', pt: 'Reservar uma demo', pl: 'Zarezerwuj demo' };
                return B[locale] || B.en;
              })()}
              <ArrowRight size={18} />
            </button>
            <p className="cta-micro">
              {(() => {
                const M = {
                  fr: '30 min · sans engagement · réponse sous 48h',
                  en: '30 min · no commitment · response in 48h',
                  it: '30 min · senza impegno · risposta entro 48h',
                  de: '30 Min · unverbindlich · Antwort in 48h',
                  es: '30 min · sin compromiso · respuesta en 48h',
                  pt: '30 min · sem compromisso · resposta em 48h',
                  pl: '30 min · bez zobowiązań · odpowiedź w 48h'
                };
                return M[locale] || M.en;
              })()}
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <a href="/" className="footer-logo">
              KOLO<span className="logo-dot"></span>
            </a>
            <p className="footer-copy">© 2026 KOLO. {t('footerRights')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* Language selector — moved here from the nav for a cleaner top */}
              <div className="lang-selector" style={{ position: 'relative' }}>
                <button
                  className="lang-btn"
                  onClick={() => { setShowLangMenu(!showLangMenu); setShowCurrencyMenu(false); }}
                  data-testid="footer-lang-btn"
                >
                  <span className="lang-full">{currentLang.label}</span>
                  <span className="lang-short">{locale.toUpperCase()}</span>
                  <ChevronDown size={14} />
                </button>
                {showLangMenu && (
                  <div className="lang-menu" style={{ bottom: '100%', top: 'auto', marginBottom: '6px' }}>
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        className={`lang-option ${lang.code === locale ? 'active' : ''}`}
                        onClick={() => { changeLanguage(lang.code); setShowLangMenu(false); }}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Currency selector — moved here from the nav */}
              <div className="currency-selector" style={{ position: 'relative' }}>
                <button
                  className="currency-btn"
                  onClick={() => { setShowCurrencyMenu(!showCurrencyMenu); setShowLangMenu(false); }}
                  data-testid="footer-currency-btn"
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '13px', fontWeight: '500',
                    cursor: 'pointer', padding: '4px 8px',
                    borderRadius: '6px', display: 'flex',
                    alignItems: 'center', gap: '4px',
                  }}
                >
                  {CURRENCIES.find(c => c.code === currency)?.symbol || '€'}
                  <ChevronDown size={12} />
                </button>
                {showCurrencyMenu && (
                  <div className="currency-menu" style={{
                    position: 'absolute', bottom: '100%', right: 0, marginBottom: '6px',
                    background: '#1a1a24', borderRadius: '8px', padding: '4px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 100, minWidth: '90px',
                  }}>
                    {CURRENCIES.map(curr => (
                      <button
                        key={curr.code}
                        onClick={() => { changeCurrency(curr.code); setShowCurrencyMenu(false); }}
                        style={{
                          display: 'block', width: '100%', padding: '8px 12px',
                          background: currency === curr.code ? 'rgba(108, 99, 255, 0.2)' : 'transparent',
                          border: 'none', borderRadius: '6px',
                          color: currency === curr.code ? '#6C63FF' : '#a0a4ae',
                          fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {curr.symbol} {curr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowLegalModal(true)}
                className="legal-notice-btn"
              >
                {lt.legalNotice}
              </button>
              <a
                href="/blog"
                className="legal-notice-btn"
                data-testid="footer-blog-link"
                style={{ textDecoration: 'none' }}
              >
                {lt.blogLink}
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* LEGAL MODAL */}
      {showLegalModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setShowLegalModal(false)}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0E0B1E', margin: 0 }}>
                {lt.legalNotice}
              </h2>
              <button 
                onClick={() => setShowLegalModal(false)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} color="#6b7280" />
              </button>
            </div>
            <div style={{
              padding: '24px',
              overflowY: 'auto',
              fontSize: '14px',
              lineHeight: '1.7',
              color: '#374151'
            }}>
              <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '24px' }}>Last updated: March 31, 2026</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>1. COMPANY INFORMATION</h3>
              <p>KOLO is operated by:</p>
              <p><strong>KOLO.io LTD</strong><br/>124 City Road<br/>London, EC1V 2NX<br/>United Kingdom</p>
              <p>Email: contact@trykolo.io</p>
              <p>KOLO.io LTD is a company incorporated under the laws of England and Wales.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>2. PURPOSE OF THE PLATFORM</h3>
              <p>KOLO is a mobile-first SaaS (Software as a Service) platform designed to help real estate agents and other professionals optimize their workflow through artificial intelligence.</p>
              <p>The platform enables users to manage tasks, prospects, reminders, and business-related data in a structured and efficient environment.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>3. ACCESS AND USE</h3>
              <p>Access to KOLO is restricted to users with an active paid subscription.</p>
              <p>Users agree to:</p>
              <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
                <li>Provide accurate and up-to-date information</li>
                <li>Use the platform in compliance with applicable laws and regulations</li>
                <li>Not misuse, disrupt, or attempt to gain unauthorized access to the system</li>
              </ul>
              <p>KOLO reserves the right to suspend or terminate access in case of violation of these terms.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>4. DATA OWNERSHIP</h3>
              <p>All data entered into KOLO by users — including but not limited to: Prospects, Tasks, Notes, Contacts, Business-related information — remain the sole and exclusive property of the user.</p>
              <p>KOLO does not:</p>
              <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
                <li>Sell user data</li>
                <li>Exploit user data for commercial purposes</li>
                <li>Share user data with third parties for marketing or resale</li>
              </ul>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>5. DATA PRIVACY AND SECURITY</h3>
              <p>Data protection and privacy are core principles of KOLO.</p>
              <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
                <li>All data is hosted on secure servers located in France</li>
                <li>Infrastructure is compliant with the General Data Protection Regulation (GDPR)</li>
                <li>Data is stored on a sovereign, encrypted, and highly secured cloud environment</li>
              </ul>
              <p>KOLO implements industry-standard security measures including data encryption (in transit and at rest), secure authentication mechanisms, and controlled access to infrastructure.</p>
              <p>Despite best efforts, no system can guarantee absolute security. Users acknowledge this inherent limitation.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>6. PAYMENT PROCESSING</h3>
              <p>All payments on KOLO are processed via Stripe, a third-party payment provider.</p>
              <p>KOLO does not store or have access to any banking details and does not process payment information directly.</p>
              <p>Users are encouraged to review Stripe&apos;s own legal terms and privacy policies.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>7. INTERNATIONAL OPERATIONS</h3>
              <p>KOLO operates globally, with a primary focus on professionals located in Europe, United Kingdom, United States, and United Arab Emirates.</p>
              <p>Users are responsible for ensuring their use of KOLO complies with their local regulations.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>8. LIABILITY</h3>
              <p>KOLO provides tools designed to assist users in managing their business activities.</p>
              <p>KOLO does not guarantee business results, act as a real estate intermediary, or replace professional judgment.</p>
              <p>KOLO shall not be held liable for business losses, data loss caused by user actions, or service interruptions beyond reasonable control.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>9. INTELLECTUAL PROPERTY</h3>
              <p>All elements of the KOLO platform, including software, design, branding, and content are the exclusive property of KOLO.io LTD, unless otherwise stated.</p>
              <p>Any reproduction, distribution, or unauthorized use is strictly prohibited.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>10. SUPPORT</h3>
              <p>For any inquiries, support requests, or complaints:</p>
              <p>Email: contact@trykolo.io</p>
              <p>KOLO commits to responding as quickly as possible and within a reasonable timeframe.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>11. MODIFICATIONS</h3>
              <p>KOLO reserves the right to update or modify these legal notices at any time.</p>
              <p>Users will be informed of significant changes where applicable. Continued use of the platform constitutes acceptance of the updated terms.</p>
              
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0E0B1E', marginTop: '24px', marginBottom: '12px' }}>12. GOVERNING LAW</h3>
              <p>These legal notices are governed by the laws of England and Wales.</p>
              <p>Any disputes shall fall under the jurisdiction of the competent courts in London, United Kingdom.</p>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      <div className={`toast ${showToast ? 'show' : ''}`}>
        📬 {t('toastCheckEmail')}
      </div>
    </div>
  );
};

export default LandingPage;
