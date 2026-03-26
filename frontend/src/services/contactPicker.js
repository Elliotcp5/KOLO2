// Contact picker service for KOLO - Native + Web support
import { Capacitor } from '@capacitor/core';

class ContactPickerService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isWebSupported = 'contacts' in navigator && 'ContactsManager' in window;
  }

  /**
   * Check if contact picking is supported on current platform
   */
  isSupported() {
    return this.isNative || this.isWebSupported;
  }

  /**
   * Get the reason why contacts are not supported
   */
  getNotSupportedReason(locale = 'fr') {
    if (this.isSupported()) return null;
    
    if (locale === 'fr') {
      return "L'import de contacts n'est pas disponible sur ce navigateur. Utilisez l'application mobile ou Chrome sur Android.";
    }
    return "Contact import is not available on this browser. Use the mobile app or Chrome on Android.";
  }

  /**
   * Pick a single contact
   * Returns: { name: string, phone: string, email?: string } or null
   */
  async pickContact() {
    if (this.isNative) {
      return this.pickContactNative();
    } else if (this.isWebSupported) {
      return this.pickContactWeb();
    }
    return null;
  }

  /**
   * Pick contact using native iOS/Android
   */
  async pickContactNative() {
    try {
      // For native, we need to use a Capacitor plugin
      // Using cordova-plugin-contacts or similar
      
      // Check if Contacts plugin is available
      if (window.Contacts && window.Contacts.pickContact) {
        return new Promise((resolve, reject) => {
          window.Contacts.pickContact((contact) => {
            if (!contact) {
              resolve(null);
              return;
            }
            
            // Extract name
            let name = '';
            if (contact.displayName) {
              name = contact.displayName;
            } else if (contact.name) {
              const n = contact.name;
              name = [n.givenName, n.familyName].filter(Boolean).join(' ');
            }
            
            // Extract phone
            let phone = '';
            if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
              // Prefer mobile number
              const mobile = contact.phoneNumbers.find(p => 
                p.type && p.type.toLowerCase().includes('mobile')
              );
              phone = mobile ? mobile.value : contact.phoneNumbers[0].value;
            }
            
            // Extract email
            let email = '';
            if (contact.emails && contact.emails.length > 0) {
              email = contact.emails[0].value;
            }
            
            resolve({ name, phone, email });
          }, (error) => {
            console.error('Contact pick error:', error);
            reject(error);
          });
        });
      }
      
      // Fallback: use Capacitor Contacts plugin if available
      // This would require @capacitor-community/contacts
      console.warn('Native contacts not available, falling back to web picker');
      return this.pickContactWeb();
      
    } catch (error) {
      console.error('Native contact pick failed:', error);
      return null;
    }
  }

  /**
   * Pick contact using Web Contact Picker API
   */
  async pickContactWeb() {
    if (!this.isWebSupported) return null;

    try {
      const props = ['name', 'tel', 'email'];
      const opts = { multiple: false };
      
      const contacts = await navigator.contacts.select(props, opts);
      
      if (!contacts || contacts.length === 0) {
        return null;
      }
      
      const contact = contacts[0];
      
      return {
        name: contact.name && contact.name[0] ? contact.name[0] : '',
        phone: contact.tel && contact.tel[0] ? contact.tel[0] : '',
        email: contact.email && contact.email[0] ? contact.email[0] : ''
      };
      
    } catch (error) {
      console.error('Web contact pick failed:', error);
      return null;
    }
  }

  /**
   * Request contacts permission (for native)
   */
  async requestPermission() {
    if (!this.isNative) {
      // Web doesn't need explicit permission request
      return true;
    }

    try {
      // Check Capacitor permissions if plugin available
      // This depends on the specific contacts plugin being used
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }
}

export const contactPicker = new ContactPickerService();
export default contactPicker;
