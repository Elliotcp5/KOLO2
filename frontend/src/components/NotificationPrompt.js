import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { pushService } from '../services/pushNotifications';
import { toast } from 'sonner';
import useThemeColors from '../hooks/useThemeColors';

const NotificationPrompt = ({ onClose }) => {
  const { t } = useLocale();
  const { user } = useAuth();
  const { c, isDark } = useThemeColors();
  const [isLoading, setIsLoading] = useState(false);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      // Initialize push service
      await pushService.init();
      
      // Request permission
      const granted = await pushService.requestPermission();
      
      if (granted) {
        // Subscribe to push notifications
        await pushService.subscribe(user?.user_id);
        toast.success(t('notificationsEnabled'));
        // Store that user has seen and enabled notifications
        localStorage.setItem('kolo_notifications_enabled', 'true');
      } else {
        toast.error(t('notificationsDenied'));
        localStorage.setItem('kolo_notifications_prompted', 'true');
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      toast.error(t('notificationsDenied'));
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  const handleLater = () => {
    // Store that user has been prompted but chose later
    localStorage.setItem('kolo_notifications_prompted', 'true');
    onClose();
  };

  return (
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
        zIndex: 10000,
        padding: '24px'
      }}
      data-testid="notification-prompt-overlay"
    >
      <div 
        style={{
          background: c('bg'),
          borderRadius: '20px',
          padding: '32px 24px',
          maxWidth: '320px',
          width: '100%',
          textAlign: 'center',
          position: 'relative',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${c('border')}`
        }}
        data-testid="notification-prompt-modal"
      >
        {/* Close button */}
        <button
          onClick={handleLater}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            color: c('muted'),
            cursor: 'pointer',
            padding: '8px'
          }}
          data-testid="notification-prompt-close"
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div 
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}
        >
          <Bell size={32} style={{ color: 'white' }} />
        </div>

        {/* Title */}
        <h2 
          style={{
            fontSize: '20px',
            fontWeight: '700',
            color: c('text'),
            marginBottom: '12px',
            fontFamily: 'var(--font-heading)'
          }}
        >
          {t('enableNotifications')}
        </h2>

        {/* Description */}
        <p 
          style={{
            fontSize: '15px',
            color: c('muted'),
            lineHeight: '1.5',
            marginBottom: '28px'
          }}
        >
          {t('notificationsDesc')}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleEnable}
            disabled={isLoading}
            style={{ 
              height: '50px', 
              width: '100%',
              background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
              border: 'none',
              borderRadius: '999px',
              color: 'white',
              fontSize: '15px',
              fontWeight: '700',
              cursor: isLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            data-testid="enable-notifications-btn"
          >
            {isLoading ? (
              <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
            ) : (
              t('enableButton')
            )}
          </button>
          <button
            onClick={handleLater}
            style={{ 
              height: '44px',
              background: 'none',
              border: 'none',
              color: c('muted'),
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
            data-testid="notifications-later-btn"
          >
            {t('maybeLater')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPrompt;
