import React from 'react';
import { useLocale } from '../../context/LocaleContext';
import { useThemeColors } from '../../hooks/useThemeColors';

/**
 * Bottom Navigation Component
 * Displays the main navigation with Today, Add (+), and Prospects tabs
 * Exactly matches the provided HTML/CSS design
 */
const BottomNav = ({ activeTab, setActiveTab, onAddProspect }) => {
  const { locale } = useLocale();
  const { isDark } = useThemeColors();
  
  return (
    <>
      {/* SVG gradient definition */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="navGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#004aad"/>
            <stop offset="100%" stopColor="#cb6ce6"/>
          </linearGradient>
        </defs>
      </svg>
      
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        background: isDark ? 'rgba(15,13,26,0.92)' : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: isDark ? '1px solid rgba(240,238,248,0.08)' : '1px solid rgba(14,11,30,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '10px 20px 18px',
        zIndex: 100
      }}>
        
        {/* Today Tab */}
        <button 
          onClick={() => setActiveTab('today')}
          data-testid="nav-today"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            flex: 1,
            border: 'none',
            background: 'none',
            padding: 0
          }}
        >
          <svg 
            viewBox="0 0 24 24" 
            style={{ 
              width: '22px', 
              height: '22px', 
              strokeWidth: 2, 
              fill: 'none',
              stroke: activeTab === 'today' ? 'url(#navGrad)' : '#8A849E'
            }}
          >
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: '600', 
            fontFamily: "'League Spartan', sans-serif",
            letterSpacing: '0.02em',
            color: activeTab === 'today' ? '#004aad' : '#8A849E'
          }}>
            {locale === 'fr' ? "Aujourd'hui" : 'Today'}
          </span>
        </button>
        
        {/* Central Add Button - 52x52 rounded square */}
        <button
          onClick={() => {
            if ('vibrate' in navigator) navigator.vibrate(8);
            onAddProspect();
          }}
          data-testid="fab-add-prospect"
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(90deg, #004aad, #cb6ce6)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginBottom: '4px',
            boxShadow: '0 4px 20px rgba(0,74,173,0.3)'
          }}
        >
          <svg 
            viewBox="0 0 24 24" 
            style={{ 
              width: '22px', 
              height: '22px', 
              stroke: '#fff', 
              strokeWidth: 2.5, 
              fill: 'none' 
            }}
          >
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        
        {/* Prospects Tab */}
        <button 
          onClick={() => setActiveTab('prospects')}
          data-testid="nav-prospects"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            flex: 1,
            border: 'none',
            background: 'none',
            padding: 0
          }}
        >
          <svg 
            viewBox="0 0 24 24" 
            style={{ 
              width: '22px', 
              height: '22px', 
              strokeWidth: 2, 
              fill: 'none',
              stroke: activeTab === 'prospects' ? 'url(#navGrad)' : '#8A849E'
            }}
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: '600', 
            fontFamily: "'League Spartan', sans-serif",
            letterSpacing: '0.02em',
            color: activeTab === 'prospects' ? '#004aad' : '#8A849E'
          }}>
            Prospects
          </span>
        </button>
      </nav>
    </>
  );
};

export default BottomNav;
