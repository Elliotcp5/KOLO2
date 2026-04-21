// Hook SEO multilingue : met à jour title, description, OG tags, html[lang] selon la locale
import { useEffect } from 'react';
import { useLocale } from '../context/LocaleContext';

const SEO_CONTENT = {
  en: {
    title: 'KOLO — AI CRM for real estate agents | Close more deals',
    description: 'KOLO is the AI-powered CRM built for real estate agents. Never miss a prospect, automate follow-ups, close more deals. Free 14-day trial, no credit card.',
    ogLocale: 'en_US',
  },
  fr: {
    title: 'KOLO — Le CRM IA des agents immobiliers | Closez plus de ventes',
    description: "KOLO est le CRM intelligent pensé pour les agents immobiliers. Ne manquez plus un prospect, automatisez vos relances, closez plus de deals. Essai gratuit 14 jours, sans CB.",
    ogLocale: 'fr_FR',
  },
  es: {
    title: 'KOLO — CRM con IA para agentes inmobiliarios | Cierra más ventas',
    description: 'KOLO es el CRM con inteligencia artificial diseñado para agentes inmobiliarios. No pierdas ningún cliente potencial, automatiza el seguimiento y cierra más ventas. Prueba gratuita 14 días, sin tarjeta.',
    ogLocale: 'es_ES',
  },
  de: {
    title: 'KOLO — KI-CRM für Immobilienmakler | Mehr Abschlüsse',
    description: 'KOLO ist das KI-gestützte CRM für Immobilienmakler. Keinen Lead mehr verpassen, Follow-ups automatisieren, mehr Abschlüsse erzielen. 14 Tage kostenlos, ohne Kreditkarte.',
    ogLocale: 'de_DE',
  },
  it: {
    title: 'KOLO — CRM con IA per agenti immobiliari | Chiudi più affari',
    description: "KOLO è il CRM con intelligenza artificiale pensato per gli agenti immobiliari. Non perdere mai un contatto, automatizza i follow-up e chiudi più affari. Prova gratuita 14 giorni, senza carta.",
    ogLocale: 'it_IT',
  },
};

function setMeta(selector, attr, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

export function useSEO() {
  const { locale } = useLocale();

  useEffect(() => {
    const seo = SEO_CONTENT[locale] || SEO_CONTENT.en;
    document.documentElement.lang = locale || 'en';
    document.title = seo.title;
    setMeta('meta[name="description"]', 'content', seo.description);
    setMeta('meta[name="title"]', 'content', seo.title);
    setMeta('meta[property="og:title"]', 'content', seo.title);
    setMeta('meta[property="og:description"]', 'content', seo.description);
    setMeta('meta[property="og:locale"]', 'content', seo.ogLocale);
    setMeta('meta[name="twitter:title"]', 'content', seo.title);
    setMeta('meta[name="twitter:description"]', 'content', seo.description);
  }, [locale]);
}
