const CACHE_NAME = 'roktobondhu-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// Install Event - Pre-cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch Event - Network first with cache fallback for navigation and static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET, API requests, SSE streams, or WebSockets
  if (
    request.method !== 'GET' ||
    request.url.includes('/api/') ||
    request.url.includes('/ws/')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful GET responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // If HTML navigation request, return cached root
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});

// Web Push Event (Phase 20)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Emergency Blood Alert', body: event.data.text() };
    }
  }

  const title = data.title || '🚨 Emergency Blood Request | রক্তবন্ধু';
  const options = {
    body: data.body || 'A compatible patient needs blood urgently near your location.',
    icon: data.icon || '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/donor',
      requestId: data.requestId,
      matchId: data.matchId,
    },
    actions: data.actions || [
      { action: 'accept', title: '✅ Accept' },
      { action: 'decline', title: '❌ Decline' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Handler (Phase 20)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || '/donor';

  if (event.action === 'accept' && data.matchId) {
    targetUrl = `/donor?action=accept&matchId=${encodeURIComponent(data.matchId)}`;
  } else if (event.action === 'decline' && data.matchId) {
    targetUrl = `/donor?action=decline&matchId=${encodeURIComponent(data.matchId)}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If an existing app window is open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
