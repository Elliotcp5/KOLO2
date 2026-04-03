import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { usePlan } from '../context/PlanContext';
import { PaywallBottomSheet } from './PaywallBottomSheet';
import { ProBadge } from './ProBadge';
import { TrendingUp, Euro, Award, Lock, ChevronRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Labels
const LABELS = {
  en: {
    roiDashboard: 'ROI Dashboard',
    caThisMonth: 'Revenue this month',
    salesCount: 'Sales',
    avgCommission: 'Avg. commission',
    roiMultiplier: 'ROI multiplier',
    proPlus: 'PRO+',
    noTasks: 'No tasks for today!',
    viewDetails: 'View details',
    loading: 'Loading...'
  },
  fr: {
    roiDashboard: 'Dashboard ROI',
    caThisMonth: 'CA ce mois',
    salesCount: 'Ventes',
    avgCommission: 'Commission moy.',
    roiMultiplier: 'Multiplicateur ROI',
    proPlus: 'PRO+',
    noTasks: 'Aucune tâche pour aujourd\'hui !',
    viewDetails: 'Voir les détails',
    loading: 'Chargement...'
  },
  de: {
    roiDashboard: 'ROI-Dashboard',
    caThisMonth: 'Umsatz diesen Monat',
    salesCount: 'Verkäufe',
    avgCommission: 'Durchschn. Provision',
    roiMultiplier: 'ROI-Multiplikator',
    proPlus: 'PRO+',
    noTasks: 'Keine Aufgaben für heute!',
    viewDetails: 'Details anzeigen',
    loading: 'Laden...'
  },
  it: {
    roiDashboard: 'Dashboard ROI',
    caThisMonth: 'Fatturato questo mese',
    salesCount: 'Vendite',
    avgCommission: 'Commissione media',
    roiMultiplier: 'Moltiplicatore ROI',
    proPlus: 'PRO+',
    noTasks: 'Nessuna attività per oggi!',
    viewDetails: 'Vedi dettagli',
    loading: 'Caricamento...'
  }
};

export function ROIDashboard({
  showWhenNoTasks = false, // Show instead of empty state
  compact = false,
  onUpgrade = null
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const { checkFeature, planData } = usePlan();
  
  const isDark = theme === 'dark';
  const labels = LABELS[locale] || LABELS.en;
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  
  // Check if ROI dashboard is available (PRO+ feature)
  // Use planData directly to ensure re-render when it changes
  const hasROI = planData?.features?.roi_dashboard ?? false;
  
  useEffect(() => {
    if (hasROI) {
      fetchROIData();
    } else {
      setLoading(false);
    }
  }, [hasROI]);
  
  const fetchROIData = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/api/dashboard/roi`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch ROI data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M€`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}k€`;
    }
    return `${amount}€`;
  };
  
  const handleLockedClick = () => {
    if (onUpgrade) {
      onUpgrade('roi_dashboard');
    } else {
      setShowPaywall(true);
    }
  };
  
  const handleUpgrade = () => {
    setShowPaywall(false);
    window.location.href = '/pricing';
  };
  
  // Locked state for non-PRO+ users
  if (!hasROI) {
    if (compact) {
      return (
        <button
          onClick={handleLockedClick}
          className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all opacity-70 hover:opacity-100"
          style={{
            backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa',
            border: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`
          }}
        >
          <span style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>
            {labels.roiDashboard}
          </span>
          <ProBadge plan="pro_plus" size="small" />
          
          <PaywallBottomSheet
            feature="roi_dashboard"
            isOpen={showPaywall}
            onClose={() => setShowPaywall(false)}
            onUpgrade={handleUpgrade}
            currentPlan={planData?.effective_plan || 'free'}
          />
        </button>
      );
    }
    
    return (
      <div 
        className="p-5 rounded-2xl"
        style={{ 
          backgroundColor: isDark ? '#1a1a24' : '#ffffff',
          border: `1px solid ${isDark ? '#2a2a3b' : '#e5e7eb'}`
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
            <span 
              className="font-medium"
              style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
            >
              {labels.roiDashboard}
            </span>
          </div>
          <ProBadge plan="pro_plus" size="medium" />
        </div>
        
        <button
          onClick={handleLockedClick}
          className="w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          style={{
            backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa',
            color: isDark ? '#a0a4ae' : '#6b7280'
          }}
        >
          <Lock size={18} />
          {locale === 'fr' ? 'Débloquer le Dashboard ROI' :
           locale === 'de' ? 'ROI-Dashboard freischalten' :
           locale === 'it' ? 'Sblocca Dashboard ROI' :
           'Unlock ROI Dashboard'}
        </button>
        
        <PaywallBottomSheet
          feature="roi_dashboard"
          isOpen={showPaywall}
          onClose={() => setShowPaywall(false)}
          onUpgrade={handleUpgrade}
          currentPlan={planData?.effective_plan || 'free'}
        />
      </div>
    );
  }
  
  // Loading state
  if (loading) {
    return (
      <div 
        className="p-5 rounded-2xl animate-pulse"
        style={{ 
          backgroundColor: isDark ? '#1a1a24' : '#ffffff',
          border: `1px solid ${isDark ? '#2a2a3b' : '#e5e7eb'}`
        }}
      >
        <div className="h-6 w-32 rounded mb-4" style={{ backgroundColor: isDark ? '#2a2a3b' : '#e5e7eb' }} />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 rounded-xl" style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }} />
          <div className="h-20 rounded-xl" style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }} />
        </div>
      </div>
    );
  }
  
  // Compact view
  if (compact) {
    return (
      <div 
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ 
          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15), rgba(79, 70, 229, 0.15))',
          border: '1px solid rgba(147, 51, 234, 0.3)'
        }}
      >
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #9333EA, #4F46E5)' }}
        >
          <Euro size={20} color="white" />
        </div>
        <div className="flex-1">
          <p 
            className="text-xs"
            style={{ color: isDark ? '#a78bfa' : '#7c3aed' }}
          >
            {labels.caThisMonth}
          </p>
          <p 
            className="text-xl font-bold"
            style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
          >
            {formatCurrency(data?.ca_this_month || 0)}
          </p>
        </div>
        {data?.roi_multiplier > 0 && (
          <div 
            className="px-2 py-1 rounded-full text-sm font-bold"
            style={{ 
              backgroundColor: '#34d399',
              color: '#ffffff'
            }}
          >
            x{data.roi_multiplier}
          </div>
        )}
      </div>
    );
  }
  
  // Full dashboard view (shown when no tasks)
  return (
    <div 
      className="p-5 rounded-2xl"
      style={{ 
        backgroundColor: isDark ? '#1a1a24' : '#ffffff',
        border: `1px solid ${isDark ? '#2a2a3b' : '#e5e7eb'}`
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #9333EA, #4F46E5)' }}
          >
            <TrendingUp size={16} color="white" />
          </div>
          <span 
            className="font-bold"
            style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
          >
            {labels.roiDashboard}
          </span>
        </div>
        <button
          className="flex items-center gap-1 text-sm"
          style={{ color: '#6C63FF' }}
        >
          {labels.viewDetails}
          <ChevronRight size={16} />
        </button>
      </div>
      
      {/* No tasks message */}
      {showWhenNoTasks && (
        <div 
          className="text-center py-3 mb-4 rounded-xl"
          style={{ 
            backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa',
            color: isDark ? '#a0a4ae' : '#6b7280'
          }}
        >
          🎉 {labels.noTasks}
        </div>
      )}
      
      {/* Main stat */}
      <div 
        className="p-4 rounded-2xl mb-3 text-center"
        style={{ 
          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15), rgba(79, 70, 229, 0.15))',
          border: '1px solid rgba(147, 51, 234, 0.3)'
        }}
      >
        <p 
          className="text-sm mb-1"
          style={{ color: isDark ? '#a78bfa' : '#7c3aed' }}
        >
          {labels.caThisMonth}
        </p>
        <p 
          className="text-3xl font-bold"
          style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
        >
          {formatCurrency(data?.ca_this_month || 0)}
        </p>
        {data?.roi_multiplier > 0 && (
          <p 
            className="text-sm mt-1 font-medium"
            style={{ color: '#34d399' }}
          >
            x{data.roi_multiplier} {labels.roiMultiplier}
          </p>
        )}
      </div>
      
      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div 
          className="p-3 rounded-xl text-center"
          style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
        >
          <p 
            className="text-xs mb-1"
            style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
          >
            {labels.salesCount}
          </p>
          <p 
            className="text-xl font-bold"
            style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
          >
            {data?.sales_this_month || 0}
          </p>
        </div>
        <div 
          className="p-3 rounded-xl text-center"
          style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
        >
          <p 
            className="text-xs mb-1"
            style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
          >
            {labels.avgCommission}
          </p>
          <p 
            className="text-xl font-bold"
            style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
          >
            {formatCurrency(data?.average_commission || 0)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ROIDashboard;
