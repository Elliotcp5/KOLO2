// Google Analytics 4 - Tracking utilities for KOLO
const GA_MEASUREMENT_ID = 'G-NKPJ0JYXWS';

// Check if gtag is available
const isGtagAvailable = () => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

// Track page view
export const trackPageView = (path, title) => {
  if (!isGtagAvailable()) return;
  
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: path,
    page_title: title
  });
};

// Track custom event
export const trackEvent = (eventName, params = {}) => {
  if (!isGtagAvailable()) return;
  
  window.gtag('event', eventName, params);
};

// ==================== USER EVENTS ====================

export const trackSignUp = (method = 'email') => {
  trackEvent('sign_up', { method });
};

export const trackLogin = (method = 'email') => {
  trackEvent('login', { method });
};

export const trackLogout = () => {
  trackEvent('logout');
};

// ==================== PROSPECT EVENTS ====================

export const trackProspectCreated = (source = 'manual') => {
  trackEvent('prospect_created', { source });
};

export const trackProspectViewed = (prospectId) => {
  trackEvent('prospect_viewed', { prospect_id: prospectId });
};

export const trackProspectUpdated = (field) => {
  trackEvent('prospect_updated', { field });
};

export const trackProspectDeleted = () => {
  trackEvent('prospect_deleted');
};

// ==================== TASK EVENTS ====================

export const trackTaskCreated = (taskType) => {
  trackEvent('task_created', { task_type: taskType });
};

export const trackTaskCompleted = (taskType) => {
  trackEvent('task_completed', { task_type: taskType });
};

export const trackTaskDeleted = () => {
  trackEvent('task_deleted');
};

export const trackAiSuggestionAccepted = () => {
  trackEvent('ai_suggestion_accepted');
};

// ==================== SMS EVENTS ====================

export const trackSmsGenerated = () => {
  trackEvent('sms_generated_ai');
};

export const trackSmsSent = () => {
  trackEvent('sms_sent');
};

// ==================== SUBSCRIPTION EVENTS ====================

export const trackTrialStarted = () => {
  trackEvent('trial_started');
};

export const trackCheckoutStarted = () => {
  trackEvent('begin_checkout', {
    currency: 'EUR',
    value: 9.99
  });
};

export const trackPurchaseCompleted = (transactionId) => {
  trackEvent('purchase', {
    transaction_id: transactionId,
    currency: 'EUR',
    value: 9.99,
    items: [{
      item_name: 'KOLO Subscription',
      item_category: 'subscription',
      price: 9.99,
      quantity: 1
    }]
  });
};

export const trackSubscriptionCancelled = () => {
  trackEvent('subscription_cancelled');
};

// ==================== ENGAGEMENT EVENTS ====================

export const trackFeatureUsed = (featureName) => {
  trackEvent('feature_used', { feature: featureName });
};

export const trackLanguageChanged = (language) => {
  trackEvent('language_changed', { language });
};

export const trackError = (errorType, errorMessage) => {
  trackEvent('error', { 
    error_type: errorType,
    error_message: errorMessage.substring(0, 100)
  });
};

// Set user ID for cross-device tracking
export const setUserId = (userId) => {
  if (!isGtagAvailable()) return;
  window.gtag('set', { user_id: userId });
};

// Set user properties
export const setUserProperties = (properties) => {
  if (!isGtagAvailable()) return;
  window.gtag('set', 'user_properties', properties);
};

export default {
  trackPageView,
  trackEvent,
  trackSignUp,
  trackLogin,
  trackLogout,
  trackProspectCreated,
  trackProspectViewed,
  trackTaskCreated,
  trackTaskCompleted,
  trackSmsGenerated,
  trackSmsSent,
  trackTrialStarted,
  trackCheckoutStarted,
  trackPurchaseCompleted,
  setUserId,
  setUserProperties
};
