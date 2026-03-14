import React from 'react';
import { Plus } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

/**
 * Segment Tabs Component
 * Today / All Tasks tabs with Add Task button
 */
const SegmentTabs = ({ viewMode, setViewMode, onAddTask }) => {
  const { c, isDark } = useThemeColors();
  const { locale } = useLocale();
  
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
      {/* Today button */}
      <button
        onClick={() => setViewMode('today')}
        style={{
          flex: 1,
          padding: '12px 20px',
          borderRadius: '999px',
          border: 'none',
          background: viewMode === 'today' 
            ? 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)'
            : c('surface'),
          color: viewMode === 'today' ? 'white' : c('muted'),
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: viewMode !== 'today' ? `inset 0 0 0 1px ${c('border')}` : 'none'
        }}
        data-testid="segment-today"
      >
        {locale === 'fr' ? "Aujourd'hui" : 'Today'}
      </button>
      
      {/* All Tasks button */}
      <button
        onClick={() => setViewMode('all')}
        style={{
          flex: 1,
          padding: '12px 20px',
          borderRadius: '999px',
          border: 'none',
          background: viewMode === 'all' 
            ? 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)'
            : c('surface'),
          color: viewMode === 'all' ? 'white' : c('muted'),
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: viewMode !== 'all' ? `inset 0 0 0 1px ${c('border')}` : 'none'
        }}
        data-testid="segment-all-tasks"
      >
        {locale === 'fr' ? 'Toutes les tâches' : 'All tasks'}
      </button>
      
      {/* Add Task Button */}
      <button
        onClick={onAddTask}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          border: 'none',
          background: isDark ? '#1A1A24' : '#0E0B1E',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        data-testid="add-task-button"
      >
        <Plus size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default SegmentTabs;
