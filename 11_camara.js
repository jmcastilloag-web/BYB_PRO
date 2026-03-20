// ════════════════════════════════════════════════════════════
//  11_camara.js  —  Módulo de Cámara Integrada
//  BYB Norte | Taller de Motores
//
//  Cubre TODOS los módulos que tienen fotos:
//    • 08_fotos.js  → fotos simples (etapas) + componentes + nueva OT
//    • 09_sensores.js → sensores ingreso y salida
//    • 10_bodega.js   → ingreso, entrega y observaciones
//
//  INSTALACIÓN:
//    En index.html, agregar DESPUÉS de 08_fotos.js:
//         import './11_camara.js';
// ════════════════════════════════════════════════════════════

// ── ESTILOS DEL MODAL DE CÁMARA ──────────────────────────────
const _inyectarEstilosCamara = () => {
    if (document.getElementById('camara-styles')) return;
    const style = document.createElement('style');
    style.id = 'camara-styles';
    style.textContent = `
        #camara-overlay {
            position: fixed;
            inset: 0;
            background: #000;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        #camara-header {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: rgba(0,0,0,0.85);
            backdrop-filter: blur(6px);
            border-bottom: 1px solid rgba(255,255,255,0.08);
            flex-shrink: 0;
            box-sizing: border-box;
        }
        #camara-titulo {
            color: #fff;
            font-size: 0.92em;
            font-weight: 600;
            letter-spacing: 0.01em;
            max-width: 55%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #camara-contador {
            background: rgba(0,79,136,0.85);
            color: #fff;
            border-radius: 20px;
            padding: 3px 12px;
            font-size: 0.8em;
            font-weight: 700;
            letter-spacing: 0.02em;
        }
        #camara-btn-cerrar {
            background: rgba(255,255,255,0.12);
            border: none;
            color: #fff;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            font-size: 1.1em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s;
            flex-shrink: 0;
        }
        #camara-btn-cerrar:hover { background: rgba(255,255,255,0.22); }

        #camara-video-wrap {
            flex: 1;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            min-height: 0;
        }
        #camara-video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        /* Líneas de guía en el visor */
        #camara-guia {
            position: absolute;
            inset: 0;
            pointer-events: none;
        }
        #camara-guia::before,
        #camara-guia::after {
            content: '';
            position: absolute;
            background: rgba(255,255,255,0.18);
        }
        #camara-guia::before {
            top: 33.33%; left: 0; right: 0; height: 1px;
        }
        #camara-guia::after {
            top: 66.66%; left: 0; right: 0; height: 1px;
        }
        .camara-guia-v {
            position: absolute;
            top: 0; bottom: 0; width: 1px;
            background: rgba(255,255,255,0.18);
        }
        .camara-guia-v:first-child  { left: 33.33%; }
        .camara-guia-v:last-child   { left: 66.66%; }

        /* Flash de captura */
        #camara-flash {
            position: absolute;
            inset: 0;
            background: #fff;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.06s;
        }
        #camara-flash.activo { opacity: 0.75; }

        /* Controles inferiores */
        #camara-controles {
            width: 100%;
            padding: 16px 20px 22px;
            background: rgba(0,0,0,0.88);
            backdrop-filter: blur(6px);
            border-top: 1px solid rgba(255,255,255,0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-shrink: 0;
            box-sizing: border-box;
        }

        /* Miniaturas de fotos capturadas */
        #camara-preview-strip {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            flex: 1;
            min-width: 0;
            padding-bottom: 2px;
            scrollbar-width: none;
        }
        #camara-preview-strip::-webkit-scrollbar { display: none; }
        .camara-thumb {
            width: 52px;
            height: 52px;
            border-radius: 6px;
            object-fit: cover;
            border: 2px solid rgba(255,255,255,0.3);
            flex-shrink: 0;
            cursor: pointer;
            transition: border-color 0.15s;
        }
        .camara-thumb:hover { border-color: #fff; }

        /* Botón capturar */
        #camara-btn-capturar {
            width: 68px;
            height: 68px;
            border-radius: 50%;
            border: 4px solid #fff;
            background: rgba(255,255,255,0.15);
            cursor: pointer;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.1s, background 0.1s;
            position: relative;
        }
        #camara-btn-capturar:active {
            transform: scale(0.91);
            background: rgba(255,255,255,0.35);
        }
        #camara-btn-capturar::after {
            content: '';
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: #fff;
        }
        #camara-btn-capturar.procesando::after {
            background: #aaa;
        }

        /* Botón girar cámara */
        #camara-btn-girar {
            background: rgba(255,255,255,0.12);
            border: none;
            color: #fff;
            width: 46px;
            height: 46px;
            border-radius: 50%;
            font-size: 1.3em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, transform 0.3s;
            flex-shrink: 0;
        }
        #camara-btn-girar:hover { background: rgba(255,255,255,0.22); }
        #camara-btn-girar.girando { transform: rotate(180deg); }

        /* Botón guardar y cerrar */
        #camara-btn-guardar {
            background: #004F88;
            border: none;
            color: #fff;
            padding: 0 18px;
            height: 46px;
            border-radius: 23px;
            font-size: 0.85em;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.15s, transform 0.1s;
            flex-shrink: 0;
            white-space: nowrap;
        }
        #camara-btn-guardar:hover { background: #0068b5; }
        #camara-btn-guardar:active { transform: scale(0.96); }
        #camara-btn-guardar:disabled {
            background: rgba(255,255,255,0.15);
            cursor: not-allowed;
        }

        /* Toast de mensaje */
        #camara-toast {
            position: absolute;
            bottom: 110px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.78);
            color: #fff;
            padding: 8px 18px;
            border-radius: 20px;
            font-size: 0.82em;
            font-weight: 600;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.25s;
            white-space: nowrap;
        }
        #camara-toast.visible { opacity: 1; }

        /* Botón de cámara inline (el que aparece junto a "Agregar fotos") */
        .camara-btn-inline {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #1a2a3a;
            border: 1px solid #2a3f55;
            border-radius: 4px;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 0.8em;
            color: #fff;
            font-weight: 600;
            font-family: inherit;
            transition: background 0.15s;
            white-space: nowrap;
        }
        .camara-btn-inline:hover { background: #243550; }
    `;
    document.head.appendChild(style);
};

