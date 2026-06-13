import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { BLOG_POSTS } from '../data/blogPosts';
import useDocumentHead from '../hooks/useDocumentHead';
import '../styles/blog.css';

const INDEX_I18N = {
  fr: {
    eyebrow: 'Le blog KOLO',
    title: 'Ressources pour des équipes commerciales qui closent.',
    sub: "Des guides concrets, pas de la pub : tactiques de suivi, bonnes pratiques de relance, pilotage commercial et adoption raisonnée de l'IA.",
    back: 'Retour à KOLO',
    cta: 'Adopter KOLO',
    read: 'Lire',
    minRead: 'min de lecture',
    siteName: 'KOLO',
    metaTitle: 'Blog KOLO — Ressources pour équipes commerciales',
    metaDesc: "Articles, guides et bonnes pratiques pour piloter un suivi client moderne : relance, KPIs commerciaux, IA dans la vente, choix de canal.",
  },
  en: {
    eyebrow: 'The KOLO blog',
    title: 'Resources for sales teams that close.',
    sub: "Concrete guides, no fluff: follow-up tactics, sales playbooks, pipeline steering and smart AI adoption.",
    back: 'Back to KOLO',
    cta: 'Adopt KOLO',
    read: 'Read',
    minRead: 'min read',
    siteName: 'KOLO',
    metaTitle: 'KOLO Blog — Resources for modern sales teams',
    metaDesc: "Articles, guides and best practices to steer a modern client follow-up: prospecting, sales KPIs, AI in sales, channel choice.",
  },
  it: {
    eyebrow: 'Il blog KOLO',
    title: 'Risorse per team commerciali che chiudono.',
    sub: "Guide concrete, non pubblicità: tattiche di follow-up, playbook commerciali, pilotaggio della pipeline e adozione intelligente dell'IA.",
    back: 'Torna a KOLO',
    cta: 'Adottare KOLO',
    read: 'Leggi',
    minRead: 'min di lettura',
    siteName: 'KOLO',
    metaTitle: 'Blog KOLO — Risorse per team commerciali moderni',
    metaDesc: "Articoli, guide e buone pratiche per gestire un follow-up clienti moderno: prospezione, KPI commerciali, IA nelle vendite, scelta del canale.",
  },
  de: {
    eyebrow: 'Der KOLO-Blog',
    title: 'Ressourcen für Vertriebsteams, die abschließen.',
    sub: "Konkrete Leitfäden, kein Marketing-Geschwafel: Follow-up-Taktiken, Vertriebs-Playbooks, Pipeline-Steuerung und intelligente KI-Adoption.",
    back: 'Zurück zu KOLO',
    cta: 'KOLO einführen',
    read: 'Lesen',
    minRead: 'Min. Lesezeit',
    siteName: 'KOLO',
    metaTitle: 'KOLO Blog — Ressourcen für moderne Vertriebsteams',
    metaDesc: "Artikel, Leitfäden und Best Practices für modernes Kunden-Follow-up: Akquise, Vertriebs-KPIs, KI im Vertrieb, Kanalwahl.",
  },
};

const langForLocale = (locale) => ({ fr: 'fr_FR', en: 'en_US', it: 'it_IT', de: 'de_DE' }[locale] || 'en_US');

export default function BlogIndex() {
  const { locale } = useLocale();
  const lng = INDEX_I18N[locale] ? locale : 'en';
  const t = INDEX_I18N[lng];
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://trykolo.io';

  // Sorted by date desc
  const posts = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: t.metaTitle,
    description: t.metaDesc,
    url: `${origin}/blog`,
    inLanguage: lng,
    publisher: {
      '@type': 'Organization',
      name: 'KOLO',
      url: origin,
      logo: { '@type': 'ImageObject', url: `${origin}/logo512.png` },
    },
    blogPost: posts.map((p) => {
      const i = p.i18n[lng] || p.i18n.en;
      return {
        '@type': 'BlogPosting',
        headline: i.title,
        description: i.excerpt,
        datePublished: p.date,
        url: `${origin}/blog/${p.slug}`,
      };
    }),
  };

  useDocumentHead({
    title: t.metaTitle,
    description: t.metaDesc,
    canonical: `${origin}/blog`,
    ogImage: `${origin}/og-image-v2.png`,
    ogType: 'website',
    keywords: ['blog commercial', 'suivi client', 'relance prospect', 'IA prospection', 'pipeline commercial'],
    jsonLd,
    locale: langForLocale(lng),
  });

  return (
    <div className="blog-page" data-testid="blog-index-page">
      <nav className="blog-nav">
        <div className="blog-nav-inner">
          <Link to="/" className="blog-logo" data-testid="blog-nav-home">
            <span className="blog-logo-dot" />
            KOLO
          </Link>
          <Link to="/" className="blog-nav-back" data-testid="blog-nav-back">
            <ArrowLeft size={14} />
            <span>{t.back}</span>
          </Link>
          <Link to="/business#contact" className="blog-nav-cta" data-testid="blog-nav-cta">
            {t.cta}
            <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      <header className="blog-index-header">
        <div className="blog-eyebrow">{t.eyebrow}</div>
        <h1 className="blog-index-title">{t.title}</h1>
        <p className="blog-index-sub">{t.sub}</p>
      </header>

      <section className="blog-grid" data-testid="blog-list">
        {posts.map((post) => {
          const i = post.i18n[lng] || post.i18n.en;
          const cat = post.category[lng] || post.category.en;
          return (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="blog-card"
              data-testid={`blog-card-${post.slug}`}
            >
              <div className="blog-card-meta">
                <span className="blog-card-cat">{cat}</span>
                <span className="blog-card-dot">·</span>
                <span>{post.readingMinutes} {t.minRead}</span>
              </div>
              <h2 className="blog-card-title">{i.title}</h2>
              <p className="blog-card-excerpt">{i.excerpt}</p>
              <span className="blog-card-read">
                {t.read} <ArrowRight size={14} />
              </span>
            </Link>
          );
        })}
      </section>

      <div className="blog-foot">
        © 2026 KOLO — <Link to="/">trykolo.io</Link>
      </div>
    </div>
  );
}
