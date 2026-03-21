// config/sw.js — Service Worker BYB North
const CACHE = 'byb-north-v2';
const ARCHIVOS = [
    '/',
    '/index.html',
    '/ui/styles.css',
    '/config/firebase.js',
    '/auth/auth.js',
    '/auth/usuarios.js',
    '/modules/helpers.js',
    '/docs/docx.js',
    '/modules/tareas.js',
    '/modules/fotos.js',
    '/modules/sensores.js',
    '/modules/bodega.js',
    '/modules/camara.js',
    '/modules/areas/area-desarme.js',
    '/modules/areas/area-calidad.js',
    '/modules/areas/area-mecanica.js',
    '/modules/areas/area-bobinado.js',
    '/modules/areas/area-armado.js',
    '/modules/areas/area-despacho.js',
    '/modules/render.js',
    '/logo.png'
];

// Instalar y cachear archivos principales
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(ARCHIVOS))
    );
    self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: red primero, caché como respaldo
self.addEventListener('fetch', e => {
    // No interceptar peticiones a Firebase
    if (e.request.url.includes('firebase') ||
        e.request.url.includes('firebaseio') ||
        e.request.url.includes('googleapis') ||
        e.request.url.includes('cloudinary')) {
        return;
    }
    e.respondWith(
        fetch(e.request)
            .then(res => {
                const clone = res.clone();
                caches.open(CACHE).then(cache => cache.put(e.request, clone));
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});
