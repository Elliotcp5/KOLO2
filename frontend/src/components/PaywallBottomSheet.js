import React from 'react';
import { useLocale } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { PAYWALL_MESSAGES } from '../context/PlanContext';
import { Lock, X, Sparkles, TrendingUp, MessageSquare, Users, BarChart3 } from 'lucide-react';

// Feature icons mapping
const FEATURE_ICONS = {
  heat_score: TrendingUp,
  sms_one_click: MessageSquare,
  roi_dashboard: BarChart3,
  ai_suggestions_limit: Sparkles,
  prospects_limit: Users,
  interaction_history: Users,
  budget_slider: BarChart3
};

export function PaywallBottomSheet({ 
  feature, 
  isOpen, 
  onClose, 
  onUpgrade,
  currentPlan = 'free'
}) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  
  if (!isOpen || !feature) return null;
  
  const message = PAYWALL_MESSAGES[feature];
  if (!message) return null;
  
  const FeatureIcon = FEATURE_ICONS[feature] || Lock;
  const requiredPlan = message.required_plan;
  const planDisplayName = requiredPlan === 'pro_plus' ? 'PRO+' : 'PRO';
  
  // Get localized message
  const localizedMessage = message[locale] || message.en;
  
  // Plan prices (will be fetched from context in real implementation)
  const planPrice = requiredPlan === 'pro_plus' ? '24,99€' : '9,99€';
  
  const isDark = theme === 'dark';
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
        style={{
          backgroundColor: isDark ? '#1a1a24' : '#ffffff',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)'
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div 
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: isDark ? '#4a4a5a' : '#e0e0e0' }}
          />
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full transition-colors"
          style={{ 
            backgroundColor: isDark ? '#2a2a3b' : '#f0f0f0',
            color: isDark ? '#ffffff' : '#333333'
          }}
        >
          <X size={20} />
        </button>
        
        {/* Content */}
        <div className="px-6 pb-6 pt-2">
          {/* Icon */}
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'linear-gradient(135deg, #6C63FF, #9333EA)',
            }}
          >
            <FeatureIcon size={32} color="white" />
          </div>
          
          {/* Title */}
          <h3 
            className="text-xl font-bold text-center mb-2"
            style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
          >
            {locale === 'fr' ? 'Fonctionnalité Premium' : 
             locale === 'de' ? 'Premium-Funktion' :
             locale === 'it' ? 'Funzionalità Premium' : 
             'Premium Feature'}
          </h3>
          
          {/* Description */}
          <p 
            className="text-center mb-6"
            style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
          >
            {localizedMessage}
          </p>
          
          {/* Plan badge */}
          <div 
            className="text-center mb-4 text-sm"
            style={{ color: isDark ? '#a78bfa' : '#6C63FF' }}
          >
            {locale === 'fr' ? `Disponible en ${planDisplayName}` :
             locale === 'de' ? `Verfügbar in ${planDisplayName}` :
             locale === 'it' ? `Disponibile in ${planDisplayName}` :
             `Available in ${planDisplayName}`}
          </div>
          
          {/* CTA Button */}
          <button
            onClick={() => onUpgrade(requiredPlan)}
            className="w-full py-4 rounded-full font-semibold text-white transition-transform active:scale-98"
            style={{
              background: 'linear-gradient(135deg, #4F46E5, #9333EA)',
              fontSize: '16px'
            }}
          >
            {locale === 'fr' ? `Passer en ${planDisplayName} — ${planPrice}/mois` :
             locale === 'de' ? `Zu ${planDisplayName} wechseln — ${planPrice}/Monat` :
             locale === 'it' ? `Passa a ${planDisplayName} — ${planPrice}/mese` :
             `Upgrade to ${planDisplayName} — ${planPrice}/month`}
          </button>
          
          {/* View all plans link */}
          <button
            onClick={onClose}
            className="w-full mt-3 py-2 text-center text-sm transition-colors"
            style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
          >
            {locale === 'fr' ? 'Voir tous les plans' :
             locale === 'de' ? 'Alle Pläne anzeigen' :
             locale === 'it' ? 'Vedi tutti i piani' :
             'View all plans'}
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

// Trial Expiration Modal (Full screen, non-dismissable)
export function TrialExpiredModal({ 
  isOpen, 
  onSelectPlan,
  onContinueFree,
  pricing
}) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  
  if (!isOpen) return null;
  
  const isDark = theme === 'dark';
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: isDark ? '#0E0B1E' : '#f7f7fa' }}
    >
      <div 
        className="w-full max-w-lg rounded-3xl p-6"
        style={{
          backgroundColor: isDark ? '#1a1a24' : '#ffffff',
          boxShadow: '0 4px 30px rgba(0,0,0,0.2)'
        }}
      >
        {/* Title */}
        <h2 
          className="text-2xl font-bold text-center mb-2"
          style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
        >
          {locale === 'fr' ? 'Votre essai est terminé' :
           locale === 'de' ? 'Ihre Testversion ist abgelaufen' :
           locale === 'it' ? 'Il tuo periodo di prova è terminato' :
           'Your trial has ended'}
        </h2>
        
        <p 
          className="text-center mb-6"
          style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
        >
          {locale === 'fr' ? 'Continuez sans perdre vos données.' :
           locale === 'de' ? 'Machen Sie weiter, ohne Ihre Daten zu verlieren.' :
           locale === 'it' ? 'Continua senza perdere i tuoi dati.' :
           'Continue without losing your data.'}
        </p>
        
        {/* Plan Cards */}
        <div className="space-y-3 mb-4">
          {/* PRO Card */}
          <div 
            className="p-4 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa',
              borderColor: '#6C63FF'
            }}
            onClick={() => onSelectPlan('pro', 'monthly')}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}>PRO</span>
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: '#6C63FF', color: 'white' }}
                  >
                    {locale === 'fr' ? 'Populaire' : 'Popular'}
                  </span>
                </div>
                <p className="text-sm" style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>
                  {locale === 'fr' ? 'Prospects illimités + SMS IA' : 'Unlimited prospects + AI SMS'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold" style={{ color: '#6C63FF' }}>9,99€</span>
                <span className="text-sm" style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>/mois</span>
              </div>
            </div>
          </div>
          
          {/* PRO+ Card */}
          <div 
            className="p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa',
              borderColor: isDark ? '#4a4a5a' : '#e0e0e0'
            }}
            onClick={() => onSelectPlan('pro_plus', 'monthly')}
          >
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}>PRO+</span>
                <p className="text-sm" style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>
                  {locale === 'fr' ? 'Score de chaleur + Dashboard ROI' : 'Heat score + ROI Dashboard'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold" style={{ color: isDark ? '#a78bfa' : '#9333EA' }}>24,99€</span>
                <span className="text-sm" style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>/mois</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Continue free link */}
        <button
          onClick={onContinueFree}
          className="w-full text-center py-2 text-sm transition-colors"
          style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
        >
          {locale === 'fr' ? 'Continuer en version gratuite' :
           locale === 'de' ? 'Mit der kostenlosen Version fortfahren' :
           locale === 'it' ? 'Continua con la versione gratuita' :
           'Continue with free version'}
        </button>
      </div>
    </div>
  );
}

export default PaywallBottomSheet;
