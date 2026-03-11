import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sun, Moon, Users, CalendarPlus, ArrowRight, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { API_URL } from '../config/api';
import confetti from 'canvas-confetti';

const OnboardingFlow = ({ onComplete, authFetch }) => {
  const [step, setStep] = useState(1);
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [importedContacts, setImportedContacts] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const navigate = useNavigate();
  const { changeTheme } = useTheme();
  const { locale } = useLocale();

  const content = {
    fr: {
      skip: "Passer",
      // Step 1
      welcome: "Bienvenue sur KOLO",
      welcomeText: "Vos prospects ne vous echapperont plus. On vous montre comment en 2 minutes.",
      letsGo: "C'est parti",
      // Step 2
      importTitle: "Importez vos premiers prospects",
      importText: "Selectionnez des contacts depuis votre telephone en un tap.",
      importBtn: "Importer mes contacts",
      addManually: "Ajouter manuellement",
      contactsSelected: "contacts selectionnes",
      // Step 3
      taskTitle: "Planifiez votre premier suivi",
      taskText: "Un appel, un SMS, un email — KOLO vous rappelle au bon moment.",
      createTask: "Creer une tache",
      // Step 4
      themeTitle: "Comment preferez-vous travailler ?",
      themeText: "Vous pourrez changer cela a tout moment dans vos parametres.",
      lightMode: "Clair",
      darkMode: "Sombre",
      // Step 5
      readyTitle: "Vous etes pret.",
      readyText: "Vos prospects ne vous echapperont plus.",
      accessApp: "Acceder a mon espace"
    },
    en: {
      skip: "Skip",
      // Step 1
      welcome: "Welcome to KOLO",
      welcomeText: "Your prospects won't slip away anymore. Let us show you how in 2 minutes.",
      letsGo: "Let's go",
      // Step 2
      importTitle: "Import your first prospects",
      importText: "Select contacts from your phone in one tap.",
      importBtn: "Import my contacts",
      addManually: "Add manually",
      contactsSelected: "contacts selected",
      // Step 3
      taskTitle: "Plan your first follow-up",
      taskText: "A call, an SMS, an email — KOLO reminds you at the right time.",
      createTask: "Create a task",
      // Step 4
      themeTitle: "How do you prefer to work?",
      themeText: "You can change this anytime in your settings.",
      lightMode: "Light",
      darkMode: "Dark",
      // Step 5
      readyTitle: "You're ready.",
      readyText: "Your prospects won't slip away anymore.",
      accessApp: "Access my space"
    }
  };

  const t = content[locale] || content.fr;
  const totalSteps = 5;

  const handleSkip = async () => {
    // Mark didacticiel as complete but skipped
    try {
      await authFetch(`${API_URL}/api/auth/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ didacticiel_completed: true })
      });
    } catch (e) { console.error(e); }
    onComplete();
  };

  const handleThemeSelect = async (theme) => {
    setSelectedTheme(theme);
    changeTheme(theme);
  };

  const handleThemeConfirm = async () => {
    try {
      await authFetch(`${API_URL}/api/auth/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_preference: selectedTheme })
      });
    } catch (e) { console.error(e); }
    setStep(5);
  };

  const handleComplete = async () => {
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7C3AED', '#8B5CF6', '#A78BFA', '#EC4899']
    });

    // Mark didacticiel as complete
    try {
      await authFetch(`${API_URL}/api/auth/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ didacticiel_completed: true })
      });
    } catch (e) { console.error(e); }

    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  const handleImportContacts = async () => {
    // Check if Contact Picker API is available
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel', 'email'];
        const opts = { multiple: true };
        const contacts = await navigator.contacts.select(props, opts);
        
        if (contacts.length > 0) {
          // Transform and save contacts
          const prospectsData = contacts.map(c => ({
            full_name: c.name?.[0] || 'Sans nom',
            phone: c.tel?.[0] || '',
            email: c.email?.[0] || '',
            source: 'import'
          })).filter(p => p.full_name || p.phone);

          if (prospectsData.length > 0) {
            await authFetch(`${API_URL}/api/prospects/batch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prospects: prospectsData })
            });
            setImportedContacts(prospectsData);
          }
        }
      } catch (err) {
        console.error('Contact import error:', err);
        // Fallback to manual
        setStep(3);
      }
    } else {
      // Contact API not available - move to next step
      alert(locale === 'fr' 
        ? "L'import de contacts n'est pas disponible sur ce navigateur. Vous pouvez ajouter vos prospects manuellement."
        : "Contact import is not available on this browser. You can add prospects manually."
      );
    }
    setStep(3);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Progress bar */}
      <div style={{
        height: '3px',
        background: 'var(--border)',
        marginTop: 'env(safe-area-inset-top)'
      }}>
        <div style={{
          height: '100%',
          width: `${(step / totalSteps) * 100}%`,
          background: 'var(--accent)',
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Skip button - not on theme screen */}
      {step !== 4 && step !== 5 && (
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top) + 16px)',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: '14px',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          {t.skip}
        </button>
      )}

      {/* Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '32px 24px',
        textAlign: 'center'
      }}>
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px',
              boxShadow: '0 8px 32px rgba(124, 58, 237, 0.3)'
            }}>
              <span style={{ fontSize: '36px' }}>K</span>
            </div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--text)',
              marginBottom: '16px'
            }}>
              {t.welcome}
            </h1>
            <p style={{
              fontSize: '16px',
              color: 'var(--muted)',
              marginBottom: '48px',
              lineHeight: '1.5'
            }}>
              {t.welcomeText}
            </p>
            <button
              onClick={() => setStep(2)}
              className="btn-primary"
            >
              {t.letsGo} <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Import contacts */}
        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              background: 'var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px'
            }}>
              <Users size={36} color="var(--accent)" />
            </div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--text)',
              marginBottom: '16px'
            }}>
              {t.importTitle}
            </h1>
            <p style={{
              fontSize: '15px',
              color: 'var(--muted)',
              marginBottom: '48px',
              lineHeight: '1.5'
            }}>
              {t.importText}
            </p>
            <button
              onClick={handleImportContacts}
              className="btn-primary"
              style={{ marginBottom: '16px' }}
            >
              {t.importBtn}
            </button>
            <button
              onClick={() => setStep(3)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {t.addManually}
            </button>
          </div>
        )}

        {/* Step 3: Create task */}
        {step === 3 && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              background: 'var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px'
            }}>
              <CalendarPlus size={36} color="var(--accent)" />
            </div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--text)',
              marginBottom: '16px'
            }}>
              {t.taskTitle}
            </h1>
            <p style={{
              fontSize: '15px',
              color: 'var(--muted)',
              marginBottom: '48px',
              lineHeight: '1.5'
            }}>
              {t.taskText}
            </p>
            <button
              onClick={() => setStep(4)}
              className="btn-primary"
            >
              {t.createTask} <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 4: Choose theme */}
        {step === 4 && (
          <div style={{ animation: 'fadeIn 0.4s ease', width: '100%', maxWidth: '320px' }}>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--text)',
              marginBottom: '12px'
            }}>
              {t.themeTitle}
            </h1>
            <p style={{
              fontSize: '14px',
              color: 'var(--muted)',
              marginBottom: '32px'
            }}>
              {t.themeText}
            </p>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
              {/* Light mode preview */}
              <button
                onClick={() => handleThemeSelect('light')}
                style={{
                  flex: 1,
                  padding: '16px',
                  borderRadius: '16px',
                  border: selectedTheme === 'light' ? '2px solid var(--accent)' : '2px solid var(--border)',
                  background: '#F9FAFB',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {selectedTheme === 'light' && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={12} color="white" />
                  </div>
                )}
                <div style={{
                  width: '100%',
                  height: '80px',
                  background: '#FFFFFF',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  border: '1px solid #E5E7EB',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '8px'
                }}>
                  <div style={{ height: '8px', width: '60%', background: '#111827', borderRadius: '4px', marginBottom: '6px' }} />
                  <div style={{ height: '6px', width: '80%', background: '#E5E7EB', borderRadius: '3px', marginBottom: '6px' }} />
                  <div style={{ height: '6px', width: '40%', background: '#E5E7EB', borderRadius: '3px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Sun size={16} color="#111827" />
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>{t.lightMode}</span>
                </div>
              </button>

              {/* Dark mode preview */}
              <button
                onClick={() => handleThemeSelect('dark')}
                style={{
                  flex: 1,
                  padding: '16px',
                  borderRadius: '16px',
                  border: selectedTheme === 'dark' ? '2px solid var(--accent)' : '2px solid var(--border)',
                  background: '#111114',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {selectedTheme === 'dark' && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={12} color="white" />
                  </div>
                )}
                <div style={{
                  width: '100%',
                  height: '80px',
                  background: '#17171A',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '8px'
                }}>
                  <div style={{ height: '8px', width: '60%', background: '#FAFAFA', borderRadius: '4px', marginBottom: '6px' }} />
                  <div style={{ height: '6px', width: '80%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '6px' }} />
                  <div style={{ height: '6px', width: '40%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Moon size={16} color="#FAFAFA" />
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#FAFAFA' }}>{t.darkMode}</span>
                </div>
              </button>
            </div>

            <button
              onClick={handleThemeConfirm}
              className="btn-primary"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 5: Ready */}
        {step === 5 && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'var(--success-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px'
            }}>
              <Check size={48} color="var(--success)" />
            </div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--text)',
              marginBottom: '16px'
            }}>
              {t.readyTitle}
            </h1>
            <p style={{
              fontSize: '16px',
              color: 'var(--muted)',
              marginBottom: '48px'
            }}>
              {t.readyText}
            </p>
            <button
              onClick={handleComplete}
              className="btn-primary"
            >
              {t.accessApp} <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default OnboardingFlow;
