const CACHE_NAME = 'syncfy-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME && key !== 'syncfy-travel') {
                    return caches.delete(key);
                }
            }));
        })
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Si la petición es para una canción de la nube, priorizamos la caché (Modo Viaje)
    if (url.hostname.includes('syncfy.syncfy-api.workers.dev')) {
        e.respondWith(
            caches.match(e.request, { ignoreVary: true }).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(e.request);
            }).catch(() => {
                // Si falla la red y no está en caché
                return new Response("Network error", { status: 404 });
            })
        );
        return;
    }

    // Para el resto (archivos del PWA), intentamos Network First para siempre tener la última versión
    e.respondWith(
        fetch(e.request).then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseClone);
                });
            }
            return response;
        }).catch(() => {
            // Si no hay red, servimos desde la caché
            return caches.match(e.request, { ignoreVary: true });
        })
    );
});
