// ====================================================================
// Kira AI Progressive Web App - Service Worker (v2.9.7)
// ====================================================================

const CACHE_NAME = 'kira-ai-cache-v2.9.7-resilience-tools-fix';
const STATIC_ASSETS = [
    '/',
    '/static/style.css?v=20261115_fix_resilience_tools',
    '/static/script.js?v=20261115_fix_resilience_tools',
    '/manifest.json',
    '/static/manifest.json',
    '/static/images/kira_logo.png?v=6',
    '/static/images/kira_avatar.jpg?v=5',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install: Cache critical App Shell assets and force immediate activation
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[Kira SW] Non-critical asset cache skip:', err);
            });
        })
    );
});

// Activate: Immediately claim clients and purge ALL older cache versions
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Kira SW v2.7.0] Purging legacy cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Background Sync Listener (Executive Offline Vault)
self.addEventListener('sync', (event) => {
    if (event.tag === 'kira-vault-sync') {
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'KIRA_TRIGGER_VAULT_SYNC' });
                });
            })
        );
    }
});

// Messages from clients (Skip Waiting or Show Notification)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data && event.data.type === 'KIRA_SHOW_LOCAL_NOTIFICATION') {
        const title = event.data.title || 'Kira AI';
        const body = event.data.body || '';
        const url = event.data.url || '/?open=notifications';
        event.waitUntil(
            self.registration.showNotification(title, {
                body,
                icon: '/static/images/kira_logo.png?v=6',
                badge: '/static/images/kira_logo.png?v=6',
                data: { url }
            })
        );
    }
});

// Web Push Notification Listener (Phase 2.2)
self.addEventListener('push', (event) => {
    let payload = { title: 'Kira AI', body: 'มีรายการแจ้งเตือนใหม่ค่ะ', url: '/?open=notifications' };
    try {
        if (event.data) {
            const parsed = event.data.json();
            payload = Object.assign(payload, parsed);
        }
    } catch (e) {
        try {
            if (event.data) payload.body = event.data.text();
        } catch (_ignored) {}
    }
    event.waitUntil(
        self.registration.showNotification(payload.title || 'Kira AI', {
            body: payload.body || '',
            icon: '/static/images/kira_logo.png?v=6',
            badge: '/static/images/kira_logo.png?v=6',
            data: { url: payload.url || '/?open=notifications' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if ('focus' in client) {
                    if ('navigate' in client && targetUrl !== '/') {
                        client.navigate(targetUrl).catch(() => {});
                    }
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// Fetch Strategy:
// 1. Navigation / Root HTML: Network-First to guarantee fresh server templates and version tags
// 2. Static Assets: Stale-While-Revalidate with latest CACHE_NAME
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Bypass Service Worker for API endpoints, SSE streams, auth, and admin
    if (
        request.method !== 'GET' || 
        url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/auth/') ||
        url.pathname.startsWith('/admin') ||
        url.pathname.startsWith('/share/')
    ) {
        return; // Normal network request
    }

    // HTML Navigation: Network-First to guarantee latest server templates
    if (request.mode === 'navigate' || url.pathname === '/') {
        event.respondWith(
            fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                }
                return networkResponse;
            }).catch(async () => {
                const cached = await caches.match(request);
                return cached || new Response(
                    '<div style="font-family:sans-serif;text-align:center;padding:50px;color:#fff;background:#0f172a;min-height:100vh;">' +
                    '<h2>🌸 Kira AI - โหมดออฟไลน์ (Offline Mode)</h2>' +
                    '<p>อุปกรณ์ของคุณกำลังขาดการเชื่อมต่ออินเทอร์เน็ต แต่คุณยังสามารถเข้าถึงคลังเอกสารนิรภัย (Executive Offline Vault) ได้ตามปกติค่ะ</p>' +
                    '<button onclick="window.location.reload()" style="padding:10px 20px;border-radius:8px;background:#38bdf8;color:#0f172a;font-weight:bold;border:none;cursor:pointer;">รีโหลดหน้าเว็บ</button>' +
                    '</div>',
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            })
        );
        return;
    }

    // Static Assets: Stale-While-Revalidate
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(request);
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    cache.put(request, networkResponse.clone());
                }
                return networkResponse;
            }).catch(() => {
                return cachedResponse;
            });

            return cachedResponse || fetchPromise;
        })
    );
});
