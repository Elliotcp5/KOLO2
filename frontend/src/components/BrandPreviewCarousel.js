import React, { useState, useEffect, useMemo } from 'react';
import {
  Phone, MessageCircle, Calendar, Mail, TrendingUp, Flame, CheckCircle2,
  Home, BarChart3, Users, ChevronLeft, Search, Bell, Sparkles,
} from 'lucide-react';

/**
 * Live iPhone-frame brand preview carousel.
 * Renders 3 mocked screens (Login → Dashboard → Network space) that re-brand
 * in real-time based on the wizard config (colors, logo, font, name, tagline).
 */
const BrandPreviewCarousel = ({ config, autoplay = true }) => {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const screens = useMemo(() => ['login', 'dashboard', 'network'], []);

  useEffect(() => {
    if (!autoplay || paused) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % screens.length), 4200);
    return () => clearInterval(t);
  }, [autoplay, paused, screens.length]);

  const primary = config.primary_color || '#8B5CF6';
  const secondary = config.secondary_color || '#EC4899';
  const font = config.font_family || 'Inter';
  const brandName = config.name || 'Votre marque';
  const tagline = config.tagline || 'Le CRM qui fait grandir ton réseau';
  const logo = config.logo_url;
  const initials = (brandName || 'KO').split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();

  const currentScreen = screens[idx];

  return (
    <div
      data-testid="brand-preview-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B7280', fontWeight: 700, alignSelf: 'flex-start' }}>
        Aperçu live — application mobile
      </div>

      {/* iPhone frame */}
      <div
        style={{
          width: 280,
          height: 568,
          borderRadius: 44,
          padding: 10,
          background: 'linear-gradient(145deg, #1a1a1c, #2c2c2e)',
          boxShadow: '0 30px 60px -20px rgba(0,0,0,0.45), 0 0 0 2px rgba(255,255,255,0.04) inset, 0 0 0 6px #0c0c0d',
          position: 'relative',
          fontFamily: font,
        }}
      >
        {/* Side buttons */}
        <span style={{ position: 'absolute', left: -2, top: 110, width: 3, height: 56, background: '#1a1a1c', borderRadius: '2px 0 0 2px' }} />
        <span style={{ position: 'absolute', left: -2, top: 180, width: 3, height: 56, background: '#1a1a1c', borderRadius: '2px 0 0 2px' }} />
        <span style={{ position: 'absolute', right: -2, top: 150, width: 3, height: 86, background: '#1a1a1c', borderRadius: '0 2px 2px 0' }} />

        {/* Screen */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 34,
            overflow: 'hidden',
            background: '#fff',
            position: 'relative',
          }}
        >
          {/* Dynamic Island */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 86,
              height: 22,
              background: '#000',
              borderRadius: 14,
              zIndex: 20,
            }}
          />

          {/* Status bar */}
          <div
            style={{
              padding: '14px 22px 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: currentScreen === 'login' ? '#fff' : '#000',
              position: 'relative',
              zIndex: 10,
            }}
          >
            <span>9:41</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10 }}>5G</span>
              <span style={{ width: 18, height: 9, border: '1.2px solid currentColor', borderRadius: 2, position: 'relative' }}>
                <span style={{ position: 'absolute', inset: 1, background: 'currentColor', borderRadius: 1, width: '70%' }} />
              </span>
            </span>
          </div>

          {/* Screen content */}
          <div style={{ height: 'calc(100% - 30px)', overflow: 'hidden', position: 'relative' }}>
            {currentScreen === 'login' && (
              <LoginMock primary={primary} secondary={secondary} brandName={brandName} tagline={tagline} logo={logo} initials={initials} font={font} />
            )}
            {currentScreen === 'dashboard' && (
              <DashboardMock primary={primary} secondary={secondary} brandName={brandName} logo={logo} initials={initials} font={font} />
            )}
            {currentScreen === 'network' && (
              <NetworkMock primary={primary} secondary={secondary} brandName={brandName} logo={logo} initials={initials} font={font} />
            )}
          </div>
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }} data-testid="preview-dots">
        {screens.map((s, i) => (
          <button
            key={s}
            onClick={() => setIdx(i)}
            data-testid={`preview-dot-${s}`}
            aria-label={`Voir écran ${s}`}
            style={{
              width: i === idx ? 24 : 7,
              height: 7,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: i === idx ? `linear-gradient(90deg, ${primary}, ${secondary})` : 'rgba(0,0,0,0.18)',
              transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
              padding: 0,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {currentScreen === 'login' && 'Écran d\'accueil brandé'}
        {currentScreen === 'dashboard' && 'Tableau de bord agent'}
        {currentScreen === 'network' && 'Espace réseau B2B'}
      </div>
    </div>
  );
};

// =========================================================================
// Mock 1 — Login / Welcome screen (brand colors as full-bleed gradient)
// =========================================================================
const LoginMock = ({ primary, secondary, brandName, tagline, logo, initials, font }) => (
  <div
    style={{
      height: '100%',
      background: `linear-gradient(160deg, ${primary} 0%, ${secondary} 100%)`,
      display: 'flex',
      flexDirection: 'column',
      padding: '38px 22px 22px',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* mesh blur ornament */}
    <div style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, background: 'rgba(255,255,255,0.18)', borderRadius: '50%', filter: 'blur(50px)' }} />
    <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, background: 'rgba(255,255,255,0.08)', borderRadius: '50%', filter: 'blur(40px)' }} />

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 2 }}>
      {logo ? (
        <img
          src={logo}
          alt={brandName}
          style={{ maxHeight: 56, maxWidth: 140, marginBottom: 18, filter: 'brightness(0) invert(1)' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'rgba(255,255,255,0.16)',
          backdropFilter: 'blur(10px)',
          display: 'grid', placeItems: 'center',
          fontSize: 24, fontWeight: 800, marginBottom: 18,
          border: '1px solid rgba(255,255,255,0.25)',
        }}>{initials}</div>
      )}
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, fontFamily: font, lineHeight: 1.1 }}>{brandName}</div>
      <div style={{ fontSize: 12, opacity: 0.92, marginBottom: 28, maxWidth: 200, lineHeight: 1.4 }}>{tagline}</div>

      <button style={{
        width: '100%', padding: '13px 16px', borderRadius: 14,
        background: '#fff', color: primary,
        border: 'none', fontSize: 13, fontWeight: 800, fontFamily: font,
        boxShadow: '0 10px 24px -8px rgba(0,0,0,0.25)',
        marginBottom: 10,
      }}>Se connecter</button>
      <button style={{
        width: '100%', padding: '12px 16px', borderRadius: 14,
        background: 'rgba(255,255,255,0.12)', color: '#fff',
        border: '1px solid rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600, fontFamily: font,
        backdropFilter: 'blur(8px)',
      }}>Créer un compte</button>
    </div>
    <div style={{ textAlign: 'center', fontSize: 9.5, opacity: 0.75, fontWeight: 500, marginTop: 12 }}>
      {brandName} powered by <span style={{ fontWeight: 800 }}>KOLO</span>
    </div>
  </div>
);

