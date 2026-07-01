// =============================================================
// KOLO v2 — i18n catalog (FR/EN/DE/IT/ES)
// Usage: v2t('home.hello_evening', { name: 'Elliot' })
// Falls back to French if the key is missing in the current locale.
// =============================================================

const STRINGS = {
  fr: {
    // Common
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.close': 'Fermer',
    'common.delete': 'Supprimer',
    'common.confirm': 'Confirmer',
    'common.next': 'Suivant',
    'common.back': 'Retour',
    'common.search': 'Rechercher',
    'common.loading': 'Chargement…',
    'common.error': 'Erreur',
    'common.retry': 'Réessayer',
    'common.yes': 'Oui',
    'common.no': 'Non',
    'common.today': "Aujourd'hui",
    'common.optional': 'facultatif',

    // Greetings
    'home.hello_morning': 'Bonjour {name}',
    'home.hello_afternoon': 'Bon après-midi {name}',
    'home.hello_evening': 'Bonsoir {name}',
    'home.subtitle': 'Ton copilote KOLO t\'écoute',
    'home.reminders_today': 'Rappels aujourd\'hui',
    'home.notes_month': 'Notes ce mois',
    'home.tap_to_talk': 'Touche pour parler à KOLO',

    // Auth
    'auth.title': 'Bienvenue',
    'auth.email': 'Adresse email',
    'auth.email_placeholder': 'ton.email@agence.com',
    'auth.send_code': 'Recevoir un code',
    'auth.code_sent': 'Code envoyé — vérifie ta boîte',
    'auth.enter_code': 'Code reçu par email',
    'auth.verify': 'Valider',
    'auth.first_name': 'Prénom',
    'auth.last_name': 'Nom',
    'auth.company': 'Agence',
    'auth.terms': 'En continuant, tu acceptes les CGU et la Politique de confidentialité.',

    // Onboarding
    'onb.title': 'Configurons ton KOLO',
    'onb.language.title': 'Choisis ta langue',
    'onb.language.desc': 'Toute l\'app s\'adaptera à ta langue préférée.',
    'onb.role.title': 'Ton rôle',
    'onb.role.independent': 'Agent indépendant',
    'onb.role.agency': 'Agent en agence',
    'onb.role.manager': 'Directeur / Manager',
    'onb.activity.title': 'Ton activité principale',
    'onb.activity.transaction': 'Transaction',
    'onb.activity.rental': 'Location',
    'onb.activity.both': 'Les deux',
    'onb.sectors.title': 'Tes secteurs',
    'onb.sectors.hint': 'Ajoute les codes postaux ou villes que tu couvres.',
    'onb.crm.title': 'Ton CRM actuel',
    'onb.finish': 'Terminer',

    // Bottom nav
    'nav.home': 'Accueil',
    'nav.cases': 'Dossiers',
    'nav.contacts': 'Contacts',
    'nav.agenda': 'Agenda',

    // Prospecting / Pige
    'pige.title': 'Prospection',
    'pige.dpe': 'DPE (ADEME)',
    'pige.ads': 'Annonces',
    'pige.sectors_label': 'Secteurs (codes postaux ou villes)',
    'pige.sectors_placeholder': 'Ajouter un code postal (ex. 75001, 75002, Lyon 3)',
    'pige.sectors_hint': 'Sépare plusieurs codes par une virgule, ou touche + pour les empiler.',
    'pige.search': 'Rechercher',
    'pige.searching': 'Recherche…',
    'pige.add_sector_first': 'Ajoute au moins un secteur',
    'pige.results_hint': 'Empile un ou plusieurs secteurs — par ex. 75001, 75002, Lyon 3 — puis touche Rechercher.',
    'pige.dpe_open': 'Voir la fiche DPE',
    'pige.to_case': 'Dossier',
    'pige.no_results': 'Aucun résultat pour cette zone.',
    'pige.scraping': 'Analyse en cours — récupération des annonces en arrière-plan.',

    // Modals
    'modal.new_case': 'Nouveau dossier',
    'modal.new_contact': 'Nouveau contact',
    'modal.new_reminder': 'Nouveau rappel',
    'modal.new_note': 'Nouvelle note',
    'modal.speak_to_kolo': 'Parler à KOLO',
    'chat.placeholder': 'Écris ou parle à KOLO…',
    'chat.send': 'Envoyer',

    // Settings
    'settings.title': 'Réglages',
    'settings.profile': 'Profil',
    'settings.language': 'Langue',
    'settings.notifications': 'Notifications',
    'settings.subscription': 'Abonnement',
    'settings.logout': 'Se déconnecter',
    'settings.legal': 'Mentions légales',
  },

  en: {
    'common.save': 'Save', 'common.cancel': 'Cancel', 'common.close': 'Close', 'common.delete': 'Delete',
    'common.confirm': 'Confirm', 'common.next': 'Next', 'common.back': 'Back', 'common.search': 'Search',
    'common.loading': 'Loading…', 'common.error': 'Error', 'common.retry': 'Try again',
    'common.yes': 'Yes', 'common.no': 'No', 'common.today': 'Today', 'common.optional': 'optional',

    'home.hello_morning': 'Good morning {name}',
    'home.hello_afternoon': 'Good afternoon {name}',
    'home.hello_evening': 'Good evening {name}',
    'home.subtitle': 'Your KOLO copilot is listening',
    'home.reminders_today': 'Reminders today',
    'home.notes_month': 'Notes this month',
    'home.tap_to_talk': 'Tap to talk to KOLO',

    'auth.title': 'Welcome',
    'auth.email': 'Email address',
    'auth.email_placeholder': 'you@agency.com',
    'auth.send_code': 'Get a code',
    'auth.code_sent': 'Code sent — check your inbox',
    'auth.enter_code': 'Code received by email',
    'auth.verify': 'Verify',
    'auth.first_name': 'First name',
    'auth.last_name': 'Last name',
    'auth.company': 'Agency',
    'auth.terms': 'By continuing you accept the Terms and Privacy Policy.',

    'onb.title': 'Set up your KOLO',
    'onb.language.title': 'Choose your language',
    'onb.language.desc': 'The whole app will adapt to your preferred language.',
    'onb.role.title': 'Your role',
    'onb.role.independent': 'Independent agent',
    'onb.role.agency': 'Agency agent',
    'onb.role.manager': 'Director / Manager',
    'onb.activity.title': 'Your main activity',
    'onb.activity.transaction': 'Sales',
    'onb.activity.rental': 'Rentals',
    'onb.activity.both': 'Both',
    'onb.sectors.title': 'Your sectors',
    'onb.sectors.hint': 'Add postal codes or cities you cover.',
    'onb.crm.title': 'Your current CRM',
    'onb.finish': 'Finish',

    'nav.home': 'Home', 'nav.cases': 'Cases', 'nav.contacts': 'Contacts', 'nav.agenda': 'Calendar',

    'pige.title': 'Prospecting',
    'pige.dpe': 'EPC (ADEME)',
    'pige.ads': 'Listings',
    'pige.sectors_label': 'Sectors (postal codes or cities)',
    'pige.sectors_placeholder': 'Add a postal code (e.g. 75001, 75002)',
    'pige.sectors_hint': 'Separate multiple codes with a comma, or tap + to stack them.',
    'pige.search': 'Search',
    'pige.searching': 'Searching…',
    'pige.add_sector_first': 'Add at least one sector',
    'pige.results_hint': 'Stack one or more sectors — e.g. 75001, 75002 — then tap Search.',
    'pige.dpe_open': 'View EPC record',
    'pige.to_case': 'Case',
    'pige.no_results': 'No results for this area.',
    'pige.scraping': 'Analysis in progress — fetching listings in the background.',

    'modal.new_case': 'New case', 'modal.new_contact': 'New contact',
    'modal.new_reminder': 'New reminder', 'modal.new_note': 'New note',
    'modal.speak_to_kolo': 'Talk to KOLO',
    'chat.placeholder': 'Type or talk to KOLO…', 'chat.send': 'Send',

    'settings.title': 'Settings', 'settings.profile': 'Profile', 'settings.language': 'Language',
    'settings.notifications': 'Notifications', 'settings.subscription': 'Subscription',
    'settings.logout': 'Log out', 'settings.legal': 'Legal',
  },

  it: {
    'common.save': 'Salva', 'common.cancel': 'Annulla', 'common.close': 'Chiudi', 'common.delete': 'Elimina',
    'common.confirm': 'Conferma', 'common.next': 'Avanti', 'common.back': 'Indietro', 'common.search': 'Cerca',
    'common.loading': 'Caricamento…', 'common.error': 'Errore', 'common.retry': 'Riprova',
    'common.yes': 'Sì', 'common.no': 'No', 'common.today': 'Oggi', 'common.optional': 'facoltativo',

    'home.hello_morning': 'Buongiorno {name}',
    'home.hello_afternoon': 'Buon pomeriggio {name}',
    'home.hello_evening': 'Buonasera {name}',
    'home.subtitle': 'Il tuo copilota KOLO ti ascolta',
    'home.reminders_today': 'Promemoria di oggi',
    'home.notes_month': 'Note questo mese',
    'home.tap_to_talk': 'Tocca per parlare con KOLO',

    'auth.title': 'Benvenuto',
    'auth.email': 'Indirizzo email',
    'auth.email_placeholder': 'tu@agenzia.com',
    'auth.send_code': 'Ricevi un codice',
    'auth.code_sent': 'Codice inviato — controlla la tua email',
    'auth.enter_code': 'Codice ricevuto via email',
    'auth.verify': 'Verifica',
    'auth.first_name': 'Nome',
    'auth.last_name': 'Cognome',
    'auth.company': 'Agenzia',
    'auth.terms': 'Continuando accetti i Termini e la Privacy Policy.',

    'onb.title': 'Configuriamo il tuo KOLO',
    'onb.language.title': 'Scegli la tua lingua',
    'onb.language.desc': 'L\'intera app si adatterà alla tua lingua preferita.',
    'onb.role.title': 'Il tuo ruolo',
    'onb.role.independent': 'Agente indipendente',
    'onb.role.agency': 'Agente in agenzia',
    'onb.role.manager': 'Direttore / Manager',
    'onb.activity.title': 'La tua attività principale',
    'onb.activity.transaction': 'Vendite',
    'onb.activity.rental': 'Affitti',
    'onb.activity.both': 'Entrambi',
    'onb.sectors.title': 'I tuoi settori',
    'onb.sectors.hint': 'Aggiungi CAP o città che copri.',
    'onb.crm.title': 'Il tuo CRM attuale',
    'onb.finish': 'Termina',

    'nav.home': 'Home', 'nav.cases': 'Pratiche', 'nav.contacts': 'Contatti', 'nav.agenda': 'Agenda',

    'pige.title': 'Prospezione',
    'pige.dpe': 'APE (ADEME)',
    'pige.ads': 'Annunci',
    'pige.sectors_label': 'Settori (CAP o città)',
    'pige.sectors_placeholder': 'Aggiungi un CAP (es. 75001, 75002)',
    'pige.sectors_hint': 'Separa più codici con una virgola, oppure tocca + per accumularli.',
    'pige.search': 'Cerca',
    'pige.searching': 'Ricerca…',
    'pige.add_sector_first': 'Aggiungi almeno un settore',
    'pige.results_hint': 'Impila uno o più settori — es. 75001, 75002 — poi tocca Cerca.',
    'pige.dpe_open': 'Vedi la scheda APE',
    'pige.to_case': 'Pratica',
    'pige.no_results': 'Nessun risultato per questa zona.',
    'pige.scraping': 'Analisi in corso — recupero degli annunci in background.',

    'modal.new_case': 'Nuova pratica', 'modal.new_contact': 'Nuovo contatto',
    'modal.new_reminder': 'Nuovo promemoria', 'modal.new_note': 'Nuova nota',
    'modal.speak_to_kolo': 'Parla con KOLO',
    'chat.placeholder': 'Scrivi o parla con KOLO…', 'chat.send': 'Invia',

    'settings.title': 'Impostazioni', 'settings.profile': 'Profilo', 'settings.language': 'Lingua',
    'settings.notifications': 'Notifiche', 'settings.subscription': 'Abbonamento',
    'settings.logout': 'Esci', 'settings.legal': 'Note legali',
  },

  de: {
    'common.save': 'Speichern', 'common.cancel': 'Abbrechen', 'common.close': 'Schließen', 'common.delete': 'Löschen',
    'common.confirm': 'Bestätigen', 'common.next': 'Weiter', 'common.back': 'Zurück', 'common.search': 'Suchen',
    'common.loading': 'Laden…', 'common.error': 'Fehler', 'common.retry': 'Erneut versuchen',
    'common.yes': 'Ja', 'common.no': 'Nein', 'common.today': 'Heute', 'common.optional': 'optional',

    'home.hello_morning': 'Guten Morgen {name}',
    'home.hello_afternoon': 'Guten Tag {name}',
    'home.hello_evening': 'Guten Abend {name}',
    'home.subtitle': 'Dein KOLO-Copilot hört zu',
    'home.reminders_today': 'Erinnerungen heute',
    'home.notes_month': 'Notizen diesen Monat',
    'home.tap_to_talk': 'Tippe, um mit KOLO zu sprechen',

    'auth.title': 'Willkommen',
    'auth.email': 'E-Mail-Adresse',
    'auth.email_placeholder': 'du@agentur.com',
    'auth.send_code': 'Code erhalten',
    'auth.code_sent': 'Code gesendet — prüfe dein Postfach',
    'auth.enter_code': 'Per E-Mail erhaltener Code',
    'auth.verify': 'Bestätigen',
    'auth.first_name': 'Vorname',
    'auth.last_name': 'Nachname',
    'auth.company': 'Agentur',
    'auth.terms': 'Mit dem Fortfahren akzeptierst du die AGB und die Datenschutzerklärung.',

    'onb.title': 'Richte dein KOLO ein',
    'onb.language.title': 'Wähle deine Sprache',
    'onb.language.desc': 'Die gesamte App passt sich deiner bevorzugten Sprache an.',
    'onb.role.title': 'Deine Rolle',
    'onb.role.independent': 'Selbständiger Makler',
    'onb.role.agency': 'Makler in Agentur',
    'onb.role.manager': 'Leitung / Manager',
    'onb.activity.title': 'Deine Haupttätigkeit',
    'onb.activity.transaction': 'Verkauf',
    'onb.activity.rental': 'Vermietung',
    'onb.activity.both': 'Beides',
    'onb.sectors.title': 'Deine Gebiete',
    'onb.sectors.hint': 'Füge PLZ oder Städte hinzu, die du abdeckst.',
    'onb.crm.title': 'Dein aktuelles CRM',
    'onb.finish': 'Fertig',

    'nav.home': 'Start', 'nav.cases': 'Akten', 'nav.contacts': 'Kontakte', 'nav.agenda': 'Kalender',

    'pige.title': 'Akquise',
    'pige.dpe': 'Energieausweis (ADEME)',
    'pige.ads': 'Anzeigen',
    'pige.sectors_label': 'Gebiete (PLZ oder Städte)',
    'pige.sectors_placeholder': 'PLZ hinzufügen (z.B. 75001, 75002)',
    'pige.sectors_hint': 'Trenne mehrere Codes mit Komma, oder tippe + zum Stapeln.',
    'pige.search': 'Suchen',
    'pige.searching': 'Suche…',
    'pige.add_sector_first': 'Füge mindestens ein Gebiet hinzu',
    'pige.results_hint': 'Stapel ein oder mehrere Gebiete — z.B. 75001, 75002 — dann Suchen tippen.',
    'pige.dpe_open': 'Energieausweis ansehen',
    'pige.to_case': 'Akte',
    'pige.no_results': 'Keine Ergebnisse für dieses Gebiet.',
    'pige.scraping': 'Analyse läuft — Anzeigen werden im Hintergrund geladen.',

    'modal.new_case': 'Neue Akte', 'modal.new_contact': 'Neuer Kontakt',
    'modal.new_reminder': 'Neue Erinnerung', 'modal.new_note': 'Neue Notiz',
    'modal.speak_to_kolo': 'Mit KOLO sprechen',
    'chat.placeholder': 'Schreibe oder sprich mit KOLO…', 'chat.send': 'Senden',

    'settings.title': 'Einstellungen', 'settings.profile': 'Profil', 'settings.language': 'Sprache',
    'settings.notifications': 'Benachrichtigungen', 'settings.subscription': 'Abonnement',
    'settings.logout': 'Abmelden', 'settings.legal': 'Rechtliches',
  },

  es: {
    'common.save': 'Guardar', 'common.cancel': 'Cancelar', 'common.close': 'Cerrar', 'common.delete': 'Eliminar',
    'common.confirm': 'Confirmar', 'common.next': 'Siguiente', 'common.back': 'Volver', 'common.search': 'Buscar',
    'common.loading': 'Cargando…', 'common.error': 'Error', 'common.retry': 'Reintentar',
    'common.yes': 'Sí', 'common.no': 'No', 'common.today': 'Hoy', 'common.optional': 'opcional',

    'home.hello_morning': 'Buenos días {name}',
    'home.hello_afternoon': 'Buenas tardes {name}',
    'home.hello_evening': 'Buenas noches {name}',
    'home.subtitle': 'Tu copiloto KOLO te escucha',
    'home.reminders_today': 'Recordatorios hoy',
    'home.notes_month': 'Notas este mes',
    'home.tap_to_talk': 'Toca para hablar con KOLO',

    'auth.title': 'Bienvenido',
    'auth.email': 'Correo electrónico',
    'auth.email_placeholder': 'tu@agencia.com',
    'auth.send_code': 'Recibir un código',
    'auth.code_sent': 'Código enviado — revisa tu bandeja',
    'auth.enter_code': 'Código recibido por email',
    'auth.verify': 'Verificar',
    'auth.first_name': 'Nombre',
    'auth.last_name': 'Apellido',
    'auth.company': 'Agencia',
    'auth.terms': 'Al continuar aceptas los Términos y la Política de privacidad.',

    'onb.title': 'Configuremos tu KOLO',
    'onb.language.title': 'Elige tu idioma',
    'onb.language.desc': 'Toda la app se adaptará a tu idioma preferido.',
    'onb.role.title': 'Tu rol',
    'onb.role.independent': 'Agente independiente',
    'onb.role.agency': 'Agente en agencia',
    'onb.role.manager': 'Director / Manager',
    'onb.activity.title': 'Tu actividad principal',
    'onb.activity.transaction': 'Ventas',
    'onb.activity.rental': 'Alquileres',
    'onb.activity.both': 'Ambos',
    'onb.sectors.title': 'Tus zonas',
    'onb.sectors.hint': 'Añade códigos postales o ciudades que cubres.',
    'onb.crm.title': 'Tu CRM actual',
    'onb.finish': 'Terminar',

    'nav.home': 'Inicio', 'nav.cases': 'Expedientes', 'nav.contacts': 'Contactos', 'nav.agenda': 'Agenda',

    'pige.title': 'Prospección',
    'pige.dpe': 'CEE (ADEME)',
    'pige.ads': 'Anuncios',
    'pige.sectors_label': 'Zonas (códigos postales o ciudades)',
    'pige.sectors_placeholder': 'Añadir un código postal (ej. 75001, 75002)',
    'pige.sectors_hint': 'Separa varios códigos con coma, o toca + para acumularlos.',
    'pige.search': 'Buscar',
    'pige.searching': 'Buscando…',
    'pige.add_sector_first': 'Añade al menos una zona',
    'pige.results_hint': 'Apila una o varias zonas — ej. 75001, 75002 — luego toca Buscar.',
    'pige.dpe_open': 'Ver la ficha CEE',
    'pige.to_case': 'Expediente',
    'pige.no_results': 'Sin resultados para esta zona.',
    'pige.scraping': 'Análisis en curso — recuperando anuncios en segundo plano.',

    'modal.new_case': 'Nuevo expediente', 'modal.new_contact': 'Nuevo contacto',
    'modal.new_reminder': 'Nuevo recordatorio', 'modal.new_note': 'Nueva nota',
    'modal.speak_to_kolo': 'Hablar con KOLO',
    'chat.placeholder': 'Escribe o habla con KOLO…', 'chat.send': 'Enviar',

    'settings.title': 'Ajustes', 'settings.profile': 'Perfil', 'settings.language': 'Idioma',
    'settings.notifications': 'Notificaciones', 'settings.subscription': 'Suscripción',
    'settings.logout': 'Cerrar sesión', 'settings.legal': 'Aviso legal',
  },
};

const SUPPORTED = ['fr', 'en', 'it', 'de', 'es'];

export const getLocale = () => {
  try {
    const l = (localStorage.getItem('kolo_locale') || '').toLowerCase();
    return SUPPORTED.includes(l) ? l : 'fr';
  } catch (_) { return 'fr'; }
};

export const setLocale = (l) => {
  try {
    if (SUPPORTED.includes(l)) {
      localStorage.setItem('kolo_locale', l);
      localStorage.setItem('kolo_locale_manual', 'true');
    }
  } catch (_) { /* noop */ }
};

// v2t('home.hello_evening', { name: 'Elliot' })
export default function v2t(key, params = {}) {
  const locale = getLocale();
  const dict = STRINGS[locale] || STRINGS.fr;
  let s = dict[key] ?? STRINGS.fr[key] ?? key;
  if (params && typeof s === 'string') {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v ?? ''));
    }
  }
  return s;
}
