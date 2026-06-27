/* ============================================================
   KOLO Marketing — i18n
   Supported: fr (default), en, de, it
   Stored in localStorage 'mkt_lang'
   ============================================================ */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import fr from './locales/fr';
import en from './locales/en';
import de from './locales/de';
import it from './locales/it';

const DICTIONARIES = { fr, en, de, it };

export const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'it', label: 'IT' },
];

const detectLang = () => {
  if (typeof window === 'undefined') return 'fr';
  const stored = window.localStorage.getItem('mkt_lang');
  if (stored && DICTIONARIES[stored]) return stored;
  const browser = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  return DICTIONARIES[browser] ? browser : 'fr';
};

const I18nContext = createContext({
  lang: 'fr',
  setLang: () => {},
  t: (k) => k,
});

export const I18nProvider = ({ children }) => {
  const [lang, setLangState] = useState(detectLang());

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
    if (typeof window !== 'undefined') window.localStorage.setItem('mkt_lang', lang);
  }, [lang]);

  const value = useMemo(() => {
    const dict = DICTIONARIES[lang] || DICTIONARIES.fr;
    const t = (key) => {
      if (key == null) return '';
      // Support dotted paths
      const parts = key.split('.');
      let v = dict;
      for (const p of parts) {
        if (v == null) return key;
        v = v[p];
      }
      if (v == null) {
        // Fallback to French
        let fb = DICTIONARIES.fr;
        for (const p of parts) {
          if (fb == null) return key;
          fb = fb[p];
        }
        return fb == null ? key : fb;
      }
      return v;
    };
    return { lang, setLang: setLangState, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
