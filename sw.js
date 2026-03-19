// sw.js — Service Worker BYB North
const CACHE = 'byb-north-v1';
const ARCHIVOS = [
    '/',
    '/index.html',
    '/estilos.css',
    '/01_firebase.js',
    '/02_auth.js',
    '/03_usuarios.js',
    '/04_helpers.js',
    '/05_docx.js',
    '/06_tareas.js',
    '/07_render.js',
    '/08_fotos.js',
    '/09_sensores.js',
    '/10_bodega.js',
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
