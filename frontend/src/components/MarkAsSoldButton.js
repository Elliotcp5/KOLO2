import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { triggerUpgradeFlow } from '../utils/iosCompliance';
import { usePlan } from '../context/PlanContext';
import { PaywallBottomSheet } from './PaywallBottomSheet';
import { Award, Euro, X, PartyPopper, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../config/api';

// Labels
const LABELS = {
  en: {
    markAsSold: 'Mark as Sold',
    congratulations: 'Congratulations!',
    saleCompleted: 'Another deal closed!',
    initialCommission: 'Initial commission (expected)',
    finalCommission: 'Final commission (actual)',
    commissionPlaceholder: 'Enter amount in €',
    confirm: 'Confirm Sale',
    cancel: 'Cancel',
    proPlus: 'PRO+',
    successMessage: 'Sale recorded successfully!',
  },
  fr: {
    markAsSold: 'Marquer comme vendu',
    congratulations: 'Félicitations !',
    saleCompleted: 'Une vente de plus !',
    initialCommission: 'Commission initiale (prévue)',
    finalCommission: 'Commission réelle (perçue)',
    commissionPlaceholder: 'Entrez le montant en €',
    confirm: 'Confirmer la vente',
    cancel: 'Annuler',
    proPlus: 'PRO+',
    successMessage: 'Vente enregistrée avec succès !',
  },
  de: {
    markAsSold: 'Als verkauft markieren',
    congratulations: 'Herzlichen Glückwunsch!',
    saleCompleted: 'Ein weiterer Abschluss!',
    initialCommission: 'Erwartete Provision',
    finalCommission: 'Tatsächliche Provision',
    commissionPlaceholder: 'Betrag in € eingeben',
    confirm: 'Verkauf bestätigen',
    cancel: 'Abbrechen',
    proPlus: 'PRO+',
    successMessage: 'Verkauf erfolgreich erfasst!',
  },
  it: {
    markAsSold: 'Segna come venduto',
    congratulations: 'Congratulazioni!',
    saleCompleted: "Un'altra vendita!",
    initialCommission: 'Commissione iniziale (prevista)',
    finalCommission: 'Commissione finale (incassata)',
    commissionPlaceholder: 'Inserisci importo in €',
    confirm: 'Conferma vendita',
    cancel: 'Annulla',
    proPlus: 'PRO+',
    successMessage: 'Vendita registrata con successo!',
  },
};

export function MarkAsSoldButton({
  prospect,
  onSuccess,
  variant = 'default', // 'default', 'compact'
  className = '',
  forceOpen = false,
  onModalClose,
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const { planData } = usePlan();

  const isDark = theme === 'dark';
  const labels = LABELS[locale] || LABELS.en;

  const [isOpen, setIsOpen] = useState(false);
  const [commissionInitial, setCommissionInitial] = useState('');
  const [commissionFinal, setCommissionFinal] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const hasROI = planData?.features?.roi_dashboard ?? false;

  // Allow parent to drive opening (e.g. from a status change)
  const open = isOpen || forceOpen;
  const close = () => {
    setIsOpen(false);
    if (onModalClose) onModalClose();
  };

  const handleClick = () => {
    if (!hasROI) {
      setShowPaywall(true);
      return;
    }
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    const initial = parseInt(commissionInitial, 10);
    const final = parseInt(commissionFinal, 10);

    if (isNaN(final) || final <= 0) {
      toast.error(locale === 'fr' ? 'Veuillez entrer une commission réelle valide' : 'Please enter a valid final commission');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('kolo_token');

      const response = await fetch(`${API_URL}/api/prospects/${prospect.prospect_id}/mark-sold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          commission_initial: isNaN(initial) ? final : initial,
          commission_final: final,
          commission_amount: final, // legacy fallback
        }),
      });

      if (response.ok) {
        setShowConfetti(true);
        toast.success(labels.successMessage);

        setTimeout(() => {
          close();
          setShowConfetti(false);
          setCommissionInitial('');
          setCommissionFinal('');
          onSuccess?.();
        }, 2000);
      } else {
        const error = await response.json().catch(() => ({}));
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
    triggerUpgradeFlow();
  };

  // Already sold - show badge instead
  if (prospect?.status === 'closed_won' && !open) {
    const display = prospect.commission_final || prospect.commission_amount;
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
        style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
        data-testid="prospect-sold-badge"
      >
        <Award size={14} />
        {display ? `${display}€` : 'Vendu'}
      </div>
    );
  }

  return (
    <>
      {variant !== 'hidden' && (
        <button
          onClick={handleClick}
          data-testid="mark-as-sold-btn"
          className={`flex items-center gap-2 transition-all ${className}`}
          style={{
            ...(variant === 'compact'
              ? {
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  fontSize: '14px',
                  backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
                  color: '#22c55e',
                }
              : {
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontWeight: '500',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#ffffff',
                }),
          }}
        >
          {!hasROI && <Lock size={14} />}
          <Award size={variant === 'compact' ? 14 : 16} />
          {variant !== 'compact' && labels.markAsSold}
          {!hasROI && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#9333EA', color: 'white' }}>
              {labels.proPlus}
            </span>
          )}
        </button>
      )}

      {/* Modal */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => !loading && close()} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
            style={{
              backgroundColor: isDark ? '#1a1a24' : '#ffffff',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
              paddingBottom: 'env(safe-area-inset-bottom, 20px)',
            }}
            data-testid="commission-modal"
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: isDark ? '#4a4a5a' : '#e0e0e0' }} />
            </div>

            {showConfetti ? (
              <div className="px-6 py-8 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-xl font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}>
                  {labels.congratulations}
                </h3>
                <p style={{ color: '#22c55e', fontWeight: '500' }}>{labels.saleCompleted}</p>
                <p className="text-3xl font-bold mt-4" style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}>
                  +{commissionFinal}€
                </p>
              </div>
            ) : (
              <div className="px-6 pb-6">
                <button
                  onClick={close}
                  className="absolute top-4 right-4 p-2 rounded-full"
                  style={{ backgroundColor: isDark ? '#2a2a3b' : '#f0f0f0' }}
                  data-testid="commission-modal-close"
                >
                  <X size={18} style={{ color: isDark ? '#ffffff' : '#333333' }} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                  >
                    <Award size={24} color="white" />
                  </div>
                  <div>
                    <h3 className="font-bold" style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}>
                      {labels.markAsSold}
                    </h3>
                    <p className="text-sm" style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>
                      {prospect?.full_name}
                    </p>
                  </div>
                </div>

                {/* Commission initiale */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>
                    {labels.initialCommission}
                  </label>
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
                  >
                    <Euro size={20} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                    <input
                      type="number"
                      value={commissionInitial}
                      onChange={(e) => setCommissionInitial(e.target.value)}
                      placeholder={labels.commissionPlaceholder}
                      className="flex-1 bg-transparent outline-none text-lg"
                      style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                      min="0"
                      data-testid="commission-initial-input"
                    />
                    <span className="text-lg font-medium" style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>€</span>
                  </div>
                </div>

                {/* Commission réelle */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>
                    {labels.finalCommission}
                  </label>
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
                  >
                    <Euro size={20} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                    <input
                      type="number"
                      value={commissionFinal}
                      onChange={(e) => setCommissionFinal(e.target.value)}
                      placeholder={labels.commissionPlaceholder}
                      className="flex-1 bg-transparent outline-none text-lg"
                      style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                      min="1"
                      autoFocus
                      data-testid="commission-final-input"
                    />
                    <span className="text-lg font-medium" style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>€</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={close}
                    disabled={loading}
                    className="flex-1 py-3 rounded-full font-medium"
                    style={{
                      backgroundColor: isDark ? '#2a2a3b' : '#e5e7eb',
                      color: isDark ? '#a0a4ae' : '#6b7280',
                    }}
                  >
                    {labels.cancel}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !commissionFinal}
                    data-testid="commission-confirm-btn"
                    className="flex-1 py-3 rounded-full font-medium text-white flex items-center justify-center gap-2"
                    style={{
                      background: commissionFinal ? 'linear-gradient(135deg, #22c55e, #16a34a)' : isDark ? '#2a2a3b' : '#e5e7eb',
                      color: commissionFinal ? '#ffffff' : isDark ? '#6b7280' : '#9ca3af',
                      opacity: loading ? 0.7 : 1,
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
