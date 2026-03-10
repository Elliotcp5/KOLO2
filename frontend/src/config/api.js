// API URL configuration
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Always use the current origin for API calls
    return window.location.origin;
  }
  return process.env.REACT_APP_BACKEND_URL || '';
};

export const API_URL = getApiUrl();
