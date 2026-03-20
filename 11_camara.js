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
        /* ── Overlay base ── */
        #camara-overlay {
            position: fixed;
            inset: 0;
            background: #000;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            overflow: hidden;
        }

        /* ── Contenedor interior ── */
        #camara-inner {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            background: #000;
        }

        /* ── Video ocupa todo el espacio disponible ── */
        #camara-visor-wrap {
            flex: 1;
            position: relative;
            overflow: hidden;
            background: #111;
            min-height: 0;
        }
        #camara-video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        /* Líneas de guía */
        #camara-guia {
            position: absolute;
            inset: 0;
            pointer-events: none;
        }
        #camara-guia::before, #camara-guia::after {
            content: '';
            position: absolute;
            background: rgba(255,255,255,0.15);
        }
        #camara-guia::before { top: 33.33%; left: 0; right: 0; height: 1px; }
        #camara-guia::after  { top: 66.66%; left: 0; right: 0; height: 1px; }
        .camara-guia-v { position:absolute; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.15); }
        .camara-guia-v:first-child { left: 33.33%; }
        .camara-guia-v:last-child  { left: 66.66%; }

        /* Flash */
        #camara-flash {
            position: absolute;
            inset: 0;
            background: #fff;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.06s;
        }
        #camara-flash.activo { opacity: 0.75; }

        /* Toast */
        #camara-toast {
            position: absolute;
            bottom: 12px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.78);
            color: #fff;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 600;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.25s;
            white-space: nowrap;
            z-index: 2;
        }
        #camara-toast.visible { opacity: 1; }

        /* ── Barra superior ── */
        #camara-header {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: rgba(0,0,0,0.92);
            box-sizing: border-box;
            flex-shrink: 0;
            gap: 8px;
        }
        #camara-titulo {
            color: #fff;
            font-size: 0.88em;
            font-weight: 600;
            flex: 1;
            text-align: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #camara-contador {
            background: #004F88;
            color: #fff;
            border-radius: 20px;
            padding: 3px 10px;
            font-size: 0.78em;
            font-weight: 700;
            white-space: nowrap;
        }
        #camara-btn-cerrar {
            background: rgba(255,255,255,0.15);
            border: none;
            color: #fff;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            font-size: 0.95em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        /* ── Controles inferiores ── */
        #camara-controles {
            width: 100%;
            padding: 10px 16px 14px;
            background: rgba(0,0,0,0.92);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            box-sizing: border-box;
            flex-shrink: 0;
        }

        /* Strip miniaturas 4:3 */
        #camara-preview-strip {
            display: flex;
            gap: 5px;
            overflow-x: auto;
            flex: 1;
            min-width: 0;
            scrollbar-width: none;
        }
        #camara-preview-strip::-webkit-scrollbar { display: none; }
        .camara-thumb {
            width: 53px;
            height: 40px;
            border-radius: 4px;
            object-fit: cover;
            border: 2px solid rgba(255,255,255,0.35);
            flex-shrink: 0;
            cursor: pointer;
        }

        /* Botón capturar */
        #camara-btn-capturar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 4px solid #fff;
            background: rgba(255,255,255,0.15);
            cursor: pointer;
            flex-shrink: 0;
            position: relative;
            transition: transform 0.1s, background 0.1s;
        }
        #camara-btn-capturar:active { transform: scale(0.91); }
        #camara-btn-capturar::after {
            content: '';
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #fff;
        }
        #camara-btn-capturar.procesando::after { background: #aaa; }

        /* Botón girar */
        #camara-btn-girar {
            background: rgba(255,255,255,0.12);
            border: none;
            color: #fff;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 1.1em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s;
            flex-shrink: 0;
        }
        #camara-btn-girar.girando { transform: rotate(180deg); }

        /* Botón guardar */
        #camara-btn-guardar {
            background: #004F88;
            border: none;
            color: #fff;
            padding: 0 12px;
            height: 40px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 700;
            cursor: pointer;
            flex-shrink: 0;
            white-space: nowrap;
            line-height: 1.2;
            text-align: center;
        }
        #camara-btn-guardar:disabled { background: rgba(255,255,255,0.15); cursor: not-allowed; }

        /* Botón inline junto a Agregar fotos */
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
    _tituloModal     = titulo || 'Cámara';
    _maxFotos        = maxFotos || 20;
    _callbackSubir   = callbackSubir;
    _fotosCapturadas = [];

    // Bloquear orientación landscape al abrir
    try {
        await screen.orientation.lock('landscape');
    } catch(e) {
        // No todos los navegadores lo soportan — continuar igual
        console.log('orientation lock no soportado:', e.message);
    }

    // Crear overlay
    let overlay = document.getElementById('camara-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'camara-overlay';
    overlay.innerHTML = `
        <div id="camara-inner">
            <div id="camara-header">
                <button id="camara-btn-cerrar" title="Cerrar">✕</button>
                <div id="camara-titulo">${_tituloModal}</div>
                <div id="camara-contador">0 / ${_maxFotos}</div>
            </div>
            <div id="camara-visor-wrap">
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
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('camara-btn-cerrar').onclick   = _cerrarCamara;
    document.getElementById('camara-btn-capturar').onclick = _capturarFoto;
    document.getElementById('camara-btn-girar').onclick    = _girarCamara;
    document.getElementById('camara-btn-guardar').onclick  = _guardarYCerrar;

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
            video: { facingMode: _facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
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

    // Capturar siempre en landscape 4:3 — rotar si el video llega portrait
    const vW = video.videoWidth;
    const vH = video.videoHeight;

    if (vH > vW) {
        // Video portrait → rotar 90° para obtener landscape
        _canvas.width  = vH;
        _canvas.height = vW;
        _ctx.save();
        _ctx.translate(vH / 2, vW / 2);
        _ctx.rotate(Math.PI / 2);
        _ctx.drawImage(video, -vW / 2, -vH / 2, vW, vH);
        _ctx.restore();
    } else {
        // Ya es landscape, capturar directo
        _canvas.width  = vW;
        _canvas.height = vH;
        _ctx.drawImage(video, 0, 0);
    }

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
    // Restaurar orientación libre
    try { screen.orientation.unlock(); } catch(e) {}
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

// Lee orientación EXIF del blob (devuelve 1-8, o 1 si no hay)
const _leerOrientacionExif = (blob) => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const view = new DataView(e.target.result);
        // Verificar marcador JPEG
        if (view.getUint16(0, false) !== 0xFFD8) { resolve(1); return; }
        let offset = 2;
        while (offset < view.byteLength) {
            const marker = view.getUint16(offset, false);
            offset += 2;
            if (marker === 0xFFE1) { // APP1 — puede contener EXIF
                if (view.getUint32(offset + 2, false) !== 0x45786966) { resolve(1); return; }
                const little = view.getUint16(offset + 8, false) === 0x4949;
                const ifdOffset = view.getUint32(offset + 14, little);
                const entries  = view.getUint16(offset + 8 + ifdOffset, little);
                for (let i = 0; i < entries; i++) {
                    const tag = view.getUint16(offset + 8 + ifdOffset + 2 + (i * 12), little);
                    if (tag === 0x0112) { // Orientation tag
                        resolve(view.getUint16(offset + 8 + ifdOffset + 2 + (i * 12) + 8, little));
                        return;
                    }
                }
                resolve(1); return;
            } else if ((marker & 0xFF00) !== 0xFF00) { break; }
            else { offset += view.getUint16(offset, false); }
        }
        resolve(1);
    };
    reader.onerror = () => resolve(1);
    // Solo leer los primeros 64KB (el EXIF siempre está al inicio)
    reader.readAsArrayBuffer(blob.slice(0, 65536));
});

// Comprime blob, corrige rotación EXIF, y FUERZA landscape (ancho > alto)
const _comprimirBlob = async (blob) => {
    const orientacion = await _leerOrientacionExif(blob);

    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);

            // Dimensiones originales
            let srcW = img.naturalWidth;
            let srcH = img.naturalHeight;

            // ¿Hay que rotar 90° o 270° por EXIF?
            // orientaciones 5,6,7,8 implican rotación de 90/270°
            const rotar90 = [5, 6, 7, 8].includes(orientacion);

            // Si hay rotación EXIF, el ancho/alto "real" se invierte
            let realW = rotar90 ? srcH : srcW;
            let realH = rotar90 ? srcW : srcH;

            // Si sigue portrait tras corrección EXIF → rotar 90° para forzar landscape
            const forzarGiro = realH > realW;
            if (forzarGiro) { [realW, realH] = [realH, realW]; }

            // Escalar si supera el máximo
            let outW = realW, outH = realH;
            if (outW > COMP_MAX_PX_CAM || outH > COMP_MAX_PX_CAM) {
                const r = Math.min(COMP_MAX_PX_CAM / outW, COMP_MAX_PX_CAM / outH);
                outW = Math.round(outW * r);
                outH = Math.round(outH * r);
            }

            const cv = document.createElement('canvas');
            cv.width  = outW;
            cv.height = outH;
            const c = cv.getContext('2d');
            c.fillStyle = '#ffffff';
            c.fillRect(0, 0, outW, outH);

            // Aplicar transformación combinada: corrección EXIF + forzar landscape
            c.save();
            c.translate(outW / 2, outH / 2);

            // Ángulo de rotación total
            let angulo = 0;
            if (orientacion === 3)           angulo = Math.PI;          // 180°
            else if (orientacion === 6)      angulo = Math.PI / 2;      // 90° CW
            else if (orientacion === 8)      angulo = -Math.PI / 2;     // 90° CCW
            else if (orientacion === 5)      angulo = -Math.PI / 2;
            else if (orientacion === 7)      angulo = Math.PI / 2;
            if (forzarGiro) angulo += Math.PI / 2; // +90° para forzar landscape

            c.rotate(angulo);

            // Volteo horizontal para orientaciones 2,4,5,7
            if ([2, 4, 5, 7].includes(orientacion)) c.scale(-1, 1);

            // Dibujar centrando la imagen original
            c.drawImage(img, -srcW / 2, -srcH / 2, srcW, srcH);
            c.restore();

            cv.toBlob(b => {
                if (!b) { reject(new Error('No se pudo comprimir')); return; }
                console.log(`📸 Cámara: ${Math.round(blob.size/1024)}KB → ${Math.round(b.size/1024)}KB | orientación EXIF:${orientacion} landscape:${outW}x${outH}`);
                resolve(b);
            }, 'image/jpeg', COMP_QUALITY_CAM);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen inválida')); };
        img.src = url;
    });
};

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
