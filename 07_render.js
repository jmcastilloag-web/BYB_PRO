window.render = () => {
    const v = document.getElementById("vista");
    if (!v) return;
    if (!window.usuarioActual) {
        // Solo mostrar login si ya terminó de cargar usuarios de Firebase
        // (evita pantalla de login momentánea al recargar con sesión guardada)
        if (window.usuariosCargados) window.mostrarLogin();
        return;
    }
    // Si hay sesión, ocultar el overlay de login por si acaso
    document.getElementById('loginOverlay').style.display = 'none';

    // ── Vista Trabajos Pendientes ──
    if (window.vistaActual === 'trabajosPendientes') {
        const AREAS_INFO = {
            'desarme_mant': { label: '🔧 Desarme / Mantención', color: '#e67e22', bg: '#fef5e7' },
            'calidad':      { label: '🔬 Control Calidad',       color: '#8e44ad', bg: '#f5eef8' },
            'mecanica':     { label: '⚙️ Mecánica',              color: '#2980b9', bg: '#eaf4fb' },
            'bobinado':     { label: '🌀 Bobinado',              color: '#16a085', bg: '#e8f8f5' },
            'armado_bal':   { label: '🔩 Balanceo / Armado',     color: '#27ae60', bg: '#eafaf1' },
            'despacho':     { label: '🚚 Despacho',              color: '#c0392b', bg: '#fdedec' },
        };
        const areasUsuario = window.getAreasGenerales();
        if (areasUsuario.length === 0) {
            v.innerHTML = `<div class="card"><h2>🔔 Trabajos Pendientes</h2><p style="color:var(--text2);">No tienes un área general asignada. Pide al administrador que configure tu perfil.</p></div>`;
            return;
        }
        let html = `<div class="card"><h2>🔔 Trabajos Pendientes</h2><p style="color:var(--text2);font-size:0.9em;margin-bottom:20px;">Mostrando OTs pendientes para tu área de trabajo</p>`;
        let hayAlgo = false;
        areasUsuario.forEach(areaId => {
            const info = AREAS_INFO[areaId] || { label: areaId, color: '#555', bg: '#f5f5f5' };
            const ots = window.getOTsPendientesPorArea(areaId);
            hayAlgo = hayAlgo || ots.length > 0;
            html += `<div style="margin-bottom:24px;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                    <h3 style="margin:0;color:${info.color};">${info.label}</h3>
                    <span style="background:${ots.length>0?info.color:'#bdc3c7'};color:#fff;border-radius:12px;padding:2px 12px;font-size:0.8em;font-weight:700;">${ots.length} pendiente${ots.length!==1?'s':''}</span>
                </div>`;
            if (ots.length === 0) {
                html += `<div style="background:#f8f9fa;border-radius:8px;padding:14px;color:var(--text2);font-size:0.9em;">✅ No hay trabajos pendientes en este momento</div>`;
            } else {
                html += `<div style="overflow-x:auto;"><table><thead><tr>
                    <th>OT</th><th>Empresa</th><th>Estado</th><th>Tipo</th><th>Fecha Entrega</th><th style="min-width:120px">Avance</th><th>Acción</th>
                </tr></thead><tbody>`;
                ots.forEach(d => {
                    const idx = window.data.findIndex(x => String(x.ot) === String(d.ot));
                    const avance = window.calcularAvance(d);
                    const estadoBadge = (d.estado || '').replace(/_/g,' ').toUpperCase();
                    const hoy = new Date(); hoy.setHours(0,0,0,0);
                    const fechaOT = d.fecha ? new Date(d.fecha) : null;
                    const dias = fechaOT ? Math.ceil((fechaOT - hoy) / 86400000) : null;
                    let fechaHtml = fechaOT ? fechaOT.toLocaleDateString('es-CL') : '—';
                    if (dias !== null) {
                        const colF = dias < 0 ? 'var(--danger)' : dias <= 3 ? 'var(--warning)' : 'var(--success-dark)';
                        fechaHtml += `<div style="font-size:0.72em;color:${colF};font-weight:700;">${dias<0?`⚠ Vencida (${Math.abs(dias)}d)`:dias===0?'Hoy':`${dias}d`}</div>`;
                    }
                    // Determinar vista destino según área
                    const vistaDestino = { desarme_mant:'desarme', calidad:'calidad', mecanica:'mecanica', bobinado:'bobinado', armado_bal:'armado', despacho:'despacho' }[areaId] || 'dashboard';
                    html += `<tr style="background:${info.bg};">
                        <td><strong>OT ${d.ot}</strong>${d.pri==='urgente'?` <span style="color:var(--danger);font-size:0.75em;">🔴 URGENTE</span>`:''}</td>
                        <td>${d.empresa||'—'}</td>
                        <td><span style="background:${info.color};color:#fff;padding:2px 8px;border-radius:10px;font-size:0.75em;font-weight:700;">${estadoBadge}</span></td>
                        <td style="font-size:0.85em;">${(d.tipoTrabajo||'—').toUpperCase()}</td>
                        <td>${fechaHtml}</td>
                        <td>${window.barraAvance(avance)}</td>
                        <td><button class="btn-primary btn-sm" onclick="window.irAOT('${areaId}','${d.ot}')">🔧 Abrir OT</button></td>
                    </tr>`;
                });
                html += `</tbody></table></div>`;
            }
            html += `</div>`;
        });
        if (!hayAlgo) {
            html += `<div style="text-align:center;padding:30px;background:#eafaf1;border-radius:10px;"><div style="font-size:2.5em;">✅</div><h3 style="color:#27ae60;margin:8px 0;">¡Sin trabajos pendientes!</h3><p style="color:var(--text2);">Todas las órdenes de trabajo de tu área están al día.</p></div>`;
        }
        html += `</div>`;
        v.innerHTML = html;
        return;
    }

    // Vista gestión de usuarios (solo admin)
    if (window.vistaActual === "usuarios") {
        if (!window.esAdmin()) { v.innerHTML = `<div class="card"><p>⛔ Sin permiso.</p></div>`; return; }
        const AREAS_TALLER = [["desarme_mant", "🔧 Desarme / Mant."], ["calidad", "🔬 Control Calidad"], ["mecanica", "⚙️ Mecánica"], ["bobinado", "🌀 Bobinado"], ["armado_bal", "🔩 Balanceo / Armado"], ["despacho", "🚚 Despacho"]];
        const roles = { admin:'👑 Admin', encargado:'🔧 Encargado', tecnico:'🛠 Técnico' };
        const otsList = [...window.data].map(d => d.ot).sort((a,b) => {
            const na = parseInt(a), nb = parseInt(b);
            return isNaN(na)||isNaN(nb) ? String(a).localeCompare(String(b)) : na-nb;
        });
        let rows = window.usuarios.map((u, idx) => {
            const asigEsp = (u.asignaciones||[]).filter(a => a.ot);
            let asigSummary = asigEsp.length > 0 && u.rol === 'tecnico'
                ? asigEsp.map(a => `OT ${a.ot} / ${AREAS_TALLER.find(x=>x[0]===a.area)?.[1]||a.area}`).join('<br>')
                : '—';
            const areasGen = window.getAreasGenerales(u);
            const areasGenLabel = areasGen.length > 0
                ? areasGen.map(a => `<span style="background:#e8eef5;color:#1a2a3a;padding:1px 7px;border-radius:10px;font-size:0.82em;font-weight:600;">${AREAS_TALLER.find(x=>x[0]===a)?.[1]||a}</span>`).join(' ')
                : '—';
            return `<tr>
                <td>${u.nombre}</td>
                <td><code>${u.usuario}</code></td>
                <td><code>${u.password||'—'}</code></td>
                <td>${roles[u.rol]||u.rol}</td>
                <td>${areasGenLabel}</td>
                <td style="font-size:0.78em;color:var(--text2);">${asigSummary}</td>
                <td><span style="color:${u.activo!==false?'var(--success)':'var(--danger)'};">${u.activo!==false?'✅ Activo':'❌ Inactivo'}</span></td>
                <td style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn-primary btn-sm" onclick="window.editarUsuario(${idx})">✏️ Editar</button>
                    ${u.usuario!=='admin'?`<button class="btn-del btn-sm" onclick="window.toggleActivoUsuario(${idx})">${u.activo!==false?'Desactivar':'Activar'}</button>`:''}
                </td>
            </tr>`;
        }).join('');
        v.innerHTML = `
        <div class="card">
            <h2>👥 Gestión de Usuarios</h2>
            <button class="btn-primary btn-sm" style="margin-bottom:16px;" onclick="window.nuevoUsuarioForm()">➕ Nuevo Usuario</button>
            <div style="overflow-x:auto;">
            <table>
                <thead><tr><th>Nombre</th><th>Usuario</th><th>Contraseña</th><th>Rol</th><th>🏭 Área General</th><th>OTs Específicas</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
            <div id="formUsuario" style="display:none;margin-top:20px;background:#f8f9fa;border:1px solid var(--border);border-radius:8px;padding:18px;">
                <h3 id="formUsuTitulo">Nuevo Usuario</h3>
                <input type="hidden" id="fuIdx" value="-1">
                <div class="med-grid">
                    <div class="med-campo"><label>Nombre completo</label><input id="fuNombre" placeholder="Ej: Juan Pérez"></div>
                    <div class="med-campo"><label>Usuario (sin espacios)</label><input id="fuUsuario" placeholder="Ej: jperez"></div>
                    <div class="med-campo"><label>Contraseña</label><input id="fuPass" type="password" placeholder="Contraseña"></div>
                    <div class="med-campo"><label>Rol</label>
                        <select id="fuRol" onchange="window.toggleAsignaciones()">
                            <option value="encargado">🔧 Encargado</option>
                            <option value="tecnico">🛠 Técnico</option>
                            <option value="admin">👑 Admin</option>
                        </select>
                    </div>
                </div>
                <div id="secAreaGeneral" style="display:none;margin-bottom:12px;">
                    <label style="margin-bottom:8px;display:block;font-weight:700;color:#1a2a3a;">🏭 Área General del Taller:</label>
                    <p style="font-size:0.8em;color:var(--text2);margin:0 0 10px 0;">Selecciona el/los área(s) donde trabaja este usuario. Verá los trabajos pendientes de esas áreas.</p>
                    <div id="areaGenCheckboxes" style="display:flex;flex-wrap:wrap;gap:8px;">
                    <label style="display:flex;align-items:center;gap:5px;font-size:0.85em;padding:5px 12px;border:1.5px solid var(--border);border-radius:20px;cursor:pointer;background:white;transition:all 0.15s;user-select:none;"><input type="checkbox" class="chkAreaGen" data-area="desarme_mant" style="accent-color:var(--primary,#1a2a3a);" onchange="const lbl=this.closest('label');lbl.style.background=this.checked?'#e8eef5':'white';lbl.style.borderColor=this.checked?'var(--primary,#1a2a3a)':'var(--border)';"> 🔧 Desarme / Mantención</label>
                    <label style="display:flex;align-items:center;gap:5px;font-size:0.85em;padding:5px 12px;border:1.5px solid var(--border);border-radius:20px;cursor:pointer;background:white;transition:all 0.15s;user-select:none;"><input type="checkbox" class="chkAreaGen" data-area="calidad" style="accent-color:var(--primary,#1a2a3a);" onchange="const lbl=this.closest('label');lbl.style.background=this.checked?'#e8eef5':'white';lbl.style.borderColor=this.checked?'var(--primary,#1a2a3a)':'var(--border)';"> 🔬 Control Calidad</label>
                    <label style="display:flex;align-items:center;gap:5px;font-size:0.85em;padding:5px 12px;border:1.5px solid var(--border);border-radius:20px;cursor:pointer;background:white;transition:all 0.15s;user-select:none;"><input type="checkbox" class="chkAreaGen" data-area="mecanica" style="accent-color:var(--primary,#1a2a3a);" onchange="const lbl=this.closest('label');lbl.style.background=this.checked?'#e8eef5':'white';lbl.style.borderColor=this.checked?'var(--primary,#1a2a3a)':'var(--border)';"> ⚙️ Mecánica</label>
                    <label style="display:flex;align-items:center;gap:5px;font-size:0.85em;padding:5px 12px;border:1.5px solid var(--border);border-radius:20px;cursor:pointer;background:white;transition:all 0.15s;user-select:none;"><input type="checkbox" class="chkAreaGen" data-area="bobinado" style="accent-color:var(--primary,#1a2a3a);" onchange="const lbl=this.closest('label');lbl.style.background=this.checked?'#e8eef5':'white';lbl.style.borderColor=this.checked?'var(--primary,#1a2a3a)':'var(--border)';"> 🌀 Bobinado</label>
                    <label style="display:flex;align-items:center;gap:5px;font-size:0.85em;padding:5px 12px;border:1.5px solid var(--border);border-radius:20px;cursor:pointer;background:white;transition:all 0.15s;user-select:none;"><input type="checkbox" class="chkAreaGen" data-area="armado_bal" style="accent-color:var(--primary,#1a2a3a);" onchange="const lbl=this.closest('label');lbl.style.background=this.checked?'#e8eef5':'white';lbl.style.borderColor=this.checked?'var(--primary,#1a2a3a)':'var(--border)';"> 🔩 Balanceo / Armado</label>
                    <label style="display:flex;align-items:center;gap:5px;font-size:0.85em;padding:5px 12px;border:1.5px solid var(--border);border-radius:20px;cursor:pointer;background:white;transition:all 0.15s;user-select:none;"><input type="checkbox" class="chkAreaGen" data-area="despacho" style="accent-color:var(--primary,#1a2a3a);" onchange="const lbl=this.closest('label');lbl.style.background=this.checked?'#e8eef5':'white';lbl.style.borderColor=this.checked?'var(--primary,#1a2a3a)':'var(--border)';"> 🚚 Despacho</label>
                    </div>
                </div>
                <div id="secAsignaciones" style="display:none;margin-bottom:12px;">
                    <label style="margin-bottom:8px;display:block;font-weight:700;">Asignaciones (OT + Área):</label>
                    <div style="position:relative;">
                        <input id="buscadorOT" placeholder="🔍 Escribe el número o nombre de OT..." autocomplete="off"
                            style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:0.9em;outline:none;box-sizing:border-box;"
                            oninput="window.filtrarOTsForm()" onfocus="window.filtrarOTsForm()">
                        <div id="dropdownOTs" style="display:none;position:absolute;top:calc(100% + 2px);left:0;right:0;background:white;border:1.5px solid var(--border);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.12);z-index:200;max-height:220px;overflow-y:auto;"></div>
                    </div>
                    <div id="listaOTsForm" style="margin-top:10px;display:flex;flex-direction:column;gap:8px;"></div>
                </div>
                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button class="btn-success" onclick="window.guardarUsuarioForm()">💾 Guardar</button>
                    <button class="btn-del" onclick="document.getElementById('formUsuario').style.display='none'">Cancelar</button>
                </div>
                <p id="formUsuError" style="color:var(--danger);margin-top:8px;"></p>
            </div>
        </div>`;
        return;
    }

    if (window.vistaActual === "dashboard") {
        const dataOrdenada = [...window.data]
            .map((d, indexOriginal) => ({ ...d, indexOriginal }))
            .sort((a, b) => {
                if (a.pri === 'urgente' && b.pri !== 'urgente') return -1;
                if (a.pri !== 'urgente' && b.pri === 'urgente') return 1;
                const fa = a.fecha ? new Date(a.fecha) : new Date('9999-12-31');
                const fb = b.fecha ? new Date(b.fecha) : new Date('9999-12-31');
                if (fa - fb !== 0) return fa - fb;
                return b.ot.localeCompare(a.ot, undefined, {numeric: true});
            });

        const filtradas = dataOrdenada.filter(d =>
            d.ot.toLowerCase().includes(window.filtroBusqueda.toLowerCase()) ||
            d.empresa.toLowerCase().includes(window.filtroBusqueda.toLowerCase())
        );

        let html = `<div class="card"><h2>📋 Listado General</h2>
        <div class="search-container">
            <input type="text" class="search-input" id="buscado" placeholder="🔍 Buscar por OT o Empresa..." value="${window.filtroBusqueda}" oninput="window.filtroBusqueda=this.value; window.render()">
        </div><div style="overflow-x:auto">
        <table><thead><tr><th>⚑</th><th>OT</th><th>Empresa</th><th>Fecha Entrega</th><th>Estado</th><th style='min-width:130px'>Avance</th><th>Acciones</th></tr></thead><tbody>`;

        filtradas.forEach((d) => {
            const estadoBadge = d.estado.replace(/_/g,' ').toUpperCase();
            const hoy = new Date(); hoy.setHours(0,0,0,0);
            const fechaOT = d.fecha ? new Date(d.fecha) : null;
            const dias = fechaOT ? Math.ceil((fechaOT - hoy) / 86400000) : null;
            let diasHtml = '';
            if (dias !== null) {
                const color = dias < 0 ? 'var(--danger)' : dias <= 3 ? 'var(--warning)' : 'var(--success-dark)';
                const label = dias < 0 ? `Vencida (${Math.abs(dias)}d)` : dias === 0 ? 'Hoy' : `${dias}d`;
                diasHtml = `<div style="font-size:0.72em;color:${color};font-weight:700;margin-top:2px;">${dias < 0 ? '⚠' : ''} ${label}</div>`;
            }
            const [y,m,dd] = (d.fecha||'').split('-');
            const fechaFmt = d.fecha ? `${dd}/${m}/${y}` : '';
            const pct = window.calcularAvance(d);
            html += `<tr>
                <td style="text-align:center"><button onclick="window.data[${d.indexOriginal}].pri=(window.data[${d.indexOriginal}].pri=='urgente'?'normal':'urgente'); window.save()" style="background:none;cursor:pointer;font-size:1.2em;padding:2px 4px;border:none;">${d.pri=='urgente'?'🔴':'⚪'}</button></td>
                <td><b style="color:var(--accent);">${d.ot}</b></td>
                <td>${d.empresa}</td>
                <td>
                    ${window.puedeEditar()
                        ? `<input type="date" value="${d.fecha||''}" style="width:138px;font-size:0.85em;" onchange="window.data[${d.indexOriginal}].fecha=this.value; if(window.data[${d.indexOriginal}].estado=='espera_fecha')window.data[${d.indexOriginal}].estado='ejecucion_trabajos'; window.save()">`
                        : `<span style="font-size:0.9em;">${fechaFmt || '—'}</span>`
                    }
                    ${diasHtml}
                </td>
                <td><span class="badge badge-blue">${estadoBadge}</span></td>
                <td>${window.barraAvance(pct)}</td>
                <td class="dash-actions">
                    <button class="btn-primary btn-sm" onclick="window.verDetalle(${d.indexOriginal})">🔍</button>
                    <button class="btn-sm" style="background:#1a6b2e;color:white;" onclick="window.descargarGuiaRecepcion(${d.indexOriginal})" title="Descargar Guía de Recepción">📥</button>
                    <button class="btn-sm" style="background:#8e44ad;color:white;" onclick="window.descargarDetalle(${d.indexOriginal})" title="Descargar Detalle Word">📋</button>
                    <button class="btn-success btn-sm" onclick="window.descargarInforme(${d.indexOriginal})" title="Descargar Informe Final Word">📄</button>
                    ${window.puedeEditar() ? `<button class="btn-sm" style="background:#e67e22;color:white;" onclick="window.abrirPanelReabrir(${d.indexOriginal})" title="Reabrir etapa">🔓</button>` : ''}
                    ${window.puedeEditar() ? `<button class="btn-del btn-sm" onclick="if(confirm('¿Eliminar OT ${d.ot}?')){window.data.splice(${d.indexOriginal},1); window.save()}">✕</button>` : ''}
                </td></tr>`;
        });
        v.innerHTML = html + "</tbody></table></div></div>";
        document.getElementById('buscado')?.focus();
    }
    else if (window.vistaActual === "mensual") {
        const mesesConDatos = [...new Set(window.data.filter(d => d.fecha).map(d => d.fecha.slice(0,7)))].sort();
        const hoy2 = new Date();
        const mesActual = `${hoy2.getFullYear()}-${String(hoy2.getMonth()+1).padStart(2,'0')}`;
        if (!window.mesSel) window.mesSel = mesActual;
        const mesSel = window.mesSel;
        const todosMeses = [...new Set([...mesesConDatos, mesActual])].sort();
        const nombMes = (ym) => {
            const [y,m] = ym.split('-');
            return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1] + ' ' + y;
        };
        const botonesHtml = todosMeses.map(m =>
            `<button class="mes-btn ${m===mesSel?'active':''}" onclick="window.mesSel='${m}'; window.render()">${nombMes(m)}</button>`
        ).join('');

        let filtrados = window.data.filter(d => d.fecha && d.fecha.slice(0,7) === mesSel);
        const st2 = (req, hecho) => (req === 'si') ? (hecho ? '<td style="color:var(--success-dark);text-align:center">✔</td>' : '<td style="color:var(--danger);text-align:center">✘</td>') : '<td style="text-align:center;color:var(--text-light)">—</td>';
        const ck2 = (paso, d) => (d.pasos && d.pasos[paso]) ? '<td style="color:var(--success-dark);text-align:center">✔</td>' : '<td style="text-align:center;color:var(--text-light)">—</td>';
        const rod2 = (d2) => {
            const rods2 = d2.rodamientos || [];
            // Compatibilidad legacy
            const lista2 = rods2.length > 0 ? rods2 : [
                ...(d2.rod_lc ? [{pos:'LC',mod:d2.rod_lc,ok:d2.rod_lc_ok}] : []),
                ...(d2.rod_ll ? [{pos:'LL',mod:d2.rod_ll,ok:d2.rod_ll_ok}] : []),
            ];
            if (!lista2.length) return '<td style="text-align:center;color:#ccc">—</td>';
            const checks2 = d2.rodamientos_ok || {};
            const texto = lista2.map((r,ri)=>{
                const ok2 = r.ok !== undefined ? r.ok : !!checks2[ri];
                return `<span style="font-size:0.75em;display:block;">${r.pos}: ${r.mod} ${ok2?'<b style="color:var(--success-dark)">✔</b>':'<b style="color:var(--danger)">✘</b>'}</span>`;
            }).join('');
            return '<td style="padding:4px">'+texto+'</td>';
        };
        const fmtF = (f) => { if(!f) return '—'; const [y,m,d]=f.split('-'); return `${d}/${m}/${y}`; };

        const filas = filtrados.map(d =>
            `<tr><td><b style="color:var(--accent)">${d.ot}</b></td><td>${d.empresa}</td><td style="font-size:0.85em;white-space:nowrap">${fmtF(d.fecha)}</td>${rod2(d)}${st2(d.enc_lc,d.ejec_enc_lc)}${st2(d.enc_ll,d.ejec_enc_ll)}${st2(d.met_lc,d.ejec_met_lc)}${st2(d.met_ll,d.ejec_met_ll)}${ck2('mant_ok',d)}<td><span class="badge badge-blue" style="font-size:0.7em">${d.estado.replace(/_/g,' ').toUpperCase()}</span></td></tr>`
        ).join('');

        // Calcular stats del mes
        const totalMes = filtrados.length;
        const entregados = filtrados.filter(d => d.estado === 'entregado').length;
        const enProceso  = filtrados.filter(d => !['entregado','despacho'].includes(d.estado)).length;
        const despacho   = filtrados.filter(d => d.estado === 'despacho').length;
        const pctMes     = totalMes ? Math.round(filtrados.reduce((s,d) => s + window.calcularAvance(d), 0) / totalMes) : 0;
        const colPctMes  = window.colorAvance(pctMes);

        // Gráfico de barras de avance por OT
        const grafId = 'graf_mensual_' + mesSel.replace('-','');
        const grafHtml = filtrados.length === 0 ? '' : `
            <div style="margin-bottom:14px;">
                <div style="font-size:0.8em;font-weight:700;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Avance por OT</div>
                <canvas id="${grafId}" style="width:100%;height:${Math.max(60, filtrados.length * 32)}px;display:block;"></canvas>
            </div>`;

        const filasNuevas = filtrados.map(d => {
            const pct2 = window.calcularAvance(d);
            return `<tr>
                <td><b style="color:var(--accent)">${d.ot}</b></td>
                <td>${d.empresa}</td>
                <td style="font-size:0.85em;white-space:nowrap">${fmtF(d.fecha)}</td>
                <td>${window.barraAvance(pct2)}</td>
                ${rod2(d)}
                ${st2(d.enc_lc,d.ejec_enc_lc)}${st2(d.enc_ll,d.ejec_enc_ll)}
                ${ck2('mant_ok',d)}
                <td><span class="badge badge-blue" style="font-size:0.7em">${d.estado.replace(/_/g,' ').toUpperCase()}</span></td>
            </tr>`;
        }).join('');

        v.innerHTML = `<div class="card">
            <h2>📅 Control Mensual</h2>
            <div class="mes-selector">${botonesHtml}</div>

            <!-- KPIs del mes -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
                <div style="background:#f0f4ff;border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:1.6em;font-weight:800;color:var(--accent);">${totalMes}</div>
                    <div style="font-size:0.75em;color:var(--text2);font-weight:600;">OTs del mes</div>
                </div>
                <div style="background:#f0faf4;border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:1.6em;font-weight:800;color:#27ae60;">${entregados}</div>
                    <div style="font-size:0.75em;color:var(--text2);font-weight:600;">Entregadas</div>
                </div>
                <div style="background:#fff8f0;border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:1.6em;font-weight:800;color:#f39c12;">${enProceso}</div>
                    <div style="font-size:0.75em;color:var(--text2);font-weight:600;">En proceso</div>
                </div>
                <div style="background:#f8f8f8;border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:1.6em;font-weight:800;color:${colPctMes};">${pctMes}%</div>
                    <div style="font-size:0.75em;color:var(--text2);font-weight:600;">Avance promedio</div>
                </div>
            </div>

            <!-- Barra avance total del mes -->
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;font-size:0.8em;color:var(--text2);margin-bottom:4px;">
                    <span style="font-weight:700;">Avance global del mes</span>
                    <span style="font-weight:700;color:${colPctMes};">${pctMes}%</span>
                </div>
                <div style="background:#e0e0e0;border-radius:8px;height:12px;overflow:hidden;">
                    <div style="width:${pctMes}%;background:${colPctMes};height:12px;border-radius:8px;transition:width 0.5s;"></div>
                </div>
            </div>

            ${grafHtml}

            <div style="overflow-x:auto">
            <table class="tab-tec" style="font-size:0.83em;">
                <thead><tr><th>OT</th><th>Empresa</th><th>Fecha</th><th style="min-width:130px">Avance</th><th>Rodamientos</th><th>E.LC</th><th>E.LL</th><th>Mant</th><th>Estado</th></tr></thead>
                <tbody>${filasNuevas || '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text2);">Sin OTs para este mes</td></tr>'}</tbody>
            </table></div>
        </div>`;

        // Dibujar gráfico de barras horizontales de avance
        if (filtrados.length > 0) {
            setTimeout(() => {
                const canvas = document.getElementById(grafId);
                if (!canvas) return;
                const W = canvas.offsetWidth || 600;
                const rowH = 28, padL = 120, padR = 50, padT = 8, padB = 8;
                const H = padT + filtrados.length * rowH + padB;
                canvas.width = W; canvas.height = H;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0,0,W,H);
                const barW = W - padL - padR;

                filtrados.forEach((d2, idx) => {
                    const pct3 = window.calcularAvance(d2);
                    const y = padT + idx * rowH;
                    const col = window.colorAvance(pct3);

                    // Fondo alternado
                    ctx.fillStyle = idx%2===0 ? '#f8f9fa' : '#ffffff';
                    ctx.fillRect(0, y, W, rowH);

                    // Label OT
                    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 11px Calibri';
                    ctx.textAlign = 'right';
                    ctx.fillText('OT ' + d2.ot, padL - 6, y + rowH/2 + 4);

                    // Barra fondo
                    ctx.fillStyle = '#e8e8e8';
                    ctx.beginPath();
                    ctx.roundRect(padL, y+6, barW, rowH-12, 4);
                    ctx.fill();

                    // Barra progreso
                    const bw = Math.round(barW * pct3 / 100);
                    if (bw > 0) {
                        ctx.fillStyle = col;
                        ctx.beginPath();
                        ctx.roundRect(padL, y+6, bw, rowH-12, 4);
                        ctx.fill();
                    }

                    // % texto
                    ctx.fillStyle = pct3 > 15 ? 'white' : col;
                    ctx.font = 'bold 10px Calibri';
                    ctx.textAlign = 'left';
                    ctx.fillText(pct3 + '%', padL + Math.max(bw - 28, 4), y + rowH/2 + 4);

                    // Empresa
                    ctx.fillStyle = '#888'; ctx.font = '10px Calibri';
                    ctx.textAlign = 'left';
                    ctx.fillText(d2.empresa.slice(0,20), padL + barW + 4, y + rowH/2 + 4);
                });
            }, 80);
        }
    }
    else if (window.vistaActual === "crear") {
        if (window.esTecnico() && !window.getAreasGenerales().includes("calidad")) { v.innerHTML = `<div class="card"><p>⛔ Los técnicos no pueden crear OTs.</p></div>`; return; }
        const PIEZAS_FIJAS = ['CARCASA','TAPA RODAMIENTO','TAPA VENTILADOR','JAULA DE ARDILLA','VENTILADOR','PLACA DE CONEXIÓN','CAJA DE CONEXIÓN','CÁNCAMOS','CHAVETA','RODAMIENTOS','POLEA','MACHÓN DE ACOPLE','PIÑÓN','CARBONES','CONTRA TAPA','INDUCIDO','COLECTOR','PORTA ESCOBILLA','RETÉN','PERNOS','INTERCAMBIADOR','CONEXIÓN A TIERRA','OTROS (ESPECIFICAR)'];
        v.innerHTML = `
        <div class="card" style="max-width:820px;">
            <h2>➕ Nueva OT — Guía de Recepción</h2>

            <div class="det-seccion-titulo">📋 Datos de la OT</div>
            <div class="placa-grid" style="margin-bottom:14px;">
                <div class="med-campo"><label>N° OT</label><input class="med-input" id="not" placeholder="Ej: 1234"></div>
                <div class="med-campo"><label>Nombre Cliente</label><input class="med-input" id="nemp" placeholder="Empresa / Cliente"></div>
                <div class="med-campo"><label>R.U.T.</label><input class="med-input" id="nrut" placeholder="12.345.678-9"></div>
                <div class="med-campo"><label>Fecha Recepción</label><input class="med-input" id="nfecha" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
                <div class="med-campo"><label>Guía de Despacho</label><input class="med-input" id="nguia" placeholder="N° Guía"></div>
                <div class="med-campo"><label>Corriente</label>
                    <select class="med-input" id="ncorriente">
                        <option value="">Seleccione...</option>
                        <option value="alterna">Alterna</option>
                        <option value="continua">Continua</option>
                    </select>
                </div>
            </div>

            <div class="det-seccion-titulo">⚙️ Identificación del Equipo</div>
            <div class="placa-grid" style="margin-bottom:14px;">
                <div class="med-campo"><label>Marca</label><input class="med-input" id="nmarca" placeholder="Siemens, ABB..."></div>
                <div class="med-campo"><label>Frame</label><input class="med-input" id="nframe" placeholder="Frame"></div>
                <div class="med-campo"><label>Potencia HP/CV</label><input class="med-input" id="npothp" placeholder="HP/CV"></div>
                <div class="med-campo"><label>Potencia KW</label><input class="med-input" id="npotkw" placeholder="KW"></div>
                <div class="med-campo"><label>RPM</label><input class="med-input" id="nrpm" placeholder="RPM"></div>
                <div class="med-campo"><label>Color</label><input class="med-input" id="ncolor" placeholder="Color"></div>
                <div class="med-campo"><label>N° Serie</label><input class="med-input" id="nserie" placeholder="N° Serie"></div>
                <div class="med-campo"><label>Ciclos (Hz)</label><input class="med-input" id="nciclos" placeholder="50 / 60"></div>
                <div class="med-campo"><label>Volts</label><input class="med-input" id="nvolts" placeholder="V"></div>
                <div class="med-campo"><label>Amperes</label><input class="med-input" id="namps" placeholder="A"></div>
                <div class="med-campo" style="grid-column:1/-1;"><label>Otros</label><input class="med-input" id="notros_equipo" placeholder="Otros datos del equipo"></div>
            </div>

            <div class="det-seccion-titulo">🔩 Identificación de Partes del Equipo</div>
            <p style="font-size:0.8em;color:#888;margin:4px 0 8px 0;">Para cada pieza indica SI está presente, NO está, o si está en MAL ESTADO. Agrega observaciones si es necesario.</p>
            <div style="overflow-x:auto;margin-bottom:10px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.82em;">
                    <thead>
                        <tr style="background:#004F88;color:white;">
                            <th style="padding:6px 10px;text-align:left;width:28%;">PIEZA</th>
                            <th style="padding:6px;text-align:center;width:8%;">SI</th>
                            <th style="padding:6px;text-align:center;width:8%;">NO</th>
                            <th style="padding:6px;text-align:center;width:12%;">MAL ESTADO</th>
                            <th style="padding:6px 10px;text-align:left;">OBSERVACIONES</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${PIEZAS_FIJAS.map((p,pi) => `
                        <tr style="background:${pi%2===0?'#f4f8ff':'white'};border-bottom:1px solid #dde1e7;">
                            <td style="padding:5px 10px;font-weight:600;color:#2c3e50;">${p}</td>
                            <td style="text-align:center;padding:5px;">
                                <input type="radio" name="pieza_${pi}" value="si" id="p${pi}_si">
                                <label for="p${pi}_si" style="color:#27ae60;font-weight:600;cursor:pointer;"> SI</label>
                            </td>
                            <td style="text-align:center;padding:5px;">
                                <input type="radio" name="pieza_${pi}" value="no" id="p${pi}_no">
                                <label for="p${pi}_no" style="color:#e74c3c;font-weight:600;cursor:pointer;"> NO</label>
                            </td>
                            <td style="text-align:center;padding:5px;">
                                <input type="radio" name="pieza_${pi}" value="mal" id="p${pi}_mal">
                                <label for="p${pi}_mal" style="color:#f39c12;font-weight:600;cursor:pointer;"> MAL</label>
                            </td>
                            <td style="padding:5px 8px;">
                                <input type="text" id="pobs_${pi}" placeholder="Observación..." style="width:100%;padding:4px 6px;border:1px solid #dde1e7;border-radius:4px;font-size:0.9em;">
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <div class="det-seccion-titulo" style="margin-top:10px;">➕ Piezas Adicionales</div>
            <div style="background:#f8f9fa;border:1px solid #dde1e7;border-radius:6px;padding:10px;margin-bottom:14px;">
                <p style="font-size:0.8em;color:#888;margin:0 0 6px 0;">Agrega piezas que no estén en la lista.</p>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <input id="pieza_extra_input" class="med-input" style="flex:1;" placeholder="Nombre de la pieza extra..."
                        onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarPiezaExtra();}">
                    <button onclick="window.agregarPiezaExtra()" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                </div>
                <div id="piezas_extra_lista"></div>
            </div>

            <div class="det-seccion-titulo">📝 Nombre Receptor / Supervisor</div>
            <div class="placa-grid" style="margin-bottom:16px;">
                <div class="med-campo"><label>Nombre Receptor</label><input class="med-input" id="nreceptor" placeholder="Nombre completo"></div>
                <div class="med-campo"><label>Supervisor General</label><input class="med-input" id="nsupervisor" placeholder="Nombre completo"></div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button class="btn-finish" onclick="window.nuevaOT()">➕ Crear OT y Comenzar</button>
            </div>
        </div>`;
        // Init piezas extra temp
        window._piezasExtra = [];
        window.agregarPiezaExtra = () => {
            const inp = document.getElementById('pieza_extra_input');
            const txt = (inp?.value||'').trim().toUpperCase();
            if(!txt) return;
            window._piezasExtra.push({nombre:txt, estado:'', obs:''});
            inp.value = '';
            const lista = document.getElementById('piezas_extra_lista');
            if(lista) lista.innerHTML = window._piezasExtra.map((pe,pi)=>`
                <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #eee;">
                    <span style="flex:1;font-size:0.85em;font-weight:600;">${pe.nombre}</span>
                    <select onchange="window._piezasExtra[${pi}].estado=this.value" style="padding:3px;font-size:0.8em;border:1px solid #dde1e7;border-radius:4px;">
                        <option value="">Estado...</option>
                        <option value="si">SI</option>
                        <option value="no">NO</option>
                        <option value="mal">MAL ESTADO</option>
                    </select>
                    <input type="text" placeholder="Obs." onchange="window._piezasExtra[${pi}].obs=this.value" style="width:120px;padding:3px 6px;font-size:0.8em;border:1px solid #dde1e7;border-radius:4px;">
                    <button onclick="window._piezasExtra.splice(${pi},1);window.agregarPiezaExtra.refresh&&window.agregarPiezaExtra.refresh()" style="background:none;border:none;color:#e74c3c;cursor:pointer;">✕</button>
                </div>`).join('');
        };
    }
    else {
        let html = `<div class="card"><h2>${window.vistaActual.replace(/_/g,' ').toUpperCase()}</h2></div>`;
        let hay = false;
        // Mapeo: vistaActual → areaId para filtrar OTs por usuario autorizado
        const _vistasConFiltroArea = {
            desarme_mant: 'desarme_mant',
            calidad: 'calidad',
            mecanica: 'mecanica',
        };
        const _areaIdVista = _vistasConFiltroArea[window.vistaActual];
        const _areasUsuario = window.getAreasGenerales();
        // Si el usuario tiene área general asignada, solo ve las OTs de su área
        const _filtrarPorArea = _areaIdVista && _areasUsuario.length > 0 && !window.puedeEditar();
        const _otsPorArea = _filtrarPorArea ? new Set(window.getOTsPendientesPorArea(_areaIdVista).map(d => String(d.ot))) : null;

        window.data.forEach((d, i) => {
            // Filtrar: técnicos con área general solo ven sus OTs
            if (_filtrarPorArea && !_otsPorArea.has(String(d.ot))) return;
            let UI = ""; let p = d.pasos || {}; if(!d.mediciones) d.mediciones = {}; if(!d.placa) d.placa = {};
            const obs = (k) => `<textarea id="obs_${k}_${i}" onchange="window.guardarObs(${i},'${k}')" placeholder="Notas...">${d.observaciones?.[k]||''}</textarea>`;

            if (window.vistaActual === 'desarme_mant') {
                if (d.estado === 'desarme') {
                    UI = `<h3>Desarme</h3>
                        ${obs('desarme')}
                        <div class="det-seccion-titulo" style="margin-top:10px;">🔍 Hallazgos del Desarme</div>
                        <div style="background:#fff8f0;border:1px solid #f0c080;border-radius:6px;padding:10px;margin-bottom:10px;">
                            <p style="font-size:0.82em;color:#888;margin:0 0 8px 0;">Agrega cada hallazgo encontrado. Aparecerá como lista en el Detalle de Control de Calidad.</p>
                            <div style="display:flex;gap:6px;margin-bottom:8px;">
                                <input id="des_input_${i}" class="med-input" style="flex:1;" placeholder="Ej: Bobinado quemado, Rodamiento destruido..."
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarHallazgo(${i});}">
                                <button onclick="window.agregarHallazgo(${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                            </div>
                            <div id="des_lista_${i}">
                                ${(d.hallazgos_lista||[]).map((item,hi) => `
                                    <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #f0e0c0;">
                                        <span style="flex:1;font-size:0.88em;">• ${item}</span>
                                        <button onclick="window.quitarHallazgo(${i},${hi})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1em;padding:0 4px;">✕</button>
                                    </div>`).join('')}
                            </div>
                        </div>
                        
                        <div class="det-seccion-titulo" style="margin-top:10px;">🔧 Tareas Realizadas en Desarme</div>
                        <div style="background:#f0f4ff;border:1px solid #c0d0f0;border-radius:6px;padding:10px;margin-bottom:10px;">
                            <p style="font-size:0.8em;color:#888;margin:0 0 6px 0;">Agrega cada tarea realizada. Quedará registrada en el informe.</p>
                            <div style="display:flex;gap:6px;margin-bottom:8px;">
                                <input id="tarea_desarme_${i}" class="med-input" style="flex:1;" placeholder="Ej: Extracción de rodamientos, Limpieza general..."
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTarea('desarme',${i});}" >
                                <button onclick="window.agregarTarea('desarme',${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                            </div>
                            <div id="tarea_desarme_lista_${i}">
                                ${(d.tareas_desarme||[]).map((item,ti) => `
                                    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #d0dcf8;">
                                        <label style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" ${(d.tareas_desarme_checks||{})[ti]?'checked':''}
                                                onchange="if(!window.data[${i}].tareas_desarme_checks) window.data[${i}].tareas_desarme_checks={};
                                                          window.data[${i}].tareas_desarme_checks[${ti}]=this.checked;
                                                          window.save();">
                                            <span style="font-size:0.87em;${(d.tareas_desarme_checks||{})[ti]?'text-decoration:line-through;color:#888;':''}">${item}</span>
                                        </label>
                                        <button onclick="window.quitarTarea('desarme',${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0 4px;">✕</button>
                                    </div>`).join('')}
                            </div>
                        </div>
                        <div class="det-seccion-titulo" style="margin-top:14px;">🔎 Check de Desarme</div>
                        <div style="background:#f4f8ff;border:1.5px solid #b0c8e8;border-radius:8px;padding:12px 14px;margin-bottom:14px;overflow-x:auto;">
                            <p style="font-size:0.8em;color:#555;margin:0 0 10px 0;">Marca cada componente como <b style="color:#27ae60;">BUENO</b>, <b style="color:#e74c3c;">MALO</b> o <b style="color:#888;">N/A</b>. Los marcados N/A no aparecerán en Mantención ni Armado.</p>
                            <table style="width:100%;border-collapse:collapse;font-size:0.82em;">
                                <thead><tr style="background:#004F88;color:white;">
                                    <th style="padding:6px 10px;text-align:left;min-width:160px;">COMPONENTE</th>
                                    <th style="padding:6px;text-align:center;width:80px;">✅ BUENO</th>
                                    <th style="padding:6px;text-align:center;width:80px;">❌ MALO</th>
                                    <th style="padding:6px;text-align:center;width:70px;">— N/A</th>
                                    <th style="padding:6px 10px;text-align:left;">Observaciones</th>
                                    <th style="padding:6px 10px;text-align:left;min-width:160px;">📷 Fotos</th>
                                </tr></thead>
                                <tbody>
                                ${(window.ITEMS_CHECK_DESARME||[]).map((item, ci) => {
                                    const val = (d.check_desarme||{})[item.k] || 'na';
                                    const obsV = (d.check_desarme_obs||{})[item.k] || '';
                                    const fotos = ((d.fotos_desarme||{})[item.k]) || [];
                                    const rowBg = ci%2===0 ? '#f4f8ff' : 'white';
                                    return `<tr style="background:${rowBg};border-bottom:1px solid #dde1e7;">
                                        <td style="padding:5px 10px;font-weight:600;color:#2c3e50;">${item.label}</td>
                                        <td style="text-align:center;padding:4px;">
                                            <label style="cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;">
                                                <input type="radio" name="chkdes_${i}_${item.k}" value="bueno" ${val==='bueno'?'checked':''}
                                                    onchange="window.guardarCheckDesarme(${i},'${item.k}','bueno')"
                                                    style="accent-color:#27ae60;">
                                                <span style="color:#27ae60;font-weight:700;font-size:0.85em;">BUENO</span>
                                            </label>
                                        </td>
                                        <td style="text-align:center;padding:4px;">
                                            <label style="cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;">
                                                <input type="radio" name="chkdes_${i}_${item.k}" value="malo" ${val==='malo'?'checked':''}
                                                    onchange="window.guardarCheckDesarme(${i},'${item.k}','malo')"
                                                    style="accent-color:#e74c3c;">
                                                <span style="color:#e74c3c;font-weight:700;font-size:0.85em;">MALO</span>
                                            </label>
                                        </td>
                                        <td style="text-align:center;padding:4px;">
                                            <label style="cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;">
                                                <input type="radio" name="chkdes_${i}_${item.k}" value="na" ${val==='na'?'checked':''}
                                                    onchange="window.guardarCheckDesarme(${i},'${item.k}','na')"
                                                    style="accent-color:#888;">
                                                <span style="color:#888;font-weight:600;font-size:0.85em;">N/A</span>
                                            </label>
                                        </td>
                                        <td style="padding:4px 8px;">
                                            <input type="text" value="${obsV}" placeholder="Observación..."
                                                style="width:100%;padding:4px 6px;border:1px solid #dde1e7;border-radius:4px;font-size:0.88em;"
                                                onblur="window.guardarObsCheckDesarme(${i},'${item.k}',this.value)">
                                        </td>
                                        <td style="padding:4px 8px;">
                                            ${window._htmlFotosComponente ? window._htmlFotosComponente(i,'desarme',item.k,fotos) : ''}
                                            ${fotos.length < 10 ? `<label id="btn_foto_desarme_${i}_${item.k}" style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;background:#e8f0fe;border:1px solid #b0c8e8;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.8em;color:#004F88;font-weight:600;">
                                                📷 ${fotos.length > 0 ? fotos.length+'/10' : 'Fotos'}
                                                <input type="file" accept="image/*" multiple style="display:none;"
                                                    onchange="window.subirFotosComponente(${i},'desarme','${item.k}',this)">
                                            </label>` : `<span style="font-size:0.78em;color:#27ae60;font-weight:700;">✅ ${fotos.length}/10</span>`}
                                        </td>
                                    </tr>`;
                                }).join('')}
                                </tbody>
                            </table>
                        </div>
                        <button class="btn-finish" onclick="window.updateFlujo(${i},'desarme_ok','ingresos_pendientes')">✅ Fin Desarme</button>`;
                }
                else if (d.estado === 'ejecucion_trabajos') {
                    const _chkD    = d.check_desarme || {};
                    const _chkDObs = d.check_desarme_obs || {};
                    const _chkM    = d.check_mantencion || {};
                    const _chkMObs = d.check_mantencion_obs || {};
                    const _chkMRsp = d.check_mantencion_resp || {};
                    const _fotosM  = d.fotos_mantencion || {};
                    const _itemsMant = (window.ITEMS_CHECK_DESARME||[]).filter(it => _chkD[it.k] && _chkD[it.k] !== 'na');
                    const _checkMantSection = _itemsMant.length > 0
                        ? `<div class="det-seccion-titulo" style="margin-top:12px;">🔧 Check de Mantención por Componente</div>
                           <div style="background:#f8fbff;border:1.5px solid #b0c8e8;border-radius:8px;padding:10px 14px;margin-bottom:14px;overflow-x:auto;">
                               <p style="font-size:0.78em;color:#555;margin:0 0 8px 0;">Marca cada componente al completar su mantención. Sube hasta 10 fotos por componente.</p>
                               <table style="width:100%;border-collapse:collapse;font-size:0.82em;">
                                   <thead><tr style="background:#004F88;color:white;">
                                       <th style="padding:5px 10px;text-align:left;">COMPONENTE</th>
                                       <th style="padding:5px;text-align:center;width:75px;">DESARME</th>
                                       <th style="padding:5px;text-align:center;width:85px;">✅ HECHO</th>
                                       <th style="padding:5px 10px;text-align:left;">OBSERVACIÓN</th>
                                       <th style="padding:5px 10px;text-align:left;width:100px;">TÉCNICO</th>
                                       <th style="padding:5px 10px;text-align:left;min-width:150px;">📷 FOTOS</th>
                                   </tr></thead><tbody>
                                   ${_itemsMant.map((it, ci2) => {
                                       const vDes  = _chkD[it.k];
                                       const colDes = vDes==='bueno' ? '#27ae60' : '#e74c3c';
                                       const lblDes = vDes==='bueno' ? '✅ BUENO' : '❌ MALO';
                                       const hecho  = !!_chkM[it.k];
                                       const obsM   = (_chkMObs[it.k]||'').replace(/"/g,'&quot;');
                                       const resp   = _chkMRsp[it.k] || '—';
                                       const fotos  = _fotosM[it.k] || [];
                                       const rowBg  = hecho ? '#eafff2' : (ci2%2===0?'#f4f8ff':'white');
                                       return `<tr style="background:${rowBg};border-bottom:1px solid #dde1e7;">
                                           <td style="padding:5px 10px;font-weight:600;color:#2c3e50;">${it.label}</td>
                                           <td style="text-align:center;padding:5px;"><span style="color:${colDes};font-weight:700;font-size:0.85em;">${lblDes}</span></td>
                                           <td style="text-align:center;padding:5px;">
                                               <label style="cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
                                                   <input type="checkbox" ${hecho?'checked':''}
                                                       style="width:16px;height:16px;accent-color:#27ae60;cursor:pointer;"
                                                       onchange="window.toggleCheckMantencion(${i},'${it.k}',this.checked); window.render();">
                                                   <span style="font-size:0.82em;font-weight:700;color:${hecho?'#27ae60':'#aaa'};">${hecho?'HECHO':'—'}</span>
                                               </label>
                                           </td>
                                           <td style="padding:4px 8px;">
                                               <input type="text" value="${obsM}" placeholder="Observación..."
                                                   style="width:100%;padding:4px 6px;border:1px solid #dde1e7;border-radius:4px;font-size:0.85em;"
                                                   onblur="window.guardarObsCheckMantencion(${i},'${it.k}',this.value)">
                                           </td>
                                           <td style="padding:5px 8px;font-size:0.82em;color:#1a2a6a;font-weight:600;">${resp}</td>
                                           <td style="padding:4px 8px;">
                                               ${(window._htmlFotosComponente||function(){return '';})(i,'mantencion',it.k,fotos)}
                                               ${fotos.length < 10
                                                   ? `<label style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;background:#e8f0fe;border:1px solid #b0c8e8;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.8em;color:#004F88;font-weight:600;">📷 ${fotos.length>0?fotos.length+'/10':'Fotos'}<input type="file" accept="image/*" multiple style="display:none" onchange="window.subirFotosComponente(${i},'mantencion','${it.k}',this)"></label>`
                                                   : `<span style="font-size:0.78em;color:#27ae60;font-weight:700;">✅ ${fotos.length}/10</span>`}
                                           </td>
                                       </tr>`;
                                   }).join('')}
                                   </tbody>
                               </table>
                           </div>`
                        : '';
                    UI = `<h3>Mantención</h3>${_checkMantSection}${obs('mantencion')}
                        <div class="det-seccion-titulo" style="margin-top:10px;">🔧 Tareas de Mantención</div>
                        <div style="background:#f0f4ff;border:1px solid #c0d0f0;border-radius:6px;padding:10px;margin-bottom:10px;">
                            <p style="font-size:0.8em;color:#888;margin:0 0 6px 0;">Agrega cada tarea realizada. Quedará registrada en el informe.</p>
                            <div style="display:flex;gap:6px;margin-bottom:8px;">
                                <input id="tarea_mantencion_${i}" class="med-input" style="flex:1;" placeholder="Ej: Cambio de rodamientos, Limpieza de bobinado..."
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTarea('mantencion',${i});}" >
                                <button onclick="window.agregarTarea('mantencion',${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                            </div>
                            <div id="tarea_mantencion_lista_${i}">
                                ${(d.tareas_mantencion||[]).map((item,ti) => `
                                    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #d0dcf8;">
                                        <label style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" ${(d.tareas_mantencion_checks||{})[ti]?'checked':''}
                                                onchange="if(!window.data[${i}].tareas_mantencion_checks) window.data[${i}].tareas_mantencion_checks={};
                                                          window.data[${i}].tareas_mantencion_checks[${ti}]=this.checked;
                                                          window.save();">
                                            <span style="font-size:0.87em;${(d.tareas_mantencion_checks||{})[ti]?'text-decoration:line-through;color:#888;':''}">${item}</span>
                                        </label>
                                        <button onclick="window.quitarTarea('mantencion',${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0 4px;">✕</button>
                                    </div>`).join('')}
                            </div>
                        </div>
                        <button class="btn-finish" onclick="window.updateFlujo(${i},'mant_ok')">✅ Fin Mantención</button>`;
                }
            }
            else if (window.vistaActual === 'calidad') {
                if (d.estado === 'ingresos_pendientes') {
                    UI = `<h3>Mediciones de Ingreso</h3>
                        <select onchange="window.data[${i}].tipoTrabajo=this.value; window.save()" style="width:100%; padding:8px; margin-bottom:10px;">
                            <option value="">Tipo...</option><option value="bobinado" ${d.tipoTrabajo=='bobinado'?'selected':''}>Bobinado</option><option value="mantencion" ${d.tipoTrabajo=='mantencion'?'selected':''}>Mantención</option>
                        </select>
                        <div class="seccion-med">
                            <div class="med-titulo">⚡ Resistencia (Ohm)</div>
                            <div class="med-fila3">
                                <div class="med-campo"><label>1-2</label><input class="med-input" value="${d.mediciones.res12||''}" onchange="window.data[${i}].mediciones.res12=this.value; window.save()"></div>
                                <div class="med-campo"><label>1-3</label><input class="med-input" value="${d.mediciones.res13||''}" onchange="window.data[${i}].mediciones.res13=this.value; window.save()"></div>
                                <div class="med-campo"><label>2-3</label><input class="med-input" value="${d.mediciones.res23||''}" onchange="window.data[${i}].mediciones.res23=this.value; window.save()"></div>
                            </div>
                        </div>
                        <div class="seccion-med">
                            <div class="med-titulo">⚡ Inductancia (mH)</div>
                            <div class="med-fila3">
                                <div class="med-campo"><label>1-2</label><input class="med-input" value="${d.mediciones.ind12||''}" onchange="window.data[${i}].mediciones.ind12=this.value; window.save()"></div>
                                <div class="med-campo"><label>1-3</label><input class="med-input" value="${d.mediciones.ind13||''}" onchange="window.data[${i}].mediciones.ind13=this.value; window.save()"></div>
                                <div class="med-campo"><label>2-3</label><input class="med-input" value="${d.mediciones.ind23||''}" onchange="window.data[${i}].mediciones.ind23=this.value; window.save()"></div>
                            </div>
                        </div>
                        <div class="seccion-med">
                            <div class="med-titulo">⚡ Surge / Onda de Choque (%)</div>
                            <div class="med-fila3">
                                <div class="med-campo"><label>1</label><input class="med-input" value="${d.mediciones.sur1||''}" onchange="window.data[${i}].mediciones.sur1=this.value; window.save()"></div>
                                <div class="med-campo"><label>2</label><input class="med-input" value="${d.mediciones.sur2||''}" onchange="window.data[${i}].mediciones.sur2=this.value; window.save()"></div>
                                <div class="med-campo"><label>3</label><input class="med-input" value="${d.mediciones.sur3||''}" onchange="window.data[${i}].mediciones.sur3=this.value; window.save()"></div>
                            </div>
                        </div>
                        <div class="med-fila2">
                            <div class="med-campo"><label>Aislación (MΩ)</label><input class="med-input" value="${d.mediciones.aisla||''}" onchange="window.data[${i}].mediciones.aisla=this.value; window.save()"></div>
                            <div class="med-campo"><label>IP / DAR</label><input class="med-input" value="${d.mediciones.ipdar||''}" onchange="window.data[${i}].mediciones.ipdar=this.value; window.save()"></div>
                        </div>
                        
                        <div class="det-seccion-titulo" style="margin-top:10px;">📋 Tareas de Calidad / Mediciones</div>
                        <div style="background:#f0f4ff;border:1px solid #c0d0f0;border-radius:6px;padding:10px;margin-bottom:10px;">
                            <p style="font-size:0.8em;color:#888;margin:0 0 6px 0;">Agrega cada tarea realizada. Quedará registrada en el informe.</p>
                            <div style="display:flex;gap:6px;margin-bottom:8px;">
                                <input id="tarea_calidad_${i}" class="med-input" style="flex:1;" placeholder="Ej: Medición de aislación, Prueba surge..."
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTarea('calidad',${i});}" >
                                <button onclick="window.agregarTarea('calidad',${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                            </div>
                            <div id="tarea_calidad_lista_${i}">
                                ${(d.tareas_calidad||[]).map((item,ti) => `
                                    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #d0dcf8;">
                                        <label style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" ${(d.tareas_calidad_checks||{})[ti]?'checked':''}
                                                onchange="if(!window.data[${i}].tareas_calidad_checks) window.data[${i}].tareas_calidad_checks={};
                                                          window.data[${i}].tareas_calidad_checks[${ti}]=this.checked;
                                                          window.save();">
                                            <span style="font-size:0.87em;${(d.tareas_calidad_checks||{})[ti]?'text-decoration:line-through;color:#888;':''}">${item}</span>
                                        </label>
                                        <button onclick="window.quitarTarea('calidad',${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0 4px;">✕</button>
                                    </div>`).join('')}
                            </div>
                        </div>
                        <button class="btn-finish" onclick="window.updateFlujo(${i},'med_ok')">✅ Guardar e Ingresar</button>`;
                }
                else if (d.estado === 'detalle_pendiente') {
                    const det = d.detalle || {};
                    const hallazgos = d.hallazgos_lista || [];
                    const chk = (key, label) => `
                        <label class="det-chk-label ${det[key]?'det-chk-on':''}">
                            <input type="checkbox" ${det[key]?'checked':''} onchange="
                                if(!window.data[${i}].detalle) window.data[${i}].detalle={};
                                window.data[${i}].detalle['${key}']=this.checked;
                                this.closest('label').classList.toggle('det-chk-on',this.checked);
                                window.save()">
                            <span>${label}</span>
                        </label>`;
                    UI = `
                        ${hallazgos.length > 0 ? `
                        <div class="det-seccion-titulo" style="background:#c0392b;">🔍 Hallazgos del Desarme</div>
                        <div style="background:#fff5f5;border:1px solid #f0c0c0;border-radius:6px;padding:10px;margin-bottom:12px;">
                            ${hallazgos.map(h => `<div style="padding:4px 0;border-bottom:1px solid #f0d0d0;font-size:0.88em;">• ${h}</div>`).join('')}
                        </div>` : ''}

                        <div class="det-seccion-titulo">📋 Datos de Placa</div>
                        <div class="placa-grid" style="margin-bottom:14px;">
                            <div class="med-campo"><label>Marca</label><input class="med-input" value="${d.placa.marca||''}" onchange="window.data[${i}].placa.marca=this.value; window.save()"></div>
                            <div class="med-campo"><label>Voltaje</label><input class="med-input" value="${d.placa.volt||''}" onchange="window.data[${i}].placa.volt=this.value; window.save()"></div>
                            <div class="med-campo"><label>Frame</label><input class="med-input" value="${d.placa.frame||''}" onchange="window.data[${i}].placa.frame=this.value; window.save()"></div>
                            <div class="med-campo"><label>Amp</label><input class="med-input" value="${d.placa.amp||''}" onchange="window.data[${i}].placa.amp=this.value; window.save()"></div>
                            <div class="med-campo"><label>Potencia</label><input class="med-input" value="${d.placa.pot||''}" onchange="window.data[${i}].placa.pot=this.value; window.save()"></div>
                            <div class="med-campo"><label>RPM</label><input class="med-input" value="${d.placa.rpm||''}" onchange="window.data[${i}].placa.rpm=this.value; window.save()"></div>
                            <div class="med-campo" style="grid-column:1/-1;"><label>Corriente</label>
                                <select class="med-input" onchange="window.data[${i}].placa.corriente=this.value; window.save()">
                                    <option value="">Seleccione...</option>
                                    <option value="alterna" ${d.placa.corriente==='alterna'?'selected':''}>Alterna</option>
                                    <option value="continua" ${d.placa.corriente==='continua'?'selected':''}>Continua</option>
                                </select>
                            </div>
                        </div>

                        <div class="det-seccion-titulo">⚡ BOBINADO</div>
                        <div class="det-chk-grid">
                            ${chk('bob_estator','Bobinado Estator')}
                            ${chk('bob_rotor','Bobinado Rotor')}
                            ${chk('bob_freno','Bobinado Freno')}
                            ${chk('bob_inducido','Bobinado Inducido')}
                            ${chk('bob_interpolos','Bobinado Interpolo')}
                            ${chk('bob_campos','Bobinado Campos')}
                            ${chk('bob_otros','Bobinado Otros')}
                            ${chk('bob_campos_comp','Bobinado Campos de Compensación')}
                        </div>

                        <div class="det-seccion-titulo" style="margin-top:10px;">🔧 MANTENCIÓN</div>
                        <div class="det-chk-grid">
                            ${chk('mant_dielec_estator','Mantención Dieléc. Estator')}
                            ${chk('mant_dielec_rotor','Mantención Dieléc. Rotor')}
                            ${chk('mant_freno','Mantención Freno')}
                            ${chk('mant_campos','Mantención Campos')}
                            ${chk('mant_campos_comp','Mantención Campos Compensación')}
                            ${chk('mant_interpolos','Mantención Interpolos')}
                            ${chk('mant_inducido','Mantención Inducido')}
                            ${chk('mant_porta_escobilla','Mantención Porta Escobilla')}
                            ${chk('mant_calefactor','Mantención Calefactor')}
                            ${chk('mant_tacometro','Mantención Tacómetro')}
                            ${chk('mant_reductor','Mantención Reductor')}
                            ${chk('mant_general','Mantención General')}
                        </div>

                        <div class="det-seccion-titulo" style="margin-top:10px;">🏭 BARNIZADO Y ENCAPSULADO</div>
                        <div class="det-chk-grid">
                            ${chk('barn_horno_estator','Barnizado y Secado al Horno Estator')}
                            ${chk('barn_camp_inter','Barnizado y Secado Camp. Inter.')}
                            ${chk('barn_horno_rotor','Barnizado y Secado al Horno Rotor')}
                            ${chk('barn_inducido','Barnizado y Secado Inducido')}
                            ${chk('encap_estator','Encap. con Resina Epox Estator')}
                            ${chk('encap_freno','Encap. con Resina Epox Freno')}
                            ${chk('encap_rotor','Encap. con Resina Epox Rotor')}
                            ${chk('encap_placa_conexion','Encap. con Resina Epox Placa de Conexión')}
                        </div>

                        <div class="det-seccion-titulo" style="margin-top:10px;">🔩 ENCAMISADO Y METALADO</div>
                        <div class="det-chk-grid">
                            ${chk('encam_tapa_lc','Encamisado Tapa Lado Carga')}
                            ${chk('metal_tapa_lc','Metalado Tapa Lado Carga')}
                            ${chk('encam_tapa_ll','Encamisado Tapa Lado Libre')}
                            ${chk('metal_tapa_ll','Metalado Tapa Lado Libre')}
                            ${chk('metal_eje_lc','Metalado Eje Lado Carga')}
                            ${chk('encam_eje_lc','Encamisado Eje Lado Carga')}
                            ${chk('metal_eje_ll','Metalado Eje Lado Libre')}
                            ${chk('encam_eje_ll','Encamisado Eje Lado Libre')}
                            ${chk('metal_desc_hidro_lc','Metalado Desc. Hidrodinámico L.C.')}
                            ${chk('metal_desc_hidro_ll','Metalado Desc. Hidrodinámico L.Libre')}
                            ${chk('metal_buje_lc','Metalado Buje Lado Carga')}
                            ${chk('metal_buje_ll','Metalado Buje Lado Libre')}
                            ${chk('rect_anillos','Rectificado de Anillos')}
                            ${chk('rect_colector','Rect. y Desmicado de Colector')}
                            ${chk('rect_balatas','Rectificado de Balatas')}
                            ${chk('rect_otros','Rectificado Otros')}
                        </div>

                        <div class="det-seccion-titulo" style="margin-top:10px;">🏗️ FABRICACIÓN</div>
                        <div class="det-chk-grid">
                            ${chk('fab_eje','Fabricación de Eje')}
                            ${chk('fab_esslinger','Fabricación de Esslinger')}
                            ${chk('fab_contratapa_carga','Fabricación Contratapa Carga')}
                            ${chk('fab_anillo','Fabricación de Anillo')}
                            ${chk('metro_tapas_eje','Metrología Tapas y Eje')}
                            ${chk('fab_otros','Fabricar Otros')}
                        </div>

                        <div class="det-seccion-titulo" style="margin-top:10px;">⚙️ CAMBIOS Y VARIOS</div>
                        <div class="det-chk-grid">
                            ${chk('camb_rod_lc','Camb. Rodamiento Lado Carga')}
                            ${chk('camb_resortes','Camb. Resortes')}
                            ${chk('camb_rod_ll','Camb. Rodamiento Lado Libre')}
                            ${chk('camb_espaciadores','Camb. Espaciadores')}
                            ${chk('tipo_lubricacion','Tipo de Lubricación')}
                            ${chk('balanceo_dinamico','Balanceo Dinámico')}
                            ${chk('camb_ventilador','Camb. Ventilador')}
                            ${chk('pruebas_electricas','Pruebas Eléctricas')}
                            ${chk('camb_tapa_ventilador','Camb. Tapa de Ventilador')}
                            ${chk('pintura','Pintura')}
                            ${chk('camb_placa_conexion','Camb. Placa de Conexión')}
                            ${chk('armado','Armado')}
                            ${chk('camb_caja_conexion','Camb. Caja de Conexión')}
                            ${chk('camb_ducto_grasera','Cambio Ducto de Grasera')}
                            ${chk('camb_vring','Camb. V-Ring')}
                            ${chk('camb_grasera','Cambio Grasera')}
                            ${chk('camb_oring','Camb. O-Ring')}
                            ${chk('camb_cable_salida','Camb. Cable de Salida')}
                            ${chk('camb_reten','Camb. Retén')}
                            ${chk('camb_pt100','Camb. PT-100')}
                            ${chk('camb_pernos','Camb. Pernos')}
                            ${chk('camb_carbones','Cambio de Carbones')}
                            ${chk('camb_balatas','Camb. Balatas')}
                            ${chk('camb_prensas','Camb. Prensas')}
                            ${chk('camb_terminales','Camb. Terminales')}
                            ${chk('camb_ptc_rtd','Camb. PTC / RTD')}
                            ${chk('camb_flexible','Camb. Flexible')}
                            ${chk('camb_enchufe_3f','Camb. Enchufe 3F')}
                            ${chk('asentamiento_carbones','Asentamiento de Carbones')}
                            ${chk('vicelado_colector','Vicelado Colector')}
                        </div>

                        <div class="det-seccion-titulo" style="margin-top:14px;">📝 Observaciones</div>
                        ${obs('detalle')}

                        <div style="background:#f0f7ff; padding:10px; border-radius:5px; margin-bottom:12px;">
                            <strong>📎 Subir Archivos (Fotos/Docs):</strong><br>
                            <input type="file" id="file_input_${i}"> <button id="btn_file_${i}" onclick="window.subirArchivo(${i})">Subir</button>
                        </div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            <button class="btn-sm" style="background:#8e44ad;color:white;padding:10px 16px;font-weight:bold;border-radius:6px;border:none;cursor:pointer;" onclick="window.descargarDetalle(${i})">📋 Descargar Detalle Word</button>
                            <button class="btn-finish" onclick="window.updateFlujo(${i},'detalle_ok','espera_fecha')">🏭 Enviar a Taller</button>
                        </div>`;
                }
                else if (d.estado === 'pruebas_dinamicas') {
                    UI = `<h3>Pruebas Dinámicas</h3>
                        <div class="med-grid">
                            <div><strong>GRASA</strong>
                                <input class="med-input" placeholder="Alternativas" value="${d.mediciones.grasa_alt||''}" onchange="window.data[${i}].mediciones.grasa_alt=this.value; window.save()">
                                <input class="med-input" placeholder="Si (Texto)" value="${d.mediciones.grasa_si||''}" onchange="window.data[${i}].mediciones.grasa_si=this.value; window.save()">
                            </div>
                            <div><strong>VOLTAJE DE PRUEBA</strong>
                                <input class="med-input" placeholder="Voltaje" value="${d.mediciones.voltaje_prueba||''}" onchange="window.data[${i}].mediciones.voltaje_prueba=this.value; window.save()">
                            </div>
                        </div>
                        <h4>Mediciones de Salida</h4>
                        <div class="seccion-med">
                            <div class="med-titulo">⚡ Resistencia Salida (Ohm)</div>
                            <div class="med-fila3">
                                <div class="med-campo"><label>1-2</label><input class="med-input" value="${d.mediciones.res_salida12||''}" onchange="window.data[${i}].mediciones.res_salida12=this.value; window.save()"></div>
                                <div class="med-campo"><label>1-3</label><input class="med-input" value="${d.mediciones.res_salida13||''}" onchange="window.data[${i}].mediciones.res_salida13=this.value; window.save()"></div>
                                <div class="med-campo"><label>2-3</label><input class="med-input" value="${d.mediciones.res_salida23||''}" onchange="window.data[${i}].mediciones.res_salida23=this.value; window.save()"></div>
                            </div>
                        </div>
                        <div class="seccion-med">
                            <div class="med-titulo">⚡ Inductancia Salida (mH)</div>
                            <div class="med-fila3">
                                <div class="med-campo"><label>1-2</label><input class="med-input" value="${d.mediciones.ind_salida12||''}" onchange="window.data[${i}].mediciones.ind_salida12=this.value; window.save()"></div>
                                <div class="med-campo"><label>1-3</label><input class="med-input" value="${d.mediciones.ind_salida13||''}" onchange="window.data[${i}].mediciones.ind_salida13=this.value; window.save()"></div>
                                <div class="med-campo"><label>2-3</label><input class="med-input" value="${d.mediciones.ind_salida23||''}" onchange="window.data[${i}].mediciones.ind_salida23=this.value; window.save()"></div>
                            </div>
                        </div>
                        <div class="seccion-med">
                            <div class="med-titulo">⚡ Surge Salida (%)</div>
                            <div class="med-fila3">
                                <div class="med-campo"><label>1</label><input class="med-input" value="${d.mediciones.surge_salida1||''}" onchange="window.data[${i}].mediciones.surge_salida1=this.value; window.save()"></div>
                                <div class="med-campo"><label>2</label><input class="med-input" value="${d.mediciones.surge_salida2||''}" onchange="window.data[${i}].mediciones.surge_salida2=this.value; window.save()"></div>
                                <div class="med-campo"><label>3</label><input class="med-input" value="${d.mediciones.surge_salida3||''}" onchange="window.data[${i}].mediciones.surge_salida3=this.value; window.save()"></div>
                            </div>
                        </div>
                        <div class="med-fila2">
                            <div class="med-campo"><label>Aislación Salida (MΩ)</label><input class="med-input" value="${d.mediciones.aisla_salida||''}" onchange="window.data[${i}].mediciones.aisla_salida=this.value; window.save()"></div>
                            <div class="med-campo"><label>IP / DAR Salida</label><input class="med-input" value="${d.mediciones.ipdar_salida||''}" onchange="window.data[${i}].mediciones.ipdar_salida=this.value; window.save()"></div>
                        </div>
                        <div class="med-fila2">
                            <div class="med-campo"><label>Voltaje Prueba Salida (V)</label><input class="med-input" value="${d.mediciones.voltaje_prueba_salida||''}" onchange="window.data[${i}].mediciones.voltaje_prueba_salida=this.value; window.save()"></div>
                            <div class="med-campo"><label>RPM Salida</label><input class="med-input" value="${d.mediciones.rpm_salida||''}" onchange="window.data[${i}].mediciones.rpm_salida=this.value; window.save()"></div>
                        </div>
                        <div class="seccion-med">
                            <div class="med-titulo">📊 Consumo de Líneas (A)</div>
                            <div class="med-fila3">
                                <div class="med-campo"><label>R</label><input class="med-input" value="${d.mediciones.consumo_r||''}" onchange="window.data[${i}].mediciones.consumo_r=this.value; window.save()"></div>
                                <div class="med-campo"><label>S</label><input class="med-input" value="${d.mediciones.consumo_s||''}" onchange="window.data[${i}].mediciones.consumo_s=this.value; window.save()"></div>
                                <div class="med-campo"><label>T</label><input class="med-input" value="${d.mediciones.consumo_t||''}" onchange="window.data[${i}].mediciones.consumo_t=this.value; window.save()"></div>
                            </div>
                        </div>
                        <div class="seccion-med">
                            <div class="med-titulo">📳 Vibraciones Lado 1</div>
                            <div class="med-fila3">
                                <div class="med-campo"><label>Axial</label><input class="med-input" value="${d.mediciones.vib_1a||''}" onchange="window.data[${i}].mediciones.vib_1a=this.value; window.save()"></div>
                                <div class="med-campo"><label>Horizontal</label><input class="med-input" value="${d.mediciones.vib_1h||''}" onchange="window.data[${i}].mediciones.vib_1h=this.value; window.save()"></div>
                                <div class="med-campo"><label>Vertical</label><input class="med-input" value="${d.mediciones.vib_1v||''}" onchange="window.data[${i}].mediciones.vib_1v=this.value; window.save()"></div>
                            </div>
                        </div>
                        <div class="seccion-med">
                            <div class="med-titulo">📳 Vibraciones Lado 2</div>
                            <div class="med-fila3">
                                <div class="med-campo"><label>Axial</label><input class="med-input" value="${d.mediciones.vib_2a||''}" onchange="window.data[${i}].mediciones.vib_2a=this.value; window.save()"></div>
                                <div class="med-campo"><label>Horizontal</label><input class="med-input" value="${d.mediciones.vib_2h||''}" onchange="window.data[${i}].mediciones.vib_2h=this.value; window.save()"></div>
                                <div class="med-campo"><label>Vertical</label><input class="med-input" value="${d.mediciones.vib_2v||''}" onchange="window.data[${i}].mediciones.vib_2v=this.value; window.save()"></div>
                            </div>
                        </div>
                        <div class="det-seccion-titulo" style="margin-top:14px;">🌡️ Registro de Temperatura (cada 10 min)</div>
                        <div style="background:#f0f8ff;border:1px solid #b0d4f0;border-radius:6px;padding:10px;margin-bottom:10px;">
                            <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr auto;gap:6px;align-items:center;margin-bottom:8px;">
                                <span style="font-size:0.8em;font-weight:700;color:#004F88;">TIEMPO (min)</span>
                                <span style="font-size:0.8em;font-weight:700;color:#004F88;text-align:center;">L. CARGA (°C)</span>
                                <span style="font-size:0.8em;font-weight:700;color:#004F88;text-align:center;">L. LIBRE (°C)</span>
                                <span style="font-size:0.8em;font-weight:700;color:#004F88;text-align:center;">ESTATOR (°C)</span>
                                <span></span>
                                <input id="tmp_t_${i}" class="med-input" style="width:70px;text-align:center;" placeholder="10" type="number" min="0" step="10">
                                <input id="tmp_lc_${i}" class="med-input" style="text-align:center;" placeholder="°C" type="number" step="0.1">
                                <input id="tmp_ll_${i}" class="med-input" style="text-align:center;" placeholder="°C" type="number" step="0.1">
                                <input id="tmp_est_${i}" class="med-input" style="text-align:center;" placeholder="°C" type="number" step="0.1"
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTemp(${i});}">
                                <button onclick="window.agregarTemp(${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 12px;cursor:pointer;font-weight:bold;">+</button>
                            </div>
                            <div style="max-height:200px;overflow-y:auto;margin-bottom:10px;">
                                <table style="width:100%;border-collapse:collapse;font-size:0.82em;">
                                    <thead><tr style="background:#004F88;color:white;">
                                        <th style="padding:4px 8px;">Min</th>
                                        <th style="padding:4px 8px;">L.Carga</th>
                                        <th style="padding:4px 8px;">L.Libre</th>
                                        <th style="padding:4px 8px;">Estator</th>
                                        <th style="padding:4px 4px;"></th>
                                    </tr></thead>
                                    <tbody id="temp_tbody_${i}">
                                    ${(d.temp_registros||[]).map((r,ri) => `
                                        <tr style="background:${ri%2===0?'#f8fbff':'white'};border-bottom:1px solid #dde1e7;">
                                            <td style="padding:3px 8px;text-align:center;font-weight:600;">${r.t}'</td>
                                            <td style="padding:3px 8px;text-align:center;color:#e74c3c;">${r.lc}°</td>
                                            <td style="padding:3px 8px;text-align:center;color:#3498db;">${r.ll}°</td>
                                            <td style="padding:3px 8px;text-align:center;color:#27ae60;">${r.est}°</td>
                                            <td style="padding:3px 4px;text-align:center;"><button onclick="window.quitarTemp(${i},${ri})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:0.9em;">✕</button></td>
                                        </tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <canvas id="temp_chart_${i}" style="width:100%;height:220px;display:block;border-radius:5px;margin-top:8px;" data-idx="${i}"></canvas>
                            <p id="temp_chart_msg_${i}" style="font-size:0.82em;color:#888;text-align:center;padding:6px 0;display:${(d.temp_registros||[]).length>=2?'none':'block'};">Agrega al menos 2 registros para ver el gráfico.</p>
                        </div>

                        <div class="det-seccion-titulo" style="margin-top:14px;">📋 Pendientes para Terminaciones</div>
                        <div style="background:#fffbf0; border:1px solid #f0d080; border-radius:6px; padding:10px; margin-bottom:10px;">
                            <p style="font-size:0.82em; color:#888; margin:0 0 8px 0;">Escribe cada tarea y presiona Enter o <b>+</b> para agregarla. Esta lista aparecerá con checkboxes en el área de Terminaciones.</p>
                            <div style="display:flex; gap:6px; margin-bottom:8px;">
                                <input id="term_input_${i}" class="med-input" style="flex:1;" placeholder="Ej: Pintura exterior, Instalación de placa..."
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTerminacion(${i});}">
                                <button onclick="window.agregarTerminacion(${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                            </div>
                            <div id="term_lista_${i}">
                                ${(d.terminaciones_lista||[]).map((item,ti) => `
                                    <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #f0e8c0;">
                                        <span style="flex:1;font-size:0.88em;">• ${item}</span>
                                        <button onclick="window.quitarTerminacion(${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1em;padding:0 4px;">✕</button>
                                    </div>`).join('')}
                            </div>
                        </div>
                        ${obs('pruebas')}
                        <div class="det-seccion-titulo" style="margin-top:10px;">🔬 Tareas de Pruebas Dinámicas</div>
                        <div style="background:#f0f4ff;border:1px solid #c0d0f0;border-radius:6px;padding:10px;margin-bottom:10px;">
                            <p style="font-size:0.8em;color:#888;margin:0 0 6px 0;">Agrega cada tarea realizada. Quedará registrada en el informe.</p>
                            <div style="display:flex;gap:6px;margin-bottom:8px;">
                                <input id="tarea_pruebas_${i}" class="med-input" style="flex:1;" placeholder="Ej: Prueba en vacío, Medición de corriente de arranque..."
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTarea('pruebas',${i});}" >
                                <button onclick="window.agregarTarea('pruebas',${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                            </div>
                            <div id="tarea_pruebas_lista_${i}">
                                ${(d.tareas_pruebas||[]).map((item,ti) => `
                                    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #d0dcf8;">
                                        <label style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" ${(d.tareas_pruebas_checks||{})[ti]?'checked':''}
                                                onchange="if(!window.data[${i}].tareas_pruebas_checks) window.data[${i}].tareas_pruebas_checks={};
                                                          window.data[${i}].tareas_pruebas_checks[${ti}]=this.checked;
                                                          window.save();">
                                            <span style="font-size:0.87em;${(d.tareas_pruebas_checks||{})[ti]?'text-decoration:line-through;color:#888;':''}">${item}</span>
                                        </label>
                                        <button onclick="window.quitarTarea('pruebas',${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0 4px;">✕</button>
                                    </div>`).join('')}
                            </div>
                        </div>
                        <button class="btn-finish" onclick="window.updateFlujo(${i},'pruebas_ok','terminaciones')">✅ Fin Pruebas → Terminaciones</button>`;
                }
                else if (d.estado === 'check_salida') {
                    const pRec   = d.piezas_recepcion || [];
                    // pSalida: estado de salida por pieza ('si','no','na') - editable
                    if (!d.piezas_salida_estado) {
                        // Inicializar: si no llegó (estado==='no' y sin obs) → N/A por defecto
                        d.piezas_salida_estado = {};
                        pRec.forEach((p,pi) => {
                            d.piezas_salida_estado[pi] = (p.estado === 'no' || p.estado === '') ? 'na' : 'si';
                        });
                        window.save();
                    }
                    const pSalida = d.piezas_salida_estado || {};
                    const tList  = d.terminaciones_lista || [];
                    const tChecks= d.terminaciones_checks || {};
                    // Todas las piezas deben tener estado de salida definido (si/no/na)
                    const todasPiezas = pRec.length === 0 || pRec.every((_,pi) => pSalida[pi] && pSalida[pi] !== '');
                    const todasTerm   = tList.length === 0 || tList.every((_,ti) => tChecks[ti]);
                    const todoOk = todasPiezas && todasTerm;
                    UI = `<h3>✅ Check Salida — Control de Calidad Final</h3>

                        <div class="det-seccion-titulo">🔩 Verificación de Piezas de Salida</div>
                        <p style="font-size:0.8em;color:#666;padding:4px 0 8px 0;">Las piezas marcadas <b>N/A</b> no aplican en esta salida. Puedes cambiar el estado de cualquier pieza según corresponda.</p>
                        ${pRec.length === 0
                            ? `<p style="color:#888;font-size:0.85em;padding:8px;">No hay piezas registradas en la Guía de Recepción.</p>`
                            : `<div style="background:#f8f9fa;border:1px solid #dde1e7;border-radius:6px;padding:10px;margin-bottom:12px;overflow-x:auto;">
                                <table style="width:100%;border-collapse:collapse;font-size:0.82em;">
                                    <thead><tr style="background:#004F88;color:white;">
                                        <th style="padding:5px 8px;text-align:left;">PIEZA</th>
                                        <th style="padding:5px;text-align:center;width:65px;">INGRESÓ</th>
                                        <th style="padding:5px;text-align:center;width:160px;">ESTADO SALIDA</th>
                                        <th style="padding:5px 8px;text-align:left;">OBS.</th>
                                    </tr></thead>
                                    <tbody>
                                    ${pRec.map((p,pi)=>{
                                        const est = pSalida[pi] || 'na';
                                        const bgRow = est==='si'?'#eafaf1': est==='no'?'#fff5f5': est==='na'?'#f5f5f5':'white';
                                        const ingColor = p.estado==='si'?'#27ae60':p.estado==='no'?'#e74c3c':p.estado==='mal'?'#f39c12':'#aaa';
                                        const ingLabel = p.estado==='si'?'SI':p.estado==='no'?'NO':p.estado==='mal'?'MAL':'—';
                                        return `
                                        <tr style="background:${bgRow};border-bottom:1px solid #dde1e7;">
                                            <td style="padding:5px 8px;font-weight:600;${est==='na'?'color:#aaa;':''}">${p.nombre}</td>
                                            <td style="padding:5px;text-align:center;">
                                                <span style="font-weight:700;color:${ingColor};font-size:0.9em;">${ingLabel}</span>
                                            </td>
                                            <td style="padding:4px 5px;text-align:center;">
                                                <div style="display:flex;gap:3px;justify-content:center;">
                                                    <button onclick="if(!window.data[${i}].piezas_salida_estado)window.data[${i}].piezas_salida_estado={};
                                                        window.data[${i}].piezas_salida_estado[${pi}]='si'; window.save(); window.render();"
                                                        style="padding:3px 8px;border:none;border-radius:4px;cursor:pointer;font-size:0.78em;font-weight:700;
                                                        background:${est==='si'?'#27ae60':'#e0e0e0'};color:${est==='si'?'white':'#555'};">✓ SI</button>
                                                    <button onclick="if(!window.data[${i}].piezas_salida_estado)window.data[${i}].piezas_salida_estado={};
                                                        window.data[${i}].piezas_salida_estado[${pi}]='no'; window.save(); window.render();"
                                                        style="padding:3px 8px;border:none;border-radius:4px;cursor:pointer;font-size:0.78em;font-weight:700;
                                                        background:${est==='no'?'#e74c3c':'#e0e0e0'};color:${est==='no'?'white':'#555'};">✗ NO</button>
                                                    <button onclick="if(!window.data[${i}].piezas_salida_estado)window.data[${i}].piezas_salida_estado={};
                                                        window.data[${i}].piezas_salida_estado[${pi}]='na'; window.save(); window.render();"
                                                        style="padding:3px 8px;border:none;border-radius:4px;cursor:pointer;font-size:0.78em;font-weight:700;
                                                        background:${est==='na'?'#95a5a6':'#e0e0e0'};color:${est==='na'?'white':'#555'};">N/A</button>
                                                </div>
                                            </td>
                                            <td style="padding:5px 8px;color:#666;font-size:0.85em;">${p.obs||''}</td>
                                        </tr>`;
                                    }).join('')}
                                    </tbody>
                                </table>
                               </div>`
                        }

                        <div class="det-seccion-titulo" style="margin-top:10px;">📋 Verificación de Terminaciones</div>
                        ${tList.length === 0
                            ? `<p style="color:#888;font-size:0.85em;padding:8px;">No hay terminaciones pendientes registradas.</p>`
                            : `<div style="background:#f8f9fa;border:1px solid #dde1e7;border-radius:6px;padding:10px;margin-bottom:12px;">
                                ${tList.map((item,ti)=>`
                                    <label class="det-chk-label ${tChecks[ti]?'det-chk-on':''}" style="margin-bottom:6px;">
                                        <input type="checkbox" ${tChecks[ti]?'checked':''}
                                            onchange="if(!window.data[${i}].terminaciones_checks) window.data[${i}].terminaciones_checks={};
                                                      window.data[${i}].terminaciones_checks[${ti}]=this.checked;
                                                      this.closest('label').classList.toggle('det-chk-on',this.checked);
                                                      window.save(); window.render();">
                                        <span>${item}</span>
                                    </label>`).join('')}
                               </div>`
                        }

                        ${obs('salida')}
                        ${todoOk
                            ? `<button class="btn-finish" onclick="window.updateFlujo(${i},'salida_ok','despacho')">✅ DAR CHECK SALIDA → Despacho</button>`
                            : `<p style="color:#e67e22;font-weight:600;font-size:0.85em;">⚠️ Debes verificar todas las piezas y terminaciones antes de dar el check de salida.</p>`
                        }`;
                }
            }
            else if (window.vistaActual === 'mecanica') {
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
                    </div>
                    <div style="background:#eee; padding:10px; border-radius:5px;">
                        <strong>Metrología Inicial:</strong>
                        <div class="row-met-ingreso"><input type="checkbox" ${d.enc_lc=='si'?'checked':''} onchange="window.data[${i}].enc_lc=this.checked?'si':'no'; window.save()"> EN.LC <input type="text" placeholder="Valor" style="width:100px" value="${d.met_val_lc||''}" onchange="window.data[${i}].met_val_lc=this.value; window.save()"></div>
                        <div class="row-met-ingreso"><input type="checkbox" ${d.enc_ll=='si'?'checked':''} onchange="window.data[${i}].enc_ll=this.checked?'si':'no'; window.save()"> EN.LL <input type="text" placeholder="Valor" style="width:100px" value="${d.met_val_ll||''}" onchange="window.data[${i}].met_val_ll=this.value; window.save()"></div>
                        <div class="row-met-ingreso"><input type="checkbox" ${d.met_lc=='si'?'checked':''} onchange="window.data[${i}].met_lc=this.checked?'si':'no'; window.save()"> ME.LC <input type="text" placeholder="Valor" style="width:100px" value="${d.met_val_mlc||''}" onchange="window.data[${i}].met_val_mlc=this.value; window.save()"></div>
                        <div class="row-met-ingreso"><input type="checkbox" ${d.met_ll=='si'?'checked':''} onchange="window.data[${i}].met_ll=this.checked?'si':'no'; window.save()"> ME.LL <input type="text" placeholder="Valor" style="width:100px" value="${d.met_val_mll||''}" onchange="window.data[${i}].met_val_mll=this.value; window.save()"></div>
                    </div><br>
                    <div class="det-seccion-titulo" style="margin-top:14px;">📐 Planilla Metrológica de Ingreso</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;"><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.79em;font-weight:700;">ALOJAMIENTO LADO CARGA (Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Parámetro</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d1A||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d1A_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d1B||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d1B_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d1C||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d1C_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d1D||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d1D_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d2A||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d2A_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d2B||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d2B_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d2C||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d2C_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d2D||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d2D_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d3A||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d3A_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d3B||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d3B_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d3C||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d3C_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_ing_d3D||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_ing_d3D_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:5px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.75em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_aloj_lc_ing_tol_min||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_aloj_lc_ing_tol_max||''}" onchange="window.data[${i}]['metro_aloj_lc_ing_tol_max']=this.value;window.save()"><span style="font-size:0.75em;font-weight:700;color:#555;margin-left:4px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" onchange="window.data[${i}]['metro_aloj_lc_ing_conc']=this.value;window.save()"><option value="" ${d.metro_aloj_lc_ing_conc?'':'selected'}>-- --</option><option value="dentro" ${d.metro_aloj_lc_ing_conc==='dentro'?'selected':''}>✅ Dentro tolerancia</option><option value="fuera" ${d.metro_aloj_lc_ing_conc==='fuera'?'selected':''}>❌ Fuera tolerancia</option></select></div></div><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.79em;font-weight:700;">ALOJAMIENTO LADO LIBRE (Non Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Parámetro</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d1A||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d1A_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d1B||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d1B_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d1C||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d1C_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d1D||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d1D_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d2A||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d2A_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d2B||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d2B_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d2C||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d2C_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d2D||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d2D_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d3A||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d3A_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d3B||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d3B_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d3C||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d3C_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_ing_d3D||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_ing_d3D_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:5px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.75em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_aloj_ll_ing_tol_min||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_aloj_ll_ing_tol_max||''}" onchange="window.data[${i}]['metro_aloj_ll_ing_tol_max']=this.value;window.save()"><span style="font-size:0.75em;font-weight:700;color:#555;margin-left:4px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" onchange="window.data[${i}]['metro_aloj_ll_ing_conc']=this.value;window.save()"><option value="" ${d.metro_aloj_ll_ing_conc?'':'selected'}>-- --</option><option value="dentro" ${d.metro_aloj_ll_ing_conc==='dentro'?'selected':''}>✅ Dentro tolerancia</option><option value="fuera" ${d.metro_aloj_ll_ing_conc==='fuera'?'selected':''}>❌ Fuera tolerancia</option></select></div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;"><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.79em;font-weight:700;">ASENTAMIENTO LADO CARGA (Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Parámetro</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d1A||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d1A_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d1B||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d1B_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d1C||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d1C_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d1D||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d1D_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d2A||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d2A_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d2B||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d2B_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d2C||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d2C_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d2D||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d2D_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d3A||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d3A_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d3B||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d3B_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d3C||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d3C_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_ing_d3D||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_ing_d3D_aj||''}" onchange="window.data[${i}]['metro_asen_lc_ing_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:5px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.75em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_asen_lc_ing_tol_min||''}" onchange="window.data[${i}]['metro_asen_lc_ing_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_asen_lc_ing_tol_max||''}" onchange="window.data[${i}]['metro_asen_lc_ing_tol_max']=this.value;window.save()"><span style="font-size:0.75em;font-weight:700;color:#555;margin-left:4px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" onchange="window.data[${i}]['metro_asen_lc_ing_conc']=this.value;window.save()"><option value="" ${d.metro_asen_lc_ing_conc?'':'selected'}>-- --</option><option value="dentro" ${d.metro_asen_lc_ing_conc==='dentro'?'selected':''}>✅ Dentro tolerancia</option><option value="fuera" ${d.metro_asen_lc_ing_conc==='fuera'?'selected':''}>❌ Fuera tolerancia</option></select></div></div><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.79em;font-weight:700;">ASENTAMIENTO LADO LIBRE (Non Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Parámetro</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d1A||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d1A_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d1B||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d1B_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d1C||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d1C_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d1D||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d1D_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d2A||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d2A_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d2B||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d2B_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d2C||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d2C_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d2D||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d2D_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d3A||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d3A_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d3B||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d3B_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d3C||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d3C_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_ing_d3D||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_ing_d3D_aj||''}" onchange="window.data[${i}]['metro_asen_ll_ing_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:5px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.75em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_asen_ll_ing_tol_min||''}" onchange="window.data[${i}]['metro_asen_ll_ing_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_asen_ll_ing_tol_max||''}" onchange="window.data[${i}]['metro_asen_ll_ing_tol_max']=this.value;window.save()"><span style="font-size:0.75em;font-weight:700;color:#555;margin-left:4px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" onchange="window.data[${i}]['metro_asen_ll_ing_conc']=this.value;window.save()"><option value="" ${d.metro_asen_ll_ing_conc?'':'selected'}>-- --</option><option value="dentro" ${d.metro_asen_ll_ing_conc==='dentro'?'selected':''}>✅ Dentro tolerancia</option><option value="fuera" ${d.metro_asen_ll_ing_conc==='fuera'?'selected':''}>❌ Fuera tolerancia</option></select></div></div></div>
                    ${obs('metrologia')}
                        <div class="det-seccion-titulo" style="margin-top:10px;">🔩 Tareas Metrología Ingreso</div>
                        <div style="background:#f0f4ff;border:1px solid #c0d0f0;border-radius:6px;padding:10px;margin-bottom:10px;">
                            <p style="font-size:0.8em;color:#888;margin:0 0 6px 0;">Agrega cada tarea realizada. Quedará registrada en el informe.</p>
                            <div style="display:flex;gap:6px;margin-bottom:8px;">
                                <input id="tarea_mecanica_ing_${i}" class="med-input" style="flex:1;" placeholder="Ej: Toma de medidas, Registro dimensional..."
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTarea('mecanica_ing',${i});}" >
                                <button onclick="window.agregarTarea('mecanica_ing',${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                            </div>
                            <div id="tarea_mecanica_ing_lista_${i}">
                                ${(d.tareas_mecanica_ing||[]).map((item,ti) => `
                                    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #d0dcf8;">
                                        <label style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" ${(d.tareas_mecanica_ing_checks||{})[ti]?'checked':''}
                                                onchange="if(!window.data[${i}].tareas_mecanica_ing_checks) window.data[${i}].tareas_mecanica_ing_checks={};
                                                          window.data[${i}].tareas_mecanica_ing_checks[${ti}]=this.checked;
                                                          window.save();">
                                            <span style="font-size:0.87em;${(d.tareas_mecanica_ing_checks||{})[ti]?'text-decoration:line-through;color:#888;':''}">${item}</span>
                                        </label>
                                        <button onclick="window.quitarTarea('mecanica_ing',${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0 4px;">✕</button>
                                    </div>`).join('')}
                            </div>
                        </div>
                    ${(()=>{
                        const items = [
                            {k:'contratapa_lc', label:'Revisión Contratapa Lado Carga'},
                            {k:'contratapa_ll', label:'Revisión Contratapa Lado Libre'},
                            {k:'slingues_lc',   label:'Revisión de Slingues LC'},
                            {k:'slingues_ll',   label:'Revisión de Slingues LL'},
                            {k:'machon_acople', label:'Machón o Acople'},
                            {k:'eje_acople',    label:'Eje Acople'},
                            {k:'ventilador',    label:'Ventilador'},
                            {k:'otros',         label:'Otros'},
                        ];
                        const checks = d.metro_revision_checks || {};
                        return `<div class="det-seccion-titulo" style="margin-top:14px;">🔍 Lista de Revisión Visual de Ingreso</div>
                        <div style="background:#fff8e8;border:1.5px solid #e8c060;border-radius:8px;padding:12px 14px;margin-bottom:12px;">
                            <p style="font-size:0.8em;color:#8a6000;margin:0 0 10px 0;">Completar todos los ítems antes de guardar. La observación es obligatoria.</p>
                            <table style="width:100%;border-collapse:collapse;">
                                <tr style="background:#f5e8c0;">
                                    <th style="padding:5px 8px;font-size:0.78em;text-align:left;color:#6b4a00;width:32%;">Ítem</th>
                                    <th style="padding:5px 8px;font-size:0.78em;text-align:center;color:#6b4a00;width:10%;">OK</th>
                                    <th style="padding:5px 8px;font-size:0.78em;text-align:left;color:#6b4a00;">Observación (obligatoria)</th>
                                </tr>
                                ${items.map(it => {
                                    const ch = checks[it.k] || {};
                                    return `<tr style="border-bottom:1px solid #e8d898;">
                                        <td style="padding:6px 8px;font-size:0.84em;color:#444;font-weight:600;">${it.label}</td>
                                        <td style="padding:6px 8px;text-align:center;">
                                            <input type="checkbox" ${ch.ok?'checked':''} style="width:16px;height:16px;cursor:pointer;"
                                                onchange="window.guardarRevisionCheck(${i},'${it.k}','ok',this.checked)">
                                        </td>
                                        <td style="padding:4px 6px;">
                                            <textarea rows="2" style="width:100%;padding:5px 7px;border:1px solid ${ch.obs?'#b0c8b0':'#e8b060'};border-radius:4px;font-size:0.82em;resize:vertical;background:${ch.obs?'#f8fff8':'#fffbf0'};" placeholder="Ingrese observación..." onblur="window.guardarRevisionCheck(${i},'${it.k}','obs',this.value)">${ch.obs||''}</textarea>
                                        </td>
                                    </tr>`;
                                }).join('')}
                            </table>
                        </div>`;
                    })()}
                    <button class="btn-finish" onclick="window.updateFlujo(${i},'met_ok')">✅ Guardar Metrología</button>`;
                }
                else if (d.estado === 'ejecucion_trabajos') {
                    // ── Sistema de trabajos individuales por técnico ──
                    const mecTrab = d.mec_trab_usuario || {};
                    const usuActual = window.usuarioActual?.nombre || window.usuarioActual?.usuario || '';
                    const trabajosMec = [];
                    const det2 = d.detalle || {};
                    if(d.enc_lc=='si') trabajosMec.push({k:'encam_lc', label:'🔧 Encamisado Lado Carga (LC)'});
                    if(d.enc_ll=='si') trabajosMec.push({k:'encam_ll', label:'🔧 Encamisado Lado Libre (LL)'});
                    if(d.met_lc=='si') trabajosMec.push({k:'metal_lc', label:'⚙️ Metalado / Rectificado Eje LC'});
                    if(d.met_ll=='si') trabajosMec.push({k:'metal_ll', label:'⚙️ Metalado / Rectificado Eje LL'});
                    if(det2.rectificado=='si') trabajosMec.push({k:'rectif', label:'🗜️ Rectificado General'});
                    if(det2.fabricacion=='si') trabajosMec.push({k:'fabric', label:'🏭 Fabricación de Pieza'});
                    if(trabajosMec.length===0) trabajosMec.push({k:'trab_gral', label:'🔩 Trabajo Mecánico General'});

                    const tarjetas = trabajosMec.map(tw => {
                        const tj = mecTrab[tw.k] || null;
                        const esMio = tj && tj.usuario === usuActual;
                        const tomado = tj && tj.usuario;
                        const finalizado = tj && tj.ok;
                        const archivos = (tj && tj.archivos) ? tj.archivos : [];
                        if (!tomado) {
                            return `<div style="border:2px dashed #b0c8e8;border-radius:10px;padding:14px 16px;margin-bottom:12px;background:#f8fbff;">
                                <div style="font-weight:700;font-size:0.95em;color:#004F88;margin-bottom:8px;">${tw.label}</div>
                                <div style="font-size:0.83em;color:#777;margin-bottom:10px;">Trabajo disponible — ningún técnico asignado.</div>
                                <button onclick="window.tomarTrabajoMec(${i},'${tw.k}')" style="background:#004F88;color:white;border:none;border-radius:6px;padding:8px 18px;cursor:pointer;font-weight:bold;font-size:0.9em;">✋ Tomar este trabajo</button>
                            </div>`;
                        } else if (finalizado) {
                            return `<div style="border:2px solid #27ae60;border-radius:10px;padding:14px 16px;margin-bottom:12px;background:#f0fff4;">
                                <div style="font-weight:700;font-size:0.95em;color:#1a7a44;margin-bottom:8px;">${tw.label}</div>
                                <div style="display:flex;align-items:center;gap:10px;background:#d4f5e2;border:1.5px solid #27ae60;border-radius:8px;padding:9px 14px;margin-bottom:6px;">
                                    <span style="font-size:1.5em;line-height:1;">✅</span>
                                    <div>
                                        <div style="font-weight:800;font-size:0.93em;color:#145a32;letter-spacing:0.3px;">OK — APROBADO</div>
                                        <div style="font-size:0.83em;color:#1a7a44;margin-top:2px;">👤 Técnico responsable: <b style="font-size:1em;">${tj.usuario}</b></div>
                                    </div>
                                </div>
                                ${tj.medidas ? `<div style="font-size:0.83em;margin-top:6px;background:#fff;border:1px solid #b2dfcb;border-radius:5px;padding:6px 10px;"><b>📏 Medidas/Notas:</b> ${tj.medidas}</div>` : ''}
                                ${archivos.length ? `<div style="margin-top:6px;font-size:0.8em;">${archivos.map(a=>`<a href="${a.url}" target="_blank" style="color:#004F88;margin-right:8px;">📎 ${a.name}</a>`).join('')}</div>` : ''}
                            </div>`;
                        } else {
                            const puedeEditar = esMio || (window.usuarioActual?.rol==='admin');
                            return `<div style="border:2px solid #e8a000;border-radius:10px;padding:14px 16px;margin-bottom:12px;background:#fffbf0;">
                                <div style="font-weight:700;font-size:0.95em;color:#8a5c00;margin-bottom:4px;">${tw.label} <span style="background:#e8a000;color:white;border-radius:10px;padding:2px 8px;font-size:0.78em;margin-left:6px;">⏳ EN CURSO</span></div>
                                <div style="font-size:0.83em;color:#555;margin-bottom:8px;">👤 Asignado a: <b>${tj.usuario}</b></div>
                                ${puedeEditar ? `<div style="margin-bottom:8px;">
                                    <label style="font-size:0.82em;font-weight:600;color:#666;display:block;margin-bottom:3px;">Medidas / Notas:</label>
                                    <textarea style="width:100%;min-height:60px;padding:6px 8px;border:1px solid #ddc070;border-radius:5px;font-size:0.84em;resize:vertical;"
                                        placeholder="Ingresa medidas, tolerancias, observaciones..."
                                        onblur="window.guardarMecMedidas(${i},'${tw.k}',this.value)">${tj.medidas||''}</textarea>
                                </div>
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                                    <input type="file" id="mecfile_${i}_${tw.k}" style="font-size:0.8em;">
                                    <button onclick="window.subirMecArchivo(${i},'${tw.k}')" style="background:#555;color:white;border:none;border-radius:5px;padding:5px 12px;cursor:pointer;font-size:0.82em;">⬆️ Subir archivo</button>
                                </div>
                                ${archivos.length ? `<div style="font-size:0.8em;margin-bottom:8px;">${archivos.map(a=>`<a href="${a.url}" target="_blank" style="color:#004F88;margin-right:8px;">📎 ${a.name}</a>`).join('')}</div>` : ''}
                                <button onclick="window.finalizarTrabajoMec(${i},'${tw.k}')" style="background:#27ae60;color:white;border:none;border-radius:6px;padding:8px 18px;cursor:pointer;font-weight:bold;font-size:0.9em;">✅ Marcar como terminado</button>`
                                : `<div style="font-size:0.82em;color:#999;font-style:italic;">Solo el técnico asignado puede editar.</div>
                                ${archivos.length ? `<div style="font-size:0.8em;margin-top:6px;">${archivos.map(a=>`<a href="${a.url}" target="_blank" style="color:#004F88;margin-right:8px;">📎 ${a.name}</a>`).join('')}</div>` : ''}`}
                            </div>`;
                        }
                    }).join('');

                    UI = `<h3>⚙️ Ejecución Mecánica</h3>
                    <div class="det-seccion-titulo" style="margin-bottom:10px;">🔧 Trabajos Asignados por Técnico</div>
                    ${tarjetas}
                    <br>`;
                    if(d.enc_lc=='si') UI += `<div class="row-met-ingreso">EN.LC FINAL: <input type="text" value="${d.ejec_enc_lc||''}" onchange="window.data[${i}].ejec_enc_lc=this.value; window.save()"></div>`;
                    if(d.enc_ll=='si') UI += `<div class="row-met-ingreso">EN.LL FINAL: <input type="text" value="${d.ejec_enc_ll||''}" onchange="window.data[${i}].ejec_enc_ll=this.value; window.save()"></div>`;
                    if(d.met_lc=='si') UI += `<div class="row-met-ingreso">ME.LC FINAL: <input type="text" value="${d.ejec_met_lc||''}" onchange="window.data[${i}].ejec_met_lc=this.value; window.save()"></div>`;
                    if(d.met_ll=='si') UI += `<div class="row-met-ingreso">ME.LL FINAL: <input type="text" value="${d.ejec_met_ll||''}" onchange="window.data[${i}].ejec_met_ll=this.value; window.save()"></div>`;
                    UI += `<br>

                    <div class="det-seccion-titulo" style="margin-top:14px;">📐 Planilla Metrológica de Salida</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;"><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.8em;font-weight:700;">ALOJAMIENTO LADO CARGA (Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Parámetro</th><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Unid. ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d1A||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d1A_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d1B||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d1B_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d1C||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d1C_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d1D||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d1D_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d2A||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d2A_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d2B||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d2B_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d2C||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d2C_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d2D||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d2D_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d3A||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d3A_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d3B||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d3B_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d3C||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d3C_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d3D||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_lc_sal_d3D_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:6px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.76em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín (ej: -7µm)" style="width:85px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" value="${d.metro_aloj_lc_sal_tol_min||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx (ej: +18µm)" style="width:85px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" value="${d.metro_aloj_lc_sal_tol_max||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_tol_max']=this.value;window.save()"><span style="font-size:0.76em;font-weight:700;color:#555;margin-left:6px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" onchange="window.data[${i}]['metro_aloj_lc_sal_conc']=this.value;window.save()"><option value="" ${d.metro_aloj_lc_sal_conc?"":"selected"}>-- Selec. --</option><option value="dentro" ${d.metro_aloj_lc_sal_conc==="dentro"?"selected":""}>✅ Dentro tolerancia</option><option value="fuera"  ${d.metro_aloj_lc_sal_conc==="fuera"?"selected":""}>❌ Fuera tolerancia</option></select></div></div><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.8em;font-weight:700;">ALOJAMIENTO LADO LIBRE (Non Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Parámetro</th><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Unid. ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d1A||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d1A_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d1B||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d1B_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d1C||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d1C_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d1D||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d1D_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d2A||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d2A_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d2B||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d2B_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d2C||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d2C_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d2D||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d2D_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d3A||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d3A_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d3B||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d3B_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d3C||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d3C_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d3D||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_aloj_ll_sal_d3D_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:6px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.76em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín (ej: -7µm)" style="width:85px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" value="${d.metro_aloj_ll_sal_tol_min||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx (ej: +18µm)" style="width:85px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" value="${d.metro_aloj_ll_sal_tol_max||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_tol_max']=this.value;window.save()"><span style="font-size:0.76em;font-weight:700;color:#555;margin-left:6px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" onchange="window.data[${i}]['metro_aloj_ll_sal_conc']=this.value;window.save()"><option value="" ${d.metro_aloj_ll_sal_conc?"":"selected"}>-- Selec. --</option><option value="dentro" ${d.metro_aloj_ll_sal_conc==="dentro"?"selected":""}>✅ Dentro tolerancia</option><option value="fuera"  ${d.metro_aloj_ll_sal_conc==="fuera"?"selected":""}>❌ Fuera tolerancia</option></select></div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;"><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.8em;font-weight:700;">ASENTAMIENTO LADO CARGA (Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Parámetro</th><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Unid. ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d1A||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d1A_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d1B||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d1B_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d1C||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d1C_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d1D||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d1D_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d2A||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d2A_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d2B||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d2B_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d2C||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d2C_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d2D||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d2D_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d3A||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d3A_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d3B||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d3B_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d3C||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d3C_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d3D||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_lc_sal_d3D_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:6px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.76em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín (ej: -7µm)" style="width:85px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" value="${d.metro_asen_lc_sal_tol_min||''}" onchange="window.data[${i}]['metro_asen_lc_sal_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx (ej: +18µm)" style="width:85px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" value="${d.metro_asen_lc_sal_tol_max||''}" onchange="window.data[${i}]['metro_asen_lc_sal_tol_max']=this.value;window.save()"><span style="font-size:0.76em;font-weight:700;color:#555;margin-left:6px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" onchange="window.data[${i}]['metro_asen_lc_sal_conc']=this.value;window.save()"><option value="" ${d.metro_asen_lc_sal_conc?"":"selected"}>-- Selec. --</option><option value="dentro" ${d.metro_asen_lc_sal_conc==="dentro"?"selected":""}>✅ Dentro tolerancia</option><option value="fuera"  ${d.metro_asen_lc_sal_conc==="fuera"?"selected":""}>❌ Fuera tolerancia</option></select></div></div><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.8em;font-weight:700;">ASENTAMIENTO LADO LIBRE (Non Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Parámetro</th><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.76em;text-align:left;">Unid. ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d1A||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d1A_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d1B||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d1B_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d1C||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d1C_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d1D||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d1D_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d2A||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d2A_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d2B||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d2B_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d2C||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d2C_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d2D||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d2D_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d3A||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d3A_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d3B||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d3B_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d3C||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d3C_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:85px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d3D||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:55px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej: J6" value="${d.metro_asen_ll_sal_d3D_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:6px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.76em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín (ej: -7µm)" style="width:85px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" value="${d.metro_asen_ll_sal_tol_min||''}" onchange="window.data[${i}]['metro_asen_ll_sal_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx (ej: +18µm)" style="width:85px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" value="${d.metro_asen_ll_sal_tol_max||''}" onchange="window.data[${i}]['metro_asen_ll_sal_tol_max']=this.value;window.save()"><span style="font-size:0.76em;font-weight:700;color:#555;margin-left:6px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.76em;" onchange="window.data[${i}]['metro_asen_ll_sal_conc']=this.value;window.save()"><option value="" ${d.metro_asen_ll_sal_conc?"":"selected"}>-- Selec. --</option><option value="dentro" ${d.metro_asen_ll_sal_conc==="dentro"?"selected":""}>✅ Dentro tolerancia</option><option value="fuera"  ${d.metro_asen_ll_sal_conc==="fuera"?"selected":""}>❌ Fuera tolerancia</option></select></div></div></div>
                    ${obs('mecanica')}
                        <div class="det-seccion-titulo" style="margin-top:10px;">🔩 Tareas Mecánica Final</div>
                        <div style="background:#f0f4ff;border:1px solid #c0d0f0;border-radius:6px;padding:10px;margin-bottom:10px;">
                            <p style="font-size:0.8em;color:#888;margin:0 0 6px 0;">Agrega cada tarea realizada. Quedará registrada en el informe.</p>
                            <div style="display:flex;gap:6px;margin-bottom:8px;">
                                <input id="tarea_mecanica_${i}" class="med-input" style="flex:1;" placeholder="Ej: Rectificado de eje, Cambio de descansos..."
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTarea('mecanica',${i});}" >
                                <button onclick="window.agregarTarea('mecanica',${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                            </div>
                            <div id="tarea_mecanica_lista_${i}">
                                ${(d.tareas_mecanica||[]).map((item,ti) => `
                                    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #d0dcf8;">
                                        <label style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" ${(d.tareas_mecanica_checks||{})[ti]?'checked':''}
                                                onchange="if(!window.data[${i}].tareas_mecanica_checks) window.data[${i}].tareas_mecanica_checks={};
                                                          window.data[${i}].tareas_mecanica_checks[${ti}]=this.checked;
                                                          window.save();">
                                            <span style="font-size:0.87em;${(d.tareas_mecanica_checks||{})[ti]?'text-decoration:line-through;color:#888;':''}">${item}</span>
                                        </label>
                                        <button onclick="window.quitarTarea('mecanica',${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0 4px;">✕</button>
                                    </div>`).join('')}
                            </div>
                        </div>
                    <button class="btn-finish" onclick="window.updateFlujo(${i},'mec_fin')">✅ Fin Mecánica</button>`;
                }
            }
            else if (window.vistaActual === 'bobinado' && d.estado === 'ejecucion_trabajos' && d.tipoTrabajo === 'bobinado') {
                UI = `<h3>Bobinado</h3>
                    <div class="card-ot">
                        <h4>📦 Datos de Bobinado</h4>
                        <div class="tab-tec-container">
                            <table class="tab-tec">
                                <tr>
                                    <td>Técnico</td>
                                    <td><input type="text" value="${d.bobinado?.tecnico || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, tecnico: this.value}; window.save()"></td>
                                    <td>Hebras</td>
                                    <td><input type="text" value="${d.bobinado?.hebras || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, hebras: this.value}; window.save()"></td>
                                </tr>
                                <tr>
                                    <td>Conexión</td>
                                    <td><input type="text" value="${d.bobinado?.conexion || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado,conexion: this.value}; window.save()"></td>
                                    <td>Sección Original</td>
                                    <td><input type="text" value="${d.bobinado?.seccion_original || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, seccion_original: this.value}; window.save()"></td>
                                </tr>
                                <tr>
                                    <td>Paso</td>
                                    <td><input type="text" value="${d.bobinado?.paso || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, paso: this.value}; window.save()"></td>
                                    <td>Sección Utilizada</td>
                                    <td><input type="text" value="${d.bobinado?.seccion_utilizada || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, seccion_utilizada: this.value}; window.save()"></td>
                                </tr>
                                <tr>
                                    <td>Diámetro Original</td>
                                    <td><input type="text" value="${d.bobinado?.diametro_original || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, diametro_original: this.value}; window.save()"></td>
                                    <td>Vueltas Original</td>
                                    <td><input type="text" value="${d.bobinado?.vueltas_original || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, vueltas_original: this.value}; window.save()"></td>
                                </tr>
                                <tr>
                                    <td>Diámetro Utilizado</td>
                                    <td><input type="text" value="${d.bobinado?.diametro_utilizado || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, diametro_utilizado: this.value}; window.save()"></td>
                                    <td>Vueltas Utilizadas</td>
                                    <td><input type="text" value="${d.bobinado?.vueltas_utilizadas || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, vueltas_utilizadas: this.value}; window.save()"></td>
                                </tr>
                                <tr>
                                    <td>Espiras</td>
                                    <td><input type="text" value="${d.bobinado?.espiras || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, espiras: this.value}; window.save()"></td>
                                    <td>Canal</td>
                                    <td><select value="${d.bobinado?.canal || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, canal: this.value}; window.save()">
                                        <option value="">Seleccione...</option>
                                        <option value="alternativa" ${d.bobinado?.canal === 'alternativa' ? 'selected' : ''}>Alternativa</option>
                                        <option value="media" ${d.bobinado?.canal === 'media' ? 'selected' : ''}>Media</option>
                                        <option value="llena" ${d.bobinado?.canal === 'llena' ? 'selected' : ''}>Llena</option>
                                    </select></td>
                                </tr>
                                <tr>
                                    <td>Grupos</td>
                                    <td><input type="text" value="${d.bobinado?.grupos || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, grupos: this.value}; window.save()"></td>
                                    <td>Ranuras</td>
                                    <td><input type="text" value="${d.bobinado?.ranuras || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, ranuras: this.value}; window.save()"></td>
                                </tr>
                                <tr>
                                    <td>Bobinas</td>
                                    <td><input type="text" value="${d.bobinado?.bobinas || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, bobinas: this.value}; window.save()"></td>
                                    <td>Tipo de Falla</td>
                                    <td><input type="text" value="${d.bobinado?.tipo_falla || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, tipo_falla: this.value}; window.save()"></td>
                                </tr>
                                <tr>
                                    <td>Cables</td>
                                    <td><input type="text" value="${d.bobinado?.cables || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, cables: this.value}; window.save()"></td>
                                    <td>Medida del Molde</td>
                                    <td><input type="text" value="${d.bobinado?.medida_molde || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, medida_molde: this.value}; window.save()"></td>
                                </tr>
                                <tr>
                                    <td>Al.Lado Conexión</td>
                                    <td><input type="text" value="${d.bobinado?.al_lado_conexion || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, al_lado_conexion: this.value}; window.save()"></td>
                                    <td>Coilera Utilizada</td>
                                    <td><input type="text" value="${d.bobinado?.coilera_utilizada || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, coilera_utilizada: this.value}; window.save()"></td>
                                </tr>
                                <tr>
                                    <td>Al.Lado Opuesto</td>
                                    <td><input type="text" value="${d.bobinado?.al_lado_opuesto || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, al_lado_opuesto: this.value}; window.save()"></td>
                                    <td>Peso Alambre</td>
                                    <td><input type="text" value="${d.bobinado?.peso_alambre || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, peso_alambre: this.value}; window.save()"></td>
                                </tr>
                            </table>
                        </div>
                        <h4>🔩 Datos del Fierro</h4>
                        <div class="tab-tec-container">
                            <table class="tab-tec">
                                <tr>
                                    <td>Diámetro Interior</td>
                                    <td><input type="text" value="${d.bobinado?.diametro_interior || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, diametro_interior: this.value}; window.save()"></td>
                                    <td>Culatas</td>
                                    <td><input type="text" value="${d.bobinado?.culatas || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, culatas: this.value}; window.save()"></td>
                                </tr>
                                <tr>
                                    <td>Diámetro Exterior</td>
                                    <td><input type="text" value="${d.bobinado?.diametro_exterior || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, diametro_exterior: this.value}; window.save()"></td>
                                    <td>Lago</td>
                                    <td><input type="text" value="${d.bobinado?.lago || ''}" onchange="window.data[${i}].bobinado={...window.data[${i}].bobinado, lago: this.value}; window.save()"></td>
                                </tr>
                            </table>
                        </div>
                        <h4>⚡ Resistencias</h4>
                        <div class="med-grid">
                            <div><input class="med-input" placeholder="1-2 (Ohm)" value="${d.mediciones.res12||''}" onchange="window.data[${i}].mediciones.res12=this.value; window.save()"></div>
                            <div><input class="med-input" placeholder="1-3 (Ohm)" value="${d.mediciones.res13||''}" onchange="window.data[${i}].mediciones.res13=this.value; window.save()"></div>
                            <div><input class="med-input" placeholder="2-3 (Ohm)" value="${d.mediciones.res23||''}" onchange="window.data[${i}].mediciones.res23=this.value; window.save()"></div>
                        </div>
                        <h4>⚡ Inductancias</h4>
                        <div class="med-grid">
                            <div><input class="med-input" placeholder="1-2 (mH)" value="${d.mediciones.ind12||''}" onchange="window.data[${i}].mediciones.ind12=this.value; window.save()"></div>
                            <div><input class="med-input" placeholder="1-3 (mH)" value="${d.mediciones.ind13||''}" onchange="window.data[${i}].mediciones.ind13=this.value; window.save()"></div>
                            <div><input class="med-input" placeholder="2-3 (mH)" value="${d.mediciones.ind23||''}" onchange="window.data[${i}].mediciones.ind23=this.value; window.save()"></div>
                        </div>
                        <h4>⚡ Surge (Onda de Choque)</h4>
                        <div class="med-grid">
                            <div><input class="med-input" placeholder="1.- (%)" value="${d.mediciones.sur1||''}" onchange="window.data[${i}].mediciones.sur1=this.value; window.save()"></div>
                            <div><input class="med-input" placeholder="2.- (%)" value="${d.mediciones.sur2||''}" onchange="window.data[${i}].mediciones.sur2=this.value; window.save()"></div>
                            <div><input class="med-input" placeholder="3.- (%)" value="${d.mediciones.sur3||''}" onchange="window.data[${i}].mediciones.sur3=this.value; window.save()"></div>
                        </div>
                        <h4>⚡ Aislación</h4>
                        <div><input class="med-input" placeholder="MOhm" value="${d.mediciones.aisla||''}" onchange="window.data[${i}].mediciones.aisla=this.value; window.save()"></div>
                    </div>
                    ${obs('bobinado')}<button class="btn-finish" onclick="window.updateFlujo(${i},'bobinado_fin')">✅ Finalizar Bobinado</button>`;
            }
            else if (window.vistaActual === 'armado_bal') {
                if (d.estado === 'ejecucion_trabajos') {
                    const rods = d.rodamientos || [];
                    const rodChecks = d.rodamientos_ok || {};
                    const todosRodOk = rods.length === 0 || rods.every((_,ri2) => rodChecks[ri2]);
                    const _chkDA   = d.check_desarme || {};
                    const _chkA    = d.check_armado  || {};
                    const _chkAObs = d.check_armado_obs  || {};
                    const _chkARsp = d.check_armado_resp || {};
                    const _fotosA  = d.fotos_armado || {};
                    const _itemsArmado = (window.ITEMS_CHECK_DESARME||[]).filter(it => _chkDA[it.k] && _chkDA[it.k] !== 'na');
                    const _checkArmadoSection = _itemsArmado.length > 0
                        ? `<div class="det-seccion-titulo" style="margin-top:12px;">🔩 Check de Armado por Componente</div>
                           <div style="background:#f8fbff;border:1.5px solid #b0c8e8;border-radius:8px;padding:10px 14px;margin-bottom:14px;overflow-x:auto;">
                               <p style="font-size:0.78em;color:#555;margin:0 0 8px 0;">Marca cada componente al armarlo. Sube hasta 10 fotos por componente.</p>
                               <table style="width:100%;border-collapse:collapse;font-size:0.82em;">
                                   <thead><tr style="background:#004F88;color:white;">
                                       <th style="padding:5px 10px;text-align:left;">COMPONENTE</th>
                                       <th style="padding:5px;text-align:center;width:75px;">DESARME</th>
                                       <th style="padding:5px;text-align:center;width:85px;">✅ ARMADO</th>
                                       <th style="padding:5px 10px;text-align:left;">OBSERVACIÓN</th>
                                       <th style="padding:5px 10px;text-align:left;width:100px;">TÉCNICO</th>
                                       <th style="padding:5px 10px;text-align:left;min-width:150px;">📷 FOTOS</th>
                                   </tr></thead><tbody>
                                   ${_itemsArmado.map((it, ci3) => {
                                       const vDes   = _chkDA[it.k];
                                       const colDes = vDes==='bueno' ? '#27ae60' : '#e74c3c';
                                       const lblDes = vDes==='bueno' ? '✅ BUENO' : '❌ MALO';
                                       const armado = !!_chkA[it.k];
                                       const obsA   = (_chkAObs[it.k]||'').replace(/"/g,'&quot;');
                                       const resp   = _chkARsp[it.k] || '—';
                                       const fotos  = _fotosA[it.k] || [];
                                       const rowBg  = armado ? '#eafff2' : (ci3%2===0?'#f4f8ff':'white');
                                       return `<tr style="background:${rowBg};border-bottom:1px solid #dde1e7;">
                                           <td style="padding:5px 10px;font-weight:600;color:#2c3e50;">${it.label}</td>
                                           <td style="text-align:center;padding:5px;"><span style="color:${colDes};font-weight:700;font-size:0.85em;">${lblDes}</span></td>
                                           <td style="text-align:center;padding:5px;">
                                               <label style="cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
                                                   <input type="checkbox" ${armado?'checked':''}
                                                       style="width:16px;height:16px;accent-color:#27ae60;cursor:pointer;"
                                                       onchange="window.toggleCheckArmado(${i},'${it.k}',this.checked); window.render();">
                                                   <span style="font-size:0.82em;font-weight:700;color:${armado?'#27ae60':'#aaa'};">${armado?'ARMADO':'—'}</span>
                                               </label>
                                           </td>
                                           <td style="padding:4px 8px;">
                                               <input type="text" value="${obsA}" placeholder="Observación..."
                                                   style="width:100%;padding:4px 6px;border:1px solid #dde1e7;border-radius:4px;font-size:0.85em;"
                                                   onblur="window.guardarObsCheckArmado(${i},'${it.k}',this.value)">
                                           </td>
                                           <td style="padding:5px 8px;font-size:0.82em;color:#1a2a6a;font-weight:600;">${resp}</td>
                                           <td style="padding:4px 8px;">
                                               ${window._htmlFotosComponente ? window._htmlFotosComponente(i,'armado',it.k,fotos) : ''}
                                               ${fotos.length < 10 ? `<label style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;background:#e8f0fe;border:1px solid #b0c8e8;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.8em;color:#004F88;font-weight:600;">
                                                   📷 ${fotos.length>0?fotos.length+'/10':'Fotos'}
                                                   <input type="file" accept="image/*" multiple style="display:none;"
                                                       onchange="window.subirFotosComponente(${i},'armado','${it.k}',this)">
                                               </label>` : `<span style="font-size:0.78em;color:#27ae60;font-weight:700;">✅ ${fotos.length}/10</span>`}
                                           </td>
                                       </tr>`;
                                   }).join('')}
                                   </tbody>
                               </table>
                           </div>`
                        : '';
                    UI = `<h3>Balanceo</h3>${obs('balanceo')}<button class="btn-primary btn-sm" onclick="window.updateFlujo(${i},'bal_ok')">✅ Balanceo OK</button><hr><h3>Armado</h3>${_checkArmadoSection}`;
                    if (rods.length > 0) {
                        UI += `<div class="det-seccion-titulo">🔩 Instalación de Rodamientos</div>
                        <div style="background:#f8f9fa;border:1px solid #dde1e7;border-radius:6px;padding:10px;margin-bottom:10px;">
                            ${rods.map((r,ri2) => `
                                <label style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #eee;cursor:pointer;">
                                    <input type="checkbox" ${rodChecks[ri2]?'checked':''}
                                        onchange="if(!window.data[${i}].rodamientos_ok)window.data[${i}].rodamientos_ok={};
                                                  window.data[${i}].rodamientos_ok[${ri2}]=this.checked; window.save();">
                                    <span style="background:#004F88;color:white;border-radius:4px;padding:2px 8px;font-size:0.78em;font-weight:700;">${r.pos}</span>
                                    <span style="flex:1;font-size:0.88em;${rodChecks[ri2]?'text-decoration:line-through;color:#888;':''}">${r.mod}</span>
                                    <span style="font-size:0.8em;font-weight:700;color:${rodChecks[ri2]?'#27ae60':'#aaa'};">
                                        ${rodChecks[ri2]?'✅ Instalado':'Pendiente'}
                                    </span>
                                </label>`).join('')}
                        </div>`;
                    } else {
                        UI += `<p style="color:#aaa;font-size:0.85em;padding:6px 0;">Sin rodamientos registrados en Mecánica.</p>`;
                    }
                    UI += `${obs('armado')}
                        <div class="det-seccion-titulo" style="margin-top:10px;">🏗️ Tareas de Armado</div>
                        <div style="background:#f0f4ff;border:1px solid #c0d0f0;border-radius:6px;padding:10px;margin-bottom:10px;">
                            <p style="font-size:0.8em;color:#888;margin:0 0 6px 0;">Agrega cada tarea realizada. Quedará registrada en el informe.</p>
                            <div style="display:flex;gap:6px;margin-bottom:8px;">
                                <input id="tarea_armado_${i}" class="med-input" style="flex:1;" placeholder="Ej: Instalación de rodamientos, Cierre de tapas..."
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); window.agregarTarea('armado',${i});}" >
                                <button onclick="window.agregarTarea('armado',${i})" style="background:#004F88;color:white;border:none;border-radius:5px;padding:6px 14px;cursor:pointer;font-weight:bold;font-size:1.1em;">+</button>
                            </div>
                            <div id="tarea_armado_lista_${i}">
                                ${(d.tareas_armado||[]).map((item,ti) => `
                                    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #d0dcf8;">
                                        <label style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" ${(d.tareas_armado_checks||{})[ti]?'checked':''}
                                                onchange="if(!window.data[${i}].tareas_armado_checks) window.data[${i}].tareas_armado_checks={};
                                                          window.data[${i}].tareas_armado_checks[${ti}]=this.checked;
                                                          window.save();">
                                            <span style="font-size:0.87em;${(d.tareas_armado_checks||{})[ti]?'text-decoration:line-through;color:#888;':''}">${item}</span>
                                        </label>
                                        <button onclick="window.quitarTarea('armado',${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0 4px;">✕</button>
                                    </div>`).join('')}
                            </div>
                        </div>`;
                    const rodCheck = todosRodOk;
                    if(p.bal_ok && rodCheck) UI += `<button class="btn-finish" onclick="window.updateFlujo(${i},'armado_ok','pruebas_dinamicas')">✅ Fin Armado</button>`;
                    else UI += `<p style="color:red; font-size:0.8em;">* Pendiente: Balanceo y/o Rodamientos.</p>`;
                } else if (d.estado === 'terminaciones') {
                    const tList = d.terminaciones_lista || [];
                    const tChecks = d.terminaciones_checks || {};
                    const todosOk = tList.length === 0 || tList.every((_,ti) => tChecks[ti]);
                    UI = `<h3>Terminaciones</h3>
                        <div class="det-seccion-titulo">📋 Lista de Terminaciones Pendientes</div>
                        ${tList.length === 0
                            ? `<p style="color:#888;font-size:0.88em;padding:8px;">No hay terminaciones pendientes registradas desde Pruebas Dinámicas.</p>`
                            : `<div style="background:#f8f9fa;border:1px solid #dde1e7;border-radius:6px;padding:10px;margin-bottom:12px;">
                                ${tList.map((item, ti) => `
                                    <label class="det-chk-label ${tChecks[ti]?'det-chk-on':''}" style="margin-bottom:6px;">
                                        <input type="checkbox" ${tChecks[ti]?'checked':''}
                                            onchange="if(!window.data[${i}].terminaciones_checks) window.data[${i}].terminaciones_checks={};
                                                      window.data[${i}].terminaciones_checks[${ti}]=this.checked;
                                                      this.closest('label').classList.toggle('det-chk-on',this.checked);
                                                      window.save(); window.render();">
                                        <span>${item}</span>
                                    </label>`).join('')}
                               </div>`
                        }
                        ${obs('terminaciones')}
                        ${todosOk
                            ? `<button class="btn-finish" onclick="window.updateFlujo(${i},'term_ok','check_salida')">✅ Terminaciones Listas → Check Salida</button>`
                            : `<p style="color:#e67e22;font-size:0.85em;font-weight:600;">⚠️ Debes completar todos los ítems de la lista antes de continuar.</p>`
                        }`;
                }
            }
            else if (window.vistaActual === 'despacho' && d.estado === 'despacho') {
                UI = `<h3>Despacho</h3><button class="btn-finish" onclick="window.updateFlujo(${i},'salida_final','entregado')">🚚 MARCAR ENTREGADO</button>`;
            }

            // Renderizar cada OT como un acordeón
            if (UI) {
                const estadoActual = d.estado.replace(/_/g, ' ').toUpperCase();
                const estaAbierto = window.acordeonesAbiertos.has(String(d.ot));
                html += `
                    <div class="ot-accordion-container">
                        <button class="accordion${estaAbierto?' active':''}" data-ot-id="${d.ot}" onclick="toggleAccordion(event)">
                            <span class="ot-accordion-header">
                                <span class="ot-num">OT ${d.ot}</span>
                                <span class="ot-empresa">${d.empresa}</span>
                                <span class="ot-estado">${estadoActual}</span>
                            </span>
                            <span class="accordion-arrow">▾</span>
                        </button>
                        <div class="panel${estaAbierto?' show':''}">
                            <div class="panel-content">
                                ${UI}
                            </div>
                        </div>
                    </div>
                `;
                hay = true;
            }
        });
        v.innerHTML = hay ? html : html + "<p style='color:var(--text2); padding:20px;'>Sin tareas pendientes.</p>";
        // Dibujar gráficos de temperatura pendientes
        setTimeout(() => {
            document.querySelectorAll('canvas[data-idx]').forEach(cv => {
                const idx = parseInt(cv.getAttribute('data-idx'));
                if (!isNaN(idx)) window.dibujarGraficoTemp(idx);
            });
        }, 120);
    }
};

