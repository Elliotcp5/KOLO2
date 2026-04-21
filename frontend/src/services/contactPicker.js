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

  isSupported() {
    return this.isNative || this.isWebSupported;
  }

  getNotSupportedReason(locale = 'fr') {
    if (this.isSupported()) return null;
    if (locale === 'fr') return "L'import de contacts n'est pas disponible sur ce navigateur.";
    if (locale === 'de') return 'Kontakt-Import ist auf diesem Browser nicht verfügbar.';
    if (locale === 'it') return "L'importazione dei contatti non è disponibile su questo browser.";
    return 'Contact import is not available on this browser.';
  }

  async requestPermission() {
    if (!this.isNative) return 'granted';
    try {
      const current = await Contacts.checkPermissions();
      if (current.contacts === 'granted' || current.contacts === 'limited') {
        return current.contacts;
      }
      const result = await Contacts.requestPermissions();
      return result.contacts;
    } catch (err) {
      console.error('Contacts permission request failed:', err);
      return 'denied';
    }
  }

  async pickContact() {
    if (this.isNative) return this.pickContactNative();
    if (this.isWebSupported) return this.pickContactWeb();
    return null;
  }

  /**
   * Native iOS/Android via @capacitor-community/contacts
   *
   * IMPORTANT : même si le CNContactPickerViewController (iOS) s'ouvre sans
   * permission, le plugin capacitor-community/contacts lit les détails du
   * contact (phones, emails) via CNContactStore — ce qui exige la permission
   * "Contacts" côté système.
   *
   * Flow correct :
   *   1. Check current permission state
   *   2. Si 'prompt' → demander
   *   3. Si 'denied' → throw {code: 'PERMISSION_DENIED'} pour que l'UI
   *      puisse rediriger l'user vers Réglages iOS
   *   4. Si 'granted' ou 'limited' → ouvrir le picker
   */
  async pickContactNative() {
    // 1. Check permission state
    let permState;
    try {
      const perm = await Contacts.checkPermissions();
      permState = perm.contacts;
    } catch (e) {
      permState = 'prompt';
    }

    // 2. Request if not granted yet (prompt state)
    if (permState !== 'granted' && permState !== 'limited') {
      try {
        const req = await Contacts.requestPermissions();
        permState = req.contacts;
      } catch (e) {
        console.error('Contacts.requestPermissions failed:', e);
      }
    }

    // 3. Si encore refusé → signal explicite pour que l'UI ouvre les Réglages
    if (permState !== 'granted' && permState !== 'limited') {
      const err = new Error('CONTACTS_PERMISSION_DENIED');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    // 4. Permission OK → ouvrir le picker
    try {
      const result = await Contacts.pickContact({
        projection: { name: true, phones: true, emails: true },
      });

      if (!result || !result.contact) return null;

      const contact = result.contact;

      let name = '';
      if (contact.name) {
        name = contact.name.display
          || [contact.name.given, contact.name.middle, contact.name.family].filter(Boolean).join(' ')
          || '';
      }

      let phone = '';
      if (Array.isArray(contact.phones) && contact.phones.length > 0) {
        const mobile = contact.phones.find((p) => {
          const lbl = (p.label || p.type || '').toString().toLowerCase();
          return lbl.includes('mobile') || lbl.includes('cell');
        });
        phone = (mobile && mobile.number) || contact.phones[0].number || '';
      }

      let email = '';
      if (Array.isArray(contact.emails) && contact.emails.length > 0) {
        email = contact.emails[0].address || '';
      }

      return { name, phone, email };
    } catch (error) {
      // User cancelled → silent
      if (error && /cancel/i.test(String(error.message || error))) return null;
      console.error('Native contact pick failed:', error);
      return null;
    }
  }

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
