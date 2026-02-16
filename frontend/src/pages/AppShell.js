import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Briefcase, Menu, Check, User } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';

const TodayTab = () => {
  const { t, formatDate } = useLocale();
  const { user } = useAuth();

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
          data-testid="my-profile-button"
        >
          <User size={18} strokeWidth={1.5} color="white" />
          <span style={{ color: 'white', fontSize: '14px' }}>{t('myProfile')}</span>
        </button>
      </div>

      {/* Date */}
      <p className="text-muted" style={{ marginBottom: '40px', textTransform: 'capitalize' }}>
        {formatDate(new Date())}
      </p>

      {/* Empty state */}
      <div className="empty-state">
        <div className="icon-wrapper">
          <Check strokeWidth={2} />
        </div>
        <h3 className="title">{t('allCaughtUp')}</h3>
        <p className="subtitle">{t('noPendingTask')}</p>
      </div>
    </div>
  );
};

const ProspectsTab = () => {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [prospects, setProspects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  React.useEffect(() => {
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

    fetchProspects();
  }, [API_URL]);

  const getStatusLabel = (status) => {
    const labels = {
      new: t('statusNew'),
      in_progress: t('statusInProgress'),
      closed: t('statusClosed'),
      lost: t('statusLost'),
    };
    return labels[status] || status;
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="text-headline" style={{ fontSize: '28px' }}>
          {t('prospects')}
        </h1>
        <button 
          className="btn-primary"
          onClick={() => navigate('/app/prospects/new')}
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
          {prospects.map((prospect) => (
            <div key={prospect.prospect_id} className="prospect-card" data-testid={`prospect-${prospect.prospect_id}`}>
              <div className="name">{prospect.full_name}</div>
              <div className="contact">{prospect.phone} • {prospect.email}</div>
              <span className={`status-badge ${prospect.status}`}>
                {getStatusLabel(prospect.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SettingsTab = () => {
  const navigate = useNavigate();
  const { t } = useLocale();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <h1 className="text-headline" style={{ fontSize: '28px', marginBottom: '32px' }}>
        {t('settings')}
      </h1>

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
          <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
        <div className="settings-row" data-testid="change-card">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          <span className="label">{t('changeCard')}</span>
          <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
        <div className="settings-row" data-testid="billing-address">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span className="label">{t('billingAddress')}</span>
          <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
        <div className="settings-row" data-testid="change-email">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span className="label">{t('changeEmail')}</span>
          <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
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
        Logout
      </button>
    </div>
  );
};

// Bottom Navigation Component
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
        className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => setActiveTab('settings')}
        data-testid="nav-settings"
      >
        <Menu strokeWidth={1.5} />
      </div>
    </nav>
  );
};

// Main App Shell
const AppShell = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState('today');

  // Sync tab with URL
  React.useEffect(() => {
    if (location.pathname.includes('/prospects')) {
      setActiveTab('prospects');
    } else if (location.pathname.includes('/settings')) {
      setActiveTab('settings');
    } else {
      setActiveTab('today');
    }
  }, [location.pathname]);

  const renderTab = () => {
    switch (activeTab) {
      case 'prospects':
        return <ProspectsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <TodayTab />;
    }
  };

  return (
    <div className="mobile-frame">
      <div className="page-container safe-area-top">
        <div className="scroll-content">
          {renderTab()}
        </div>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
};

export default AppShell;