// ── ESTADO INTERNO DEL MÓDULO ─────────────────────────────────
let _stream         = null;   // MediaStream activo
let _facingMode     = 'environment'; // 'environment' = trasera, 'user' = frontal
let _fotosCapturadas = [];    // [Blob, Blob, ...]
let _maxFotos       = 20;
let _callbackSubir  = null;   // función a llamar con los Blobs capturados
let _tituloModal    = 'Cámara';

// Canvas oculto para capturar frames
const _canvas = document.createElement('canvas');
const _ctx    = _canvas.getContext('2d');

// ── ABRIR MODAL DE CÁMARA ─────────────────────────────────────
window._abrirCamara = async (titulo, maxFotos, callbackSubir) => {
    _inyectarEstilosCamara();
    _tituloModal    = titulo || 'Cámara';
    _maxFotos       = maxFotos || 20;
    _callbackSubir  = callbackSubir;
    _fotosCapturadas = [];

    // Crear overlay
    let overlay = document.getElementById('camara-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'camara-overlay';
    overlay.innerHTML = `
        <div id="camara-header">
            <button id="camara-btn-cerrar" title="Cerrar">✕</button>
            <div id="camara-titulo">${_tituloModal}</div>
            <div id="camara-contador">0 / ${_maxFotos}</div>
        </div>
        <div id="camara-video-wrap">
            <video id="camara-video" autoplay playsinline muted></video>
            <div id="camara-guia">
                <div class="camara-guia-v"></div>
                <div class="camara-guia-v"></div>
            </div>
            <div id="camara-flash"></div>
            <div id="camara-toast"></div>
        </div>
        <div id="camara-controles">
            <div id="camara-preview-strip"></div>
            <button id="camara-btn-capturar" title="Capturar foto"></button>
            <button id="camara-btn-girar" title="Cambiar cámara">🔄</button>
            <button id="camara-btn-guardar" disabled>✅ Guardar<br><small id="camara-n-fotos">0 fotos</small></button>
        </div>
    `;
    document.body.appendChild(overlay);

    // Eventos
    document.getElementById('camara-btn-cerrar').onclick  = _cerrarCamara;
    document.getElementById('camara-btn-capturar').onclick = _capturarFoto;
    document.getElementById('camara-btn-girar').onclick   = _girarCamara;
    document.getElementById('camara-btn-guardar').onclick  = _guardarYCerrar;

    // Iniciar stream
    await _iniciarStream();
};

// ── INICIAR STREAM ────────────────────────────────────────────
const _iniciarStream = async () => {
    if (_stream) {
        _stream.getTracks().forEach(t => t.stop());
        _stream = null;
    }
    const video = document.getElementById('camara-video');
    if (!video) return;

    try {
        _stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: _facingMode,
                width:  { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        });
        video.srcObject = _stream;
    } catch (err) {
        console.error('Error cámara:', err);
        _mostrarToast('⚠ No se pudo acceder a la cámara. Verifica permisos.', 4000);
    }
};

