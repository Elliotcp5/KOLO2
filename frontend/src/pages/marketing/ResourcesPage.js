import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, Clock } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';
import { useI18n } from './i18n';

const ResourcesContent = () => {
  const { t } = useI18n();
  const items = t('resources.items') || [];
  const categories = t('resources.categories') || [];
  const ALL = categories[0] || 'All';

  const [filter, setFilter] = useState(ALL);
  const [active, setActive] = useState(null);

  // Reset filter when language changes (categories names change)
  React.useEffect(() => {
    setFilter(ALL);
    setActive(null);
  }, [ALL]);

  const filtered = useMemo(() => {
    if (filter === ALL) return items;
    return items.filter((r) => r.cat === filter);
  }, [filter, items, ALL]);

  const activeResource = useMemo(
    () => (active ? items.find((r) => r.id === active) : null),
    [active, items]
  );

  return (
    <>
      <section className="mkt-hero" data-testid="mkt-res-hero">
        <div className="mkt-container mkt-container-narrow" style={{ textAlign: 'center' }}>
          <div className="mkt-eyebrow" style={{ margin: '0 auto 24px', display: 'inline-flex' }}>
            <span className="mkt-eyebrow-dot" />
            {t('resources.eyebrow')}
          </div>
          <h1 className="mkt-h1">
            {t('resources.title_p1')}<br/>
            <em>{t('resources.title_em')}</em>
          </h1>
          <p className="mkt-lead" style={{ margin: '0 auto' }}>{t('resources.lead')}</p>
        </div>
      </section>

      <section className="mkt-section-tight">
        <div className="mkt-container">
          {!activeResource && (
            <>
              <div className="mkt-res-filters" data-testid="mkt-res-filters">
                {categories.map((c, idx) => (
                  <button
                    key={c}
                    className={`mkt-res-filter ${filter === c ? 'active' : ''}`}
                    onClick={() => setFilter(c)}
                    data-testid={`mkt-res-filter-${idx}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="mkt-res-grid" data-testid="mkt-res-grid">
                {filtered.map((r) => (
                  <article
                    key={r.id}
                    className="mkt-res-card mkt-reveal"
                    onClick={() => setActive(r.id)}
                    data-testid={`mkt-res-card-${r.id}`}
                  >
                    <div className="mkt-res-card-meta">
                      <span className="mkt-res-cat">{r.cat}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} /> {r.readTime}
                      </span>
                    </div>
                    <h3>{r.title}</h3>
                    <p>{r.excerpt}</p>
                    <span className="mkt-res-readmore">
                      {t('resources.read_label')} <ArrowRight size={14} strokeWidth={2.5} />
                    </span>
                  </article>
                ))}
              </div>
            </>
          )}

          {activeResource && (
            <div style={{ maxWidth: 760, margin: '0 auto' }} data-testid="mkt-res-article">
              <button
                onClick={() => setActive(null)}
                className="mkt-btn mkt-btn-ghost"
                style={{ marginBottom: 32 }}
                data-testid="mkt-res-back-btn"
              >
                <ChevronLeft size={16} strokeWidth={2.5} /> {t('resources.back')}
              </button>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
                <span className="mkt-res-cat">{activeResource.cat}</span>
                <span style={{ fontSize: 13, color: 'var(--mkt-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} /> {activeResource.readTime}
                </span>
              </div>
              <h1 className="mkt-h2" style={{ marginBottom: 32 }}>{activeResource.title}</h1>
              <div className="mkt-res-article">
                <div className="mkt-prose">
                  {(activeResource.body || []).map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {!activeResource && (
        <section className="mkt-section">
          <div className="mkt-container">
            <div className="mkt-final-cta mkt-reveal">
              <h2>{t('resources.final_title_p1')}<br/><em style={{ fontFamily: 'var(--mkt-font-serif)', fontStyle: 'italic', fontWeight: 400 }}>{t('resources.final_title_em')}</em></h2>
              <p>{t('resources.final_lead')}</p>
              <div className="mkt-cta-row">
                <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-primary" data-testid="mkt-res-final-cta-appstore">
                  {t('resources.final_cta')} <ArrowRight size={16} strokeWidth={2.5} />
                </a>
                <Link to="/comment-kolo" className="mkt-btn mkt-btn-ghost">
                  {t('resources.final_cta_secondary')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
};

const ResourcesPage = () => (
  <MarketingLayout>
    <ResourcesContent />
  </MarketingLayout>
);

export default ResourcesPage;
