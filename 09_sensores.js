// ════════════════════════════════════════════════════════════
//  09_sensores.js — Módulo de Sensores
//  BYB Norte | Taller de Motores
// ════════════════════════════════════════════════════════════

const TIPOS_SENSOR = ['PT100', 'RTD', 'Termistor PTC', 'Termistor NTC', 'Calefactor', 'Termostato', 'Termopar', 'Otro'];
const UBICACIONES_SENSOR = ['Lado Carga (LC)', 'Lado Libre (LL)', 'Tapa LC', 'Tapa LL', 'Carcasa', 'Sin ubicación fija'];

const _getSensoresIng = (i) => {
    if (!window.data[i].sensores_ingreso) window.data[i].sensores_ingreso = [];
    return window.data[i].sensores_ingreso;
};

const _saveSensores = () => window.save();

// ── FUNCIONES PÚBLICAS — INGRESO ─────────────────────────────
window.sensorAgregarIngreso = (i) => {
    const sensores = _getSensoresIng(i);
    sensores.push({ tipo: 'PT100', ubicacion: 'Lado Carga (LC)', resistencia: '', continuidad: '', estado: 'na', obs: '', fotos: [] });
    _saveSensores();
    window.render();
};

window.sensorEliminarIngreso = (i, si) => {
    if(!confirm("¿Eliminar este sensor?")) return;
    const sensores = _getSensoresIng(i);
    sensores.splice(si, 1);
    _saveSensores();
    window.render();
};

window.sensorGuardarCampo = (i, si, campo, valor) => {
    const sensores = _getSensoresIng(i);
    if (!sensores[si]) return;
    sensores[si][campo] = valor;
    _saveSensores();
};

window.sensorGuardarSalida = (i, si, campo, valor) => {
    if (!window.data[i].sensores_salida) window.data[i].sensores_salida = {};
    if (!window.data[i].sensores_salida[si]) window.data[i].sensores_salida[si] = { fotos: [] };
    window.data[i].sensores_salida[si][campo] = valor;
    _saveSensores();
};

// ── GESTIÓN DE FOTOGRAFÍAS (CLOUDINARY) ──────────────────────

window.sensorSubirFoto = async (i, si, tipo, input) => {
    const files = input.files;
    if (!files.length) return;

    let sensor;
    if (tipo === 'ingreso') {
        sensor = _getSensoresIng(i)[si];
    } else {
        if (!window.data[i].sensores_salida) window.data[i].sensores_salida = {};
        if (!window.data[i].sensores_salida[si]) window.data[i].sensores_salida[si] = { fotos: [] };
        sensor = window.data[i].sensores_salida[si];
    }
    if (!sensor.fotos) sensor.fotos = [];

    const label = input.parentElement;
    label.style.opacity = "0.5";
    label.innerText = "⏳...";

    for (let file of files) {
        if (sensor.fotos.length >= 5) break;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'fotos_taller'); 
        formData.append('folder', 'byb_norte');

        try {
            const resp = await fetch('https://api.cloudinary.com/v1_1/dboystolg/image/upload', {
                method: 'POST',
                body: formData
            });
            const resData = await resp.json();
            if (resData.secure_url) {
                // GUARDAMOS EL OBJETO CON LA URL PARA QUE EL RENDER LO ENCUENTRE
                sensor.fotos.push({ url: resData.secure_url });
            }
        } catch (err) {
            console.error("Error:", err);
        }
    }
    _saveSensores();
    window.render();
};

window.sensorEliminarFoto = (i, si, fotoIndex, tipo) => {
    if(!confirm("¿Eliminar foto?")) return;
    let sensor;
    if (tipo === 'ingreso') {
        sensor = _getSensoresIng(i)[si];
    } else {
        sensor = window.data[i].sensores_salida ? window.data[i].sensores_salida[si] : null;
    }
    if (sensor && sensor.fotos) {
        sensor.fotos.splice(fotoIndex, 1);
        _saveSensores();
        window.render();
    }
};

// ── RENDER HTML (CORREGIDO) ──────────────────────────────────

