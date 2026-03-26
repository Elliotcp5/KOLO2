// Push notification service for KOLO - Native + Web support
import { API_URL } from '../config/api';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

class PushNotificationService {
  constructor() {
    this.swRegistration = null;
    this.isNative = Capacitor.isNativePlatform();
    this.isWebSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    this.vapidPublicKey = null;
  }

  async init() {
    if (this.isNative) {
      return this.initNative();
    } else if (this.isWebSupported) {
      return this.initWeb();
    }
    console.log('Push notifications not supported on this platform');
    return false;
  }

  // Native iOS/Android initialization
  async initNative() {
    try {
      // Request permission
      const permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        const result = await PushNotifications.requestPermissions();
        if (result.receive !== 'granted') {
          return false;
        }
      } else if (permStatus.receive !== 'granted') {
        return false;
      }

      // Register with APNs/FCM
      await PushNotifications.register();

      // Listen for registration token
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ', token.value);
        await this.sendTokenToServer(token.value);
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error: ', error);
      });

      // Listen for push notifications received
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received: ', notification);
      });

      // Listen for push notification action performed
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed: ', notification);
        // Navigate to appropriate screen based on notification data
        if (notification.notification.data?.url) {
          window.location.href = notification.notification.data.url;
        }
      });

      return true;
    } catch (error) {
      console.error('Native push init failed:', error);
      return false;
    }
  }

  // Web PWA initialization
  async initWeb() {
    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');
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
      this.vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    }
  }

  async requestPermission() {
    if (this.isNative) {
      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
    } else if (this.isWebSupported) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  async subscribe(userId) {
    if (this.isNative) {
      // For native, registration is handled in initNative
      return true;
    }

    // Web subscription
    if (!this.swRegistration) {
      await this.initWeb();
    }

    if (!this.vapidPublicKey) {
      await this.fetchVapidKey();
    }

    try {
      let subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
        });
      }

      const token = localStorage.getItem('kolo_token');
      await fetch(`${API_URL}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
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

  async sendTokenToServer(token) {
    try {
      const authToken = localStorage.getItem('kolo_token');
      await fetch(`${API_URL}/api/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          device_token: token,
          platform: Capacitor.getPlatform() // 'ios' or 'android'
        })
      });
      console.log('Device token registered with server');
    } catch (error) {
      console.error('Failed to register device token:', error);
    }
  }

  async unsubscribe() {
    if (this.isNative) {
      await PushNotifications.removeAllListeners();
      return;
    }

    if (!this.swRegistration) return;

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        const token = localStorage.getItem('kolo_token');
        await fetch(`${API_URL}/api/notifications/unsubscribe`, {
          method: 'DELETE',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
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

  async showLocalNotification(title, body, tag = 'kolo-notification') {
    if (this.isNative) {
      // On native, use local notifications plugin if needed
      return;
    }
    
    if (!this.swRegistration) {
      await this.initWeb();
    }

    if (Notification.permission === 'granted' && this.swRegistration) {
      this.swRegistration.showNotification(title, {
        body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag,
        vibrate: [200, 100, 200],
        data: { url: window.location.origin + '/app' }
      });
    }
  }
}

export const pushService = new PushNotificationService();
export default pushService;
