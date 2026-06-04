// v2.1.0 - Cache bust
import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from '../i18n/translations';

const LocaleContext = createContext();

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};

// EU countries (Euro zone)
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// Language mapping by country (exhaustive, falls back to 'en')
const COUNTRY_LANGUAGES = {
  // French-speaking
  'FR': 'fr', 'BE': 'fr', 'LU': 'fr', 'MC': 'fr',
  // Italian
  'IT': 'it', 'SM': 'it', 'VA': 'it',
  // German-speaking
  'DE': 'de', 'AT': 'de', 'LI': 'de', 'CH': 'de',
  // English
  'GB': 'en', 'IE': 'en', 'US': 'en', 'CA': 'en', 'AU': 'en', 'NZ': 'en',
};

// Currency + symbol mapping by country
const COUNTRY_CURRENCY = {
  'GB': { currency: 'GBP', symbol: '£' },
  'CH': { currency: 'EUR', symbol: '€' }, // Swiss → EUR for simplicity (KOLO bills in EUR)
  'US': { currency: 'USD', symbol: '$' },
  'CA': { currency: 'USD', symbol: '$' },
  'AU': { currency: 'USD', symbol: '$' },
};
// All EU countries get EUR/€ — handled in the resolver below.

function resolveCountryToLocale(countryCode) {
  if (!countryCode) return 'en';
  return COUNTRY_LANGUAGES[countryCode.toUpperCase()] || 'en';
}

function resolveCountryToCurrency(countryCode) {
  if (!countryCode) return { currency: 'USD', symbol: '$' };
  const cc = countryCode.toUpperCase();
  if (COUNTRY_CURRENCY[cc]) return COUNTRY_CURRENCY[cc];
  if (EU_COUNTRIES.includes(cc)) return { currency: 'EUR', symbol: '€' };
  return { currency: 'USD', symbol: '$' };
}