// ── GIRAR CÁMARA (frontal ↔ trasera) ─────────────────────────
const _girarCamara = async () => {
    const btn = document.getElementById('camara-btn-girar');
    if (btn) btn.classList.add('girando');
    _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
    await _iniciarStream();
    setTimeout(() => { if (btn) btn.classList.remove('girando'); }, 350);
};

// ── CAPTURAR FOTO ─────────────────────────────────────────────
const _capturarFoto = async () => {
    if (_fotosCapturadas.length >= _maxFotos) {
        _mostrarToast(`Máximo ${_maxFotos} fotos.`);
        return;
    }
    const video = document.getElementById('camara-video');
    if (!video || !video.videoWidth) return;

    const btn = document.getElementById('camara-btn-capturar');
    if (btn) btn.classList.add('procesando');

    // Flash visual
    const flash = document.getElementById('camara-flash');
    if (flash) {
        flash.classList.add('activo');
        setTimeout(() => flash.classList.remove('activo'), 120);
    }

    // Capturar frame
    _canvas.width  = video.videoWidth;
    _canvas.height = video.videoHeight;
    _ctx.drawImage(video, 0, 0);

    // Convertir a Blob comprimido
    _canvas.toBlob(blob => {
        if (!blob) { if (btn) btn.classList.remove('procesando'); return; }
        _fotosCapturadas.push(blob);
        _actualizarUI();
        if (btn) btn.classList.remove('procesando');
    }, 'image/jpeg', 0.82);
};

// ── ACTUALIZAR UI TRAS CAPTURA ────────────────────────────────
const _actualizarUI = () => {
    const n = _fotosCapturadas.length;

    // Contador header
    const cont = document.getElementById('camara-contador');
    if (cont) cont.textContent = `${n} / ${_maxFotos}`;

    // Botón guardar
    const btnG = document.getElementById('camara-btn-guardar');
    if (btnG) {
        btnG.disabled = n === 0;
        const span = document.getElementById('camara-n-fotos');
        if (span) span.textContent = `${n} foto${n !== 1 ? 's' : ''}`;
    }

    // Strip de miniaturas — solo agregar la última (no re-renderizar todo)
    const strip = document.getElementById('camara-preview-strip');
    if (strip && n > 0) {
        const blob = _fotosCapturadas[n - 1];
        const url  = URL.createObjectURL(blob);
        const img  = document.createElement('img');
        img.className = 'camara-thumb';
        img.src = url;
        img.title = `Foto ${n}`;
        // Click para eliminar esa foto
        img.onclick = () => {
            const idx = _fotosCapturadas.indexOf(blob);
            if (idx !== -1) {
                _fotosCapturadas.splice(idx, 1);
                URL.revokeObjectURL(url);
                img.remove();
                _actualizarUI();
            }
        };
        strip.appendChild(img);
        strip.scrollLeft = strip.scrollWidth;
    }
};

