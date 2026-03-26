import React from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

/**
 * Stats Cards Component
 * Shows task completion, prospects count, and pending tasks
 */
const StatsCards = ({ stats }) => {
  const { c, isDark } = useThemeColors();
  const { locale } = useLocale();
  
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
      {/* Done */}
      <div style={{
        flex: 1,
        background: c('surface'),
        border: `1px solid ${c('border')}`,
        borderRadius: '14px',
        padding: '16px',
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: '28px', 
          fontWeight: '800', 
          color: c('text'), 
          fontFamily: 'var(--font-heading)' 
        }}>
          {stats.completedToday}
          <span style={{ color: c('muted'), fontWeight: '400' }}> / {stats.totalToday}</span>
        </div>
        <div style={{ fontSize: '13px', color: c('muted'), fontWeight: '500' }}>
          {locale === 'fr' ? 'Faites' : 'Done'}
        </div>
      </div>
      
      {/* Prospects - Gradient text */}
      <div style={{
        flex: 1,
        background: c('surface'),
        border: `1px solid ${c('border')}`,
        borderRadius: '14px',
        padding: '16px',
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: '28px', 
          fontWeight: '800', 
          fontFamily: 'var(--font-heading)',
          background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          {stats.activeProspects}
        </div>
        <div style={{ fontSize: '13px', color: c('muted'), fontWeight: '500' }}>
          Prospects
        </div>
      </div>
      
      {/* To do */}
      <div style={{
        flex: 1,
        background: c('surface'),
        border: `1px solid ${c('border')}`,
        borderRadius: '14px',
        padding: '16px',
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: '28px', 
          fontWeight: '800', 
          color: '#F59E0B', 
          fontFamily: 'var(--font-heading)' 
        }}>
          {stats.totalToday - stats.completedToday}
        </div>
        <div style={{ fontSize: '13px', color: c('muted'), fontWeight: '500' }}>
          {locale === 'fr' ? 'À faire' : 'To do'}
        </div>
      </div>
    </div>
  );
};

export default StatsCards;
