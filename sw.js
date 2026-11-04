const CACHE_NAME = 'host-a-cleaner-v3';
const APP_SHELL = [
    './index.html',
    './styles.css',
    './js/equipas.js',
    './js/app.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
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

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) return;

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
