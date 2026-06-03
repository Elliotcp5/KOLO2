import React, { useEffect, useRef, useState } from 'react';
import { Phone, MessageCircle, Sparkles, Flame, CheckCircle2, Zap, Calendar, Send } from 'lucide-react';

const TIPS = [
  { name: 'Marie Leblanc', text: 'Propose un rdv pour la villa à Cassis — budget OK', icon: Sparkles, color: '#EC4899', tag: 'Chaud' },
  { name: 'Thomas Moreau', text: 'Relance par SMS — pas de réponse depuis 5 jours', icon: MessageCircle, color: '#8B5CF6', tag: 'Tiède' },
  { name: 'Sophie Curel', text: 'Appel à programmer cette semaine — prospect chaud', icon: Phone, color: '#F59E0B', tag: 'À rappeler' },
];

const TASKS_INIT = [
  { id: 't1', icon: Phone, kind: 'call', title: 'Appel · Marie L.', sub: '14h30 · Budget validé', tag: 'urgent', tagColor: '#EF4444', tagIcon: Flame, done: false, detail: 'Budget : 850 k€ · 3 pièces · quartier prioritaire' },
  { id: 't2', icon: MessageCircle, kind: 'msg', title: 'WhatsApp · Thomas M.', sub: 'Relance · sans réponse', tag: 'today', tagColor: '#F59E0B', tagIcon: Zap, done: false, detail: 'Vu hier la fiche 3x. Pas répondu au dernier message.' },
  { id: 't3', icon: CheckCircle2, kind: 'check', title: 'Visite · Sophie C.', sub: 'Terminée · qualifiée', tag: null, done: true, detail: 'Visite OK · prochaine étape : offre' },
];

