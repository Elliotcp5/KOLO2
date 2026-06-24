import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Target, Zap } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';

const AboutPage = () => {
  return (
    <MarketingLayout>
      {/* HERO with founder photo */}
      <section className="mkt-hero" data-testid="mkt-about-hero">
        <div className="mkt-container">
          <div className="mkt-about-hero">
            <div>
              <div className="mkt-eyebrow" data-testid="mkt-about-eyebrow">
                <span className="mkt-eyebrow-dot" />
                L'histoire derrière KOLO
              </div>
              <h1 className="mkt-h1">
                Un agent.<br/>
                <em>Pour les agents.</em>
              </h1>
              <p className="mkt-lead">
                KOLO n'est pas né dans un bureau de la Silicon Valley. KOLO est né dans une voiture,
                entre deux R1, quand son fondateur en a eu marre de perdre des opportunités
                par manque d'outil.
              </p>
            </div>
            <div className="mkt-founder-photo">
              <img src="/marketing/assets/founder.png" alt="Elliot Pressard, fondateur de KOLO" data-testid="mkt-about-founder-photo" />
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER STORY */}
      <section className="mkt-section-tight">
        <div className="mkt-container mkt-container-narrow">
          <div className="mkt-section-eyebrow">Le fondateur</div>
          <h2 className="mkt-h2" style={{ marginBottom: 32 }}>
            Elliot a fait le métier.<br/>
            <em>C'est pour ça que KOLO existe.</em>
          </h2>

          <div className="mkt-prose mkt-reveal" data-testid="mkt-about-story">
            <p>
              Elliot a toujours été attiré par la tech. Il fait ses premières armes en Italie,
              dans un organisme de formation. Puis il rentre en France et, comme beaucoup d'entre vous,
              il fait le grand saut : il devient agent immobilier.
            </p>
            <p>
              Il découvre un métier exigeant et passionnant, où tout se joue sur la relation humaine,
              la confiance et la réactivité. Mais il vit aussi la frustration que connaissent
              tous les agents : voir des opportunités s'envoler faute d'outils vraiment pensés pour nous.
            </p>
            <p>
              Ce métier-là, l'un des plus beaux et des plus durs, n'avait jamais eu d'outil
              vraiment pensé pour lui. Les CRM sont conçus pour les directeurs commerciaux.
              Les apps de pige sont des annuaires. WhatsApp n'est pas un système de suivi.
            </p>
            <p>
              Alors il s'y est mis. KOLO, c'est ça : un copilote IA créé par quelqu'un qui a fait
              le métier, pour ceux qui le font chaque jour.
            </p>
          </div>

          <div className="mkt-founder-quote" data-testid="mkt-about-quote">
            « Je voulais un outil que j'aurais aimé avoir le premier jour de ma carrière d'agent.
            Simple, rapide, qui me fait gagner du temps sans m'en demander. »
          </div>
          <div className="mkt-founder-name">Elliot Pressard</div>
          <div className="mkt-founder-role">Fondateur de KOLO · Ex-agent immobilier</div>
        </div>
      </section>

      {/* VALUES */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-section-head mkt-reveal">
            <div className="mkt-section-eyebrow">Notre conviction</div>
            <h2 className="mkt-h2">Trois principes,<br/>aucun compromis.</h2>
          </div>

          <div className="mkt-values" data-testid="mkt-about-values">
            <div className="mkt-value mkt-reveal">
              <div className="mkt-pillar-icon" style={{ marginBottom: 18 }}><Target size={22} strokeWidth={2} /></div>
              <h4>Conçu pour le terrain</h4>
              <p>Chaque feature est testée par des agents en activité avant d'arriver dans l'app.
                Si ça n'apporte rien dans la voiture entre deux R1, ça n'entre pas dans KOLO.</p>
            </div>
            <div className="mkt-value mkt-reveal">
              <div className="mkt-pillar-icon" style={{ marginBottom: 18 }}><Zap size={22} strokeWidth={2} /></div>
              <h4>Rapide ou rien</h4>
              <p>Si une action prend plus de 10 secondes dans KOLO, on la repense.
                Le métier ne supporte pas la friction. Notre app non plus.</p>
            </div>
            <div className="mkt-value mkt-reveal">
              <div className="mkt-pillar-icon" style={{ marginBottom: 18 }}><Heart size={22} strokeWidth={2} /></div>
              <h4>Indépendant, fier de l'être</h4>
              <p>On bosse pour les agents indépendants, pas pour les enseignes.
                Ton fichier, ton portefeuille, ton chiffre — restent les tiens. Toujours.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT / CTA */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-final-cta mkt-reveal" data-testid="mkt-about-final-cta">
            <h2>Tu veux échanger ?<br/><em style={{ fontFamily: 'var(--mkt-font-serif)', fontStyle: 'italic', fontWeight: 400 }}>Elliot te répond.</em></h2>
            <p>Une question, une demande de démo, une idée pour faire évoluer KOLO ? Écris-nous,
              tu auras une réponse personnelle sous 24h.</p>
            <div className="mkt-cta-row">
              <a href="mailto:contact@trykolo.io" className="mkt-btn mkt-btn-primary" data-testid="mkt-about-contact-cta">
                Contacter Elliot <ArrowRight size={16} strokeWidth={2.5} />
              </a>
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-ghost" data-testid="mkt-about-appstore-cta">
                Télécharger KOLO
              </a>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default AboutPage;
