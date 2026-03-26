import { useContext } from 'react';
import { ThemeContext, useTheme } from '../context/ThemeContext';

/**
 * Theme-aware color helper hook
 * Returns color values based on current theme (light/dark)
 */
const useThemeColors = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const colors = {
    light: {
      bg: '#FFFFFF',
      surface: '#F8F9FA',
      surface2: '#F0F1F3',
      text: '#0E0B1E',
      textMid: '#374151',
      textSecondary: '#6B7280',
      muted: '#6B7280',
      mutedDark: '#9CA3AF',
      border: 'rgba(0, 0, 0, 0.08)',
      cardBg: '#FFFFFF',
      cardBorder: 'rgba(0, 0, 0, 0.06)',
      navBg: 'rgba(255, 255, 255, 0.95)',
      inputBg: '#F8F9FA',
      inputBorder: 'rgba(0, 0, 0, 0.12)',
      accent: '#004AAD',
      accentPurple: '#CB6CE6',
      accentGlow: 'rgba(0, 74, 173, 0.15)',
      success: '#22C55E',
      successBg: 'rgba(34, 197, 94, 0.12)',
      warning: '#F59E0B',
      warningBg: 'rgba(245, 158, 11, 0.12)',
      error: '#EF4444',
      errorBg: 'rgba(239, 68, 68, 0.12)',
      gradient: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)'
    },
    dark: {
      bg: '#1A1A24',
      surface: '#2A2A3B',
      surface2: '#2E2E42',
      text: '#FFFFFF',
      textMid: '#D3D3D3',
      textSecondary: '#D3D3D3',
      muted: '#A0A4AE',
      mutedDark: '#9EA3AE',
      border: 'rgba(255, 255, 255, 0.12)',
      cardBg: '#2E2E42',
      cardBorder: 'rgba(255, 255, 255, 0.08)',
      navBg: '#2A2A3B',
      inputBg: '#3C3C55',
      inputBorder: 'rgba(255, 255, 255, 0.15)',
      accent: '#E82EA4',
      accentPurple: '#8A2BE2',
      accentGlow: 'rgba(232, 46, 164, 0.2)',
      success: '#2ECC71',
      successBg: 'rgba(46, 204, 113, 0.12)',
      warning: '#FFC107',
      warningBg: 'rgba(255, 193, 7, 0.12)',
      error: '#F5A6AD',
      errorBg: 'rgba(91, 55, 64, 1)',
      gradient: 'linear-gradient(90deg, #E82EA4 0%, #8A2BE2 100%)'
    }
  };
  
  const currentColors = isDark ? colors.dark : colors.light;
  
  // Color getter function
  const c = (colorName) => currentColors[colorName] || colorName;
  
  return { c, isDark, colors: currentColors };
};

export default useThemeColors;
export { useThemeColors };
