import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Briefcase, Menu, Check, User, Plus, Clock, Phone, Mail, ChevronRight, ChevronDown, X, Sparkles, Loader2, MessageSquare, RefreshCw, Send, FileText, Home, Search } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import NotificationPrompt from '../components/NotificationPrompt';
import { API_URL } from '../config/api';
import { trackTaskCompleted, trackSmsGenerated, trackSmsSent, trackProspectCreated, trackProspectViewed, trackTaskCreated, trackAiSuggestionAccepted, trackLogout, trackFeatureUsed } from '../utils/analytics';

// Helper for authenticated fetch
const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('kolo_token');
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  return fetch(url, { ...options, headers });
};

// ==================== TODAY TAB ====================
const TodayTab = ({ onOpenProfile, onSelectProspect }) => {
  const { t, formatDate, locale } = useLocale();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  
  // AI SMS Modal state
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [aiMessage, setAiMessage] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);

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

  // Generate AI message for SMS
  const generateAiMessage = async (task) => {
    if (!task?.prospect) return;
    setMessageLoading(true);
    try {
      const response = await authFetch(`${API_URL}/api/prospects/${task.prospect_id}/generate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'sms_follow_up' })
      });
      if (response.ok) {
        const data = await response.json();
        setAiMessage(data.message || '');
      }
    } catch (error) {
      console.error('Failed to generate message:', error);
      toast.error(locale === 'fr' ? 'Erreur de génération' : 'Generation error');
    } finally {
      setMessageLoading(false);
    }
  };

  // Open AI SMS modal
  const openAiSmsModal = (task) => {
    setSelectedTask(task);
    setShowSmsModal(true);
    setAiMessage('');
    generateAiMessage(task);
  };

  // Send SMS
  const sendSms = async () => {
    if (!selectedTask?.prospect || !aiMessage) return;
    setSendingSms(true);
    try {
      const response = await authFetch(`${API_URL}/api/prospects/${selectedTask.prospect_id}/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiMessage })
      });
      if (response.ok) {
        trackSmsSent();
        toast.success(locale === 'fr' ? 'SMS envoyé !' : 'SMS sent!');
        setShowSmsModal(false);
        // Mark task as completed
        handleCompleteTask(selectedTask.task_id);
      } else {
        const data = await response.json();
        // More specific error handling
        const errorMsg = data.detail || (locale === 'fr' ? 'Erreur d\'envoi SMS' : 'SMS send error');
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('SMS send error:', error);
      toast.error(locale === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setSendingSms(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const task = tasks.find(t => t.task_id === taskId);
      const response = await authFetch(`${API_URL}/api/tasks/${taskId}/complete`, {
        method: 'POST'
      });
      
      if (response.ok) {
        // Track task completion
        trackTaskCompleted(task?.task_type || 'unknown');
        // Remove task from list with animation
        setTasks(prev => prev.filter(t => t.task_id !== taskId));
        toast.success(t('taskCompleted'));
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error(t('taskError'));
    }
  };

  // Get icon for task type - returns null if type not recognized
  const getTaskTypeIcon = (type) => {
    switch (type) {
      case 'call': return Phone;
      case 'email': return Mail;
      case 'sms': return MessageSquare;
      case 'visit': return Home;
      case 'administrative': return FileText;
      case 'prospection': return Search;
      default: return null; // No icon for unrecognized types
    }
  };
  
  // Get task type label
  const getTaskTypeLabel = (type) => {
    const labels = {
      call: locale === 'fr' ? 'Appeler' : 'Call',
      email: 'Email',
      sms: 'SMS',
      visit: locale === 'fr' ? 'Visite' : 'Visit',
      administrative: locale === 'fr' ? 'Administratif' : 'Administrative',
      prospection: locale === 'fr' ? 'Prospection' : 'Prospecting',
      follow_up: locale === 'fr' ? 'Suivi' : 'Follow-up'
    };
    return labels[type] || '';
  };
  
  // Check if task type has action buttons
  const hasActionButtons = (type) => {
    return ['call', 'sms', 'email'].includes(type);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tasks.map((task) => {
            const IconComponent = getTaskTypeIcon(task.task_type);
            const taskLabel = getTaskTypeLabel(task.task_type);
            const showActions = hasActionButtons(task.task_type);
            const isExpanded = expandedTaskId === task.task_id;
            
            // Calculate if overdue
            const now = new Date();
            const taskDate = new Date(task.due_date);
            const isOverdue = taskDate < now;
            const borderColor = isOverdue ? '#F59E0B' : 'var(--border)';
            
            // Format time
            const taskTime = taskDate.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', { 
              hour: '2-digit', 
              minute: '2-digit'
            });
            
            return (
              <div 
                key={task.task_id} 
                className="card"
                style={{ 
                  padding: '0',
                  borderLeft: isOverdue ? `3px solid ${borderColor}` : 'none',
                  background: 'var(--surface)',
                  overflow: 'hidden'
                }}
                data-testid={`task-${task.task_id}`}
              >
                {/* Task header - always visible */}
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    padding: '14px 16px'
                  }}
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
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: '1.5px solid var(--muted-dark)',
                      background: 'transparent',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  />
                  
                  {/* Task content - clickable to expand */}
                  <div 
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.task_id)}
                    style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: '500', color: 'white', marginBottom: '2px' }}>
                      {task.prospect?.full_name || task.title}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {/* Icon + label only if recognized type */}
                      {IconComponent && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IconComponent size={12} />
                          {taskLabel}
                        </span>
                      )}
                      {/* Just show title snippet if no recognized type */}
                      {!IconComponent && task.title && (
                        <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.title}
                        </span>
                      )}
                      <span style={{ color: 'var(--muted-dark)' }}>•</span>
                      <span style={{ color: isOverdue ? '#F59E0B' : 'var(--muted)' }}>{taskTime}</span>
                      {isOverdue && <span style={{ color: '#F59E0B' }}>({locale === 'fr' ? 'En retard' : 'Overdue'})</span>}
                    </div>
                  </div>
                  
                  {/* Quick action buttons - ONLY for call/sms/email tasks */}
                  {task.prospect && showActions && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {/* Call button for call tasks only */}
                      {task.task_type === 'call' && task.prospect.phone && (
                        <a href={`tel:${task.prospect.phone}`} 
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: '8px', color: 'var(--muted)', textDecoration: 'none' }}>
                          <Phone size={18} />
                        </a>
                      )}
                      {/* Email button for email tasks only */}
                      {task.task_type === 'email' && task.prospect.email && (
                        <a href={`mailto:${task.prospect.email}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: '8px', color: 'var(--muted)', textDecoration: 'none' }}>
                          <Mail size={18} />
                        </a>
                      )}
                      {/* SMS buttons for sms tasks only - native + AI */}
                      {task.task_type === 'sms' && task.prospect.phone && (
                        <>
                          <a href={`sms:${task.prospect.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ padding: '8px', color: 'var(--muted)', textDecoration: 'none' }}>
                            <MessageSquare size={18} />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); openAiSmsModal(task); }}
                            style={{ padding: '8px', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Sparkles size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Expand arrow */}
                  <div
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.task_id)}
                    style={{ padding: '4px', cursor: 'pointer' }}
                  >
                    <ChevronDown 
                      size={18} 
                      style={{ 
                        color: 'var(--muted-dark)', 
                        transition: 'transform 0.2s ease',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }} 
                    />
                  </div>
                </div>
                
                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ 
                    padding: '0 16px 16px 16px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--surface-2)'
                  }}>
                    {/* Task details */}
                    <div style={{ padding: '12px 0', fontSize: '14px' }}>
                      <div style={{ color: 'var(--muted)', marginBottom: '8px' }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ color: 'var(--text)', marginBottom: '8px' }}>
                          {task.description}
                        </div>
                      )}
                      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        {taskDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long'
                        })} {locale === 'fr' ? 'à' : 'at'} {taskTime}
                      </div>
                    </div>
                    
                    {/* Prospect info if available */}
                    {task.prospect && (
                      <div style={{ 
                        background: 'var(--surface)', 
                        borderRadius: '10px', 
                        padding: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {locale === 'fr' ? 'Contact' : 'Contact'}
                        </div>
                        {task.prospect.phone && (
                          <a href={`tel:${task.prospect.phone}`} 
                            onClick={(e) => e.stopPropagation()}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              color: 'var(--text)', 
                              textDecoration: 'none',
                              marginBottom: '6px',
                              fontSize: '14px'
                            }}>
                            <Phone size={14} style={{ color: 'var(--accent)' }} />
                            {task.prospect.phone}
                          </a>
                        )}
                        {task.prospect.email && (
                          <a href={`mailto:${task.prospect.email}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              color: 'var(--text)', 
                              textDecoration: 'none',
                              fontSize: '14px'
                            }}>
                            <Mail size={14} style={{ color: 'var(--accent)' }} />
                            {task.prospect.email}
                          </a>
                        )}
                      </div>
                    )}
                    
                    {/* View prospect button */}
                    {task.prospect && onSelectProspect && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectProspect(task.prospect); }}
                        style={{ 
                          width: '100%',
                          padding: '10px',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          color: 'var(--muted)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}>
                        {locale === 'fr' ? 'Voir la fiche prospect' : 'View prospect details'}
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI SMS Modal */}
      {showSmsModal && selectedTask && (
        <div className="modal-overlay" onClick={() => setShowSmsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                SMS {selectedTask.prospect?.full_name}
              </h2>
              <button onClick={() => setShowSmsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            
            {messageLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)', marginBottom: '12px' }} />
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                  {locale === 'fr' ? 'Génération...' : 'Generating...'}
                </p>
              </div>
            ) : (
              <>
                <textarea
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '14px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    color: 'var(--text)',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    marginBottom: '16px'
                  }}
                />
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => generateAiMessage(selectedTask)} 
                    disabled={messageLoading}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      color: 'var(--text)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <RefreshCw size={14} />
                    {locale === 'fr' ? 'Régénérer' : 'Regenerate'}
                  </button>
                  <button
                    onClick={sendSms}
                    disabled={sendingSms || !aiMessage}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: aiMessage ? 'var(--accent)' : 'var(--surface-2)',
                      border: 'none',
                      borderRadius: '10px',
                      color: aiMessage ? 'white' : 'var(--muted)',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: aiMessage ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {sendingSms ? (
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <>
                        <Send size={14} />
                        {locale === 'fr' ? 'Envoyer' : 'Send'}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
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
            // Score indicator - just a small dot
            const scoreColor = prospect.score === 'chaud' ? '#22C55E' : prospect.score === 'tiede' ? '#F59E0B' : prospect.score === 'froid' ? '#EF4444' : null;
            
            return (
              <div 
                key={prospect.prospect_id} 
                className="prospect-card" 
                onClick={() => onSelectProspect(prospect)}
                style={{ cursor: 'pointer' }}
                data-testid={`prospect-${prospect.prospect_id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Discrete score dot */}
                    {scoreColor && (
                      <span style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: scoreColor,
                        flexShrink: 0
                      }} title={prospect.score} />
                    )}
                    <div>
                      <div className="name">{prospect.full_name}</div>
                      <div className="contact">{prospect.phone} • {prospect.email}</div>
                    </div>
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
  const { t, formatDate, locale } = useLocale();
  const [prospectData, setProspectData] = useState(prospect);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: '',
    notes: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  
  // AI Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageContext, setMessageContext] = useState(null);
  const [sendingSms, setSendingSms] = useState(false);
  
  // SMS History modal state
  const [showSmsHistory, setShowSmsHistory] = useState(false);
  
  // Score state
  const [updatingScore, setUpdatingScore] = useState(false);
  const [showScoreMenu, setShowScoreMenu] = useState(false);

  useEffect(() => {
    const fetchProspectDetail = async () => {
      try {
        const response = await authFetch(`${API_URL}/api/prospects/${prospect.prospect_id}`);
        if (response.ok) {
          const data = await response.json();
          setProspectData(data);
          setTasks(data.tasks || []);
          // Initialize edit form
          setEditForm({
            full_name: data.full_name || '',
            phone: data.phone || '',
            email: data.email || '',
            source: data.source || '',
            notes: data.notes || ''
          });
        }
      } catch (error) {
        console.error('Failed to fetch prospect:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProspectDetail();
  }, [prospect.prospect_id]);

  const handleEditSubmit = async () => {
    if (!editForm.full_name.trim()) {
      toast.error(locale === 'fr' ? 'Le nom est requis' : 'Name is required');
      return;
    }
    
    setEditLoading(true);
    try {
      const response = await authFetch(`${API_URL}/api/prospects/${prospect.prospect_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      
      if (response.ok) {
        const updatedData = await response.json();
        setProspectData(prev => ({ ...prev, ...editForm }));
        setShowEditModal(false);
        toast.success(locale === 'fr' ? 'Prospect mis à jour' : 'Prospect updated');
        onUpdate();
      } else {
        toast.error(locale === 'fr' ? 'Erreur de mise à jour' : 'Update failed');
      }
    } catch (error) {
      console.error('Edit error:', error);
      toast.error(locale === 'fr' ? 'Erreur de mise à jour' : 'Update failed');
    } finally {
      setEditLoading(false);
    }
  };

  // Update prospect score
  const updateScore = async (forceScore = null) => {
    setUpdatingScore(true);
    try {
      const response = await authFetch(`${API_URL}/api/prospects/${prospect.prospect_id}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forceScore ? { force_score: forceScore } : {})
      });
      
      if (response.ok) {
        const data = await response.json();
        setProspectData(prev => ({ ...prev, score: data.score }));
        toast.success(locale === 'fr' ? `Score mis à jour: ${data.score}` : `Score updated: ${data.score}`);
      }
    } catch (error) {
      console.error('Score update error:', error);
      toast.error(locale === 'fr' ? 'Erreur de mise à jour du score' : 'Score update failed');
    } finally {
      setUpdatingScore(false);
    }
  };
  
  // Generate AI message
  const generateMessage = async () => {
    setMessageLoading(true);
    setShowMessageModal(true);
    try {
      const response = await authFetch(`${API_URL}/api/prospects/${prospect.prospect_id}/generate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiMessage(data.message);
        setMessageContext(data.context);
      } else {
        toast.error(locale === 'fr' ? 'Erreur de génération' : 'Generation failed');
      }
    } catch (error) {
      console.error('Message generation error:', error);
      toast.error(locale === 'fr' ? 'Erreur de génération' : 'Generation failed');
    } finally {
      setMessageLoading(false);
    }
  };
  
  // Copy message to clipboard
  const copyMessage = () => {
    navigator.clipboard.writeText(aiMessage);
    toast.success(locale === 'fr' ? 'Message copié !' : 'Message copied!');
  };
  
  // Send SMS
  const sendSms = async () => {
    if (!aiMessage.trim()) return;
    if (!prospectData.phone) {
      toast.error(locale === 'fr' ? 'Numéro de téléphone manquant' : 'Phone number missing');
      return;
    }
    
    setSendingSms(true);
    try {
      const response = await authFetch(`${API_URL}/api/prospects/${prospect.prospect_id}/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiMessage })
      });
      
      if (response.ok) {
        toast.success(locale === 'fr' ? 'SMS envoyé !' : 'SMS sent!');
        setShowMessageModal(false);
        // Refresh prospect data
        const refreshResponse = await authFetch(`${API_URL}/api/prospects/${prospect.prospect_id}`);
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setProspectData(data);
          setTasks(data.tasks || []);
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || (locale === 'fr' ? 'Erreur d\'envoi' : 'Send failed'));
      }
    } catch (error) {
      console.error('SMS send error:', error);
      toast.error(locale === 'fr' ? 'Erreur d\'envoi SMS' : 'SMS send failed');
    } finally {
      setSendingSms(false);
    }
  };

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
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 className="text-title">{prospectData.full_name}</h1>
          {/* Discrete score dot in header */}
          {prospectData.score && (
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: prospectData.score === 'chaud' ? '#22C55E' : prospectData.score === 'tiede' ? '#F59E0B' : '#EF4444',
              flexShrink: 0
            }} title={prospectData.score} />
          )}
        </div>
        <button 
          onClick={() => setShowEditModal(true)}
          style={{ 
            background: 'var(--surface-2)', 
            border: '1px solid var(--border)', 
            color: 'var(--text)', 
            cursor: 'pointer',
            padding: '8px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '500'
          }}
          data-testid="edit-prospect-button"
        >
          {locale === 'fr' ? 'Modifier' : 'Edit'}
        </button>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }} onClick={() => setShowEditModal(false)}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
                {locale === 'fr' ? 'Modifier le prospect' : 'Edit prospect'}
              </h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--muted)' }}>
                  {locale === 'fr' ? 'Nom complet' : 'Full name'} *
                </label>
                <input
                  type="text"
                  className="input-dark"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                  data-testid="edit-fullname"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--muted)' }}>
                  {locale === 'fr' ? 'Téléphone' : 'Phone'}
                </label>
                <input
                  type="tel"
                  className="input-dark"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  data-testid="edit-phone"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--muted)' }}>
                  Email
                </label>
                <input
                  type="email"
                  className="input-dark"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="edit-email"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--muted)' }}>
                  Source
                </label>
                <select
                  className="input-dark"
                  value={editForm.source}
                  onChange={(e) => setEditForm(prev => ({ ...prev, source: e.target.value }))}
                  data-testid="edit-source"
                >
                  <option value="leboncoin">Leboncoin</option>
                  <option value="seloger">SeLoger</option>
                  <option value="pap">PAP</option>
                  <option value="referral">{locale === 'fr' ? 'Recommandation' : 'Referral'}</option>
                  <option value="website">{locale === 'fr' ? 'Site web' : 'Website'}</option>
                  <option value="other">{locale === 'fr' ? 'Autre' : 'Other'}</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--muted)' }}>
                  Notes
                </label>
                <textarea
                  className="input-dark"
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  style={{ resize: 'none' }}
                  data-testid="edit-notes"
                />
              </div>
              
              <button
                className="btn-primary"
                onClick={handleEditSubmit}
                disabled={editLoading}
                data-testid="save-edit-button"
                style={{ marginTop: '8px' }}
              >
                {editLoading ? (
                  <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                ) : (
                  locale === 'fr' ? 'Enregistrer' : 'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
          <a href={`tel:${prospectData.phone}`} style={{ color: 'var(--text)', textDecoration: 'none', flex: 1 }}>
            {prospectData.phone}
          </a>
          {/* SMS History button - discrete */}
          {prospectData.sms_history && prospectData.sms_history.length > 0 && (
            <button
              onClick={() => setShowSmsHistory(true)}
              style={{
                background: 'var(--surface-light)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              data-testid="sms-history-btn"
            >
              <MessageSquare size={14} />
              {prospectData.sms_history.length}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Mail size={18} style={{ color: 'var(--accent)' }} />
          <a href={`mailto:${prospectData.email}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
            {prospectData.email}
          </a>
        </div>
      </div>
      
      {/* Score section - discrete inline display */}
      <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500' }}>
            {locale === 'fr' ? 'Température' : 'Temperature'}
          </span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowScoreMenu(!showScoreMenu)}
              disabled={updatingScore}
              className="btn-minimal"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                color: prospectData.score === 'chaud' ? '#22C55E' : prospectData.score === 'tiede' ? '#F59E0B' : prospectData.score === 'froid' ? '#EF4444' : 'var(--muted)'
              }}
            >
              <span className={`score-dot ${prospectData.score === 'chaud' ? 'hot' : prospectData.score === 'tiede' ? 'warm' : 'cold'}`} />
              {prospectData.score === 'chaud' ? (locale === 'fr' ? 'Chaud' : 'Hot') : 
               prospectData.score === 'tiede' ? (locale === 'fr' ? 'Tiède' : 'Warm') : 
               prospectData.score === 'froid' ? (locale === 'fr' ? 'Froid' : 'Cold') : '—'}
            </button>
            
            {showScoreMenu && (
              <div className="dropdown-menu">
                {[
                  { value: 'chaud', label: locale === 'fr' ? 'Chaud' : 'Hot', color: '#22C55E', dotClass: 'hot' },
                  { value: 'tiede', label: locale === 'fr' ? 'Tiède' : 'Warm', color: '#F59E0B', dotClass: 'warm' },
                  { value: 'froid', label: locale === 'fr' ? 'Froid' : 'Cold', color: '#EF4444', dotClass: 'cold' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => { updateScore(option.value); setShowScoreMenu(false); }}
                    className={`dropdown-item ${prospectData.score === option.value ? 'active' : ''}`}
                    style={{ color: option.color }}
                  >
                    <span className={`score-dot ${option.dotClass}`} />
                    {option.label}
                    {prospectData.score === option.value && <Check size={14} style={{ marginLeft: 'auto', opacity: 0.7 }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* AI Message button */}
      <button
        onClick={generateMessage}
        disabled={messageLoading}
        className="btn-ai"
        style={{ width: '100%', marginBottom: '16px' }}
        data-testid="ai-message-button"
      >
        <Sparkles size={18} />
        {locale === 'fr' ? 'Rédiger avec l\'IA' : 'Write with AI'}
      </button>
      
      {/* AI Message Modal */}
      {showMessageModal && (
        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                {locale === 'fr' ? 'Message IA' : 'AI Message'}
              </h2>
              <button onClick={() => setShowMessageModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            
            {messageLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)', marginBottom: '12px' }} />
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                  {locale === 'fr' ? 'Génération...' : 'Generating...'}
                </p>
              </div>
            ) : (
              <>
                <textarea
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '14px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    color: 'var(--text)',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    marginBottom: '16px'
                  }}
                />
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button onClick={generateMessage} className="btn-minimal" style={{ flex: 1 }}>
                    🔄 {locale === 'fr' ? 'Regénérer' : 'Regenerate'}
                  </button>
                  <button onClick={copyMessage} className="btn-minimal" style={{ flex: 1 }}>
                    📋 {locale === 'fr' ? 'Copier' : 'Copy'}
                  </button>
                </div>
                
                <button
                  onClick={sendSms}
                  disabled={sendingSms || !prospectData.phone}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: prospectData.phone ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' : 'var(--surface-2)',
                    border: 'none',
                    borderRadius: '12px',
                    color: prospectData.phone ? 'white' : 'var(--muted)',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: prospectData.phone ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    boxShadow: prospectData.phone ? '0 4px 20px rgba(34, 197, 94, 0.25)' : 'none'
                  }}
                >
                  {sendingSms ? (
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <>
                      <MessageSquare size={18} />
                      {locale === 'fr' ? 'Envoyer par SMS' : 'Send SMS'}
                    </>
                  )}
                </button>
                
                {!prospectData.phone && (
                  <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '10px' }}>
                    {locale === 'fr' ? 'Numéro requis pour envoyer un SMS' : 'Phone required to send SMS'}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* SMS History Modal - clean and simple */}
      {showSmsHistory && (
        <div className="modal-overlay" onClick={() => setShowSmsHistory(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '70vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} style={{ color: 'var(--accent)' }} />
                {locale === 'fr' ? 'Conversation SMS' : 'SMS Conversation'}
              </h2>
              <button onClick={() => setShowSmsHistory(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', maxHeight: 'calc(70vh - 80px)' }}>
              {prospectData.sms_history && prospectData.sms_history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...prospectData.sms_history].reverse().map((sms, index) => {
                    const isReceived = sms.type === 'received';
                    const timestamp = sms.sent_at || sms.received_at;
                    
                    return (
                      <div 
                        key={sms.id || index}
                        style={{
                          display: 'flex',
                          justifyContent: isReceived ? 'flex-start' : 'flex-end'
                        }}
                      >
                        <div style={{
                          background: isReceived ? 'var(--surface-2)' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)',
                          borderRadius: isReceived ? '12px 12px 12px 4px' : '12px 12px 4px 12px',
                          padding: '10px 14px',
                          maxWidth: '85%',
                          border: isReceived ? 'none' : '1px solid rgba(139, 92, 246, 0.3)'
                        }}>
                          <p style={{ 
                            fontSize: '14px', 
                            lineHeight: '1.5', 
                            color: 'var(--text)',
                            marginBottom: '6px'
                          }}>
                            {sms.message}
                          </p>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '10px', 
                            color: 'var(--muted)' 
                          }}>
                            <span style={{ fontWeight: '500' }}>
                              {isReceived 
                                ? prospectData.full_name?.split(' ')[0] || (locale === 'fr' ? 'Prospect' : 'Prospect')
                                : (locale === 'fr' ? 'Vous' : 'You')
                              }
                            </span>
                            <span>
                              {timestamp && new Date(timestamp).toLocaleDateString(locale, { 
                                day: 'numeric', 
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px' }}>
                  {locale === 'fr' ? 'Aucun SMS envoyé' : 'No SMS sent'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
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

  // Fetch user profile (including phone and name) on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await authFetch(`${API_URL}/api/auth/profile`);
        if (response.ok) {
          const data = await response.json();
          setUserPhone(data.phone || '');
          setUserName(data.name || '');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
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

  const handleUpdatePhone = async () => {
    if (phoneLoading) return;
    
    if (!newPhone || newPhone.length < 6) {
      toast.error(locale === 'fr' ? 'Numéro de téléphone invalide' : 'Invalid phone number');
      return;
    }
    
    setPhoneLoading(true);
    
    try {
      const response = await authFetch(`${API_URL}/api/auth/update-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newPhone })
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserPhone(data.phone);
        toast.success(locale === 'fr' ? 'Numéro mis à jour' : 'Phone updated');
        setShowPhoneModal(false);
        setNewPhone('');
      } else {
        const data = await response.json();
        toast.error(data.detail || (locale === 'fr' ? 'Erreur lors de la mise à jour' : 'Error updating phone'));
      }
    } catch (error) {
      console.error('Update phone error:', error);
      toast.error(locale === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (nameLoading) return;
    
    if (!newName || newName.trim().length < 2) {
      toast.error(locale === 'fr' ? 'Nom invalide' : 'Invalid name');
      return;
    }
    
    setNameLoading(true);
    
    try {
      const response = await authFetch(`${API_URL}/api/auth/update-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserName(data.name);
        toast.success(locale === 'fr' ? 'Nom mis à jour' : 'Name updated');
        setShowNameModal(false);
        setNewName('');
      } else {
        const data = await response.json();
        toast.error(data.detail || (locale === 'fr' ? 'Erreur lors de la mise à jour' : 'Error updating name'));
      }
    } catch (error) {
      console.error('Update name error:', error);
      toast.error(locale === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setNameLoading(false);
    }
  };

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
    trackLogout();
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
      <div className="card" style={{ marginBottom: '24px', padding: '0 16px' }}>
        {/* Name row - clickable to edit */}
        <div 
          className="settings-row" 
          onClick={() => {
            setNewName(userName);
            setShowNameModal(true);
          }}
          style={{ cursor: 'pointer' }}
          data-testid="edit-name"
        >
          <User className="icon" strokeWidth={1.5} style={{ color: 'white' }} />
          <div style={{ flex: 1 }}>
            <span className="label">{locale === 'fr' ? 'Nom' : 'Name'}</span>
            <div className="text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
              {userName || user?.email || (locale === 'fr' ? 'Non configuré' : 'Not configured')}
            </div>
          </div>
          <ChevronRight className="chevron" size={20} />
        </div>
        {/* Phone row */}
        <div 
          className="settings-row" 
          onClick={() => {
            setNewPhone(userPhone);
            setShowPhoneModal(true);
          }}
          style={{ cursor: 'pointer', borderBottom: 'none' }}
          data-testid="edit-phone"
        >
          <Phone className="icon" strokeWidth={1.5} style={{ color: 'white' }} />
          <div style={{ flex: 1 }}>
            <span className="label">{locale === 'fr' ? 'Téléphone' : 'Phone'}</span>
            <div className="text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
              {userPhone || (locale === 'fr' ? 'Non configuré' : 'Not configured')}
            </div>
          </div>
          <ChevronRight className="chevron" size={20} />
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

      {/* Phone update modal */}
      {showPhoneModal && (
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
          onClick={() => setShowPhoneModal(false)}
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
              <h2 style={{ fontSize: '20px', fontWeight: '600' }}>
                {locale === 'fr' ? 'Téléphone' : 'Phone'}
              </h2>
              <button
                className="btn-primary"
                onClick={handleUpdatePhone}
                disabled={!newPhone || newPhone.length < 6 || phoneLoading}
                style={{ 
                  width: 'auto', 
                  height: '40px', 
                  padding: '0 20px',
                  fontSize: '15px'
                }}
              >
                {phoneLoading ? (
                  <div className="spinner" style={{ width: '18px', height: '18px' }}></div>
                ) : (
                  t('save')
                )}
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="text-caption" style={{ display: 'block', marginBottom: '8px' }}>
                  {locale === 'fr' ? 'Numéro avec indicatif pays' : 'Number with country code'}
                </label>
                <input
                  type="tel"
                  className="input-dark"
                  placeholder={locale === 'fr' ? 'Ex: +33 6 12 34 56 78' : 'E.g. +33 6 12 34 56 78'}
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  data-testid="phone-input-modal"
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5' }}>
                {locale === 'fr' 
                  ? 'Les prospects pourront vous répondre directement sur ce numéro.'
                  : 'Prospects will be able to reply directly to this number.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Name update modal */}
      {showNameModal && (
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
          onClick={() => setShowNameModal(false)}
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
              <h2 style={{ fontSize: '20px', fontWeight: '600' }}>
                {locale === 'fr' ? 'Nom' : 'Name'}
              </h2>
              <button
                className="btn-primary"
                onClick={handleUpdateName}
                disabled={!newName || newName.trim().length < 2 || nameLoading}
                style={{ 
                  width: 'auto', 
                  height: '40px', 
                  padding: '0 20px',
                  fontSize: '15px'
                }}
              >
                {nameLoading ? (
                  <div className="spinner" style={{ width: '18px', height: '18px' }}></div>
                ) : (
                  t('save')
                )}
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="text-caption" style={{ display: 'block', marginBottom: '8px' }}>
                  {locale === 'fr' ? 'Prénom et Nom' : 'Full Name'}
                </label>
                <input
                  type="text"
                  className="input-dark"
                  placeholder={locale === 'fr' ? 'Ex: Jean Dupont' : 'E.g. John Smith'}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid="name-input-modal"
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5' }}>
                {locale === 'fr' 
                  ? 'Votre nom sera utilisé pour personnaliser vos communications.'
                  : 'Your name will be used to personalize your communications.'
                }
              </p>
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
  const { t, formatDate, locale } = useLocale();
  const [tasks, setTasks] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', dueDate: '', dueTime: '', prospectId: '' });
  const [creating, setCreating] = useState(false);
  
  // AI Suggestions state
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [acceptingIndex, setAcceptingIndex] = useState(null);

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

  // AI Suggestions functions
  const fetchAiSuggestions = async () => {
    setAiLoading(true);
    setShowAiSuggestions(true);
    try {
      const response = await authFetch(`${API_URL}/api/tasks/ai-suggestions`);
      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data.suggestions || []);
        if (data.suggestions?.length === 0) {
          toast.info(data.message || (locale === 'fr' ? 'Aucune suggestion disponible' : 'No suggestions available'));
        }
      }
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error);
      toast.error(locale === 'fr' ? 'Erreur lors de la récupération des suggestions' : 'Failed to get suggestions');
    } finally {
      setAiLoading(false);
    }
  };

  const acceptSuggestion = async (suggestion, index) => {
    setAcceptingIndex(index);
    try {
      const response = await authFetch(`${API_URL}/api/tasks/ai-suggestions/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_id: suggestion.prospect_id,
          task_title: suggestion.task_title,
          task_type: suggestion.task_type,
          suggested_date: suggestion.suggested_date,
          urgency: suggestion.urgency
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || (locale === 'fr' ? 'Tâche créée !' : 'Task created!'));
        // Remove accepted suggestion
        setAiSuggestions(prev => prev.filter((_, i) => i !== index));
        fetchData();
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
      toast.error(locale === 'fr' ? 'Erreur lors de la création' : 'Failed to create task');
    } finally {
      setAcceptingIndex(null);
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
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* AI Suggestions Button */}
          <button 
            onClick={fetchAiSuggestions}
            data-testid="ai-suggestions-button"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 15px -3px rgba(236, 72, 153, 0.4)'
            }}
          >
            <Sparkles size={20} style={{ color: 'white' }} />
          </button>
          {/* Add Task Button */}
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
      </div>

      {/* AI Suggestions Modal */}
      {showAiSuggestions && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowAiSuggestions(false)}
        >
          <div 
            style={{
              background: 'var(--surface)',
              borderRadius: '24px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Sparkles size={20} style={{ color: 'white' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text)' }}>
                    {locale === 'fr' ? 'Suggestions IA' : 'AI Suggestions'}
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    {locale === 'fr' ? 'Basées sur vos prospects inactifs' : 'Based on inactive prospects'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiSuggestions(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            {aiLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Loader2 size={24} style={{ color: '#EC4899', animation: 'spin 1s linear infinite' }} />
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center' }}>
                  {locale === 'fr' ? 'Analyse de vos prospects...' : 'Analyzing your prospects...'}
                </p>
              </div>
            ) : aiSuggestions.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', gap: '12px' }}>
                <Check size={32} style={{ color: 'var(--success)' }} />
                <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '500' }}>
                  {locale === 'fr' ? 'Tout est à jour !' : 'All caught up!'}
                </p>
                <p style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center' }}>
                  {locale === 'fr' ? 'Aucun prospect inactif à relancer' : 'No inactive prospects to follow up'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {aiSuggestions.map((suggestion, index) => {
                  // Format the suggested date
                  let dateLabel = '';
                  if (suggestion.suggested_date) {
                    const suggestedDate = new Date(suggestion.suggested_date);
                    const today = new Date();
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    if (suggestedDate.toDateString() === today.toDateString()) {
                      dateLabel = locale === 'fr' ? "Aujourd'hui" : 'Today';
                    } else if (suggestedDate.toDateString() === tomorrow.toDateString()) {
                      dateLabel = locale === 'fr' ? 'Demain' : 'Tomorrow';
                    } else {
                      const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
                      dateLabel = `${days[suggestedDate.getDay()]} ${suggestedDate.getDate()}/${suggestedDate.getMonth() + 1}`;
                    }
                  }
                  
                  // Urgency colors
                  const urgencyColors = {
                    'haute': { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', label: locale === 'fr' ? 'Urgent' : 'Urgent' },
                    'moyenne': { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', label: locale === 'fr' ? 'Normal' : 'Normal' },
                    'basse': { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', label: locale === 'fr' ? 'Flexible' : 'Flexible' }
                  };
                  const urgency = urgencyColors[suggestion.urgency] || urgencyColors['moyenne'];
                  
                  return (
                  <div 
                    key={index}
                    style={{
                      background: 'var(--surface-2)',
                      borderRadius: '16px',
                      padding: '16px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text)', marginBottom: '4px' }}>
                          {suggestion.task_title}
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                          {suggestion.prospect_name}
                        </p>
                      </div>
                      {/* Date and urgency badges */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        {dateLabel && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: 'var(--text)',
                            background: 'rgba(139, 92, 246, 0.2)',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            {dateLabel}
                          </span>
                        )}
                        {suggestion.urgency && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '500',
                            color: urgency.text,
                            background: urgency.bg,
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {urgency.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px', fontStyle: 'italic' }}>
                      {suggestion.reason}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => acceptSuggestion(suggestion, index)}
                        disabled={acceptingIndex === index}
                        style={{
                          flex: 1,
                          height: '36px',
                          background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                          border: 'none',
                          borderRadius: '10px',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        {acceptingIndex === index ? (
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <>
                            <Check size={16} />
                            {locale === 'fr' ? 'Créer' : 'Create'}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setAiSuggestions(prev => prev.filter((_, i) => i !== index))}
                        style={{
                          width: '36px',
                          height: '36px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

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
        return <TodayTab key={refreshKey} onOpenProfile={() => setShowSettings(true)} onSelectProspect={handleSelectProspect} />;
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
