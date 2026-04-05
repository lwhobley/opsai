/* Ops AI — Service Worker for Push Notifications */

self.addEventListener('push', (event) => {
  let data = { title: 'Ops AI', body: 'New notification', url: '/', badge: 0 };

  try {
    data = { ...data, ...event.data.json() };
  } catch {
    data.body = event.data ? event.data.text() : 'New notification';
  }

  const options = {
    body: data.body,
    icon: '/logo192.png',
    badge: '/badge72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'opsai-alert',          // replaces prior notification of same tag
    renotify: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'view', title: '📋 View Report' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Install + activate — take control immediately
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