// ── GUARDAR Y CERRAR ──────────────────────────────────────────
const _guardarYCerrar = async () => {
    if (_fotosCapturadas.length === 0) return;

    const btnG = document.getElementById('camara-btn-guardar');
    if (btnG) { btnG.disabled = true; btnG.innerHTML = '⏳ Subiendo...'; }

    // Pasar blobs como FileList simulado al callback
    if (typeof _callbackSubir === 'function') {
        await _callbackSubir(_fotosCapturadas.slice());
    }

    _cerrarCamara();
};

// ── CERRAR MODAL ──────────────────────────────────────────────
const _cerrarCamara = () => {
    if (_stream) {
        _stream.getTracks().forEach(t => t.stop());
        _stream = null;
    }
    _fotosCapturadas = [];
    const overlay = document.getElementById('camara-overlay');
    if (overlay) overlay.remove();
};

// ── TOAST ─────────────────────────────────────────────────────
let _toastTimer = null;
const _mostrarToast = (msg, ms = 2200) => {
    const t = document.getElementById('camara-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t?.classList.remove('visible'), ms);
};

// ════════════════════════════════════════════════════════════
//  INTEGRACIONES CON 08_fotos.js
//  Cada función abre la cámara y al guardar usa el mismo
//  flujo de compresión + subida a Cloudinary de 08_fotos.js
// ════════════════════════════════════════════════════════════

// ── A. FOTOS SIMPLES (etapas sin componentes) ─────────────────
window.abrirCamaraSimples = (i, etapa, titulo) => {
    const d       = window.data[i];
    const key     = 'fotos_b64_' + etapa;
    const actuales = (d[key] || []).length;
    const max     = 20;
    const disp    = max - actuales;

    if (disp <= 0) { alert(`Ya tienes ${max} fotos en esta sección.`); return; }

    window._abrirCamara(
        titulo || `📷 ${etapa}`,
        disp,
        async (blobs) => {
            const ot     = d.ot || 'sin_ot';
            const folder = `byb_norte/ot_${ot}/${etapa}`;
            if (!d[key]) d[key] = [];

            // Reutilizar el compresor y subidor de 08_fotos.js
            // comprimirImagen espera un File/Blob-like con .name
            for (const blob of blobs) {
                blob.name = `camara_${Date.now()}.jpg`; // duck-typing
                try {
                    const compressed = await _comprimirBlob(blob);
                    const url = await _subirBlobACloudinary(compressed, folder);
                    d[key].push({ url, ext: 'jpeg', nombre: blob.name });
                } catch (e) {
                    console.error('Error subiendo foto cámara:', e);
                    alert('Error al subir foto: ' + e.message);
                }
            }
            await window.save();
            window.render();
        }
    );
};

// ── B. FOTOS POR COMPONENTE ───────────────────────────────────
window.abrirCamaraComponente = (i, etapa, clave) => {
    const d    = window.data[i];
    const keyP = 'fotos_b64_' + etapa;
    if (!d[keyP])        d[keyP] = {};
    if (!d[keyP][clave]) d[keyP][clave] = [];
    const actuales = d[keyP][clave].length;
    const disp     = 10 - actuales;

    if (disp <= 0) { alert('Ya tienes 10 fotos en este componente.'); return; }

    window._abrirCamara(
        `📷 ${clave}`,
        disp,
        async (blobs) => {
            const ot     = d.ot || 'sin_ot';
            const folder = `byb_norte/ot_${ot}/${etapa}/${clave}`;

            for (const blob of blobs) {
                blob.name = `camara_${Date.now()}.jpg`;
                try {
                    const compressed = await _comprimirBlob(blob);
                    const url = await _subirBlobACloudinary(compressed, folder);
                    d[keyP][clave].push({ url, ext: 'jpeg', nombre: blob.name });
                } catch (e) {
                    console.error('Error subiendo foto componente cámara:', e);
                    alert('Error al subir foto: ' + e.message);
                }
            }
            await window.save();
            window.render();
        }
    );
};

// ── C. FOTOS NUEVA OT ─────────────────────────────────────────
window.abrirCamaraNuevaOT = () => {
    const disp = 20 - window._fotosNuevaOT.length;
    if (disp <= 0) { alert('Ya tienes 20 fotos en la nueva OT.'); return; }

    window._abrirCamara(
        '📷 Fotos Nueva OT',
        disp,
        async (blobs) => {
            for (const blob of blobs) {
                if (window._fotosNuevaOT.length >= 20) break;
                blob.name = `camara_nueva_ot_${Date.now()}.jpg`;
                try {
                    const compressed = await _comprimirBlob(blob);
                    const url = await _subirBlobACloudinary(compressed, 'byb_norte/nueva_ot_temp');
                    window._fotosNuevaOT.push({ url, ext: 'jpeg', nombre: blob.name });
                } catch (e) {
                    console.error('Error foto nueva OT cámara:', e);
                }
            }
            window._refrescarPreviewNuevaOT();
        }
    );
};

// ════════════════════════════════════════════════════════════
//  HELPERS INTERNOS (duplican lógica de 08_fotos.js
//  sin depender de su scope, para no romper nada)
// ════════════════════════════════════════════════════════════
const CLOUD_NAME_CAM    = 'dboystolg';
const UPLOAD_PRESET_CAM = 'fotos_taller';
const CLOUDINARY_URL_CAM = `https://api.cloudinary.com/v1_1/${CLOUD_NAME_CAM}/image/upload`;
const COMP_MAX_PX_CAM   = 1200;
const COMP_QUALITY_CAM  = 0.72;

const _comprimirBlob = (blob) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > COMP_MAX_PX_CAM || h > COMP_MAX_PX_CAM) {
            const r = Math.min(COMP_MAX_PX_CAM / w, COMP_MAX_PX_CAM / h);
            w = Math.round(w * r);
            h = Math.round(h * r);
        }
        const cv  = document.createElement('canvas');
        cv.width  = w;
        cv.height = h;
        const c = cv.getContext('2d');
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, w, h);
        c.drawImage(img, 0, 0, w, h);
        cv.toBlob(b => {
            if (!b) { reject(new Error('No se pudo comprimir')); return; }
            console.log(`📸 Cámara: ${Math.round(blob.size/1024)}KB → ${Math.round(b.size/1024)}KB`);
            resolve(b);
        }, 'image/jpeg', COMP_QUALITY_CAM);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen inválida')); };
    img.src = url;
});

