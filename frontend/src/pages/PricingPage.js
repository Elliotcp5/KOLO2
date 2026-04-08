import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { usePlan, PLAN_FEATURES } from '../context/PlanContext';
import { Check, ArrowLeft, Sparkles, Crown, Zap } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Feature descriptions for each plan
const FEATURE_DESCRIPTIONS = {
  en: {
    free: [
      'Up to 30 prospects',
      '1 AI suggestion per day',
      'Prospect overview',
      'Basic task management'
    ],
    pro: [
      'Unlimited prospects',
      'Unlimited AI suggestions',
      'One-click AI SMS',
      'Interaction history',
      'Advanced budget slider',
      'AI contextual notes'
    ],
    pro_plus: [
      'Everything in PRO',
      'Heat score per prospect',
      'ROI Dashboard',
      'Weekly email report',
      'Ultra-contextual AI suggestions',
      'Behavioral alerts',
      'Dedicated support',
      'Priority access to new features'
    ]
  },
  fr: {
    free: [
      "Jusqu'à 30 prospects",
      '1 suggestion IA par jour',
      'Vue d\'ensemble des prospects',
      'Gestion des tâches basique'
    ],
    pro: [
      'Prospects illimités',
      'Suggestions IA illimitées',
      'SMS 1-clic rédigés par l\'IA',
      'Historique des interactions',
      'Slider budget avancé',
      'Notes contextuelles IA'
    ],
    pro_plus: [
      'Tout ce qui est dans PRO',
      'Score de chaleur par prospect',
      'Dashboard ROI',
      'Rapport hebdomadaire email',
      'Suggestions IA ultra-contextualisées',
      'Alertes comportementales',
      'Support dédié',
      'Accès prioritaire aux nouvelles features'
    ]
  },
  de: {
    free: [
      'Bis zu 30 Interessenten',
      '1 KI-Vorschlag pro Tag',
      'Interessentenübersicht',
      'Grundlegende Aufgabenverwaltung'
    ],
    pro: [
      'Unbegrenzte Interessenten',
      'Unbegrenzte KI-Vorschläge',
      'Ein-Klick KI-SMS',
      'Interaktionsverlauf',
      'Erweiterter Budget-Slider',
      'KI-Kontextnotizen'
    ],
    pro_plus: [
      'Alles in PRO',
      'Wärmebewertung pro Interessent',
      'ROI-Dashboard',
      'Wöchentlicher E-Mail-Bericht',
      'Ultra-kontextuelle KI-Vorschläge',
      'Verhaltensalarme',
      'Dedizierter Support',
      'Prioritätszugang zu neuen Funktionen'
    ]
  },
  it: {
    free: [
      'Fino a 30 potenziali clienti',
      '1 suggerimento IA al giorno',
      'Panoramica dei potenziali clienti',
      'Gestione attività di base'
    ],
    pro: [
      'Potenziali clienti illimitati',
      'Suggerimenti IA illimitati',
      'SMS IA con un clic',
      'Storico interazioni',
      'Slider budget avanzato',
      'Note contestuali IA'
    ],
    pro_plus: [
      'Tutto in PRO',
      'Punteggio calore per potenziale cliente',
      'Dashboard ROI',
      'Report settimanale via email',
      'Suggerimenti IA ultra-contestuali',
      'Avvisi comportamentali',
      'Supporto dedicato',
      'Accesso prioritario alle nuove funzionalità'
    ]
  }
};

