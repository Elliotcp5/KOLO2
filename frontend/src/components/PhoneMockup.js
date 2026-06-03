import React, { useEffect, useState } from 'react';
import { Phone, MessageCircle, Sparkles, Flame, CheckCircle2, Zap } from 'lucide-react';

/**
 * Realistic iPhone with animated KOLO app — runs as a demo loop:
 *  Frame 0 — Stats count up (0→3 / 0→12 / 0→5)
 *  Frame 1 — AI suggestion 1 slides in
 *  Frame 2 — AI suggestion cycles (1 → 2 → 3 → 1…)
 *  Frame 3 — Cursor "clicks" on a task → it gets checked
 *  Loops every ~12 seconds.
 */

const TIPS = [
  { name: 'Marie Leblanc', text: 'Propose un rdv pour la villa à Cassis — budget OK', icon: Sparkles, color: '#EC4899' },
  { name: 'Thomas Moreau', text: 'Relance par SMS — pas de réponse depuis 5 jours', icon: MessageCircle, color: '#8B5CF6' },
  { name: 'Sophie Curel', text: 'Appel à programmer cette semaine — prospect chaud', icon: Phone, color: '#F59E0B' },
];

const useDemoLoop = () => {
  const [tipIndex, setTipIndex] = useState(0);
  const [stats, setStats] = useState({ todo: 0, prospects: 0, done: 0 });
  const [taskDone, setTaskDone] = useState({ 0: false, 1: false, 2: true });
  const [cursorPos, setCursorPos] = useState(null);

  useEffect(() => {
    // Count up stats once at mount
    let i = 0;
    const targets = { todo: 3, prospects: 12, done: 5 };
    const itCount = setInterval(() => {
      i++;
      setStats({
        todo: Math.min(i, targets.todo),
        prospects: Math.min(i, targets.prospects),
        done: Math.min(i, targets.done),
      });
      if (i >= targets.prospects) clearInterval(itCount);
    }, 90);

    // Cycle AI tips
    const itTip = setInterval(() => setTipIndex((x) => (x + 1) % TIPS.length), 3500);

    // Cursor demo : every ~9s, point at task #1, click, check it, then reset
    const cursorScript = () => {
      // Move to task index 0
      setCursorPos({ x: 200, y: 380 });
      setTimeout(() => setCursorPos({ x: 180, y: 415 }), 800);
      setTimeout(() => {
        setTaskDone((d) => ({ ...d, 0: true }));
        setCursorPos(null);
      }, 2000);
      // Reset after 4 seconds
      setTimeout(() => setTaskDone({ 0: false, 1: false, 2: true }), 6000);
    };
    cursorScript();
    const itCursor = setInterval(cursorScript, 11000);

    return () => {
      clearInterval(itCount);
      clearInterval(itTip);
      clearInterval(itCursor);
    };
  }, []);

  return { tipIndex, stats, taskDone, cursorPos };
};

