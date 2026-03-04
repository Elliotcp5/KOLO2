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

// Language mapping by country
const COUNTRY_LANGUAGES = {
  'FR': 'fr', 'BE': 'fr', 'LU': 'fr', 'MC': 'fr', // French-speaking
  'IT': 'en', 'SM': 'en', // Italian - fallback to English
  'DE': 'en', 'AT': 'en', 'LI': 'en', 'CH': 'en', // German/Swiss - fallback to English
  'ES': 'en', 'MX': 'en', 'AR': 'en', // Spanish - fallback to English
  'PT': 'en', 'BR': 'en', // Portuguese - fallback to English
  'GB': 'en', 'US': 'en', 'CA': 'en', 'AU': 'en', // English
};

export const LocaleProvider = ({ children }) => {
  const [locale, setLocale] = useState('en');
  const [country, setCountry] = useState('US');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState(999); // 9.99 in cents
  const [symbol, setSymbol] = useState('$');

  useEffect(() => {
    // Check URL for locale override (for testing)
    const urlParams = new URLSearchParams(window.location.search);
    const localeOverride = urlParams.get('locale');
    const countryOverride = urlParams.get('country');
    
    // PRIORITY 1: Check if user manually changed language (this ALWAYS wins)
    const userChangedLang = localStorage.getItem('kolo_locale_manual');
    const savedLocale = localStorage.getItem('kolo_locale');
    
    // Detect browser locale for fallback
    const browserLocale = navigator.language || navigator.userLanguage || 'en-US';
    const browserLang = browserLocale.split('-')[0].toLowerCase();
    const regionFromLocale = countryOverride || browserLocale.split('-')[1]?.toUpperCase();
    
    // Priority order: URL override > manual saved locale > browser detection
    let detectedLang;
    if (localeOverride) {
      // URL override for testing
      detectedLang = localeOverride;
    } else if (userChangedLang && savedLocale) {
      // User manually changed language - ALWAYS respect this
      detectedLang = savedLocale;
    } else {
      // Browser detection
      detectedLang = browserLang;
    }
    
    // Fallback for unsupported languages
    if (!['en', 'fr'].includes(detectedLang)) {
      // Check if country suggests a language
      detectedLang = COUNTRY_LANGUAGES[regionFromLocale] || 'en';
    }
    
    // Final supported locale
    const supportedLocale = ['en', 'fr'].includes(detectedLang) ? detectedLang : 'en';
    setLocale(supportedLocale);
    // Only save if not manually set (to not override user choice)
    if (!userChangedLang) {
      localStorage.setItem('kolo_locale', supportedLocale);
    }

    // Set country/currency based on region
    if (regionFromLocale) {
      setCountry(regionFromLocale);
      
      if (regionFromLocale === 'GB') {
        setCurrency('GBP');
        setSymbol('£');
      } else if (regionFromLocale === 'CH') {
        // Switzerland - keep EUR for simplicity (9.99€)
        setCurrency('EUR');
        setSymbol('€');
      } else if (EU_COUNTRIES.includes(regionFromLocale)) {
        setCurrency('EUR');
        setSymbol('€');
      } else if (regionFromLocale === 'US' || regionFromLocale === 'CA') {
        setCurrency('USD');
        setSymbol('$');
      }
    } else if (browserLang === 'fr') {
      // If browser is French but no region, assume France
      setCountry('FR');
      setCurrency('EUR');
      setSymbol('€');
    }

    // Fetch geo info from backend (will override if available)
    // BUT NOT the locale if user manually changed it
    const fetchGeo = async () => {
      try {
        const hostname = window.location.hostname;
        let apiUrl = '';
        if (hostname === 'trykolo.io' || hostname === 'www.trykolo.io') {
          apiUrl = '';
        } else if (hostname.includes('.preview.emergentagent.com')) {
          apiUrl = `https://${hostname}`;
        } else {
          apiUrl = process.env.REACT_APP_BACKEND_URL || '';
        }
        
        const response = await fetch(`${apiUrl}/api/geo?locale=${browserLocale}&country=${regionFromLocale || ''}`);
        if (response.ok) {
          const data = await response.json();
          if (data.country) {
            setCountry(data.country);
            setCurrency(data.currency);
            setAmount(data.amount);
            setSymbol(data.symbol);
            
            // Update locale based on detected country ONLY if user didn't manually change it
            if (!userChangedLang) {
              const countryLang = COUNTRY_LANGUAGES[data.country];
              if (countryLang && ['en', 'fr'].includes(countryLang)) {
                setLocale(countryLang);
                localStorage.setItem('kolo_locale', countryLang);
              }
            }
          }
        }
      } catch (e) {
        // Silent fail - use browser detection
      }
    };

    fetchGeo();
  }, []);

  // Get translation
  const t = (key) => {
    return translations[locale]?.[key] || translations.en[key] || key;
  };

  // Change language manually
  const changeLanguage = (newLocale) => {
    if (['en', 'fr'].includes(newLocale)) {
      setLocale(newLocale);
      localStorage.setItem('kolo_locale', newLocale);
      localStorage.setItem('kolo_locale_manual', 'true'); // Mark as manually changed
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
    country,
    currency,
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
