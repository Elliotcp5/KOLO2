import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { usePlan } from '../context/PlanContext';
import { X, User, Phone, Mail, ChevronRight, Home, Tag, Key, Clock, Flame, Calendar, Sparkles } from 'lucide-react';
import { BudgetSlider } from './BudgetSlider';
import { PaywallBottomSheet } from './PaywallBottomSheet';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Project type options
const PROJECT_TYPES = [
  { value: 'buyer', emoji: '🔍', labelKey: 'projectTypeBuyer' },
  { value: 'seller', emoji: '🏷️', labelKey: 'projectTypeSeller' },
  { value: 'renter', emoji: '🔑', labelKey: 'projectTypeRenter' }
];

// Delay options
const DELAY_OPTIONS = [
  { value: 'urgent', emoji: '🔥', labelKey: 'delayUrgent' },
  { value: '3_6_months', emoji: '', labelKey: 'delay3to6' },
  { value: '6_plus_months', emoji: '', labelKey: 'delay6plus' }
];

// Labels for each language
const LABELS = {
  en: {
    step1Title: 'Contact',
    step2Title: 'Project',
    fullName: 'Full name',
    phone: 'Phone',
    email: 'Email (optional)',
    projectType: 'Project type',
    projectTypeBuyer: 'Buyer',
    projectTypeSeller: 'Seller',
    projectTypeRenter: 'Renter',
    budget: 'Budget',
    delay: 'Timeline',
    delayUrgent: 'Urgent (< 3 months)',
    delay3to6: '3 – 6 months',
    delay6plus: '+ 6 months',
    details: 'Details (optional)',
    detailsPlaceholderBuyer: 'What type of property? Preferred area? Constraints?',
    detailsPlaceholderSeller: 'Type of property to sell? Desired price? Timeline?',
    detailsPlaceholderRenter: 'Size? Areas? Move-in date?',
    next: 'Next',
    addProspect: 'Add prospect',
    cancel: 'Cancel',
    aiHeader: '✦',
    namePlaceholder: 'John Doe',
    phonePlaceholder: '+33 6 12 34 56 78',
    emailPlaceholder: 'email@example.com'
  },
  fr: {
    step1Title: 'Contact',
    step2Title: 'Projet',
    fullName: 'Nom complet',
    phone: 'Téléphone',
    email: 'Email (optionnel)',
    projectType: 'Type de projet',
    projectTypeBuyer: 'Acheteur',
    projectTypeSeller: 'Vendeur',
    projectTypeRenter: 'Locataire',
    budget: 'Budget',
    delay: 'Délai',
    delayUrgent: 'Urgent (< 3 mois)',
    delay3to6: '3 – 6 mois',
    delay6plus: '+ 6 mois',
    details: 'Détails (optionnel)',
    detailsPlaceholderBuyer: 'Quel type de bien ? Quartier souhaité ? Contraintes ?',
    detailsPlaceholderSeller: 'Type de bien à vendre ? Prix souhaité ? Délai ?',
    detailsPlaceholderRenter: 'Surface ? Quartiers ? Date d\'entrée ?',
    next: 'Suivant',
    addProspect: 'Ajouter le prospect',
    cancel: 'Annuler',
    aiHeader: '✦',
    namePlaceholder: 'Jean Dupont',
    phonePlaceholder: '+33 6 12 34 56 78',
    emailPlaceholder: 'email@exemple.com'
  },
  de: {
    step1Title: 'Kontakt',
    step2Title: 'Projekt',
    fullName: 'Vollständiger Name',
    phone: 'Telefon',
    email: 'E-Mail (optional)',
    projectType: 'Projekttyp',
    projectTypeBuyer: 'Käufer',
    projectTypeSeller: 'Verkäufer',
    projectTypeRenter: 'Mieter',
    budget: 'Budget',
    delay: 'Zeitrahmen',
    delayUrgent: 'Dringend (< 3 Monate)',
    delay3to6: '3 – 6 Monate',
    delay6plus: '+ 6 Monate',
    details: 'Details (optional)',
    detailsPlaceholderBuyer: 'Welche Art von Immobilie? Bevorzugte Gegend? Einschränkungen?',
    detailsPlaceholderSeller: 'Art der zu verkaufenden Immobilie? Gewünschter Preis? Zeitrahmen?',
    detailsPlaceholderRenter: 'Größe? Gegenden? Einzugsdatum?',
    next: 'Weiter',
    addProspect: 'Interessent hinzufügen',
    cancel: 'Abbrechen',
    aiHeader: '✦',
    namePlaceholder: 'Max Mustermann',
    phonePlaceholder: '+49 170 1234567',
    emailPlaceholder: 'email@beispiel.de'
  },
  it: {
    step1Title: 'Contatto',
    step2Title: 'Progetto',
    fullName: 'Nome completo',
    phone: 'Telefono',
    email: 'Email (opzionale)',
    projectType: 'Tipo di progetto',
    projectTypeBuyer: 'Acquirente',
    projectTypeSeller: 'Venditore',
    projectTypeRenter: 'Locatario',
    budget: 'Budget',
    delay: 'Tempistiche',
    delayUrgent: 'Urgente (< 3 mesi)',
    delay3to6: '3 – 6 mesi',
    delay6plus: '+ 6 mesi',
    details: 'Dettagli (opzionale)',
    detailsPlaceholderBuyer: 'Che tipo di immobile? Zona preferita? Vincoli?',
    detailsPlaceholderSeller: 'Tipo di immobile da vendere? Prezzo desiderato? Tempistiche?',
    detailsPlaceholderRenter: 'Superficie? Zone? Data di ingresso?',
    next: 'Avanti',
    addProspect: 'Aggiungi potenziale cliente',
    cancel: 'Annulla',
    aiHeader: '✦',
    namePlaceholder: 'Mario Rossi',
    phonePlaceholder: '+39 320 1234567',
    emailPlaceholder: 'email@esempio.it'
  }
};