const PhoneMockup = () => {
  const { tipIndex, stats, taskDone, cursorPos } = useDemoLoop();
  const currentTip = TIPS[tipIndex];
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
          {/* Status bar with Dynamic Island INSIDE for proper alignment */}
          <div className="kolo-iphone-statusbar">
            <span className="kolo-iphone-time">9:41</span>
            <div className="kolo-iphone-island" />
            <div className="kolo-iphone-statusbar-right">
              <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor" aria-hidden="true"><rect x="0" y="6" width="3" height="4" rx="0.5"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="2" width="3" height="8" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor" aria-hidden="true"><path d="M7 1.2C4.5 1.2 2.2 2.1 0.4 3.6L7 9.5L13.6 3.6C11.8 2.1 9.5 1.2 7 1.2Z"/></svg>
              <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true"><rect x="0" y="1" width="18" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1"/><rect x="19" y="3.5" width="1.5" height="3" rx="0.5" fill="currentColor"/><rect x="1.5" y="2.5" width="14" height="5" rx="1" fill="currentColor"/></svg>
            </div>
          </div>

          {/* App content */}
          <div className="kolo-iphone-content">
            <div className="kolo-iphone-app-header">
              <div className="kolo-iphone-logo">
                KOLO
                <span className="kolo-iphone-logo-dot" />
              </div>
              <div className="kolo-iphone-avatar">EL</div>
            </div>

            <div className="kolo-iphone-title">Aujourd'hui</div>
            <div className="kolo-iphone-subtitle">Mercredi 3 juin</div>

            <div className="kolo-iphone-stats">
              <div className="kolo-iphone-stat kolo-iphone-stat-active">
                <div className="kolo-iphone-stat-num">{stats.todo}</div>
                <div className="kolo-iphone-stat-label">À faire</div>
              </div>
              <div className="kolo-iphone-stat">
                <div className="kolo-iphone-stat-num">{stats.prospects}</div>
                <div className="kolo-iphone-stat-label">Prospects</div>
              </div>
              <div className="kolo-iphone-stat">
                <div className="kolo-iphone-stat-num">{stats.done}</div>
                <div className="kolo-iphone-stat-label">Faits</div>
              </div>
            </div>

            <div key={tipIndex} className="kolo-iphone-ai-card">
              <div className="kolo-iphone-ai-header">
                <div className="kolo-iphone-ai-icon" style={{ background: `${currentTip.color}25`, color: currentTip.color }}>
                  <TipIcon size={11} strokeWidth={2.5} />
                </div>
                <div className="kolo-iphone-ai-label">Suggestion IA</div>
                <div className="kolo-iphone-ai-pill">{tipIndex + 1}/{TIPS.length}</div>
              </div>
              <div className="kolo-iphone-ai-name">{currentTip.name}</div>
              <div className="kolo-iphone-ai-text">{currentTip.text}</div>
            </div>

            <div className={`kolo-iphone-task ${taskDone[0] ? 'kolo-iphone-task-done' : ''}`}>
              <div className="kolo-iphone-task-icon kolo-iphone-task-call"><Phone size={11} strokeWidth={2.5} /></div>
              <div className="kolo-iphone-task-body">
                <div className="kolo-iphone-task-title">Appel · Marie L.</div>
                <div className="kolo-iphone-task-sub">14h30 · Budget validé</div>
              </div>
              {!taskDone[0] ? <Flame size={12} color="#EF4444" /> : <CheckCircle2 size={12} color="#10B981" />}
            </div>

            <div className={`kolo-iphone-task ${taskDone[1] ? 'kolo-iphone-task-done' : ''}`}>
              <div className="kolo-iphone-task-icon kolo-iphone-task-msg"><MessageCircle size={11} strokeWidth={2.5} /></div>
              <div className="kolo-iphone-task-body">
                <div className="kolo-iphone-task-title">WhatsApp · Thomas M.</div>
                <div className="kolo-iphone-task-sub">Relance · sans réponse</div>
              </div>
              {!taskDone[1] ? <Zap size={12} color="#F59E0B" /> : <CheckCircle2 size={12} color="#10B981" />}
            </div>

            <div className="kolo-iphone-task kolo-iphone-task-done">
              <div className="kolo-iphone-task-icon kolo-iphone-task-check"><CheckCircle2 size={11} strokeWidth={2.5} /></div>
              <div className="kolo-iphone-task-body">
                <div className="kolo-iphone-task-title">Visite · Sophie C.</div>
                <div className="kolo-iphone-task-sub">Terminée · qualifiée</div>
              </div>
            </div>
          </div>

          {/* Bottom nav (3 tabs evenly distributed) */}
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

          {/* Animated cursor (demo) */}
          {cursorPos && (
            <div
              className="kolo-iphone-cursor"
              style={{
                left: `${cursorPos.x}px`,
                top: `${cursorPos.y}px`,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path
                  d="M3 2 L3 16 L7 12 L9 17 L11 16 L9 11 L14 11 Z"
                  fill="#fff"
                  stroke="#0B0B0F"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="kolo-iphone-cursor-ripple" />
            </div>
          )}

          {/* Live notification toast (appears on click) */}
          {taskDone[0] && (
            <div className="kolo-iphone-toast">
              <CheckCircle2 size={14} />
              <span>Appel programmé pour 14h30</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating chips around the phone */}
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
