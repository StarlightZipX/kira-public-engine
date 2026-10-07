// ====================================================================
// 🚀 Kira AI Progressive Web App - Service Worker (v2.4-UpdatePrompt)
// ====================================================================

const CACHE_NAME = 'kira-ai-cache-v2.4';
const STATIC_ASSETS = [
    '/',
    '/static/style.css',
    '/static/script.js',
    '/manifest.json',
    '/static/manifest.json',
    '/static/images/kira_logo.png?v=6',
    '/static/images/kira_avatar.jpg?v=5',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install: Cache critical App Shell assets (wait for user confirmation or activation)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[Kira SW] Non-critical asset cache skip:', err);
            });
        })
    );
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Kira SW] Purging old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Background Sync Listener (Phase 3: Executive Offline Vault)
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

// Fetch: Network-First for API routes, Stale-While-Revalidate for Static Assets
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Bypass Service Worker for API endpoints, SSE streams, and websocket
    if (
        request.method !== 'GET' || 
        url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/auth/') ||
        url.pathname.startsWith('/admin')
    ) {
        return; // Normal network request
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
                // Offline fallback
                return cachedResponse || new Response(
                    '<div style="font-family:sans-serif;text-align:center;padding:50px;color:#fff;background:#0f172a;min-height:100vh;">' +
                    '<h2>🌸 Kira AI - โหมดออฟไลน์ (Offline Mode)</h2>' +
                    '<p>อุปกรณ์ของคุณกำลังขาดการเชื่อมต่ออินเทอร์เน็ต แต่คุณยังสามารถเข้าถึงคลังเอกสารนิรภัย (Executive Offline Vault) ได้ตามปกติค่ะ</p>' +
                    '<button onclick="window.location.reload()" style="padding:10px 20px;border-radius:8px;background:#38bdf8;color:#0f172a;font-weight:bold;border:none;cursor:pointer;">รีโหลดหน้าเว็บ</button>' +
                    '</div>',
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            });

            return cachedResponse || fetchPromise;
        })
    );
});