const _subirBlobACloudinary = async (blob, carpeta) => {
    const fd = new FormData();
    fd.append('file', blob, 'foto.jpg');
    fd.append('upload_preset', UPLOAD_PRESET_CAM);
    fd.append('folder', carpeta);
    const resp = await fetch(CLOUDINARY_URL_CAM, { method: 'POST', body: fd });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || `Cloudinary error ${resp.status}`);
    }
    const data = await resp.json();
    return data.secure_url;
};

// ════════════════════════════════════════════════════════════
//  PATCH DE _htmlFotosSimples
//  Sobreescribe la función de 08_fotos.js para agregar
//  el botón de cámara junto a "Agregar fotos"
// ════════════════════════════════════════════════════════════
// Esperamos a que 08_fotos.js haya cargado y luego parchamos
setTimeout(() => {
    const _origHtmlFotosSimples = window._htmlFotosSimples;
    if (!_origHtmlFotosSimples) return;

    window._htmlFotosSimples = (i, etapa, titulo) => {
        let html = _origHtmlFotosSimples(i, etapa, titulo);

        // Inyectar botón cámara justo después del botón "Agregar fotos"
        // El botón de archivo tiene la clase/estilo inline único; buscamos el cierre del label
        const disp = 20 - ((window.data[i]?.['fotos_b64_' + etapa] || []).length);
        if (disp > 0) {
            const btnCam = `<button class="camara-btn-inline"
                onclick="window.abrirCamaraSimples(${i},'${etapa}','${titulo || etapa}')">
                📸 Cámara
            </button>`;
            // Insertar después del primer </label> del bloque de agregar
            html = html.replace(/(<\/label>)(\s*<\/div>)$/, `$1 ${btnCam}$2`);
        }
        return html;
    };
    console.log('✅ 11_camara.js — _htmlFotosSimples parchado');
}, 200);

