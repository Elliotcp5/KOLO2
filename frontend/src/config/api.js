// API URL configuration
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production domains - use full URL
    if (hostname === 'trykolo.io' || hostname === 'www.trykolo.io') {
      return 'https://www.trykolo.io';
    }
    
    // Emergent preview domains
    if (hostname.includes('.preview.emergentagent.com')) {
      return `https://${hostname}`;
    }
  }
  
  return process.env.REACT_APP_BACKEND_URL || '';
};

export const API_URL = getApiUrl();
