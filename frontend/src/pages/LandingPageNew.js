import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'fr', label: 'FR', name: 'Francais' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { locale, changeLanguage } = useLocale();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const currentLang = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

  const content = {
    fr: {
      headline: "Vos prospects vous oublient parce que vous les oubliez.",
      subheadline: "KOLO vous dit qui relancer et ecrit le message.",
      cta: "Essayer gratuitement",
      trial: "7 jours gratuits, sans carte bancaire.",
      problem: "Un agent perd en moyenne 3 mandats par mois faute de suivi. Pas par manque de talent — par manque d'outil.",
      howItWorks: "Comment ca marche",
      step1Title: "Ajoutez un prospect en 30 secondes",
      step1Desc: "Importez vos contacts ou ajoutez-les manuellement. KOLO s'occupe du reste.",
      step2Title: "KOLO vous dit qui relancer et quand",
      step2Desc: "L'IA analyse vos prospects et vous suggere la prochaine action.",
      step3Title: "Generez le message parfait en 1 tap",
      step3Desc: "SMS, email ou appel — KOLO redige le message pour vous.",
      pricing: "Tarif simple",
      priceAmount: "9,99€",
      pricePeriod: "/mois",
      priceNote: "Un mandat signe = 2 ans d'abonnement rembourses.",
      feature1: "Prospects illimites",
      feature2: "Suggestions IA quotidiennes",
      feature3: "Generation de messages IA",
      feature4: "Rappels intelligents",
      faqTitle: "Questions frequentes",
      faq1Q: "Comment fonctionne l'essai gratuit ?",
      faq1A: "Vous avez 7 jours pour tester toutes les fonctionnalites de KOLO. Aucune carte bancaire n'est requise. A la fin de l'essai, vous pouvez vous abonner ou simplement arreter.",
      faq2Q: "Mes donnees sont-elles securisees ?",
      faq2A: "Oui, vos donnees sont chiffrees et stockees sur des serveurs securises en Europe. Nous ne partageons jamais vos informations avec des tiers.",
      faq3Q: "Puis-je annuler a tout moment ?",
      faq3A: "Absolument. Vous pouvez annuler votre abonnement en un clic depuis l'application. Pas de frais caches, pas d'engagement.",
      faq4Q: "L'IA comprend-elle vraiment mon metier ?",
      faq4A: "KOLO est specialement concu pour les agents immobiliers. L'IA connait le cycle de vente, les etapes cles et genere des messages adaptes a chaque situation.",
      faq5Q: "Comment importer mes contacts ?",
      faq5A: "Vous pouvez importer vos contacts directement depuis votre telephone en un tap, ou les ajouter manuellement un par un.",
      finalCta: "Commencez gratuitement aujourd'hui.",
      login: "Connexion"
    },
    en: {
      headline: "Your prospects forget you because you forget them.",
      subheadline: "KOLO tells you who to follow up and writes the message.",
      cta: "Try for free",
      trial: "7 days free, no credit card required.",
      problem: "An agent loses an average of 3 deals per month due to lack of follow-up. Not for lack of talent — for lack of tools.",
      howItWorks: "How it works",
      step1Title: "Add a prospect in 30 seconds",
      step1Desc: "Import your contacts or add them manually. KOLO handles the rest.",
      step2Title: "KOLO tells you who to follow up and when",
      step2Desc: "AI analyzes your prospects and suggests the next action.",
      step3Title: "Generate the perfect message in 1 tap",
      step3Desc: "SMS, email or call — KOLO writes the message for you.",
      pricing: "Simple pricing",
      priceAmount: "$9.99",
      pricePeriod: "/month",
      priceNote: "One signed deal = 2 years of subscription paid back.",
      feature1: "Unlimited prospects",
      feature2: "Daily AI suggestions",
      feature3: "AI message generation",
      feature4: "Smart reminders",
      faqTitle: "FAQ",
      faq1Q: "How does the free trial work?",
      faq1A: "You have 7 days to test all KOLO features. No credit card required. At the end of the trial, you can subscribe or simply stop.",
      faq2Q: "Is my data secure?",
      faq2A: "Yes, your data is encrypted and stored on secure servers in Europe. We never share your information with third parties.",
      faq3Q: "Can I cancel anytime?",
      faq3A: "Absolutely. You can cancel your subscription in one click from the app. No hidden fees, no commitment.",
      faq4Q: "Does the AI really understand my job?",
      faq4A: "KOLO is specifically designed for real estate agents. The AI knows the sales cycle, key steps and generates messages adapted to each situation.",
      faq5Q: "How do I import my contacts?",
      faq5A: "You can import your contacts directly from your phone in one tap, or add them manually one by one.",
      finalCta: "Start for free today.",
      login: "Login"
    }
  };

  const t = content[locale] || content.fr;

  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
    { q: t.faq5Q, a: t.faq5A },
  ];

  // Screenshot URLs - using placeholder approach with app screenshots
  const screenshots = {
    step1: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='280' viewBox='0 0 160 280'%3E%3Crect fill='%231F2937' width='160' height='280' rx='16'/%3E%3Crect x='12' y='40' fill='%23374151' width='136' height='36' rx='8'/%3E%3Crect x='12' y='84' fill='%23374151' width='136' height='36' rx='8'/%3E%3Crect x='12' y='128' fill='%23374151' width='136' height='36' rx='8'/%3E%3Crect x='12' y='172' fill='%23374151' width='136' height='60' rx='8'/%3E%3Crect x='12' y='240' fill='%237C3AED' width='136' height='28' rx='8'/%3E%3Ctext x='80' y='16' fill='%23F9FAFB' font-size='10' text-anchor='middle' font-family='system-ui'%3ENouveau prospect%3C/text%3E%3C/svg%3E",
    step2: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='280' viewBox='0 0 160 280'%3E%3Crect fill='%231F2937' width='160' height='280' rx='16'/%3E%3Ctext x='12' y='24' fill='%239CA3AF' font-size='10' font-family='system-ui'%3EAujourd'hui%3C/text%3E%3Crect x='8' y='36' fill='%23374151' width='144' height='56' rx='10'/%3E%3Ccircle cx='24' cy='56' r='6' fill='%237C3AED'/%3E%3Ctext x='36' y='52' fill='%23F9FAFB' font-size='8' font-family='system-ui'%3EAI Suggestion%3C/text%3E%3Ctext x='36' y='64' fill='%239CA3AF' font-size='7' font-family='system-ui'%3ERelancer Jean Dupont%3C/text%3E%3Crect x='8' y='100' fill='%23374151' width='144' height='44' rx='10'/%3E%3Crect x='8' y='152' fill='%23374151' width='144' height='44' rx='10'/%3E%3Crect x='8' y='204' fill='%23374151' width='144' height='44' rx='10'/%3E%3C/svg%3E",
    step3: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='280' viewBox='0 0 160 280'%3E%3Crect fill='%231F2937' width='160' height='280' rx='16'/%3E%3Ctext x='80' y='24' fill='%23F9FAFB' font-size='10' text-anchor='middle' font-family='system-ui'%3ESMS Jean Dupont%3C/text%3E%3Crect x='12' y='40' fill='%23374151' width='136' height='160' rx='10'/%3E%3Ctext x='20' y='60' fill='%23F9FAFB' font-size='7' font-family='system-ui'%3EBonjour Jean,%3C/text%3E%3Ctext x='20' y='76' fill='%239CA3AF' font-size='7' font-family='system-ui'%3ESuite a notre echange%3C/text%3E%3Ctext x='20' y='88' fill='%239CA3AF' font-size='7' font-family='system-ui'%3Econcernant votre projet...%3C/text%3E%3Crect x='12' y='210' fill='%237C3AED' width='136' height='32' rx='8'/%3E%3Ctext x='80' y='230' fill='white' font-size='9' text-anchor='middle' font-family='system-ui'%3EEnvoyer%3C/text%3E%3C/svg%3E"
  };

  return (
    <div className="mobile-frame theme-dark" style={{ background: '#0A0A0C' }}>
      <div style={{ minHeight: '100vh' }}>
        
        {/* Header */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '12px 20px',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(10, 10, 12, 0.95)',
          backdropFilter: 'blur(20px)'
        }}>
          {/* Language selector */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9CA3AF',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {currentLang.label}
              <ChevronDown size={14} />
            </button>
            {showLangMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: '#1F2937',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { changeLanguage(lang.code); setShowLangMenu(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 16px',
                      background: lang.code === locale ? 'rgba(124,58,237,0.2)' : 'none',
                      border: 'none',
                      color: '#F9FAFB',
                      fontSize: '13px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Login */}
          <button 
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#9CA3AF',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {t.login}
          </button>
        </header>

        {/* SECTION 1: Hero - Dark background */}
        <section style={{ padding: '48px 24px 60px', textAlign: 'center', background: '#0A0A0C' }}>
          {/* Logo */}
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 32px rgba(124, 58, 237, 0.3)'
          }}>
            <span style={{ fontSize: '32px', fontWeight: '700', color: 'white' }}>K</span>
          </div>
          
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            lineHeight: '1.25',
            color: '#F9FAFB',
            marginBottom: '16px',
            letterSpacing: '-0.5px'
          }}>
            {t.headline}
          </h1>
          <p style={{
            fontSize: '15px',
            color: '#9CA3AF',
            marginBottom: '32px',
            lineHeight: '1.5'
          }}>
            {t.subheadline}
          </p>
          <button 
            onClick={() => navigate('/register')}
            style={{
              background: '#7C3AED',
              color: 'white',
              border: 'none',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              transition: 'opacity 0.15s ease'
            }}
          >
            {t.cta} <ArrowRight size={18} />
          </button>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            {t.trial}
          </p>
        </section>

        {/* SECTION 2: Problem - White background */}
        <section style={{
          padding: '48px 24px',
          background: '#FFFFFF'
        }}>
          <p style={{
            fontSize: '18px',
            fontWeight: '500',
            color: '#111827',
            textAlign: 'center',
            lineHeight: '1.6',
            maxWidth: '340px',
            margin: '0 auto'
          }}>
            {t.problem}
          </p>
        </section>

        {/* SECTION 3: How it Works - Dark background with screenshots */}
        <section style={{ padding: '60px 24px', background: '#0A0A0C' }}>
          <h2 style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            {t.howItWorks}
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Step 1 */}
            <div style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center'
            }}>
              <img 
                src={screenshots.step1} 
                alt="Add prospect" 
                style={{ 
                  width: '120px', 
                  height: '200px', 
                  borderRadius: '16px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                  flexShrink: 0
                }} 
              />
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#F9FAFB', marginBottom: '8px' }}>
                  {t.step1Title}
                </h3>
                <p style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                  {t.step1Desc}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              flexDirection: 'row-reverse'
            }}>
              <img 
                src={screenshots.step2} 
                alt="AI suggestions" 
                style={{ 
                  width: '120px', 
                  height: '200px', 
                  borderRadius: '16px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                  flexShrink: 0
                }} 
              />
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#F9FAFB', marginBottom: '8px' }}>
                  {t.step2Title}
                </h3>
                <p style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                  {t.step2Desc}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center'
            }}>
              <img 
                src={screenshots.step3} 
                alt="Generate message" 
                style={{ 
                  width: '120px', 
                  height: '200px', 
                  borderRadius: '16px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                  flexShrink: 0
                }} 
              />
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#F9FAFB', marginBottom: '8px' }}>
                  {t.step3Title}
                </h3>
                <p style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                  {t.step3Desc}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Pricing - Dark background */}
        <section style={{ padding: '60px 24px', textAlign: 'center', background: '#111827' }}>
          <h2 style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '24px'
          }}>
            {t.pricing}
          </h2>
          
          <div style={{
            background: '#1F2937',
            border: '2px solid #7C3AED',
            borderRadius: '16px',
            padding: '32px 24px',
            marginBottom: '24px',
            boxShadow: '0 0 40px rgba(124, 58, 237, 0.15)'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '48px', fontWeight: '700', color: '#F9FAFB' }}>
                {t.priceAmount}
              </span>
              <span style={{ fontSize: '15px', color: '#9CA3AF' }}>
                {t.pricePeriod}
              </span>
            </div>
            
            <div style={{ textAlign: 'left', marginBottom: '24px' }}>
              {[t.feature1, t.feature2, t.feature3, t.feature4].map((feature, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 0'
                }}>
                  <Check size={18} color="#22C55E" />
                  <span style={{ fontSize: '14px', color: '#F9FAFB' }}>{feature}</span>
                </div>
              ))}
            </div>
            
            <p style={{
              fontSize: '13px',
              color: '#9CA3AF',
              fontStyle: 'italic',
              marginBottom: '20px'
            }}>
              {t.priceNote}
            </p>
            
            <button 
              onClick={() => navigate('/register')}
              style={{
                width: '100%',
                background: '#7C3AED',
                color: 'white',
                border: 'none',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {t.cta} <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* SECTION 5: FAQ - White background */}
        <section style={{
          padding: '60px 24px',
          background: '#FFFFFF'
        }}>
          <h2 style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            {t.faqTitle}
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {faqs.map((faq, i) => (
              <div 
                key={i}
                style={{
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827', paddingRight: '12px' }}>
                    {faq.q}
                  </span>
                  {expandedFaq === i ? (
                    <ChevronUp size={18} color="#6B7280" />
                  ) : (
                    <ChevronDown size={18} color="#6B7280" />
                  )}
                </button>
                {expandedFaq === i && (
                  <div style={{
                    padding: '0 16px 16px',
                    fontSize: '13px',
                    color: '#6B7280',
                    lineHeight: '1.6'
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 6: Final CTA - Dark background */}
        <section style={{
          padding: '60px 24px',
          textAlign: 'center',
          background: '#0A0A0C'
        }}>
          <h2 style={{
            fontSize: '22px',
            fontWeight: '600',
            color: '#F9FAFB',
            marginBottom: '24px'
          }}>
            {t.finalCta}
          </h2>
          <button 
            onClick={() => navigate('/register')}
            style={{
              background: '#7C3AED',
              color: 'white',
              border: 'none',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}
          >
            {t.cta} <ArrowRight size={18} />
          </button>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            {t.trial}
          </p>
        </section>

        {/* Footer spacer */}
        <div style={{ height: '40px', background: '#0A0A0C' }} />
      </div>
    </div>
  );
};

export default LandingPage;
