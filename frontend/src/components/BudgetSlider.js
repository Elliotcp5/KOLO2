import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';

export function BudgetSlider({
  minValue = 0,
  maxValue = 100,
  min = 0,
  max = 800,
  step = 10,
  onChange,
  disabled = false,
  budgetUndefined = false,
  onBudgetUndefinedChange
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const isDark = theme === 'dark';
  
  const [localMin, setLocalMin] = useState(minValue);
  const [localMax, setLocalMax] = useState(maxValue);
  const [dragging, setDragging] = useState(null); // 'min', 'max', or null
  
  const sliderRef = useRef(null);
  
  // Ticks for display
  const ticks = [0, 100, 200, 300, 500, 800];
  
  const formatValue = (val) => {
    if (val >= 800) return '800k+';
    return `${val}k€`;
  };
  
  const getPercentage = (value) => {
    return ((value - min) / (max - min)) * 100;
  };
  
  const getValueFromPercentage = (percentage) => {
    const rawValue = (percentage / 100) * (max - min) + min;
    return Math.round(rawValue / step) * step;
  };
  
  const handleMouseDown = (thumb) => (e) => {
    if (disabled || budgetUndefined) return;
    e.preventDefault();
    setDragging(thumb);
  };
  
  const handleMouseMove = useCallback((e) => {
    if (!dragging || !sliderRef.current || disabled || budgetUndefined) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const percentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const value = getValueFromPercentage(percentage);
    
    if (dragging === 'min') {
      const newMin = Math.min(value, localMax - step);
      setLocalMin(Math.max(min, newMin));
    } else if (dragging === 'max') {
      const newMax = Math.max(value, localMin + step);
      setLocalMax(Math.min(max, newMax));
    }
  }, [dragging, localMin, localMax, min, max, step, disabled, budgetUndefined]);
  
  const handleMouseUp = useCallback(() => {
    if (dragging && onChange) {
      onChange({ min: localMin, max: localMax });
    }
    setDragging(null);
  }, [dragging, localMin, localMax, onChange]);
  
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleMouseMove);
        window.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);
  
  // Update local state when props change
  useEffect(() => {
    setLocalMin(minValue);
    setLocalMax(maxValue);
  }, [minValue, maxValue]);
  
  const minPercent = getPercentage(localMin);
  const maxPercent = getPercentage(localMax);
  
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
          ? (locale === 'fr' ? 'Budget à définir' :
             locale === 'de' ? 'Budget noch festzulegen' :
             locale === 'it' ? 'Budget da definire' :
             'Budget to be defined')
          : `Min ${formatValue(localMin)} → Max ${formatValue(localMax)}`
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
        {/* Filled track */}
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
      </div>
      
      {/* Ticks */}
      <div className="flex justify-between mt-2 px-1">
        {ticks.map((tick) => (
          <span 
            key={tick} 
            className="text-xs"
            style={{ 
              color: isDark ? '#6b7280' : '#9ca3af',
              opacity: budgetUndefined ? 0.3 : 0.7
            }}
          >
            {tick === 800 ? '800k+' : `${tick}k`}
          </span>
        ))}
      </div>
      
      {/* Budget undefined toggle */}
      {onBudgetUndefinedChange && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => onBudgetUndefinedChange(!budgetUndefined)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all"
            style={{
              backgroundColor: budgetUndefined 
                ? (isDark ? '#6C63FF' : '#6C63FF')
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
            {locale === 'fr' ? 'Budget à définir' :
             locale === 'de' ? 'Budget noch festzulegen' :
             locale === 'it' ? 'Budget da definire' :
             'Budget to be defined'}
          </button>
        </div>
      )}
    </div>
  );
}

export default BudgetSlider;
