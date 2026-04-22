import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { Edit3 } from 'lucide-react';

// Currency symbols
const CURRENCY_SYMBOLS = {
  EUR: '€',
  USD: '$',
  GBP: '£'
};

const getUserCurrency = () => localStorage.getItem('kolo_currency') || 'EUR';
const getCurrencySymbol = () => CURRENCY_SYMBOLS[getUserCurrency()] || '€';

// Configuration per project type
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
      label: { fr: 'Budget', en: 'Budget', de: 'Budget', it: 'Budget' },
      undefinedLabel: {
        fr: 'Budget à définir', en: 'Budget to be defined',
        de: 'Budget noch festzulegen', it: 'Budget da definire'
      }
    },
    seller: {
      min: 0, max: 2000, step: 25,
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
      isRange: false,
      label: {
        fr: 'Prix de vente souhaité TTC',
        en: 'Desired sale price (incl. fees)',
        de: 'Gewünschter Verkaufspreis inkl. Gebühren',
        it: 'Prezzo di vendita desiderato (tutto incluso)'
      },
      undefinedLabel: {
        fr: 'Prix à définir', en: 'Price to be defined',
        de: 'Preis noch festzulegen', it: 'Prezzo da definire'
      }
    },
    renter: {
      min: 0, max: 5000, step: 100,
      ticks: [0, 500, 1000, 2000, 3000, 5000],
      formatValue: (val) => `${val}${symbol}/${getUserCurrency() === 'EUR' ? 'mois' : 'mo'}`,
      formatTick: (tick) => tick >= 1000 ? `${tick/1000}k` : `${tick}`,
      isRange: true,
      label: { fr: 'Budget loyer', en: 'Rent budget', de: 'Mietbudget', it: 'Budget affitto' },
      undefinedLabel: {
        fr: 'Budget à définir', en: 'Budget to be defined',
        de: 'Budget noch festzulegen', it: 'Budget da definire'
      }
    }
  };
};

// Inline CSS for the native <input type="range"> — must be global to style
// the shadow-root pseudo-elements (-webkit-slider-thumb, -moz-range-thumb).
const KOLO_RANGE_CSS = `
.kolo-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 28px;
  background: transparent;
  cursor: pointer;
  outline: none;
  padding: 0;
  margin: 0;
  touch-action: pan-y;
}
.kolo-range::-webkit-slider-runnable-track {
  height: 6px;
  background: transparent;
  border: none;
}
.kolo-range::-moz-range-track {
  height: 6px;
  background: transparent;
  border: none;
}
.kolo-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 28px;
  width: 28px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #6C63FF;
  box-shadow: 0 2px 8px rgba(108,99,255,0.35);
  cursor: grab;
  margin-top: -11px;
  transition: transform 0.1s;
}
.kolo-range::-webkit-slider-thumb:active {
  transform: scale(1.15);
  box-shadow: 0 2px 12px rgba(108,99,255,0.5), 0 0 0 3px rgba(108,99,255,0.2);
  cursor: grabbing;
}
.kolo-range::-moz-range-thumb {
  height: 28px;
  width: 28px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #6C63FF;
  box-shadow: 0 2px 8px rgba(108,99,255,0.35);
  cursor: grab;
}
.kolo-range:disabled { opacity: 0.3; cursor: not-allowed; }
.kolo-range:disabled::-webkit-slider-thumb { cursor: not-allowed; }
`;

