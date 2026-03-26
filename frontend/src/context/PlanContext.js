import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PlanContext = createContext(null);

// Plan feature flags matching backend
export const PLAN_FEATURES = {
  free: {
    max_prospects: 30,
    daily_ai_suggestions: 1,
    sms_one_click: false,
    heat_score: false,
    roi_dashboard: false,
    interaction_history: false,
    weekly_report: false,
    budget_slider: false,
    contextual_notes: false,
    behavioral_alerts: false,
    ultra_contextual_suggestions: false,
    dedicated_support: false,
    priority_access: false,
  },
  pro: {
    max_prospects: null,
    daily_ai_suggestions: null,
    sms_one_click: true,
    heat_score: false,
    roi_dashboard: false,
    interaction_history: true,
    weekly_report: false,
    budget_slider: true,
    contextual_notes: true,
    behavioral_alerts: false,
    ultra_contextual_suggestions: false,
    dedicated_support: false,
    priority_access: false,
  },
  pro_plus: {
    max_prospects: null,
    daily_ai_suggestions: null,
    sms_one_click: true,
    heat_score: true,
    roi_dashboard: true,
    interaction_history: true,
    weekly_report: true,
    budget_slider: true,
    contextual_notes: true,
    behavioral_alerts: true,
    ultra_contextual_suggestions: true,
    dedicated_support: true,
    priority_access: true,
  }
};

// Paywall messages for each feature
export const PAYWALL_MESSAGES = {
  heat_score: {
    fr: "Voyez en un coup d'œil quels prospects sont prêts à signer.",
    en: "See at a glance which prospects are ready to sign.",
    de: "Sehen Sie auf einen Blick, welche Interessenten bereit sind zu unterschreiben.",
    it: "Scopri a colpo d'occhio quali potenziali clienti sono pronti a firmare.",
    required_plan: "pro_plus"
  },
  sms_one_click: {
    fr: "Envoyez le bon message au bon moment, rédigé par l'IA.",
    en: "Send the right message at the right time, written by AI.",
    de: "Senden Sie die richtige Nachricht zur richtigen Zeit, von KI geschrieben.",
    it: "Invia il messaggio giusto al momento giusto, scritto dall'IA.",
    required_plan: "pro"
  },
  roi_dashboard: {
    fr: "Suivez exactement combien KOLO vous a rapporté ce mois.",
    en: "Track exactly how much KOLO has earned you this month.",
    de: "Verfolgen Sie genau, wie viel KOLO Ihnen diesen Monat eingebracht hat.",
    it: "Monitora esattamente quanto KOLO ti ha fatto guadagnare questo mese.",
    required_plan: "pro_plus"
  },
  ai_suggestions_limit: {
    fr: "Plus de suggestions pour aujourd'hui. Passez en Pro pour des suggestions illimitées.",
    en: "No more suggestions for today. Upgrade to Pro for unlimited suggestions.",
    de: "Keine Vorschläge mehr für heute. Upgraden Sie auf Pro für unbegrenzte Vorschläge.",
    it: "Niente più suggerimenti per oggi. Passa a Pro per suggerimenti illimitati.",
    required_plan: "pro"
  },
  prospects_limit: {
    fr: "Vous avez atteint la limite de 30 prospects. Passez en Pro pour des prospects illimités.",
    en: "You've reached the limit of 30 prospects. Upgrade to Pro for unlimited prospects.",
    de: "Sie haben das Limit von 30 Interessenten erreicht. Upgraden Sie auf Pro für unbegrenzte Interessenten.",
    it: "Hai raggiunto il limite di 30 potenziali clienti. Passa a Pro per potenziali clienti illimitati.",
    required_plan: "pro"
  },
  interaction_history: {
    fr: "Accédez à l'historique complet des interactions avec vos prospects.",
    en: "Access the complete interaction history with your prospects.",
    de: "Zugriff auf die vollständige Interaktionshistorie mit Ihren Interessenten.",
    it: "Accedi allo storico completo delle interazioni con i tuoi potenziali clienti.",
    required_plan: "pro"
  },
  budget_slider: {
    fr: "Définissez précisément le budget de vos prospects avec le slider avancé.",
    en: "Precisely define your prospects' budget with the advanced slider.",
    de: "Definieren Sie das Budget Ihrer Interessenten präzise mit dem erweiterten Slider.",
    it: "Definisci con precisione il budget dei tuoi potenziali clienti con lo slider avanzato.",
    required_plan: "pro"
  }
};

export function PlanProvider({ children }) {
  const [planData, setPlanData] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlanData = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/plans/current`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlanData(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch plan data:', err);
      setError(err.message);
    }
    return null;
  }, []);

  const fetchPricing = useCallback(async (currency = null) => {
    try {
      const url = currency 
        ? `${API_URL}/api/plans/pricing?currency=${currency}`
        : `${API_URL}/api/plans/pricing`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setPricing(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
    }
    return null;
  }, []);

  const startTrial = useCallback(async (plan, token) => {
    try {
      const response = await fetch(`${API_URL}/api/plans/start-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Refresh plan data
        await fetchPlanData(token);
        return { success: true, data };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchPlanData]);

  const checkFeature = useCallback((feature) => {
    if (!planData) return false;
    return planData.features?.[feature] ?? false;
  }, [planData]);

  const canAddProspect = useCallback(() => {
    if (!planData) return true;
    return planData.limits?.prospects?.can_add ?? true;
  }, [planData]);

  const canUseAISuggestion = useCallback(() => {
    if (!planData) return true;
    return planData.limits?.ai_suggestions?.can_use ?? true;
  }, [planData]);

  const getEffectivePlan = useCallback(() => {
    return planData?.effective_plan ?? 'free';
  }, [planData]);

  const isInTrial = useCallback(() => {
    return planData?.trial !== null;
  }, [planData]);

  const getTrialDaysRemaining = useCallback(() => {
    return planData?.trial?.days_remaining ?? 0;
  }, [planData]);

  const setCurrency = useCallback(async (currency, token) => {
    try {
      const response = await fetch(`${API_URL}/api/plans/set-currency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currency })
      });
      
      if (response.ok) {
        await fetchPricing(currency);
        return true;
      }
    } catch (err) {
      console.error('Failed to set currency:', err);
    }
    return false;
  }, [fetchPricing]);

  const upgradePlan = useCallback(async (plan, billingPeriod, token) => {
    try {
      const response = await fetch(`${API_URL}/api/plans/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan, billing_period: billingPeriod })
      });
      
      if (response.ok) {
        const data = await response.json();
        return { success: true, checkout_url: data.checkout_url };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  useEffect(() => {
    setLoading(false);
  }, []);

  const value = {
    planData,
    pricing,
    loading,
    error,
    fetchPlanData,
    fetchPricing,
    startTrial,
    checkFeature,
    canAddProspect,
    canUseAISuggestion,
    getEffectivePlan,
    isInTrial,
    getTrialDaysRemaining,
    setCurrency,
    upgradePlan,
    PLAN_FEATURES,
    PAYWALL_MESSAGES
  };

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlan must be used within a PlanProvider');
  }
  return context;
}

export default PlanContext;