// =========================================================================
// Mock 2 — Agent dashboard (light, primary accents on stats + CTA)
// =========================================================================
const DashboardMock = ({ primary, secondary, brandName, logo, initials, font }) => (
  <div style={{ height: '100%', background: '#FAFAFB', display: 'flex', flexDirection: 'column' }}>
    {/* Header */}
    <div style={{
      padding: '8px 18px 14px',
      background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
      color: '#fff',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {logo ? (
            <img src={logo} alt={brandName} style={{ height: 18, maxWidth: 80, filter: 'brightness(0) invert(1)' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800 }}>{initials}</div>
          )}
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: font }}>{brandName}</span>
        </div>
        <Bell size={14} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 12, fontFamily: font }}>Bonjour Thomas 👋</div>
      <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 2 }}>3 tâches à faire aujourd'hui</div>
    </div>

    {/* Stats grid */}
    <div style={{ padding: '14px 14px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <StatCard icon={<Flame size={11} color={primary} />} label="Prospects chauds" value="12" accent={primary} font={font} />
      <StatCard icon={<TrendingUp size={11} color={secondary} />} label="Ce mois" value="+24%" accent={secondary} font={font} />
      <StatCard icon={<CheckCircle2 size={11} color={primary} />} label="Vendus" value="4" accent={primary} font={font} />
      <StatCard icon={<Phone size={11} color={secondary} />} label="Appels" value="47" accent={secondary} font={font} />
    </div>

    {/* Tasks card */}
    <div style={{ padding: '12px 14px 0', flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, fontFamily: font }}>Aujourd'hui</div>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 12,
        boxShadow: '0 2px 8px -3px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.04)',
        marginBottom: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111', fontFamily: font }}>Rappeler Mme Dubois</div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Bien à Neuilly · 14h00</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <PillBtn icon={<Phone size={10} />} bg={primary} label="Appeler" font={font} />
          <PillBtn icon={<MessageCircle size={10} />} bg="#25D366" label="WhatsApp" font={font} />
          <PillBtn icon={<Calendar size={10} />} bg={secondary} label="RDV" font={font} />
        </div>
      </div>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 12,
        boxShadow: '0 2px 8px -3px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111', fontFamily: font }}>Email à M. Lefebvre</div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Offre acceptée · suite</div>
      </div>
    </div>

    {/* Bottom nav */}
    <div style={{
      display: 'flex', justifyContent: 'space-around', padding: '8px 0 14px',
      background: '#fff', borderTop: '1px solid rgba(0,0,0,0.06)',
    }}>
      <NavIcon icon={<Home size={16} />} active accent={primary} label="Accueil" font={font} />
      <NavIcon icon={<Users size={16} />} accent={primary} label="Prospects" font={font} />
      <NavIcon icon={<BarChart3 size={16} />} accent={primary} label="Stats" font={font} />
      <NavIcon icon={<Mail size={16} />} accent={primary} label="Inbox" font={font} />
    </div>
  </div>
);