// ════════════════════════════════════════════════════════════
//  HELPER PÚBLICO: genera botón cámara para componentes
//  Usar en 07_render.js junto al botón 📷 existente:
//
//    ${window._btnCamaraComponente(i, etapa, clave)}
//
// ════════════════════════════════════════════════════════════
window._btnCamaraComponente = (i, etapa, clave) =>
    `<button class="camara-btn-inline"
        onclick="window.abrirCamaraComponente(${i},'${etapa}','${clave}')">
        📸 Cámara
    </button>`;

// Botón para nueva OT (usar en el formulario de nueva OT)
window._btnCamaraNuevaOT = () =>
    `<button class="camara-btn-inline"
        onclick="window.abrirCamaraNuevaOT()">
        📸 Cámara
    </button>`;

console.log('✅ 11_camara.js — Módulo de cámara integrado');

// ════════════════════════════════════════════════════════════
//  INTEGRACIÓN 09_sensores.js
//  Funciones para abrir cámara en sensores de ingreso y salida
// ════════════════════════════════════════════════════════════

window.abrirCamaraSensorIngreso = (i, si) => {
    const sensores = window.data[i]?.sensores_ingreso || [];
    const actuales = (sensores[si]?.fotos || []).length;
    const disp = 5 - actuales;
    if (disp <= 0) { alert('Máximo 5 fotos por sensor.'); return; }

    window._abrirCamara(
        `Sensor ${si + 1} — Ingreso`,
        disp,
        async (blobs) => {
            const d = window.data[i];
            const ot = d.ot || 'sin_ot';
            if (!d.sensores_ingreso[si].fotos) d.sensores_ingreso[si].fotos = [];
            for (const blob of blobs) {
                blob.name = `camara_sensor_ing_${si}_${Date.now()}.jpg`;
                try {
                    const compressed = await _comprimirBlob(blob);
                    const url = await _subirBlobACloudinary(compressed, `byb_norte/ot_${ot}/sensor_ing_${si}`);
                    d.sensores_ingreso[si].fotos.push({ url, ext: 'jpeg' });
                } catch (e) { alert('Error al subir foto: ' + e.message); }
            }
            await window.save();
            window.render();
        }
    );
};

window.abrirCamaraSensorSalida = (i, si) => {
    const d = window.data[i];
    const actuales = (d.sensores_salida_fotos?.[si] || []).length;
    const disp = 5 - actuales;
    if (disp <= 0) { alert('Máximo 5 fotos por sensor.'); return; }

    window._abrirCamara(
        `Sensor ${si + 1} — Salida`,
        disp,
        async (blobs) => {
            const ot = d.ot || 'sin_ot';
            if (!d.sensores_salida_fotos) d.sensores_salida_fotos = {};
            if (!d.sensores_salida_fotos[si]) d.sensores_salida_fotos[si] = [];
            for (const blob of blobs) {
                blob.name = `camara_sensor_sal_${si}_${Date.now()}.jpg`;
                try {
                    const compressed = await _comprimirBlob(blob);
                    const url = await _subirBlobACloudinary(compressed, `byb_norte/ot_${ot}/sensor_sal_${si}`);
                    d.sensores_salida_fotos[si].push({ url, ext: 'jpeg' });
                } catch (e) { alert('Error al subir foto: ' + e.message); }
            }
            await window.save();
            window.render();
        }
    );
};

