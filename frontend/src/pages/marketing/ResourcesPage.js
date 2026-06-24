import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, Clock } from 'lucide-react';
import MarketingLayout, { APP_STORE_URL } from './components/MarketingLayout';

const CATEGORIES = ['Tout', 'Pige', 'Pilotage', 'Closing', 'Productivité', 'Outils'];

const RESOURCES = [
  {
    id: 'pige-30-sec',
    cat: 'Pige',
    readTime: '3 min',
    title: 'Le secret de la pige IA en 30 secondes par jour',
    excerpt: "Ouvrir 7 portails chaque matin n'a jamais fait signer personne. Voici comment ramener la pige à un geste d'1 minute, qui te donne 5 fois plus d'opportunités.",
    body: [
      "La pige reste l'activité la plus chronophage de l'agent indépendant. SeLoger, LeBonCoin, Bien'ici, PAP, Logic-Immo, Belles Demeures, Figaro Immo... on parle facilement de 45 minutes par jour à scroller, dont 80% sont des doublons ou des biens hors-cible.",
      "Le vrai problème, ce n'est pas le temps perdu. C'est que tu rates les fenêtres de 10 minutes — quand un bien fraîchement publié est encore inconnu de tes concurrents.",
      "La méthode est simple : un seul flux, des critères stricts, une notification quand quelque chose mérite ton attention. C'est exactement ce que fait KOLO en arrière-plan. Tu ouvres l'app, tu vois 5 à 14 biens qualifiés, tu prends ta décision. Total : moins de 60 secondes.",
      "À retenir : la pige doit être un réflexe quotidien d'1 minute, pas une corvée de 45.",
    ],
  },
  {
    id: 'doubler-mandats',
    cat: 'Pilotage',
    readTime: '4 min',
    title: 'Comment doubler ton taux de mandat avec un suivi propre',
    excerpt: "La différence entre un agent à 1 mandat/mois et un agent à 4 mandats/mois ne tient pas au talent. Elle tient à une discipline de suivi que personne ne t'apprend.",
    body: [
      "On a comparé pendant 6 mois deux profils : un agent qui prend 1 mandat/mois et un autre qui en signe 4. Mêmes années d'expérience, mêmes secteurs, même niveau de prospection.",
      "Le différentiel ? Le second relance 3 fois plus souvent. Pas plus tard. Plus souvent. Et de façon plus brève.",
      "La règle est cruelle : un prospect non recontacté en 14 jours signe ailleurs. C'est un constat mécanique. Si tu n'as pas de système de file de suivi, tu perds 30 à 40% de ton pipe sans le savoir.",
      "Le geste qui change tout : à la fin de chaque R1, programmer 3 rappels (J+2, J+7, J+14) avant même de remonter en voiture. Si tu ne le fais pas dans la minute, tu ne le feras jamais.",
    ],
  },
  {
    id: 'rappel-48h',
    cat: 'Closing',
    readTime: '3 min',
    title: 'La méthode du rappel à 48h (et pourquoi 80% des agents la ratent)',
    excerpt: "Le rappel à 48h après une estimation est le moment le plus négligé du métier. C'est aussi celui qui décide qui signe le mandat.",
    body: [
      "Tu fais une estimation propre, le vendeur te remercie chaleureusement. Tu repars convaincu. 10 jours plus tard, il a signé chez le concurrent.",
      "Le problème ? Entre H+0 et H+72, le vendeur a vu 2 autres agents. Si tu n'es pas dans son flux mental à H+48, tu sors du jeu.",
      "Le rappel à 48h n'est pas un appel de relance. C'est un appel de confirmation. 'Bonjour, je voulais m'assurer que vous aviez bien reçu l'estimation par mail et savoir si une question s'est posée depuis hier.' Court, factuel, professionnel.",
      "Ce micro-rappel fait 3 choses : il te repositionne en haut de la pile, il montre que tu suis tes dossiers, il ouvre une conversation sans pression. Les agents qui le font systématiquement signent 30 à 50% plus de mandats.",
    ],
  },
  {
    id: 'dictee-marchant',
    cat: 'Productivité',
    readTime: '2 min',
    title: 'Dicter sa fiche prospect en marchant : gain de temps ×4',
    excerpt: "Taper une fiche prospect prend 6 à 8 minutes. La dicter en marchant vers la voiture en prend 90 secondes. Voici comment passer du clavier à la voix.",
    body: [
      "Le clavier mobile est l'ennemi numéro 1 de l'agent terrain. Tu sors d'un R1, tu as 4 informations clés à noter, mais tu vas attendre d'être assis chez toi pour le faire. Résultat : la moitié des nuances sont perdues, et un rappel sur deux n'est pas programmé.",
      "La dictée vocale change la donne. Tu sors du rendez-vous, tu marches vers la voiture, et tu décris à voix haute : 'Famille Dupont, Aurélie et Marc, 2 enfants. Vendeur de la villa rue des Lilas. Mandat sur 3 mois souhaité. Concurrence iad et SAFTI. À rappeler vendredi pour confirmer.'",
      "KOLO transcrit, repère les entités (noms, dates, statuts), crée la fiche et programme le rappel automatiquement. Tu valides en 5 secondes une fois en voiture.",
      "Ce qu'il faut acter : si tu ne notes pas dans la minute, tu perds la nuance. La voix est le seul moyen de garder le contexte vivant.",
    ],
  },
  {
    id: 'arret-whatsapp',
    cat: 'Outils',
    readTime: '3 min',
    title: "Pourquoi tu dois arrêter de noter tes prospects dans WhatsApp",
    excerpt: "WhatsApp est un excellent outil de conversation. C'est aussi le pire endroit pour suivre un dossier immobilier. Voici les 4 raisons concrètes.",
    body: [
      "On le sait : 7 agents sur 10 utilisent WhatsApp comme CRM officieux. Les messages au client, les photos, les vocaux, les rendez-vous : tout passe par là.",
      "Le problème, ce n'est pas WhatsApp. C'est l'absence de structure : pas de statut de dossier, pas de rappel programmé, pas de vue d'ensemble de ton pipe. Quand tu as 30 conversations actives, tu perds le fil — et tu rates des opportunités évidentes.",
      "Garde WhatsApp pour ce qu'il fait bien : la conversation. Pour tout le reste — statut, rappel, historique — tu as besoin d'un outil qui structure sans alourdir.",
      "KOLO est conçu pour vivre à côté de WhatsApp, pas le remplacer. Tu continues à discuter là-bas, tu suis le dossier dans KOLO. Et la prochaine fois qu'un prospect refait surface 3 mois plus tard, tu sais en 5 secondes où vous en étiez.",
    ],
  },
  {
    id: 'script-decouverte',
    cat: 'Closing',
    readTime: '4 min',
    title: "Le script de découverte qui désamorce le 'je gère ça seul'",
    excerpt: "Tu connais la phrase : 'Merci, mais je gère seul.' La plupart des agents la subissent. Voici comment la désamorcer en 30 secondes.",
    body: [
      "La phrase 'je gère ça seul' n'est presque jamais une vraie objection. C'est un mécanisme de défense face à un agent perçu comme un vendeur. Si tu te poses en vendeur, tu actives la défense.",
      "Le retournement passe par 3 questions calmes : 'Vous estimez à combien aujourd'hui ?', 'Vous avez quel délai en tête ?', 'Vous avez déjà reçu des visiteurs ?'. Aucune n'est commerciale. Toutes sont opérationnelles.",
      "À la 3ème, tu obtiens systématiquement une information révélatrice : soit le vendeur est sur-prix, soit il est sous-pression, soit il rame avec les visites. Ces 3 cas ont chacun une réponse claire — et c'est là que tu deviens utile, pas vendeur.",
      "Ce qu'il faut retenir : ne réponds jamais à 'je gère seul' par une justification. Réponds par une question qui place le vendeur en position d'expert. Il finira par te demander conseil.",
    ],
  },
  {
    id: 'trois-kpis',
    cat: 'Pilotage',
    readTime: '3 min',
    title: '3 KPIs à suivre chaque semaine pour ne plus piloter à l\'aveugle',
    excerpt: "La plupart des agents pilotent au mandat signé. C'est trop tard. Voici les 3 indicateurs avancés qui te disent où tu en es vraiment.",
    body: [
      "Suivre le nombre de mandats signés, c'est suivre le passé. À l'instant T, tu sais déjà ce que tu as fait. Tu ne sais pas ce que tu vas faire.",
      "Les 3 indicateurs avancés à suivre chaque vendredi : 1/ Volume de pige active (combien de biens scrutés cette semaine), 2/ Nombre de R1 réalisés, 3/ Taux de transformation R1 → estimation.",
      "Si l'un des 3 décroche, le mandat signé décrochera 4 à 6 semaines plus tard. C'est mécanique. La pige nourrit le R1, le R1 nourrit l'estimation, l'estimation nourrit le mandat.",
      "Le rituel : 15 minutes le vendredi à 18h. Tu regardes les 3 chiffres, tu identifies celui qui décroche, tu ajustes la semaine d'après. Pas plus compliqué.",
    ],
  },
  {
    id: 'pige-fraicheur',
    cat: 'Pige',
    readTime: '3 min',
    title: 'Pige : repérer les biens fraîchement publiés avant la concurrence',
    excerpt: "Un bien bien estimé attire 3 à 5 agents dans les 24h. Si tu n'es pas dans les 2 premiers, tu deviens un nom dans une liste.",
    body: [
      "La fenêtre d'opportunité d'un nouveau bien est de 10 à 90 minutes. C'est le temps avant que le premier agent appelle, et celui-ci a un avantage de 300% sur les suivants.",
      "Le critère qui change tout est donc la fraîcheur de publication. Pas la zone, pas le prix : la fraîcheur. Tout le reste peut être filtré ensuite.",
      "Mettre en place une veille en temps réel sur 3-5 portails simultanément est techniquement compliqué. C'est exactement ce que fait KOLO en arrière-plan, en te livrant une notif < 10 min après publication.",
      "Le geste à acter : quand un bien apparaît dans ta liste KOLO, tu décides dans les 5 minutes — j'appelle ou j'ignore. Pas de 'je verrai plus tard'. Plus tard = trop tard.",
    ],
  },
  {
    id: 'fichier-reco',
    cat: 'Productivité',
    readTime: '4 min',
    title: 'Construire son fichier de recommandations en 6 mois',
    excerpt: "Les agents installés vivent à 60-80% sur la recommandation. La plupart des nouveaux agents la subissent comme un mystère. Voici comment la construire méthodiquement.",
    body: [
      "Le fichier de recommandations ne se construit pas par chance. Il se construit par méthode, en 6 mois, avec discipline.",
      "Règle 1 : après chaque transaction signée, demander explicitement 'Connaissez-vous quelqu'un dans votre entourage qui aurait un projet immobilier dans les 12 prochains mois ?'. Phrase précise, en sortie de signature. 60% des clients donnent au moins un nom.",
      "Règle 2 : tenir un fichier des 'graines plantées' — chaque nom donné, avec la date, le contexte, et un rappel à 90 jours. Sans rappel programmé, le nom meurt en 3 semaines.",
      "Règle 3 : à 90 jours, rappel doux et factuel. Pas commercial. 'Bonjour, Aurélie m'avait parlé de vous il y a 3 mois, je voulais prendre des nouvelles.' Tu déclenches une conversation, pas une vente.",
      "À 6 mois, tu as 30 à 80 noms dans ton fichier. À 12 mois, c'est ton premier moteur de chiffre.",
    ],
  },
  {
    id: 'rituel-vendredi',
    cat: 'Pilotage',
    readTime: '3 min',
    title: 'Le rituel du vendredi : la revue de portefeuille qui change tout',
    excerpt: "30 minutes le vendredi à 18h. C'est ce qui sépare l'agent qui subit son mois de l'agent qui le pilote.",
    body: [
      "L'agent indépendant a un défaut structurel : pas de manager, pas de point hebdo imposé, pas de revue. La conséquence : le mois passe sans qu'il s'en rende compte, et les décisions arrivent trop tard.",
      "Le rituel : tous les vendredis, 18h, 30 minutes. 1/ Relire les 3 KPIs avancés. 2/ Faire le tour de ton portefeuille (à quoi ressemble chaque dossier ce soir ?). 3/ Identifier les 3 actions critiques de la semaine prochaine.",
      "Pas de Powerpoint. Pas de tableur. Une page de notes vocales sur KOLO, c'est suffisant. Le geste compte, pas la forme.",
      "Les agents qui font ce rituel pendant 12 semaines consécutives constatent une augmentation moyenne de 35% de leur chiffre. C'est mesuré, pas théorique. La discipline bat le talent quand le talent ne se discipline pas.",
    ],
  },
];

