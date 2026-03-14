import React from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { getInitials } from '../../utils/helpers';

/**
 * Profile Button Component
 * Shows user initials in a gradient pill with "My profile" text
 */
const ProfileButton = ({ userName, onClick }) => {
  const { c, isDark } = useThemeColors();
  const { locale } = useLocale();
  const userInitials = getInitials(userName);
  
  return (
    <button 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        padding: '6px 14px 6px 6px',
        background: c('surface'),
        border: `1px solid ${c('border')}`,
        borderRadius: '999px',
        cursor: 'pointer'
      }}
      onClick={onClick}
      data-testid="my-profile-button"
    >
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #004AAD 0%, #CB6CE6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '11px',
        fontWeight: '700'
      }}>
        {userInitials || ''}
      </div>
      <span style={{ color: c('text'), fontSize: '14px', fontWeight: '500' }}>
        {locale === 'fr' ? 'Mon profil' : 'My profile'}
      </span>
    </button>
  );
};

export default ProfileButton;
