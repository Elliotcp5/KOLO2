/**
 * useDocumentHead — sets/updates document title, meta description,
 * OpenGraph/Twitter tags and a JSON-LD Article block for SEO.
 *
 * Used by the blog pages. Removes the JSON-LD block on unmount so other
 * routes don't keep a stale Article schema.
 */
import { useEffect } from 'react';

const upsertMeta = (selector, attrs) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    Object.entries(attrs).forEach(([k, v]) => {
      if (k !== 'content') el.setAttribute(k, v);
    });
    document.head.appendChild(el);
  }
  el.setAttribute('content', attrs.content);
  return el;
};

const upsertLinkCanonical = (href) => {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  return el;
};

export default function useDocumentHead({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  keywords,
  jsonLd,
  locale = 'en',
}) {
  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = title;

    const created = [];

    if (description) {
      upsertMeta('meta[name="description"]', { name: 'description', content: description });
    }
    if (keywords && keywords.length) {
      upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords.join(', ') });
    }
    if (canonical) upsertLinkCanonical(canonical);

    // Open Graph
    if (title) upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    if (description) upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: ogType });
    if (canonical) upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    if (ogImage) upsertMeta('meta[property="og:image"]', { property: 'og:image', content: ogImage });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: locale });

    // Twitter
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    if (title) upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    if (description) upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    if (ogImage) upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: ogImage });

    // JSON-LD
    let scriptEl = null;
    if (jsonLd) {
      scriptEl = document.createElement('script');
      scriptEl.type = 'application/ld+json';
      scriptEl.id = 'kolo-blog-jsonld';
      scriptEl.text = JSON.stringify(jsonLd);
      document.head.appendChild(scriptEl);
      created.push(scriptEl);
    }

    return () => {
      document.title = previousTitle;
      created.forEach((el) => el.parentNode && el.parentNode.removeChild(el));
    };
  }, [title, description, canonical, ogImage, ogType, keywords, jsonLd, locale]);
}