export function AddProspectSheet({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialData = null 
}) {
  const { theme } = useTheme();
  const { locale } = useLocale();
  const { checkFeature, canAddProspect, planData } = usePlan();
  
  const isDark = theme === 'dark';
  const labels = LABELS[locale] || LABELS.en;
  
  // Form state
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [projectType, setProjectType] = useState(null);
  const [budgetMin, setBudgetMin] = useState(100);
  const [budgetMax, setBudgetMax] = useState(400);
  const [budgetUndefined, setBudgetUndefined] = useState(false);
  const [delay, setDelay] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Paywall state
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState(null);
  
  // Check if budget slider is available (PRO feature)
  const hasBudgetSlider = checkFeature('budget_slider');
  
  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFullName(initialData?.full_name || '');
      setPhone(initialData?.phone || '');
      setEmail(initialData?.email || '');
      setProjectType(initialData?.project_type || null);
      setBudgetMin(initialData?.budget_min || 100);
      setBudgetMax(initialData?.budget_max || 400);
      setBudgetUndefined(initialData?.budget_undefined || false);
      setDelay(initialData?.delay || null);
      setNotes(initialData?.notes || '');
    }
  }, [isOpen, initialData]);
  
  // Form validation
  const isStep1Valid = fullName.trim().length >= 2 && phone.trim().length >= 6;
  const isStep2Valid = projectType && delay;
  
  // Get placeholder based on project type
  const getDetailsPlaceholder = () => {
    switch (projectType) {
      case 'buyer': return labels.detailsPlaceholderBuyer;
      case 'seller': return labels.detailsPlaceholderSeller;
      case 'renter': return labels.detailsPlaceholderRenter;
      default: return labels.detailsPlaceholderBuyer;
    }
  };
  
  // Get AI header text
  const getAIHeader = () => {
    if (!projectType || !delay) return null;
    
    const typeLabel = labels[`projectType${projectType.charAt(0).toUpperCase() + projectType.slice(1)}`];
    const delayLabel = delay === 'urgent' ? labels.delayUrgent :
                       delay === '3_6_months' ? labels.delay3to6 :
                       labels.delay6plus;
    
    const budgetText = budgetUndefined 
      ? (locale === 'fr' ? 'budget à définir' : 'budget TBD')
      : `${budgetMin}k–${budgetMax}k€`;
    
    return `${labels.aiHeader} ${typeLabel} · ${delayLabel} · ${budgetText}`;
  };
  
  const handleNext = () => {
    if (step === 1 && isStep1Valid) {
      setStep(2);
    }
  };
  
  const handleBudgetSliderClick = () => {
    if (!hasBudgetSlider) {
      setPaywallFeature('budget_slider');
      setShowPaywall(true);
    }
  };
  
  const handleSubmit = async () => {
    if (!isStep2Valid || loading) return;
    
    // Check prospect limit
    if (!canAddProspect()) {
      setPaywallFeature('prospects_limit');
      setShowPaywall(true);
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('session_token');
      
      const response = await fetch(`${API_URL}/api/prospects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          project_type: projectType,
          budget_min: budgetUndefined ? null : budgetMin,
          budget_max: budgetUndefined ? null : budgetMax,
          budget_undefined: budgetUndefined,
          delay: delay,
          notes: notes.trim() || null
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`✓ ${fullName.split(' ')[0]} ${locale === 'fr' ? 'ajouté à vos prospects' : 'added to your prospects'}`);
        onSuccess?.(data);
        onClose();
      } else {
        const error = await response.json();
        if (response.status === 403) {
          // Prospect limit reached
          setPaywallFeature('prospects_limit');
          setShowPaywall(true);
        } else {
          toast.error(error.detail || 'Error creating prospect');
        }
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpgrade = (plan) => {
    setShowPaywall(false);
    window.location.href = '/pricing';
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: isDark ? '#1a1a24' : '#ffffff',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)'
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 sticky top-0" style={{ backgroundColor: isDark ? '#1a1a24' : '#ffffff' }}>
          <div 
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: isDark ? '#4a4a5a' : '#e0e0e0' }}
          />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4">
          <button
            onClick={step === 2 ? () => setStep(1) : onClose}
            className="text-sm font-medium"
            style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
          >
            {step === 2 ? '← ' : ''}{labels.cancel}
          </button>
          
          <h2 
            className="text-lg font-bold"
            style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
          >
            {step === 1 ? labels.step1Title : labels.step2Title}
          </h2>
          
          <div className="w-16" /> {/* Spacer */}
        </div>
        
        {/* Step indicators */}
        <div className="flex gap-2 px-5 mb-5">
          <div 
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: '#6C63FF' }}
          />
          <div 
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: step === 2 ? '#6C63FF' : (isDark ? '#2a2a3b' : '#e5e7eb') }}
          />
        </div>
        
        {/* Step 1: Contact */}
        {step === 1 && (
          <div className="px-5 space-y-4">
            {/* Full Name */}
            <div>
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
              >
                {labels.fullName} *
              </label>
              <div 
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
              >
                <User size={20} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={labels.namePlaceholder}
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                />
              </div>
            </div>
            
            {/* Phone */}
            <div>
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
              >
                {labels.phone} *
              </label>
              <div 
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
              >
                <Phone size={20} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={labels.phonePlaceholder}
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                />
              </div>
            </div>
            
            {/* Email (optional) */}
            <div>
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
              >
                {labels.email}
              </label>
              <div 
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa' }}
              >
                <Mail size={20} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={labels.emailPlaceholder}
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: isDark ? '#ffffff' : '#0E0B1E' }}
                />
              </div>
            </div>
            
            {/* Next button */}
            <button
              onClick={handleNext}
              disabled={!isStep1Valid}
              className="w-full py-4 rounded-full font-semibold text-white flex items-center justify-center gap-2 mt-6"
              style={{
                background: isStep1Valid 
                  ? 'linear-gradient(135deg, #4F46E5, #9333EA)'
                  : (isDark ? '#2a2a3b' : '#e5e7eb'),
                color: isStep1Valid ? '#ffffff' : (isDark ? '#6b7280' : '#9ca3af'),
                opacity: isStep1Valid ? 1 : 0.7
              }}
            >
              {labels.next}
              <ChevronRight size={20} />
            </button>
          </div>
        )}
        
        {/* Step 2: Project */}
        {step === 2 && (
          <div className="px-5 space-y-5">
            {/* Project Type */}
            <div>
              <label 
                className="block text-sm font-medium mb-3"
                style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
              >
                {labels.projectType} *
              </label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setProjectType(type.value)}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      backgroundColor: projectType === type.value 
                        ? '#ede9ff' 
                        : (isDark ? '#2a2a3b' : '#f2f2f7'),
                      color: projectType === type.value 
                        ? '#6C63FF' 
                        : (isDark ? '#a0a4ae' : '#666666'),
                      border: projectType === type.value 
                        ? '1.5px solid #a78bfa' 
                        : '1.5px solid transparent'
                    }}
                  >
                    {type.emoji} {labels[type.labelKey]}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Budget (PRO feature) */}
            <div onClick={!hasBudgetSlider ? handleBudgetSliderClick : undefined}>
              <label 
                className="block text-sm font-medium mb-3"
                style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
              >
                {labels.budget}
                {!hasBudgetSlider && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#6C63FF', color: 'white' }}>
                    PRO
                  </span>
                )}
              </label>
              <div style={{ opacity: hasBudgetSlider ? 1 : 0.5 }}>
                <BudgetSlider
                  minValue={budgetMin}
                  maxValue={budgetMax}
                  onChange={({ min, max }) => {
                    setBudgetMin(min);
                    setBudgetMax(max);
                  }}
                  disabled={!hasBudgetSlider}
                  budgetUndefined={budgetUndefined}
                  onBudgetUndefinedChange={hasBudgetSlider ? setBudgetUndefined : undefined}
                />
              </div>
            </div>
            
            {/* Delay */}
            <div>
              <label 
                className="block text-sm font-medium mb-3"
                style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
              >
                {labels.delay} *
              </label>
              <div className="flex gap-2 flex-wrap">
                {DELAY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDelay(option.value)}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      backgroundColor: delay === option.value 
                        ? '#ede9ff' 
                        : (isDark ? '#2a2a3b' : '#f2f2f7'),
                      color: delay === option.value 
                        ? '#6C63FF' 
                        : (isDark ? '#a0a4ae' : '#666666'),
                      border: delay === option.value 
                        ? '1.5px solid #a78bfa' 
                        : '1.5px solid transparent'
                    }}
                  >
                    {option.emoji} {labels[option.labelKey]}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Details (with AI header) */}
            <div>
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: isDark ? '#a0a4ae' : '#6b7280' }}
              >
                {labels.details}
              </label>
              
              {/* AI Header (non-editable) */}
              {getAIHeader() && (
                <div 
                  className="px-4 py-2 rounded-t-xl text-sm"
                  style={{ 
                    backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa',
                    color: '#a78bfa',
                    borderBottom: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`
                  }}
                >
                  {getAIHeader()}
                </div>
              )}
              
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={getDetailsPlaceholder()}
                rows={3}
                className="w-full px-4 py-3 bg-transparent outline-none resize-none"
                style={{ 
                  backgroundColor: isDark ? '#2a2a3b' : '#f7f7fa',
                  color: isDark ? '#ffffff' : '#0E0B1E',
                  borderRadius: getAIHeader() ? '0 0 12px 12px' : '12px'
                }}
              />
            </div>
            
            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!isStep2Valid || loading}
              className="w-full py-4 rounded-full font-semibold text-white flex items-center justify-center gap-2"
              style={{
                background: isStep2Valid 
                  ? 'linear-gradient(135deg, #4F46E5, #9333EA)'
                  : (isDark ? '#2a2a3b' : '#e5e7eb'),
                color: isStep2Valid ? '#ffffff' : (isDark ? '#6b7280' : '#9ca3af'),
                opacity: (isStep2Valid && !loading) ? 1 : 0.7
              }}
            >
              {loading ? '...' : `${labels.addProspect} ✓`}
            </button>
          </div>
        )}
        
        <div className="h-6" /> {/* Bottom padding */}
      </div>
      
      {/* Paywall */}
      <PaywallBottomSheet
        feature={paywallFeature}
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
          animation: slide-up 0.35s ease-out;
        }
      `}</style>
    </>
  );
}

export default AddProspectSheet;