export default function PricingPage() {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const { pricing, fetchPricing, planData, fetchPlanData, upgradePlan, startTrial } = usePlan();
  
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // monthly or annual
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [isInTrial, setIsInTrial] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);
  
  const isDark = theme === 'dark';
  
  // Initial load - separate from currency changes
  useEffect(() => {
    const token = localStorage.getItem('kolo_token');
    if (token) {
      fetchPlanData(token).then(data => {
        if (data) {
          setCurrentPlan(data.effective_plan || 'free');
          setIsInTrial(data.trial !== null);
          setTrialUsed(data.trial_used || false);
          // Only set currency on initial load if user has one saved
          if (data.currency) {
            setCurrency(data.currency);
            fetchPricing(data.currency);
          } else {
            fetchPricing('EUR');
          }
        }
      });
    } else {
      // Not logged in, use default EUR
      fetchPricing('EUR');
    }
  }, [fetchPricing, fetchPlanData]);
  
  const handleCurrencyChange = (newCurrency) => {
    setCurrency(newCurrency);
    fetchPricing(newCurrency);
  };
  
  const handleSelectPlan = async (plan) => {
    const token = localStorage.getItem('kolo_token');
    
    if (!token) {
      // Not logged in, redirect to register
      navigate('/register');
      return;
    }
    
    if (plan === 'free') {
      navigate('/app');
      return;
    }
    
    setLoading(true);
    
    // Check if user can start a trial (only if not already in trial, on free plan, and hasn't used trial)
    if (!isInTrial && currentPlan === 'free' && !trialUsed) {
      const result = await startTrial(plan, token);
      if (result.success) {
        setLoading(false);
        navigate('/app?trial_started=true');
        return;
      } else {
        // Show error message if trial failed (e.g., already used trial)
        if (result.error && result.error.includes('déjà utilisé')) {
          toast.error(
            locale === 'fr' ? 'Vous avez déjà utilisé votre essai gratuit. Passez directement au paiement.' :
            locale === 'de' ? 'Sie haben Ihre Testphase bereits genutzt. Fahren Sie mit der Zahlung fort.' :
            locale === 'it' ? 'Hai già utilizzato la tua prova gratuita. Procedi con il pagamento.' :
            'You have already used your free trial. Proceed to payment.'
          );
        }
        // Continue to Stripe checkout (fall through)
      }
    }
    
    // Redirect to Stripe checkout for payment
    const result = await upgradePlan(plan, billingPeriod, token);
    if (result.success && result.checkout_url) {
      window.location.href = result.checkout_url;
    } else {
      toast.error(
        locale === 'fr' ? 'Erreur lors de la création du paiement' :
        'Error creating payment session'
      );
    }
    
    setLoading(false);
  };
  
  // Direct payment without trial
  const handlePayNow = async (plan) => {
    const token = localStorage.getItem('kolo_token');
    
    if (!token) {
      navigate('/register');
      return;
    }
    
    setLoading(true);
    
    // Go directly to Stripe checkout (skip trial)
    const result = await upgradePlan(plan, billingPeriod, token);
    if (result.success && result.checkout_url) {
      window.location.href = result.checkout_url;
    } else {
      toast.error(
        locale === 'fr' ? 'Erreur lors de la création du paiement' :
        'Error creating payment session'
      );
    }
    
    setLoading(false);
  };
  
  const getPriceDisplay = (plan) => {
    if (plan === 'free') {
      // Use currency symbol based on selected currency
      const freeDisplay = currency === 'USD' ? '$0' : currency === 'GBP' ? '£0' : '0€';
      return { monthly: freeDisplay, annual: freeDisplay, annualMonthly: freeDisplay };
    }
    
    // Fallback pricing data for each currency
    const fallbackPricing = {
      pro: {
        EUR: { monthly: '9,99€', annual: '99,90€', annualMonthly: '8,33€' },
        USD: { monthly: '$10.99', annual: '$109.90', annualMonthly: '$9.16' },
        GBP: { monthly: '£8.99', annual: '£89.90', annualMonthly: '£7.49' },
      },
      pro_plus: {
        EUR: { monthly: '24,99€', annual: '249,90€', annualMonthly: '20,83€' },
        USD: { monthly: '$27.99', annual: '$279.90', annualMonthly: '$23.33' },
        GBP: { monthly: '£21.99', annual: '£219.90', annualMonthly: '£18.33' },
      }
    };
    
    if (!pricing?.plans?.[plan]) {
      const fallback = fallbackPricing[plan]?.[currency] || fallbackPricing[plan]?.EUR;
      return fallback || { monthly: '-', annual: '-', annualMonthly: '-' };
    }
    
    const p = pricing.plans[plan];
    return {
      monthly: p.display_monthly,
      annual: p.display_annual,
      annualMonthly: p.display_annual_monthly
    };
  };
  
  const features = FEATURE_DESCRIPTIONS[locale] || FEATURE_DESCRIPTIONS.en;
  
  const getButtonText = (plan) => {
    if (plan === currentPlan) {
      return locale === 'fr' ? 'Votre plan actuel' :
             locale === 'de' ? 'Ihr aktueller Plan' :
             locale === 'it' ? 'Il tuo piano attuale' :
             'Your current plan';
    }
    
    if (plan === 'free') {
      return locale === 'fr' ? 'Commencer gratuitement' :
             locale === 'de' ? 'Kostenlos starten' :
             locale === 'it' ? 'Inizia gratis' :
             'Start for free';
    }
    
    // Show "Free trial" ONLY if user hasn't used trial yet and is on free plan
    if (currentPlan === 'free' && !isInTrial && !trialUsed) {
      return locale === 'fr' ? 'Essai gratuit 14 jours' :
             locale === 'de' ? '14 Tage kostenlos testen' :
             locale === 'it' ? 'Prova gratuita 14 giorni' :
             'Free 14-day trial';
    }
    
    // Otherwise show "Choose [plan]"
    return locale === 'fr' ? `Choisir ${plan === 'pro_plus' ? 'Pro+' : 'Pro'}` :
           locale === 'de' ? `${plan === 'pro_plus' ? 'Pro+' : 'Pro'} wählen` :
           locale === 'it' ? `Scegli ${plan === 'pro_plus' ? 'Pro+' : 'Pro'}` :
           `Choose ${plan === 'pro_plus' ? 'Pro+' : 'Pro'}`;
  };
  
  return (
    <div 
      className="min-h-screen pb-8"
      style={{ 
        backgroundColor: isDark ? '#0E0B1E' : '#f7f7fa',
        paddingTop: 'env(safe-area-inset-top, 0)'
      }}
    >
      {/* Header */}
      <div 
        className="sticky z-10 px-4 py-4 flex items-center gap-4"
        style={{ 
          top: 'env(safe-area-inset-top, 0)',
          backgroundColor: isDark ? '#0E0B1E' : '#f7f7fa',
          borderBottom: `1px solid ${isDark ? '#2a2a3b' : '#e5e7eb'}`
        }}
      >
        <button 
          onClick={() => navigate(-1)}
          className="p-2 rounded-full transition-colors"
          style={{ backgroundColor: isDark ? '#2a2a3b' : '#e5e7eb' }}
        >
          <ArrowLeft size={20} color={isDark ? '#ffffff' : '#333333'} />
        </button>
        <h1 
          className="text-xl font-bold"
          style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
        >
          {locale === 'fr' ? 'Tarifs' :
           locale === 'de' ? 'Preise' :
           locale === 'it' ? 'Prezzi' :
           'Pricing'}
        </h1>
      </div>
      
      <div className="px-4 pt-6">
        {/* Currency Toggle */}
        <div className="flex justify-center gap-2 mb-4">
          {['EUR', 'USD', 'GBP'].map(c => (
            <button
              key={c}
              onClick={() => handleCurrencyChange(c)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{
                backgroundColor: currency === c 
                  ? (isDark ? '#6C63FF' : '#6C63FF')
                  : (isDark ? '#2a2a3b' : '#e5e7eb'),
                color: currency === c ? '#ffffff' : (isDark ? '#a0a4ae' : '#6b7280')
              }}
            >
              {c === 'EUR' ? '€ EUR' : c === 'USD' ? '$ USD' : '£ GBP'}
            </button>
          ))}
        </div>
        
        {/* Billing Period Toggle */}
        <div 
          className="flex justify-center mb-6 p-1 rounded-full mx-auto"
          style={{ 
            backgroundColor: isDark ? '#2a2a3b' : '#e5e7eb',
            maxWidth: '320px'
          }}
        >
          <button
            onClick={() => setBillingPeriod('monthly')}
            className="flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all"
            style={{
              backgroundColor: billingPeriod === 'monthly' 
                ? (isDark ? '#1a1a24' : '#ffffff')
                : 'transparent',
              color: billingPeriod === 'monthly' 
                ? (isDark ? '#ffffff' : '#0E0B1E')
                : (isDark ? '#a0a4ae' : '#6b7280')
            }}
          >
            {locale === 'fr' ? 'Mensuel' :
             locale === 'de' ? 'Monatlich' :
             locale === 'it' ? 'Mensile' :
             'Monthly'}
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className="flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-1"
            style={{
              backgroundColor: billingPeriod === 'annual' 
                ? (isDark ? '#1a1a24' : '#ffffff')
                : 'transparent',
              color: billingPeriod === 'annual' 
                ? (isDark ? '#ffffff' : '#0E0B1E')
                : (isDark ? '#a0a4ae' : '#6b7280')
            }}
          >
            {locale === 'fr' ? 'Annuel' :
             locale === 'de' ? 'Jährlich' :
             locale === 'it' ? 'Annuale' :
             'Annual'}
            <span 
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: '#34d399', color: '#ffffff' }}
            >
              -2
              {locale === 'fr' ? ' mois' :
               locale === 'de' ? ' Mo.' :
               locale === 'it' ? ' mesi' :
               ' mo.'}
            </span>
          </button>
        </div>
        
        {/* Plan Cards */}
        <div className="space-y-4">
          {/* Starter Plan */}
          <PlanCard
            plan="free"
            name="Starter"
            price={getPriceDisplay('free')}
            features={features.free}
            billingPeriod={billingPeriod}
            isCurrentPlan={currentPlan === 'free'}
            onSelect={() => handleSelectPlan('free')}
            buttonText={getButtonText('free')}
            isDark={isDark}
            locale={locale}
            loading={loading}
          />
          
          {/* PRO Plan */}
          <PlanCard
            plan="pro"
            name="PRO"
            price={getPriceDisplay('pro')}
            features={features.pro}
            billingPeriod={billingPeriod}
            isCurrentPlan={currentPlan === 'pro'}
            isPopular={true}
            onSelect={() => handleSelectPlan('pro')}
            onPayNow={() => handlePayNow('pro')}
            showSkipTrial={currentPlan === 'free' && !isInTrial && !trialUsed}
            buttonText={getButtonText('pro')}
            isDark={isDark}
            locale={locale}
            loading={loading}
            Icon={Zap}
          />
          
          {/* PRO+ Plan */}
          <PlanCard
            plan="pro_plus"
            name="PRO+"
            price={getPriceDisplay('pro_plus')}
            features={features.pro_plus}
            billingPeriod={billingPeriod}
            isCurrentPlan={currentPlan === 'pro_plus'}
            onSelect={() => handleSelectPlan('pro_plus')}
            onPayNow={() => handlePayNow('pro_plus')}
            showSkipTrial={currentPlan === 'free' && !isInTrial && !trialUsed}
            buttonText={getButtonText('pro_plus')}
            isDark={isDark}
            locale={locale}
            loading={loading}
            Icon={Crown}
          />
        </div>
        
        {/* Annual savings banner */}
        {billingPeriod === 'annual' && (
          <div 
            className="mt-6 p-4 rounded-2xl text-center"
            style={{ backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(52, 211, 153, 0.15)' }}
          >
            <p style={{ color: '#34d399' }}>
              {locale === 'fr' ? '✨ En annuel, vous économisez 2 mois !' :
               locale === 'de' ? '✨ Jährlich sparen Sie 2 Monate!' :
               locale === 'it' ? '✨ Con l\'annuale risparmi 2 mesi!' :
               '✨ With annual billing, you save 2 months!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({ 
  plan, 
  name, 
  price, 
  features, 
  billingPeriod,
  isCurrentPlan, 
  isPopular,
  onSelect,
  onPayNow,
  showSkipTrial,
  buttonText,
  isDark,
  locale,
  loading,
  Icon
}) {
  const displayPrice = billingPeriod === 'annual' ? price.annualMonthly : price.monthly;
  const totalPrice = billingPeriod === 'annual' ? price.annual : price.monthly;
  
  return (
    <div 
      className="rounded-3xl p-5 transition-all"
      style={{
        backgroundColor: isDark ? '#1a1a24' : '#ffffff',
        border: isPopular 
          ? '2px solid #6C63FF' 
          : `1px solid ${isDark ? '#2a2a3b' : '#e5e7eb'}`,
        opacity: isCurrentPlan ? 0.7 : 1
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          {Icon && (
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #9333EA)' }}
            >
              <Icon size={16} color="white" />
            </div>
          )}
          <span 
            className="text-lg font-bold"
            style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
          >
            {name}
          </span>
          {isPopular && (
            <span 
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#6C63FF', color: 'white' }}
            >
              {locale === 'fr' ? 'Populaire' : 'Popular'}
            </span>
          )}
        </div>
        
        <div className="text-right">
          <span 
            className="text-2xl font-bold"
            style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
          >
            {displayPrice}
          </span>
          <span 
            className="text-sm"
            style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
          >
            /{locale === 'fr' ? 'mois' : locale === 'de' ? 'Monat' : locale === 'it' ? 'mese' : 'month'}
          </span>
          {billingPeriod === 'annual' && plan !== 'free' && (
            <p 
              className="text-xs"
              style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
            >
              {locale === 'fr' ? `soit ${totalPrice}/an` :
               locale === 'de' ? `d.h. ${totalPrice}/Jahr` :
               locale === 'it' ? `cioè ${totalPrice}/anno` :
               `i.e. ${totalPrice}/year`}
            </p>
          )}
        </div>
      </div>
      
      {/* Features */}
      <ul className="space-y-2 mb-5">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <Check 
              size={18} 
              className="mt-0.5 flex-shrink-0"
              style={{ color: '#34d399' }}
            />
            <span 
              className="text-sm"
              style={{ color: isDark ? '#d1d5db' : '#4b5563' }}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>
      
      {/* CTA Button */}
      <button
        onClick={onSelect}
        disabled={isCurrentPlan || loading}
        className="w-full py-3 rounded-full font-semibold transition-all"
        style={{
          background: isCurrentPlan 
            ? (isDark ? '#2a2a3b' : '#e5e7eb')
            : 'linear-gradient(135deg, #4F46E5, #9333EA)',
          color: isCurrentPlan 
            ? (isDark ? '#a0a4ae' : '#6b7280')
            : '#ffffff',
          cursor: isCurrentPlan ? 'default' : 'pointer',
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? '...' : buttonText}
      </button>
      
      {/* Skip trial link - only show when trial is available */}
      {showSkipTrial && (
        <p 
          className="text-center mt-2"
          style={{ fontSize: '12px', color: isDark ? '#6b7280' : '#9ca3af' }}
        >
          <span 
            onClick={onPayNow}
            style={{ 
              cursor: 'pointer', 
              textDecoration: 'underline',
              opacity: 0.8
            }}
            onMouseOver={(e) => e.target.style.opacity = 1}
            onMouseOut={(e) => e.target.style.opacity = 0.8}
          >
            {locale === 'fr' ? 'ou payer maintenant' :
             locale === 'de' ? 'oder jetzt bezahlen' :
             locale === 'it' ? 'o paga ora' :
             'or pay now'}
          </span>
        </p>
      )}
    </div>
  );
}
