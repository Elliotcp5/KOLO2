import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';
import PhoneFrame from './components/PhoneFrame';

const STEPS = [
  {
    num: '01',
    tag: { before: '7 portails ouverts, 45 min/jour', after: 'Une notif. 30 secondes.' },
    title: 'Tu pige le matin sans y penser.',
    text: "Plus besoin d'enchaîner SeLoger, LeBonCoin, PAP, Bien'ici... KOLO scrute en continu les annonces qui matchent tes critères et te livre une liste propre, dédoublonnée, dès l'ouverture.",
    bullets: [
      "Critères enregistrés (typologie, prix, zone)",
      "Alerte fraîcheur < 10 minutes",
      "Détection automatique des doublons",
    ],
    img: '/marketing/assets/live_pige.jpeg',
  },
  {
    num: '02',
    tag: { before: 'Notes WhatsApp éparpillées', after: 'Dictée vocale terrain' },
    title: 'Tu sors d\'un R1, tu dictes.',
    text: "40 secondes au volant et la fiche est complète : nom, projet, budget, statut, prochaine action. KOLO comprend le vocabulaire immo (compromis, mandat, viager, indivision...) et structure tout pour toi.",
    bullets: [
      "Transcription FR optimisée immobilier",
      "Création auto de la fiche contact + dossier",
      "Tu parles, tu valides, c'est en base",
    ],
    img: '/marketing/assets/live_home.jpeg',
    reverse: true,
  },
  {
    num: '03',
    tag: { before: 'Rappels oubliés, prospects perdus', after: 'File de suivi automatique' },
    title: 'Tu ne perds plus un seul prospect.',
    text: "Chaque fiche entre dans une file de suivi avec rappel automatique à J+2, J+7, J+14. Tu vois en un coup d'œil ce que tu dois relancer aujourd'hui, et ce que tu peux laisser respirer.",
    bullets: [
      "Rappels intelligents selon le statut",
      "Vue 'à relancer aujourd'hui'",
      "Historique conversationnel par contact",
    ],
    img: '/marketing/assets/live_dossiers.jpeg',
  },
  {
    num: '04',
    tag: { before: 'Pilotage à l\'aveugle', after: 'Tableau de bord hebdo' },
    title: 'Tu pilotes ton mois, pas l\'inverse.',
    text: "Chaque vendredi, KOLO te livre tes 3 KPIs essentiels : volume de pige, nombre de R1, mandats signés. Tu sais exactement où tu freines, où accélérer, et quelle action lance le mois prochain.",
    bullets: [
      "Récap hebdo le vendredi à 18h",
      "3 KPIs lisibles (pas 30)",
      "Comparatif S-1 et tendance 4 semaines",
    ],
    img: '/marketing/assets/live_home.jpeg',
    reverse: true,
  },
];

const HowKoloPage = () => {
  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="mkt-hero" data-testid="mkt-how-hero">
        <div className="mkt-container mkt-container-narrow" style={{ textAlign: 'center' }}>
          <div className="mkt-eyebrow" style={{ margin: '0 auto 24px', display: 'inline-flex' }}>
            <span className="mkt-eyebrow-dot" />
            Comment KOLO boost vos ventes
          </div>
          <h1 className="mkt-h1">
            Quatre réflexes simples.<br/>
            <em>Un mois différent.</em>
          </h1>
          <p className="mkt-lead" style={{ margin: '0 auto 36px' }}>
            On a observé 200+ agents sur le terrain. Voici les 4 rituels qui séparent
            ceux qui galèrent de ceux qui signent. KOLO les rend automatiques.
          </p>
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-primary" data-testid="mkt-how-cta-top">
            Télécharger sur l'App Store <ArrowRight size={16} strokeWidth={2.5} />
          </a>
        </div>
      </section>

      {/* STEPS */}
      <section className="mkt-section-tight">
        <div className="mkt-container">
          {STEPS.map((s, idx) => (
            <div key={s.num} className={`mkt-step ${s.reverse ? 'reverse' : ''}`} data-testid={`mkt-how-step-${idx + 1}`}>
              <div className="mkt-step-text mkt-reveal">
                <div className="mkt-step-num">{s.num}</div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  <span className="mkt-tag mkt-tag-before" style={{ marginBottom: 0 }}>
                    <X size={12} style={{ display: 'inline', marginRight: 4, marginBottom: -1 }} strokeWidth={3} />
                    {s.tag.before}
                  </span>
                  <span className="mkt-tag mkt-tag-after" style={{ marginBottom: 0 }}>
                    <Check size={12} style={{ display: 'inline', marginRight: 4, marginBottom: -1 }} strokeWidth={3} />
                    {s.tag.after}
                  </span>
                </div>

                <h2 className="mkt-h2">{s.title}</h2>
                <p className="mkt-subtle">{s.text}</p>
                <ul className="mkt-step-bullets">
                  {s.bullets.map((b) => (
                    <li key={b}><Check size={18} color="#1E7A3C" strokeWidth={2.5} /><span>{b}</span></li>
                  ))}
                </ul>
              </div>
              <div className="mkt-step-visual mkt-reveal">
                <PhoneFrame src={s.img} alt={s.title} testId={`mkt-how-step-${idx + 1}-phone`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-final-cta mkt-reveal" data-testid="mkt-how-final-cta">
            <h2>Tu fais le métier.<br/><em style={{ fontFamily: 'var(--mkt-font-serif)', fontStyle: 'italic', fontWeight: 400 }}>On s'occupe du reste.</em></h2>
            <p>14 jours gratuits, sans carte. Tu installes, tu dictes ta première fiche, tu vois la différence dès la première semaine.</p>
            <div className="mkt-cta-row">
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-primary" data-testid="mkt-how-cta-bottom">
                Télécharger sur l'App Store <ArrowRight size={16} strokeWidth={2.5} />
              </a>
              <Link to="/ressources" className="mkt-btn mkt-btn-ghost">
                Voir les ressources
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default HowKoloPage;
