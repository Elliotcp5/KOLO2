import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Briefcase, Menu, Check, User, Users, Plus, Clock, Phone, Mail, ChevronRight, ChevronDown, X, Sparkles, Loader2, MessageSquare, RefreshCw, Send, FileText, Home, Search, MapPin, Sun, Moon, Flame, LogOut, Bell, Globe, Crown, TrendingUp, Lightbulb } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePlan } from '../context/PlanContext';
import { toast } from 'sonner';
import NotificationPrompt from '../components/NotificationPrompt';
import OnboardingFlow from '../components/OnboardingFlow';
import { WelcomePROOnboarding } from '../components/WelcomePROOnboarding';
import { AddProspectSheet } from '../components/AddProspectSheet';
import { SMSOneClickButton } from '../components/SMSOneClickButton';
import { HeatScoreBadge } from '../components/HeatScoreBadge';
import { ROIDashboard } from '../components/ROIDashboard';
import { InteractionTimeline } from '../components/InteractionTimeline';
import { PaywallBottomSheet } from '../components/PaywallBottomSheet';
import { API_URL } from '../config/api';
import { trackTaskCompleted, trackSmsGenerated, trackSmsSent, trackProspectCreated, trackProspectViewed, trackTaskCreated, trackAiSuggestionAccepted, trackLogout, trackFeatureUsed } from '../utils/analytics';
import { openExternalUrl } from '../utils/externalUrl';
// Refactored utilities
import { getInitials } from '../utils/helpers';

