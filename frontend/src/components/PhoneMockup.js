import React, { useEffect, useState } from 'react';
import { Phone, MessageCircle, Sparkles, Flame, CheckCircle2 } from 'lucide-react';

/**
 * Realistic iPhone frame mockup with animated KOLO app content inside.
 * - True iPhone proportions (notch, side buttons, rounded screen corners)
 * - Animated cards (staggered fade-in on mount + auto-rotating "AI suggestion")
 * - Subtle floating animation
 */
const PhoneMockup = () => {
  const [tipIndex, setTipIndex] = useState(0);
  const tips = [
    { name: 'Marie Leblanc', text: 'Propose un rdv pour la villa à Cassis (budget OK)', icon: Sparkles, color: '#EC4899' },
    { name: 'Thomas Moreau', text: 'Relance par SMS — pas de réponse depuis 5 jours', icon: MessageCircle, color: '#8B5CF6' },
    { name: 'Sophie Curel', text: 'Appel à programmer cette semaine (chaud)', icon: Phone, color: '#F59E0B' },
  ];

  useEffect(() => {
    const i = setInterval(() => setTipIndex((x) => (x + 1) % tips.length), 3500);
    return () => clearInterval(i);
  }, [tips.length]);

  const currentTip = tips[tipIndex];
  const TipIcon = currentTip.icon;

  return (
    <div className="kolo-iphone-stage">
      <div className="kolo-iphone">
        {/* Side buttons */}
        <div className="kolo-iphone-btn kolo-iphone-btn-power" />
        <div className="kolo-iphone-btn kolo-iphone-btn-vol-up" />
        <div className="kolo-iphone-btn kolo-iphone-btn-vol-down" />
        <div className="kolo-iphone-btn kolo-iphone-btn-mute" />

        {/* Screen */}
        <div className="kolo-iphone-screen">
          {/* Dynamic Island */}
          <div className="kolo-iphone-island" />

          {/* Status bar */}
          <div className="kolo-iphone-statusbar">
            <span>9:41</span>
            <div className="kolo-iphone-statusbar-right">
              <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="0.5"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="2" width="3" height="8" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><path d="M7 1.2C4.5 1.2 2.2 2.1 0.4 3.6L7 9.5L13.6 3.6C11.8 2.1 9.5 1.2 7 1.2Z"/></svg>
              <svg width="22" height="10" viewBox="0 0 22 10"><rect x="0" y="1" width="18" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1"/><rect x="19" y="3.5" width="1.5" height="3" rx="0.5" fill="currentColor"/><rect x="1.5" y="2.5" width="14" height="5" rx="1" fill="currentColor"/></svg>
            </div>
          </div>

          {/* App content */}
          <div className="kolo-iphone-content">
            {/* App header */}
            <div className="kolo-iphone-app-header">
              <div className="kolo-iphone-logo">
                KOLO
                <span className="kolo-iphone-logo-dot" />
              </div>
              <div className="kolo-iphone-avatar">EL</div>
            </div>

            {/* Title */}
            <div className="kolo-iphone-title">Aujourd'hui</div>
            <div className="kolo-iphone-subtitle">Mercredi 3 juin</div>

            {/* Stat tabs */}
            <div className="kolo-iphone-stats">
              <div className="kolo-iphone-stat kolo-iphone-stat-active">
                <div className="kolo-iphone-stat-num">3</div>
                <div className="kolo-iphone-stat-label">À faire</div>
              </div>
              <div className="kolo-iphone-stat">
                <div className="kolo-iphone-stat-num">12</div>
                <div className="kolo-iphone-stat-label">Prospects</div>
              </div>
              <div className="kolo-iphone-stat">
                <div className="kolo-iphone-stat-num">5</div>
                <div className="kolo-iphone-stat-label">Faits</div>
              </div>
            </div>

            {/* AI Suggestion (animated) */}
            <div key={tipIndex} className="kolo-iphone-ai-card">
              <div className="kolo-iphone-ai-header">
                <div className="kolo-iphone-ai-icon" style={{ background: `${currentTip.color}25`, color: currentTip.color }}>
                  <TipIcon size={11} strokeWidth={2.5} />
                </div>
                <div className="kolo-iphone-ai-label">Suggestion IA</div>
                <div className="kolo-iphone-ai-pill">{tipIndex + 1}/3</div>
              </div>
              <div className="kolo-iphone-ai-name">{currentTip.name}</div>
              <div className="kolo-iphone-ai-text">{currentTip.text}</div>
            </div>

            {/* Task cards */}
            <div className="kolo-iphone-task">
              <div className="kolo-iphone-task-icon kolo-iphone-task-call"><Phone size={11} strokeWidth={2.5} /></div>
              <div className="kolo-iphone-task-body">
                <div className="kolo-iphone-task-title">Appel · Marie L.</div>
                <div className="kolo-iphone-task-sub">14h30 · Budget validé</div>
              </div>
              <Flame size={12} color="#EF4444" />
            </div>

            <div className="kolo-iphone-task">
              <div className="kolo-iphone-task-icon kolo-iphone-task-msg"><MessageCircle size={11} strokeWidth={2.5} /></div>
              <div className="kolo-iphone-task-body">
                <div className="kolo-iphone-task-title">WhatsApp · Thomas M.</div>
                <div className="kolo-iphone-task-sub">Relance · sans réponse</div>
              </div>
            </div>

            <div className="kolo-iphone-task kolo-iphone-task-done">
              <div className="kolo-iphone-task-icon kolo-iphone-task-check"><CheckCircle2 size={11} strokeWidth={2.5} /></div>
              <div className="kolo-iphone-task-body">
                <div className="kolo-iphone-task-title">Visite · Sophie C.</div>
                <div className="kolo-iphone-task-sub">Terminée · qualifiée</div>
              </div>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="kolo-iphone-bottomnav">
            <div className="kolo-iphone-tab kolo-iphone-tab-active">
              <div className="kolo-iphone-tab-dot" />
              <span>Aujourd'hui</span>
            </div>
            <div className="kolo-iphone-tab">
              <span>Prospects</span>
            </div>
            <div className="kolo-iphone-tab">
              <span>Réseau</span>
            </div>
          </div>

          {/* Home indicator */}
          <div className="kolo-iphone-home" />
        </div>
      </div>

      {/* Floating chips around the phone (parallax-ready) */}
      <div className="kolo-iphone-chip kolo-iphone-chip-1">
        <Sparkles size={12} /> IA proactive
      </div>
      <div className="kolo-iphone-chip kolo-iphone-chip-2">
        <Phone size={12} /> Appels &amp; WhatsApp
      </div>
      <div className="kolo-iphone-chip kolo-iphone-chip-3">
        <CheckCircle2 size={12} /> 0 client oublié
      </div>
    </div>
  );
};

export default PhoneMockup;
