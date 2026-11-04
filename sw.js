const CACHE_NAME = 'host-a-cleaner-v4';
const APP_SHELL = [
    './index.html',
    './styles.css',
    './manifest.json',
    './images/icon-192.png',
    './images/icon-512.png',
    './js/equipas.js',
    './js/app.js'
];
const REMOTE_APP_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => Promise.all(REMOTE_APP_ASSETS.map(async assetUrl => {
                try {
                    const response = await fetch(assetUrl, { mode: 'no-cors' });
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(assetUrl, response);
                } catch (error) {
                    console.warn('Não foi possível guardar um recurso remoto para uso offline:', assetUrl, error);
                }
            })))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName => cacheName.startsWith('host-a-cleaner-') && cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('sync', event => {
    if (event.tag !== 'host-cleaner-sync') return;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => clients.forEach(client => {
                client.postMessage({ type: 'HOST_CLEANER_SYNC_PENDING' });
            }))
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) {
        if (!REMOTE_APP_ASSETS.includes(requestUrl.href)) return;
        event.respondWith(caches.open(CACHE_NAME).then(async cache => {
            const cachedResponse = await cache.match(request);
            if (cachedResponse) return cachedResponse;
            const response = await fetch(request);
            if (response.ok || response.type === 'opaque') {
                await cache.put(request, response.clone());
            }
            return response;
        }));
        return;
    }

    const isNavigation = request.mode === 'navigate';
    const isAppAsset = /\.(?:css|js|json|png|svg|ico|webp)$/i.test(requestUrl.pathname);
    if (!isNavigation && !isAppAsset) return;

    const cacheKey = isNavigation
        ? new Request(new URL('./index.html', self.registration.scope))
        : request;

    const cachePromise = caches.open(CACHE_NAME);
    const cachedResponsePromise = cachePromise.then(cache => cache.match(cacheKey));
    const networkResponsePromise = cachePromise.then(cache => fetch(request).then(response => {
        if (!response.ok) return response;
        return cache.put(cacheKey, response.clone()).then(() => response);
    }));

    event.waitUntil(networkResponsePromise.catch(error => {
        console.warn('Não foi possível atualizar o recurso em cache:', request.url, error);
    }));
    event.respondWith(cachedResponsePromise.then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return networkResponsePromise.catch(async error => {
            if (isNavigation) {
                const cache = await cachePromise;
                const offlinePage = await cache.match(new URL('./index.html', self.registration.scope));
                if (offlinePage) return offlinePage;
            }
            throw error;
        });
    }));
});