window.htmlSensoresIngreso = (i) => {
    const sensores = window.data[i]?.sensores_ingreso || [];
    const filas = sensores.map((s, si) => {
        const fotosHtml = (s.fotos || []).map((f, fi) => {
            const url = f.url || f; // Maneja si es objeto o string
            return `<div style="position:relative;display:inline-block;margin:2px;">
                <img src="${url}" style="width:45px;height:45px;object-fit:cover;border-radius:4px;border:1px solid #004F88;">
                <button onclick="window.sensorEliminarFoto(${i},${si},${fi},'ingreso')" 
                    style="position:absolute;top:-5px;right:-5px;background:red;color:white;border:none;border-radius:50%;width:15px;height:15px;font-size:9px;cursor:pointer;">✕</button>
            </div>`;
        }).join('');

        return `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:5px;"><select onchange="window.sensorGuardarCampo(${i},${si},'tipo',this.value)" style="width:100%;">${TIPOS_SENSOR.map(t=>`<option value="${t}" ${s.tipo===t?'selected':''}>${t}</option>`).join('')}</select></td>
            <td style="padding:5px;"><select onchange="window.sensorGuardarCampo(${i},${si},'ubicacion',this.value)" style="width:100%;">${UBICACIONES_SENSOR.map(u=>`<option value="${u}" ${s.ubicacion===u?'selected':''}>${u}</option>`).join('')}</select></td>
            <td style="padding:5px;"><input type="text" value="${s.resistencia||''}" placeholder="Ω" style="width:50px;text-align:center;" onblur="window.sensorGuardarCampo(${i},${si},'resistencia',this.value)"></td>
            <td style="padding:5px;text-align:center;">
                <select onchange="window.sensorGuardarCampo(${i},${si},'continuidad',this.value)">
                    <option value="" ${!s.continuidad?'selected':''}>-</option>
                    <option value="si" ${s.continuidad==='si'?'selected':''}>SI</option>
                    <option value="no" ${s.continuidad==='no'?'selected':''}>NO</option>
                </select>
            </td>
            <td style="padding:5px;text-align:center;">
                <input type="radio" name="est_ing_${i}_${si}" ${s.estado==='bueno'?'checked':''} onchange="window.sensorGuardarCampo(${i},${si},'estado','bueno')"> B
                <input type="radio" name="est_ing_${i}_${si}" ${s.estado==='malo'?'checked':''} onchange="window.sensorGuardarCampo(${i},${si},'estado','malo')"> M
            </td>
            <td style="padding:5px;"><input type="text" value="${s.obs||''}" style="width:100%;" onblur="window.sensorGuardarCampo(${i},${si},'obs',this.value)"></td>
            <td style="padding:5px;">
                <div style="display:flex;align-items:center;gap:4px;">
                    ${fotosHtml}
                    ${(s.fotos||[]).length < 5 ? `<label style="cursor:pointer;background:#e8f0fe;padding:2px 5px;border-radius:3px;font-size:12px;">📷<input type="file" style="display:none;" onchange="window.sensorSubirFoto(${i},${si},'ingreso',this)"></label>` : ''}
                </div>
            </td>
            <td style="padding:5px;"><button onclick="window.sensorEliminarIngreso(${i},${si})" style="color:red;border:none;background:none;cursor:pointer;">✕</button></td>
        </tr>`;
    }).join('');

    return `<div style="margin-top:15px;padding:10px;border:1px solid #b0c8e8;border-radius:8px;background:#f0f6ff;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><b style="color:#004F88;">🌡️ Sensores Ingreso</b> <button onclick="window.sensorAgregarIngreso(${i})">+ Agregar</button></div>
        <table style="width:100%;font-size:0.85em;border-collapse:collapse;">
            <thead style="background:#004F88;color:white;"><tr><th>Tipo</th><th>Ubicación</th><th>Ω</th><th>Cont.</th><th>Est.</th><th>Obs.</th><th>Fotos</th><th></th></tr></thead>
            <tbody>${filas}</tbody>
        </table>
    </div>`;
};

window.htmlSensoresSalida = (i) => {
    const sensoresIng = window.data[i]?.sensores_ingreso || [];
    const datosSalida = window.data[i]?.sensores_salida || {};

    if (sensoresIng.length === 0) return '';

    const filas = sensoresIng.map((s, si) => {
        const sal = datosSalida[si] || { fotos: [] };
        const fotosHtml = (sal.fotos || []).map((f, fi) => {
            const url = f.url || f;
            return `<div style="position:relative;display:inline-block;margin:2px;">
                <img src="${url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #1a6b2e;">
                <button onclick="window.sensorEliminarFoto(${i},${si},${fi},'salida')" 
                    style="position:absolute;top:-5px;right:-5px;background:red;color:white;border:none;border-radius:50%;width:15px;height:15px;font-size:9px;cursor:pointer;">✕</button>
            </div>`;
        }).join('');

        return `<tr style="border-bottom:1px solid #eee;">
            <td style="font-weight:bold;">${s.tipo}</td>
            <td>${s.ubicacion}</td>
            <td style="text-align:center;color:#888;">${s.resistencia||'—'}</td>
            <td><input type="text" value="${sal.resistencia||''}" placeholder="Ω Sal" style="width:50px;" onblur="window.sensorGuardarSalida(${i},${si},'resistencia',this.value)"></td>
            <td style="padding:5px;text-align:center;">
                <input type="radio" name="est_sal_${i}_${si}" ${sal.estado==='bueno'?'checked':''} onchange="window.sensorGuardarSalida(${i},${si},'estado','bueno')"> B
                <input type="radio" name="est_sal_${i}_${si}" ${sal.estado==='malo'?'checked':''} onchange="window.sensorGuardarSalida(${i},${si},'estado','malo')"> M
            </td>
            <td><input type="text" value="${sal.obs||''}" style="width:100%;" onblur="window.sensorGuardarSalida(${i},${si},'obs',this.value)"></td>
            <td>
                <div style="display:flex;align-items:center;gap:4px;">
                    ${fotosHtml}
                    ${(sal.fotos||[]).length < 5 ? `<label style="cursor:pointer;background:#e8f0fe;padding:2px 5px;border-radius:3px;font-size:12px;">📷<input type="file" style="display:none;" onchange="window.sensorSubirFoto(${i},${si},'salida',this)"></label>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');

    return `<div style="margin-top:15px;padding:10px;border:1px solid #a0d8b0;border-radius:8px;background:#f0fff4;">
        <b style="color:#1a6b2e;">🌡️ Sensores Salida (Confirmación)</b>
        <table style="width:100%;font-size:0.85em;border-collapse:collapse;margin-top:8px;">
            <thead style="background:#1a6b2e;color:white;"><tr><th>Tipo</th><th>Ubicación</th><th>Ing.</th><th>Ω Sal</th><th>Est.</th><th>Obs.</th><th>Fotos</th></tr></thead>
            <tbody>${filas}</tbody>
        </table>
    </div>`;
};

console.log('✅ 09_sensores.js actualizado con Cloudinary');
