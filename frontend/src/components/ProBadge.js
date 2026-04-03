import React from 'react';
import { Lock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/**
 * ProBadge - A clear, consistent badge to indicate PRO or PRO+ features
 * 
 * Usage:
 *   <ProBadge plan="pro" />      // Shows "PRO" badge
 *   <ProBadge plan="pro_plus" /> // Shows "PRO+" badge
 *   <ProBadge plan="pro" size="small" /> // Smaller version
 */
export const ProBadge = ({ 
  plan = 'pro', // 'pro' or 'pro_plus'
  size = 'medium', // 'small', 'medium', 'large'
  showLock = true,
  onClick = null,
  style = {}
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const label = plan === 'pro_plus' ? 'PRO+' : 'PRO';
  
  // Size configurations
  const sizes = {
    small: {
      padding: '2px 6px',
      fontSize: '9px',
      iconSize: 10,
      gap: '3px',
      borderRadius: '4px'
    },
    medium: {
      padding: '3px 8px',
      fontSize: '10px',
      iconSize: 12,
      gap: '4px',
      borderRadius: '6px'
    },
    large: {
      padding: '4px 10px',
      fontSize: '11px',
      iconSize: 14,
      gap: '5px',
      borderRadius: '8px'
    }
  };
  
  const s = sizes[size] || sizes.medium;
  
  // Colors - Use a gradient for PRO+ and solid for PRO
  const isPlusPlan = plan === 'pro_plus';
  const bgColor = isPlusPlan 
    ? 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)'
    : 'linear-gradient(135deg, #004AAD 0%, #2563EB 100%)';
  const textColor = '#FFFFFF';
  const borderColor = isPlusPlan ? '#9333EA' : '#2563EB';
  
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.gap,
    padding: s.padding,
    background: bgColor,
    border: `1px solid ${borderColor}`,
    borderRadius: s.borderRadius,
    color: textColor,
    fontSize: s.fontSize,
    fontWeight: '700',
    fontFamily: "'League Spartan', system-ui, sans-serif",
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.15s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    whiteSpace: 'nowrap',
    ...style
  };
  
  const handleClick = (e) => {
    if (onClick) {
      e.stopPropagation();
      onClick(e);
    }
  };
  
  return (
    <span 
      style={baseStyle}
      onClick={handleClick}
      data-testid={`pro-badge-${plan}`}
    >
      {showLock && <Lock size={s.iconSize} strokeWidth={2.5} />}
      {label}
    </span>
  );
};

/**
 * LockedFeatureOverlay - Overlay to show on locked features
 * Use this to wrap any component that needs PRO/PRO+ access
 */
export const LockedFeatureOverlay = ({
  plan = 'pro',
  children,
  onClick,
  message = null
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div 
      style={{ 
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
    >
      {/* Dimmed content */}
      <div style={{ opacity: 0.4, pointerEvents: 'none' }}>
        {children}
      </div>
      
      {/* Badge overlay */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px'
      }}>
        <ProBadge plan={plan} size="medium" />
        {message && (
          <span style={{
            fontSize: '10px',
            color: isDark ? '#a0a4ae' : '#6b7280',
            textAlign: 'center'
          }}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
};

export default ProBadge;
