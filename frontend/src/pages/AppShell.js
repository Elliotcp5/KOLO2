import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Briefcase, Menu, Check, User, Plus, Clock, Phone, Mail, ChevronRight, X, Sparkles, Loader2 } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import NotificationPrompt from '../components/NotificationPrompt';
import { API_URL } from '../config/api';

// Helper for authenticated fetch
const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('kolo_token');
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  return fetch(url, { ...options, credentials: 'include', headers });
};

// ==================== TODAY TAB ====================
const TodayTab = ({ onOpenProfile }) => {
  const { t, formatDate, locale } = useLocale();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);

  const fetchTasks = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/tasks/today`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
        setSubscriptionBlocked(false);
      } else if (response.status === 403) {
        // Subscription required
        setSubscriptionBlocked(true);
      }
    } catch (e) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCompleteTask = async (taskId) => {
    try {
      const response = await authFetch(`${API_URL}/api/tasks/${taskId}/complete`, {
        method: 'POST'
      });
      
      if (response.ok) {
        // Remove task from list with animation
        setTasks(prev => prev.filter(t => t.task_id !== taskId));
        toast.success(t('taskCompleted'));
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error(t('taskError'));
    }
  };

  const getTaskTypeIcon = (type) => {
    switch (type) {
      case 'call': return Phone;
      case 'email': return Mail;
      default: return Clock;
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <h1 className="text-headline" style={{ fontSize: '28px' }}>
          {t('today')}
        </h1>
        <button 
          className="btn-ghost" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}
          onClick={onOpenProfile}
          data-testid="my-profile-button"
        >
          <User size={18} strokeWidth={1.5} color="white" />
          <span style={{ color: 'white', fontSize: '14px' }}>{t('myProfile')}</span>
        </button>
      </div>

      {/* Date */}
      <p className="text-muted" style={{ marginBottom: '32px', textTransform: 'capitalize' }}>
        {formatDate(new Date())}
      </p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner"></div>
        </div>
      ) : subscriptionBlocked ? (
        <div className="empty-state">
          <div className="icon-wrapper" style={{ 
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
            border: '1px solid rgba(236, 72, 153, 0.3)'
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="url(#gradient)" strokeWidth="2" style={{ width: '32px', height: '32px' }}>
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#EC4899" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3 className="title" style={{ 
            background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {locale === 'fr' ? 'Essai terminé' : 'Trial ended'}
          </h3>
          <p className="subtitle" style={{ marginBottom: '24px' }}>
            {locale === 'fr' 
              ? "Abonnez-vous pour continuer à utiliser toutes les fonctionnalités de KOLO" 
              : "Subscribe to continue using all KOLO features"}
          </p>
          <button 
            className="btn-primary"
            onClick={() => navigate('/subscribe')}
            data-testid="subscribe-button"
          >
            {locale === 'fr' ? "S'abonner maintenant" : 'Subscribe now'}
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="icon-wrapper">
            <Check strokeWidth={2} />
          </div>
          <h3 className="title">{t('allCaughtUp')}</h3>
          <p className="subtitle">{t('noPendingTask')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tasks.map((task) => {
            const IconComponent = getTaskTypeIcon(task.task_type);
            
            // Calculate days overdue
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const taskDate = new Date(task.due_date);
            const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
            const diffTime = today.getTime() - taskDay.getTime();
            const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            // Color logic: white = today, orange = 1-2 days overdue, red = 3+ days overdue
            let borderColor = '#FFFFFF'; // White for today
            let isUrgent = false;
            if (daysOverdue > 2) {
              borderColor = '#EF4444'; // Red
              isUrgent = true;
            } else if (daysOverdue > 0) {
              borderColor = '#F59E0B'; // Orange
            }
            
            return (
              <div 
                key={task.task_id} 
                className="card task-card"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '16px',
                  padding: '16px',
                  cursor: 'pointer',
                  borderLeft: `3px solid ${borderColor}`,
                  background: 'var(--surface)'
                }}
                data-testid={`task-${task.task_id}`}
              >
                {/* Complete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCompleteTask(task.task_id);
                  }}
                  className="task-complete-btn"
                  data-testid={`complete-task-${task.task_id}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: `2px solid ${borderColor}`,
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Check size={14} strokeWidth={3} style={{ color: borderColor, opacity: 0 }} />
                </button>
                
                {/* Task content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <IconComponent size={14} strokeWidth={1.5} style={{ color: borderColor }} />
                    <span style={{ fontSize: '16px', fontWeight: '500', color: 'white' }}>
                      {task.title}
                    </span>
                    {isUrgent && (
                      <span style={{ 
                        fontSize: '10px', 
                        background: '#EF4444', 
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}>
                        URGENT
                      </span>
                    )}
                  </div>
                  {/* Show date and time */}
                  <div style={{ fontSize: '13px', color: borderColor, marginBottom: '4px', fontWeight: '500' }}>
                    {new Date(task.due_date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                    {task.due_date.includes('T') && !task.due_date.includes('T00:00') && !task.due_date.includes('T09:00:00') && (
                      <span> • {new Date(task.due_date).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    )}
                  </div>
                  {task.prospect && (
                    <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
                      {task.prospect.full_name} • {task.prospect.phone}
                    </span>
                  )}
                  {(task.auto_generated || task.is_auto_generated) && (
                    <span style={{ 
                      display: 'inline-block',
                      marginTop: '6px',
                      fontSize: '11px', 
                      color: 'var(--accent)', 
                      backgroundColor: 'rgba(124, 58, 237, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {t('autoGenerated')}
                    </span>
                  )}
                </div>
                
                <ChevronRight size={18} style={{ color: 'var(--muted-dark)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==================== PROSPECTS TAB ====================
const ProspectsTab = ({ onSelectProspect }) => {
  const { t } = useLocale();
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProspect, setNewProspect] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: 'manual',
    status: 'new',
    notes: ''
  });
  const [creating, setCreating] = useState(false);

  const fetchProspects = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/prospects`);
      if (response.ok) {
        const data = await response.json();
        setProspects(data.prospects || []);
      }
    } catch (error) {
      console.error('Failed to fetch prospects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  const handleCreateProspect = async () => {
    if (!newProspect.full_name || !newProspect.phone) return;
    
    setCreating(true);
    try {
      const response = await authFetch(`${API_URL}/api/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProspect)
      });
      
      if (response.ok) {
        toast.success(t('prospectCreated') || 'Lead créé!');
        setNewProspect({ full_name: '', phone: '', email: '', source: 'manual', status: 'new', notes: '' });
        setShowAddForm(false);
        fetchProspects();
      } else {
        throw new Error('Failed to create prospect');
      }
    } catch (error) {
      console.error('Failed to create prospect:', error);
      toast.error(t('updateError'));
    } finally {
      setCreating(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      new: t('statusNew'),
      in_progress: t('statusInProgress'),
      closed: t('statusClosed'),
      lost: t('statusLost'),
    };
    return labels[status] || status;
  };

  const formatNextTask = (prospect) => {
    if (!prospect.next_task_date) return null;
    
    const date = new Date(prospect.next_task_date);
    const now = new Date();
    const isOverdue = date < now;
    
    return {
      title: prospect.next_task_title,
      isOverdue
    };
  };

  // Add Prospect Form Modal
  if (showAddForm) {
    return (
      <div style={{ padding: '0' }}>
        {/* Header with close button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)'
        }}>
          <h2 style={{ fontSize: '17px', fontWeight: '600' }}>{t('addProspect')}</h2>
          <button 
            onClick={() => setShowAddForm(false)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--muted)', 
              cursor: 'pointer',
              padding: '4px'
            }}
            data-testid="close-prospect-modal"
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            className="input-dark"
            placeholder={t('fullName')}
            value={newProspect.full_name}
            onChange={(e) => setNewProspect({...newProspect, full_name: e.target.value})}
            data-testid="prospect-name-input"
          />
          <input
            type="tel"
            className="input-dark"
            placeholder={t('phone')}
            value={newProspect.phone}
            onChange={(e) => setNewProspect({...newProspect, phone: e.target.value})}
            data-testid="prospect-phone-input"
          />
          <input
            type="email"
            className="input-dark"
            placeholder={t('emailRequired')}
            value={newProspect.email}
            onChange={(e) => setNewProspect({...newProspect, email: e.target.value})}
            data-testid="prospect-email-input"
          />
          
          {/* Source */}
          <div>
            <label className="text-caption" style={{ marginBottom: '8px', display: 'block' }}>{t('source')}</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['manual', 'whatsapp', 'email'].map(source => (
                <button
                  key={source}
                  onClick={() => setNewProspect({...newProspect, source})}
                  className={`btn-chip ${newProspect.source === source ? 'active' : ''}`}
                >
                  {source === 'manual' ? 'Manual' : source === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-caption" style={{ marginBottom: '8px', display: 'block' }}>{t('status')}</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['new', 'in_progress', 'closed', 'lost'].map(status => (
                <button
                  key={status}
                  onClick={() => setNewProspect({...newProspect, status})}
                  className={`btn-chip ${newProspect.status === status ? 'active' : ''}`}
                >
                  {getStatusLabel(status)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <textarea
            className="input-dark"
            placeholder={t('addNotes')}
            value={newProspect.notes}
            onChange={(e) => setNewProspect({...newProspect, notes: e.target.value})}
            rows={3}
            style={{ resize: 'none' }}
          />

          {/* Save button at the bottom */}
          <button
            className="btn-primary"
            onClick={handleCreateProspect}
            disabled={!newProspect.full_name || !newProspect.phone || !newProspect.email || creating}
            data-testid="save-prospect-button"
            style={{ marginTop: '8px' }}
          >
            {creating ? (
              <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
            ) : (
              t('save')
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="text-headline" style={{ fontSize: '28px' }}>
          {t('prospects')}
        </h1>
        <button 
          className="btn-primary"
          onClick={() => setShowAddForm(true)}
          style={{ width: 'auto', height: '44px', padding: '0 20px' }}
          data-testid="add-prospect-button"
        >
          {t('addProspect')}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner"></div>
        </div>
      ) : prospects.length === 0 ? (
        <div className="empty-state">
          <div className="icon-wrapper">
            <Briefcase strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
          </div>
          <h3 className="title">{t('noProspects')}</h3>
          <p className="subtitle">{t('addFirstProspect')}</p>
        </div>
      ) : (
        <div>
          {prospects.map((prospect) => {
            const nextTask = formatNextTask(prospect);
            return (
              <div 
                key={prospect.prospect_id} 
                className="prospect-card" 
                onClick={() => onSelectProspect(prospect)}
                style={{ cursor: 'pointer' }}
                data-testid={`prospect-${prospect.prospect_id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="name">{prospect.full_name}</div>
                    <div className="contact">{prospect.phone} • {prospect.email}</div>
                  </div>
                  <ChevronRight size={20} style={{ color: 'var(--muted-dark)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <span className={`status-badge ${prospect.status}`}>
                    {getStatusLabel(prospect.status)}
                  </span>
                  {nextTask && (
                    <span style={{ 
                      fontSize: '12px', 
                      color: nextTask.isOverdue ? 'var(--error)' : 'var(--muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={12} />
                      {nextTask.title}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==================== PROSPECT DETAIL ====================
const ProspectDetail = ({ prospect, onBack, onUpdate }) => {
  const { t, formatDate } = useLocale();
  const [prospectData, setProspectData] = useState(prospect);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProspectDetail = async () => {
      try {
        const response = await authFetch(`${API_URL}/api/prospects/${prospect.prospect_id}`);
        if (response.ok) {
          const data = await response.json();
          setProspectData(data);
          setTasks(data.tasks || []);
        }
      } catch (error) {
        console.error('Failed to fetch prospect:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProspectDetail();
  }, [prospect.prospect_id]);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  const handleStatusChange = async (newStatus) => {
    // If status is "closed" (won) or "lost", ask for confirmation
    if (newStatus === 'closed' || newStatus === 'lost') {
      setPendingStatus(newStatus);
      setShowConfirmDialog(true);
      return;
    }
    
    await updateStatus(newStatus);
  };

  const updateStatus = async (newStatus) => {
    try {
      const response = await authFetch(`${API_URL}/api/prospects/${prospect.prospect_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        setProspectData(prev => ({ ...prev, status: newStatus }));
        toast.success(t('statusUpdated'));
        onUpdate();
        
        // If marked as closed or lost, go back to list
        if (newStatus === 'closed' || newStatus === 'lost') {
          onBack();
        }
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error(t('updateError'));
    }
  };

  const confirmStatusChange = () => {
    if (pendingStatus) {
      updateStatus(pendingStatus);
    }
    setShowConfirmDialog(false);
    setPendingStatus(null);
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const response = await authFetch(`${API_URL}/api/tasks/${taskId}/complete`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setTasks(prev => prev.map(t => 
          t.task_id === taskId ? { ...t, completed: true } : t
        ));
        // Refresh to update next_task
        const refreshResponse = await authFetch(`${API_URL}/api/prospects/${prospect.prospect_id}`);
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setProspectData(refreshData);
        }
        toast.success(t('taskCompleted'));
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      new: t('statusNew'),
      in_progress: t('statusInProgress'),
      closed: t('statusClosed'),
      lost: t('statusLost'),
    };
    return labels[status] || status;
  };

  const statusOptions = [
    { value: 'new', label: t('statusNew') },
    { value: 'in_progress', label: t('statusInProgress') },
    { value: 'closed', label: t('statusClosed') },
    { value: 'lost', label: t('statusLost') },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button 
          onClick={onBack}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text)', 
            cursor: 'pointer',
            padding: '8px'
          }}
          data-testid="back-button"
        >
          <X size={24} strokeWidth={1.5} />
        </button>
        <h1 className="text-title" style={{ flex: 1 }}>{prospectData.full_name}</h1>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '320px',
            width: '100%',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '18px' }}>
              {t('confirmStatusChange')}
            </h3>
            <p style={{ color: 'var(--muted)', marginBottom: '24px', fontSize: '14px' }}>
              {t('prospectWillDisappear')}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-ghost"
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingStatus(null);
                }}
                style={{ flex: 1 }}
              >
                {t('cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={confirmStatusChange}
                style={{ flex: 1, background: pendingStatus === 'lost' ? '#ef4444' : 'var(--success)' }}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact info */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Phone size={18} style={{ color: 'var(--accent)' }} />
          <a href={`tel:${prospectData.phone}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
            {prospectData.phone}
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Mail size={18} style={{ color: 'var(--accent)' }} />
          <a href={`mailto:${prospectData.email}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
            {prospectData.email}
          </a>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: '24px' }}>
        <label className="text-caption" style={{ display: 'block', marginBottom: '12px' }}>
          {t('status')}
        </label>
        <div className="segmented-control">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              className={`segment-option ${prospectData.status === option.value ? 'active' : ''}`}
              onClick={() => handleStatusChange(option.value)}
              data-testid={`status-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Next scheduled task */}
      {prospectData.next_task_title && (
        <div className="card" style={{ 
          marginBottom: '24px', 
          padding: '16px',
          borderColor: 'var(--accent)',
          borderWidth: '1px'
        }}>
          <div className="text-caption" style={{ marginBottom: '8px' }}>
            {t('nextScheduledTask')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ color: 'var(--text)', fontWeight: '500' }}>
              {prospectData.next_task_title}
            </span>
          </div>
          {prospectData.next_task_date && (
            <div className="text-muted" style={{ marginTop: '4px', marginLeft: '24px', fontSize: '13px' }}>
              {formatDate(new Date(prospectData.next_task_date))}
            </div>
          )}
        </div>
      )}

      {/* Tasks section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="text-caption">{t('tasks')}</h3>
        </div>

        {/* Task list */}
        {tasks.length === 0 ? (
          <p className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>
            {t('noTasks')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.map((task) => (
              <div 
                key={task.task_id}
                className="card"
                style={{ 
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  opacity: task.completed ? 0.5 : 1
                }}
              >
                <button
                  onClick={() => !task.completed && handleCompleteTask(task.task_id)}
                  disabled={task.completed}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: `2px solid ${task.completed ? 'var(--success)' : 'var(--accent)'}`,
                    background: task.completed ? 'var(--success)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: task.completed ? 'default' : 'pointer',
                    flexShrink: 0
                  }}
                >
                  {task.completed && <Check size={12} style={{ color: 'white' }} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '14px', 
                    color: 'var(--text)',
                    textDecoration: task.completed ? 'line-through' : 'none'
                  }}>
                    {task.title}
                  </div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    {new Date(task.due_date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {prospectData.notes && (
        <div style={{ marginBottom: '24px' }}>
          <h3 className="text-caption" style={{ marginBottom: '12px' }}>{t('notes')}</h3>
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{prospectData.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== SETTINGS TAB ====================
const SettingsTab = ({ onClose }) => {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Check notification status on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Fetch subscription status on mount
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        const response = await authFetch(`${API_URL}/api/subscription/status`);
        if (response.ok) {
          const data = await response.json();
          setSubscriptionStatus(data);
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
      }
    };
    fetchSubscriptionStatus();
  }, []);

  const handleCancelSubscription = async () => {
    if (cancelLoading) return;
    setCancelLoading(true);
    
    try {
      const response = await authFetch(`${API_URL}/api/subscription/cancel`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(locale === 'fr' ? t('subscriptionCancelled') : 'Subscription cancelled');
        setSubscriptionStatus(prev => ({ ...prev, cancel_at_period_end: true, subscription_ends_at: data.ends_at }));
        setShowCancelConfirm(false);
      } else {
        toast.error(locale === 'fr' ? 'Erreur lors de la résiliation' : 'Error cancelling subscription');
      }
    } catch (error) {
      console.error('Cancel subscription error:', error);
      toast.error(locale === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (cancelLoading) return;
    setCancelLoading(true);
    
    try {
      const response = await authFetch(`${API_URL}/api/subscription/reactivate`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast.success(locale === 'fr' ? 'Abonnement réactivé' : 'Subscription reactivated');
        setSubscriptionStatus(prev => ({ ...prev, cancel_at_period_end: false }));
      } else {
        toast.error(locale === 'fr' ? 'Erreur lors de la réactivation' : 'Error reactivating subscription');
      }
    } catch (error) {
      console.error('Reactivate subscription error:', error);
      toast.error(locale === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (notificationsLoading) return;
    setNotificationsLoading(true);

    try {
      if (notificationsEnabled) {
        // Disable notifications
        const { pushService } = await import('../services/pushNotifications');
        await pushService.unsubscribe();
        localStorage.removeItem('kolo_notifications_enabled');
        setNotificationsEnabled(false);
        toast.success(t('notificationsDenied'));
      } else {
        // Enable notifications
        const { pushService } = await import('../services/pushNotifications');
        await pushService.init();
        const granted = await pushService.requestPermission();
        
        if (granted) {
          await pushService.subscribe(user?.user_id);
          localStorage.setItem('kolo_notifications_enabled', 'true');
          setNotificationsEnabled(true);
          toast.success(t('notificationsEnabled'));
        } else {
          toast.error(t('notificationsDenied'));
        }
      }
    } catch (error) {
      console.error('Notification toggle error:', error);
      toast.error(t('notificationsDenied'));
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleBillingAction = async (action) => {
    if (billingLoading) return;
    setBillingLoading(true);
    
    try {
      const response = await authFetch(`${API_URL}/api/billing/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          window.open(data.url, '_blank');
        }
      } else {
        toast.error(locale === 'fr' ? 'Fonctionnalité bientôt disponible' : 'Feature coming soon');
      }
    } catch (error) {
      console.error('Billing action error:', error);
      toast.error(locale === 'fr' ? 'Fonctionnalité bientôt disponible' : 'Feature coming soon');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordLoading) return;
    
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error(locale === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters');
      return;
    }
    
    setPasswordLoading(true);
    
    try {
      const response = await authFetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      
      if (response.ok) {
        toast.success(t('passwordChanged'));
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await response.json();
        toast.error(data.detail || (locale === 'fr' ? 'Erreur lors du changement de mot de passe' : 'Error changing password'));
      }
    } catch (error) {
      console.error('Change password error:', error);
      toast.error(locale === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button 
          onClick={onClose}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text)', 
            cursor: 'pointer',
            padding: '8px'
          }}
          data-testid="settings-back"
        >
          <X size={24} strokeWidth={1.5} />
        </button>
        <h1 className="text-headline" style={{ fontSize: '28px' }}>
          {t('settings')}
        </h1>
      </div>

      {/* Profile section */}
      <h3 className="text-caption" style={{ marginBottom: '12px' }}>
        {t('profile')}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="settings-row" style={{ borderBottom: 'none' }}>
          <User className="icon" strokeWidth={1.5} style={{ color: 'white' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '500', marginBottom: '4px' }}>{user?.name || user?.email}</div>
            <div className="text-muted" style={{ fontSize: '14px' }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Billing section */}
      <h3 className="text-caption" style={{ marginBottom: '12px' }}>
        {t('billingPayment')}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '0 16px' }}>
        <div 
          className="settings-row" 
          data-testid="edit-payment-method"
          onClick={() => handleBillingAction('payment_method')}
          style={{ cursor: 'pointer' }}
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          <span className="label">{t('editPaymentMethod')}</span>
          <ChevronRight className="chevron" size={20} />
        </div>
        <div 
          className="settings-row" 
          data-testid="billing-address"
          onClick={() => handleBillingAction('billing_address')}
          style={{ cursor: 'pointer' }}
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span className="label">{t('billingAddress')}</span>
          <ChevronRight className="chevron" size={20} />
        </div>
        <div 
          className="settings-row" 
          data-testid="change-email"
          onClick={() => handleBillingAction('change_email')}
          style={{ cursor: 'pointer' }}
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span className="label">{t('changeEmail')}</span>
          <ChevronRight className="chevron" size={20} />
        </div>
        
        {/* Cancel/Reactivate subscription */}
        {subscriptionStatus && (
          <div 
            className="settings-row" 
            data-testid="cancel-subscription"
            onClick={() => {
              if (subscriptionStatus.cancel_at_period_end) {
                handleReactivateSubscription();
              } else {
                setShowCancelConfirm(true);
              }
            }}
            style={{ cursor: 'pointer', borderBottom: 'none' }}
          >
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke={subscriptionStatus.cancel_at_period_end ? "var(--accent)" : "#ef4444"} strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <div style={{ flex: 1 }}>
              <span className="label" style={{ color: subscriptionStatus.cancel_at_period_end ? 'var(--accent)' : '#ef4444' }}>
                {subscriptionStatus.cancel_at_period_end ? t('reactivate') : t('cancelTrial')}
              </span>
              {subscriptionStatus.cancel_at_period_end && subscriptionStatus.subscription_ends_at && (
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {t('keepAccess')} {new Date(subscriptionStatus.subscription_ends_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}
                </div>
              )}
              {subscriptionStatus.status === 'trialing' && !subscriptionStatus.cancel_at_period_end && (
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {t('cancelTrialDesc')}
                </div>
              )}
            </div>
            {cancelLoading ? (
              <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
            ) : (
              <ChevronRight className="chevron" size={20} />
            )}
          </div>
        )}
      </div>

      {/* About section */}
      <h3 className="text-caption" style={{ marginBottom: '12px' }}>
        {t('about')}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '0 16px' }}>
        {/* Notifications toggle */}
        <div 
          className="settings-row" 
          onClick={handleToggleNotifications}
          style={{ cursor: 'pointer' }}
          data-testid="notifications-toggle"
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span className="label">{t('notifications')}</span>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px' 
          }}>
            {notificationsLoading ? (
              <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
            ) : (
              <>
                <span style={{ 
                  fontSize: '14px', 
                  color: notificationsEnabled ? 'var(--success)' : 'var(--muted)' 
                }}>
                  {notificationsEnabled ? t('notificationsOn') : t('notificationsOff')}
                </span>
                <div style={{
                  width: '44px',
                  height: '26px',
                  borderRadius: '13px',
                  background: notificationsEnabled ? 'var(--accent)' : 'var(--surface-2)',
                  position: 'relative',
                  transition: 'background 0.2s ease'
                }}>
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: notificationsEnabled ? '20px' : '2px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}></div>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Change Password */}
        <div 
          className="settings-row" 
          onClick={() => setShowPasswordModal(true)}
          style={{ cursor: 'pointer' }}
          data-testid="change-password"
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span className="label">{t('changePassword')}</span>
          <ChevronRight className="chevron" size={20} />
        </div>
        {/* Version */}
        <div className="settings-row" style={{ borderBottom: 'none' }}>
          <span className="label">{t('version')}</span>
          <span className="value">1.0.0</span>
        </div>
      </div>

      {/* Logout button */}
      <button 
        className="btn-secondary"
        onClick={handleLogout}
        data-testid="logout-button"
        style={{ marginTop: '16px' }}
      >
        {t('logout')}
      </button>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowPasswordModal(false)}
        >
          <div 
            style={{
              background: 'var(--surface)',
              borderRadius: '20px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600' }}>{t('changePassword')}</h2>
              <button
                className="btn-primary"
                onClick={handleChangePassword}
                disabled={!currentPassword || !newPassword || !confirmPassword || passwordLoading}
                style={{ 
                  width: 'auto', 
                  height: '40px', 
                  padding: '0 20px',
                  fontSize: '15px'
                }}
              >
                {passwordLoading ? (
                  <div className="spinner" style={{ width: '18px', height: '18px' }}></div>
                ) : (
                  t('save')
                )}
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="text-caption" style={{ display: 'block', marginBottom: '8px' }}>
                  {t('currentPassword')}
                </label>
                <input
                  type="password"
                  className="input-dark"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="current-password-input"
                />
              </div>
              <div>
                <label className="text-caption" style={{ display: 'block', marginBottom: '8px' }}>
                  {t('newPassword')}
                </label>
                <input
                  type="password"
                  className="input-dark"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="new-password-input"
                />
              </div>
              <div>
                <label className="text-caption" style={{ display: 'block', marginBottom: '8px' }}>
                  {t('confirmNewPassword')}
                </label>
                <input
                  type="password"
                  className="input-dark"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="confirm-password-input"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel subscription confirmation modal */}
      {showCancelConfirm && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowCancelConfirm(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div 
            style={{
              background: 'var(--surface)',
              borderRadius: '20px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-title" style={{ marginBottom: '16px' }}>
              {t('cancelTrial')}
            </h2>
            <p className="text-body text-muted" style={{ marginBottom: '24px' }}>
              {subscriptionStatus?.status === 'trialing' 
                ? (locale === 'fr' 
                    ? "Vous ne serez pas débité à la fin de votre essai. Vous conserverez l'accès jusqu'à la fin de la période."
                    : "You won't be charged after your trial ends. You'll keep access until the end of the period.")
                : (locale === 'fr'
                    ? "Votre abonnement sera résilié à la fin de la période en cours. Vous conserverez l'accès jusque-là."
                    : "Your subscription will be cancelled at the end of the current period. You'll keep access until then.")
              }
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowCancelConfirm(false)}
                style={{ flex: 1 }}
              >
                {locale === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button 
                className="btn-primary" 
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                style={{ flex: 1, background: '#ef4444' }}
                data-testid="confirm-cancel"
              >
                {cancelLoading ? (
                  <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                ) : (
                  locale === 'fr' ? 'Confirmer' : 'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== TASKS TAB ====================
const TasksTab = ({ onRefresh }) => {
  const { t, formatDate } = useLocale();
  const [tasks, setTasks] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', dueDate: '', dueTime: '', prospectId: '' });
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch all tasks
      const tasksRes = await authFetch(`${API_URL}/api/tasks`);
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
      
      // Fetch prospects for linking
      const prospectsRes = await authFetch(`${API_URL}/api/prospects`);
      if (prospectsRes.ok) {
        const data = await prospectsRes.json();
        setProspects(data.prospects || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.dueDate) return;
    
    setCreating(true);
    try {
      // Combine date and time
      let dueDateTime = newTask.dueDate;
      if (newTask.dueTime) {
        dueDateTime = `${newTask.dueDate}T${newTask.dueTime}:00`;
      } else {
        dueDateTime = `${newTask.dueDate}T09:00:00`;
      }

      const response = await authFetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTask.title,
          due_date: dueDateTime,
          prospect_id: newTask.prospectId || null
        })
      });
      
      if (response.ok) {
        toast.success(t('taskCreated'));
        setNewTask({ title: '', dueDate: '', dueTime: '', prospectId: '' });
        setShowAddTask(false);
        fetchData();
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error(t('taskError'));
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const response = await authFetch(`${API_URL}/api/tasks/${taskId}/complete`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setTasks(prev => prev.filter(t => t.task_id !== taskId));
        toast.success(t('taskCompleted'));
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error(t('taskError'));
    }
  };

  const getProspectName = (prospectId) => {
    const prospect = prospects.find(p => p.prospect_id === prospectId);
    return prospect ? prospect.full_name : null;
  };

  // Helper to get task color based on status and date
  const getTaskColor = (task) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(task.due_date);
    const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
    
    // Green for completed
    if (task.completed) {
      return '#10B981';
    }
    
    // Calculate days overdue
    const diffTime = today.getTime() - taskDay.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 2) {
      return '#EF4444'; // Red for overdue more than 2 days
    }
    if (diffDays > 0 && diffDays <= 2) {
      return '#F59E0B'; // Orange for overdue 2 days or less
    }
    // Today or future = White
    return '#FFFFFF';
  };

  // Filter completed tasks older than 2 weeks
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  // Sort and filter tasks
  const sortedTasks = [...tasks]
    .filter(task => {
      // Hide completed tasks older than 2 weeks
      if (task.completed && task.completed_at) {
        const completedDate = new Date(task.completed_at);
        return completedDate >= twoWeeksAgo;
      }
      return true;
    })
    .sort((a, b) => {
      // Completed tasks at the bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // Then by date
      return new Date(a.due_date) - new Date(b.due_date);
    });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="text-headline" style={{ fontSize: '28px' }}>
          {t('tasks')}
        </h1>
        <button 
          className="btn-icon"
          onClick={() => setShowAddTask(true)}
          data-testid="add-task-button"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--accent)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Plus size={20} style={{ color: 'white' }} />
        </button>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowAddTask(false)}
        >
          <div 
            style={{
              background: 'var(--surface)',
              borderRadius: '20px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600' }}>{t('newTask')}</h2>
              <button
                onClick={() => setShowAddTask(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--muted)', 
                  cursor: 'pointer',
                  padding: '4px'
                }}
                data-testid="close-task-modal"
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                className="input-dark"
                placeholder={t('taskTitle')}
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                data-testid="task-title-input"
              />
              
              <div>
                <label className="text-caption" style={{ display: 'block', marginBottom: '8px' }}>
                  {t('dueDate')} *
                </label>
                <input
                  type="date"
                  className="input-dark"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                  data-testid="task-date-input"
                />
              </div>
              
              <div>
                <label className="text-caption" style={{ display: 'block', marginBottom: '8px' }}>
                  {t('dueTime')}
                </label>
                <input
                  type="time"
                  className="input-dark"
                  value={newTask.dueTime}
                  onChange={(e) => setNewTask({...newTask, dueTime: e.target.value})}
                  data-testid="task-time-input"
                />
              </div>

              <div>
                <label className="text-caption" style={{ display: 'block', marginBottom: '8px' }}>
                  {t('selectLead')}
                </label>
                <select
                  className="input-dark"
                  value={newTask.prospectId}
                  onChange={(e) => setNewTask({...newTask, prospectId: e.target.value})}
                  data-testid="task-prospect-select"
                  style={{ 
                    width: '100%',
                    height: '48px',
                    fontSize: '16px',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '16px',
                    paddingRight: '40px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">{t('noLeadLinked')}</option>
                  {prospects.map(p => (
                    <option key={p.prospect_id} value={p.prospect_id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Save button at the bottom */}
              <button
                className="btn-primary"
                onClick={handleCreateTask}
                disabled={!newTask.title || !newTask.dueDate || creating}
                data-testid="create-task-button"
                style={{ marginTop: '8px' }}
              >
                {creating ? (
                  <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                ) : (
                  t('save')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Check size={32} style={{ color: 'var(--success)' }} />
          </div>
          <p className="text-muted">{t('noTasks')}</p>
          <p className="text-muted" style={{ fontSize: '14px' }}>{t('addFirstTask')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sortedTasks.map(task => {
            const borderColor = getTaskColor(task);
            const textColor = task.completed ? 'var(--muted)' : 'white';
            return (
              <div 
                key={task.task_id} 
                className="card"
                style={{ 
                  padding: '16px', 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '12px',
                  borderLeft: `3px solid ${borderColor}`,
                  opacity: task.completed ? 0.6 : 1,
                  background: 'var(--surface)'
                }}
              >
                <button
                  onClick={() => !task.completed && handleCompleteTask(task.task_id)}
                  disabled={task.completed}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: `2px solid ${borderColor}`,
                    background: task.completed ? borderColor : 'transparent',
                    cursor: task.completed ? 'default' : 'pointer',
                    flexShrink: 0,
                    marginTop: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  data-testid={`complete-task-${task.task_id}`}
                >
                  {task.completed && <Check size={12} style={{ color: 'white' }} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '15px', 
                    color: textColor, 
                    marginBottom: '4px',
                    textDecoration: task.completed ? 'line-through' : 'none'
                  }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    {new Date(task.due_date).toLocaleDateString()} - {new Date(task.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {task.prospect_id && getProspectName(task.prospect_id) && (
                      <span> • {getProspectName(task.prospect_id)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==================== BOTTOM NAVIGATION ====================
const BottomNav = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="bottom-nav">
      <div 
        className={`nav-item ${activeTab === 'today' ? 'active' : ''}`}
        onClick={() => setActiveTab('today')}
        data-testid="nav-today"
      >
        <Calendar strokeWidth={1.5} />
      </div>
      <div 
        className={`nav-item ${activeTab === 'prospects' ? 'active' : ''}`}
        onClick={() => setActiveTab('prospects')}
        data-testid="nav-prospects"
      >
        <Briefcase strokeWidth={1.5} />
      </div>
      <div 
        className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
        onClick={() => setActiveTab('tasks')}
        data-testid="nav-tasks"
      >
        <Check strokeWidth={1.5} />
      </div>
    </nav>
  );
};

// ==================== MAIN APP SHELL ====================
const AppShell = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('today');
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    if (location.pathname.includes('/prospects')) {
      setActiveTab('prospects');
    } else if (location.pathname.includes('/settings')) {
      setActiveTab('settings');
    } else {
      setActiveTab('today');
    }
  }, [location.pathname]);

  // Check if we should show notification prompt
  useEffect(() => {
    const checkNotificationPrompt = () => {
      // Check if notifications are supported
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return;
      }
      
      // Check if already enabled or prompted
      const enabled = localStorage.getItem('kolo_notifications_enabled');
      const prompted = localStorage.getItem('kolo_notifications_prompted');
      
      // If permission is already granted, mark as enabled
      if (Notification.permission === 'granted') {
        localStorage.setItem('kolo_notifications_enabled', 'true');
        return;
      }
      
      // If permission denied, don't show
      if (Notification.permission === 'denied') {
        return;
      }
      
      // If not yet prompted and permission is default, show prompt after a short delay
      if (!enabled && !prompted && Notification.permission === 'default') {
        // Small delay to let the app load first
        setTimeout(() => {
          setShowNotificationPrompt(true);
        }, 1500);
      }
    };

    checkNotificationPrompt();
  }, []);

  const handleSelectProspect = (prospect) => {
    setSelectedProspect(prospect);
  };

  const handleBackFromProspect = () => {
    setSelectedProspect(null);
    setRefreshKey(prev => prev + 1);
  };

  const [showSettings, setShowSettings] = useState(false);

  const renderTab = () => {
    if (showSettings) {
      return <SettingsTab onClose={() => setShowSettings(false)} />;
    }
    
    if (selectedProspect) {
      return (
        <ProspectDetail 
          prospect={selectedProspect} 
          onBack={handleBackFromProspect}
          onUpdate={() => setRefreshKey(prev => prev + 1)}
        />
      );
    }

    switch (activeTab) {
      case 'prospects':
        return <ProspectsTab key={refreshKey} onSelectProspect={handleSelectProspect} />;
      case 'tasks':
        return <TasksTab key={refreshKey} onRefresh={() => setRefreshKey(prev => prev + 1)} />;
      default:
        return <TodayTab key={refreshKey} onOpenProfile={() => setShowSettings(true)} />;
    }
  };

  return (
    <div className="mobile-frame">
      <div className="page-container safe-area-top">
        <div className="scroll-content">
          {renderTab()}
        </div>
        {!selectedProspect && <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />}
      </div>
      
      {/* Notification Permission Prompt */}
      {showNotificationPrompt && (
        <NotificationPrompt onClose={() => setShowNotificationPrompt(false)} />
      )}
    </div>
  );
};

export default AppShell;
