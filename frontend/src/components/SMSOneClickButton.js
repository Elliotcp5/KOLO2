import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { usePlan } from '../context/PlanContext';
import { PaywallBottomSheet } from './PaywallBottomSheet';
import { MessageSquare, Sparkles, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Labels
const LABELS = {
  en: {
    smsTitle: 'AI SMS',
    generating: 'Generating...',
    sendSms: 'Send SMS',
    copy: 'Copy',
    copied: 'Copied!',
    regenerate: 'Regenerate',
    editMessage: 'Edit message',
    suggestionContext: 'AI suggestion based on prospect context'
  },
  fr: {
    smsTitle: 'SMS IA',
    generating: 'Génération...',
    sendSms: 'Envoyer le SMS',
    copy: 'Copier',
    copied: 'Copié !',
    regenerate: 'Régénérer',
    editMessage: 'Modifier le message',
    suggestionContext: 'Suggestion IA basée sur le contexte du prospect'
  },
  de: {
    smsTitle: 'KI-SMS',
    generating: 'Generieren...',
    sendSms: 'SMS senden',
    copy: 'Kopieren',
    copied: 'Kopiert!',
    regenerate: 'Neu generieren',
    editMessage: 'Nachricht bearbeiten',
    suggestionContext: 'KI-Vorschlag basierend auf dem Interessentenkontext'
  },
  it: {
    smsTitle: 'SMS IA',
    generating: 'Generazione...',
    sendSms: 'Invia SMS',
    copy: 'Copia',
    copied: 'Copiato!',
    regenerate: 'Rigenera',
    editMessage: 'Modifica messaggio',
    suggestionContext: 'Suggerimento IA basato sul contesto del potenziale cliente'
  }
};

export function SMSOneClickButton({
  prospect,
  context = null, // Optional: additional context for AI
  variant = 'default', // 'default', 'compact', 'icon'
  className = ''
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const { checkFeature, planData } = usePlan();
  
  const isDark = theme === 'dark';
  const labels = LABELS[locale] || LABELS.en;
  
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  
  // Check if SMS 1-click is available (PRO feature)
  const hasSMSFeature = checkFeature('sms_one_click');
  
  const handleClick = async () => {
    if (!hasSMSFeature) {
      setShowPaywall(true);
      return;
    }
    
    setIsOpen(true);
    await generateMessage();
  };
  
  const generateMessage = async () => {
    if (!prospect?.phone) return;
    
    setLoading(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('session_token');
      
      const response = await fetch(`${API_URL}/api/ai/generate-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prospect_id: prospect.prospect_id,
          context: context,
          locale: locale
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessage(data.message);
      } else {
        // Fallback generic message
        const firstName = prospect.full_name?.split(' ')[0] || '';
        const fallbackMessages = {
          fr: `Bonjour ${firstName}, j'espère que vous allez bien. Je me permets de vous recontacter concernant votre projet immobilier. Avez-vous un moment pour en discuter ? Cordialement`,
          en: `Hi ${firstName}, I hope you're doing well. I wanted to follow up regarding your property project. Do you have a moment to discuss? Best regards`,
          de: `Hallo ${firstName}, ich hoffe es geht Ihnen gut. Ich wollte mich bezüglich Ihres Immobilienprojekts melden. Haben Sie einen Moment Zeit zum Besprechen? Mit freundlichen Grüßen`,
          it: `Ciao ${firstName}, spero che stia bene. Volevo ricontattarla riguardo al suo progetto immobiliare. Ha un momento per discuterne? Cordiali saluti`
        };
        setMessage(fallbackMessages[locale] || fallbackMessages.en);
      }
    } catch (err) {
      // Use fallback message on error
      const firstName = prospect.full_name?.split(' ')[0] || '';
      setMessage(`Bonjour ${firstName}, je me permets de vous recontacter concernant votre projet. Êtes-vous disponible pour en discuter ?`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success(labels.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };
  
  const handleSendSMS = () => {
    if (!prospect?.phone || !message) return;
    
    // Clean phone number
    const cleanPhone = prospect.phone.replace(/\s/g, '');
    
    // Create SMS deep link
    const smsLink = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
    
    // Track interaction (if PRO)
    trackInteraction();
    
    // Open SMS app
    window.location.href = smsLink;
  };
  
  const trackInteraction = async () => {
    try {
      const token = localStorage.getItem('session_token');
      await fetch(`${API_URL}/api/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prospect_id: prospect.prospect_id,
          interaction_type: 'sms',
          content: message.substring(0, 200)
        })
      });
    } catch (err) {
      // Silent fail - interaction tracking is optional
    }
  };
  
  const handleUpgrade = () => {
    setShowPaywall(false);
    window.location.href = '/pricing';
  };
  
  // Render button based on variant
  const renderButton = () => {
    if (variant === 'icon') {
      return (
        <button
          onClick={handleClick}
          className={`p-2 rounded-full transition-all ${className}`}
          style={{
            backgroundColor: isDark ? '#2a2a3b' : '#f2f2f7',
            color: '#6C63FF'
          }}
          title={labels.smsTitle}
        >
          <MessageSquare size={20} />
        </button>
      );
    }
    
    if (variant === 'compact') {
      return (
        <button
          onClick={handleClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${className}`}
          style={{
            backgroundColor: isDark ? 'rgba(108,99,255,0.15)' : '#ede9ff',
            color: '#6C63FF'
          }}
        >
          <MessageSquare size={16} />
          SMS
        </button>
      );
    }
    
    // Default variant
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${className}`}
        style={{
          background: 'linear-gradient(135deg, #4F46E5, #9333EA)',
          color: '#ffffff'
        }}
      >
        <Sparkles size={18} />
        {labels.smsTitle}
      </button>
    );
  };
  
  return (
    <>
      {renderButton()}
      
      {/* SMS Sheet */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsOpen(false)}
          />
          <div 
            className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
            style={{
              backgroundColor: isDark ? '#1a1a24' : '#ffffff',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
              paddingBottom: 'env(safe-area-inset-bottom, 20px)'
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div 
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: isDark ? '#4a4a5a' : '#e0e0e0' }}
              />
            </div>
            
            {/* Header */}
            <div className="px-5 pb-4 flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6C63FF, #9333EA)' }}
              >
                <MessageSquare size={20} color="white" />
              </div>
              <div>
                <h3 
                  className="font-bold"
                  style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                >
                  {labels.smsTitle}
                </h3>
                <p 
                  className="text-xs"
                  style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
                >
                  → {prospect?.full_name}
                </p>
              </div>
            </div>
            
            {/* Message area */}
            <div className="px-5 pb-4">
              {loading ? (
                <div 
                  className="flex items-center justify-center gap-2 py-8"
                  style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
                >
                  <Sparkles size={20} className="animate-pulse" style={{ color: '#6C63FF' }} />
                  {labels.generating}
                </div>
              ) : (
                <>
                  {/* AI context indicator */}
                  <div 
                    className="flex items-center gap-2 text-xs mb-2"
                    style={{ color: '#a78bfa' }}
                  >
                    <Sparkles size={14} />
                    {labels.suggestionContext}
                  </div>
                  
                  {/* Message */}
                  <div 
                    className="p-4 rounded-2xl"
                    style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
                  >
                    {isEditing ? (
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        className="w-full bg-transparent outline-none resize-none"
                        style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                        autoFocus
                        onBlur={() => setIsEditing(false)}
                      />
                    ) : (
                      <p 
                        className="text-sm leading-relaxed cursor-pointer"
                        style={{ color: isDark ? '#d1d5db' : '#374151' }}
                        onClick={() => setIsEditing(true)}
                      >
                        {message}
                      </p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="flex-1 py-2 rounded-full text-sm font-medium transition-all"
                      style={{
                        backgroundColor: isDark ? '#2a2a3b' : '#f2f2f7',
                        color: isDark ? '#a0a4ae' : '#6b7280'
                      }}
                    >
                      {labels.editMessage}
                    </button>
                    <button
                      onClick={generateMessage}
                      className="flex-1 py-2 rounded-full text-sm font-medium transition-all"
                      style={{
                        backgroundColor: isDark ? '#2a2a3b' : '#f2f2f7',
                        color: isDark ? '#a0a4ae' : '#6b7280'
                      }}
                    >
                      {labels.regenerate}
                    </button>
                    <button
                      onClick={handleCopy}
                      className="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1"
                      style={{
                        backgroundColor: copied ? '#34d399' : (isDark ? '#2a2a3b' : '#f2f2f7'),
                        color: copied ? '#ffffff' : (isDark ? '#a0a4ae' : '#6b7280')
                      }}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </>
              )}
            </div>
            
            {/* Send button */}
            {!loading && message && (
              <div className="px-5 pb-4">
                <button
                  onClick={handleSendSMS}
                  className="w-full py-4 rounded-full font-semibold text-white flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #4F46E5, #9333EA)'
                  }}
                >
                  <ExternalLink size={18} />
                  {labels.sendSms}
                </button>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Paywall */}
      <PaywallBottomSheet
        feature="sms_one_click"
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        onUpgrade={handleUpgrade}
        currentPlan={planData?.effective_plan || 'free'}
      />
      
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

export default SMSOneClickButton;
