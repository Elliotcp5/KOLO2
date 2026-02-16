import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Share, Plus, MoreVertical, Check } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

const PWAGuide = ({ onComplete }) => {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const [currentStep, setCurrentStep] = useState(0);
  const [device, setDevice] = useState('ios'); // ios, android, other

  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setDevice('ios');
    } else if (/android/.test(userAgent)) {
      setDevice('android');
    } else {
      setDevice('other');
    }
  }, []);

  const iosSteps = locale === 'fr' ? [
    {
      icon: <Share size={32} style={{ color: 'var(--accent)' }} />,
      title: "Appuyez sur le bouton Partager",
      description: "En bas de Safari, appuyez sur l'icône de partage (carré avec une flèche vers le haut)"
    },
    {
      icon: <Plus size={32} style={{ color: 'var(--accent)' }} />,
      title: "Sur l'écran d'accueil",
      description: "Faites défiler et appuyez sur \"Sur l'écran d'accueil\""
    },
    {
      icon: <Check size={32} style={{ color: 'var(--success)' }} />,
      title: "Ajoutez KOLO",
      description: "Appuyez sur \"Ajouter\" en haut à droite. C'est fait !"
    }
  ] : [
    {
      icon: <Share size={32} style={{ color: 'var(--accent)' }} />,
      title: "Tap the Share button",
      description: "At the bottom of Safari, tap the share icon (square with arrow pointing up)"
    },
    {
      icon: <Plus size={32} style={{ color: 'var(--accent)' }} />,
      title: "Add to Home Screen",
      description: "Scroll down and tap \"Add to Home Screen\""
    },
    {
      icon: <Check size={32} style={{ color: 'var(--success)' }} />,
      title: "Add KOLO",
      description: "Tap \"Add\" in the top right corner. Done!"
    }
  ];

  const androidSteps = locale === 'fr' ? [
    {
      icon: <MoreVertical size={32} style={{ color: 'var(--accent)' }} />,
      title: "Ouvrez le menu",
      description: "Appuyez sur les 3 points en haut à droite de Chrome"
    },
    {
      icon: <Plus size={32} style={{ color: 'var(--accent)' }} />,
      title: "Ajouter à l'écran d'accueil",
      description: "Sélectionnez \"Ajouter à l'écran d'accueil\" ou \"Installer l'application\""
    },
    {
      icon: <Check size={32} style={{ color: 'var(--success)' }} />,
      title: "Confirmez",
      description: "Appuyez sur \"Ajouter\" pour confirmer. C'est fait !"
    }
  ] : [
    {
      icon: <MoreVertical size={32} style={{ color: 'var(--accent)' }} />,
      title: "Open the menu",
      description: "Tap the 3 dots in the top right corner of Chrome"
    },
    {
      icon: <Plus size={32} style={{ color: 'var(--accent)' }} />,
      title: "Add to Home Screen",
      description: "Select \"Add to Home screen\" or \"Install app\""
    },
    {
      icon: <Check size={32} style={{ color: 'var(--success)' }} />,
      title: "Confirm",
      description: "Tap \"Add\" to confirm. Done!"
    }
  ];

  const steps = device === 'ios' ? iosSteps : androidSteps;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="mobile-frame">
      <div className="page-container no-nav" style={{ 
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          padding: '20px 24px',
          paddingTop: 'max(20px, env(safe-area-inset-top))'
        }}>
          <button 
            onClick={handleSkip}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--muted)', 
              cursor: 'pointer',
              fontSize: '16px'
            }}
            data-testid="skip-guide"
          >
            {locale === 'fr' ? 'Passer' : 'Skip'}
          </button>
        </div>

        {/* Content */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 32px',
          textAlign: 'center'
        }}>
          {/* Progress dots */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '48px' 
          }}>
            {steps.map((_, index) => (
              <div
                key={index}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: index === currentStep ? 'var(--accent)' : 'var(--border)',
                  transition: 'background-color 0.3s ease'
                }}
              />
            ))}
          </div>

          {/* Icon */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            backgroundColor: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px'
          }}>
            {steps[currentStep].icon}
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '16px'
          }}>
            {steps[currentStep].title}
          </h2>

          {/* Description */}
          <p style={{
            fontSize: '16px',
            color: 'var(--muted)',
            lineHeight: '1.5',
            maxWidth: '280px'
          }}>
            {steps[currentStep].description}
          </p>
        </div>

        {/* Device indicator */}
        <div style={{ 
          textAlign: 'center', 
          padding: '16px',
          color: 'var(--muted-dark)',
          fontSize: '13px'
        }}>
          {device === 'ios' ? 'Safari • iPhone/iPad' : device === 'android' ? 'Chrome • Android' : 'Web Browser'}
        </div>

        {/* Button */}
        <div style={{ padding: '0 24px 40px' }}>
          <button 
            className="btn-primary"
            onClick={handleNext}
            data-testid="next-step"
          >
            {currentStep === steps.length - 1 
              ? (locale === 'fr' ? "C'est parti !" : "Let's go!")
              : (locale === 'fr' ? 'Suivant' : 'Next')
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAGuide;
