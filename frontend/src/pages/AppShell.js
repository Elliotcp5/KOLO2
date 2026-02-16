import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Briefcase, Menu, Check, User, Plus, Clock, Phone, Mail, ChevronRight, X } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import NotificationPrompt from '../components/NotificationPrompt';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ==================== TODAY TAB ====================
const TodayTab = ({ onOpenProfile }) => {
  const { t, formatDate } = useLocale();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tasks/today`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCompleteTask = async (taskId) => {
    try {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}/complete`, {
        method: 'POST',
        credentials: 'include'
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
            return (
              <div 
                key={task.task_id} 
                className="card task-card"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '16px',
                  padding: '16px',
                  cursor: 'pointer'
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
                    border: '2px solid var(--accent)',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Check size={14} strokeWidth={3} style={{ color: 'var(--accent)', opacity: 0 }} />
                </button>
                
                {/* Task content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <IconComponent size={14} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text)' }}>
                      {task.title}
                    </span>
                  </div>
                  {task.prospect && (
                    <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
                      {task.prospect.full_name} • {task.prospect.phone}
                    </span>
                  )}
                  {task.auto_generated && (
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
      const response = await fetch(`${API_URL}/api/prospects`, {
        credentials: 'include'
      });
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
      const response = await fetch(`${API_URL}/api/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)'
        }}>
          <button 
            onClick={() => setShowAddForm(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '16px' }}
          >
            {t('cancel')}
          </button>
          <h2 style={{ fontSize: '17px', fontWeight: '600' }}>{t('addProspect')}</h2>
          <button 
            onClick={handleCreateProspect}
            disabled={!newProspect.full_name || !newProspect.phone || creating}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: (!newProspect.full_name || !newProspect.phone || creating) ? 'var(--muted)' : 'var(--accent)', 
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600'
            }}
            data-testid="save-prospect-button"
          >
            {creating ? '...' : t('save')}
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            className="input-dark"
            placeholder={`${t('fullName')} *`}
            value={newProspect.full_name}
            onChange={(e) => setNewProspect({...newProspect, full_name: e.target.value})}
            data-testid="prospect-name-input"
          />
          <input
            type="tel"
            className="input-dark"
            placeholder={`${t('phone')} *`}
            value={newProspect.phone}
            onChange={(e) => setNewProspect({...newProspect, phone: e.target.value})}
            data-testid="prospect-phone-input"
          />
          <input
            type="email"
            className="input-dark"
            placeholder={t('email')}
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
            rows={4}
            style={{ resize: 'none' }}
          />
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
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');

  useEffect(() => {
    const fetchProspectDetail = async () => {
      try {
        const response = await fetch(`${API_URL}/api/prospects/${prospect.prospect_id}`, {
          credentials: 'include'
        });
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
      const response = await fetch(`${API_URL}/api/prospects/${prospect.prospect_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

  const handleCreateTask = async () => {
    if (!newTaskTitle || !newTaskDate) return;
    
    try {
      const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prospect_id: prospect.prospect_id,
          title: newTaskTitle,
          task_type: 'follow_up',
          due_date: new Date(newTaskDate).toISOString()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setShowNewTask(false);
        setNewTaskTitle('');
        setNewTaskDate('');
        // Refresh prospect data
        const refreshResponse = await fetch(`${API_URL}/api/prospects/${prospect.prospect_id}`, {
          credentials: 'include'
        });
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setProspectData(refreshData);
          setTasks(refreshData.tasks || []);
        }
        toast.success(t('taskCreated'));
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error(t('taskError'));
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}/complete`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        setTasks(prev => prev.map(t => 
          t.task_id === taskId ? { ...t, completed: true } : t
        ));
        // Refresh to update next_task
        const refreshResponse = await fetch(`${API_URL}/api/prospects/${prospect.prospect_id}`, {
          credentials: 'include'
        });
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
          <button 
            className="btn-ghost"
            onClick={() => setShowNewTask(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            data-testid="add-task-button"
          >
            <Plus size={16} />
            {t('addTask')}
          </button>
        </div>

        {/* New task form */}
        {showNewTask && (
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <input
              type="text"
              className="input-dark"
              placeholder={t('taskTitle')}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              style={{ marginBottom: '12px' }}
              data-testid="new-task-title"
            />
            <input
              type="datetime-local"
              className="input-dark"
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
              style={{ marginBottom: '12px' }}
              data-testid="new-task-date"
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowNewTask(false)}
                style={{ flex: 1, height: '44px' }}
              >
                {t('cancel')}
              </button>
              <button 
                className="btn-primary" 
                onClick={handleCreateTask}
                disabled={!newTaskTitle || !newTaskDate}
                style={{ flex: 1, height: '44px' }}
                data-testid="save-task-button"
              >
                {t('save')}
              </button>
            </div>
          </div>
        )}

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
  const { t } = useLocale();
  const { user, logout } = useAuth();

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
        <div className="settings-row" data-testid="edit-payment-method">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          <span className="label">{t('editPaymentMethod')}</span>
          <ChevronRight className="chevron" size={20} />
        </div>
        <div className="settings-row" data-testid="change-card">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          <span className="label">{t('changeCard')}</span>
          <ChevronRight className="chevron" size={20} />
        </div>
        <div className="settings-row" data-testid="billing-address">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span className="label">{t('billingAddress')}</span>
          <ChevronRight className="chevron" size={20} />
        </div>
        <div className="settings-row" data-testid="change-email">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span className="label">{t('changeEmail')}</span>
          <ChevronRight className="chevron" size={20} />
        </div>
      </div>

      {/* About section */}
      <h3 className="text-caption" style={{ marginBottom: '12px' }}>
        {t('about')}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '0 16px' }}>
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
      const tasksRes = await fetch(`${API_URL}/api/tasks`, { credentials: 'include' });
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
      
      // Fetch prospects for linking
      const prospectsRes = await fetch(`${API_URL}/api/prospects`, { credentials: 'include' });
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

      const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      const response = await fetch(`${API_URL}/api/tasks/${taskId}/complete`, {
        method: 'POST',
        credentials: 'include'
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

  // Group tasks by date
  const groupedTasks = tasks.reduce((groups, task) => {
    const date = new Date(task.due_date).toLocaleDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(task);
    return groups;
  }, {});

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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'flex-end',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: '20px 20px 0 0',
            padding: '24px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600' }}>{t('newTask')}</h2>
              <button 
                onClick={() => setShowAddTask(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
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
                  style={{ width: '100%' }}
                >
                  <option value="">{t('noLeadLinked')}</option>
                  {prospects.map(p => (
                    <option key={p.prospect_id} value={p.prospect_id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn-primary"
                onClick={handleCreateTask}
                disabled={!newTask.title || !newTask.dueDate || creating}
                data-testid="create-task-button"
                style={{ marginTop: '8px' }}
              >
                {creating ? <div className="spinner" style={{ width: '20px', height: '20px' }}></div> : t('addTask')}
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
        Object.entries(groupedTasks).map(([date, dateTasks]) => (
          <div key={date} style={{ marginBottom: '24px' }}>
            <h3 className="text-caption" style={{ marginBottom: '12px' }}>{date}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dateTasks.map(task => (
                <div 
                  key={task.task_id} 
                  className="card"
                  style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}
                >
                  <button
                    onClick={() => handleCompleteTask(task.task_id)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: '2px solid var(--accent)',
                      background: 'transparent',
                      cursor: 'pointer',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}
                    data-testid={`complete-task-${task.task_id}`}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      {new Date(task.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {task.prospect_id && getProspectName(task.prospect_id) && (
                        <span> • {getProspectName(task.prospect_id)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
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