// ── FUNCIONES GESTIÓN USUARIOS ──
window.toggleAsignaciones = () => {
    const rol = document.getElementById('fuRol')?.value;
    const sec = document.getElementById('secAsignaciones');
    if (sec) sec.style.display = rol === 'tecnico' ? 'block' : 'none';
    const secAG = document.getElementById('secAreaGeneral');
    if (secAG) secAG.style.display = rol === 'tecnico' ? 'block' : 'none';
};

window.filtrarOTsForm = () => {
    const q = (document.getElementById('buscadorOT')?.value || '').toLowerCase().trim();
    const dd = document.getElementById('dropdownOTs');
    if (!dd) return;
    // OTs ya agregadas como cards
    const yaAgregadas = new Set([...document.querySelectorAll('#listaOTsForm .ot-card')].map(c => c.dataset.ot));
    const resultados = window._otsList_cache.filter(ot => {
        const emp = (window.data.find(d=>String(d.ot)===String(ot))?.empresa||'').toLowerCase();
        return !yaAgregadas.has(String(ot)) && (!q || String(ot).includes(q) || emp.includes(q));
    }).slice(0, 8);
    if (resultados.length === 0 && !q) { dd.style.display = 'none'; return; }
    if (resultados.length === 0) {
        dd.innerHTML = `<div style="padding:10px 14px;color:var(--text2);font-size:0.88em;">Sin resultados para "${q}"</div>`;
        dd.style.display = 'block'; return;
    }
    dd.innerHTML = resultados.map(ot => {
        const emp = window.data.find(d=>String(d.ot)===String(ot))?.empresa||'';
        return `<div onclick="window.agregarOTCard('${ot}'); document.getElementById('buscadorOT').value=''; document.getElementById('dropdownOTs').style.display='none';"
            style="padding:9px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:0.9em;transition:background 0.15s;"
            onmouseover="this.style.background='#f4f7fb'" onmouseout="this.style.background='white'">
            <span style="font-weight:700;color:var(--text);">OT ${ot}</span>${emp?`<span style="color:var(--text2);margin-left:8px;">— ${emp}</span>`:''}
        </div>`;
    }).join('');
    dd.style.display = 'block';
};

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('#buscadorOT') && !e.target.closest('#dropdownOTs')) {
        const dd = document.getElementById('dropdownOTs');
        if (dd) dd.style.display = 'none';
    }
});