// =========================================================================
// Mock 3 — Network space (B2B): admin view with sidebar brand + KPIs
// =========================================================================
const NetworkMock = ({ primary, secondary, brandName, logo, initials, font }) => (
  <div style={{ height: '100%', background: '#FAFAFB', display: 'flex', flexDirection: 'column' }}>
    <div style={{
      padding: '10px 16px',
      background: '#fff',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <ChevronLeft size={16} color={primary} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        {logo ? (
          <img src={logo} alt={brandName} style={{ height: 16, maxWidth: 70 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div style={{ width: 18, height: 18, borderRadius: 6, background: primary, display: 'grid', placeItems: 'center', fontSize: 8.5, fontWeight: 800, color: '#fff' }}>{initials}</div>
        )}
        <span style={{ fontSize: 12, fontWeight: 800, color: '#111', fontFamily: font }}>{brandName}</span>
      </div>
      <Search size={14} color="#9CA3AF" />
    </div>

    <div style={{ padding: '12px 14px 0' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#111', fontFamily: font, marginBottom: 2 }}>Mon réseau</div>
      <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 12 }}>23 agents actifs · 4 managers</div>

      {/* Highlight metric */}
      <div style={{
        background: `linear-gradient(135deg, ${primary}15, ${secondary}10)`,
        border: `1px solid ${primary}30`,
        borderRadius: 12, padding: 12, marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9.5, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>CA généré · mois</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: primary, fontFamily: font, marginTop: 2 }}>284 K€</div>
          </div>
          <div style={{
            padding: '3px 7px', borderRadius: 999,
            background: '#22C55E15', color: '#15803D',
            fontSize: 9, fontWeight: 800,
          }}>↑ +18%</div>
        </div>
      </div>

      {/* Agent list */}
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontFamily: font }}>Top performers</div>
    </div>

    <div style={{ flex: 1, overflow: 'hidden', padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[
        { name: 'Sophie Martel', score: 92, color: primary, role: 'Manager' },
        { name: 'Lucas Bernard', score: 87, color: secondary, role: 'Agent' },
        { name: 'Emma Lefèvre', score: 81, color: primary, role: 'Agent' },
      ].map((a, i) => (
        <div key={i} style={{
          background: '#fff', borderRadius: 10, padding: '8px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 1px 4px -2px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.04)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: a.color, display: 'grid', placeItems: 'center',
            color: '#fff', fontSize: 10, fontWeight: 800,
          }}>{a.name.split(' ').map((w) => w[0]).join('')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111', fontFamily: font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF' }}>{a.role}</div>
          </div>
          <div style={{
            padding: '3px 8px', borderRadius: 999,
            background: `${a.color}15`, color: a.color,
            fontSize: 10, fontWeight: 800, fontFamily: font,
          }}>{a.score}</div>
        </div>
      ))}
    </div>

    <div style={{
      padding: '8px 14px 12px',
      borderTop: '1px solid rgba(0,0,0,0.06)',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <Sparkles size={12} color={primary} />
      <span style={{ fontSize: 9.5, color: '#6B7280', fontWeight: 600 }}>{brandName} powered by <span style={{ fontWeight: 800, color: '#111' }}>KOLO</span></span>
    </div>
  </div>
);

const StatCard = ({ icon, label, value, accent, font }) => (
  <div style={{
    background: '#fff', borderRadius: 10, padding: '8px 10px',
    boxShadow: '0 2px 8px -3px rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.04)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
      {icon}
      <span style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
    </div>
    <div style={{ fontSize: 16, fontWeight: 800, color: accent, fontFamily: font }}>{value}</div>
  </div>
);

const PillBtn = ({ icon, bg, label, font }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 3,
    padding: '4px 8px', borderRadius: 999,
    background: bg, color: '#fff',
    fontSize: 9, fontWeight: 700, fontFamily: font,
  }}>
    {icon}<span>{label}</span>
  </div>
);

const NavIcon = ({ icon, label, active, accent, font }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    color: active ? accent : '#9CA3AF',
  }}>
    {icon}
    <span style={{ fontSize: 8.5, fontWeight: active ? 800 : 500, fontFamily: font }}>{label}</span>
  </div>
);

export default BrandPreviewCarousel;
