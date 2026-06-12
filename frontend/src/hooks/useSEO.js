// Hook SEO multilingue : met à jour title, description, OG tags, html[lang] selon la locale
import { useEffect } from 'react';
import { useLocale } from '../context/LocaleContext';

const SEO_CONTENT = {
  en: {
    title: 'KOLO — The ultimate AI client follow-up for real estate',
    description: "KOLO is the ultimate AI client follow-up for real estate professionals — agencies, networks, developers, property funds, land developers. Auto follow-ups, qualified prospects, +30% sales. Integrates with your CRM. 14-day free trial.",
    ogLocale: 'en_US',
  },
  fr: {
    title: "KOLO — Le suivi client IA ultime pour l'immobilier",
    description: "KOLO est le suivi client IA ultime pour les professionnels de l'immobilier — agences, réseaux, promoteurs, foncières, développeurs fonciers. Relances automatiques, prospects qualifiés, +30 % de ventes. S'intègre à votre CRM. Essai 14 jours gratuit.",
    ogLocale: 'fr_FR',
  },
  es: {
    title: 'KOLO — El seguimiento de clientes con IA definitivo para inmobiliarias',
    description: "KOLO es el seguimiento de clientes con IA definitivo para profesionales inmobiliarios — agencias, redes, promotores, fondos inmobiliarios, desarrolladores. Seguimientos automáticos, prospectos cualificados, +30% de ventas. Se integra con tu CRM. 14 días gratis.",
    ogLocale: 'es_ES',
  },
  de: {
    title: 'KOLO — Das ultimative KI-Kundenmanagement für Immobilien',
    description: "KOLO ist das ultimative KI-Kundenmanagement für Immobilienprofis — Agenturen, Netzwerke, Entwickler, Immobilienfonds, Bodenentwickler. Automatisches Follow-up, qualifizierte Interessenten, +30% Verkäufe. Integriert sich in Ihr CRM. 14 Tage kostenlos.",
    ogLocale: 'de_DE',
  },
  it: {
    title: "KOLO — Il follow-up clienti IA definitivo per l'immobiliare",
    description: "KOLO è il follow-up clienti IA definitivo per i professionisti immobiliari — agenzie, reti, sviluppatori, fondi immobiliari, sviluppatori fondiari. Follow-up automatici, prospect qualificati, +30% di vendite. Si integra con il tuo CRM. Prova 14 giorni gratis.",
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