window.agregarOTCard = (ot, asignacionesPrevias = []) => {
    const lista = document.getElementById('listaOTsForm');
    if (!lista) return;
    if (lista.querySelector(`.ot-card[data-ot="${ot}"]`)) return; // ya existe
    const emp = window.data.find(d=>String(d.ot)===String(ot))?.empresa||'';
    const AREAS = [["desarme_mant","🔧 Desarme / Mantención"],["calidad","🔬 Control Calidad"],["mecanica","⚙️ Mecánica"],["bobinado","🌀 Bobinado"],["armado_bal","🔩 Balanceo / Armado"],["despacho","🚚 Despacho"]];
    const card = document.createElement('div');
    card.className = 'ot-card';
    card.dataset.ot = ot;
    card.style.cssText = 'background:#f8f9fa;border:1.5px solid var(--border);border-radius:8px;padding:12px 14px;';
    card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-weight:700;font-size:0.92em;">OT ${ot}${emp?' <span style="color:var(--text2);font-weight:400;">— '+emp+'</span>':''}</span>
            <button type="button" onclick="this.closest('.ot-card').remove()" style="background:none;border:none;cursor:pointer;color:#e74c3c;font-size:1.1em;line-height:1;" title="Quitar OT">✕</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${AREAS.map(([aval,albl]) => {
                const checked = asignacionesPrevias.some(a => String(a.ot)===String(ot) && a.area===aval);
                return `<label style="display:flex;align-items:center;gap:5px;font-size:0.83em;padding:4px 10px;border:1.5px solid ${checked?'var(--primary, #1a2a3a)':'var(--border)'};border-radius:20px;cursor:pointer;background:${checked?'#e8eef5':'white'};transition:all 0.15s;user-select:none;">
                    <input type="checkbox" class="chkAsigArea" data-ot="${ot}" data-area="${aval}" ${checked?'checked':''}
                        style="accent-color:var(--primary,#1a2a3a);"
                        onchange="const lbl=this.closest('label');lbl.style.background=this.checked?'#e8eef5':'white';lbl.style.borderColor=this.checked?'var(--primary,#1a2a3a)':'var(--border)';">
                    ${albl}
                </label>`;
            }).join('')}
        </div>`;
    lista.appendChild(card);
};

window.nuevoUsuarioForm = () => {
    const f = document.getElementById('formUsuario');
    if (!f) return;
    f.style.display = 'block';
    document.getElementById('formUsuTitulo').textContent = 'Nuevo Usuario';
    document.getElementById('fuIdx').value = '-1';
    document.getElementById('fuNombre').value = '';
    document.getElementById('fuUsuario').value = '';
    document.getElementById('fuPass').value = '';
    document.getElementById('fuRol').value = 'encargado';
    document.getElementById('formUsuError').textContent = '';
    if (document.getElementById('buscadorOT')) document.getElementById('buscadorOT').value = '';
    const lista = document.getElementById('listaOTsForm');
    if (lista) lista.innerHTML = '';
    // Resetear checkboxes de área general
    document.querySelectorAll('.chkAreaGen').forEach(c => {
        c.checked = false;
        const lbl = c.closest('label');
        if (lbl) { lbl.style.background = 'white'; lbl.style.borderColor = 'var(--border)'; }
    });
    // Cachear lista de OTs disponibles para el dropdown
    window._otsList_cache = [...window.data].map(d => d.ot).sort((a,b)=>{const na=parseInt(a),nb=parseInt(b);return isNaN(na)||isNaN(nb)?String(a).localeCompare(String(b)):na-nb;});
    window.toggleAsignaciones();
    f.scrollIntoView({behavior:'smooth'});
};

