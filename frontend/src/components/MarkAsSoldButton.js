import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { usePlan } from '../context/PlanContext';
import { PaywallBottomSheet } from './PaywallBottomSheet';
import { Award, Euro, X, PartyPopper, Lock } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Labels
const LABELS = {
  en: {
    markAsSold: 'Mark as Sold',
    congratulations: 'Congratulations!',
    saleCompleted: 'Another deal closed!',
    commissionAmount: 'Commission amount',
    commissionPlaceholder: 'Enter commission in €',
    confirm: 'Confirm Sale',
    cancel: 'Cancel',
    proPlus: 'PRO+',
    successMessage: 'Sale recorded successfully!'
  },
  fr: {
    markAsSold: 'Marquer comme vendu',
    congratulations: 'Félicitations !',
    saleCompleted: 'Une vente de plus !',
    commissionAmount: 'Montant de la commission',
    commissionPlaceholder: 'Entrez la commission en €',
    confirm: 'Confirmer la vente',
    cancel: 'Annuler',
    proPlus: 'PRO+',
    successMessage: 'Vente enregistrée avec succès !'
  },
  de: {
    markAsSold: 'Als verkauft markieren',
    congratulations: 'Herzlichen Glückwunsch!',
    saleCompleted: 'Ein weiterer Abschluss!',
    commissionAmount: 'Provisionsbetrag',
    commissionPlaceholder: 'Provision in € eingeben',
    confirm: 'Verkauf bestätigen',
    cancel: 'Abbrechen',
    proPlus: 'PRO+',
    successMessage: 'Verkauf erfolgreich erfasst!'
  },
  it: {
    markAsSold: 'Segna come venduto',
    congratulations: 'Congratulazioni!',
    saleCompleted: 'Un\'altra vendita!',
    commissionAmount: 'Importo commissione',
    commissionPlaceholder: 'Inserisci la commissione in €',
    confirm: 'Conferma vendita',
    cancel: 'Annulla',
    proPlus: 'PRO+',
    successMessage: 'Vendita registrata con successo!'
  }
};

export function MarkAsSoldButton({
  prospect,
  onSuccess,
  variant = 'default', // 'default', 'compact'
  className = ''
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const { checkFeature, planData } = usePlan();
  
  const isDark = theme === 'dark';
  const labels = LABELS[locale] || LABELS.en;
  
  const [isOpen, setIsOpen] = useState(false);
  const [commission, setCommission] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Check if ROI dashboard is available (PRO+ feature - required to track commissions)
  const hasROI = checkFeature('roi_dashboard');
  
  const handleClick = () => {
    if (!hasROI) {
      setShowPaywall(true);
      return;
    }
    setIsOpen(true);
  };
  
  const handleSubmit = async () => {
    const commissionAmount = parseInt(commission, 10);
    
    if (isNaN(commissionAmount) || commissionAmount <= 0) {
      toast.error(locale === 'fr' ? 'Veuillez entrer un montant valide' : 'Please enter a valid amount');
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('session_token');
      
      const response = await fetch(`${API_URL}/api/prospects/${prospect.prospect_id}/mark-sold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          commission_amount: commissionAmount
        })
      });
      
      if (response.ok) {
        setShowConfetti(true);
        toast.success(labels.successMessage);
        
        // Wait for confetti animation
        setTimeout(() => {
          setIsOpen(false);
          setShowConfetti(false);
          setCommission('');
          onSuccess?.();
        }, 2000);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error recording sale');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpgrade = () => {
    setShowPaywall(false);
    window.location.href = '/pricing';
  };
  
  // Already sold - show badge instead
  if (prospect?.status === 'closed_won') {
    return (
      <div 
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
        style={{
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          color: '#22c55e'
        }}
      >
        <Award size={14} />
        {prospect.commission_amount ? `${prospect.commission_amount}€` : 'Vendu'}
      </div>
    );
  }
  
  // Render button
  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 transition-all ${className}`}
        style={{
          ...(variant === 'compact' ? {
            padding: '6px 12px',
            borderRadius: '9999px',
            fontSize: '14px',
            backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
            color: '#22c55e'
          } : {
            padding: '10px 16px',
            borderRadius: '12px',
            fontWeight: '500',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#ffffff'
          })
        }}
      >
        {!hasROI && <Lock size={14} />}
        <Award size={variant === 'compact' ? 14 : 16} />
        {variant !== 'compact' && labels.markAsSold}
        {!hasROI && (
          <span 
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: '#9333EA', color: 'white' }}
          >
            {labels.proPlus}
          </span>
        )}
      </button>
      
      {/* Modal */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => !loading && setIsOpen(false)}
          />
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
            
            {showConfetti ? (
              // Confetti/Success state
              <div className="px-6 py-8 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h3 
                  className="text-xl font-bold mb-2"
                  style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                >
                  {labels.congratulations}
                </h3>
                <p style={{ color: '#22c55e', fontWeight: '500' }}>
                  {labels.saleCompleted}
                </p>
                <p 
                  className="text-3xl font-bold mt-4"
                  style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                >
                  +{commission}€
                </p>
              </div>
            ) : (
              // Form state
              <div className="px-6 pb-6">
                {/* Close button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute top-4 right-4 p-2 rounded-full"
                  style={{ backgroundColor: isDark ? '#2a2a3b' : '#f0f0f0' }}
                >
                  <X size={18} style={{ color: isDark ? '#ffffff' : '#333333' }} />
                </button>
                
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                  >
                    <Award size={24} color="white" />
                  </div>
                  <div>
                    <h3 
                      className="font-bold"
                      style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                    >
                      {labels.markAsSold}
                    </h3>
                    <p 
                      className="text-sm"
                      style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
                    >
                      {prospect?.full_name}
                    </p>
                  </div>
                </div>
                
                {/* Commission input */}
                <div className="mb-6">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
                  >
                    {labels.commissionAmount}
                  </label>
                  <div 
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
                  >
                    <Euro size={20} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                    <input
                      type="number"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      placeholder={labels.commissionPlaceholder}
                      className="flex-1 bg-transparent outline-none text-lg"
                      style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                      min="1"
                      autoFocus
                    />
                    <span 
                      className="text-lg font-medium"
                      style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
                    >
                      €
                    </span>
                  </div>
                </div>
                
                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    disabled={loading}
                    className="flex-1 py-3 rounded-full font-medium"
                    style={{
                      backgroundColor: isDark ? '#2a2a3b' : '#e5e7eb',
                      color: isDark ? '#a0a4ae' : '#6b7280'
                    }}
                  >
                    {labels.cancel}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !commission}
                    className="flex-1 py-3 rounded-full font-medium text-white flex items-center justify-center gap-2"
                    style={{
                      background: commission ? 'linear-gradient(135deg, #22c55e, #16a34a)' : (isDark ? '#2a2a3b' : '#e5e7eb'),
                      color: commission ? '#ffffff' : (isDark ? '#6b7280' : '#9ca3af'),
                      opacity: loading ? 0.7 : 1
                    }}
                  >
                    {loading ? '...' : (
                      <>
                        <PartyPopper size={18} />
                        {labels.confirm}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Paywall */}
      <PaywallBottomSheet
        feature="roi_dashboard"
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        onUpgrade={handleUpgrade}
        currentPlan={planData?.effective_plan || 'free'}
      />
      
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

export default MarkAsSoldButton;
