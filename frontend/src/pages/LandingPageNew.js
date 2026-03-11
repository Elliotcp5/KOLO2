import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronUp, Smartphone, Bell, Sparkles, MessageSquare, Users, Target } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

const LANDING_LOGO_URL = "https://customer-assets.emergentagent.com/job_kolo-checkout-flow/artifacts/zc3e0gj2_KOLO%20V2%20LOGO%20PNG.png";

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
      subheadline: "KOLO vous dit qui relancer, quand, et genere le message a votre place.",
      cta: "Essayer gratuitement",
      ctaArrow: "Essayer gratuitement",
      trial: "7 jours gratuits, sans carte bancaire.",
      problem: "Un agent perd en moyenne 3 mandats par mois faute de suivi. Pas par manque de talent — par manque d'outil.",
      howItWorks: "Comment ca marche",
      step1Title: "Ajoutez un prospect en 30 secondes",
      step1Desc: "Importez vos contacts ou ajoutez-les manuellement. KOLO s'occupe du reste.",
      step2Title: "KOLO vous dit qui relancer et quand",
      step2Desc: "L'IA analyse vos prospects et vous suggere la prochaine action.",
      step3Title: "Generez le message parfait en 1 tap",
      step3Desc: "SMS, email ou appel — KOLO redige le message pour vous.",
      testimonials: "Ce qu'ils en disent",
      testimonial1: "\"Depuis que j'utilise KOLO, je n'oublie plus aucun prospect. J'ai signe 2 mandats de plus le premier mois.\"",
      testimonial1Author: "Marie D.",
      testimonial1Role: "Agent IAD, Lyon",
      testimonial2: "\"L'IA qui genere les messages, c'est un game changer. Je gagne 1h par jour.\"",
      testimonial2Author: "Thomas R.",
      testimonial2Role: "Agent Safti, Bordeaux",
      testimonial3: "\"Simple, efficace, indispensable. Je recommande a tous mes collegues.\"",
      testimonial3Author: "Sophie M.",
      testimonial3Role: "Agent Century 21, Paris",
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
      login: "Connexion",
      faq: "FAQ"
    },
    en: {
      headline: "Your prospects forget you because you forget them.",
      subheadline: "KOLO tells you who to follow up with, when, and writes the message for you.",
      cta: "Try for free",
      ctaArrow: "Try for free",
      trial: "7 days free, no credit card required.",
      problem: "An agent loses an average of 3 deals per month due to lack of follow-up. Not for lack of talent — for lack of tools.",
      howItWorks: "How it works",
      step1Title: "Add a prospect in 30 seconds",
      step1Desc: "Import your contacts or add them manually. KOLO handles the rest.",
      step2Title: "KOLO tells you who to follow up and when",
      step2Desc: "AI analyzes your prospects and suggests the next action.",
      step3Title: "Generate the perfect message in 1 tap",
      step3Desc: "SMS, email or call — KOLO writes the message for you.",
      testimonials: "What they say",
      testimonial1: "\"Since using KOLO, I never forget a prospect. I signed 2 more deals the first month.\"",
      testimonial1Author: "Marie D.",
      testimonial1Role: "IAD Agent, Lyon",
      testimonial2: "\"The AI that generates messages is a game changer. I save 1 hour a day.\"",
      testimonial2Author: "Thomas R.",
      testimonial2Role: "Safti Agent, Bordeaux",
      testimonial3: "\"Simple, effective, essential. I recommend it to all my colleagues.\"",
      testimonial3Author: "Sophie M.",
      testimonial3Role: "Century 21 Agent, Paris",
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
      login: "Login",
      faq: "FAQ"
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

  return (
    <div className="mobile-frame" style={{ background: 'var(--bg)' }}>
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
          background: 'rgba(10, 10, 12, 0.9)',
          backdropFilter: 'blur(20px)'
        }}>
          {/* Language selector */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              {currentLang.label}
            </button>
            {showLangMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                minWidth: '100px'
              }}>
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { changeLanguage(lang.code); setShowLangMenu(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      background: locale === lang.code ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                      border: 'none',
                      color: locale === lang.code ? 'var(--accent)' : 'var(--text)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      textAlign: 'left'
                    }}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Right nav */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button 
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {t.login}
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section style={{ padding: '48px 24px 60px', textAlign: 'center' }}>
          <img 
            src={LANDING_LOGO_URL} 
            alt="KOLO" 
            style={{ height: '80px', marginBottom: '32px' }}
          />
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            lineHeight: '1.25',
            color: 'var(--text)',
            marginBottom: '16px',
            letterSpacing: '-0.5px'
          }}>
            {t.headline}
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'var(--muted)',
            marginBottom: '32px',
            lineHeight: '1.5'
          }}>
            {t.subheadline}
          </p>
          <button 
            onClick={() => navigate('/register')}
            className="btn-primary"
            style={{ marginBottom: '12px' }}
          >
            {t.ctaArrow} <ArrowRight size={18} />
          </button>
          <p style={{ fontSize: '13px', color: 'var(--muted-dark)' }}>
            {t.trial}
          </p>
        </section>

        {/* Problem Section */}
        <section style={{
          padding: '48px 24px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)'
        }}>
          <p style={{
            fontSize: '18px',
            fontWeight: '500',
            color: 'var(--text)',
            textAlign: 'center',
            lineHeight: '1.6',
            maxWidth: '340px',
            margin: '0 auto'
          }}>
            {t.problem}
          </p>
        </section>

        {/* How it Works */}
        <section style={{ padding: '60px 24px' }}>
          <h2 style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            {t.howItWorks}
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Step 1 */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              gap: '16px',
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Smartphone size={20} color="var(--accent)" />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                  {t.step1Title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  {t.step1Desc}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              gap: '16px',
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Bell size={20} color="var(--accent)" />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                  {t.step2Title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  {t.step2Desc}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              gap: '16px',
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={20} color="var(--accent)" />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                  {t.step3Title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  {t.step3Desc}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section style={{
          padding: '60px 24px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)'
        }}>
          <h2 style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            {t.testimonials}
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { text: t.testimonial1, author: t.testimonial1Author, role: t.testimonial1Role },
              { text: t.testimonial2, author: t.testimonial2Author, role: t.testimonial2Role },
              { text: t.testimonial3, author: t.testimonial3Author, role: t.testimonial3Role },
            ].map((testimonial, i) => (
              <div key={i} style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '20px'
              }}>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text)',
                  lineHeight: '1.6',
                  marginBottom: '12px',
                  fontStyle: 'italic'
                }}>
                  {testimonial.text}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--accent-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Users size={14} color="var(--accent)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                      {testimonial.author}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section style={{ padding: '60px 24px', textAlign: 'center' }}>
          <h2 style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '24px'
          }}>
            {t.pricing}
          </h2>
          
          <div style={{
            background: 'var(--surface)',
            border: '2px solid var(--accent)',
            borderRadius: '20px',
            padding: '32px 24px',
            marginBottom: '24px'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '48px', fontWeight: '700', color: 'var(--text)' }}>
                {t.priceAmount}
              </span>
              <span style={{ fontSize: '16px', color: 'var(--muted)' }}>
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
                  <Check size={18} color="var(--success)" />
                  <span style={{ fontSize: '14px', color: 'var(--text)' }}>{feature}</span>
                </div>
              ))}
            </div>
            
            <p style={{
              fontSize: '13px',
              color: 'var(--muted)',
              fontStyle: 'italic',
              marginBottom: '20px'
            }}>
              {t.priceNote}
            </p>
            
            <button 
              onClick={() => navigate('/register')}
              className="btn-primary"
            >
              {t.ctaArrow} <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* FAQ */}
        <section style={{
          padding: '60px 24px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)'
        }}>
          <h2 style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--muted)',
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
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
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
                  <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)', paddingRight: '12px' }}>
                    {faq.q}
                  </span>
                  {expandedFaq === i ? (
                    <ChevronUp size={18} color="var(--muted)" />
                  ) : (
                    <ChevronDown size={18} color="var(--muted)" />
                  )}
                </button>
                {expandedFaq === i && (
                  <div style={{
                    padding: '0 16px 16px',
                    fontSize: '13px',
                    color: 'var(--muted)',
                    lineHeight: '1.6'
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{
          padding: '60px 24px',
          textAlign: 'center',
          borderTop: '1px solid var(--border)'
        }}>
          <h2 style={{
            fontSize: '22px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '24px'
          }}>
            {t.finalCta}
          </h2>
          <button 
            onClick={() => navigate('/register')}
            className="btn-primary"
            style={{ marginBottom: '12px' }}
          >
            {t.ctaArrow} <ArrowRight size={18} />
          </button>
          <p style={{ fontSize: '13px', color: 'var(--muted-dark)' }}>
            {t.trial}
          </p>
        </section>

        {/* Footer spacer */}
        <div style={{ height: '40px' }} />
      </div>
    </div>
  );
};

export default LandingPage;
