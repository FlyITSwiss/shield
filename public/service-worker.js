/**
 * SHIELD - Service Worker
 * PWA offline support and push notifications
 */

const CACHE_VERSION = 'shield-v1.1.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/login',
    '/assets/css/shield-core.css',
    '/assets/css/shield-fixes.css',
    '/assets/css/shield-tracking.css',
    '/assets/js/app.js',
    '/assets/js/app/settings.js',
    '/assets/js/app/sos.js',
    '/assets/lang/fr.json',
    '/assets/lang/en.json',
    '/manifest.json',
    // Add audio files for offline alarm
    '/assets/audio/alarm-siren.wav',
    '/assets/audio/alarm-horn.wav',
    // Icons for offline
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png'
];

// API endpoints that should always go to network
const NETWORK_ONLY = [
    '/api/v1/sos',
    '/api/v1/incidents',
    '/api/v1/auth'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Static assets cached');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Old caches cleaned');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Network only for critical API endpoints
    if (NETWORK_ONLY.some((path) => url.pathname.startsWith(path))) {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    // Return offline response for API
                    return new Response(
                        JSON.stringify({ error: 'offline', message: 'No network connection' }),
                        { status: 503, headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }

    // Cache first for static assets
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(request)
                        .then((networkResponse) => {
                            // Cache the new response
                            if (networkResponse.ok) {
                                const responseClone = networkResponse.clone();
                                caches.open(DYNAMIC_CACHE)
                                    .then((cache) => cache.put(request, responseClone));
                            }
                            return networkResponse;
                        });
                })
        );
        return;
    }

    // Network first for HTML pages
    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                // Cache successful responses
                if (networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE)
                        .then((cache) => cache.put(request, responseClone));
                }
                return networkResponse;
            })
            .catch(() => {
                // Try cache if network fails
                return caches.match(request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Return offline page
                        return caches.match('/');
                    });
            })
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

    let data = {
        title: 'SHIELD',
        body: 'Nouvelle notification',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge-72x72.png',
        tag: 'shield-notification',
        requireInteraction: true
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    // For SOS alerts, use high priority
    if (data.type === 'sos_alert') {
        data.requireInteraction = true;
        data.vibrate = [200, 100, 200, 100, 200];
        data.actions = [
            { action: 'view', title: 'Voir' },
            { action: 'call', title: 'Appeler' }
        ];
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            requireInteraction: data.requireInteraction,
            vibrate: data.vibrate,
            actions: data.actions,
            data: data
        })
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.notification.tag);

    event.notification.close();

    const data = event.notification.data || {};
    let url = '/';

    // Handle action buttons
    if (event.action === 'view' && data.incidentId) {
        url = `/history/detail?id=${data.incidentId}`;
    } else if (event.action === 'call' && data.phone) {
        url = `tel:${data.phone}`;
    } else if (data.url) {
        url = data.url;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window if open
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.focus();
                        client.navigate(url);
                        return;
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// Background sync for offline SOS
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sos-sync') {
        event.waitUntil(
            // Retry sending SOS data when back online
            syncSOSData()
        );
    }
});

async function syncSOSData() {
    const db = await openIndexedDB();
    const pendingSOS = await db.getAll('pendingSOS');

    for (const sos of pendingSOS) {
        try {
            const response = await fetch('/api/v1/sos/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sos)
            });

            if (response.ok) {
                await db.delete('pendingSOS', sos.id);
            }
        } catch (error) {
            console.error('[SW] Failed to sync SOS:', error);
        }
    }
}

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('shield-db', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pendingSOS')) {
                db.createObjectStore('pendingSOS', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

console.log('[SW] Service worker loaded');
