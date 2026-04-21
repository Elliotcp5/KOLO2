// Contact picker service for KOLO — Native (Capacitor) + Web fallback
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';

class ContactPickerService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    // Web Contact Picker API (Chrome Android / some PWAs)
    this.isWebSupported = typeof navigator !== 'undefined'
      && 'contacts' in navigator
      && 'ContactsManager' in window;
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
    if (locale === 'de') {
      return 'Kontakt-Import ist auf diesem Browser nicht verfügbar. Verwenden Sie die mobile App oder Chrome auf Android.';
    }
    if (locale === 'it') {
      return "L'importazione dei contatti non è disponibile su questo browser. Usa l'app mobile o Chrome su Android.";
    }
    return 'Contact import is not available on this browser. Use the mobile app or Chrome on Android.';
  }

  /**
   * Request contacts permission (native iOS/Android only)
   * Returns true if granted, false otherwise.
   */
  async requestPermission() {
    if (!this.isNative) return true; // Web has no explicit request step

    try {
      const current = await Contacts.checkPermissions();
      if (current.contacts === 'granted') return true;

      const result = await Contacts.requestPermissions();
      return result.contacts === 'granted';
    } catch (err) {
      console.error('Contacts permission request failed:', err);
      return false;
    }
  }

  /**
   * Pick a single contact
   * Returns: { name: string, phone: string, email: string } or null (cancelled / no data)
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
   * Native iOS/Android via @capacitor-community/contacts
   */
  async pickContactNative() {
    try {
      const granted = await this.requestPermission();
      if (!granted) return null;

      const result = await Contacts.pickContact({
        projection: {
          name: true,
          phones: true,
          emails: true,
        },
      });

      if (!result || !result.contact) return null;

      const contact = result.contact;

      // Name — try display, else compose from given+family
      let name = '';
      if (contact.name) {
        name = contact.name.display
          || [contact.name.given, contact.name.middle, contact.name.family].filter(Boolean).join(' ')
          || '';
      }

      // Phone — prefer mobile if tagged, else first available
      let phone = '';
      if (Array.isArray(contact.phones) && contact.phones.length > 0) {
        const mobile = contact.phones.find((p) => {
          const lbl = (p.label || p.type || '').toString().toLowerCase();
          return lbl.includes('mobile') || lbl.includes('cell');
        });
        phone = (mobile && mobile.number) || contact.phones[0].number || '';
      }

      // Email — first available
      let email = '';
      if (Array.isArray(contact.emails) && contact.emails.length > 0) {
        email = contact.emails[0].address || '';
      }

      return { name, phone, email };
    } catch (error) {
      // User cancelled → no error popup, just null
      if (error && /cancel/i.test(String(error.message || error))) return null;
      console.error('Native contact pick failed:', error);
      return null;
    }
  }

  /**
   * Web Contact Picker API fallback (Chrome Android)
   */
  async pickContactWeb() {
    if (!this.isWebSupported) return null;

    try {
      const props = ['name', 'tel', 'email'];
      const contacts = await navigator.contacts.select(props, { multiple: false });

      if (!contacts || contacts.length === 0) return null;
      const contact = contacts[0];

      return {
        name: (contact.name && contact.name[0]) || '',
        phone: (contact.tel && contact.tel[0]) || '',
        email: (contact.email && contact.email[0]) || '',
      };
    } catch (error) {
      console.error('Web contact pick failed:', error);
      return null;
    }
  }
}

export const contactPicker = new ContactPickerService();
export default contactPicker;
