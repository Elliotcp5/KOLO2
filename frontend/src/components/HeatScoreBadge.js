import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { usePlan } from '../context/PlanContext';
import { Flame, Snowflake, Thermometer, Lock } from 'lucide-react';

// Labels
const LABELS = {
  en: {
    hot: 'Hot',
    warm: 'Warm', 
    cold: 'Cold',
    proPlus: 'PRO+',
    heatScore: 'Heat Score'
  },
  fr: {
    hot: 'Chaud',
    warm: 'Tiède',
    cold: 'Froid',
    proPlus: 'PRO+',
    heatScore: 'Score de chaleur'
  },
  de: {
    hot: 'Heiß',
    warm: 'Warm',
    cold: 'Kalt',
    proPlus: 'PRO+',
    heatScore: 'Wärmebewertung'
  },
  it: {
    hot: 'Caldo',
    warm: 'Tiepido',
    cold: 'Freddo',
    proPlus: 'PRO+',
    heatScore: 'Punteggio calore'
  }
};

function getHeatStatus(score) {
  if (score <= 33) return 'cold';
  if (score <= 66) return 'warm';
  return 'hot';
}

function getHeatColor(status) {
  switch (status) {
    case 'hot': return { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', icon: '#ef4444' };
    case 'warm': return { bg: '#fffbeb', border: '#fcd34d', text: '#d97706', icon: '#f59e0b' };
    case 'cold': return { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb', icon: '#3b82f6' };
    default: return { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280', icon: '#9ca3af' };
  }
}

function getHeatIcon(status) {
  switch (status) {
    case 'hot': return Flame;
    case 'warm': return Thermometer;
    case 'cold': return Snowflake;
    default: return Thermometer;
  }
}

export function HeatScoreBadge({
  score,
  showLabel = false,
  size = 'default', // 'small', 'default', 'large'
  onLockedClick = null
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const { checkFeature, planData } = usePlan();
  
  const isDark = theme === 'dark';
  const labels = LABELS[locale] || LABELS.en;
  
  // Check if heat score is available (PRO+ feature)
  // Use planData directly to ensure re-render when it changes
  const hasHeatScore = planData?.features?.heat_score ?? false;
  
  if (!hasHeatScore) {
    // Show locked state
    return (
      <button
        onClick={onLockedClick}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full transition-all opacity-60 hover:opacity-100"
        style={{
          backgroundColor: isDark ? '#2a2a3b' : '#f3f4f6',
          border: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`
        }}
        title={labels.heatScore}
      >
        <Lock size={size === 'small' ? 12 : 14} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
        {showLabel && (
          <span 
            className="text-xs"
            style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
          >
            {labels.proPlus}
          </span>
        )}
      </button>
    );
  }
  
  if (score === null || score === undefined) {
    return null;
  }
  
  const status = getHeatStatus(score);
  const colors = getHeatColor(status);
  const Icon = getHeatIcon(status);
  
  const sizeClasses = {
    small: 'px-1.5 py-0.5 text-xs',
    default: 'px-2 py-1 text-sm',
    large: 'px-3 py-1.5 text-base'
  };
  
  const iconSizes = {
    small: 12,
    default: 14,
    large: 18
  };
  
  return (
    <div 
      className={`flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: isDark ? `${colors.bg}20` : colors.bg,
        border: `1px solid ${isDark ? `${colors.border}40` : colors.border}`,
        color: colors.text
      }}
      title={`${labels.heatScore}: ${score}/100`}
    >
      <Icon size={iconSizes[size]} style={{ color: colors.icon }} />
      {showLabel ? (
        <span>{labels[status]} ({score})</span>
      ) : (
        <span>{score}</span>
      )}
    </div>
  );
}

export function HeatScoreBar({
  score,
  showLabel = true,
  onLockedClick = null
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const { checkFeature, planData } = usePlan();
  
  const isDark = theme === 'dark';
  const labels = LABELS[locale] || LABELS.en;
  
  // Check if heat score is available (PRO+ feature)
  // Use planData directly to ensure re-render when it changes
  const hasHeatScore = planData?.features?.heat_score ?? false;
  
  if (!hasHeatScore) {
    return (
      <button
        onClick={onLockedClick}
        className="w-full p-3 rounded-xl flex items-center justify-between transition-all"
        style={{
          backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa',
          opacity: 0.6
        }}
      >
        <div className="flex items-center gap-2">
          <Lock size={18} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
          <span style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}>
            {labels.heatScore}
          </span>
        </div>
        <span 
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: '#9333EA', color: 'white' }}
        >
          {labels.proPlus}
        </span>
      </button>
    );
  }
  
  if (score === null || score === undefined) {
    return null;
  }
  
  const status = getHeatStatus(score);
  const colors = getHeatColor(status);
  const Icon = getHeatIcon(status);
  
  return (
    <div 
      className="p-3 rounded-xl"
      style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
    >
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <span 
            className="text-sm font-medium"
            style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
          >
            {labels.heatScore}
          </span>
          <div className="flex items-center gap-1.5">
            <Icon size={16} style={{ color: colors.icon }} />
            <span 
              className="font-bold"
              style={{ color: colors.text }}
            >
              {labels[status]}
            </span>
          </div>
        </div>
      )}
      
      {/* Progress bar */}
      <div 
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: isDark ? '#1a1a24' : '#e5e7eb' }}
      >
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            background: status === 'hot' 
              ? 'linear-gradient(90deg, #f87171, #ef4444)'
              : status === 'warm'
              ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
              : 'linear-gradient(90deg, #60a5fa, #3b82f6)'
          }}
        />
      </div>
      
      <div className="flex justify-between mt-1">
        <span 
          className="text-xs"
          style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
        >
          0
        </span>
        <span 
          className="text-xs font-medium"
          style={{ color: colors.text }}
        >
          {score}/100
        </span>
        <span 
          className="text-xs"
          style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
        >
          100
        </span>
      </div>
    </div>
  );
}

export default HeatScoreBadge;