function KoloRange({ min, max, step, value, onChange, disabled, zIndex = 1 }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="kolo-range absolute top-1/2 left-0 -translate-y-1/2 w-full"
      style={{ zIndex }}
    />
  );
}

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

  const SLIDER_CONFIG = getSliderConfig();
  const config = SLIDER_CONFIG[projectType] || SLIDER_CONFIG.buyer;

  const [localMin, setLocalMin] = useState(minValue || config.min);
  const [localMax, setLocalMax] = useState(maxValue || Math.floor(config.max / 2));
  const [localSingle, setLocalSingle] = useState(singleValue || Math.floor(config.max / 4));
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInputValue, setManualInputValue] = useState('');

  // Sync from props
  useEffect(() => {
    if (config.isRange) {
      setLocalMin(minValue || config.min);
      setLocalMax(maxValue || Math.floor(config.max / 2));
    } else {
      setLocalSingle(singleValue || Math.floor(config.max / 4));
    }
  }, [minValue, maxValue, singleValue, config]);

  const percent = (v) => ((v - config.min) / (config.max - config.min)) * 100;
  const minPercent = percent(localMin);
  const maxPercent = percent(localMax);
  const singlePercent = percent(localSingle);

  const commit = (nextState) => {
    if (!onChange) return;
    if (config.isRange) {
      onChange({ min: nextState.min ?? localMin, max: nextState.max ?? localMax });
    } else {
      onChange({ value: nextState.value ?? localSingle });
    }
  };

  const handleMinChange = (val) => {
    const safe = Math.min(val, localMax - config.step);
    const bounded = Math.max(config.min, safe);
    setLocalMin(bounded);
    commit({ min: bounded, max: localMax });
  };
  const handleMaxChange = (val) => {
    const safe = Math.max(val, localMin + config.step);
    const bounded = Math.min(config.max, safe);
    setLocalMax(bounded);
    commit({ min: localMin, max: bounded });
  };
  const handleSingleChange = (val) => {
    const bounded = Math.max(config.min, Math.min(config.max, val));
    setLocalSingle(bounded);
    commit({ value: bounded });
  };

  const handleManualSubmit = () => {
    const value = parseInt(manualInputValue.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(value) && value > 0) {
      const valueInK = value >= 10000 ? value / 1000 : value;
      if (config.isRange) {
        const safeValue = Math.min(valueInK, config.max * 10);
        onChange({ min: safeValue, max: safeValue, manualValue: value });
      } else {
        onChange({ value: Math.min(valueInK, config.max * 10), manualValue: value });
      }
    }
    setShowManualInput(false);
    setManualInputValue('');
  };

  const effDisabled = disabled || budgetUndefined;

  return (
    <div className="w-full">
      <style>{KOLO_RANGE_CSS}</style>

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

      {/* Track + thumbs container */}
      <div
        className="relative w-full"
        style={{ height: '28px' }}
      >
        {/* Background track (visual only) */}
        <div
          className="absolute top-1/2 left-0 right-0 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            height: '6px',
            backgroundColor: isDark ? '#2a2a3b' : '#ebebf0',
            opacity: budgetUndefined || disabled ? 0.3 : 1
          }}
        />

        {/* Filled gradient (visual only) */}
        {config.isRange ? (
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              height: '6px',
              left: `${minPercent}%`,
              width: `${Math.max(0, maxPercent - minPercent)}%`,
              background: 'linear-gradient(90deg, #6C63FF, #9333EA)',
              opacity: budgetUndefined || disabled ? 0.3 : 1
            }}
          />
        ) : (
          <div
            className="absolute top-1/2 left-0 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              height: '6px',
              width: `${singlePercent}%`,
              background: 'linear-gradient(90deg, #6C63FF, #9333EA)',
              opacity: budgetUndefined || disabled ? 0.3 : 1
            }}
          />
        )}

        {/* Native <input type=range> inputs — actual interaction */}
        {config.isRange ? (
          <>
            <KoloRange
              min={config.min} max={config.max} step={config.step}
              value={localMin}
              onChange={handleMinChange}
              disabled={effDisabled}
              zIndex={localMin > config.max - (config.max - config.min) / 4 ? 3 : 2}
            />
            <KoloRange
              min={config.min} max={config.max} step={config.step}
              value={localMax}
              onChange={handleMaxChange}
              disabled={effDisabled}
              zIndex={3}
            />
          </>
        ) : (
          <KoloRange
            min={config.min} max={config.max} step={config.step}
            value={localSingle}
            onChange={handleSingleChange}
            disabled={effDisabled}
            zIndex={3}
          />
        )}
      </div>

      {/* Ticks */}
      <div className="flex justify-between mt-3 px-1">
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
            onClick={(e) => e.stopPropagation()}
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
                inputMode="numeric"
                pattern="[0-9]*"
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
                {projectType === 'renter'
                  ? `${getCurrencySymbol()}/${locale === 'fr' ? 'mois' : locale === 'de' ? 'Monat' : locale === 'it' ? 'mese' : 'mo'}`
                  : getCurrencySymbol()}
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
                {locale === 'fr' ? 'Annuler' : locale === 'de' ? 'Abbrechen' : locale === 'it' ? 'Annulla' : 'Cancel'}
              </button>
              <button
                onClick={handleManualSubmit}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{
                  background: 'linear-gradient(135deg, #004AAD, #CB6CE6)'
                }}
              >
                {locale === 'fr' ? 'Confirmer' : locale === 'de' ? 'Bestätigen' : locale === 'it' ? 'Conferma' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetSlider;
