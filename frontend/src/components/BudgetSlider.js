import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { Edit3 } from 'lucide-react';

// Currency symbols
const CURRENCY_SYMBOLS = {
  EUR: '€',
  USD: '$',
  GBP: '£'
};

// Get user currency from localStorage
const getUserCurrency = () => {
  return localStorage.getItem('kolo_currency') || 'EUR';
};

const getCurrencySymbol = () => {
  return CURRENCY_SYMBOLS[getUserCurrency()] || '€';
};

// Configuration by project type - now with dynamic currency
const getSliderConfig = () => {
  const symbol = getCurrencySymbol();
  
  return {
    buyer: {
      min: 0,
      max: 800,
      step: 10,
      ticks: [0, 100, 200, 300, 500, 800],
      formatValue: (val) => val >= 800 ? `800k+` : `${val}k${symbol}`,
      formatTick: (tick) => tick === 800 ? '800k+' : `${tick}k`,
      isRange: true,
      label: {
        fr: 'Budget',
        en: 'Budget',
        de: 'Budget',
        it: 'Budget'
      },
      undefinedLabel: {
        fr: 'Budget à définir',
        en: 'Budget to be defined',
        de: 'Budget noch festzulegen',
        it: 'Budget da definire'
      }
    },
    seller: {
      min: 0,
      max: 2000,
      step: 25,
      ticks: [0, 250, 500, 750, 1000, 2000],
      formatValue: (val) => {
        if (val === 0) return `0${symbol}`;
        if (val >= 1000) return `${(val/1000).toFixed(val % 1000 === 0 ? 0 : 1)}M${symbol}`;
        return `${val}k${symbol}`;
      },
      formatTick: (tick) => {
        if (tick === 0) return '0';
        if (tick >= 1000) return `${tick/1000}M`;
        return `${tick}k`;
      },
      isRange: false, // Single value, not range
      label: {
        fr: 'Prix de vente souhaité TTC',
        en: 'Desired sale price (incl. fees)',
        de: 'Gewünschter Verkaufspreis inkl. Gebühren',
        it: 'Prezzo di vendita desiderato (tutto incluso)'
      },
      undefinedLabel: {
        fr: 'Prix à définir',
        en: 'Price to be defined',
        de: 'Preis noch festzulegen',
        it: 'Prezzo da definire'
      }
    },
    renter: {
      min: 0,
      max: 5000,
      step: 100,
      ticks: [0, 500, 1000, 2000, 3000, 5000],
      formatValue: (val) => `${val}${symbol}/${getUserCurrency() === 'EUR' ? 'mois' : 'mo'}`,
      formatTick: (tick) => tick >= 1000 ? `${tick/1000}k` : `${tick}`,
      isRange: true,
      label: {
        fr: 'Budget loyer',
        en: 'Rent budget',
        de: 'Mietbudget',
        it: 'Budget affitto'
      },
      undefinedLabel: {
        fr: 'Budget à définir',
        en: 'Budget to be defined',
        de: 'Budget noch festzulegen',
        it: 'Budget da definire'
      }
    }
  };
};

