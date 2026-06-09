import React, { useState, useEffect } from 'react';
import { Check, Sun, Moon, Users, Phone, Mail, Calendar, ChevronRight, Sparkles, ArrowRight, X, Mic, Bell, Shield } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { API_URL } from '../config/api';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

const OnboardingFlow = ({ onComplete, authFetch }) => {
  const [step, setStep] = useState(1);
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [importedContacts, setImportedContacts] = useState([]);
  const [animatingIn, setAnimatingIn] = useState(true);
  const [permMic, setPermMic] = useState('idle'); // idle | granted | denied
  const [permNotif, setPermNotif] = useState('idle');
  const [permCal, setPermCal] = useState('idle'); // idle | connecting | connected
  const { theme, changeTheme } = useTheme();
  const { locale } = useLocale();

  const content = {
    fr: {
      skip: "Passer",
      continueBtn: "Continuer",
      // Step 1 - Welcome
      welcome: "Bienvenue sur",
      welcomeTagline: "Vos prospects ne vous échapperont plus.",
      welcomeDescription: "Découvrez comment KOLO va transformer votre suivi commercial en 2 minutes.",
      letsGo: "C'est parti !",
      // Step 2 - How it works
      howItWorksTitle: "Comment ça marche ?",
      feature1Title: "Swipez vos tâches",
      feature1Desc: "Glissez vers la droite pour valider une tâche.",
      feature2Title: "IA intelligente",
      feature2Desc: "KOLO génère des relances personnalisées pour chaque prospect.",
      feature3Title: "Ne ratez rien",
      feature3Desc: "Notifications au bon moment pour ne jamais oublier un suivi.",
      // Step 3 - Permissions
      permissionsTitle: "Activez le superpouvoir KOLO",
      permissionsDesc: "Trois autorisations facultatives pour libérer toute la puissance de l'app. Vous gardez le contrôle total.",
      permMicTitle: "Microphone",
      permMicDesc: "Dictez vos notes et transcrivez vos appels automatiquement.",
      permCalTitle: "Calendrier",
      permCalDesc: "Synchronisez vos rendez-vous avec Google ou Outlook.",
      permNotifTitle: "Notifications",
      permNotifDesc: "Restez alerté en temps réel pour ne rien oublier.",
      permEnable: "Activer",
      permEnabled: "Activé",
      permLater: "Plus tard dans les paramètres",
      permSkip: "Je configurerai plus tard",
      permPrivacy: "Vos données restent privées. Aucun accès sans votre validation explicite.",
      // Step 4 - Import
      importTitle: "Importez vos premiers prospects",
      importDescription: "Commencez avec vos contacts existants. Sélectionnez ceux que vous souhaitez suivre.",
      importBtn: "Importer mes contacts",
      skipImport: "Je préfère ajouter manuellement",
      contactsImported: "contacts importés",
      // Step 5 - Theme
      themeTitle: "Choisissez votre interface",
      themeDescription: "Mode clair ou sombre ? Vous pourrez toujours changer dans les paramètres.",
      lightMode: "Mode clair",
      darkMode: "Mode sombre",
      // Step 6 - Ready
      readyTitle: "Vous êtes prêt !",
      readyDescription: "KOLO est configuré. Commencez à transformer vos prospects en clients.",
      accessApp: "Accéder à mon espace",
      tip1: "Ajoutez votre premier prospect via le bouton +",
      tip2: "Swipez vos tâches pour les valider rapidement",
      tip3: "L'IA génère des relances personnalisées"
    },
    en: {
      skip: "Skip",
      continueBtn: "Continue",
      welcome: "Welcome to",
      welcomeTagline: "Your prospects won't slip away anymore.",
      welcomeDescription: "Discover how KOLO will transform your sales follow-up in 2 minutes.",
      letsGo: "Let's go!",
      howItWorksTitle: "How does it work?",
      feature1Title: "Swipe your tasks",
      feature1Desc: "Swipe right to validate a task.",
      feature2Title: "Smart AI",
      feature2Desc: "KOLO generates personalized follow-ups for each prospect.",
      feature3Title: "Never miss anything",
      feature3Desc: "Notifications at the right time so you never forget a follow-up.",
      permissionsTitle: "Unlock KOLO's superpowers",
      permissionsDesc: "Three optional permissions to unleash the full power. You stay in full control.",
      permMicTitle: "Microphone",
      permMicDesc: "Dictate notes and transcribe calls automatically.",
      permCalTitle: "Calendar",
      permCalDesc: "Sync your meetings with Google or Outlook.",
      permNotifTitle: "Notifications",
      permNotifDesc: "Stay alerted in real-time so you never miss a thing.",
      permEnable: "Enable",
      permEnabled: "Enabled",
      permLater: "Later from settings",
      permSkip: "I'll set this up later",
      permPrivacy: "Your data stays private. No access without your explicit consent.",
      importTitle: "Import your first prospects",
      importDescription: "Start with your existing contacts. Select those you want to follow.",
      importBtn: "Import my contacts",
      skipImport: "I prefer to add manually",
      contactsImported: "contacts imported",
      themeTitle: "Choose your interface",
      themeDescription: "Light or dark mode? You can always change it in settings.",
      lightMode: "Light mode",
      darkMode: "Dark mode",
      readyTitle: "You're ready!",
      readyDescription: "KOLO is set up. Start turning prospects into clients.",
      accessApp: "Access my space",
      tip1: "Add your first prospect via the + button",
      tip2: "Swipe tasks to validate them quickly",
      tip3: "AI generates personalized follow-ups"
    }
  };

  const t = content[locale] || content.fr;
  const totalSteps = 7;

  // Animation on step change - smoother transition
  useEffect(() => {
    setAnimatingIn(true);
    const timer = setTimeout(() => setAnimatingIn(false), 500);
    return () => clearTimeout(timer);
  }, [step]);

  const handleSkip = async () => {
    try {
      await authFetch(`${API_URL}/api/auth/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ didacticiel_completed: true })
      });
    } catch (e) {
      console.error('Skip error:', e);
    }
    onComplete();
  };

  const handleComplete = async () => {
    // Apply selected theme
    changeTheme(selectedTheme);
    
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    try {
      await authFetch(`${API_URL}/api/auth/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          didacticiel_completed: true,
          theme: selectedTheme
        })
      });
    } catch (e) {
      console.error('Complete error:', e);
    }

    setTimeout(() => onComplete(), 500);
  };

  const handleImportContacts = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'email', 'tel'];
        const opts = { multiple: true };
        const contacts = await navigator.contacts.select(props, opts);
        
        if (contacts && contacts.length > 0) {
          // Process each contact
          for (const contact of contacts) {
            const name = contact.name?.[0] || '';
            const phone = contact.tel?.[0] || '';
            const email = contact.email?.[0] || '';
            
            if (name && (phone || email)) {
              try {
                await authFetch(`${API_URL}/api/prospects`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    full_name: name,
                    phone: phone || '',
                    email: email || '',
                    source: 'contacts',
                    status: 'nouveau',
                    notes: ''
                  })
                });
              } catch (err) {
                console.error('Failed to import contact:', name);
              }
            }
          }
          
          setImportedContacts(contacts);
          toast.success(`${contacts.length} ${t.contactsImported}`);
        }
      } catch (err) {
        console.error('Contact picker error:', err);
        toast.error(locale === 'fr' 
          ? "Impossible d'accéder aux contacts" 
          : "Unable to access contacts");
      }
    } else {
      toast.info(locale === 'fr' 
        ? "Import disponible sur Chrome Android" 
        : "Import available on Chrome Android");
    }
  };

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  // ===== Permission requests (Step 3) =====
  const requestMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.info(locale === 'fr' ? 'Micro non supporté ici' : 'Mic not supported');
      setPermMic('denied');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermMic('granted');
      toast.success(locale === 'fr' ? 'Micro activé ✓' : 'Mic enabled ✓');
    } catch (_e) {
      setPermMic('denied');
      toast.info(locale === 'fr' ? 'Vous pourrez l\'activer plus tard' : 'You can enable it later');
    }
  };

  const requestNotif = async () => {
    if (!('Notification' in window)) {
      toast.info(locale === 'fr' ? 'Notifications non supportées' : 'Notifications not supported');
      setPermNotif('denied');
      return;
    }
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        setPermNotif('granted');
        toast.success(locale === 'fr' ? 'Notifications activées ✓' : 'Notifications enabled ✓');
      } else {
        setPermNotif('denied');
      }
    } catch (_e) { setPermNotif('denied'); }
  };

  const requestCalendar = async (provider = 'google') => {
    setPermCal('connecting');
    try {
      const path = provider === 'outlook' ? 'outlook-calendar' : 'google-calendar';
      const r = await authFetch(`${API_URL}/api/integrations/${path}/auth-url?redirect_to=${encodeURIComponent('/app')}`);
      if (r && r.ok) {
        const d = await r.json();
        const url = d.authorization_url || d.auth_url;
        if (url) {
          // Full redirect (cleaner than popup which is often blocked on mobile)
          window.location.href = url;
          return;
        }
      }
    } catch (_e) { /* fall through */ }
    setPermCal('idle');
    toast.info(locale === 'fr' ? 'Configure ça depuis ton profil.' : 'Set this up from your profile.');
  };

  const isDark = selectedTheme === 'dark';
  const bgColor = isDark ? '#0E0B1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#0E0B1E';
  const mutedColor = isDark ? '#8A849E' : '#6B7280';
  const cardBg = isDark ? '#1A1A2E' : '#F8FAFC';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const gradient = 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)';

  const containerStyle = {
    position: 'fixed',
    inset: 0,
    background: bgColor,
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    paddingTop: '60px',
    overflow: 'auto',
    transition: 'background 0.3s ease'
  };

  const contentStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '400px',
    margin: '0 auto',
    width: '100%',
    opacity: animatingIn ? 0 : 1,
    transform: animatingIn ? 'translateY(15px) scale(0.98)' : 'translateY(0) scale(1)',
    transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
  };

  // Progress indicator
  const ProgressDots = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((i) => (
        <div
          key={i}
          style={{
            width: step === i ? '24px' : '8px',
            height: '8px',
            borderRadius: '4px',
            background: step >= i ? gradient : borderColor,
            transition: 'all 0.3s ease'
          }}
        />
      ))}
    </div>
  );

  // Step 1: Welcome
  const WelcomeStep = () => (
    <div style={contentStyle}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: '32px' }}>
          <svg width="64" height="64" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="12" fill="url(#gradient)"/>
            <path d="M12 14h16M12 20h16M12 26h10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="28" cy="26" r="4" fill="white"/>
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#004AAD"/>
                <stop offset="1" stopColor="#CB6CE6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: textColor, marginBottom: '8px' }}>
          {t.welcome}
        </h1>
        <h2 style={{ 
          fontSize: '36px', 
          fontWeight: '800', 
          background: gradient, 
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '16px'
        }}>
          KOLO
        </h2>
        <p style={{ fontSize: '18px', color: mutedColor, marginBottom: '8px' }}>
          {t.welcomeTagline}
        </p>
        <p style={{ fontSize: '15px', color: mutedColor, lineHeight: '1.5' }}>
          {t.welcomeDescription}
        </p>
      </div>
      
      <button
        onClick={nextStep}
        style={{
          width: '100%',
          padding: '16px',
          background: gradient,
          border: 'none',
          borderRadius: '999px',
          color: 'white',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
        data-testid="onboarding-start"
      >
        {t.letsGo}
        <ArrowRight size={18} />
      </button>
    </div>
  );

  // Step 2: How it works
  const HowItWorksStep = () => (
    <div style={contentStyle}>
      <ProgressDots />
      
      <h2 style={{ fontSize: '24px', fontWeight: '700', color: textColor, textAlign: 'center', marginBottom: '32px' }}>
        {t.howItWorksTitle}
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
        {/* Feature 1 */}
        <div style={{ 
          background: cardBg, 
          borderRadius: '16px', 
          padding: '20px', 
          border: `1px solid ${borderColor}`,
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ChevronRight size={24} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: textColor, marginBottom: '4px' }}>
              {t.feature1Title}
            </h3>
            <p style={{ fontSize: '14px', color: mutedColor, lineHeight: '1.4' }}>
              {t.feature1Desc}
            </p>
          </div>
        </div>
        
        {/* Feature 2 */}
        <div style={{ 
          background: cardBg, 
          borderRadius: '16px', 
          padding: '20px', 
          border: `1px solid ${borderColor}`,
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Sparkles size={24} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: textColor, marginBottom: '4px' }}>
              {t.feature2Title}
            </h3>
            <p style={{ fontSize: '14px', color: mutedColor, lineHeight: '1.4' }}>
              {t.feature2Desc}
            </p>
          </div>
        </div>
        
        {/* Feature 3 */}
        <div style={{ 
          background: cardBg, 
          borderRadius: '16px', 
          padding: '20px', 
          border: `1px solid ${borderColor}`,
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Calendar size={24} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: textColor, marginBottom: '4px' }}>
              {t.feature3Title}
            </h3>
            <p style={{ fontSize: '14px', color: mutedColor, lineHeight: '1.4' }}>
              {t.feature3Desc}
            </p>
          </div>
        </div>
      </div>
      
      <button
        onClick={nextStep}
        style={{
          width: '100%',
          padding: '16px',
          background: gradient,
          border: 'none',
          borderRadius: '999px',
          color: 'white',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          marginTop: '24px'
        }}
      >
        {t.continueBtn}
      </button>
    </div>
  );

  // Step 3: Permissions (premium request)
  const PermissionsStep = () => {
    return (
      <div style={contentStyle}>
        <ProgressDots />
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: textColor, textAlign: 'center', marginBottom: '8px' }}>
          {locale === 'fr' ? 'Connecte ton agenda' : 'Connect your calendar'}
        </h2>
        <p style={{ fontSize: '14px', color: mutedColor, textAlign: 'center', marginBottom: '20px', lineHeight: 1.5 }}>
          {locale === 'fr'
            ? 'Tes tâches KOLO se synchronisent automatiquement avec ton calendrier. Choisis le tien :'
            : 'Your KOLO tasks sync automatically with your calendar. Pick yours:'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Google Calendar */}
          <button
            onClick={() => requestCalendar('google')}
            disabled={permCal === 'connecting'}
            data-testid="onb-cal-google"
            style={{
              padding: '16px',
              background: cardBg,
              borderRadius: '14px',
              border: `1.5px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s ease, transform 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4285F4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#4285F4', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Calendar size={22} color="white" strokeWidth={2.2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: textColor }}>Google Calendar</div>
              <div style={{ fontSize: '12.5px', color: mutedColor, lineHeight: 1.4 }}>
                {locale === 'fr' ? 'Sync auto avec ton Gmail' : 'Auto-sync with your Gmail'}
              </div>
            </div>
            <ChevronRight size={20} color={mutedColor} />
          </button>

          {/* Outlook Calendar */}
          <button
            onClick={() => requestCalendar('outlook')}
            disabled={permCal === 'connecting'}
            data-testid="onb-cal-outlook"
            style={{
              padding: '16px',
              background: cardBg,
              borderRadius: '14px',
              border: `1.5px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0078D4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#0078D4', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Calendar size={22} color="white" strokeWidth={2.2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: textColor }}>Outlook Calendar</div>
              <div style={{ fontSize: '12.5px', color: mutedColor, lineHeight: 1.4 }}>
                {locale === 'fr' ? 'Sync auto avec ton Office 365' : 'Auto-sync with Office 365'}
              </div>
            </div>
            <ChevronRight size={20} color={mutedColor} />
          </button>

          {/* No calendar */}
          <button
            onClick={nextStep}
            data-testid="onb-cal-skip"
            style={{
              padding: '14px',
              background: 'transparent',
              borderRadius: '14px',
              border: `1px dashed ${borderColor}`,
              color: mutedColor,
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            {locale === 'fr' ? "Je ne souhaite pas connecter mon calendrier" : "I don't want to connect my calendar"}
          </button>
        </div>

        <div style={{
          marginTop: '18px', display: 'flex', alignItems: 'center', gap: '8px',
          color: mutedColor, fontSize: '12px', justifyContent: 'center', textAlign: 'center', lineHeight: 1.4,
        }}>
          <Shield size={14} />
          <span>{locale === 'fr'
            ? 'Tu peux changer d\'avis depuis ton profil à tout moment.'
            : 'You can change your mind anytime from your profile.'}</span>
        </div>
        <button
          onClick={nextStep}
          data-testid="onboarding-perm-continue"
          style={{
            width: '100%',
            padding: '16px',
            background: gradient,
            border: 'none',
            borderRadius: '999px',
            color: 'white',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            marginTop: '20px'
          }}
        >
          {t.continueBtn}
        </button>
      </div>
    );
  };

  // Step 3: Import contacts
  const ImportStep = () => (
    <div style={contentStyle}>
      <ProgressDots />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px'
        }}>
          <Users size={40} color="white" />
        </div>
        
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: textColor, marginBottom: '12px' }}>
          {t.importTitle}
        </h2>
        <p style={{ fontSize: '15px', color: mutedColor, marginBottom: '32px', lineHeight: '1.5' }}>
          {t.importDescription}
        </p>
        
        {importedContacts.length > 0 && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '12px',
            padding: '12px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Check size={20} color="#22c55e" />
            <span style={{ color: '#22c55e', fontWeight: '500' }}>
              {importedContacts.length} {t.contactsImported}
            </span>
          </div>
        )}
        
        <button
          onClick={handleImportContacts}
          style={{
            width: '100%',
            padding: '16px',
            background: gradient,
            border: 'none',
            borderRadius: '999px',
            color: 'white',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}
          data-testid="onboarding-import"
        >
          <Users size={18} />
          {t.importBtn}
        </button>
        
        <button
          onClick={nextStep}
          style={{
            background: 'none',
            border: 'none',
            color: mutedColor,
            fontSize: '15px',
            cursor: 'pointer',
            padding: '12px'
          }}
        >
          {t.skipImport}
        </button>
      </div>
    </div>
  );

  // Step 4: Theme selection
  const ThemeStep = () => (
    <div style={contentStyle}>
      <ProgressDots />
      
      <h2 style={{ fontSize: '24px', fontWeight: '700', color: textColor, textAlign: 'center', marginBottom: '8px' }}>
        {t.themeTitle}
      </h2>
      <p style={{ fontSize: '15px', color: mutedColor, textAlign: 'center', marginBottom: '32px' }}>
        {t.themeDescription}
      </p>
      
      <div style={{ display: 'flex', gap: '16px', flex: 1, justifyContent: 'center' }}>
        {/* Light mode option */}
        <button
          onClick={() => setSelectedTheme('light')}
          style={{
            flex: 1,
            maxWidth: '160px',
            background: selectedTheme === 'light' ? gradient : '#FFFFFF',
            border: selectedTheme === 'light' ? 'none' : '2px solid rgba(0,0,0,0.1)',
            borderRadius: '20px',
            padding: '24px 16px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: selectedTheme === 'light' ? 'white' : '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sun size={28} color={selectedTheme === 'light' ? '#F59E0B' : '#6B7280'} />
          </div>
          <span style={{ 
            fontSize: '15px', 
            fontWeight: '600', 
            color: selectedTheme === 'light' ? 'white' : '#374151'
          }}>
            {t.lightMode}
          </span>
          {selectedTheme === 'light' && (
            <Check size={20} color="white" />
          )}
        </button>
        
        {/* Dark mode option */}
        <button
          onClick={() => setSelectedTheme('dark')}
          style={{
            flex: 1,
            maxWidth: '160px',
            background: selectedTheme === 'dark' ? gradient : '#1A1A2E',
            border: selectedTheme === 'dark' ? 'none' : '2px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '24px 16px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: selectedTheme === 'dark' ? 'white' : '#2D2D44',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Moon size={28} color={selectedTheme === 'dark' ? '#8B5CF6' : '#9CA3AF'} />
          </div>
          <span style={{ 
            fontSize: '15px', 
            fontWeight: '600', 
            color: 'white'
          }}>
            {t.darkMode}
          </span>
          {selectedTheme === 'dark' && (
            <Check size={20} color="white" />
          )}
        </button>
      </div>
      
      <button
        onClick={nextStep}
        style={{
          width: '100%',
          padding: '16px',
          background: gradient,
          border: 'none',
          borderRadius: '999px',
          color: 'white',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          marginTop: '32px'
        }}
      >
        {t.continueBtn}
      </button>
    </div>
  );

  // Step 6: Install (Add to Home Screen — iPhone / Android-specific guide)
  const [installPlatform, setInstallPlatform] = useState(() => {
    if (typeof navigator === 'undefined') return null;
    const ua = (navigator.userAgent || '').toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return null;
  });

  const installCopy = {
    fr: {
      title: 'Installe KOLO sur ton écran d\'accueil',
      sub: 'Comme une vraie app, en 3 secondes. Choisis ton téléphone :',
      iphone: 'iPhone',
      android: 'Android',
      iosTitle: 'Sur iPhone (Safari)',
      iosSteps: [
        { icon: '1', text: 'Ouvre cette page dans Safari' },
        { icon: '2', text: 'Touche le bouton Partager ⬆️ en bas' },
        { icon: '3', text: 'Choisis "Sur l\'écran d\'accueil" puis "Ajouter"' },
      ],
      androidTitle: 'Sur Android (Chrome)',
      androidSteps: [
        { icon: '1', text: 'Ouvre cette page dans Chrome' },
        { icon: '2', text: 'Touche le menu ⋮ en haut à droite' },
        { icon: '3', text: 'Choisis "Ajouter à l\'écran d\'accueil" puis "Ajouter"' },
      ],
      done: 'Plus tard',
      gotIt: 'C\'est fait',
      changePhone: 'Changer de téléphone',
    },
    en: {
      title: 'Install KOLO on your home screen',
      sub: 'Like a real app, in 3 seconds. Pick your phone:',
      iphone: 'iPhone',
      android: 'Android',
      iosTitle: 'On iPhone (Safari)',
      iosSteps: [
        { icon: '1', text: 'Open this page in Safari' },
        { icon: '2', text: 'Tap the Share button ⬆️ at the bottom' },
        { icon: '3', text: 'Choose "Add to Home Screen" then "Add"' },
      ],
      androidTitle: 'On Android (Chrome)',
      androidSteps: [
        { icon: '1', text: 'Open this page in Chrome' },
        { icon: '2', text: 'Tap the ⋮ menu in the top right' },
        { icon: '3', text: 'Choose "Add to Home screen" then "Add"' },
      ],
      done: 'Later',
      gotIt: 'Done',
      changePhone: 'Change phone',
    },
    it: {
      title: 'Installa KOLO sulla tua schermata home',
      sub: 'Come una vera app, in 3 secondi. Scegli il tuo telefono:',
      iphone: 'iPhone',
      android: 'Android',
      iosTitle: 'Su iPhone (Safari)',
      iosSteps: [
        { icon: '1', text: 'Apri questa pagina in Safari' },
        { icon: '2', text: 'Tocca il pulsante Condividi ⬆️ in basso' },
        { icon: '3', text: 'Scegli "Aggiungi a Home" poi "Aggiungi"' },
      ],
      androidTitle: 'Su Android (Chrome)',
      androidSteps: [
        { icon: '1', text: 'Apri questa pagina in Chrome' },
        { icon: '2', text: 'Tocca il menu ⋮ in alto a destra' },
        { icon: '3', text: 'Scegli "Aggiungi a schermata Home" poi "Aggiungi"' },
      ],
      done: 'Più tardi',
      gotIt: 'Fatto',
      changePhone: 'Cambia telefono',
    },
    de: {
      title: 'Installiere KOLO auf deinem Startbildschirm',
      sub: 'Wie eine echte App, in 3 Sekunden. Wähle dein Handy:',
      iphone: 'iPhone',
      android: 'Android',
      iosTitle: 'Auf iPhone (Safari)',
      iosSteps: [
        { icon: '1', text: 'Öffne diese Seite in Safari' },
        { icon: '2', text: 'Tippe auf den Teilen-Button ⬆️ unten' },
        { icon: '3', text: 'Wähle "Zum Home-Bildschirm" dann "Hinzufügen"' },
      ],
      androidTitle: 'Auf Android (Chrome)',
      androidSteps: [
        { icon: '1', text: 'Öffne diese Seite in Chrome' },
        { icon: '2', text: 'Tippe auf das ⋮ Menü oben rechts' },
        { icon: '3', text: 'Wähle "Zum Startbildschirm zufügen" dann "Hinzufügen"' },
      ],
      done: 'Später',
      gotIt: 'Fertig',
      changePhone: 'Handy ändern',
    },
  };

  const InstallStep = () => {
    const C = installCopy[locale] || installCopy.en;
    const showGuide = installPlatform === 'ios' || installPlatform === 'android';

    return (
      <div style={contentStyle}>
        <ProgressDots />
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: textColor, textAlign: 'center', marginBottom: '8px' }}>
          {C.title}
        </h2>
        <p style={{ fontSize: '14px', color: mutedColor, textAlign: 'center', marginBottom: '24px', lineHeight: 1.5 }}>
          {C.sub}
        </p>

        {!showGuide && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <button
              onClick={() => setInstallPlatform('ios')}
              data-testid="onb-install-ios"
              style={{
                padding: '24px 16px', borderRadius: 16,
                background: cardBg, border: `1.5px solid ${borderColor}`,
                cursor: 'pointer', textAlign: 'center',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#007AFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; }}
            >
              <div style={{ fontSize: 36, marginBottom: 6 }}>🍎</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: textColor }}>{C.iphone}</div>
            </button>
            <button
              onClick={() => setInstallPlatform('android')}
              data-testid="onb-install-android"
              style={{
                padding: '24px 16px', borderRadius: 16,
                background: cardBg, border: `1.5px solid ${borderColor}`,
                cursor: 'pointer', textAlign: 'center',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3DDC84'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; }}
            >
              <div style={{ fontSize: 36, marginBottom: 6 }}>🤖</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: textColor }}>{C.android}</div>
            </button>
          </div>
        )}

        {showGuide && (
          <div style={{ background: cardBg, borderRadius: 16, padding: 20, border: `1px solid ${borderColor}`, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textColor, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{installPlatform === 'ios' ? C.iosTitle : C.androidTitle}</span>
              <button onClick={() => setInstallPlatform(null)} data-testid="onb-install-change"
                style={{ background: 'transparent', border: 'none', color: mutedColor, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
                {C.changePhone}
              </button>
            </div>
            {(installPlatform === 'ios' ? C.iosSteps : C.androidSteps).map((s) => (
              <div key={s.icon} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: gradient, color: '#fff',
                  display: 'grid', placeItems: 'center',
                  fontSize: 13, fontWeight: 800, flexShrink: 0,
                }}>{s.icon}</div>
                <div style={{ fontSize: 14, color: textColor, lineHeight: 1.5, paddingTop: 4 }}>{s.text}</div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={nextStep}
          data-testid="onboarding-install-continue"
          style={{
            width: '100%', padding: '16px',
            background: gradient, border: 'none', borderRadius: '999px',
            color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
            marginTop: '16px',
          }}
        >
          {showGuide ? C.gotIt : C.done}
        </button>
      </div>
    );
  };

  // Step 7: Ready
  const ReadyStep = () => (
    <div style={contentStyle}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px'
        }}>
          <Check size={50} color="white" strokeWidth={3} />
        </div>
        
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: textColor, marginBottom: '12px' }}>
          {t.readyTitle}
        </h2>
        <p style={{ fontSize: '16px', color: mutedColor, marginBottom: '32px' }}>
          {t.readyDescription}
        </p>
        
        {/* Tips */}
        <div style={{ 
          background: cardBg, 
          borderRadius: '16px', 
          padding: '20px', 
          border: `1px solid ${borderColor}`,
          width: '100%',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></div>
            <span style={{ fontSize: '14px', color: textColor }}>{t.tip1}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></div>
            <span style={{ fontSize: '14px', color: textColor }}>{t.tip2}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></div>
            <span style={{ fontSize: '14px', color: textColor }}>{t.tip3}</span>
          </div>
        </div>
      </div>
      
      <button
        onClick={handleComplete}
        style={{
          width: '100%',
          padding: '16px',
          background: gradient,
          border: 'none',
          borderRadius: '999px',
          color: 'white',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
        data-testid="onboarding-complete"
      >
        {t.accessApp}
        <ArrowRight size={18} />
      </button>
    </div>
  );

  return (
    <div style={containerStyle}>
      {/* Skip button - top right */}
      {step < totalSteps && (
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: mutedColor,
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          data-testid="onboarding-skip"
        >
          {t.skip}
          <X size={16} />
        </button>
      )}
      
      {step === 1 && <WelcomeStep />}
      {step === 2 && <HowItWorksStep />}
      {step === 3 && <PermissionsStep />}
      {step === 4 && <ImportStep />}
      {step === 5 && <ThemeStep />}
      {step === 6 && <InstallStep />}
      {step === 7 && <ReadyStep />}
    </div>
  );
};

export default OnboardingFlow;
