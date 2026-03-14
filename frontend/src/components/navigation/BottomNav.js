import React from 'react';
import { Calendar, Users, Plus } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { useThemeColors } from '../../hooks/useThemeColors';

/**
 * Bottom Navigation Component
 * Displays the main navigation with Today, Add (+), and Prospects tabs
 */
const BottomNav = ({ activeTab, setActiveTab, onAddProspect }) => {
  const { locale } = useLocale();
  const { c, isDark } = useThemeColors();
  
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '90px',
      background: isDark ? '#1A1A24' : '#FFFFFF',
      borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      zIndex: 1000
    }}>
      
      {/* Today Tab */}
      <div 
        onClick={() => setActiveTab('today')}
        data-testid="nav-today"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          cursor: 'pointer',
          padding: '8px 16px'
        }}
      >
        {/* Icon container - rounded square with gradient border when active */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: activeTab === 'today' 
            ? 'linear-gradient(135deg, #004AAD 0%, #CB6CE6 100%)'
            : 'transparent',
          padding: activeTab === 'today' ? '2px' : '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            background: activeTab === 'today' 
              ? (isDark ? '#1A1A24' : '#FFFFFF')
              : 'transparent',
            border: activeTab !== 'today' 
              ? `1.5px solid ${isDark ? '#4B5563' : '#D1D5DB'}`
              : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar 
              size={20} 
              strokeWidth={1.5} 
              style={{ 
                color: activeTab === 'today' 
                  ? (isDark ? '#CB6CE6' : '#004AAD')
                  : (isDark ? '#6B7280' : '#9CA3AF')
              }} 
            />
          </div>
        </div>
        <span style={{ 
          fontSize: '11px', 
          fontWeight: '500',
          color: activeTab === 'today' 
            ? (isDark ? '#CB6CE6' : '#004AAD')
            : (isDark ? '#6B7280' : '#9CA3AF')
        }}>
          {locale === 'fr' ? "Aujourd'hui" : 'Today'}
        </span>
      </div>
      
      {/* Central FAB - Circle with gradient */}
      <button
        onClick={() => {
          if ('vibrate' in navigator) navigator.vibrate(8);
          onAddProspect();
        }}
        data-testid="fab-add-prospect"
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #004AAD 0%, #CB6CE6 100%)',
          boxShadow: isDark 
            ? '0 4px 20px rgba(203, 108, 230, 0.5)'
            : '0 4px 20px rgba(0, 74, 173, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          marginTop: '-20px'
        }}
      >
        <Plus size={28} strokeWidth={2.5} style={{ color: 'white' }} />
      </button>
      
      {/* Prospects Tab */}
      <div 
        onClick={() => setActiveTab('prospects')}
        data-testid="nav-prospects"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          cursor: 'pointer',
          padding: '8px 16px'
        }}
      >
        {/* Icon container - rounded square with gradient border when active */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: activeTab === 'prospects' 
            ? 'linear-gradient(135deg, #004AAD 0%, #CB6CE6 100%)'
            : 'transparent',
          padding: activeTab === 'prospects' ? '2px' : '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            background: activeTab === 'prospects' 
              ? (isDark ? '#1A1A24' : '#FFFFFF')
              : 'transparent',
            border: activeTab !== 'prospects' 
              ? `1.5px solid ${isDark ? '#4B5563' : '#D1D5DB'}`
              : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users 
              size={20} 
              strokeWidth={1.5} 
              style={{ 
                color: activeTab === 'prospects' 
                  ? (isDark ? '#CB6CE6' : '#004AAD')
                  : (isDark ? '#6B7280' : '#9CA3AF')
              }} 
            />
          </div>
        </div>
        <span style={{ 
          fontSize: '11px', 
          fontWeight: '500',
          color: activeTab === 'prospects' 
            ? (isDark ? '#CB6CE6' : '#004AAD')
            : (isDark ? '#6B7280' : '#9CA3AF')
        }}>
          Prospects
        </span>
      </div>
    </nav>
  );
};

export default BottomNav;
