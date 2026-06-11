
    // ── Vista Galería de Fotos ──
    if (window.vistaActual === 'fotos') {
        v.innerHTML = '<div class="card"><div id="fotos-vista-mount"></div></div>';
        import('./fotos_vista.js').then(({ renderVistaFotos, inyectarEstilosFotos }) => {
            inyectarEstilosFotos();
            const mount = document.getElementById('fotos-vista-mount');
            if (mount) renderVistaFotos(mount);
        }).catch(err => {
            v.innerHTML = `<div class="card"><p style="color:red;">Error cargando galería: ${err.message}</p></div>`;
        });
    }
};

// ── Vista Chat (agregado) ──
(function() {
    const _origRender = window.render;
    if (!_origRender) return;
    window.render = function() {
        _origRender();
        if (window.vistaActual === 'chat') {
            const v = document.getElementById('vista');
            if (!v) return;
            if (typeof window._chatDestroyFn === 'function') { window._chatDestroyFn(); window._chatDestroyFn = null; }
            v.innerHTML = '<div id="chat-mount"></div>';
            import('./chat.js').then(({ initChat, destroyChat }) => {
                const mount = document.getElementById('chat-mount');
                if (mount) initChat(mount);
                window._chatDestroyFn = destroyChat;
            }).catch(err => {
                v.innerHTML = `<div class="card"><p style="color:red;">Error cargando chat: ${err.message}</p></div>`;
            });
        }
    };
})();
