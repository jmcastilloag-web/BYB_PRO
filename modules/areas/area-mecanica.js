// ============================================================
// ÁREA: MECÁNICA
// ¿Qué cambiar aquí?
//   - Campos de metrología (rodamientos, medidas)
//   - Tareas mecánicas del taller
//   - Fotos del área mecánica
//   - Botones de avance de flujo de mecánica
// ============================================================

window.renderAreaMecanica = (d, i, obs) => {
    let UI = "";

    if (d.estado === 'ingresos_pendientes') {
        UI = `<h3>Metrología e Ingreso</h3>
            <div style="background:#f9f9f9; padding:10px; border-radius:5px; margin-bottom:10px;">
                <strong>🔩 Rodamientos</strong>
                <p style="font-size:0.8em;color:#888;margin:4px 0 8px;">Agrega todos los rodamientos que requiere el motor.</p>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <input id="rod_pos_${i}" class="med-input" style="width:100px;" placeholder="Posición" list="rod_pos_list">
                    <datalist id="rod_pos_list"><option value="LC"><option value="LL"><option value="LC/LL"><option value="Freno"><option value="Encoder"></datalist>
                    <input id="rod_mod_${i}" class="med-input" style="flex:1;" placeholder="Modelo rodamiento (Ej: 6205-2RS)"
                        onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarRodamiento(${i});}">
                    <button onclick="window.agregarRodamiento(${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                </div>
                <div id="rod_lista_${i}">
                    ${(d.rodamientos||[]).map((r,ri) => `
                        <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #e0e0e0;">
                            <span style="background:#004F88;color:white;border-radius:4px;padding:2px 8px;font-size:0.78em;font-weight:700;min-width:40px;text-align:center;">${r.pos}</span>
                            <span style="flex:1;font-size:0.88em;">${r.mod}</span>
                            <button onclick="window.quitarRodamiento(${i},${ri})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1em;">✕</button>
                        </div>`).join('')}
                </div>
            </div>` + (window._htmlMetrologiaIngreso ? window._htmlMetrologiaIngreso(d, i) : '') + `
            ${obs('mecanica_ing')}
            <div class="det-seccion-titulo" style="margin-top:10px;">📐 Tareas de Metrología</div>
            <div style="background:#f0f4ff;border:1px solid #c0d0f0;border-radius:6px;padding:10px;margin-bottom:10px;">
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <input id="tarea_mecanica_ing_${i}" class="med-input" style="flex:1;" placeholder="Ej: Toma de medidas, Registro dimensional..."
                        onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTarea('mecanica_ing',${i});}" >
                    <button onclick="window.agregarTarea('mecanica_ing',${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                </div>
                <div id="tarea_mecanica_ing_lista_${i}">
                    ${(d.tareas_mecanica_ing||[]).map((item,ti) => {
                        const meta    = (d.tareas_mecanica_ing_meta||[])[ti] || {};
                        const chk     = (d.tareas_mecanica_ing_checks||{})[ti];
                        const chkMeta = (d.tareas_mecanica_ing_checks_meta||{})[ti];
                        return `
                        <div style="display:flex;align-items:flex-start;gap:6px;padding:5px 0;border-bottom:1px solid #d0dcf8;">
                            <label style="flex:1;display:flex;align-items:flex-start;gap:6px;cursor:pointer;">
                                <input type="checkbox" ${chk?'checked':''} style="margin-top:2px;"
                                    onchange="window._marcarTarea('mecanica_ing',${i},${ti},this.checked);">
                                <span style="font-size:0.87em;${chk?'text-decoration:line-through;color:#888;':''}">${item}
                                    ${meta.nombre ? `<span style="font-size:0.7em;color:#1a6ba0;background:#e8f4fd;border:1px solid #b0d4f0;border-radius:3px;padding:1px 4px;margin-left:3px;">👤 ${meta.nombre} · ${meta.ts||''}</span>` : ''}
                                    ${chk && chkMeta ? `<span style="font-size:0.7em;color:#27ae60;margin-left:3px;">✅ ${chkMeta.nombre} · ${chkMeta.ts||''}</span>` : ''}
                                </span>
                            </label>
                            <button onclick="window.quitarTarea('mecanica_ing',${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0 4px;">✕</button>
                        </div>`; }).join('')
                </div>
            </div>
            <button class="btn-finish" onclick="window.updateFlujo(${i},'met_ok')">✅ Fin Metrología</button>`;
    }

    else if (d.estado === 'ejecucion_trabajos') {
        UI = `<h3>Mecánica</h3>
            ${obs('mecanica')}
            <div class="det-seccion-titulo" style="margin-top:10px;">🔧 Tareas Mecánicas</div>
            <div style="background:#f0f4ff;border:1px solid #c0d0f0;border-radius:6px;padding:10px;margin-bottom:10px;">
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <input id="tarea_mecanica_${i}" class="med-input" style="flex:1;" placeholder="Ej: Rectificado de eje, Cambio de descansos..."
                        onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTarea('mecanica',${i});}" >
                    <button onclick="window.agregarTarea('mecanica',${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                </div>
                <div id="tarea_mecanica_lista_${i}">
                    ${(d.tareas_mecanica||[]).map((item,ti) => {
                        const meta    = (d.tareas_mecanica_meta||[])[ti] || {};
                        const chk     = (d.tareas_mecanica_checks||{})[ti];
                        const chkMeta = (d.tareas_mecanica_checks_meta||{})[ti];
                        return `
                        <div style="display:flex;align-items:flex-start;gap:6px;padding:5px 0;border-bottom:1px solid #d0dcf8;">
                            <label style="flex:1;display:flex;align-items:flex-start;gap:6px;cursor:pointer;">
                                <input type="checkbox" ${chk?'checked':''} style="margin-top:2px;"
                                    onchange="window._marcarTarea('mecanica',${i},${ti},this.checked);">
                                <span style="font-size:0.87em;${chk?'text-decoration:line-through;color:#888;':''}">${item}
                                    ${meta.nombre ? `<span style="font-size:0.7em;color:#1a6ba0;background:#e8f4fd;border:1px solid #b0d4f0;border-radius:3px;padding:1px 4px;margin-left:3px;">👤 ${meta.nombre} · ${meta.ts||''}</span>` : ''}
                                    ${chk && chkMeta ? `<span style="font-size:0.7em;color:#27ae60;margin-left:3px;">✅ ${chkMeta.nombre} · ${chkMeta.ts||''}</span>` : ''}
                                </span>
                            </label>
                            <button onclick="window.quitarTarea('mecanica',${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0 4px;">✕</button>
                        </div>`; }).join('')
                </div>
            </div>
            ${window._htmlFotosSimples ? window._htmlFotosSimples(i,'mecanica_generales','Fotos Generales Mecánica') : ''}
            <button class="btn-finish" onclick="window.updateFlujo(${i},'mec_fin')">✅ Fin Mecánica</button>`;
    }

    return UI;
};
