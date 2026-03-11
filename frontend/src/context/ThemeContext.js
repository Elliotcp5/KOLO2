import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config/api';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    // Check localStorage first for immediate render without flash
    const stored = localStorage.getItem('kolo_theme');
    return stored || 'light';
  });

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('kolo_theme', theme);
  }, [theme]);

  // Initialize from user data if available
  const initializeFromUser = useCallback((userTheme) => {
    if (userTheme && ['light', 'dark'].includes(userTheme)) {
      setThemeState(userTheme);
    }
  }, []);

  // Change theme and persist to backend
  const changeTheme = useCallback(async (newTheme) => {
    if (!['light', 'dark'].includes(newTheme)) return;
    
    setThemeState(newTheme);
    localStorage.setItem('kolo_theme', newTheme);
    
    // Try to persist to backend
    try {
      const token = localStorage.getItem('session_token');
      if (token) {
        await fetch(`${API_URL}/api/auth/preferences`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ theme_preference: newTheme })
        });
      }
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    changeTheme(newTheme);
  }, [theme, changeTheme]);

  const value = {
    theme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    changeTheme,
    toggleTheme,
    initializeFromUser
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