export function BudgetSlider({
  projectType = 'buyer',
  minValue = 0,
  maxValue = 100,
  singleValue = 0,
  onChange,
  disabled = false,
  budgetUndefined = false,
  onBudgetUndefinedChange
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const isDark = theme === 'dark';
  
  // Get config dynamically to pick up currency changes
  const SLIDER_CONFIG = getSliderConfig();
  const config = SLIDER_CONFIG[projectType] || SLIDER_CONFIG.buyer;
  
  const [localMin, setLocalMin] = useState(minValue || config.min);
  const [localMax, setLocalMax] = useState(maxValue || config.max / 2);
  const [localSingle, setLocalSingle] = useState(singleValue || config.max / 4);
  const [dragging, setDragging] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInputValue, setManualInputValue] = useState('');
  
  const sliderRef = useRef(null);
  
  const getPercentage = (value) => {
    return ((value - config.min) / (config.max - config.min)) * 100;
  };
  
  const getValueFromPercentage = useCallback((percentage) => {
    const rawValue = (percentage / 100) * (config.max - config.min) + config.min;
    return Math.round(rawValue / config.step) * config.step;
  }, [config.max, config.min, config.step]);
  
  const handleMouseDown = (thumb) => (e) => {
    if (disabled || budgetUndefined) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(thumb);
  };
  
  const handleMouseMove = useCallback((e) => {
    if (!dragging || !sliderRef.current || disabled || budgetUndefined) return;
    
    e.preventDefault();
    
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const percentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const value = getValueFromPercentage(percentage);
    
    if (config.isRange) {
      if (dragging === 'min') {
        const newMin = Math.min(value, localMax - config.step);
        setLocalMin(Math.max(config.min, newMin));
      } else if (dragging === 'max') {
        const newMax = Math.max(value, localMin + config.step);
        setLocalMax(Math.min(config.max, newMax));
      }
    } else {
      // Single value mode
      setLocalSingle(Math.max(config.min, Math.min(config.max, value)));
    }
  }, [dragging, localMin, localMax, config, disabled, budgetUndefined, getValueFromPercentage]);
  
  const handleMouseUp = useCallback(() => {
    if (dragging && onChange) {
      if (config.isRange) {
        onChange({ min: localMin, max: localMax });
      } else {
        onChange({ value: localSingle });
      }
    }
    setDragging(null);
  }, [dragging, localMin, localMax, localSingle, config.isRange, onChange]);
  
  useEffect(() => {
    if (dragging) {
      const handleMove = (e) => handleMouseMove(e);
      const handleUp = () => handleMouseUp();
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);
  
  // Update local state when props change
  useEffect(() => {
    if (config.isRange) {
      setLocalMin(minValue || config.min);
      setLocalMax(maxValue || config.max / 2);
    } else {
      setLocalSingle(singleValue || config.max / 4);
    }
  }, [minValue, maxValue, singleValue, config]);
  
  const handleManualSubmit = () => {
    const value = parseInt(manualInputValue.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(value) && value > 0) {
      // Convert to k if needed
      const valueInK = value >= 10000 ? value / 1000 : value;
      if (config.isRange) {
        // For range, set both min and max to same value (user can adjust)
        const safeValue = Math.min(valueInK, config.max * 10); // Allow values beyond slider max
        onChange({ min: safeValue, max: safeValue, manualValue: value });
      } else {
        onChange({ value: Math.min(valueInK, config.max * 10), manualValue: value });
      }
    }
    setShowManualInput(false);
    setManualInputValue('');
  };
  
  const minPercent = getPercentage(localMin);
  const maxPercent = getPercentage(localMax);
  const singlePercent = getPercentage(localSingle);
  
  return (
    <div className="w-full">
      {/* Value display */}
      <div 
        className="text-center mb-4 font-medium"
        style={{ 
          color: budgetUndefined 
            ? (isDark ? '#6b7280' : '#9ca3af')
            : (isDark ? '#a78bfa' : '#6C63FF'),
          opacity: budgetUndefined ? 0.5 : 1
        }}
      >
        {budgetUndefined 
          ? config.undefinedLabel[locale] || config.undefinedLabel.en
          : config.isRange 
            ? `Min ${config.formatValue(localMin)} → Max ${config.formatValue(localMax)}`
            : config.formatValue(localSingle)
        }
      </div>
      
      {/* Slider track */}
      <div 
        ref={sliderRef}
        className="relative h-1.5 rounded-full cursor-pointer"
        style={{ 
          backgroundColor: isDark ? '#2a2a3b' : '#ebebf0',
          opacity: budgetUndefined || disabled ? 0.3 : 1
        }}
      >
        {config.isRange ? (
          <>
            {/* Filled track for range */}
            <div 
              className="absolute h-full rounded-full"
              style={{
                left: `${minPercent}%`,
                width: `${maxPercent - minPercent}%`,
                background: 'linear-gradient(90deg, #6C63FF, #9333EA)'
              }}
            />
            
            {/* Min thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
              style={{
                left: `${minPercent}%`,
                width: '28px',
                height: '28px',
                backgroundColor: '#ffffff',
                borderRadius: '50%',
                boxShadow: dragging === 'min' 
                  ? '0 2px 12px rgba(108,99,255,0.5), 0 0 0 3px #6C63FF'
                  : '0 2px 8px rgba(108,99,255,0.3), 0 0 0 2px #6C63FF',
                transform: `translate(-50%, -50%) ${dragging === 'min' ? 'scale(1.15)' : 'scale(1)'}`,
                transition: dragging ? 'none' : 'transform 0.1s, box-shadow 0.1s',
                touchAction: 'none',
                zIndex: dragging === 'min' ? 10 : 5
              }}
              onMouseDown={handleMouseDown('min')}
              onTouchStart={handleMouseDown('min')}
            />
            
            {/* Max thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
              style={{
                left: `${maxPercent}%`,
                width: '28px',
                height: '28px',
                backgroundColor: '#ffffff',
                borderRadius: '50%',
                boxShadow: dragging === 'max' 
                  ? '0 2px 12px rgba(108,99,255,0.5), 0 0 0 3px #6C63FF'
                  : '0 2px 8px rgba(108,99,255,0.3), 0 0 0 2px #6C63FF',
                transform: `translate(-50%, -50%) ${dragging === 'max' ? 'scale(1.15)' : 'scale(1)'}`,
                transition: dragging ? 'none' : 'transform 0.1s, box-shadow 0.1s',
                touchAction: 'none',
                zIndex: dragging === 'max' ? 10 : 5
              }}
              onMouseDown={handleMouseDown('max')}
              onTouchStart={handleMouseDown('max')}
            />
          </>
        ) : (
          <>
            {/* Filled track for single value */}
            <div 
              className="absolute h-full rounded-full"
              style={{
                left: 0,
                width: `${singlePercent}%`,
                background: 'linear-gradient(90deg, #6C63FF, #9333EA)'
              }}
            />
            
            {/* Single thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
              style={{
                left: `${singlePercent}%`,
                width: '28px',
                height: '28px',
                backgroundColor: '#ffffff',
                borderRadius: '50%',
                boxShadow: dragging === 'single' 
                  ? '0 2px 12px rgba(108,99,255,0.5), 0 0 0 3px #6C63FF'
                  : '0 2px 8px rgba(108,99,255,0.3), 0 0 0 2px #6C63FF',
                transform: `translate(-50%, -50%) ${dragging === 'single' ? 'scale(1.15)' : 'scale(1)'}`,
                transition: dragging ? 'none' : 'transform 0.1s, box-shadow 0.1s',
                touchAction: 'none',
                zIndex: 10
              }}
              onMouseDown={handleMouseDown('single')}
              onTouchStart={handleMouseDown('single')}
            />
          </>
        )}
      </div>
      
      {/* Ticks */}
      <div className="flex justify-between mt-2 px-1">
        {config.ticks.map((tick) => (
          <span 
            key={tick} 
            className="text-xs"
            style={{ 
              color: isDark ? '#6b7280' : '#9ca3af',
              opacity: budgetUndefined ? 0.3 : 0.7
            }}
          >
            {config.formatTick(tick)}
          </span>
        ))}
      </div>
      
      {/* Actions row */}
      <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
        {/* Budget undefined toggle */}
        {onBudgetUndefinedChange && (
          <button
            type="button"
            onClick={() => onBudgetUndefinedChange(!budgetUndefined)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all"
            style={{
              backgroundColor: budgetUndefined 
                ? '#6C63FF'
                : (isDark ? '#2a2a3b' : '#f2f2f7'),
              color: budgetUndefined 
                ? '#ffffff'
                : (isDark ? '#a0a4ae' : '#6b7280')
            }}
          >
            <div 
              className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
              style={{
                borderColor: budgetUndefined ? '#ffffff' : (isDark ? '#6b7280' : '#9ca3af')
              }}
            >
              {budgetUndefined && (
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#ffffff' }}
                />
              )}
            </div>
            {config.undefinedLabel[locale] || config.undefinedLabel.en}
          </button>
        )}
        
        {/* Manual input button */}
        {!budgetUndefined && (
          <button
            type="button"
            onClick={() => setShowManualInput(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
            style={{
              backgroundColor: isDark ? '#2a2a3b' : '#f2f2f7',
              color: isDark ? '#a78bfa' : '#6C63FF',
              border: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`
            }}
          >
            <Edit3 size={12} />
            {locale === 'fr' ? 'Saisir manuellement' : 
             locale === 'de' ? 'Manuell eingeben' :
             locale === 'it' ? 'Inserisci manualmente' :
             'Enter manually'}
          </button>
        )}
      </div>
      
      {/* Manual input modal */}
      {showManualInput && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowManualInput(false)}
        >
          <div 
            className="rounded-2xl p-5 w-full max-w-xs"
            style={{ 
              backgroundColor: isDark ? '#1a1a24' : '#ffffff',
              border: `1px solid ${isDark ? '#2a2a3b' : '#e5e7eb'}`
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 
              className="text-base font-semibold mb-3"
              style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
            >
              {locale === 'fr' ? 'Saisir le montant' : 
               locale === 'de' ? 'Betrag eingeben' :
               locale === 'it' ? 'Inserisci importo' :
               'Enter amount'}
            </h3>
            <div className="relative mb-4">
              <input
                type="text"
                value={manualInputValue}
                onChange={(e) => setManualInputValue(e.target.value)}
                placeholder={projectType === 'renter' ? '2500' : '500000'}
                className="w-full px-4 py-3 rounded-xl text-lg font-medium"
                style={{
                  backgroundColor: isDark ? '#2a2a3b' : '#f3f4f6',
                  color: isDark ? '#ffffff' : '#0E0B1E',
                  border: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`
                }}
                autoFocus
              />
              <span 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
              >
                {projectType === 'renter' ? `${getCurrencySymbol()}/${locale === 'fr' ? 'mois' : 'mo'}` : getCurrencySymbol()}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowManualInput(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  backgroundColor: isDark ? '#2a2a3b' : '#f3f4f6',
                  color: isDark ? '#ffffff' : '#0E0B1E'
                }}
              >
                {locale === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleManualSubmit}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{
                  background: 'linear-gradient(135deg, #004AAD, #CB6CE6)'
                }}
              >
                {locale === 'fr' ? 'Confirmer' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetSlider;
