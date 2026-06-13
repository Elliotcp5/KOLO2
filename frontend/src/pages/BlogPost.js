import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Clock } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { BLOG_POSTS, BLOG_AUTHOR } from '../data/blogPosts';
import useDocumentHead from '../hooks/useDocumentHead';
import '../styles/blog.css';

const POST_I18N = {
  fr: {
    backToBlog: 'Blog',
    home: 'Accueil',
    by: 'Par',
    minRead: 'min de lecture',
    ctaEyebrow: 'Prêt à passer à l’action ?',
    ctaTitle: 'Adoptez KOLO dans votre entreprise.',
    ctaSub: "Demandez une démo personnalisée. Notre équipe vous accompagne pour déployer KOLO sur l'ensemble de votre force commerciale.",
    ctaBtn: 'Contacter l’équipe KOLO',
    siteName: 'KOLO',
  },
  en: {
    backToBlog: 'Blog',
    home: 'Home',
    by: 'By',
    minRead: 'min read',
    ctaEyebrow: 'Ready to act?',
    ctaTitle: 'Adopt KOLO in your company.',
    ctaSub: "Book a personalized demo. Our team will help you roll out KOLO across your entire sales force.",
    ctaBtn: 'Contact the KOLO team',
    siteName: 'KOLO',
  },
  it: {
    backToBlog: 'Blog',
    home: 'Home',
    by: 'Di',
    minRead: 'min di lettura',
    ctaEyebrow: 'Pronto a passare all’azione?',
    ctaTitle: 'Adotta KOLO nella tua azienda.',
    ctaSub: "Richiedi una demo personalizzata. Il nostro team ti accompagna nell'implementazione di KOLO su tutta la tua forza commerciale.",
    ctaBtn: 'Contatta il team KOLO',
    siteName: 'KOLO',
  },
  de: {
    backToBlog: 'Blog',
    home: 'Start',
    by: 'Von',
    minRead: 'Min. Lesezeit',
    ctaEyebrow: 'Bereit zu handeln?',
    ctaTitle: 'Führen Sie KOLO in Ihrem Unternehmen ein.',
    ctaSub: "Vereinbaren Sie eine persönliche Demo. Unser Team begleitet Sie bei der Einführung von KOLO in Ihrer gesamten Vertriebsmannschaft.",
    ctaBtn: 'Das KOLO-Team kontaktieren',
    siteName: 'KOLO',
  },
};

const langForLocale = (locale) => ({ fr: 'fr_FR', en: 'en_US', it: 'it_IT', de: 'de_DE' }[locale] || 'en_US');

const formatDate = (iso, locale) => {
  try {
    return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : locale, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return iso;
  }
};

const Section = ({ section }) => {
  switch (section.type) {
    case 'h2':
      return <h2>{section.content}</h2>;
    case 'h3':
      return <h3>{section.content}</h3>;
    case 'p':
      return <p dangerouslySetInnerHTML={{ __html: section.content }} />;
    case 'ul':
      return (
        <ul>
          {section.content.map((it, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol>
          {section.content.map((it, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ol>
      );
    case 'quote':
      return <blockquote>{section.content}</blockquote>;
    default:
      return null;
  }
};

export default function BlogPost() {
  const { slug } = useParams();
  const { locale } = useLocale();
  const lng = POST_I18N[locale] ? locale : 'en';
  const t = POST_I18N[lng];

  const post = BLOG_POSTS.find((p) => p.slug === slug);

  const i = post ? (post.i18n[lng] || post.i18n.en) : null;
  const cat = post ? (post.category[lng] || post.category.en) : '';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://trykolo.io';
  const url = post ? `${origin}/blog/${post.slug}` : `${origin}/blog`;

  const jsonLd = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: i.title,
        description: i.excerpt,
        datePublished: post.date,
        dateModified: post.date,
        author: {
          '@type': 'Organization',
          name: BLOG_AUTHOR,
          url: origin,
        },
        publisher: {
          '@type': 'Organization',
          name: 'KOLO',
          url: origin,
          logo: { '@type': 'ImageObject', url: `${origin}/logo512.png` },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        inLanguage: lng,
        keywords: post.keywords.join(', '),
        image: `${origin}/og-image-v2.png`,
      }
    : null;

  useDocumentHead({
    title: post ? `${i.title} — ${t.siteName}` : t.siteName,
    description: post ? i.excerpt : '',
    canonical: url,
    ogImage: `${origin}/og-image-v2.png`,
    ogType: 'article',
    keywords: post ? post.keywords : [],
    jsonLd,
    locale: langForLocale(lng),
  });

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <div className="blog-page" data-testid="blog-post-page">
      <nav className="blog-nav">
        <div className="blog-nav-inner">
          <Link to="/" className="blog-logo" data-testid="blog-nav-home">
            <span className="blog-logo-dot" />
            KOLO
          </Link>
          <Link to="/blog" className="blog-nav-back" data-testid="blog-back-to-list">
            <ArrowLeft size={14} />
            <span>{t.backToBlog}</span>
          </Link>
          <Link to="/business#contact" className="blog-nav-cta" data-testid="blog-nav-cta">
            {t.ctaBtn.split(' ')[0]}
            <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      <article className="blog-article">
        <div className="blog-breadcrumb">
          <Link to="/">{t.home}</Link>
          <span className="blog-breadcrumb-sep">/</span>
          <Link to="/blog">{t.backToBlog}</Link>
        </div>

        <div className="blog-article-cat">{cat}</div>
        <h1 className="blog-article-title">{i.title}</h1>

        <div className="blog-article-meta">
          <span>{t.by} {BLOG_AUTHOR}</span>
          <span className="blog-article-meta-dot" />
          <span>{formatDate(post.date, lng)}</span>
          <span className="blog-article-meta-dot" />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} /> {post.readingMinutes} {t.minRead}
          </span>
        </div>

        <div className="blog-article-body">
          {i.sections.map((s, idx) => (
            <Section key={idx} section={s} />
          ))}
        </div>
      </article>

      <div className="blog-cta">
        <div className="blog-cta-inner">
          <div className="blog-cta-eyebrow">{t.ctaEyebrow}</div>
          <h3 className="blog-cta-title">{t.ctaTitle}</h3>
          <p className="blog-cta-sub">{t.ctaSub}</p>
          <Link
            to="/business#contact"
            className="blog-cta-btn"
            data-testid="blog-cta-contact"
          >
            {t.ctaBtn}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="blog-foot">
        © 2026 KOLO — <Link to="/">trykolo.io</Link>
      </div>
    </div>
  );
}
