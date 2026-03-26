// Utility functions for KOLO app

/**
 * Get user initials from full name
 * @param {string} fullName - User's full name
 * @returns {string} - Initials (e.g., "EP" for "Elliot Pressard")
 */
export const getInitials = (fullName) => {
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) return '';
  const names = fullName.trim().split(' ').filter(n => n.length > 0);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

/**
 * Format phone number for display
 * @param {string} phone - Raw phone number
 * @returns {string} - Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  // Remove all non-digits except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // If starts with +33, format as French number
  if (cleaned.startsWith('+33')) {
    const local = cleaned.slice(3);
    return `+33 ${local.slice(0, 1)} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`.trim();
  }
  return phone;
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

/**
 * Get task type icon name
 * @param {string} taskType - Task type
 * @returns {string} - Icon name
 */
export const getTaskTypeIcon = (taskType) => {
  const icons = {
    call: 'Phone',
    sms: 'MessageSquare',
    email: 'Mail',
    visit: 'MapPin',
    meeting: 'Calendar',
    other: 'Clock'
  };
  return icons[taskType] || 'Clock';
};

/**
 * Get status color
 * @param {string} status - Prospect status
 * @returns {object} - Color configuration
 */
export const getStatusColor = (status) => {
  const colors = {
    nouveau: { bg: 'rgba(0, 74, 173, 0.12)', text: '#004AAD', label: 'Nouveau' },
    contacte: { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', label: 'Contacté' },
    qualifie: { bg: 'rgba(34, 197, 94, 0.12)', text: '#22C55E', label: 'Qualifié' },
    offre: { bg: 'rgba(139, 92, 246, 0.12)', text: '#8B5CF6', label: 'Offre' },
    froid: { bg: 'rgba(107, 114, 128, 0.12)', text: '#6B7280', label: 'Froid' },
    signe: { bg: 'rgba(34, 197, 94, 0.12)', text: '#22C55E', label: 'Signé' }
  };
  return colors[status] || colors.nouveau;
};

/**
 * Get score/temperature color
 * @param {string} score - Temperature score
 * @returns {string} - Color hex value
 */
export const getScoreColor = (score) => {
  const colors = {
    chaud: '#22C55E',
    tiede: '#F59E0B',
    froid: '#EF4444'
  };
  return colors[score] || '#6B7280';
};

export default {
  getInitials,
  formatPhoneNumber,
  truncateText,
  getTaskTypeIcon,
  getStatusColor,
  getScoreColor
};
