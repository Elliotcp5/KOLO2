import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Mic, Target, Check, TrendingUp, Clock } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';
import LogoMarquee from './components/LogoMarquee';
import PhoneFrame from './components/PhoneFrame';

const HomePage = () => {
  return (
    <MarketingLayout>
      {/* ============ HERO ============ */}
      <section className="mkt-hero" data-testid="mkt-home-hero">
        <div className="mkt-container">
          <div className="mkt-hero-inner">
            <div>
              <span className="mkt-eyebrow" data-testid="mkt-hero-eyebrow">
                <span className="mkt-eyebrow-dot" />
                Nouvelle version — disponible sur l'App Store
              </span>
              <h1 className="mkt-h1" data-testid="mkt-hero-title">
                Le copilote <em>des agents</em><br/>
                qui veulent vendre plus.
              </h1>
              <p className="mkt-lead" data-testid="mkt-hero-subtitle">
                Pige IA en 30 secondes, dictée vocale, suivi des dossiers.
                KOLO regroupe tout ce qu'un agent immobilier indépendant utilise
                vraiment — sans CRM lourd, sans frictions.
              </p>
              <div className="mkt-cta-row">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mkt-btn mkt-btn-primary"
                  data-testid="mkt-hero-appstore-cta"
                >
                  Télécharger sur l'App Store <ArrowRight size={16} strokeWidth={2.5} />
                </a>
                <Link to="/comment-kolo" className="mkt-btn mkt-btn-ghost" data-testid="mkt-hero-secondary-cta">
                  Voir comment ça marche
                </Link>
              </div>
            </div>

            <div className="mkt-hero-visual">
              <PhoneFrame src="/marketing/assets/live_home.jpeg" alt="Tableau de bord KOLO" testId="mkt-hero-phone" />
              <div className="mkt-float-card fc-1" data-testid="mkt-hero-float-1">
                <div className="mkt-fc-row">
                  <div className="mkt-fc-icon"><Mic size={16} /></div>
                  <div>
                    <div className="mkt-fc-label">Note vocale</div>
                    <div className="mkt-fc-value">42 sec</div>
                  </div>
                </div>
              </div>
              <div className="mkt-float-card fc-2" data-testid="mkt-hero-float-2">
                <div className="mkt-fc-row">
                  <div className="mkt-fc-icon" style={{ background: '#E6F7EC', color: '#1E7A3C' }}><TrendingUp size={16} /></div>
                  <div>
                    <div className="mkt-fc-label">Pige aujourd'hui</div>
                    <div className="mkt-fc-value">+14 biens</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ LOGO MARQUEE ============ */}
      <LogoMarquee />

      {/* ============ PROMESSE ============ */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-section-head mkt-reveal">
            <div className="mkt-section-eyebrow">La promesse</div>
            <h2 className="mkt-h2">
              Tout ce dont un agent a besoin.<br/>
              <em>Rien de ce qu'il n'utilise jamais.</em>
            </h2>
            <p className="mkt-subtle" style={{ margin: '0 auto' }}>
              On a passé 12 mois sur le terrain à comprendre ce qui faisait perdre du temps,
              du mandat et de l'argent. On a tout coupé. KOLO ne garde que les 3 réflexes
              qui font basculer le mois.
            </p>
          </div>

          <div className="mkt-pillars">
            <div className="mkt-pillar mkt-reveal" data-testid="mkt-pillar-pige">
              <div className="mkt-pillar-icon"><Target size={22} strokeWidth={2} /></div>
              <h3 className="mkt-h3">Pige IA en 30 secondes</h3>
              <p>Repérer les biens fraîchement publiés sur la zone, filtrés et qualifiés.
                Plus besoin d'éplucher 7 portails chaque matin.</p>
            </div>
            <div className="mkt-pillar mkt-reveal" data-testid="mkt-pillar-dictee">
              <div className="mkt-pillar-icon"><Mic size={22} strokeWidth={2} /></div>
              <h3 className="mkt-h3">Dictée vocale terrain</h3>
              <p>Tu sors d'un R1, tu dictes. KOLO structure ta fiche, attribue le statut,
                programme le rappel. Tu n'oublies plus rien.</p>
            </div>
            <div className="mkt-pillar mkt-reveal" data-testid="mkt-pillar-pilotage">
              <div className="mkt-pillar-icon"><TrendingUp size={22} strokeWidth={2} /></div>
              <h3 className="mkt-h3">Pilotage hebdomadaire</h3>
              <p>3 KPIs lisibles d'un coup d'œil. Tu sais où tu vas, où tu freines,
                et quelle action lance le mois prochain.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="mkt-section-tight">
        <div className="mkt-container">
          <div className="mkt-stats mkt-reveal" data-testid="mkt-stats">
            <div className="mkt-stat">
              <div className="mkt-stat-num">30 sec</div>
              <div className="mkt-stat-label">Une pige propre, chaque matin, en moins d'une minute.</div>
            </div>
            <div className="mkt-stat">
              <div className="mkt-stat-num">×3</div>
              <div className="mkt-stat-label">Le nombre de fiches prospect saisies par semaine en moyenne après 30 jours.</div>
            </div>
            <div className="mkt-stat">
              <div className="mkt-stat-num">0</div>
              <div className="mkt-stat-label">Rappel oublié grâce à la file de suivi automatique.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ VISUAL PRODUCT SHOWCASE ============ */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-step">
            <div className="mkt-step-text mkt-reveal">
              <div className="mkt-step-num">01</div>
              <h2 className="mkt-h2"><em>Vois venir</em> les opportunités<br/>avant tout le monde.</h2>
              <p className="mkt-subtle">Notre pige IA balaye en continu les annonces de ta zone et te remonte
                uniquement ce qui matche tes critères. Plus de scroll, plus de redondance.</p>
              <ul className="mkt-step-bullets">
                <li><Check size={18} color="#1E7A3C" strokeWidth={2.5} /><span>Filtre intelligent par typologie, prix et fraîcheur</span></li>
                <li><Check size={18} color="#1E7A3C" strokeWidth={2.5} /><span>Alerte en moins de 10 min après publication</span></li>
                <li><Check size={18} color="#1E7A3C" strokeWidth={2.5} /><span>Détection des doublons inter-portails</span></li>
              </ul>
            </div>
            <div className="mkt-step-visual mkt-reveal">
              <PhoneFrame src="/marketing/assets/live_pige.jpeg" alt="Pige immobilière KOLO" testId="mkt-home-pige-phone" />
            </div>
          </div>

          <div className="mkt-step reverse">
            <div className="mkt-step-text mkt-reveal">
              <div className="mkt-step-num">02</div>
              <h2 className="mkt-h2">Dicte tes notes.<br/><em>Reprends ta vie.</em></h2>
              <p className="mkt-subtle">Tu sors d'un rendez-vous, tu parles 40 secondes. KOLO transcrit,
                structure, ajoute le rappel, classe le dossier. Tu rentres chez toi sans dossier à rattraper.</p>
              <ul className="mkt-step-bullets">
                <li><Check size={18} color="#1E7A3C" strokeWidth={2.5} /><span>Transcription FR optimisée pour le vocabulaire immo</span></li>
                <li><Check size={18} color="#1E7A3C" strokeWidth={2.5} /><span>Création automatique de la fiche contact et du dossier</span></li>
                <li><Check size={18} color="#1E7A3C" strokeWidth={2.5} /><span>Rappel programmé à J+2, J+7, J+14</span></li>
              </ul>
            </div>
            <div className="mkt-step-visual mkt-reveal">
              <PhoneFrame src="/marketing/assets/live_home.jpeg" alt="Dictée vocale KOLO" testId="mkt-home-dictee-phone" />
            </div>
          </div>
        </div>
      </section>

      {/* ============ SOCIAL PROOF QUOTE ============ */}
      <section className="mkt-section-tight">
        <div className="mkt-container mkt-container-narrow" style={{ textAlign: 'center' }}>
          <div className="mkt-reveal">
            <div style={{ fontFamily: 'var(--mkt-font-serif)', fontSize: 'clamp(24px, 3vw, 36px)', lineHeight: 1.4, fontStyle: 'italic', color: 'var(--mkt-ink-2)' }}>
              « J'ai gagné 1h par jour. Et surtout, je ne perds plus un seul rappel.
              Mon premier mois sur KOLO : +2 mandats signés. »
            </div>
            <div style={{ marginTop: 24, fontWeight: 600, fontSize: 14 }}>Claire L. — Agent indépendante, Lyon</div>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-final-cta mkt-reveal" data-testid="mkt-final-cta">
            <h2>Prêt à <em style={{ fontFamily: 'var(--mkt-font-serif)', fontStyle: 'italic', fontWeight: 400 }}>récupérer ton temps</em> ?</h2>
            <p>Télécharge KOLO sur l'App Store et commence ta pige en 30 secondes. C'est gratuit pendant 14 jours, sans carte bancaire.</p>
            <div className="mkt-cta-row">
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-primary" data-testid="mkt-final-cta-appstore">
                Télécharger sur l'App Store <ArrowRight size={16} strokeWidth={2.5} />
              </a>
              <Link to="/comment-kolo" className="mkt-btn mkt-btn-ghost">
                Découvrir le produit
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default HomePage;