// Parchar htmlSensoresIngreso para inyectar botón 📸 junto a cada 📷
setTimeout(() => {
    const _origIng = window.htmlSensoresIngreso;
    if (!_origIng) return;
    window.htmlSensoresIngreso = (i) => {
        let html = _origIng(i);
        const sensores = window.data[i]?.sensores_ingreso || [];
        sensores.forEach((s, si) => {
            if ((s.fotos || []).length < 5) {
                const id = `btn_sensor_foto_ingreso_${i}_${si}`;
                const btnCam = `<button class="camara-btn-inline" style="font-size:0.72em;padding:2px 6px;margin-left:3px;" onclick="window.abrirCamaraSensorIngreso(${i},${si})">📸</button>`;
                html = html.replace(new RegExp(`(id="${id}"[^>]*>[\\s\\S]*?<\\/label>)`), `$1 ${btnCam}`);
            }
        });
        return html;
    };
    console.log('✅ 11_camara.js — htmlSensoresIngreso parchado');
}, 400);

setTimeout(() => {
    const _origSal = window.htmlSensoresSalida;
    if (!_origSal) return;
    window.htmlSensoresSalida = (i) => {
        let html = _origSal(i);
        const sensoresIng = window.data[i]?.sensores_ingreso || [];
        const fotosSal    = window.data[i]?.sensores_salida_fotos || {};
        sensoresIng.forEach((s, si) => {
            if ((fotosSal[si] || []).length < 5) {
                const id = `btn_sensor_foto_salida_${i}_${si}`;
                const btnCam = `<button class="camara-btn-inline" style="font-size:0.72em;padding:2px 6px;margin-left:3px;" onclick="window.abrirCamaraSensorSalida(${i},${si})">📸</button>`;
                html = html.replace(new RegExp(`(id="${id}"[^>]*>[\\s\\S]*?<\\/label>)`), `$1 ${btnCam}`);
            }
        });
        return html;
    };
    console.log('✅ 11_camara.js — htmlSensoresSalida parchado');
}, 400);


// ════════════════════════════════════════════════════════════
//  INTEGRACIÓN 10_bodega.js
//  Bodega usa Firebase Storage, no Cloudinary.
//  La cámara comprime los blobs y los deja listos para que
//  bodega los suba junto a los files normales del input.
// ════════════════════════════════════════════════════════════

window._bodegaCamaraBlobs = {};

window.abrirCamaraBodega = (inputId, previewId, max = 10) => {
    if (!window._bodegaCamaraBlobs[inputId]) window._bodegaCamaraBlobs[inputId] = [];
    const disp = max - window._bodegaCamaraBlobs[inputId].length;
    if (disp <= 0) { alert(`Máximo ${max} fotos.`); return; }

    window._abrirCamara('📸 Cámara', disp, async (blobs) => {
        for (const blob of blobs) {
            try {
                const compressed = await _comprimirBlob(blob);
                window._bodegaCamaraBlobs[inputId].push(compressed);
            } catch(e) { console.error('Error comprimiendo foto bodega:', e); }
        }
        window._refrescarPreviewBodegaPublic(inputId, previewId);
    });
};

window._refrescarPreviewBodegaPublic = (inputId, previewId) => {
    if (!previewId) return;
    const prev = document.getElementById(previewId);
    if (!prev) return;
    const blobs = window._bodegaCamaraBlobs[inputId] || [];
    prev.innerHTML = blobs.map((blob, bi) => {
        const url = URL.createObjectURL(blob);
        return `<div style="position:relative;display:inline-block;margin:2px;">
            <img src="${url}" style="width:54px;height:54px;object-fit:cover;border-radius:5px;border:1.5px solid #b0c8e8;">
            <button onclick="window._bodegaCamaraBlobs['${inputId}'].splice(${bi},1);window._refrescarPreviewBodegaPublic('${inputId}','${previewId}')"
                style="position:absolute;top:-4px;right:-4px;background:#e74c3c;color:white;border:none;border-radius:50%;width:15px;height:15px;font-size:9px;cursor:pointer;line-height:15px;padding:0;text-align:center;">✕</button>
        </div>`;
    }).join('');
};

// Retorna y limpia los blobs capturados para un inputId
window._getBodegaCamaraBlobs = (inputId) => {
    const blobs = window._bodegaCamaraBlobs[inputId] || [];
    window._bodegaCamaraBlobs[inputId] = [];
    return blobs;
};

console.log('✅ 11_camara.js — Sensores y Bodega listos');