// Status configuration with colors
const PROSPECT_STATUSES = {
  nouveau: { fr: 'Nouveau', en: 'New', de: 'Neu', it: 'Nuovo', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.15)' },
  contacte: { fr: 'Contacté', en: 'Contacted', de: 'Kontaktiert', it: 'Contattato', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
  qualifie: { fr: 'Qualifié', en: 'Qualified', de: 'Qualifiziert', it: 'Qualificato', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
  offre: { fr: 'Offre', en: 'Offer', de: 'Angebot', it: 'Offerta', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  signe: { fr: 'Signé', en: 'Signed', de: 'Unterzeichnet', it: 'Firmato', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)' },
  perdu: { fr: 'Perdu', en: 'Lost', de: 'Verloren', it: 'Perso', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' }
};

// UI Labels for all languages
const UI_LABELS = {
  fr: {
    myProfile: 'Mon profil',
    today: "Aujourd'hui",
    tasks: 'Tâches',
    allMyTasks: 'Toutes mes tâches',
    done: 'Faites',
    toDo: 'À faire',
    aiAssistant: 'Assistant IA',
    suggestionsIA: 'suggestions IA',
    suggestionIA: 'suggestion IA',
    inactiveProspects: 'Prospects inactifs à relancer',
    overdueTasks: 'tâches en retard à traiter',
    perfectDay: 'Journée parfaite ! Tout est fait.',
    greatDayAhead: 'Belle journée devant vous.',
    goodAfternoon: 'Bon après-midi !',
    goodEvening: 'Bonsoir !',
    taskCreated: 'Tâche créée !',
    taskAdded: 'Tâche ajoutée !',
    error: 'Erreur',
    generationError: 'Erreur de génération',
    smsSent: 'SMS envoyé !',
    smsError: "Erreur d'envoi SMS",
    connectionError: 'Erreur de connexion',
    call: 'Appeler',
    visit: 'Visite',
    administrative: 'Administratif',
    prospection: 'Prospection',
    followUp: 'Suivi',
    newTask: 'Nouvelle tâche',
    createTask: 'Créer la tâche',
    taskTitle: 'Titre *',
    taskTitlePlaceholder: 'Ex: Appeler pour suivi',
    taskDescription: 'Description (optionnel)',
    taskType: 'Type de tâche',
    dueDate: 'Date *',
    dueTime: 'Heure (optionnel)',
    prospect: 'Prospect',
    noProspect: 'Aucun prospect',
    address: 'Adresse (optionnel)',
    addressPlaceholder: 'Ex: 123 Rue de Paris',
    upToDate: 'À jour',
    allProspectsWellFollowed: 'Tous vos prospects sont bien suivis !',
    add: 'Ajouter',
    hide: 'Masquer',
    other: 'Autre',
    others: 'autres',
    trialEnded: 'Essai terminé',
    trialEndedDesc: 'Votre essai est terminé. Souscrivez pour continuer.',
    subscribeNow: "S'abonner maintenant",
    noTasks: 'Aucune tâche',
    createFirstTask: 'Créez votre première tâche',
    doneExclamation: 'Fait !',
    overdue: 'En retard',
    followUpNow: 'Relancer maintenant',
    at: 'à',
    contact: 'Contact',
    generateAiFollowUp: 'Générer une relance IA',
    generating: 'Génération...',
    aiSuggestedMessage: 'Message suggéré par l\'IA',
    cancel: 'Annuler',
    send: 'Envoyer',
    viewProspectDetails: 'Voir la fiche prospect',
    writingPerfectMessage: 'Rédaction du message parfait',
    regenerate: 'Régénérer',
    linkToProspect: 'Lier à un prospect (optionnel)',
    selectProspect: '-- Sélectionner un prospect --',
    selectAProspect: 'Sélectionner un prospect',
    noProspectAvailable: 'Aucun prospect disponible',
    manual: 'Manuel',
    network: 'Réseau',
    referral: 'Recommandation',
    noSuggestion: 'Aucune suggestion pour ce prospect'
  },
  en: {
    myProfile: 'My profile',
    today: 'Today',
    tasks: 'Tasks',
    allMyTasks: 'All my tasks',
    done: 'Done',
    toDo: 'To do',
    aiAssistant: 'AI Assistant',
    suggestionsIA: 'AI suggestions',
    suggestionIA: 'AI suggestion',
    inactiveProspects: 'Inactive prospects to follow up',
    overdueTasks: 'overdue tasks to handle',
    perfectDay: 'Perfect day! All done.',
    greatDayAhead: 'Great day ahead.',
    goodAfternoon: 'Good afternoon!',
    goodEvening: 'Good evening!',
    taskCreated: 'Task created!',
    taskAdded: 'Task added!',
    error: 'Error',
    generationError: 'Generation error',
    smsSent: 'SMS sent!',
    smsError: 'SMS send error',
    connectionError: 'Connection error',
    call: 'Call',
    visit: 'Visit',
    administrative: 'Administrative',
    prospection: 'Prospecting',
    followUp: 'Follow-up',
    newTask: 'New task',
    createTask: 'Create task',
    taskTitle: 'Title *',
    taskTitlePlaceholder: 'Ex: Call for follow-up',
    taskDescription: 'Description (optional)',
    taskType: 'Task type',
    dueDate: 'Date *',
    dueTime: 'Time (optional)',
    prospect: 'Prospect',
    noProspect: 'No prospect',
    address: 'Address (optional)',
    addressPlaceholder: 'Ex: 123 Main Street',
    upToDate: 'Up to date',
    allProspectsWellFollowed: 'All your prospects are well followed!',
    add: 'Add',
    hide: 'Hide',
    other: 'Other',
    others: 'more',
    trialEnded: 'Trial ended',
    trialEndedDesc: 'Your trial has ended. Subscribe to continue.',
    subscribeNow: 'Subscribe now',
    noTasks: 'No tasks',
    createFirstTask: 'Create your first task',
    doneExclamation: 'Done!',
    overdue: 'Overdue',
    followUpNow: 'Follow up now',
    at: 'at',
    contact: 'Contact',
    generateAiFollowUp: 'Generate AI follow-up',
    generating: 'Generating...',
    aiSuggestedMessage: 'AI suggested message',
    cancel: 'Cancel',
    send: 'Send',
    viewProspectDetails: 'View prospect details',
    writingPerfectMessage: 'Writing the perfect message',
    regenerate: 'Regenerate',
    linkToProspect: 'Link to prospect (optional)',
    selectProspect: '-- Select a prospect --',
    selectAProspect: 'Select a prospect',
    noProspectAvailable: 'No prospects available',
    manual: 'Manual',
    network: 'Network',
    referral: 'Referral',
    noSuggestion: 'No suggestion for this prospect'
  },
  de: {
    myProfile: 'Mein Profil',
    today: 'Heute',
    tasks: 'Aufgaben',
    allMyTasks: 'Alle meine Aufgaben',
    done: 'Erledigt',
    toDo: 'Zu erledigen',
    aiAssistant: 'KI-Assistent',
    suggestionsIA: 'KI-Vorschläge',
    suggestionIA: 'KI-Vorschlag',
    inactiveProspects: 'Inaktive Interessenten nachverfolgen',
    overdueTasks: 'überfällige Aufgaben zu bearbeiten',
    perfectDay: 'Perfekter Tag! Alles erledigt.',
    greatDayAhead: 'Ein toller Tag liegt vor Ihnen.',
    goodAfternoon: 'Guten Nachmittag!',
    goodEvening: 'Guten Abend!',
    taskCreated: 'Aufgabe erstellt!',
    taskAdded: 'Aufgabe hinzugefügt!',
    error: 'Fehler',
    generationError: 'Generierungsfehler',
    smsSent: 'SMS gesendet!',
    smsError: 'SMS-Sendefehler',
    connectionError: 'Verbindungsfehler',
    call: 'Anrufen',
    visit: 'Besuch',
    administrative: 'Verwaltung',
    prospection: 'Akquise',
    followUp: 'Nachverfolgung',
    newTask: 'Neue Aufgabe',
    createTask: 'Aufgabe erstellen',
    taskTitle: 'Titel *',
    taskTitlePlaceholder: 'z.B.: Anruf zur Nachverfolgung',
    taskDescription: 'Beschreibung (optional)',
    taskType: 'Aufgabentyp',
    dueDate: 'Datum *',
    dueTime: 'Uhrzeit (optional)',
    prospect: 'Interessent',
    noProspect: 'Kein Interessent',
    address: 'Adresse (optional)',
    addressPlaceholder: 'z.B.: Hauptstraße 123',
    upToDate: 'Aktuell',
    allProspectsWellFollowed: 'Alle Interessenten werden gut betreut!',
    add: 'Hinzufügen',
    hide: 'Ausblenden',
    other: 'Andere',
    others: 'weitere',
    trialEnded: 'Testphase beendet',
    trialEndedDesc: 'Ihre Testphase ist beendet. Abonnieren Sie, um fortzufahren.',
    subscribeNow: 'Jetzt abonnieren',
    noTasks: 'Keine Aufgaben',
    createFirstTask: 'Erstellen Sie Ihre erste Aufgabe',
    doneExclamation: 'Erledigt!',
    overdue: 'Überfällig',
    followUpNow: 'Jetzt nachfassen',
    at: 'um',
    contact: 'Kontakt',
    generateAiFollowUp: 'KI-Nachverfolgung generieren',
    generating: 'Generiere...',
    aiSuggestedMessage: 'KI-vorgeschlagene Nachricht',
    cancel: 'Abbrechen',
    send: 'Senden',
    viewProspectDetails: 'Interessent-Details anzeigen',
    writingPerfectMessage: 'Perfekte Nachricht wird verfasst',
    regenerate: 'Neu generieren',
    linkToProspect: 'Mit Interessent verknüpfen (optional)',
    selectProspect: '-- Interessent auswählen --',
    selectAProspect: 'Interessent auswählen',
    noProspectAvailable: 'Keine Interessenten verfügbar',
    manual: 'Manuell',
    network: 'Netzwerk',
    referral: 'Empfehlung',
    noSuggestion: 'Kein Vorschlag für diesen Interessenten'
  },
  it: {
    myProfile: 'Il mio profilo',
    today: 'Oggi',
    tasks: 'Attività',
    allMyTasks: 'Tutte le mie attività',
    done: 'Completate',
    toDo: 'Da fare',
    aiAssistant: 'Assistente IA',
    suggestionsIA: 'suggerimenti IA',
    suggestionIA: 'suggerimento IA',
    inactiveProspects: 'Prospect inattivi da ricontattare',
    overdueTasks: 'attività in ritardo da gestire',
    perfectDay: 'Giornata perfetta! Tutto fatto.',
    greatDayAhead: 'Una bella giornata ti aspetta.',
    goodAfternoon: 'Buon pomeriggio!',
    goodEvening: 'Buonasera!',
    taskCreated: 'Attività creata!',
    taskAdded: 'Attività aggiunta!',
    error: 'Errore',
    generationError: 'Errore di generazione',
    smsSent: 'SMS inviato!',
    smsError: 'Errore invio SMS',
    connectionError: 'Errore di connessione',
    call: 'Chiamare',
    visit: 'Visita',
    administrative: 'Amministrativo',
    prospection: 'Prospezione',
    followUp: 'Follow-up',
    newTask: 'Nuova attività',
    createTask: 'Crea attività',
    taskTitle: 'Titolo *',
    taskTitlePlaceholder: 'Es: Chiamare per follow-up',
    taskDescription: 'Descrizione (opzionale)',
    taskType: 'Tipo di attività',
    dueDate: 'Data *',
    dueTime: 'Ora (opzionale)',
    prospect: 'Prospect',
    noProspect: 'Nessun prospect',
    address: 'Indirizzo (opzionale)',
    addressPlaceholder: 'Es: Via Roma 123',
    upToDate: 'Aggiornato',
    allProspectsWellFollowed: 'Tutti i prospect sono ben seguiti!',
    add: 'Aggiungi',
    hide: 'Nascondi',
    other: 'Altro',
    others: 'altri',
    trialEnded: 'Prova terminata',
    trialEndedDesc: 'La tua prova è terminata. Abbonati per continuare.',
    subscribeNow: 'Abbonati ora',
    noTasks: 'Nessuna attività',
    createFirstTask: 'Crea la tua prima attività',
    doneExclamation: 'Fatto!',
    overdue: 'In ritardo',
    followUpNow: 'Ricontatta ora',
    at: 'alle',
    contact: 'Contatto',
    generateAiFollowUp: 'Genera follow-up IA',
    generating: 'Generazione...',
    aiSuggestedMessage: 'Messaggio suggerito dall\'IA',
    cancel: 'Annulla',
    send: 'Invia',
    viewProspectDetails: 'Vedi dettagli prospect',
    writingPerfectMessage: 'Scrittura del messaggio perfetto',
    regenerate: 'Rigenera',
    linkToProspect: 'Collega a un prospect (opzionale)',
    selectProspect: '-- Seleziona un prospect --',
    selectAProspect: 'Seleziona un prospect',
    noProspectAvailable: 'Nessun prospect disponibile',
    manual: 'Manuale',
    network: 'Rete',
    referral: 'Referenza',
    noSuggestion: 'Nessun suggerimento per questo prospect'
  }
};

// Helper to get status info (handles legacy status names)
const getProspectStatusInfo = (status, locale = 'fr') => {
  // Map legacy statuses to new ones
  const legacyMapping = {
    'new': 'nouveau',
    'in_progress': 'contacte',
    'closed': 'signe',
    'lost': 'nouveau'
  };
  
  const mappedStatus = legacyMapping[status] || status;
  const statusInfo = PROSPECT_STATUSES[mappedStatus];
  
  if (!statusInfo) return { label: status, color: '#6B7280', bg: 'rgba(107, 114, 128, 0.15)' };
  return {
    label: statusInfo[locale] || statusInfo.fr,
    color: statusInfo.color,
    bg: statusInfo.bg
  };
};

// Theme-aware color helper - Updated to new design system
const getThemeColor = (theme, type) => {
  const colors = {
    light: {
      // New design system colors
      bg: '#FFFFFF',
      surface: '#F7F6FB',
      surface2: '#F0EEF8',
      text: '#0E0B1E',
      textMid: '#4A4560',
      textSecondary: '#4A4560',
      muted: '#8A849E',
      mutedDark: '#6B6585',
      border: 'rgba(14, 11, 30, 0.08)',
      cardBg: '#FFFFFF',
      cardBorder: 'rgba(14, 11, 30, 0.08)',
      navBg: 'rgba(255, 255, 255, 0.95)',
      inputBg: '#FFFFFF',
      inputBorder: 'rgba(14, 11, 30, 0.15)',
      accent: '#004AAD',
      accentPurple: '#CB6CE6',
      accentGlow: 'rgba(0, 74, 173, 0.12)',
      success: '#16A34A',
      successBg: 'rgba(22, 163, 74, 0.1)',
      warning: '#F59E0B',
      warningBg: '#FFFBEB',
      error: '#EF4444',
      errorBg: '#FEF2F2',
      gradient: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)'
    },
    dark: {
      // Dark mode colors matching screenshot exactly
      bg: '#1A1A24',
      surface: '#2A2A3B',
      surface2: '#2E2E42',
      text: '#FFFFFF',
      textMid: '#D3D3D3',
      textSecondary: '#D3D3D3',
      muted: '#A0A4AE',
      mutedDark: '#9EA3AE',
      border: 'rgba(255, 255, 255, 0.12)',
      cardBg: '#2E2E42',
      cardBorder: 'rgba(255, 255, 255, 0.08)',
      navBg: '#2A2A3B',
      inputBg: '#3C3C55',
      inputBorder: 'rgba(255, 255, 255, 0.15)',
      accent: '#E82EA4',
      accentPurple: '#8A2BE2',
      accentGlow: 'rgba(232, 46, 164, 0.2)',
      success: '#2ECC71',
      successBg: 'rgba(46, 204, 113, 0.12)',
      warning: '#FFC107',
      warningBg: 'rgba(255, 193, 7, 0.12)',
      error: '#F5A6AD',
      errorBg: 'rgba(91, 55, 64, 1)',
      gradient: 'linear-gradient(90deg, #E82EA4 0%, #8A2BE2 100%)'
    }
  };
  return colors[theme]?.[type] || colors.light[type];
};

// Custom hook for theme colors
const useThemeColors = () => {
  const { theme } = useTheme();
  return {
    theme,
    c: (type) => getThemeColor(theme, type),
    isDark: theme === 'dark'
  };
};

// Helper for authenticated fetch
const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('kolo_token');
  const savedLocale = localStorage.getItem('kolo_locale') || 'fr';
  const headers = {
    ...options.headers,
    'Accept-Language': savedLocale,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  return fetch(url, { ...options, headers });
};

// ==================== TODAY TAB ====================
const TodayTab = ({ onOpenProfile, onSelectProspect, userName }) => {
  const { t, formatDate, locale } = useLocale();
  const { c, isDark } = useThemeColors();
  const navigate = useNavigate();
  const labels = UI_LABELS[locale] || UI_LABELS.en;
  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [stats, setStats] = useState({ completedToday: 0, totalToday: 0, activeProspects: 0, streak: 0 });
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [swipingTaskId, setSwipingTaskId] = useState(null);
  const [swipeX, setSwipeX] = useState(0);
  const [completedTaskId, setCompletedTaskId] = useState(null);
  const [viewMode, setViewMode] = useState('today'); // 'today' or 'all'
  
  // Get user initials for profile button
  const userInitials = getInitials(userName);
  
  // AI SMS Modal state
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [aiMessage, setAiMessage] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  
  // Proactive AI message for overdue tasks
  const [proactiveAiTaskId, setProactiveAiTaskId] = useState(null);
  const [proactiveAiMessage, setProactiveAiMessage] = useState('');
  const [proactiveAiLoading, setProactiveAiLoading] = useState(false);
  
  // Add Task Modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [prospects, setProspects] = useState([]);
  const [showProspectPicker, setShowProspectPicker] = useState(false);
  const [newTask, setNewTask] = useState({
    prospect_id: '',
    prospect_name: '',
    title: '',
    due_date: '',
    due_time: '',
    address: '',
    task_type: 'call'
  });
  const [creatingTask, setCreatingTask] = useState(false);

  // Generate contextual greeting message
  const getContextualMessage = () => {
    const hour = new Date().getHours();
    const overdueTasks = tasks.filter(t => !t.completed && new Date(t.due_date) < new Date());
    const pendingTasks = tasks.filter(t => !t.completed);
    const labels = UI_LABELS[locale] || UI_LABELS.en;
    
    // Priority: Overdue > Pending count > Time of day
    if (overdueTasks.length > 0) {
      return `${overdueTasks.length} ${labels.overdueTasks}`;
    }
    
    if (pendingTasks.length === 0 && stats.completedToday > 0) {
      return labels.perfectDay;
    }
    
    if (hour >= 5 && hour < 12) {
      return labels.greatDayAhead;
    } else if (hour >= 12 && hour < 18) {
      return labels.goodAfternoon;
    } else {
      return labels.goodEvening;
    }
  };

  const fetchTasks = async () => {
    try {
      // Fetch today's tasks (includes overdue)
      const response = await authFetch(`${API_URL}/api/tasks/today`);
      if (response.ok) {
        const data = await response.json();
        // Filter out follow_up tasks (replaced by AI)
        const filteredTasks = (data.tasks || []).filter(t => t.task_type !== 'follow_up');
        setTasks(filteredTasks);
        setSubscriptionBlocked(false);
      } else if (response.status === 403) {
        setSubscriptionBlocked(true);
      }
      
      // Fetch all tasks for the "all" view (including completed)
      const allResponse = await authFetch(`${API_URL}/api/tasks?include_completed=true`);
      if (allResponse.ok) {
        const allData = await allResponse.json();
        // Filter out follow_up tasks
        const filteredAllTasks = (allData.tasks || []).filter(t => t.task_type !== 'follow_up');
        
        // Separate completed and non-completed
        const nonCompleted = filteredAllTasks.filter(t => !t.completed);
        const completed = filteredAllTasks
          .filter(t => t.completed)
          .sort((a, b) => new Date(b.completed_at || b.updated_at || 0) - new Date(a.completed_at || a.updated_at || 0))
          .slice(0, 10); // Last 10 completed
        
        // Combine: non-completed first, then completed
        setAllTasks([...nonCompleted, ...completed]);
      }
    } catch (e) {
      console.error('fetchTasks error:', e);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch stats for dashboard
  const fetchStats = async () => {
    try {
      // Get all tasks for today stats
      const allTasksResponse = await authFetch(`${API_URL}/api/tasks`);
      if (allTasksResponse.ok) {
        const data = await allTasksResponse.json();
        // Filter out follow_up tasks
        const filteredTasks = data.tasks.filter(t => t.task_type !== 'follow_up');
        const today = new Date().toDateString();
        const todayTasks = filteredTasks.filter(t => new Date(t.due_date).toDateString() === today);
        const completedToday = todayTasks.filter(t => t.completed).length;
        
        setStats(prev => ({
          ...prev,
          completedToday,
          totalToday: todayTasks.length
        }));
      }
      
      // Get prospects count
      const prospectsResponse = await authFetch(`${API_URL}/api/prospects`);
      if (prospectsResponse.ok) {
        const data = await prospectsResponse.json();
        setStats(prev => ({
          ...prev,
          activeProspects: data.prospects?.length || 0
        }));
        setProspects(data.prospects || []);
      }
      
      // Fetch streak
      const streakResponse = await authFetch(`${API_URL}/api/auth/streak`);
      if (streakResponse.ok) {
        const data = await streakResponse.json();
        setStats(prev => ({
          ...prev,
          streak: data.streak || 0
        }));
      }
      
      // Fetch AI suggestions
      const suggestionsResponse = await authFetch(`${API_URL}/api/tasks/ai-suggestions`);
      if (suggestionsResponse.ok) {
        const data = await suggestionsResponse.json();
        console.log('AI Suggestions loaded:', data.suggestions?.length || 0, data.suggestions);
        setAiSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error('Error fetching stats/suggestions:', e);
    }
  };

  // Create manual task
  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.due_date) return;
    
    setCreatingTask(true);
    try {
      // Combine date and time
      let dueDateTime = newTask.due_date;
      if (newTask.due_time) {
        dueDateTime = `${newTask.due_date}T${newTask.due_time}:00`;
      } else {
        dueDateTime = `${newTask.due_date}T09:00:00`;
      }
      
      const taskData = {
        title: newTask.title,
        due_date: new Date(dueDateTime).toISOString(),
        task_type: newTask.task_type,
        description: newTask.address || null
      };
      
      if (newTask.prospect_id) {
        taskData.prospect_id = newTask.prospect_id;
      }
      
      const response = await authFetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      
      if (response.ok) {
        if ('vibrate' in navigator) navigator.vibrate([10, 40, 20]);
        toast.success(labels.taskCreated);
        setShowAddTaskModal(false);
        setNewTask({ prospect_id: '', title: '', due_date: '', due_time: '', address: '', task_type: 'call' });
        fetchTasks();
        fetchStats();
      } else {
        toast.error(labels.error);
      }
    } catch (error) {
      console.error('Create task error:', error);
      toast.error(labels.error);
    } finally {
      setCreatingTask(false);
    }
  };

  useEffect(() => {
    // Wait for token to be set before fetching
    const token = localStorage.getItem('kolo_token');
    if (token) {
      fetchTasks();
      fetchStats();
    }
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
      toast.error(labels.generationError);
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
  
  // Proactive AI: Generate message for overdue task directly in card
  const generateProactiveAiMessage = async (task) => {
    if (!task?.prospect || proactiveAiLoading) return;
    setProactiveAiTaskId(task.task_id);
    setProactiveAiLoading(true);
    setProactiveAiMessage('');
    try {
      const response = await authFetch(`${API_URL}/api/prospects/${task.prospect_id}/generate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'overdue_follow_up' })
      });
      if (response.ok) {
        const data = await response.json();
        setProactiveAiMessage(data.message || '');
      }
    } catch (error) {
      console.error('Proactive AI message error:', error);
    } finally {
      setProactiveAiLoading(false);
    }
  };
  
  // Send proactive SMS directly
  const sendProactiveSms = async (task) => {
    if (!task?.prospect || !proactiveAiMessage) return;
    setSendingSms(true);
    try {
      const response = await authFetch(`${API_URL}/api/prospects/${task.prospect_id}/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: proactiveAiMessage })
      });
      if (response.ok) {
        // Haptic feedback on SMS sent
        if ('vibrate' in navigator) {
          navigator.vibrate([15, 30, 15]); // Double tap pattern
        }
        trackSmsSent();
        toast.success(labels.smsSent);
        setProactiveAiTaskId(null);
        setProactiveAiMessage('');
        // Mark task as completed
        handleCompleteTask(task.task_id);
      } else {
        const data = await response.json();
        toast.error(data.detail || labels.smsError);
      }
    } catch (error) {
      toast.error(labels.connectionError);
    } finally {
      setSendingSms(false);
    }
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
        // Haptic feedback on SMS sent
        if ('vibrate' in navigator) {
          navigator.vibrate([15, 30, 15]); // Double tap pattern
        }
        trackSmsSent();
        toast.success(labels.smsSent);
        setShowSmsModal(false);
        // Mark task as completed
        handleCompleteTask(selectedTask.task_id);
      } else {
        const data = await response.json();
        // More specific error handling
        const errorMsg = data.detail || labels.smsError;
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('SMS send error:', error);
      toast.error(labels.connectionError);
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
        // Haptic feedback on success - satisfying vibration pattern
        if ('vibrate' in navigator) {
          navigator.vibrate([10, 50, 20]); // Short-pause-medium pattern
        }
        
        // Track task completion
        trackTaskCompleted(task?.task_type || 'unknown');
        // Update stats
        setStats(prev => ({
          ...prev,
          completedToday: prev.completedToday + 1
        }));
        // Animation: show completed state briefly
        setCompletedTaskId(taskId);
        setTimeout(() => {
          setCompletedTaskId(null);
          // Remove task from list
          setTasks(prev => prev.filter(t => t.task_id !== taskId));
        }, 400);
        toast.success(t('taskCompleted'));
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error(t('taskError'));
    }
  };
  
  // Swipe handlers
  const handleTouchStart = (e, taskId) => {
    setSwipingTaskId(taskId);
    setSwipeX(e.touches[0].clientX);
  };
  
  const handleTouchMove = (e, taskId) => {
    if (swipingTaskId !== taskId) return;
    const diff = e.touches[0].clientX - swipeX;
    const element = e.currentTarget;
    
    // Allow right swipe (positive diff) with smooth response
    if (diff > 0) {
      // Use easing for more natural feel - require more deliberate swipe
      const easedDiff = Math.min(diff * 0.8, 150);
      element.style.transform = `translateX(${easedDiff}px)`;
      element.style.opacity = Math.max(0.3, 1 - (easedDiff / 200));
      
      // Haptic feedback once when crossing threshold (100px)
      if (diff >= 100 && diff < 110 && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  };
  
  const handleTouchEnd = (e, taskId) => {
    if (swipingTaskId !== taskId) return;
    const element = e.currentTarget;
    const currentX = parseFloat(element.style.transform?.replace('translateX(', '').replace('px)', '') || 0);
    
    // Higher threshold (100px) to prevent accidental completion
    if (currentX > 100) {
      // Complete the task with smooth animation
      element.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
      element.style.transform = 'translateX(100%)';
      element.style.opacity = 0;
      setTimeout(() => {
        handleCompleteTask(taskId);
        element.style.transition = '';
      }, 200);
    } else {
      // Reset with smooth animation
      element.style.transition = 'transform 0.15s ease-out, opacity 0.15s ease-out';
      element.style.transform = 'translateX(0)';
      element.style.opacity = 1;
      setTimeout(() => {
        element.style.transition = '';
      }, 150);
    }
    
    setSwipingTaskId(null);
    setSwipeX(0);
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
    const labels = UI_LABELS[locale] || UI_LABELS.en;
    const typeLabels = {
      call: labels.call,
      email: 'Email',
      sms: 'SMS',
      visit: labels.visit,
      administrative: labels.administrative,
      prospection: labels.prospection,
      follow_up: labels.followUp
    };
    return typeLabels[type] || '';
  };
  
  // Check if task type has action buttons
  const hasActionButtons = (type) => {
    return ['call', 'sms', 'email'].includes(type);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: c('bg'), minHeight: '100vh' }}>
      {/* Header - KOLO Logo + Profile Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ 
          fontFamily: 'var(--font-heading)', 
          fontSize: '22px', 
          fontWeight: '800',
          color: c('text'),
          display: 'flex',
          alignItems: 'center',
          gap: '3px'
        }}>
          KOLO
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: isDark ? '#8A2BE2' : '#CB6CE6',
            marginBottom: '10px'
          }}></span>
        </div>
        <button 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            padding: '6px 14px 6px 6px',
            background: c('surface'),
            border: `1px solid ${c('border')}`,
            borderRadius: '999px',
            cursor: 'pointer'
          }}
          onClick={onOpenProfile}
          data-testid="my-profile-button"
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: isDark 
              ? 'linear-gradient(135deg, #004AAD 0%, #CB6CE6 100%)'
              : 'linear-gradient(135deg, #004AAD 0%, #CB6CE6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '11px',
            fontWeight: '700'
          }}>
            {userInitials || ''}
          </div>
          <span style={{ color: c('text'), fontSize: '14px', fontWeight: '500' }}>{labels.myProfile}</span>
        </button>
      </div>

      {/* Page Title */}
      <h1 style={{ 
        fontSize: '32px', 
        fontWeight: '800', 
        color: c('text'),
        fontFamily: 'var(--font-heading)',
        marginBottom: '4px'
      }}>
        {viewMode === 'today' ? labels.today : labels.tasks}
      </h1>

      {/* Date */}
      <p style={{ 
        textTransform: 'capitalize', 
        fontSize: '14px', 
        color: c('muted'), 
        marginBottom: '12px'
      }}>
        {formatDate(new Date())}
      </p>

      {/* Alert Badge - Overdue Tasks */}
      {stats.totalToday - stats.completedToday > 0 && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '999px',
          padding: '8px 16px',
          marginBottom: '20px',
          color: '#EF4444',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {stats.totalToday - stats.completedToday} {labels.overdueTasks}
        </div>
      )}

      {/* Tabs - Today / All Tasks + Add Button */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
        <button
          onClick={() => setViewMode('today')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '999px',
            border: 'none',
            background: viewMode === 'today' 
              ? 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)'
              : c('surface'),
            color: viewMode === 'today' ? 'white' : c('muted'),
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: viewMode !== 'today' ? `inset 0 0 0 1px ${c('border')}` : 'none'
          }}
          data-testid="segment-today"
        >
          {labels.today}
        </button>
        <button
          onClick={() => setViewMode('all')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '999px',
            border: 'none',
            background: viewMode === 'all' 
              ? 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)'
              : c('surface'),
            color: viewMode === 'all' ? 'white' : c('muted'),
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: viewMode !== 'all' ? `inset 0 0 0 1px ${c('border')}` : 'none'
          }}
          data-testid="segment-all-tasks"
        >
          {labels.allMyTasks}
        </button>
        {/* Add Task Button */}
        <button
          onClick={() => setShowAddTaskModal(true)}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            border: 'none',
            background: isDark ? '#1A1A24' : '#0E0B1E',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          data-testid="add-task-button"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          flex: 1,
          background: c('surface'),
          border: `1px solid ${c('border')}`,
          borderRadius: '14px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '800', color: c('text'), fontFamily: 'var(--font-heading)' }}>
            {stats.completedToday}<span style={{ color: c('muted'), fontWeight: '400' }}> / {stats.totalToday}</span>
          </div>
          <div style={{ fontSize: '13px', color: c('muted'), fontWeight: '500' }}>
            {labels.done}
          </div>
        </div>
        <div style={{
          flex: 1,
          background: c('surface'),
          border: `1px solid ${c('border')}`,
          borderRadius: '14px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '28px', 
            fontWeight: '800', 
            fontFamily: 'var(--font-heading)',
            background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {stats.activeProspects}
          </div>
          <div style={{ fontSize: '13px', color: c('muted'), fontWeight: '500' }}>
            Prospects
          </div>
        </div>
        <div style={{
          flex: 1,
          background: c('surface'),
          border: `1px solid ${c('border')}`,
          borderRadius: '14px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#F59E0B', fontFamily: 'var(--font-heading)' }}>
            {Math.max(0, stats.totalToday - stats.completedToday)}
          </div>
          <div style={{ fontSize: '13px', color: c('muted'), fontWeight: '500' }}>
            {labels.toDo}
          </div>
        </div>
      </div>
      
      {/* AI Suggestions Banner - ALWAYS VISIBLE in Today view */}
      {!loading && !subscriptionBlocked && viewMode === 'today' && (
        <div 
          data-testid="ai-suggestions-block"
          style={{ 
            background: isDark 
              ? 'linear-gradient(135deg, rgba(0, 74, 173, 0.25) 0%, rgba(203, 108, 230, 0.2) 100%)'
              : 'linear-gradient(135deg, rgba(0, 74, 173, 0.12) 0%, rgba(203, 108, 230, 0.1) 100%)',
            border: isDark 
              ? '1px solid rgba(0, 74, 173, 0.35)'
              : '1px solid rgba(0, 74, 173, 0.25)',
            borderRadius: '14px', 
            padding: '14px 16px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: aiSuggestions.length > 0 ? '10px' : '0' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={16} style={{ color: 'white' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', color: c('text'), fontWeight: '600' }}>
                {aiSuggestions.length > 0 
                  ? `${aiSuggestions.length} ${aiSuggestions.length > 1 ? labels.suggestionsIA : labels.suggestionIA}`
                  : labels.aiAssistant
                }
              </div>
              <div style={{ fontSize: '12px', color: c('muted') }}>
                {aiSuggestions.length > 0 
                  ? labels.inactiveProspects
                  : labels.allProspectsWellFollowed
                }
              </div>
            </div>
            {aiSuggestions.length === 0 && (
              <div style={{
                background: isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '11px',
                color: '#22c55e',
                fontWeight: '600'
              }}>
                ✓ {labels.upToDate}
              </div>
            )}
          </div>
          
          {/* First suggestion preview - only if suggestions exist */}
          {aiSuggestions.length > 0 && (
            <div 
              onClick={() => {
                const suggestion = aiSuggestions[0];
                if (suggestion) {
                  trackAiSuggestionAccepted();
                  authFetch(`${API_URL}/api/tasks/ai-suggestions/accept`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(suggestion)
                  }).then(() => {
                    toast.success(labels.taskAdded);
                    fetchTasks();
                    setAiSuggestions(prev => prev.slice(1));
                  });
                }
              }}
              style={{ 
                background: isDark ? '#3C3C55' : 'rgba(255, 255, 255, 0.6)', 
                borderRadius: '10px', 
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: c('text'), fontWeight: '500', marginBottom: '2px' }}>
                  {aiSuggestions[0]?.prospect_name}
                </div>
                <div style={{ fontSize: '12px', color: isDark ? '#D3D3D3' : c('muted') }}>
                  {aiSuggestions[0]?.reason}
                </div>
              </div>
              <button style={{
                background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Plus size={14} />
                {labels.add}
              </button>
            </div>
          )}
          
          {/* Show more if multiple suggestions */}
          {aiSuggestions.length > 1 && (
            <>
              <div 
                onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                style={{ textAlign: 'center', marginTop: '8px', cursor: 'pointer' }}
                data-testid="show-more-suggestions"
              >
                <span style={{ 
                  fontSize: '11px', 
                  color: isDark ? '#CB6CE6' : '#004AAD',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  {showAllSuggestions 
                    ? labels.hide
                    : `+${aiSuggestions.length - 1} ${labels.others}`
                  }
                  <ChevronRight 
                    size={12} 
                    style={{ 
                      display: 'inline',
                      transform: showAllSuggestions ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }} 
                  />
                </span>
              </div>
              
              {/* Dropdown with all suggestions */}
              {showAllSuggestions && (
                <div style={{ 
                  marginTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {aiSuggestions.slice(1).map((suggestion, index) => (
                    <div 
                      key={suggestion.prospect_id || `suggestion-${index}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: isDark ? '#2a2a3b' : '#f7f6fb',
                        borderRadius: '10px',
                        border: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`
                      }}
                    >
                      <div style={{ flex: 1, marginRight: '10px' }}>
                        <div style={{ fontWeight: '500', fontSize: '13px', color: isDark ? '#ffffff' : '#0E0B1E' }}>
                          {suggestion.prospect_name}
                        </div>
                        <div style={{ fontSize: '11px', color: isDark ? '#9ca3af' : '#6b7280', marginTop: '2px' }}>
                          {suggestion.reason}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          authFetch(`${API_URL}/api/tasks/ai-suggestions/accept`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(suggestion)
                          }).then(() => {
                            toast.success(labels.taskAdded);
                            fetchTasks();
                            setAiSuggestions(prev => prev.filter((_, i) => i !== index + 1));
                          });
                        }}
                        style={{
                          padding: '6px 12px',
                          background: 'linear-gradient(135deg, #004AAD, #CB6CE6)',
                          border: 'none',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        + {locale === 'fr' ? 'Ajouter' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

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
            {labels.trialEnded}
          </h3>
          <p className="subtitle" style={{ marginBottom: '24px' }}>
            {labels.trialEndedDesc}
          </p>
          <button 
            className="btn-primary"
            onClick={() => navigate('/subscribe')}
            data-testid="subscribe-button"
          >
            {labels.subscribeNow}
          </button>
        </div>
      ) : (viewMode === 'today' ? tasks : allTasks).length === 0 ? (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(34, 197, 94, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <Check strokeWidth={2} size={32} style={{ color: '#22c55e' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: c('text'), marginBottom: '8px' }}>
            {viewMode === 'today' ? t('allCaughtUp') : labels.noTasks}
          </h3>
          <p style={{ fontSize: '14px', color: c('muted') }}>
            {viewMode === 'today' ? t('noPendingTask') : labels.createFirstTask}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(viewMode === 'today' ? tasks : allTasks).map((task) => {
            const IconComponent = getTaskTypeIcon(task.task_type);
            const taskLabel = getTaskTypeLabel(task.task_type);
            const showActions = hasActionButtons(task.task_type);
            const isExpanded = expandedTaskId === task.task_id;
            const isCompleted = task.completed;
            
            // Calculate if overdue (only for non-completed tasks)
            const now = new Date();
            const taskDate = new Date(task.due_date);
            const isOverdue = !isCompleted && taskDate < now;
            const borderColor = isCompleted ? c('success') : (isOverdue ? c('warning') : c('border'));
            
            // Format time
            const taskTime = taskDate.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', { 
              hour: '2-digit', 
              minute: '2-digit'
            });
            
            return (
              <div 
                key={task.task_id}
                style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px' }}
              >
                {/* Swipe background - only shows during active swipe */}
                {!isCompleted && swipingTaskId === task.task_id && (
                  <div style={{
                    position: 'absolute',
                    left: '1px',
                    top: '1px',
                    bottom: '1px',
                    right: '1px',
                    background: c('success'),
                    borderRadius: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: '20px',
                    pointerEvents: 'none'
                  }}>
                    <Check size={24} style={{ color: 'white' }} />
                    <span style={{ marginLeft: '8px', color: 'white', fontWeight: '500', fontSize: '14px' }}>
                      {locale === 'fr' ? 'Fait !' : locale === 'de' ? 'Erledigt!' : locale === 'it' ? 'Fatto!' : 'Done!'}
                    </span>
                  </div>
                )}
                
                {/* Task card */}
                <div 
                  className={`card ${completedTaskId === task.task_id ? 'task-completing' : ''}`}
                  onTouchStart={isCompleted ? undefined : (e) => handleTouchStart(e, task.task_id)}
                  onTouchMove={isCompleted ? undefined : (e) => handleTouchMove(e, task.task_id)}
                  onTouchEnd={isCompleted ? undefined : (e) => handleTouchEnd(e, task.task_id)}
                  style={{ 
                    padding: '0',
                    background: completedTaskId === task.task_id ? c('success') : c('cardBg'),
                    overflow: 'hidden',
                    position: 'relative',
                    borderRadius: '12px',
                    border: `1px solid ${c('cardBorder')}`,
                    borderLeft: isCompleted ? `3px solid ${c('success')}` : `1px solid ${c('cardBorder')}`,
                    opacity: isCompleted ? 0.7 : 1,
                    transition: swipingTaskId === task.task_id ? 'none' : 'transform 0.2s ease, opacity 0.2s ease'
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
                  {/* Task content - clickable to expand */}
                  <div 
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.task_id)}
                    style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <div style={{ 
                      fontSize: '15px', 
                      fontWeight: '500', 
                      color: isCompleted ? c('success') : c('text'), 
                      marginBottom: '2px',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {isCompleted && <Check size={14} style={{ color: c('success') }} />}
                      {task.prospect?.full_name || task.title}
                    </div>
                    <div style={{ fontSize: '13px', color: c('muted'), display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      <span style={{ color: c('mutedDark') }}>•</span>
                      <span style={{ color: isOverdue ? c('warning') : (isCompleted ? c('success') : c('muted')) }}>
                        {viewMode === 'all' && taskDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) + ' '}
                        {taskTime}
                      </span>
                      {isOverdue && !isCompleted && (
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (task.prospect) {
                              openAiSmsModal(task);
                            }
                          }}
                          style={{ 
                            color: c('warning'), 
                            background: 'none', 
                            border: 'none', 
                            cursor: 'pointer',
                            fontSize: '13px',
                            textDecoration: 'underline',
                            padding: 0
                          }}
                        >
                          {locale === 'fr' ? 'En retard — Relancer maintenant' : locale === 'de' ? 'Überfällig — Jetzt nachfassen' : locale === 'it' ? 'In ritardo — Ricontatta ora' : 'Overdue — Follow up now'}
                        </button>
                      )}
                      {isCompleted && <span style={{ color: 'var(--success)' }}>({locale === 'fr' ? 'Fait' : locale === 'de' ? 'Erledigt' : locale === 'it' ? 'Fatto' : 'Done'})</span>}
                    </div>
                  </div>
                  
                  {/* Quick action buttons - ONLY for non-completed call/sms/email tasks */}
                  {!isCompleted && task.prospect && showActions && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {/* Call button for call tasks only */}
                      {task.task_type === 'call' && task.prospect.phone && (
                        <a href={`tel:${task.prospect.phone}`} 
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: '8px', color: c('success'), textDecoration: 'none' }}>
                          <Phone size={18} />
                        </a>
                      )}
                      {/* Email button for email tasks only */}
                      {task.task_type === 'email' && task.prospect.email && (
                        <a href={`mailto:${task.prospect.email}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: '8px', color: c('text'), textDecoration: 'none' }}>
                          <Mail size={18} />
                        </a>
                      )}
                      {/* SMS buttons for sms tasks only - native + AI */}
                      {task.task_type === 'sms' && task.prospect.phone && (
                        <>
                          <a href={`sms:${task.prospect.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ padding: '8px', color: c('text'), textDecoration: 'none' }}>
                            <MessageSquare size={18} />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); openAiSmsModal(task); }}
                            style={{ padding: '8px', background: 'none', border: 'none', color: c('accentPurple'), cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
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
                    borderTop: `1px solid ${c('border')}`,
                    background: c('surface2')
                  }}>
                    {/* Task details */}
                    <div style={{ padding: '12px 0', fontSize: '14px' }}>
                      <div style={{ color: c('muted'), marginBottom: '8px' }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ color: c('text'), marginBottom: '8px' }}>
                          {task.description}
                        </div>
                      )}
                      <div style={{ color: c('muted'), fontSize: '12px' }}>
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
                        background: c('surface'), 
                        borderRadius: '10px', 
                        padding: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ fontSize: '12px', color: c('muted'), marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {locale === 'fr' ? 'Contact' : 'Contact'}
                        </div>
                        {task.prospect.phone && (
                          <a href={`tel:${task.prospect.phone}`} 
                            onClick={(e) => e.stopPropagation()}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              color: c('text'), 
                              textDecoration: 'none',
                              marginBottom: '6px',
                              fontSize: '14px'
                            }}>
                            <Phone size={14} style={{ color: c('accent') }} />
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
                              color: c('text'), 
                              textDecoration: 'none',
                              fontSize: '14px'
                            }}>
                            <Mail size={14} style={{ color: c('accent') }} />
                            {task.prospect.email}
                          </a>
                        )}
                      </div>
                    )}
                    
                    {/* Proactive AI SMS for overdue tasks */}
                    {isOverdue && task.prospect?.phone && (
                      <div style={{
                        borderRadius: '10px',
                        padding: '12px',
                        marginBottom: '12px'
                      }}>
                        {proactiveAiTaskId !== task.task_id ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); generateProactiveAiMessage(task); }}
                            disabled={proactiveAiLoading}
                            style={{
                              width: '100%',
                              padding: '12px',
                              background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
                              border: 'none',
                              borderRadius: '8px',
                              color: 'white',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px'
                            }}
                            data-testid={`proactive-ai-btn-${task.task_id}`}
                          >
                            <Sparkles size={16} />
                            {labels.generateAiFollowUp}
                          </button>
                        ) : proactiveAiLoading ? (
                          <div style={{ textAlign: 'center', padding: '20px' }}>
                            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                            <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>
                              {labels.generating}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Sparkles size={12} />
                              {locale === 'fr' ? 'Message suggéré par l\'IA' : 'AI suggested message'}
                            </div>
                            <textarea
                              value={proactiveAiMessage}
                              onChange={(e) => setProactiveAiMessage(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                width: '100%',
                                minHeight: '70px',
                                padding: '10px',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                color: 'var(--text)',
                                fontSize: '13px',
                                lineHeight: '1.4',
                                resize: 'none',
                                marginBottom: '10px'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setProactiveAiTaskId(null); setProactiveAiMessage(''); }}
                                style={{
                                  flex: 1,
                                  padding: '10px',
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px',
                                  color: 'var(--muted)',
                                  fontSize: '13px',
                                  cursor: 'pointer'
                                }}
                              >
                                {labels.cancel}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); sendProactiveSms(task); }}
                                disabled={sendingSms || !proactiveAiMessage}
                                style={{
                                  flex: 1,
                                  padding: '10px',
                                  background: proactiveAiMessage ? 'var(--accent)' : 'var(--surface)',
                                  border: 'none',
                                  borderRadius: '8px',
                                  color: proactiveAiMessage ? 'white' : 'var(--muted)',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  cursor: proactiveAiMessage ? 'pointer' : 'not-allowed',
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
                                    {labels.send}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
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
                        {labels.viewProspectDetails}
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              </div>
            );
          })}
        </div>
        </>
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
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                </div>
                <p style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>
                  {locale === 'fr' 
                    ? `Analyse du projet de ${selectedTask.prospect?.full_name?.split(' ')[0] || 'votre prospect'}...` 
                    : `Analyzing ${selectedTask.prospect?.full_name?.split(' ')[0] || 'your prospect'}'s project...`}
                </p>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  {locale === 'fr' ? 'Rédaction du message parfait' : 'Writing the perfect message'}
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
                        {labels.send}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => { setShowAddTaskModal(false); setShowProspectPicker(false); }}>
          <div style={{
            background: c('bg'),
            borderRadius: '20px 20px 0 0',
            padding: '20px',
            paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
            width: '100%',
            maxWidth: '430px',
            maxHeight: '85vh',
            overflowY: 'auto',
            border: `1px solid ${c('border')}`,
            borderBottom: 'none'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <div style={{ 
              width: '40px', 
              height: '4px', 
              background: c('border'),
              borderRadius: '2px',
              margin: '0 auto 16px'
            }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '600', color: c('text') }}>
                {labels.newTask}
              </h2>
              <button onClick={() => { setShowAddTaskModal(false); setShowProspectPicker(false); }} style={{ background: 'none', border: 'none', color: c('muted'), cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            
            {/* Task Type Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: c('muted'), marginBottom: '8px', display: 'block' }}>
                {labels.taskType}
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { value: 'call', label: labels.call, icon: Phone },
                  { value: 'sms', label: 'SMS', icon: MessageSquare },
                  { value: 'email', label: 'Email', icon: Mail },
                  { value: 'visit', label: labels.visit, icon: MapPin },
                  { value: 'other', label: locale === 'fr' ? 'Autre' : locale === 'de' ? 'Andere' : locale === 'it' ? 'Altro' : 'Other', icon: FileText }
                ].map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setNewTask({...newTask, task_type: type.value})}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: newTask.task_type === type.value ? `2px solid ${c('accent')}` : `1px solid ${c('border')}`,
                        background: newTask.task_type === type.value ? c('accentGlow') : c('surface'),
                        color: newTask.task_type === type.value ? c('accent') : c('text'),
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <Icon size={14} />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Title - Required */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: c('muted'), marginBottom: '8px', display: 'block' }}>
                {labels.taskTitle}
              </label>
              <input
                type="text"
                placeholder={labels.taskTitlePlaceholder}
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                data-testid="new-task-title"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: c('surface'),
                  border: `1px solid ${c('border')}`,
                  borderRadius: '10px',
                  fontSize: '15px',
                  color: c('text'),
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            {/* Prospect - Optional - Custom Picker */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: c('muted'), marginBottom: '8px', display: 'block' }}>
                {locale === 'fr' ? 'Lier à un prospect (optionnel)' : 'Link to prospect (optional)'}
              </label>
              <div
                onClick={() => setShowProspectPicker(true)}
                data-testid="new-task-prospect-picker"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: isDark ? '#2a2a3b' : '#f9fafb',
                  border: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`,
                  borderRadius: '10px',
                  fontSize: '15px',
                  color: newTask.prospect_name ? (isDark ? '#ffffff' : '#0E0B1E') : (isDark ? '#6b7280' : '#9ca3af'),
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{newTask.prospect_name || (locale === 'fr' ? '-- Sélectionner un prospect --' : '-- Select a prospect --')}</span>
                <ChevronDown size={18} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
              </div>
              
              {/* Prospect Picker Modal */}
              {showProspectPicker && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.8)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  zIndex: 10001
                }} onClick={() => setShowProspectPicker(false)}>
                  <div 
                    style={{
                      background: isDark ? '#1a1a24' : '#ffffff',
                      borderTopLeftRadius: '24px',
                      borderTopRightRadius: '24px',
                      padding: '20px',
                      width: '100%',
                      maxHeight: '70vh',
                      overflowY: 'auto'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ 
                      width: '40px', 
                      height: '4px', 
                      background: isDark ? '#3a3a4b' : '#e5e7eb',
                      borderRadius: '2px',
                      margin: '0 auto 16px'
                    }} />
                    
                    <h3 style={{ 
                      fontSize: '17px', 
                      fontWeight: '600', 
                      color: isDark ? '#ffffff' : '#0E0B1E',
                      marginBottom: '16px',
                      textAlign: 'center'
                    }}>
                      {locale === 'fr' ? 'Sélectionner un prospect' : 'Select a prospect'}
                    </h3>
                    
                    {/* No prospect option */}
                    <div
                      onClick={() => {
                        setNewTask({...newTask, prospect_id: '', prospect_name: ''});
                        setShowProspectPicker(false);
                      }}
                      style={{
                        padding: '14px 16px',
                        background: !newTask.prospect_id ? (isDark ? '#2a2a3b' : '#f3f4f6') : 'transparent',
                        borderRadius: '10px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ color: isDark ? '#9ca3af' : '#6b7280', fontStyle: 'italic' }}>
                        {locale === 'fr' ? 'Aucun prospect' : 'No prospect'}
                      </span>
                      {!newTask.prospect_id && <Check size={18} style={{ color: '#6C63FF' }} />}
                    </div>
                    
                    {/* Prospects list */}
                    {prospects.length === 0 ? (
                      <p style={{ textAlign: 'center', color: isDark ? '#6b7280' : '#9ca3af', padding: '20px' }}>
                        {locale === 'fr' ? 'Aucun prospect disponible' : 'No prospects available'}
                      </p>
                    ) : (
                      prospects.map(p => (
                        <div
                          key={p.prospect_id}
                          onClick={() => {
                            setNewTask({...newTask, prospect_id: p.prospect_id, prospect_name: p.full_name});
                            setShowProspectPicker(false);
                          }}
                          style={{
                            padding: '14px 16px',
                            background: newTask.prospect_id === p.prospect_id ? (isDark ? '#2a2a3b' : '#f3f4f6') : 'transparent',
                            borderRadius: '10px',
                            marginBottom: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ 
                              fontSize: '15px', 
                              fontWeight: '500', 
                              color: isDark ? '#ffffff' : '#0E0B1E' 
                            }}>
                              {p.full_name}
                            </div>
                            {p.phone && (
                              <div style={{ 
                                fontSize: '13px', 
                                color: isDark ? '#6b7280' : '#9ca3af',
                                marginTop: '2px'
                              }}>
                                {p.phone}
                              </div>
                            )}
                          </div>
                          {newTask.prospect_id === p.prospect_id && <Check size={18} style={{ color: '#6C63FF' }} />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Due Date - Required */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: c('muted'), marginBottom: '8px', display: 'block' }}>
                {labels.dueDate}
              </label>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
                data-testid="new-task-date"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: c('surface'),
                  border: `1px solid ${c('border')}`,
                  borderRadius: '10px',
                  fontSize: '15px',
                  color: c('text'),
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            {/* Due Time - Optional */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: c('muted'), marginBottom: '8px', display: 'block' }}>
                {labels.dueTime}
              </label>
              <input
                type="time"
                value={newTask.due_time}
                onChange={(e) => setNewTask({...newTask, due_time: e.target.value})}
                data-testid="new-task-time"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: c('surface'),
                  border: `1px solid ${c('border')}`,
                  borderRadius: '10px',
                  fontSize: '15px',
                  color: c('text'),
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            {/* Address - Optional */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px', display: 'block' }}>
                {labels.address}
              </label>
              <input
                type="text"
                className="input-dark"
                placeholder={labels.addressPlaceholder}
                value={newTask.address}
                onChange={(e) => setNewTask({...newTask, address: e.target.value})}
                data-testid="new-task-address"
              />
            </div>
            
            {/* Submit Button */}
            <button
              onClick={handleCreateTask}
              disabled={!newTask.title || !newTask.due_date || creatingTask}
              data-testid="create-task-submit"
              style={{
                width: '100%',
                padding: '14px',
                background: (!newTask.title || !newTask.due_date || creatingTask) 
                  ? c('surface') 
                  : 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
                border: 'none',
                borderRadius: '999px',
                color: (!newTask.title || !newTask.due_date || creatingTask) ? c('muted') : 'white',
                fontSize: '16px',
                fontWeight: '600',
                cursor: (!newTask.title || !newTask.due_date || creatingTask) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {creatingTask ? (
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                labels.createTask
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== PROSPECTS TAB ====================
const ProspectsTab = ({ onSelectProspect }) => {
  const { t, locale } = useLocale();
  const { c, isDark } = useThemeColors();
  const labels = UI_LABELS[locale] || UI_LABELS.en;
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newProspect, setNewProspect] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: 'manual',
    status: 'nouveau',
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
    if (!newProspect.full_name || !newProspect.phone || !newProspect.email || !newProspect.notes.trim()) return;
    
    setCreating(true);
    try {
      const response = await authFetch(`${API_URL}/api/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProspect)
      });
      
      if (response.ok) {
        // Haptic feedback on prospect created
        if ('vibrate' in navigator) {
          navigator.vibrate([10, 40, 20]); // Success pattern
        }
        toast.success(t('prospectCreated') || 'Lead créé!');
        setNewProspect({ full_name: '', phone: '', email: '', source: 'manual', status: 'nouveau', notes: '' });
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
    // Use the PROSPECT_STATUSES config
    const statusInfo = getProspectStatusInfo(status, locale);
    return statusInfo.label;
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
              {[
                { value: 'manual', label: locale === 'fr' ? 'Manuel' : 'Manual' },
                { value: 'leboncoin', label: 'Leboncoin' },
                { value: 'seloger', label: 'SeLoger' },
                { value: 'reseau', label: locale === 'fr' ? 'Réseau' : 'Network' },
                { value: 'recommandation', label: locale === 'fr' ? 'Recommandation' : 'Referral' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNewProspect({...newProspect, source: opt.value})}
                  className={`btn-chip ${newProspect.source === opt.value ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-caption" style={{ marginBottom: '8px', display: 'block' }}>{t('status')}</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.entries(PROSPECT_STATUSES).map(([value, statusInfo]) => (
                <button
                  key={value}
                  onClick={() => setNewProspect({...newProspect, status: value})}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    border: newProspect.status === value ? 'none' : '1px solid var(--border)',
                    background: newProspect.status === value ? statusInfo.color : 'transparent',
                    color: newProspect.status === value ? 'white' : 'var(--text)',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {statusInfo[locale] || statusInfo.fr}
                </button>
              ))}
            </div>
          </div>

          {/* Notes - Required */}
          <div>
            <label className="text-caption" style={{ marginBottom: '8px', display: 'block' }}>{t('addNotes')}</label>
            <textarea
              className="input-dark"
              placeholder={t('notesPlaceholder')}
              value={newProspect.notes}
              onChange={(e) => setNewProspect({...newProspect, notes: e.target.value})}
              rows={4}
              style={{ resize: 'none' }}
              data-testid="prospect-notes-input"
            />
          </div>

          {/* Save button at the bottom */}
          <button
            className="btn-primary"
            onClick={handleCreateProspect}
            disabled={!newProspect.full_name || !newProspect.phone || !newProspect.email || !newProspect.notes.trim() || creating}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: c('text') }}>
          {t('prospects')}
        </h1>
        <button 
          onClick={() => setShowSearch(!showSearch)}
          style={{ 
            background: 'none', 
            border: 'none', 
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: showSearch ? c('accentPurple') : c('text')
          }}
          data-testid="search-toggle-button"
        >
          <Search size={22} />
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: c('muted') }} />
          <input
            type="text"
            placeholder={t('searchProspects') || 'Rechercher un prospect...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%',
              paddingLeft: '44px',
              padding: '14px 14px 14px 44px',
              background: c('surface'),
              border: `1px solid ${c('border')}`,
              borderRadius: '12px',
              color: c('text'),
              fontSize: '15px',
              outline: 'none'
            }}
            autoFocus
            data-testid="search-prospects-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ 
                position: 'absolute', 
                right: '14px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                background: 'none', 
                border: 'none', 
                color: c('muted'), 
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}

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
          {prospects
            .filter(p => {
              if (!searchQuery) return true;
              const query = searchQuery.toLowerCase();
              return (
                p.full_name?.toLowerCase().includes(query) ||
                p.phone?.toLowerCase().includes(query) ||
                p.email?.toLowerCase().includes(query)
              );
            })
            .map((prospect) => {
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
                    {/* Temperature indicator with tooltip */}
                    {scoreColor && (
                      <span 
                        style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          background: scoreColor,
                          flexShrink: 0,
                          cursor: 'help'
                        }} 
                        title={locale === 'fr' 
                          ? `Température: ${prospect.score === 'chaud' ? 'Chaud' : prospect.score === 'tiede' ? 'Tiède' : 'Froid'}`
                          : `Temperature: ${prospect.score === 'chaud' ? 'Hot' : prospect.score === 'tiede' ? 'Warm' : 'Cold'}`
                        }
                      />
                    )}
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: c('text'), marginBottom: '2px' }}>{prospect.full_name}</div>
                      <div style={{ fontSize: '13px', color: c('muted') }}>{prospect.phone} • {prospect.email}</div>
                    </div>
                  </div>
                  <ChevronRight size={20} style={{ color: c('muted') }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  {(() => {
                    const statusInfo = getProspectStatusInfo(prospect.status, locale);
                    return (
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        background: statusInfo.bg,
                        color: statusInfo.color
                      }}>
                        {statusInfo.label}
                      </span>
                    );
                  })()}
                  {nextTask && (
                    <span style={{ 
                      fontSize: '12px', 
                      color: nextTask.isOverdue ? '#EF4444' : c('muted'),
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
  const { c, isDark } = useThemeColors();
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
  
  // AI Suggested task state
  const [suggestedTask, setSuggestedTask] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

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

  // Fetch AI suggested task for this prospect
  const fetchSuggestedTask = async () => {
    setLoadingSuggestion(true);
    try {
      const response = await authFetch(`${API_URL}/api/ai/suggest-for-prospect/${prospect.prospect_id}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestedTask(data.suggestion);
        setShowSuggestionModal(true);
      } else {
        toast.info(locale === 'fr' ? 'Aucune suggestion pour ce prospect' : 'No suggestion for this prospect');
      }
    } catch (error) {
      console.error('Failed to fetch suggestion:', error);
      toast.error(locale === 'fr' ? 'Erreur lors du chargement' : 'Failed to load suggestion');
    } finally {
      setLoadingSuggestion(false);
    }
  };

  // Accept suggested task
  const acceptSuggestedTask = async () => {
    if (!suggestedTask) return;
    try {
      const response = await authFetch(`${API_URL}/api/tasks/ai-suggestions/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_id: prospect.prospect_id,
          task_title: suggestedTask.reason,
          task_type: suggestedTask.task_type
        })
      });
      if (response.ok) {
        toast.success(locale === 'fr' ? 'Tâche ajoutée !' : 'Task added!');
        setShowSuggestionModal(false);
        setSuggestedTask(null);
        // Refresh tasks list
        onUpdate();
      } else {
        const error = await response.json();
        toast.error(error.detail || (locale === 'fr' ? 'Erreur' : 'Error'));
      }
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
      toast.error(locale === 'fr' ? 'Erreur' : 'Error');
    }
  };

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
    // If status is "perdu", ask for confirmation before deleting
    if (newStatus === 'perdu') {
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
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error(t('updateError'));
    }
  };

  const deleteProspect = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/prospects/${prospect.prospect_id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success(locale === 'fr' ? 'Prospect supprimé' : 'Prospect deleted');
        onUpdate();
        onBack();
      }
    } catch (error) {
      console.error('Failed to delete prospect:', error);
      toast.error(t('updateError'));
    }
  };

  const confirmStatusChange = () => {
    if (pendingStatus === 'perdu') {
      // Delete the prospect
      deleteProspect();
    } else if (pendingStatus) {
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
    // Use the PROSPECT_STATUSES config
    const statusInfo = getProspectStatusInfo(status, locale);
    return statusInfo.label;
  };

  // New status options for prospect pipeline
  const statusOptions = [
    { value: 'nouveau', label: locale === 'fr' ? 'Nouveau' : 'New', color: '#6B7280' },
    { value: 'contacte', label: locale === 'fr' ? 'Contacté' : 'Contacted', color: '#3B82F6' },
    { value: 'qualifie', label: locale === 'fr' ? 'Qualifié' : 'Qualified', color: '#8B5CF6' },
    { value: 'offre', label: locale === 'fr' ? 'Offre' : 'Offer', color: '#F59E0B' },
    { value: 'signe', label: locale === 'fr' ? 'Signé' : 'Signed', color: '#22C55E' },
    { value: 'perdu', label: locale === 'fr' ? 'Perdu' : 'Lost', color: '#EF4444' }
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
            color: c('text'), 
            cursor: 'pointer',
            padding: '8px'
          }}
          data-testid="back-button"
        >
          <X size={24} strokeWidth={1.5} />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: c('text') }}>{prospectData.full_name}</h1>
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
            background: c('surface'), 
            border: `1px solid ${c('border')}`, 
            color: c('text'), 
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
          zIndex: 10000,
          padding: '16px'
        }} onClick={() => setShowEditModal(false)}>
          <div style={{
            background: c('bg'),
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: `1px solid ${c('border')}`
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: c('text') }}>
                {locale === 'fr' ? 'Modifier le prospect' : 'Edit prospect'}
              </h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: c('muted'), cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: c('muted') }}>
                  {locale === 'fr' ? 'Nom complet' : 'Full name'} *
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                  data-testid="edit-fullname"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: c('surface'),
                    border: `1px solid ${c('border')}`,
                    borderRadius: '10px',
                    fontSize: '15px',
                    color: c('text'),
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: c('muted') }}>
                  {locale === 'fr' ? 'Téléphone' : 'Phone'}
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  data-testid="edit-phone"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: c('surface'),
                    border: `1px solid ${c('border')}`,
                    borderRadius: '10px',
                    fontSize: '15px',
                    color: c('text'),
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: c('muted') }}>
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="edit-email"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: c('surface'),
                    border: `1px solid ${c('border')}`,
                    borderRadius: '10px',
                    fontSize: '15px',
                    color: c('text'),
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: c('muted') }}>
                  Source
                </label>
                <select
                  value={editForm.source}
                  onChange={(e) => setEditForm(prev => ({ ...prev, source: e.target.value }))}
                  data-testid="edit-source"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: c('surface'),
                    border: `1px solid ${c('border')}`,
                    borderRadius: '10px',
                    fontSize: '15px',
                    color: c('text'),
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
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
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: c('muted') }}>
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  data-testid="edit-notes"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: c('surface'),
                    border: `1px solid ${c('border')}`,
                    borderRadius: '10px',
                    fontSize: '15px',
                    color: c('text'),
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              
              <button
                onClick={handleEditSubmit}
                disabled={editLoading}
                data-testid="save-edit-button"
                style={{ 
                  marginTop: '8px',
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
                  border: 'none',
                  borderRadius: '999px',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: editLoading ? 'not-allowed' : 'pointer',
                  opacity: editLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
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
            background: c('bg'),
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '320px',
            width: '100%',
            textAlign: 'center',
            border: `1px solid ${c('border')}`
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '18px', color: c('text') }}>
              {pendingStatus === 'perdu' 
                ? (locale === 'fr' ? 'Supprimer ce prospect ?' : 'Delete this prospect?')
                : t('confirmStatusChange')
              }
            </h3>
            <p style={{ color: c('muted'), marginBottom: '24px', fontSize: '14px' }}>
              {pendingStatus === 'perdu'
                ? (locale === 'fr' 
                    ? 'Êtes-vous sûr de vouloir marquer ce prospect comme perdu ? Il sera définitivement effacé.'
                    : 'Are you sure you want to mark this prospect as lost? It will be permanently deleted.')
                : t('prospectWillDisappear')
              }
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingStatus(null);
                }}
                style={{ 
                  flex: 1,
                  padding: '12px',
                  background: c('surface'),
                  border: `1px solid ${c('border')}`,
                  borderRadius: '999px',
                  color: c('text'),
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmStatusChange}
                style={{ 
                  flex: 1,
                  padding: '12px',
                  background: pendingStatus === 'perdu' ? '#ef4444' : '#22c55e',
                  border: 'none',
                  borderRadius: '999px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {pendingStatus === 'perdu' 
                  ? (locale === 'fr' ? 'Supprimer' : 'Delete')
                  : t('confirm')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact info */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px', background: c('cardBg'), border: `1px solid ${c('border')}`, borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Phone size={18} style={{ color: c('accent') }} />
          <a href={`tel:${prospectData.phone}`} style={{ color: c('text'), textDecoration: 'none', flex: 1 }}>
            {prospectData.phone}
          </a>
          {/* SMS History button - discrete */}
          {prospectData.sms_history && prospectData.sms_history.length > 0 && (
            <button
              onClick={() => setShowSmsHistory(true)}
              style={{
                background: c('surface'),
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: c('muted'),
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
          <Mail size={18} style={{ color: c('accent') }} />
          <a href={`mailto:${prospectData.email}`} style={{ color: c('text'), textDecoration: 'none' }}>
            {prospectData.email}
          </a>
        </div>
      </div>
      
      {/* Score section - discrete inline display */}
      <div style={{ marginBottom: '16px', padding: '12px 16px', background: c('cardBg'), border: `1px solid ${c('border')}`, borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: c('muted'), fontWeight: '500' }}>
            {locale === 'fr' ? 'Température' : 'Temperature'}
          </span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowScoreMenu(!showScoreMenu)}
              disabled={updatingScore}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'transparent',
                border: `1px solid ${c('border')}`,
                borderRadius: '8px',
                cursor: 'pointer',
                color: prospectData.score === 'chaud' ? '#22C55E' : prospectData.score === 'tiede' ? '#F59E0B' : prospectData.score === 'froid' ? '#EF4444' : c('muted'),
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: prospectData.score === 'chaud' ? '#22C55E' : prospectData.score === 'tiede' ? '#F59E0B' : prospectData.score === 'froid' ? '#EF4444' : c('muted')
              }} />
              {prospectData.score === 'chaud' ? (locale === 'fr' ? 'Chaud' : 'Hot') : 
               prospectData.score === 'tiede' ? (locale === 'fr' ? 'Tiède' : 'Warm') : 
               prospectData.score === 'froid' ? (locale === 'fr' ? 'Froid' : 'Cold') : '—'}
            </button>
            
            {showScoreMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: c('bg'),
                border: `1px solid ${c('border')}`,
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                minWidth: '120px',
                overflow: 'hidden',
                zIndex: 100
              }}>
                {[
                  { value: 'chaud', label: locale === 'fr' ? 'Chaud' : 'Hot', color: '#22C55E' },
                  { value: 'tiede', label: locale === 'fr' ? 'Tiède' : 'Warm', color: '#F59E0B' },
                  { value: 'froid', label: locale === 'fr' ? 'Froid' : 'Cold', color: '#EF4444' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => { updateScore(option.value); setShowScoreMenu(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '10px 14px',
                      background: prospectData.score === option.value ? 'rgba(0, 74, 173, 0.1)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: option.color,
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: option.color
                    }} />
                    {option.label}
                    {prospectData.score === option.value && <Check size={14} style={{ marginLeft: 'auto', opacity: 0.7 }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Action buttons row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        {/* AI Message button */}
        <button
          onClick={generateMessage}
          disabled={messageLoading}
          style={{ 
            flex: 1,
            padding: '14px 16px',
            background: isDark 
              ? 'linear-gradient(90deg, #E82EA4 0%, #8A2BE2 100%)'
              : 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: messageLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            opacity: messageLoading ? 0.7 : 1
          }}
          data-testid="ai-message-button"
        >
          <Sparkles size={16} />
          {locale === 'fr' ? 'Relance IA' : 'AI Follow-up'}
        </button>
        
        {/* Suggested task button */}
        <button
          onClick={fetchSuggestedTask}
          disabled={loadingSuggestion}
          style={{ 
            flex: 1,
            padding: '14px 16px',
            background: isDark ? '#2a2a3b' : '#f3f4f6',
            border: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`,
            borderRadius: '12px',
            color: isDark ? '#ffffff' : '#0E0B1E',
            fontSize: '14px',
            fontWeight: '600',
            cursor: loadingSuggestion ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            opacity: loadingSuggestion ? 0.7 : 1
          }}
          data-testid="suggested-task-button"
        >
          <Lightbulb size={16} style={{ color: isDark ? '#F59E0B' : '#D97706' }} />
          {locale === 'fr' ? 'Tâche suggérée' : 'Suggested task'}
        </button>
      </div>
      
      {/* Suggested Task Modal */}
      {showSuggestionModal && suggestedTask && (
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
          zIndex: 10000,
          padding: '16px'
        }} onClick={() => setShowSuggestionModal(false)}>
          <div style={{
            background: isDark ? '#1a1a24' : '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '350px',
            border: `1px solid ${isDark ? '#2a2a3b' : '#e5e7eb'}`,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', color: isDark ? '#ffffff' : '#0E0B1E' }}>
                <Lightbulb size={18} style={{ color: '#F59E0B' }} />
                {locale === 'fr' ? 'Tâche suggérée' : 'Suggested Task'}
              </h2>
              <button onClick={() => setShowSuggestionModal(false)} style={{ background: 'none', border: 'none', color: isDark ? '#6b7280' : '#9ca3af', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ 
              padding: '16px', 
              background: isDark ? '#2a2a3b' : '#f9fafb', 
              borderRadius: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '8px'
              }}>
                <span style={{ 
                  padding: '4px 10px', 
                  background: suggestedTask.task_type === 'appel' ? '#3B82F6' : suggestedTask.task_type === 'sms' ? '#10B981' : '#8B5CF6',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  {suggestedTask.task_type}
                </span>
              </div>
              <p style={{ 
                color: isDark ? '#d1d5db' : '#4b5563', 
                fontSize: '14px',
                lineHeight: '1.5',
                margin: 0
              }}>
                {suggestedTask.reason}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowSuggestionModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: isDark ? '#2a2a3b' : '#f3f4f6',
                  border: 'none',
                  borderRadius: '10px',
                  color: isDark ? '#ffffff' : '#0E0B1E',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {locale === 'fr' ? 'Ignorer' : 'Dismiss'}
              </button>
              <button
                onClick={acceptSuggestedTask}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #004AAD, #CB6CE6)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {labels.add}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* AI Message Modal */}
      {showMessageModal && (
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
          zIndex: 10000,
          padding: '16px'
        }} onClick={() => setShowMessageModal(false)}>
          <div style={{
            background: isDark ? '#1a1a24' : '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '80vh',
            overflowY: 'auto',
            border: `1px solid ${isDark ? '#2a2a3b' : '#e5e7eb'}`,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', color: isDark ? '#ffffff' : '#0E0B1E' }}>
                <Sparkles size={18} style={{ color: '#6C63FF' }} />
                {locale === 'fr' ? 'Message IA' : 'AI Message'}
              </h2>
              <button onClick={() => setShowMessageModal(false)} style={{ background: 'none', border: 'none', color: isDark ? '#6b7280' : '#9ca3af', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            
            {messageLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#6C63FF', marginBottom: '12px' }} />
                <p style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: '14px' }}>
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
                    background: isDark ? '#2a2a3b' : '#f3f4f6',
                    border: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    color: isDark ? '#ffffff' : '#0E0B1E',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    marginBottom: '16px'
                  }}
                />
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button 
                    onClick={generateMessage} 
                    style={{ 
                      flex: 1, 
                      padding: '10px 16px', 
                      background: isDark ? '#2a2a3b' : '#f3f4f6', 
                      border: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`, 
                      borderRadius: '8px', 
                      color: isDark ? '#ffffff' : '#0E0B1E', 
                      fontSize: '14px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    🔄 {locale === 'fr' ? 'Regénérer' : 'Regenerate'}
                  </button>
                  <button 
                    onClick={copyMessage} 
                    style={{ 
                      flex: 1, 
                      padding: '10px 16px', 
                      background: isDark ? '#2a2a3b' : '#f3f4f6', 
                      border: `1px solid ${isDark ? '#3a3a4b' : '#e5e7eb'}`, 
                      borderRadius: '8px', 
                      color: isDark ? '#ffffff' : '#0E0B1E', 
                      fontSize: '14px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
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
          zIndex: 10000,
          padding: '16px'
        }} onClick={() => setShowSmsHistory(false)}>
          <div style={{
            background: c('bg'),
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '70vh',
            overflowY: 'auto',
            border: `1px solid ${c('border')}`
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', color: c('text') }}>
                <MessageSquare size={18} style={{ color: c('accent') }} />
                {locale === 'fr' ? 'Conversation SMS' : 'SMS Conversation'}
              </h2>
              <button onClick={() => setShowSmsHistory(false)} style={{ background: 'none', border: 'none', color: c('muted'), cursor: 'pointer', padding: '4px' }}>
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
                          background: isReceived ? c('surface') : 'linear-gradient(135deg, rgba(0, 74, 173, 0.3) 0%, rgba(203, 108, 230, 0.3) 100%)',
                          borderRadius: isReceived ? '12px 12px 12px 4px' : '12px 12px 4px 12px',
                          padding: '10px 14px',
                          maxWidth: '85%',
                          border: isReceived ? 'none' : '1px solid rgba(0, 74, 173, 0.3)'
                        }}>
                          <p style={{ 
                            fontSize: '14px', 
                            lineHeight: '1.5', 
                            color: c('text'),
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
                            color: c('muted')
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
                <p style={{ textAlign: 'center', color: c('muted'), padding: '20px' }}>
                  {locale === 'fr' ? 'Aucun SMS envoyé' : 'No SMS sent'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Pipeline */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', fontWeight: '500', color: c('muted') }}>
          {t('status')}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {statusOptions.map((option) => {
            const isActive = prospectData.status === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                data-testid={`status-${option.value}`}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: isActive ? 'none' : `1px solid ${c('border')}`,
                  background: isActive ? option.color : 'transparent',
                  color: isActive ? 'white' : c('text'),
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Next scheduled task */}
      {prospectData.next_task_title && (
        <div style={{ 
          marginBottom: '24px', 
          padding: '16px',
          background: c('cardBg'),
          border: `1px solid ${c('accent')}`,
          borderRadius: '12px'
        }}>
          <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: c('muted') }}>
            {t('nextScheduledTask')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} style={{ color: c('accent') }} />
            <span style={{ color: c('text'), fontWeight: '500' }}>
              {prospectData.next_task_title}
            </span>
          </div>
          {prospectData.next_task_date && (
            <div style={{ marginTop: '4px', marginLeft: '24px', fontSize: '13px', color: c('muted') }}>
              {formatDate(new Date(prospectData.next_task_date))}
            </div>
          )}
        </div>
      )}

      {/* Tasks section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '500', color: c('muted') }}>{t('tasks')}</h3>
        </div>

        {/* Task list */}
        {tasks.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '20px', color: c('muted') }}>
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
                    color: c('text'),
                    textDecoration: task.completed ? 'line-through' : 'none'
                  }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: '12px', color: c('muted') }}>
                    {new Date(task.due_date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline / History section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px', fontSize: '13px', fontWeight: '500', color: c('muted') }}>
          {locale === 'fr' ? 'Historique' : 'History'}
        </h3>
        <div style={{ position: 'relative', paddingLeft: '20px' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute',
            left: '6px',
            top: '8px',
            bottom: '8px',
            width: '2px',
            background: 'var(--border)'
          }} />
          
          {/* Generate timeline events from tasks and SMS */}
          {(() => {
            const events = [];
            
            // Add tasks to timeline
            tasks.forEach(task => {
              events.push({
                type: task.completed ? 'task_completed' : 'task_created',
                date: new Date(task.completed ? task.completed_at || task.due_date : task.created_at || task.due_date),
                title: task.title,
                icon: task.completed ? '✓' : '○',
                color: task.completed ? 'var(--success)' : 'var(--muted)'
              });
            });
            
            // Add SMS to timeline
            if (prospectData.sms_history) {
              prospectData.sms_history.forEach(sms => {
                events.push({
                  type: sms.type === 'received' ? 'sms_received' : 'sms_sent',
                  date: new Date(sms.sent_at || sms.received_at || Date.now()),
                  title: sms.type === 'received' 
                    ? (locale === 'fr' ? 'SMS reçu' : 'SMS received')
                    : (locale === 'fr' ? 'SMS envoyé' : 'SMS sent'),
                  preview: sms.message?.substring(0, 50) + (sms.message?.length > 50 ? '...' : ''),
                  icon: '💬',
                  color: sms.type === 'received' ? 'var(--accent)' : 'var(--success)'
                });
              });
            }
            
            // Add creation event
            if (prospectData.created_at) {
              events.push({
                type: 'created',
                date: new Date(prospectData.created_at),
                title: locale === 'fr' ? 'Prospect créé' : 'Prospect created',
                icon: '+',
                color: 'var(--accent)'
              });
            }
            
            // Sort by date descending
            events.sort((a, b) => b.date - a.date);
            
            // Take last 10 events
            const recentEvents = events.slice(0, 10);
            
            if (recentEvents.length === 0) {
              return (
                <p className="text-muted" style={{ textAlign: 'center', padding: '12px' }}>
                  {locale === 'fr' ? 'Aucune activité' : 'No activity'}
                </p>
              );
            }
            
            return recentEvents.map((event, index) => (
              <div key={event.created_at || `event-${index}`} style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '12px',
                marginBottom: '16px',
                position: 'relative'
              }}>
                {/* Timeline dot */}
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: event.color,
                  flexShrink: 0,
                  marginTop: '4px',
                  marginLeft: '-6px',
                  fontSize: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: c('text') }}>
                      {event.title}
                    </span>
                  </div>
                  {event.preview && (
                    <p style={{ fontSize: '12px', color: c('muted'), marginTop: '2px' }}>
                      "{event.preview}"
                    </p>
                  )}
                  <span style={{ fontSize: '11px', color: c('muted') }}>
                    {event.date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { 
                      day: 'numeric', 
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Notes */}
      {prospectData.notes && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px', fontSize: '13px', fontWeight: '500', color: c('muted') }}>{t('notes')}</h3>
          <div className="card" style={{ padding: '16px', background: c('cardBg'), border: `1px solid ${c('border')}`, borderRadius: '12px' }}>
            <p style={{ color: c('text'), whiteSpace: 'pre-wrap' }}>{prospectData.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== LANGUAGE SELECTOR COMPONENT ====================
const SETTINGS_LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

const LanguageSelector = ({ c, locale }) => {
  const { changeLanguage } = useLocale();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const currentLang = SETTINGS_LANGUAGES.find(l => l.code === locale) || SETTINGS_LANGUAGES[0];

  return (
    <div 
      className="settings-row" 
      style={{ cursor: 'pointer', position: 'relative' }}
      data-testid="language-selector"
      onClick={() => setShowLangMenu(!showLangMenu)}
    >
      <Globe size={20} strokeWidth={1.5} style={{ color: c('text') }} />
      <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>
        {locale === 'fr' ? 'Langue' : 'Language'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px', color: c('muted') }}>{currentLang.flag} {currentLang.label}</span>
        <ChevronRight size={20} style={{ color: c('muted'), transform: showLangMenu ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      
      {showLangMenu && (
        <div 
          style={{
            position: 'fixed',
            top: 'auto',
            left: '24px',
            right: '24px',
            marginTop: '4px',
            background: c('cardBg'),
            border: `1px solid ${c('border')}`,
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {SETTINGS_LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { changeLanguage(lang.code); setShowLangMenu(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '14px 16px',
                background: lang.code === locale ? 'rgba(0, 74, 173, 0.1)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: c('text'),
                fontSize: '15px',
                textAlign: 'left',
                transition: 'background 0.2s'
              }}
              data-testid={`lang-option-${lang.code}`}
            >
              <span style={{ fontSize: '20px' }}>{lang.flag}</span>
              <span style={{ flex: 1 }}>{lang.label}</span>
              {lang.code === locale && <Check size={18} style={{ color: c('accent') }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== CURRENCY SELECTOR COMPONENT ====================
const SETTINGS_CURRENCIES = [
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
];

const CurrencySelector = ({ c, locale }) => {
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [currency, setCurrencyState] = useState(() => localStorage.getItem('kolo_currency') || 'EUR');
  const currentCurrency = SETTINGS_CURRENCIES.find(cur => cur.code === currency) || SETTINGS_CURRENCIES[0];

  const handleCurrencyChange = async (newCurrency) => {
    localStorage.setItem('kolo_currency', newCurrency);
    setCurrencyState(newCurrency);
    setShowCurrencyMenu(false);
    
    // Save to backend
    const token = localStorage.getItem('kolo_token');
    if (token) {
      try {
        await fetch(`https://trykolo.io/api/plans/set-currency`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ currency: newCurrency })
        });
      } catch (err) {
        console.error('Failed to save currency:', err);
      }
    }
  };

  return (
    <div 
      className="settings-row" 
      style={{ borderBottom: 'none', cursor: 'pointer', position: 'relative' }}
      data-testid="currency-selector"
      onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
    >
      <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke={c('text')} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="6" x2="12" y2="18"></line>
        <path d="M9 10h6a2 2 0 0 1 0 4H9"></path>
      </svg>
      <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>
        {locale === 'fr' ? 'Devise' : locale === 'de' ? 'Währung' : locale === 'it' ? 'Valuta' : 'Currency'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px', color: c('muted') }}>{currentCurrency.symbol} {currentCurrency.code}</span>
        <ChevronRight size={20} style={{ color: c('muted'), transform: showCurrencyMenu ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      
      {showCurrencyMenu && (
        <div 
          style={{
            position: 'fixed',
            top: 'auto',
            left: '24px',
            right: '24px',
            marginTop: '4px',
            background: c('cardBg'),
            border: `1px solid ${c('border')}`,
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {SETTINGS_CURRENCIES.map(cur => (
            <button
              key={cur.code}
              onClick={() => handleCurrencyChange(cur.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '14px 16px',
                background: cur.code === currency ? 'rgba(0, 74, 173, 0.1)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: c('text'),
                fontSize: '15px',
                textAlign: 'left',
                transition: 'background 0.2s'
              }}
              data-testid={`currency-option-${cur.code}`}
            >
              <span style={{ fontSize: '18px', fontWeight: '600', width: '24px' }}>{cur.symbol}</span>
              <span style={{ flex: 1 }}>{cur.label}</span>
              {cur.code === currency && <Check size={18} style={{ color: c('accent') }} />}
            </button>
          ))}
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
  const { theme, changeTheme } = useTheme();
  const { c } = useThemeColors();
  const { planData } = usePlan();
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
  const [showCancelSubscriptionModal, setShowCancelSubscriptionModal] = useState(false);

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
          await openExternalUrl(data.url, { sameTab: false });
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
    <div style={{ padding: '24px', background: c('bg'), minHeight: '100vh' }}>
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button 
          onClick={onClose}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: c('text'), 
            cursor: 'pointer',
            padding: '8px'
          }}
          data-testid="settings-back"
        >
          <X size={24} strokeWidth={1.5} />
        </button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: c('text') }}>
          {t('settings')}
        </h1>
      </div>

      {/* Profile section */}
      <h3 className="text-caption" style={{ marginBottom: '12px', color: c('muted') }}>
        {t('profile')}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '0 16px', background: c('cardBg'), border: `1px solid ${c('border')}` }}>
        {/* Name row - clickable to edit */}
        <div 
          className="settings-row" 
          onClick={() => {
            setNewName(userName);
            setShowNameModal(true);
          }}
          style={{ cursor: 'pointer', borderBottom: `1px solid ${c('border')}` }}
          data-testid="edit-name"
        >
          <User size={20} strokeWidth={1.5} style={{ color: c('muted') }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '15px', color: c('text') }}>{locale === 'fr' ? 'Nom' : 'Name'}</span>
            <div style={{ fontSize: '12px', marginTop: '2px', color: c('muted') }}>
              {userName || user?.email || (locale === 'fr' ? 'Non configuré' : 'Not configured')}
            </div>
          </div>
          <ChevronRight size={20} style={{ color: c('muted') }} />
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
          <Phone size={20} strokeWidth={1.5} style={{ color: c('muted') }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '15px', color: c('text') }}>{locale === 'fr' ? 'Téléphone' : 'Phone'}</span>
            <div style={{ fontSize: '12px', marginTop: '2px', color: c('muted') }}>
              {userPhone || (locale === 'fr' ? 'Non configuré' : 'Not configured')}
            </div>
          </div>
          <ChevronRight size={20} style={{ color: c('muted') }} />
        </div>
      </div>

      {/* Billing section */}
      <h3 className="text-caption" style={{ marginBottom: '12px', color: c('muted') }}>
        {t('billingPayment')}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '0 16px', background: c('cardBg'), border: `1px solid ${c('border')}` }}>
        <div 
          className="settings-row" 
          data-testid="edit-payment-method"
          onClick={() => handleBillingAction('payment_method')}
          style={{ cursor: 'pointer', borderBottom: `1px solid ${c('border')}` }}
        >
          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke={c('muted')} strokeWidth="1.5">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>{t('editPaymentMethod')}</span>
          <ChevronRight size={20} style={{ color: c('muted') }} />
        </div>
        <div 
          className="settings-row" 
          data-testid="billing-address"
          onClick={() => handleBillingAction('billing_address')}
          style={{ cursor: 'pointer', borderBottom: `1px solid ${c('border')}` }}
        >
          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke={c('muted')} strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>{t('billingAddress')}</span>
          <ChevronRight size={20} style={{ color: c('muted') }} />
        </div>
        <div 
          className="settings-row" 
          data-testid="change-email"
          onClick={() => handleBillingAction('change_email')}
          style={{ cursor: 'pointer', borderBottom: 'none' }}
        >
          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke={c('muted')} strokeWidth="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>{t('changeEmail')}</span>
          <ChevronRight size={20} style={{ color: c('muted') }} />
        </div>
      </div>

      {/* About section */}
      <h3 className="text-caption" style={{ marginBottom: '12px', color: c('muted') }}>
        {t('about')}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '0 16px', background: c('cardBg'), border: `1px solid ${c('border')}` }}>
        {/* Notifications toggle */}
        <div 
          className="settings-row" 
          onClick={handleToggleNotifications}
          style={{ cursor: 'pointer', borderBottom: `1px solid ${c('border')}` }}
          data-testid="notifications-toggle"
        >
          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke={c('muted')} strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>{t('notifications')}</span>
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
                  color: notificationsEnabled ? c('success') : c('muted')
                }}>
                  {notificationsEnabled ? t('notificationsOn') : t('notificationsOff')}
                </span>
                <div style={{
                  width: '44px',
                  height: '26px',
                  borderRadius: '13px',
                  background: notificationsEnabled ? c('accent') : c('surface'),
                  border: `1.5px solid ${c('border')}`,
                  position: 'relative',
                  transition: 'background 0.2s ease'
                }}>
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: c('cardBg'),
                    position: 'absolute',
                    top: '1px',
                    left: notificationsEnabled ? '19px' : '1px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
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
          style={{ cursor: 'pointer', borderBottom: `1px solid ${c('border')}` }}
          data-testid="change-password"
        >
          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke={c('muted')} strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>{t('changePassword')}</span>
          <ChevronRight size={20} style={{ color: c('muted') }} />
        </div>
        {/* Version */}
        <div className="settings-row" style={{ borderBottom: 'none' }}>
          <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>{t('version')}</span>
          <span style={{ color: c('muted') }}>2.0.0</span>
        </div>
      </div>

      {/* Appearance section - Theme toggle */}
      <h3 className="text-caption" style={{ marginBottom: '12px', color: c('muted') }}>
        {locale === 'fr' ? 'Apparence' : 'Appearance'}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '0 16px', background: c('cardBg'), border: `1px solid ${c('border')}` }}>
        <div 
          className="settings-row" 
          style={{ borderBottom: `1px solid ${c('border')}`, cursor: 'pointer' }}
          data-testid="theme-toggle"
          onClick={() => changeTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? (
            <Sun size={20} strokeWidth={1.5} style={{ color: c('text') }} />
          ) : (
            <Moon size={20} strokeWidth={1.5} style={{ color: c('text') }} />
          )}
          <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>
            {locale === 'fr' ? 'Thème' : 'Theme'}
          </span>
          {/* Toggle Switch - Clean design */}
          <div 
            style={{
              width: '52px',
              height: '28px',
              borderRadius: '14px',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' 
                : '#E5E7EB',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: theme === 'dark' 
                ? '0 2px 8px rgba(99, 102, 241, 0.3)' 
                : 'inset 0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: '#ffffff',
              position: 'absolute',
              top: '3px',
              left: theme === 'dark' ? '27px' : '3px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {theme === 'light' ? (
                <Sun size={12} strokeWidth={2.5} style={{ color: '#F59E0B' }} />
              ) : (
                <Moon size={12} strokeWidth={2.5} style={{ color: '#6366F1' }} />
              )}
            </div>
          </div>
        </div>
        {/* Language selector */}
        <LanguageSelector c={c} locale={locale} />
        {/* Currency selector */}
        <CurrencySelector c={c} locale={locale} />
      </div>

      {/* Permissions section */}
      <h3 className="text-caption" style={{ marginBottom: '12px', color: c('muted') }}>
        {locale === 'fr' ? 'Autorisations' : 'Permissions'}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '0 16px', background: c('cardBg'), border: `1px solid ${c('border')}` }}>
        {/* Contacts access */}
        <div 
          className="settings-row" 
          style={{ cursor: 'pointer', borderBottom: 'none' }}
          onClick={() => {
            // Open system settings for contacts permission
            if (navigator.permissions) {
              navigator.permissions.query({ name: 'contacts' }).catch(() => {
                toast.info(locale === 'fr' 
                  ? 'Accédez aux paramètres de votre navigateur pour modifier cette autorisation' 
                  : 'Access your browser settings to change this permission');
              });
            } else {
              toast.info(locale === 'fr' 
                ? 'Accédez aux paramètres de votre navigateur pour modifier cette autorisation' 
                : 'Access your browser settings to change this permission');
            }
          }}
          data-testid="contacts-permission"
        >
          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke={c('muted')} strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>
            {locale === 'fr' ? 'Accès aux contacts' : 'Contacts access'}
          </span>
          <ChevronRight size={20} style={{ color: c('muted') }} />
        </div>
      </div>

      {/* Contact us section */}
      <h3 className="text-caption" style={{ marginBottom: '12px', color: c('muted') }}>
        {locale === 'fr' ? 'Support' : 'Support'}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '0 16px', background: c('cardBg'), border: `1px solid ${c('border')}` }}>
        <div 
          className="settings-row" 
          style={{ cursor: 'pointer', borderBottom: 'none' }}
          onClick={() => {
            window.location.href = 'mailto:contact@trykolo.io?subject=Contact%20KOLO%20Support';
          }}
          data-testid="contact-us"
        >
          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke={c('muted')} strokeWidth="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span style={{ flex: 1, fontSize: '15px', color: c('text') }}>
            {locale === 'fr' ? 'Nous contacter' : 'Contact us'}
          </span>
          <ChevronRight size={20} style={{ color: c('muted') }} />
        </div>
      </div>

      {/* My Plan section */}
      <h3 className="text-caption" style={{ marginBottom: '12px', color: c('muted') }}>
        {locale === 'fr' ? 'Mon abonnement' : locale === 'de' ? 'Mein Abo' : locale === 'it' ? 'Il mio abbonamento' : 'My subscription'}
      </h3>
      <div className="card" style={{ marginBottom: '24px', padding: '16px', background: c('cardBg'), border: `1px solid ${c('border')}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', color: c('muted'), marginBottom: '4px' }}>
              {locale === 'fr' ? 'Plan actuel' : 'Current plan'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: c('text') }}>
              {planData?.effective_plan === 'pro_plus' ? 'PRO+' : 
               planData?.effective_plan === 'pro' ? 'PRO' : 
               locale === 'fr' ? 'Starter' : 'Starter'}
            </div>
          </div>
          <div style={{
            padding: '6px 12px',
            background: 'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(147,51,234,0.15))',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#6C63FF'
          }}>
            {locale === 'fr' ? 'Actif' : 'Active'}
          </div>
        </div>
        <button
          onClick={() => navigate('/pricing')}
          style={{
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(135deg, #4F46E5, #9333EA)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          data-testid="upgrade-plan-btn"
        >
          <Crown size={16} />
          {locale === 'fr' ? 'Voir les plans' : locale === 'de' ? 'Pläne ansehen' : locale === 'it' ? 'Vedi i piani' : 'View plans'}
        </button>
      </div>

      {/* Logout button */}
      <button 
        onClick={handleLogout}
        data-testid="logout-button"
        style={{ 
          marginTop: '16px',
          width: '100%',
          padding: '14px 24px',
          background: c('surface'),
          border: `1.5px solid ${c('border')}`,
          borderRadius: '999px',
          color: c('text'),
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
      >
        <LogOut size={16} strokeWidth={1.5} />
        {t('logout')}
      </button>

      {/* Cancel subscription button */}
      <button 
        onClick={() => setShowCancelSubscriptionModal(true)}
        style={{ 
          background: 'none', 
          border: 'none', 
          color: '#DC2626', 
          fontSize: '14px', 
          cursor: 'pointer',
          marginTop: '16px',
          padding: '8px 0',
          width: '100%',
          textAlign: 'center'
        }}
        data-testid="cancel-subscription-final"
      >
        {locale === 'fr' ? 'Resilier l\'abonnement' : 'Cancel subscription'}
      </button>

      {/* Cancel Subscription Modal */}
      {showCancelSubscriptionModal && (
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
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowCancelSubscriptionModal(false)}
        >
          <div 
            style={{
              background: c('bg'),
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '340px',
              textAlign: 'center',
              border: `1px solid ${c('border')}`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: c('text'), marginBottom: '12px' }}>
              {locale === 'fr' ? 'Resilier l\'abonnement ?' : 'Cancel subscription?'}
            </h3>
            <p style={{ fontSize: '14px', color: c('muted'), marginBottom: '24px', lineHeight: '1.5' }}>
              {locale === 'fr' 
                ? 'Vous perdrez l\'acces a KOLO a la fin de votre periode en cours. Cette action est irreversible.'
                : 'You will lose access to KOLO at the end of your current period. This action is irreversible.'}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowCancelSubscriptionModal(false)}
                style={{ 
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
                  border: 'none',
                  borderRadius: '999px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {locale === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button 
                onClick={async () => {
                  try {
                    await handleCancelSubscription();
                    setShowCancelSubscriptionModal(false);
                  } catch (e) { }
                }}
                style={{ 
                  flex: 1,
                  padding: '12px',
                  background: c('surface'),
                  border: `1px solid #DC2626`,
                  borderRadius: '999px',
                  color: '#DC2626',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {locale === 'fr' ? 'Confirmer' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              background: c('bg'),
              borderRadius: '20px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              border: `1px solid ${c('border')}`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: c('text') }}>{t('changePassword')}</h2>
              <button
                onClick={handleChangePassword}
                disabled={!currentPassword || !newPassword || !confirmPassword || passwordLoading}
                style={{ 
                  width: 'auto', 
                  height: '40px', 
                  padding: '0 20px',
                  fontSize: '15px',
                  background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
                  border: 'none',
                  borderRadius: '999px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: (!currentPassword || !newPassword || !confirmPassword || passwordLoading) ? 'not-allowed' : 'pointer',
                  opacity: (!currentPassword || !newPassword || !confirmPassword || passwordLoading) ? 0.5 : 1
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
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: c('muted') }}>
                  {t('currentPassword')}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="current-password-input"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: c('surface'),
                    border: `1px solid ${c('border')}`,
                    borderRadius: '10px',
                    color: c('text'),
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: c('muted') }}>
                  {t('newPassword')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="new-password-input"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: c('surface'),
                    border: `1px solid ${c('border')}`,
                    borderRadius: '10px',
                    color: c('text'),
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: c('muted') }}>
                  {t('confirmNewPassword')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="confirm-password-input"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: c('surface'),
                    border: `1px solid ${c('border')}`,
                    borderRadius: '10px',
                    color: c('text'),
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
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
              background: c('bg'),
              borderRadius: '20px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              border: `1px solid ${c('border')}`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: c('text') }}>
                {locale === 'fr' ? 'Téléphone' : 'Phone'}
              </h2>
              <button
                onClick={handleUpdatePhone}
                disabled={!newPhone || newPhone.length < 6 || phoneLoading}
                style={{ 
                  width: 'auto', 
                  height: '40px', 
                  padding: '0 20px',
                  fontSize: '15px',
                  background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
                  border: 'none',
                  borderRadius: '999px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: (!newPhone || newPhone.length < 6 || phoneLoading) ? 'not-allowed' : 'pointer',
                  opacity: (!newPhone || newPhone.length < 6 || phoneLoading) ? 0.5 : 1
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
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: c('muted') }}>
                  {locale === 'fr' ? 'Numéro avec indicatif pays' : 'Number with country code'}
                </label>
                <input
                  type="tel"
                  placeholder={locale === 'fr' ? 'Ex: +33 6 12 34 56 78' : 'E.g. +33 6 12 34 56 78'}
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  data-testid="phone-input-modal"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: c('surface'),
                    border: `1px solid ${c('border')}`,
                    borderRadius: '10px',
                    color: c('text'),
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <p style={{ fontSize: '12px', color: c('muted'), lineHeight: '1.5' }}>
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
              background: c('bg'),
              borderRadius: '20px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              border: `1px solid ${c('border')}`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: c('text') }}>
                {locale === 'fr' ? 'Nom' : 'Name'}
              </h2>
              <button
                onClick={handleUpdateName}
                disabled={!newName || newName.trim().length < 2 || nameLoading}
                style={{ 
                  width: 'auto', 
                  height: '40px', 
                  padding: '0 20px',
                  fontSize: '15px',
                  background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
                  border: 'none',
                  borderRadius: '999px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: (!newName || newName.trim().length < 2 || nameLoading) ? 'not-allowed' : 'pointer',
                  opacity: (!newName || newName.trim().length < 2 || nameLoading) ? 0.5 : 1
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
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: c('muted') }}>
                  {locale === 'fr' ? 'Prénom et Nom' : 'Full Name'}
                </label>
                <input
                  type="text"
                  placeholder={locale === 'fr' ? 'Ex: Jean Dupont' : 'E.g. John Smith'}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid="name-input-modal"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: c('surface'),
                    border: `1px solid ${c('border')}`,
                    borderRadius: '10px',
                    color: c('text'),
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <p style={{ fontSize: '12px', color: c('muted'), lineHeight: '1.5' }}>
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
                      const days = locale === 'fr' 
                        ? ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
                        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
                    key={suggestion.task_id || suggestion.prospect_id || `ai-suggestion-${index}`}
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

// ==================== QUICK ADD PROSPECT MODAL ====================
const QuickAddProspectModal = ({ onClose, onSuccess }) => {
  const { t, locale } = useLocale();
  const { c, isDark } = useThemeColors();
  const [mode, setMode] = useState('manual'); // 'manual' or 'import'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const isFormValid = name.trim() && phone.trim() && email.trim() && notes.trim();

  const handleImportFromContacts = async () => {
    // Use the contact picker service for cross-platform support
    const { contactPicker } = await import('../services/contactPicker');
    
    if (!contactPicker.isSupported()) {
      toast.info(contactPicker.getNotSupportedReason(locale));
      return;
    }
    
    try {
      const contact = await contactPicker.pickContact();
      
      if (contact) {
        if (contact.name) setName(contact.name);
        if (contact.phone) setPhone(contact.phone);
        if (contact.email) setEmail(contact.email);
        setMode('manual'); // Switch to manual to complete the form
        toast.success(locale === 'fr' ? 'Contact importé !' : 'Contact imported!');
      }
    } catch (err) {
      console.error('Contact picker error:', err);
      toast.error(locale === 'fr' 
        ? 'Impossible d\'accéder aux contacts. Vérifiez les autorisations.' 
        : 'Unable to access contacts. Check permissions.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    setCreating(true);
    try {
      const response = await authFetch(`${API_URL}/api/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          source: 'manual',
          status: 'nouveau',
          notes: notes.trim()
        })
      });

      if (response.ok) {
        if ('vibrate' in navigator) navigator.vibrate([10, 40, 20]);
        trackProspectCreated();
        toast.success(locale === 'fr' ? 'Prospect ajouté !' : 'Prospect added!');
        onSuccess();
      } else {
        toast.error(locale === 'fr' ? 'Erreur' : 'Error');
      }
    } catch (error) {
      toast.error(locale === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center'
    }} onClick={onClose}>
      <div 
        style={{
          background: c('bg'),
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: '430px',
          padding: '20px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          width: '40px', 
          height: '4px', 
          background: c('border'), 
          borderRadius: '2px', 
          margin: '0 auto 16px' 
        }} />
        
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', textAlign: 'center', color: c('text') }}>
          {locale === 'fr' ? 'Nouveau prospect' : 'New prospect'}
        </h3>
        
        {/* Import from contacts button */}
        <button
          onClick={handleImportFromContacts}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)',
            border: 'none',
            borderRadius: '999px',
            color: 'white',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}
          data-testid="import-contacts-btn"
        >
          <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          {locale === 'fr' ? 'Importer depuis mes contacts' : 'Import from my contacts'}
        </button>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          marginBottom: '16px' 
        }}>
          <div style={{ flex: 1, height: '1px', background: c('border') }}></div>
          <span style={{ fontSize: '13px', color: c('muted') }}>
            {locale === 'fr' ? 'ou saisie manuelle' : 'or manual entry'}
          </span>
          <div style={{ flex: 1, height: '1px', background: c('border') }}></div>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* Nom complet */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '13px', 
              color: c('muted'), 
              marginBottom: '8px', 
              display: 'block',
              fontWeight: '500'
            }}>
              {locale === 'fr' ? 'Nom complet' : 'Full name'} *
            </label>
            <input
              type="text"
              placeholder={locale === 'fr' ? 'Jean Dupont' : 'John Doe'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              data-testid="quick-prospect-name"
              style={{
                width: '100%',
                padding: '14px 16px',
                background: c('surface'),
                border: `1px solid ${c('border')}`,
                borderRadius: '10px',
                color: c('text'),
                fontSize: '15px',
                height: '52px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          {/* Téléphone */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '13px', 
              color: c('muted'), 
              marginBottom: '8px', 
              display: 'block',
              fontWeight: '500'
            }}>
              {locale === 'fr' ? 'Téléphone' : 'Phone'} *
            </label>
            <input
              type="tel"
              placeholder="+33 6 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="quick-prospect-phone"
              style={{
                width: '100%',
                padding: '14px 16px',
                background: c('surface'),
                border: `1px solid ${c('border')}`,
                borderRadius: '10px',
                color: c('text'),
                fontSize: '15px',
                height: '52px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '13px', 
              color: c('muted'), 
              marginBottom: '8px', 
              display: 'block',
              fontWeight: '500'
            }}>
              Email *
            </label>
            <input
              type="email"
              placeholder="jean.dupont@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="quick-prospect-email"
              style={{
                width: '100%',
                padding: '14px 16px',
                background: c('surface'),
                border: `1px solid ${c('border')}`,
                borderRadius: '10px',
                color: c('text'),
                fontSize: '15px',
                height: '52px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Description du projet */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '13px', 
              color: c('muted'), 
              marginBottom: '8px', 
              display: 'block',
              fontWeight: '500'
            }}>
              {locale === 'fr' ? 'Description du projet' : 'Project description'} *
            </label>
            <textarea
              placeholder={locale === 'fr' 
                ? 'Type de bien, budget, délai, besoins spécifiques...' 
                : 'Property type, budget, timeline, specific needs...'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="quick-prospect-notes"
              rows={3}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: c('surface'),
                border: `1px solid ${c('border')}`,
                borderRadius: '10px',
                color: c('text'),
                fontSize: '15px',
                resize: 'none'
              }}
            />
          </div>
          
          <button
            type="submit"
            disabled={!isFormValid || creating}
            data-testid="quick-prospect-submit"
            style={{
              width: '100%',
              padding: '14px',
              background: (isFormValid && !creating) 
                ? 'linear-gradient(90deg, #004AAD 0%, #CB6CE6 100%)' 
                : c('surface'),
              border: 'none',
              borderRadius: '999px',
              color: (isFormValid && !creating) ? 'white' : c('muted'),
              fontSize: '16px',
              fontWeight: '600',
              cursor: (isFormValid && !creating) ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {creating ? (
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              locale === 'fr' ? 'Ajouter' : 'Add'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// ==================== BOTTOM NAVIGATION ====================
const BottomNav = ({ activeTab, setActiveTab, onAddProspect }) => {
  const { locale } = useLocale();
  const { c, isDark } = useThemeColors();
  const labels = UI_LABELS[locale] || UI_LABELS.en;
  
  return (
    <>
      {/* SVG gradient definition */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="navGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#004aad"/>
            <stop offset="100%" stopColor="#cb6ce6"/>
          </linearGradient>
        </defs>
      </svg>
      
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        background: isDark ? 'rgba(15,13,26,0.92)' : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: isDark ? '1px solid rgba(240,238,248,0.08)' : '1px solid rgba(14,11,30,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '10px 20px 18px',
        zIndex: 100
      }}>
        
        {/* Today Tab */}
        <button 
          onClick={() => setActiveTab('today')}
          data-testid="nav-today"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            flex: 1,
            border: 'none',
            background: 'none',
            padding: 0
          }}
        >
          <svg 
            viewBox="0 0 24 24" 
            style={{ 
              width: '22px', 
              height: '22px', 
              strokeWidth: 2, 
              fill: 'none',
              stroke: activeTab === 'today' ? 'url(#navGrad)' : '#8A849E'
            }}
          >
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: '600', 
            fontFamily: "'League Spartan', sans-serif",
            letterSpacing: '0.02em',
            color: activeTab === 'today' ? '#004aad' : '#8A849E'
          }}>
            {labels.today}
          </span>
        </button>
        
        {/* Central Add Button */}
        <button
          onClick={() => {
            if ('vibrate' in navigator) navigator.vibrate(8);
            onAddProspect();
          }}
          data-testid="fab-add-prospect"
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(90deg, #004aad, #cb6ce6)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginBottom: '4px',
            boxShadow: '0 4px 20px rgba(0,74,173,0.3)'
          }}
        >
          <svg 
            viewBox="0 0 24 24" 
            style={{ 
              width: '22px', 
              height: '22px', 
              stroke: '#fff', 
              strokeWidth: 2.5, 
              fill: 'none' 
            }}
          >
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        
        {/* Prospects Tab */}
        <button 
          onClick={() => setActiveTab('prospects')}
          data-testid="nav-prospects"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            flex: 1,
            border: 'none',
            background: 'none',
            padding: 0
          }}
        >
          <svg 
            viewBox="0 0 24 24" 
            style={{ 
              width: '22px', 
              height: '22px', 
              strokeWidth: 2, 
              fill: 'none',
              stroke: activeTab === 'prospects' ? 'url(#navGrad)' : '#8A849E'
            }}
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: '600', 
            fontFamily: "'League Spartan', sans-serif",
            letterSpacing: '0.02em',
            color: activeTab === 'prospects' ? '#004aad' : '#8A849E'
          }}>
            Prospects
          </span>
        </button>
      </nav>
    </>
  );
};

// ==================== MAIN APP SHELL ====================
const AppShell = () => {
  const location = useLocation();
  const { theme, changeTheme, initializeFromUser } = useTheme();
  const { fetchPlanData, planData, checkFeature } = usePlan();
  const { locale } = useLocale();
  const [activeTab, setActiveTab] = useState('today');
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userStreak, setUserStreak] = useState(0);
  const [userPrefsLoaded, setUserPrefsLoaded] = useState(false);
  const [userName, setUserName] = useState('');
  const [showAddProspectSheet, setShowAddProspectSheet] = useState(false);
  const [welcomeProPlan, setWelcomeProPlan] = useState(null);

  // Load user preferences on mount
  useEffect(() => {
    const loadUserPrefs = async () => {
      try {
        const token = localStorage.getItem('kolo_token');
        
        // Check for payment success redirect
        const urlParams = new URLSearchParams(window.location.search);
        const upgradeSuccess = urlParams.get('upgrade');
        const trialStarted = urlParams.get('trial_started');
        
        if (upgradeSuccess === 'success' && token) {
          const urlPlan = urlParams.get('plan');
          // Sync subscription status after payment
          try {
            const syncResponse = await fetch(`${API_URL}/api/plans/sync`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            let activePlan = null;
            if (syncResponse.ok) {
              const syncData = await syncResponse.json();
              if (syncData.synced && syncData.plan && syncData.plan !== 'free') {
                activePlan = syncData.plan;
              }
            }
            // Fallback: use plan from URL param (si le webhook n'a pas encore mis à jour la DB)
            if (!activePlan && (urlPlan === 'pro' || urlPlan === 'pro_plus')) {
              activePlan = urlPlan;
            }
            if (activePlan) {
              setWelcomeProPlan(activePlan);
            }
            
            // Clean URL
            window.history.replaceState({}, document.title, '/app');
          } catch (syncError) {
            console.error('Failed to sync subscription:', syncError);
            if (urlPlan === 'pro' || urlPlan === 'pro_plus') {
              setWelcomeProPlan(urlPlan);
            }
          }
        }
        
        if (trialStarted === 'true') {
          toast.success(
            locale === 'fr' ? 'Votre essai gratuit de 14 jours a commencé ! 🎉' :
            locale === 'de' ? 'Ihre 14-tägige Testphase hat begonnen! 🎉' :
            locale === 'it' ? 'La tua prova gratuita di 14 giorni è iniziata! 🎉' :
            'Your 14-day free trial has started! 🎉'
          );
          window.history.replaceState({}, document.title, '/app');
        }
        
        const response = await authFetch(`${API_URL}/api/auth/me`);
        if (response.ok) {
          const userData = await response.json();
          // Initialize theme from user preference
          if (userData.theme_preference) {
            initializeFromUser(userData.theme_preference);
          }
          // Check if onboarding needed
          if (!userData.didacticiel_completed) {
            setShowOnboarding(true);
          }
          // Set streak
          setUserStreak(userData.streak_current || 0);
          // Set user name for initials
          setUserName(userData.full_name || '');
          
          // Fetch plan data and wait for it
          if (token) {
            await fetchPlanData(token);
          }
        }
      } catch (e) {
        console.error('Failed to load user preferences:', e);
      }
      setUserPrefsLoaded(true);
    };
    loadUserPrefs();
  }, [initializeFromUser, fetchPlanData, locale]);

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
  const [showAddProspectModal, setShowAddProspectModal] = useState(false);

  // Handle FAB click to add prospect
  const handleAddProspectFromFab = () => {
    setShowAddProspectModal(true);
  };

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
        return <TodayTab key={refreshKey} onOpenProfile={() => setShowSettings(true)} onSelectProspect={handleSelectProspect} userName={userName} />;
    }
  };

  return (
    <div className={`mobile-frame theme-${theme}`} style={{ backgroundColor: 'var(--bg)' }}>
      {/* Onboarding Flow */}
      {showOnboarding && (
        <OnboardingFlow 
          onComplete={() => setShowOnboarding(false)} 
          authFetch={authFetch}
        />
      )}
      
      <div className="page-container safe-area-top" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="scroll-content" style={{ paddingBottom: '80px', backgroundColor: 'var(--bg)' }}>
          {renderTab()}
        </div>
        {!selectedProspect && !showSettings && <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onAddProspect={() => setShowAddProspectSheet(true)} />}
      </div>
      
      {/* Add Prospect Sheet (2-step flow) */}
      <AddProspectSheet
        isOpen={showAddProspectSheet}
        onClose={() => setShowAddProspectSheet(false)}
        onSuccess={() => {
          setShowAddProspectSheet(false);
          setRefreshKey(prev => prev + 1);
        }}
      />
      
      {/* Notification Permission Prompt */}
      {showNotificationPrompt && (
        <NotificationPrompt onClose={() => setShowNotificationPrompt(false)} />
      )}

      {/* Welcome PRO/PRO+ Onboarding (après checkout Stripe réussi) */}
      {welcomeProPlan && (
        <WelcomePROOnboarding
          plan={welcomeProPlan}
          onClose={() => setWelcomeProPlan(null)}
        />
      )}
    </div>
  );
};

export default AppShell;
