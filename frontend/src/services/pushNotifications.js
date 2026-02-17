// Push notification service for KOLO
import { API_URL } from '../config/api';

class PushNotificationService {
  constructor() {
    this.swRegistration = null;
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    this.vapidPublicKey = null;
  }

  async init() {
    if (!this.isSupported) {
      console.log('Push notifications not supported');
      return false;
    }

    try {
      // Register service worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');
      
      // Fetch VAPID public key from server
      await this.fetchVapidKey();
      
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async fetchVapidKey() {
    try {
      const response = await fetch(`${API_URL}/api/notifications/vapid-key`);
      if (response.ok) {
        const data = await response.json();
        this.vapidPublicKey = data.vapid_public_key;
        console.log('VAPID key fetched');
      }
    } catch (error) {
      console.error('Failed to fetch VAPID key:', error);
      // Fallback to default key
      this.vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    }
  }

  async requestPermission() {
    if (!this.isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  async subscribe(userId) {
    if (!this.swRegistration) {
      await this.init();
    }

    if (!this.vapidPublicKey) {
      await this.fetchVapidKey();
    }

    try {
      // Check if already subscribed
      let subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe to push
        subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
        });
      }

      // Get auth token from localStorage
      const token = localStorage.getItem('kolo_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      // Send subscription to backend
      await fetch(`${API_URL}/api/notifications/subscribe`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          user_id: userId
        })
      });

      console.log('Push subscription successful');
      return true;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return false;
    }
  }

  async unsubscribe() {
    if (!this.swRegistration) return;

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        // Get auth token from localStorage
        const token = localStorage.getItem('kolo_token');
        const headers = {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
        
        // Notify backend
        await fetch(`${API_URL}/api/notifications/unsubscribe`, {
          method: 'DELETE',
          headers,
          credentials: 'include'
        });
      }
    } catch (error) {
      console.error('Unsubscribe failed:', error);
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Schedule a local notification (for testing)
  async showLocalNotification(title, body, tag = 'kolo-notification') {
    if (!this.swRegistration) {
      await this.init();
    }

    if (Notification.permission === 'granted' && this.swRegistration) {
      this.swRegistration.showNotification(title, {
        body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag,
        vibrate: [200, 100, 200],
        data: {
          url: window.location.origin + '/app'
        }
      });
    }
  }
}

export const pushService = new PushNotificationService();
export default pushService;
