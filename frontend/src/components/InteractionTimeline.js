import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { usePlan } from '../context/PlanContext';
import { PaywallBottomSheet } from './PaywallBottomSheet';
import { MessageSquare, Phone, MapPin, FileText, Sparkles, Lock, Clock } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Labels
const LABELS = {
  en: {
    interactionHistory: 'Interaction History',
    noInteractions: 'No interactions yet',
    pro: 'PRO',
    sms: 'SMS',
    call: 'Call',
    visit: 'Visit',
    note: 'Note',
    suggestion: 'AI Suggestion'
  },
  fr: {
    interactionHistory: 'Historique des interactions',
    noInteractions: 'Aucune interaction pour le moment',
    pro: 'PRO',
    sms: 'SMS',
    call: 'Appel',
    visit: 'Visite',
    note: 'Note',
    suggestion: 'Suggestion IA'
  },
  de: {
    interactionHistory: 'Interaktionsverlauf',
    noInteractions: 'Noch keine Interaktionen',
    pro: 'PRO',
    sms: 'SMS',
    call: 'Anruf',
    visit: 'Besuch',
    note: 'Notiz',
    suggestion: 'KI-Vorschlag'
  },
  it: {
    interactionHistory: 'Storico interazioni',
    noInteractions: 'Nessuna interazione per il momento',
    pro: 'PRO',
    sms: 'SMS',
    call: 'Chiamata',
    visit: 'Visita',
    note: 'Nota',
    suggestion: 'Suggerimento IA'
  }
};

// Interaction type icons
const INTERACTION_ICONS = {
  sms: MessageSquare,
  call: Phone,
  visit: MapPin,
  note: FileText,
  suggestion: Sparkles
};

// Interaction type colors
const INTERACTION_COLORS = {
  sms: { bg: '#ede9ff', icon: '#6C63FF' },
  call: { bg: '#dcfce7', icon: '#22c55e' },
  visit: { bg: '#fef3c7', icon: '#f59e0b' },
  note: { bg: '#f3f4f6', icon: '#6b7280' },
  suggestion: { bg: '#fce7f3', icon: '#ec4899' }
};

function formatRelativeTime(dateString, locale) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) {
    return locale === 'fr' ? "À l'instant" : 
           locale === 'de' ? 'Gerade eben' :
           locale === 'it' ? 'Adesso' : 
           'Just now';
  }
  if (diffMins < 60) {
    return locale === 'fr' ? `Il y a ${diffMins} min` :
           locale === 'de' ? `Vor ${diffMins} Min.` :
           locale === 'it' ? `${diffMins} min fa` :
           `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return locale === 'fr' ? `Il y a ${diffHours}h` :
           locale === 'de' ? `Vor ${diffHours}h` :
           locale === 'it' ? `${diffHours}h fa` :
           `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return locale === 'fr' ? `Il y a ${diffDays}j` :
           locale === 'de' ? `Vor ${diffDays}T` :
           locale === 'it' ? `${diffDays}g fa` :
           `${diffDays}d ago`;
  }
  
  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'de' ? 'de-DE' : locale === 'it' ? 'it-IT' : 'en-US', {
    day: 'numeric',
    month: 'short'
  });
}