export const LocaleProvider = ({ children }) => {
  const [locale, setLocale] = useState('en');
  const [country, setCountry] = useState('US');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState(999); // 9.99 in cents
  const [symbol, setSymbol] = useState('$');

  useEffect(() => {
    // ===== LOCALE / CURRENCY AUTO-DETECTION =====
    // Priority order:
    //   1. URL override (?locale=...&country=...)  -> testing only
    //   2. User manual choice (localStorage flag)  -> always respected
    //   3. Backend /api/geo (uses Cloudflare CF-IPCountry in prod)
    //   4. Public ipapi.co fallback                -> works in preview / non-CF
    //   5. Browser navigator.language             -> last resort
    //   6. Default: English + USD
    const urlParams = new URLSearchParams(window.location.search);
    const localeOverride = urlParams.get('locale');
    const countryOverride = urlParams.get('country');

    const userChangedLang = localStorage.getItem('kolo_locale_manual') === 'true';
    const userChangedCurrency = localStorage.getItem('kolo_currency_manual') === 'true';
    const savedLocale = localStorage.getItem('kolo_locale');
    const savedCurrency = localStorage.getItem('kolo_currency');

    // Browser baseline
    const browserLocale = navigator.language || navigator.userLanguage || 'en-US';
    const browserLang = browserLocale.split('-')[0].toLowerCase();
    const browserRegion = browserLocale.split('-')[1]?.toUpperCase();

    // ----- Apply initial best guess from browser (synchronous) -----
    const guessedRegion = countryOverride || browserRegion;
    const guessedLang =
      localeOverride ||
      (userChangedLang && savedLocale) ||
      (guessedRegion ? resolveCountryToLocale(guessedRegion) : null) ||
      browserLang;
    const supportedLocale = ['en', 'fr', 'de', 'it'].includes(guessedLang) ? guessedLang : 'en';
    setLocale(supportedLocale);
    if (!userChangedLang) localStorage.setItem('kolo_locale', supportedLocale);

    // If locale was set via URL param, persist it as a manual choice so it survives
    // post-login redirects (which strip query strings).
    if (localeOverride && ['en', 'fr', 'de', 'it'].includes(localeOverride)) {
      localStorage.setItem('kolo_locale', localeOverride);
      localStorage.setItem('kolo_locale_manual', 'true');
    }

    if (guessedRegion) {
      setCountry(guessedRegion);
      if (!userChangedCurrency) {
        const cur = resolveCountryToCurrency(guessedRegion);
        setCurrency(cur.currency);
        setSymbol(cur.symbol);
      }
    } else if (!userChangedCurrency && savedCurrency) {
      setCurrency(savedCurrency);
    }

    // ----- Async geo refinement: backend first, then public IP fallback -----
    const applyGeo = (countryCode) => {
      if (!countryCode) return;
      const cc = countryCode.toUpperCase();
      setCountry(cc);

      if (!userChangedLang) {
        const lang = resolveCountryToLocale(cc);
        if (['en', 'fr', 'de', 'it'].includes(lang)) {
          setLocale(lang);
          localStorage.setItem('kolo_locale', lang);
        }
      }
      if (!userChangedCurrency) {
        const cur = resolveCountryToCurrency(cc);
        setCurrency(cur.currency);
        setSymbol(cur.symbol);
        localStorage.setItem('kolo_currency', cur.currency);
      }
    };

    const fetchGeo = async () => {
      // 1. Try our own backend (uses Cloudflare header in prod)
      try {
        const apiUrl = 'https://trykolo.io';
        const response = await fetch(
          `${apiUrl}/api/geo?locale=${browserLocale}&country=${browserRegion || ''}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.amount) setAmount(data.amount);
          // Only trust the country if it's not the fallback 'US' from missing header
          if (data.country && data.country !== 'US') {
            applyGeo(data.country);
            return;
          }
        }
      } catch (_) { /* silent */ }

      // 2. Public IP geo fallback (free, no key, 1000/day)
      try {
        const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          if (d && d.country_code) applyGeo(d.country_code);
        }
      } catch (_) { /* silent — keep browser guess */ }
    };

    if (!localeOverride && !countryOverride) fetchGeo();
  }, []);

  // Get translation
  const t = (key) => {
    return translations[locale]?.[key] || translations.en[key] || key;
  };

  // Change language manually
  const changeLanguage = (newLocale) => {
    if (['en', 'fr', 'de', 'it'].includes(newLocale)) {
      setLocale(newLocale);
      localStorage.setItem('kolo_locale', newLocale);
      localStorage.setItem('kolo_locale_manual', 'true'); // Mark as manually changed
    }
  };

  // Change currency manually (sticks across sessions, overrides geo detection)
  const changeCurrency = (newCurrency) => {
    const symbols = { EUR: '€', GBP: '£', USD: '$', CHF: 'CHF' };
    if (symbols[newCurrency]) {
      setCurrency(newCurrency);
      setSymbol(symbols[newCurrency]);
      localStorage.setItem('kolo_currency', newCurrency);
      localStorage.setItem('kolo_currency_manual', 'true');
    }
  };

  // Format price (amount is in cents, divide by 100 for display)
  const formatPrice = (value = amount) => {
    const displayValue = value / 100;
    const localeCode = locale === 'fr' ? 'fr-FR' : (currency === 'GBP' ? 'en-GB' : 'en-US');
    
    try {
      return new Intl.NumberFormat(localeCode, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      }).format(displayValue);
    } catch {
      return `${symbol}${displayValue.toFixed(2)}`;
    }
  };

  // Format date with weekday
  const formatDate = (date = new Date()) => {
    const localeCode = locale === 'fr' ? 'fr-FR' : 'en-US';
    
    try {
      return new Intl.DateTimeFormat(localeCode, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  };

  const value = {
    locale,
    setLocale,
    changeLanguage,
    changeCurrency,
    country,
    currency,
    setCurrency,
    amount,
    symbol,
    t,
    formatPrice,
    formatDate,
  };

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
};

export default LocaleContext;
