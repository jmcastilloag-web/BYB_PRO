// ============================================================
// SERVICE WORKER — BYB North
// Si agregas nuevos archivos JS, agrégalos aquí también
// para que funcionen offline correctamente
// ============================================================

const CACHE = 'byb-north-v4';

const ARCHIVOS = [
    '/',
    '/index.html',

    /* Estilos */
    '/ui/styles.css',

    /* Configuración */
    '/config/firebase.js',

    /* Autenticación */
    '/auth/auth.js',
    '/auth/usuarios.js',

    /* Módulos base */
    '/modules/helpers.js',
    '/modules/tareas.js',
    '/modules/fotos.js',
    '/modules/sensores.js',
    '/modules/camara.js',
    '/modules/bodega.js',

    /* Documentos */
    '/docs/docx.js',

    /* Áreas del taller — agrega aquí si creas nuevas */
    '/modules/areas/area-desarme.js',
    '/modules/areas/area-calidad.js',
    '/modules/areas/area-mecanica.js',
    '/modules/areas/area-bobinado.js',
    '/modules/areas/area-armado.js',
    '/modules/areas/area-despacho.js',

    /* Render central */
    '/modules/render.js',

    /* Assets */
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
    // No interceptar peticiones a Firebase ni externos
    if (e.request.url.includes('firebase') ||
        e.request.url.includes('firebaseio') ||
        e.request.url.includes('googleapis') ||
        e.request.url.includes('cloudinary') ||
        e.request.url.includes('fonts.googleapis') ||
        e.request.url.includes('gstatic.com')) {
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
