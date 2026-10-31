// ====================================================================
// 🚀 Kira AI Progressive Web App - Service Worker (v2.7.0-Synchronized)
// ====================================================================

const CACHE_NAME = 'kira-ai-cache-v2.7.13';
const STATIC_ASSETS = [
    '/',
    '/static/style.css?v=20261101_2713',
    '/static/script.js?v=20261101_2713',
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

// Messages from clients (Skip Waiting or Cache Requests)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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