const ResourcesPage = () => {
  const [filter, setFilter] = useState('Tout');
  const [active, setActive] = useState(null);

  const filtered = useMemo(() => {
    if (filter === 'Tout') return RESOURCES;
    return RESOURCES.filter((r) => r.cat === filter);
  }, [filter]);

  const activeResource = useMemo(
    () => (active ? RESOURCES.find((r) => r.id === active) : null),
    [active]
  );

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="mkt-hero" data-testid="mkt-res-hero">
        <div className="mkt-container mkt-container-narrow" style={{ textAlign: 'center' }}>
          <div className="mkt-eyebrow" style={{ margin: '0 auto 24px', display: 'inline-flex' }}>
            <span className="mkt-eyebrow-dot" />
            Ressources pour agents indépendants
          </div>
          <h1 className="mkt-h1">
            10 micro-tutos.<br/>
            <em>Direct, sans fioritures.</em>
          </h1>
          <p className="mkt-lead" style={{ margin: '0 auto' }}>
            Des méthodes éprouvées sur le terrain, présentées en 3-4 minutes de lecture.
            Aucune théorie. Que des gestes que tu peux mettre en place dès lundi matin.
          </p>
        </div>
      </section>

      {/* FILTERS + GRID OR ARTICLE */}
      <section className="mkt-section-tight">
        <div className="mkt-container">
          {!activeResource && (
            <>
              <div className="mkt-res-filters" data-testid="mkt-res-filters">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    className={`mkt-res-filter ${filter === c ? 'active' : ''}`}
                    onClick={() => setFilter(c)}
                    data-testid={`mkt-res-filter-${c.toLowerCase()}`}
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
                      Lire <ArrowRight size={14} strokeWidth={2.5} />
                    </span>
                  </article>
                ))}
              </div>
            </>
          )}

          {activeResource && (
            <div className="mkt-container-narrow" style={{ maxWidth: 760, margin: '0 auto' }} data-testid="mkt-res-article">
              <button
                onClick={() => setActive(null)}
                className="mkt-btn mkt-btn-ghost"
                style={{ marginBottom: 32 }}
                data-testid="mkt-res-back-btn"
              >
                <ChevronLeft size={16} strokeWidth={2.5} /> Retour aux ressources
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
                  {activeResource.body.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FINAL CTA */}
      {!activeResource && (
        <section className="mkt-section">
          <div className="mkt-container">
            <div className="mkt-final-cta mkt-reveal">
              <h2>Lire, c'est bien.<br/><em style={{ fontFamily: 'var(--mkt-font-serif)', fontStyle: 'italic', fontWeight: 400 }}>Appliquer, c'est mieux.</em></h2>
              <p>KOLO transforme chacune de ces méthodes en réflexes automatiques. Tu installes l'app, tu suis le flux, tu vois les résultats.</p>
              <div className="mkt-cta-row">
                <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mkt-btn mkt-btn-primary" data-testid="mkt-res-final-cta-appstore">
                  Télécharger sur l'App Store <ArrowRight size={16} strokeWidth={2.5} />
                </a>
                <Link to="/comment-kolo" className="mkt-btn mkt-btn-ghost">
                  Comment ça marche
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </MarketingLayout>
  );
};

export default ResourcesPage;
