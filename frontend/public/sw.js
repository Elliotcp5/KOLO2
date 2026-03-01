// KOLO Service Worker for Push Notifications
// Version 2 - with explicit no-cache for API calls
const CACHE_VERSION = 'kolo-v2';

// Install event - force update
self.addEventListener('install', (event) => {
  console.log('Service Worker v2 installing');
  self.skipWaiting();
});

// Activate event - clear old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker v2 activated');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_VERSION)
          .map(name => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => clients.claim())
  );
});

// Fetch event - NEVER cache API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Never cache API calls - always go to network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request, {
        credentials: 'include',
        cache: 'no-store'
      })
    );
    return;
  }
  
  // For other requests, use network-first strategy
  event.respondWith(
    fetch(event.request).catch(() => {
      // Only return cached response if network fails
      return caches.match(event.request);
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push received:', event);

  let data = {
    title: 'KOLO',
    body: 'Vous avez une nouvelle tâche',
    icon: '/logo192.png',
    badge: '/logo192.png',
    url: '/app'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/logo192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'kolo-notification',
    data: {
      url: data.url || '/app'
    },
    actions: [
      {
        action: 'open',
        title: 'Ouvrir'
      },
      {
        action: 'dismiss',
        title: 'Ignorer'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline tasks
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  // Sync pending tasks when back online
  console.log('Syncing tasks...');
}
