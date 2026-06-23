// =============================================================
// KOLO v2 — Page Notifications (timeline rappels + pige fraîche)
// =============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, Search as SearchIcon, ChevronLeft } from 'lucide-react';
import V2Layout from '../V2Layout';
import v2api from '../v2api';
import '../../styles/v2.css';

const formatRelative = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffMin < 60 * 24) return `Il y a ${Math.round(diffMin / 60)} h`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
};

export default function V2NotificationsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [unreadMeta, setUnreadMeta] = useState({ count: 0, fresh_pige: 0, reminders_today: 0 });
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  const reload = async () => {
    setLoading(true);
    try {
      const [me, dash, rems, unread] = await Promise.all([
        v2api.me().catch(() => null),
        v2api.dashboard().catch(() => null),
        v2api.listReminders(today).catch(() => ({ items: [] })),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/v2/notifications/unread`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('kolo_v2_session') || ''}` },
        }).then(r => r.ok ? r.json() : { count: 0, fresh_pige: 0, reminders_today: 0 }).catch(() => ({ count: 0, fresh_pige: 0, reminders_today: 0 })),
      ]);
      if (!me) { navigate('/app-v2/login'); return; }
      setUser(me);
      setDashboard(dash);
      setReminders(rems.items || []);
      setUnreadMeta(unread || { count: 0, fresh_pige: 0, reminders_today: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line

  if (!user) return <div className="v2-app" data-testid="v2-notif-loading" />;

  const pendingReminders = reminders.filter(r => r.status === 'pending');
  const completedReminders = reminders.filter(r => r.status !== 'pending');

  return (
    <V2Layout user={user} dashboard={dashboard}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="v2-icon-btn"
        style={{ marginBottom: 14 }}
        aria-label="Retour"
        data-testid="notif-back"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="v2-hero" style={{ marginBottom: 16 }}>
        <h1 className="v2-hello" style={{ fontSize: 30 }} data-testid="notif-page-title">Notifications</h1>
        <span className="v2-date" data-testid="notif-page-subtitle">
          {unreadMeta.count > 0 ? `${unreadMeta.count} élément(s) à voir aujourd'hui` : 'Tu es à jour'}
        </span>
      </div>

      {/* Fresh pige results banner */}
      {unreadMeta.fresh_pige > 0 && (
        <div
          className="v2-notif-item unread"
          onClick={() => navigate('/app-v2/prospecting')}
          data-testid="notif-fresh-pige"
        >
          <div className="v2-notif-icon"><SearchIcon size={16} /></div>
          <div className="v2-notif-body">
            <div className="v2-notif-title">Nouvelles annonces piges disponibles</div>
            <div className="v2-notif-desc">Le scraping vient de terminer — découvre les vendeurs fraîchement détectés.</div>
            <div className="v2-notif-time">Maintenant</div>
          </div>
        </div>
      )}

      {/* Today's reminders */}
      <div className="v2-section-title" style={{ marginTop: 22 }}>
        Rappels du jour
        <button className="link" onClick={() => navigate('/app-v2/agenda')} data-testid="notif-link-agenda">Agenda</button>
      </div>

      {loading ? (
        <div className="v2-empty">
          <div className="title">Chargement…</div>
        </div>
      ) : pendingReminders.length === 0 && completedReminders.length === 0 ? (
        <div className="v2-empty" data-testid="notif-empty">
          <div className="icon"><Bell size={22} /></div>
          <div className="title">Aucun rappel aujourd'hui</div>
          <div>Crée un rappel depuis ton agenda ou un dossier client.</div>
        </div>
      ) : (
        <>
          {pendingReminders.map(r => (
            <div
              key={r.reminder_id}
              className="v2-notif-item unread"
              onClick={() => navigate('/app-v2/agenda')}
              data-testid={`notif-reminder-${r.reminder_id}`}
            >
              <div className="v2-notif-icon"><Clock size={16} /></div>
              <div className="v2-notif-body">
                <div className="v2-notif-title">{r.title}</div>
                {r.description && <div className="v2-notif-desc">{r.description}</div>}
                <div className="v2-notif-time">
                  {r.time_start ? `À ${r.time_start}` : "Aujourd'hui"}
                </div>
              </div>
            </div>
          ))}

          {completedReminders.length > 0 && (
            <>
              <div className="v2-section-title" style={{ marginTop: 22 }}>Traités aujourd'hui</div>
              {completedReminders.map(r => (
                <div
                  key={r.reminder_id}
                  className="v2-notif-item"
                  onClick={() => navigate('/app-v2/agenda')}
                  data-testid={`notif-reminder-done-${r.reminder_id}`}
                  style={{ opacity: 0.6 }}
                >
                  <div className="v2-notif-icon"><Clock size={16} /></div>
                  <div className="v2-notif-body">
                    <div className="v2-notif-title" style={{ textDecoration: 'line-through' }}>{r.title}</div>
                    <div className="v2-notif-time">Terminé</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* Activate push reminder if dismissed previously */}
      <div className="v2-card" style={{ marginTop: 22 }} data-testid="notif-push-card">
        <div className="v2-card-title">Pousser tes rappels sur ton téléphone</div>
        <div className="v2-card-body">Active les notifications push pour ne plus rater un rappel important.</div>
        <button
          className="v2-btn secondary full"
          style={{ marginTop: 12 }}
          onClick={() => navigate('/app-v2/settings')}
          data-testid="notif-push-settings"
        >
          Gérer dans les paramètres
        </button>
      </div>
    </V2Layout>
  );
}