const PhoneMockup = () => {
  const [tipIndex, setTipIndex] = useState(0);
  const [tasks, setTasks] = useState(TASKS_INIT);
  const [activeTask, setActiveTask] = useState(null);
  const [toast, setToast] = useState(null);
  const [hover, setHover] = useState(false);
  const phoneRef = useRef(null);

  // Cycle AI tips every 4s
  useEffect(() => {
    const i = setInterval(() => setTipIndex((x) => (x + 1) % TIPS.length), 4000);
    return () => clearInterval(i);
  }, []);

  // 3D tilt — follow mouse on desktop
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(max-width: 768px)').matches) return;

    const el = phoneRef.current;
    if (!el) return;

    let rafId;
    let tX = 0, tY = 0, cX = 0, cY = 0;

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
      tX = Math.max(-1, Math.min(1, x));
      tY = Math.max(-1, Math.min(1, y));
    };
    const tick = () => {
      cX += (tX - cX) * 0.06;
      cY += (tY - cY) * 0.06;
      el.style.setProperty('--tilt-y', `${cX * 8}deg`);
      el.style.setProperty('--tilt-x', `${-cY * 6}deg`);
      rafId = requestAnimationFrame(tick);
    };
    el.parentElement.addEventListener('mousemove', onMove);
    rafId = requestAnimationFrame(tick);
    return () => {
      el.parentElement?.removeEventListener('mousemove', onMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const currentTip = TIPS[tipIndex];
  const TipIcon = currentTip.icon;

  const toggleTask = (id) => {
    setTasks((all) => all.map((t) => t.id === id ? { ...t, done: !t.done } : t));
    const t = tasks.find((x) => x.id === id);
    if (t && !t.done) {
      const messages = {
        t1: 'Appel programmé pour 14h30',
        t2: 'Message WhatsApp envoyé',
        t3: 'Tâche terminée',
      };
      setToast(messages[id] || 'Fait ✓');
      setTimeout(() => setToast(null), 2200);
    }
  };

  const expandTask = (id) => {
    setActiveTask(activeTask === id ? null : id);
  };

  return (
    <div className="kolo-stage">
      {/* Animated gradient backdrop behind the phone */}
      <div className="kolo-stage-aura" aria-hidden="true">
        <div className="kolo-stage-blob kolo-stage-blob-1" />
        <div className="kolo-stage-blob kolo-stage-blob-2" />
        <div className="kolo-stage-blob kolo-stage-blob-3" />
      </div>

      <div
        ref={phoneRef}
        className={`kolo-iphone ${hover ? 'is-hover' : ''}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Side buttons */}
        <div className="kolo-iphone-btn kolo-iphone-btn-power" />
        <div className="kolo-iphone-btn kolo-iphone-btn-vol-up" />
        <div className="kolo-iphone-btn kolo-iphone-btn-vol-down" />
        <div className="kolo-iphone-btn kolo-iphone-btn-mute" />

        <div className="kolo-iphone-screen">
          {/* Status bar */}
          <div className="kolo-iphone-statusbar">
            <span className="kolo-iphone-time">9:41</span>
            <div className="kolo-iphone-island" />
            <div className="kolo-iphone-statusbar-right">
              <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="0.5"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="2" width="3" height="8" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><path d="M7 1.2C4.5 1.2 2.2 2.1 0.4 3.6L7 9.5L13.6 3.6C11.8 2.1 9.5 1.2 7 1.2Z"/></svg>
              <svg width="22" height="10" viewBox="0 0 22 10"><rect x="0" y="1" width="18" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1"/><rect x="19" y="3.5" width="1.5" height="3" rx="0.5" fill="currentColor"/><rect x="1.5" y="2.5" width="14" height="5" rx="1" fill="currentColor"/></svg>
            </div>
          </div>

          {/* App content */}
          <div className="kolo-iphone-content">
            <div className="kolo-iphone-app-header">
              <div className="kolo-iphone-logo">
                <span>KOLO</span>
                <span className="kolo-iphone-logo-dot" />
              </div>
              <div className="kolo-iphone-avatar">EL</div>
            </div>

            <div className="kolo-iphone-title">Aujourd'hui</div>
            <div className="kolo-iphone-subtitle">Mercredi 3 juin</div>

            <div className="kolo-iphone-stats">
              <div className="kolo-iphone-stat kolo-iphone-stat-active">
                <div className="kolo-iphone-stat-num">{tasks.filter((t) => !t.done).length}</div>
                <div className="kolo-iphone-stat-label">À faire</div>
              </div>
              <div className="kolo-iphone-stat">
                <div className="kolo-iphone-stat-num">12</div>
                <div className="kolo-iphone-stat-label">Prospects</div>
              </div>
              <div className="kolo-iphone-stat">
                <div className="kolo-iphone-stat-num">{tasks.filter((t) => t.done).length + 4}</div>
                <div className="kolo-iphone-stat-label">Faits</div>
              </div>
            </div>

            {/* AI suggestion */}
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
              <div className="kolo-iphone-ai-actions">
                <button className="kolo-iphone-ai-btn" type="button" onClick={() => { setToast('Action lancée'); setTimeout(() => setToast(null), 1500); }}>
                  <Send size={9} strokeWidth={2.5} /> Lancer
                </button>
                <button className="kolo-iphone-ai-btn ghost" type="button">
                  <Calendar size={9} strokeWidth={2.5} /> Plus tard
                </button>
              </div>
            </div>

            {/* Tasks (interactive) */}
            {tasks.map((task) => {
              const TIcon = task.icon;
              const TagIcon = task.tagIcon;
              const isExpanded = activeTask === task.id;
              return (
                <div key={task.id} className={`kolo-iphone-task ${task.done ? 'kolo-iphone-task-done' : ''} ${isExpanded ? 'is-expanded' : ''}`}>
                  <div className="kolo-iphone-task-row" onClick={() => expandTask(task.id)}>
                    {/* Check circle (clickable to toggle) */}
                    <button
                      className="kolo-iphone-task-check-btn"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                      aria-label={task.done ? 'Désactiver' : 'Marquer fait'}
                    >
                      {task.done ? <CheckCircle2 size={12} strokeWidth={2.5} /> : null}
                    </button>
                    <div className={`kolo-iphone-task-icon kolo-iphone-task-${task.kind}`}><TIcon size={11} strokeWidth={2.5} /></div>
                    <div className="kolo-iphone-task-body">
                      <div className="kolo-iphone-task-title">{task.title}</div>
                      <div className="kolo-iphone-task-sub">{task.sub}</div>
                    </div>
                    {task.tag && !task.done && (
                      <span className="kolo-iphone-task-tag" style={{ background: `${task.tagColor}1A`, color: task.tagColor }}>
                        {TagIcon && <TagIcon size={9} strokeWidth={2.5} />}
                      </span>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="kolo-iphone-task-detail">
                      <div className="kolo-iphone-task-detail-label">Contexte</div>
                      <div className="kolo-iphone-task-detail-text">{task.detail}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom nav */}
          <div className="kolo-iphone-bottomnav">
            <div className="kolo-iphone-tab kolo-iphone-tab-active">
              <div className="kolo-iphone-tab-dot" />
              <span>Aujourd'hui</span>
            </div>
            <button
              type="button"
              className="kolo-iphone-tab-add"
              aria-label="Ajouter un prospect"
              onClick={(e) => { e.stopPropagation(); setToast('Nouveau prospect'); setTimeout(() => setToast(null), 1800); }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 2.5V11.5M2.5 7H11.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="kolo-iphone-tab"><span>Prospects</span></div>
          </div>

          <div className="kolo-iphone-home" />

          {/* Toast notification (only on user actions) */}
          {toast && (
            <div className="kolo-iphone-toast">
              <CheckCircle2 size={14} />
              <span>{toast}</span>
            </div>
          )}
        </div>

        {/* Phone reflection */}
        <div className="kolo-iphone-shadow" aria-hidden="true" />
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

      {/* Hint to interact */}
      <div className="kolo-stage-hint">
        <Sparkles size={12} /> Survole ou clique sur les éléments
      </div>
    </div>
  );
};

export default PhoneMockup;
