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

// EU countries for pricing
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

export const LocaleProvider = ({ children }) => {
  const [locale, setLocale] = useState('en');
  const [country, setCountry] = useState('US');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState(9.99);
  const [symbol, setSymbol] = useState('$');

  useEffect(() => {
    // Detect browser locale
    const browserLocale = navigator.language || navigator.userLanguage || 'en-US';
    const lang = browserLocale.split('-')[0].toLowerCase();
    const regionFromLocale = browserLocale.split('-')[1]?.toUpperCase();
    
    // Set locale (only support en and fr for now)
    if (lang === 'fr') {
      setLocale('fr');
      // Default to France for French speakers
      if (!regionFromLocale || regionFromLocale === 'FR') {
        setCountry('FR');
        setCurrency('EUR');
        setSymbol('€');
      }
    } else {
      setLocale('en');
    }

    // Set country/currency based on locale region
    if (regionFromLocale) {
      if (regionFromLocale === 'GB') {
        setCountry('GB');
        setCurrency('GBP');
        setSymbol('£');
      } else if (EU_COUNTRIES.includes(regionFromLocale)) {
        setCountry(regionFromLocale);
        setCurrency('EUR');
        setSymbol('€');
      }
    }

    // Fetch geo info from backend (will override if available)
    const fetchGeo = async () => {
      try {
        const API_URL = process.env.REACT_APP_BACKEND_URL;
        const response = await fetch(`${API_URL}/api/geo?locale=${browserLocale}&country=${regionFromLocale || ''}`);
        if (response.ok) {
          const data = await response.json();
          // Only update if backend returns a valid country
          if (data.country && data.country !== 'US') {
            setCountry(data.country);
            setCurrency(data.currency);
            setAmount(data.amount);
            setSymbol(data.symbol);
          }
        }
      } catch (error) {
        console.error('Failed to fetch geo info:', error);
      }
    };

    fetchGeo();
  }, []);

  // Get translation
  const t = (key) => {
    return translations[locale]?.[key] || translations.en[key] || key;
  };

  // Format price
  const formatPrice = (value = amount) => {
    const localeCode = locale === 'fr' ? 'fr-FR' : (currency === 'GBP' ? 'en-GB' : 'en-US');
    
    try {
      return new Intl.NumberFormat(localeCode, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${symbol}${value.toFixed(2)}`;
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
