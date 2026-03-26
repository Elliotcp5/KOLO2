// v3.0.0 - KOLO Landing Page - Redesigned
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Bell, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

// Language options - format 2 letters
const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, formatPrice, locale, changeLanguage } = useLocale();
  const [expandedCard, setExpandedCard] = useState(null);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const currentLang = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

  // Feature cards
  const features = [
    {
      id: 'feature1',
      icon: Calendar,
      title: locale === 'fr' ? 'Tâches du Jour' : "Today's Tasks",
      description: locale === 'fr' ? 'Sachez exactement qui contacter aujourd\'hui.' : 'Know exactly who to contact today.',
    },
    {
      id: 'feature2',
      icon: Bell,
      title: locale === 'fr' ? 'Rappels Intelligents' : 'Smart Reminders',
      description: locale === 'fr' ? 'Soyez alerté au bon moment.' : 'Get notified at the right time.',
    },
    {
      id: 'feature3',
      icon: Sparkles,
      title: locale === 'fr' ? 'Relances Pilotées par IA' : 'AI-Powered Follow-ups',
      description: locale === 'fr' ? 'Rédigez vos messages en 1 clic.' : 'Write messages in 1 click.',
    },
  ];

  return (
    <div className="mobile-frame" style={{ background: 'var(--bg)' }}>
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        padding: 'max(16px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom))'
      }}>
        
        {/* Simplified Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px'
        }}>
          {/* Logo */}
          <div style={{ 
            fontFamily: 'var(--font-heading)', 
            fontSize: '24px', 
            fontWeight: '800',
            color: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            KOLO
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--grad)',
              marginBottom: '10px'
            }}></span>
          </div>

          {/* Right side: Language + Login + CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Language Selector - 2 letters format */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowLangMenu(!showLangMenu)}
                style={{
                  background: 'var(--bg-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: 'var(--ink-mid)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                data-testid="lang-selector"
              >
                {currentLang.label}
                <ChevronDown size={12} />
              </button>
              
              {/* Language dropdown */}
              {showLangMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-md)',
                  minWidth: '60px',
                  zIndex: 100
                }}>
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        changeLanguage(lang.code);
                        setShowLangMenu(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 14px',
                        background: locale === lang.code ? 'rgba(0, 74, 173, 0.1)' : 'transparent',
                        border: 'none',
                        color: locale === lang.code ? 'var(--blue)' : 'var(--ink-mid)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '700',
                        textAlign: 'center'
                      }}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Login link */}
            <button 
              onClick={() => navigate('/login')}
              data-testid="login-link"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-mid)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {locale === 'fr' ? 'Connexion' : 'Login'}
            </button>

            {/* CTA Button - small version */}
            <button 
              onClick={() => navigate('/register')}
              data-testid="header-cta"
              style={{
                background: 'var(--grad)',
                color: '#fff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {locale === 'fr' ? 'Essayer gratuitement' : 'Try for free'}
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {/* Main headline */}
          <h1 style={{ 
            fontFamily: 'var(--font-heading)',
            fontSize: '32px', 
            fontWeight: '800',
            color: 'var(--ink)',
            lineHeight: '1.2',
            marginBottom: '12px'
          }}>
            {locale === 'fr' ? 'Ne manquez plus jamais une vente !' : 'Never miss a sale again!'}
          </h1>

          {/* Subheadline */}
          <p style={{ 
            fontSize: '16px', 
            color: 'var(--ink-mid)',
            lineHeight: '1.5',
            marginBottom: '8px'
          }}>
            {locale === 'fr' ? 'Concluez plus d\'affaires. Automatiquement.' : 'Close more deals. Automatically.'}
          </p>
        </div>

        {/* Feature cards - clickable */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          marginBottom: '40px'
        }}>
          {features.map((feature) => (
            <div
              key={feature.id}
              onClick={() => setExpandedCard(expandedCard === feature.id ? null : feature.id)}
              data-testid={feature.id}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '16px 18px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: expandedCard === feature.id ? 'var(--shadow-md)' : 'var(--shadow-sm)'
              }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px' 
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--grad)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <feature.icon size={20} style={{ color: '#fff' }} strokeWidth={1.5} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ 
                    fontFamily: 'var(--font-heading)',
                    fontSize: '15px', 
                    fontWeight: '700',
                    color: 'var(--ink)',
                    marginBottom: '2px'
                  }}>
                    {feature.title}
                  </h3>
                  <p style={{ 
                    fontSize: '13px', 
                    color: 'var(--ink-soft)',
                    margin: 0
                  }}>
                    {feature.description}
                  </p>
                </div>
                <ChevronDown 
                  size={18} 
                  style={{ 
                    color: 'var(--ink-soft)',
                    transform: expandedCard === feature.id ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }} 
                />
              </div>
            </div>
          ))}
        </div>

        {/* Spacer to push pricing to bottom */}
        <div style={{ flex: 1 }}></div>

        {/* Pricing and CTA - Bottom */}
        <div style={{ textAlign: 'center' }}>
          {/* Price tagline */}
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--ink-mid)',
            marginBottom: '16px',
            fontWeight: '500'
          }}>
            {locale === 'fr' ? 'Un prix. Zéro surprise.' : 'One price. Zero surprises.'}
          </p>

          {/* Main CTA Button */}
          <button 
            className="btn-primary"
            onClick={() => navigate('/register')}
            data-testid="start-button"
            style={{ 
              width: '100%',
              padding: '16px 24px',
              marginBottom: '12px',
              fontSize: '16px'
            }}
          >
            {locale === 'fr' ? 'Essayer gratuitement' : 'Try for free'}
            <ArrowRight size={20} strokeWidth={2} />
          </button>

          {/* Micro text */}
          <p style={{ 
            fontSize: '13px', 
            color: 'var(--ink-soft)',
            marginBottom: '24px'
          }}>
            {locale === 'fr' 
              ? '7 jours gratuits, sans carte bancaire'
              : '7 days free, no credit card required'
            }
          </p>

          {/* Made by tagline */}
          <p style={{ 
            fontSize: '11px', 
            color: 'var(--ink-soft)',
            fontStyle: 'italic'
          }}>
            {locale === 'fr' 
              ? 'Fait par des agents immobiliers pour des agents immobiliers'
              : 'Made by real estate agents for real estate agents'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
