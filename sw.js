const CACHE_NAME = 'syncfy-v2';
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
    // Si la petición es para un archivo del PWA, intentamos Network First para siempre tener la última versión
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
            return caches.match(e.request);
        })
    );
});
