// API URL configuration
// In production, use the same origin. In development, use the env variable.
const getApiUrl = () => {
  // If we're on the production domain, use relative URLs
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production domains
    if (hostname === 'trykolo.io' || hostname === 'www.trykolo.io') {
      return '';  // Use relative URLs
    }
    
    // Emergent preview domains
    if (hostname.includes('.preview.emergentagent.com')) {
      return `https://${hostname}`;
    }
  }
  
  // Fallback to env variable or empty string for relative URLs
  return process.env.REACT_APP_BACKEND_URL || '';
};

export const API_URL = getApiUrl();
