import React, { useState, useEffect } from 'react';
import { Infinity as InfinityIcon, MessageSquare, Flame, TrendingUp, Sparkles, Clock, BarChart3, CalendarCheck, ChevronRight, X } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import confetti from 'canvas-confetti';

const KOLO_LOGO = "https://customer-assets.emergentagent.com/job_87fbdd54-54db-47ca-8301-2670fecb634d/artifacts/eaq0wshz_KOLO%20LOGO%20TEXT%20PNG.png";
const BRAND_BLUE = '#004AAD';
const BRAND_MAGENTA = '#CB6CE6';
const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND_BLUE} 0%, ${BRAND_MAGENTA} 100%)`;

const CONTENT = {
  fr: {
    close: 'Fermer',
    next: 'Suivant',
    start: 'Commencer maintenant',
    slideOf: (a, b) => `${a} sur ${b}`,
    pro: {
      slides: [
        { title: 'Bienvenue sur KOLO PRO', subtitle: 'Votre abonnement est actif', description: 'Vous avez désormais accès à tous les outils pour closer plus de deals.' },
        { title: 'Prospects & IA illimités', subtitle: 'Aucune limite', description: 'Ajoutez autant de prospects que vous voulez. Générez des suggestions IA à volonté.' },
        { title: 'SMS en un clic', subtitle: 'Relances instantanées', description: "L'IA rédige le SMS parfait pour chaque prospect. Vous validez, elle envoie." },
        { title: 'Historique complet', subtitle: 'Chaque interaction tracée', description: 'Timeline interactive de tous vos échanges pour ne jamais perdre le fil.' },
      ],
    },
    pro_plus: {
      slides: [
        { title: 'Bienvenue sur KOLO PRO+', subtitle: 'Vous êtes au sommet', description: 'Tous les outils premium pour dominer votre marché immobilier.' },
        { title: 'Heat Score IA', subtitle: 'Détectez les pépites', description: "L'IA note chaque prospect de 1 à 100 selon leur intention d'achat réelle." },
        { title: 'ROI Dashboard', subtitle: 'Vos chiffres en temps réel', description: "Commissions, conversions, pipeline : tout votre business en un coup d'œil." },
        { title: 'Rapports hebdo', subtitle: 'Priorités chaque lundi', description: "KOLO vous envoie un briefing avec vos actions à fort impact de la semaine." },
      ],
    },
  },
  en: {
    close: 'Close', next: 'Next', start: 'Start now', slideOf: (a, b) => `${a} of ${b}`,
    pro: {
      slides: [
        { title: 'Welcome to KOLO PRO', subtitle: 'Your subscription is active', description: 'You now have access to every tool to close more deals.' },
        { title: 'Unlimited prospects & AI', subtitle: 'No limits', description: 'Add as many prospects as you want. Generate AI suggestions on demand.' },
        { title: 'One-click SMS', subtitle: 'Instant follow-ups', description: 'AI drafts the perfect SMS for each prospect. You approve, it sends.' },
        { title: 'Full interaction history', subtitle: 'Every touchpoint tracked', description: 'Interactive timeline of all your exchanges, so you never lose track.' },
      ],
    },
    pro_plus: {
      slides: [
        { title: 'Welcome to KOLO PRO+', subtitle: "You're at the top", description: 'Every premium tool to dominate your real estate market.' },
        { title: 'AI Heat Score', subtitle: 'Spot the gems', description: 'AI rates each prospect 1-100 based on real buying intent.' },
        { title: 'ROI Dashboard', subtitle: 'Real-time numbers', description: 'Commissions, conversions, pipeline: your whole business at a glance.' },
        { title: 'Weekly reports', subtitle: 'Priorities every Monday', description: 'KOLO sends you a briefing with your high-impact actions of the week.' },
      ],
    },
  },
  de: {
    close: 'Schließen', next: 'Weiter', start: 'Jetzt starten', slideOf: (a, b) => `${a} von ${b}`,
    pro: {
      slides: [
        { title: 'Willkommen bei KOLO PRO', subtitle: 'Ihr Abo ist aktiv', description: 'Sie haben jetzt Zugriff auf alle Tools, um mehr Deals abzuschließen.' },
        { title: 'Unbegrenzte Prospects & KI', subtitle: 'Keine Grenzen', description: 'Fügen Sie beliebig viele Prospects hinzu. KI-Vorschläge nach Belieben.' },
        { title: 'SMS mit einem Klick', subtitle: 'Sofortige Nachfassaktion', description: 'KI formuliert die perfekte SMS. Sie bestätigen, sie wird gesendet.' },
        { title: 'Vollständiger Verlauf', subtitle: 'Jede Interaktion erfasst', description: 'Interaktive Timeline aller Kontakte, damit Sie nichts verpassen.' },
      ],
    },
    pro_plus: {
      slides: [
        { title: 'Willkommen bei KOLO PRO+', subtitle: 'Sie sind ganz oben', description: 'Alle Premium-Tools, um Ihren Immobilienmarkt zu dominieren.' },
        { title: 'KI Heat Score', subtitle: 'Entdecken Sie die Juwelen', description: 'KI bewertet jeden Prospect 1-100 nach tatsächlicher Kaufabsicht.' },
        { title: 'ROI Dashboard', subtitle: 'Echtzeit-Zahlen', description: 'Provisionen, Conversions, Pipeline: Ihr gesamtes Geschäft auf einen Blick.' },
        { title: 'Wochenberichte', subtitle: 'Prioritäten jeden Montag', description: 'KOLO schickt Ihnen ein Briefing mit den wirkungsvollsten Aktionen der Woche.' },
      ],
    },
  },
  it: {
    close: 'Chiudi', next: 'Avanti', start: 'Inizia ora', slideOf: (a, b) => `${a} di ${b}`,
    pro: {
      slides: [
        { title: 'Benvenuto su KOLO PRO', subtitle: 'Il tuo abbonamento è attivo', description: 'Ora hai accesso a tutti gli strumenti per chiudere più affari.' },
        { title: 'Prospect e IA illimitati', subtitle: 'Nessun limite', description: 'Aggiungi tutti i prospect che vuoi. Genera suggerimenti IA a volontà.' },
        { title: 'SMS in un clic', subtitle: 'Follow-up istantanei', description: "L'IA scrive l'SMS perfetto. Tu approvi, lei invia." },
        { title: 'Cronologia completa', subtitle: 'Ogni interazione tracciata', description: 'Timeline interattiva di tutti i tuoi scambi, per non perdere il filo.' },
      ],
    },
    pro_plus: {
      slides: [
        { title: 'Benvenuto su KOLO PRO+', subtitle: 'Sei al top', description: 'Tutti gli strumenti premium per dominare il tuo mercato immobiliare.' },
        { title: 'Heat Score IA', subtitle: 'Individua le gemme', description: "L'IA valuta ogni prospect da 1 a 100 in base alla reale intenzione d'acquisto." },
        { title: 'ROI Dashboard', subtitle: 'Numeri in tempo reale', description: "Commissioni, conversioni, pipeline: tutto il tuo business a colpo d'occhio." },
        { title: 'Report settimanali', subtitle: 'Priorità ogni lunedì', description: 'KOLO ti invia un briefing con le azioni ad alto impatto della settimana.' },
      ],
    },
  },
};

// Icônes par slide — slide 0 = null (on affiche le logo KOLO à la place)
const ICONS_PRO = [null, InfinityIcon, MessageSquare, Clock];
const ICONS_PRO_PLUS = [null, Flame, BarChart3, CalendarCheck];

export const WelcomePROOnboarding = ({ plan, onClose }) => {
  const { locale } = useLocale();
  const { isDark } = useTheme();
  const [index, setIndex] = useState(0);

  const localeKey = CONTENT[locale] ? locale : 'en';
  const t = CONTENT[localeKey];
  const planKey = plan === 'pro_plus' ? 'pro_plus' : 'pro';
  const slides = t[planKey].slides;
  const icons = planKey === 'pro_plus' ? ICONS_PRO_PLUS : ICONS_PRO;
  const total = slides.length;
  const isLast = index === total - 1;
  const Icon = icons[index];
  const isPlusTier = planKey === 'pro_plus';

  useEffect(() => {
    // Confetti à l'ouverture — couleurs KOLO
    const duration = 1500;
    const end = Date.now() + duration;
    const colors = [BRAND_BLUE, BRAND_MAGENTA, '#FFFFFF'];
    (function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [planKey]);

  const handleNext = () => {
    if (isLast) onClose();
    else setIndex((i) => i + 1);
  };

  // Couleur active des dots = magenta KOLO
  const activeDotColor = BRAND_MAGENTA;

  return (
    <div
      data-testid="welcome-pro-onboarding"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: isDark
          ? 'radial-gradient(ellipse at top, rgba(0, 74, 173, 0.18) 0%, rgba(10, 10, 15, 0.99) 55%)'
          : 'radial-gradient(ellipse at top, rgba(203, 108, 230, 0.10) 0%, rgba(255, 255, 255, 0.99) 55%)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Close */}
      <button
        data-testid="welcome-pro-close"
        onClick={onClose}
        aria-label={t.close}
        style={{
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 16,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          color: isDark ? '#FFF' : '#111',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <X size={18} strokeWidth={2} />
      </button>

      {/* PRO+ tier ribbon top-left */}
      {isPlusTier && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(20px + env(safe-area-inset-top, 0px))',
            left: 20,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            padding: '6px 12px',
            borderRadius: 999,
            background: BRAND_GRADIENT,
            color: '#FFF',
            boxShadow: '0 4px 14px rgba(203, 108, 230, 0.35)',
            zIndex: 2,
          }}
        >
          PRO+
        </div>
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
          maxWidth: 520,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Hero visual */}
        {index === 0 ? (
          // Slide 1 : Logo KOLO officiel avec halo gradient
          <div
            key="logo-hero"
            style={{
              position: 'relative',
              marginBottom: 36,
              animation: 'welcomeLogoIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: -30,
                borderRadius: '50%',
                background: BRAND_GRADIENT,
                opacity: 0.25,
                filter: 'blur(32px)',
              }}
            />
            <img
              src={KOLO_LOGO}
              alt="KOLO"
              style={{
                position: 'relative',
                height: 64,
                width: 'auto',
                filter: isDark ? 'brightness(0) invert(1)' : 'none',
              }}
            />
          </div>
        ) : (
          // Slides 2-4 : Icône dans un "chip" gradient KOLO
          <div
            key={`icon-${index}`}
            style={{
              position: 'relative',
              width: 112,
              height: 112,
              marginBottom: 32,
              animation: 'welcomeIconIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            }}
          >
            {/* Glow behind */}
            <div
              style={{
                position: 'absolute',
                inset: -14,
                borderRadius: 34,
                background: BRAND_GRADIENT,
                opacity: 0.35,
                filter: 'blur(24px)',
              }}
            />
            {/* Icon container */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                borderRadius: 28,
                background: BRAND_GRADIENT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isPlusTier
                  ? '0 18px 48px rgba(0, 74, 173, 0.45), inset 0 1px 0 rgba(255,255,255,0.3)'
                  : '0 14px 38px rgba(203, 108, 230, 0.35)',
                border: isPlusTier ? '1.5px solid rgba(255,255,255,0.22)' : 'none',
              }}
            >
              {Icon && <Icon size={52} color="#FFF" strokeWidth={1.8} />}
            </div>
          </div>
        )}

        {/* Subtitle small */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            background: BRAND_GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 14,
          }}
        >
          {slides[index].subtitle}
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 'clamp(28px, 6vw, 40px)',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            color: isDark ? '#F5F5F7' : '#0A0A0F',
            marginBottom: 16,
          }}
        >
          {slides[index].title}
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.55,
            color: isDark ? '#A1A1AA' : '#4B5563',
            maxWidth: 420,
          }}
        >
          {slides[index].description}
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '0 24px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          maxWidth: 520,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Dots */}
        <div style={{ display: 'flex', gap: 8 }} aria-label={t.slideOf(index + 1, total)}>
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === index ? 28 : 8,
                height: 8,
                borderRadius: 4,
                background: i === index ? activeDotColor : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)'),
                transition: 'width 0.3s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          data-testid="welcome-pro-next"
          onClick={handleNext}
          style={{
            width: '100%',
            maxWidth: 360,
            height: 56,
            borderRadius: 28,
            border: 'none',
            background: BRAND_GRADIENT,
            color: '#FFF',
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 12px 32px rgba(0, 74, 173, 0.35)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {isLast ? t.start : t.next}
          <ChevronRight size={20} strokeWidth={2.5} />
        </button>
      </div>

      <style>{`
        @keyframes welcomeLogoIn {
          0% { transform: scale(0.7) translateY(8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes welcomeIconIn {
          0% { transform: scale(0.5) rotate(-6deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default WelcomePROOnboarding;
