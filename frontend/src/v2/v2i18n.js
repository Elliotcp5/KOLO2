// =============================================================
// KOLO v2 — Minimal i18n helper for in-app UI strings
// Reads the user's selected locale from localStorage (kolo_locale)
// Falls back to FR. Add strings as you need them, no need for a heavy framework.
// =============================================================

const STRINGS = {
  fr: {
    createNote: 'Créer une note',
    askKolo: 'Demande à KOLO',
    askKoloSub: 'Estimation, coaching, relance, conseil…',
    dailyAdvice: 'Conseil du jour',
    continueChat: 'Continuer la conversation',
    today: "Aujourd'hui",
  },
  en: {
    createNote: 'New note',
    askKolo: 'Ask KOLO',
    askKoloSub: 'Estimation, coaching, follow-up, advice…',
    dailyAdvice: 'Daily advice',
    continueChat: 'Continue the conversation',
    today: 'Today',
  },
  it: {
    createNote: 'Crea una nota',
    askKolo: 'Chiedi a KOLO',
    askKoloSub: 'Stima, coaching, follow-up, consiglio…',
    dailyAdvice: 'Consiglio del giorno',
    continueChat: 'Continua la conversazione',
    today: 'Oggi',
  },
  de: {
    createNote: 'Notiz erstellen',
    askKolo: 'Frage KOLO',
    askKoloSub: 'Schätzung, Coaching, Follow-up, Beratung…',
    dailyAdvice: 'Tagestipp',
    continueChat: 'Gespräch fortsetzen',
    today: 'Heute',
  },
  es: {
    createNote: 'Crear nota',
    askKolo: 'Pregunta a KOLO',
    askKoloSub: 'Tasación, coaching, seguimiento, consejo…',
    dailyAdvice: 'Consejo del día',
    continueChat: 'Continuar la conversación',
    today: 'Hoy',
  },
  pt: {
    createNote: 'Criar nota',
    askKolo: 'Pergunta ao KOLO',
    askKoloSub: 'Avaliação, coaching, follow-up, conselho…',
    dailyAdvice: 'Conselho do dia',
    continueChat: 'Continuar a conversa',
    today: 'Hoje',
  },
  pl: {
    createNote: 'Nowa notatka',
    askKolo: 'Zapytaj KOLO',
    askKoloSub: 'Wycena, coaching, follow-up, porada…',
    dailyAdvice: 'Porada dnia',
    continueChat: 'Kontynuuj rozmowę',
    today: 'Dziś',
  },
};

export function v2t(key) {
  let locale = 'fr';
  try {
    locale = localStorage.getItem('kolo_locale') || 'fr';
  } catch (_) {
    // ignore
  }
  return (STRINGS[locale] && STRINGS[locale][key]) || STRINGS.fr[key] || key;
}

export default v2t;
