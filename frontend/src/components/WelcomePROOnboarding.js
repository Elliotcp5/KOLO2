import React, { useState, useEffect } from 'react';
import { Crown, MessageSquare, Flame, TrendingUp, Sparkles, Infinity, X, ChevronRight } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import confetti from 'canvas-confetti';

const CONTENT = {
  fr: {
    close: 'Fermer',
    next: 'Suivant',
    start: 'Commencer maintenant',
    slideOf: (a, b) => `${a} sur ${b}`,
    pro: {
      slides: [
        {
          title: 'Bienvenue sur KOLO PRO',
          subtitle: 'Votre abonnement est actif',
          description: 'Vous avez désormais accès à tous les outils pour closer plus de deals.',
        },
        {
          title: 'Prospects & IA illimités',
          subtitle: 'Aucune limite',
          description: 'Ajoutez autant de prospects que vous voulez. Générez des suggestions IA à volonté.',
        },
        {
          title: 'SMS en un clic',
          subtitle: 'Relances instantanées',
          description: "L'IA rédige le SMS parfait pour chaque prospect. Vous validez, elle envoie.",
        },
        {
          title: 'Historique complet',
          subtitle: 'Chaque interaction tracée',
          description: 'Timeline interactive de tous vos échanges pour ne jamais perdre le fil.',
        },
      ],
    },
    pro_plus: {
      slides: [
        {
          title: 'Bienvenue sur KOLO PRO+',
          subtitle: 'Vous êtes au sommet',
          description: 'Tous les outils premium pour dominer votre marché immobilier.',
        },
        {
          title: 'Heat Score IA',
          subtitle: 'Détectez les pépites',
          description: "L'IA note chaque prospect de 1 à 100 selon leur intention d'achat réelle.",
        },
        {
          title: 'ROI Dashboard',
          subtitle: 'Vos chiffres en temps réel',
          description: 'Commissions, conversions, pipeline : tout votre business en un coup d\'œil.',
        },
        {
          title: 'Rapports hebdo',
          subtitle: 'Priorités chaque lundi',
          description: 'KOLO vous envoie un briefing avec vos actions à fort impact de la semaine.',
        },
      ],
    },
  },
  en: {
    close: 'Close',
    next: 'Next',
    start: 'Start now',
    slideOf: (a, b) => `${a} of ${b}`,
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
        { title: 'Welcome to KOLO PRO+', subtitle: 'You\'re at the top', description: 'Every premium tool to dominate your real estate market.' },
        { title: 'AI Heat Score', subtitle: 'Spot the gems', description: 'AI rates each prospect 1-100 based on real buying intent.' },
        { title: 'ROI Dashboard', subtitle: 'Real-time numbers', description: 'Commissions, conversions, pipeline: your whole business at a glance.' },
        { title: 'Weekly reports', subtitle: 'Priorities every Monday', description: 'KOLO sends you a briefing with your high-impact actions of the week.' },
      ],
    },
  },
  de: {
    close: 'Schließen',
    next: 'Weiter',
    start: 'Jetzt starten',
    slideOf: (a, b) => `${a} von ${b}`,
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
    close: 'Chiudi',
    next: 'Avanti',
    start: 'Inizia ora',
    slideOf: (a, b) => `${a} di ${b}`,
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
        { title: 'ROI Dashboard', subtitle: 'Numeri in tempo reale', description: 'Commissioni, conversioni, pipeline: tutto il tuo business a colpo d\'occhio.' },
        { title: 'Report settimanali', subtitle: 'Priorità ogni lunedì', description: 'KOLO ti invia un briefing con le azioni ad alto impatto della settimana.' },
      ],
    },
  },
};

const ICONS_PRO = [Crown, Infinity, MessageSquare, Sparkles];
const ICONS_PRO_PLUS = [Crown, Flame, TrendingUp, Sparkles];

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
  const Icon = icons[index] || Sparkles;

  useEffect(() => {
    // Confetti à l'ouverture
    const duration = 1500;
    const end = Date.now() + duration;
    const colors = planKey === 'pro_plus' ? ['#FFD700', '#FF6B6B', '#4ECDC4'] : ['#8B5CF6', '#3B82F6', '#EC4899'];
    (function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [planKey]);

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const gradient = planKey === 'pro_plus'
    ? 'linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #EC4899 100%)'
    : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)';

  return (
    <div
      data-testid="welcome-pro-onboarding"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: isDark ? 'rgba(10, 10, 15, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Close button */}
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
        {/* Icon hero */}
        <div
          key={index}
          style={{
            width: 120,
            height: 120,
            borderRadius: 32,
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
            boxShadow: '0 20px 60px rgba(139, 92, 246, 0.35)',
            animation: 'welcomeProIconIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          <Icon size={56} color="#FFF" strokeWidth={1.6} />
        </div>

        {/* Subtitle (small) */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isDark ? '#A78BFA' : '#7C3AED',
            marginBottom: 12,
          }}
        >
          {slides[index].subtitle}
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 'clamp(28px, 6vw, 40px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            color: isDark ? '#F5F5F7' : '#111827',
            marginBottom: 16,
          }}
        >
          {slides[index].title}
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.5,
            color: isDark ? '#A1A1AA' : '#4B5563',
            maxWidth: 420,
          }}
        >
          {slides[index].description}
        </p>
      </div>

      {/* Footer: dots + CTA */}
      <div
        style={{
          padding: '0 24px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          maxWidth: 520,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 8 }} aria-label={t.slideOf(index + 1, total)}>
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === index ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === index
                  ? (planKey === 'pro_plus' ? '#F59E0B' : '#8B5CF6')
                  : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
                transition: 'width 0.3s ease, background 0.3s ease',
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
            background: gradient,
            color: '#FFF',
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 10px 30px rgba(139, 92, 246, 0.4)',
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
        @keyframes welcomeProIconIn {
          0% { transform: scale(0.5) rotate(-8deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default WelcomePROOnboarding;