export function InteractionTimeline({
  prospectId,
  maxItems = 10,
  compact = false,
  onUpgrade = null
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const { checkFeature, planData } = usePlan();
  
  const isDark = theme === 'dark';
  const labels = LABELS[locale] || LABELS.en;
  
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  
  // Check if interaction history is available (PRO feature)
  const hasInteractionHistory = checkFeature('interaction_history');
  
  useEffect(() => {
    if (hasInteractionHistory && prospectId) {
      fetchInteractions();
    } else {
      setLoading(false);
    }
  }, [hasInteractionHistory, prospectId]);
  
  const fetchInteractions = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`${API_URL}/api/interactions/${prospectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setInteractions(result.interactions || []);
      }
    } catch (err) {
      console.error('Failed to fetch interactions:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLockedClick = () => {
    if (onUpgrade) {
      onUpgrade('interaction_history');
    } else {
      setShowPaywall(true);
    }
  };
  
  const handleUpgrade = () => {
    setShowPaywall(false);
    window.location.href = '/pricing';
  };
  
  // Locked state for non-PRO users
  if (!hasInteractionHistory) {
    return (
      <div 
        className={`${compact ? 'p-3' : 'p-4'} rounded-xl`}
        style={{ 
          backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa',
          opacity: 0.7
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lock size={16} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
            <span 
              className="font-medium text-sm"
              style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
            >
              {labels.interactionHistory}
            </span>
          </div>
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#6C63FF', color: 'white' }}
          >
            {labels.pro}
          </span>
        </div>
        
        <button
          onClick={handleLockedClick}
          className="w-full py-2 rounded-lg text-sm transition-all"
          style={{
            backgroundColor: isDark ? '#1a1a24' : '#e5e7eb',
            color: isDark ? '#a0a4ae' : '#6b7280'
          }}
        >
          {locale === 'fr' ? 'Débloquer l\'historique' :
           locale === 'de' ? 'Verlauf freischalten' :
           locale === 'it' ? 'Sblocca storico' :
           'Unlock history'}
        </button>
        
        <PaywallBottomSheet
          feature="interaction_history"
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
        className={`${compact ? 'p-3' : 'p-4'} rounded-xl animate-pulse`}
        style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
      >
        <div className="h-4 w-32 rounded mb-3" style={{ backgroundColor: isDark ? '#1a1a24' : '#e5e7eb' }} />
        <div className="space-y-2">
          <div className="h-12 rounded" style={{ backgroundColor: isDark ? '#1a1a24' : '#e5e7eb' }} />
          <div className="h-12 rounded" style={{ backgroundColor: isDark ? '#1a1a24' : '#e5e7eb' }} />
        </div>
      </div>
    );
  }
  
  // Empty state
  if (interactions.length === 0) {
    return (
      <div 
        className={`${compact ? 'p-3' : 'p-4'} rounded-xl text-center`}
        style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
      >
        <Clock 
          size={24} 
          className="mx-auto mb-2"
          style={{ color: isDark ? '#6b7280' : '#9ca3af' }} 
        />
        <p 
          className="text-sm"
          style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
        >
          {labels.noInteractions}
        </p>
      </div>
    );
  }
  
  // Timeline view
  return (
    <div className={compact ? '' : 'space-y-3'}>
      {!compact && (
        <h4 
          className="font-medium text-sm mb-3"
          style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
        >
          {labels.interactionHistory}
        </h4>
      )}
      
      <div className="relative">
        {/* Timeline line */}
        {!compact && interactions.length > 1 && (
          <div 
            className="absolute left-4 top-8 bottom-4 w-0.5"
            style={{ backgroundColor: isDark ? '#3a3a4b' : '#e5e7eb' }}
          />
        )}
        
        {/* Interaction items */}
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
          {interactions.slice(0, maxItems).map((interaction) => {
            const Icon = INTERACTION_ICONS[interaction.interaction_type] || FileText;
            const colors = INTERACTION_COLORS[interaction.interaction_type] || INTERACTION_COLORS.note;
            
            return (
              <div 
                key={interaction.interaction_id}
                className={`flex items-start gap-3 ${compact ? '' : 'relative'}`}
              >
                {/* Icon */}
                <div 
                  className={`flex-shrink-0 rounded-full flex items-center justify-center ${compact ? 'w-7 h-7' : 'w-8 h-8'}`}
                  style={{ 
                    backgroundColor: isDark ? `${colors.bg}30` : colors.bg,
                    position: compact ? 'static' : 'relative',
                    zIndex: 1
                  }}
                >
                  <Icon size={compact ? 14 : 16} style={{ color: colors.icon }} />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span 
                      className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}
                      style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                    >
                      {labels[interaction.interaction_type] || interaction.interaction_type}
                    </span>
                    <span 
                      className="text-xs flex-shrink-0"
                      style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
                    >
                      {formatRelativeTime(interaction.created_at, locale)}
                    </span>
                  </div>
                  {interaction.content && (
                    <p 
                      className={`${compact ? 'text-xs' : 'text-sm'} line-clamp-2 mt-0.5`}
                      style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
                    >
                      {interaction.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default InteractionTimeline;
