import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
        import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";


        const firebaseConfig = {
            apiKey: "AIzaSyCvHPNgceh6YlD1DJKPpMazeOuaUX2K_lE",
            authDomain: "byb-norte-82e1a.firebaseapp.com",
            databaseURL: "https://byb-norte-82e1a-default-rtdb.firebaseio.com",
            projectId: "byb-norte-82e1a",
            storageBucket: "byb-norte-82e1a.firebasestorage.app",
            messagingSenderId: "192380195306",
            appId: "1:192380195306:web:e5caf122d22a13ba812293"
        };

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const storage = getStorage(app);
        const dbRef = ref(db, 'taller_byb');
        const usersRef = ref(db, 'usuarios_byb');

        // ── SISTEMA DE USUARIOS ──
        window.data = [];
        window.usuarios = [];
        window.usuarioActual = null;
        window.usuariosCargados = false;

        // Verificar si hay sesión guardada
        try {
            const sesion = sessionStorage.getItem('byb_sesion');
            if (sesion) window.usuarioActual = JSON.parse(sesion);
        } catch(e) {}

        // Helpers de rol
        window.esAdmin     = () => window.usuarioActual?.rol === 'admin';
        window.esEncargado = () => window.usuarioActual?.rol === 'encargado';
        window.esTecnico   = () => window.usuarioActual?.rol === 'tecnico';
        window.puedeEditar = () => window.esAdmin() || window.esEncargado();
        window.puedeEditarOT = (ot, area) => {
            if (window.puedeEditar()) return true;
            if (window.esTecnico()) {
                // Asignación específica a esta OT
                const asig = window.usuarioActual?.asignaciones || [];
                if (asig.some(a => String(a.ot) === String(ot) && (!area || a.area === area))) return true;
                // Área general: el usuario tiene autorización libre en esa área
                const areasGenerales = window.getAreasGenerales();
                // Mapeo vista → areaId
                const areaMap = {
                    desarme_mant: 'desarme_mant',
                    calidad: 'calidad',
                    mecanica: 'mecanica',
                    bobinado: 'bobinado',
                    armado_bal: 'armado_bal',
                    despacho: 'despacho',
                };
                const areaId = areaMap[area] || area;
                if (areaId && areasGenerales.includes(areaId)) return true;
            }
            return false;
        };

        // ── ÁREA GENERAL ── obtiene las áreas generales del usuario
        window.getAreasGenerales = (u) => {
            const usr = u || window.usuarioActual;
            if (!usr) return [];
            if (usr.areaGeneral && usr.areaGeneral.length > 0) return usr.areaGeneral;
            // compatibilidad: asignaciones con ot vacío = área general
            return (usr.asignaciones || []).filter(a => !a.ot).map(a => a.area).filter(Boolean);
        };
        window.tieneAreaGeneral = () => window.getAreasGenerales().length > 0;

        // OTs pendientes por área
        window.getOTsPendientesPorArea = (areaId) => {
            return window.data.filter(d => {
                const p = d.pasos || {};
                if (d.estado === 'entregado') return false;
                switch(areaId) {
                    case 'desarme_mant':
                        return (d.estado === 'desarme' && !p.desarme_ok) ||
                               (d.estado === 'ejecucion_trabajos' && !p.mant_ok);
                    case 'calidad':
                        return (d.estado === 'ingresos_pendientes' && !p.med_ok) ||
                               (d.estado === 'detalle_pendiente' && !p.detalle_ok) ||
                               (d.estado === 'pruebas_dinamicas' && !p.pruebas_ok) ||
                               (d.estado === 'check_salida' && !p.salida_ok) ||
                               (d.estado === 'terminaciones' && !p.term_ok);
                    case 'mecanica':
                        return (d.estado === 'ingresos_pendientes' && !p.met_ok) ||
                               (d.estado === 'ejecucion_trabajos' && !p.mec_fin);
                    case 'bobinado':
                        return d.estado === 'ejecucion_trabajos' &&
                               d.tipoTrabajo === 'bobinado' && !p.bobinado_fin;
                    case 'armado_bal':
                        return (d.estado === 'ejecucion_trabajos' && !p.armado_ok) ||
                               (d.estado === 'terminaciones' && !p.bal_ok);
                    case 'despacho':
                        return d.estado === 'despacho';
                }
                return false;
            });
        };

        // Mostrar/ocultar login
        window.mostrarLogin = () => {
            document.getElementById('loginOverlay').style.display = 'flex';
            document.querySelector('.layout').style.display = 'none';
        };
        window.ocultarLogin = () => {
            document.getElementById('loginOverlay').style.display = 'none';
            document.querySelector('.layout').style.display = 'flex';
        };

        // Login
        window.hacerLogin = () => {
            const usr = (document.getElementById('loginUser')?.value || '').trim().toLowerCase();
            const pwd = document.getElementById('loginPass')?.value || '';
            const err = document.getElementById('loginError');
            if (!window.usuariosCargados) { if(err) err.textContent = '⏳ Conectando... intenta de nuevo'; return; }
            const u = window.usuarios.find(u => u.usuario.toLowerCase() === usr && u.password === pwd && u.activo !== false);
            if (!u) { if(err) err.textContent = '❌ Usuario o contraseña incorrectos'; return; }
            window.usuarioActual = u;
            try { sessionStorage.setItem('byb_sesion', JSON.stringify(u)); } catch(e) {}
            window.ocultarLogin();
            window.actualizarInfoUsuario();
            window.render();
        };

        // Logout
        window.logout = () => {
            if (!confirm('¿Cerrar sesión?')) return;
            window.usuarioActual = null;
            try { sessionStorage.removeItem('byb_sesion'); } catch(e) {}
            window.mostrarLogin();
        };

        // Actualizar nombre en sidebar
        window.actualizarInfoUsuario = () => {
            const el = document.getElementById('sidebarUser');
            if (!el || !window.usuarioActual) return;
            const roles = { admin: '👑 Admin', encargado: '🔧 Encargado', tecnico: '🛠 Técnico' };
            el.innerHTML = `<div style="font-size:0.82em;color:rgba(255,255,255,0.9);font-weight:600;">${window.usuarioActual.nombre}</div><div style="font-size:0.7em;color:rgba(255,255,255,0.5);">${roles[window.usuarioActual.rol]||''}</div>`;
            const menuUsu = document.getElementById('menuUsuarios');
            if (menuUsu) menuUsu.style.display = window.esAdmin() ? 'flex' : 'none';
            // Botón dinámico "Trabajos Pendientes" para usuarios con área general
            let btnPend = document.getElementById('menuPendientes');
            if (!btnPend) {
                const nav = el.closest('nav') || el.parentElement;
                if (nav) {
                    btnPend = document.createElement('button');
                    btnPend.id = 'menuPendientes';
                    btnPend.className = 'nav-btn';
                    btnPend.onclick = () => window.mostrarVista('trabajosPendientes');
                    btnPend.style.cssText = 'display:none;width:100%;text-align:left;padding:10px 16px;border:none;background:rgba(255,140,0,0.18);color:#ffa726;cursor:pointer;font-weight:700;font-size:0.88em;border-radius:6px;margin:4px 0;transition:background 0.2s;';
                    btnPend.onmouseover = () => btnPend.style.background = 'rgba(255,140,0,0.32)';
                    btnPend.onmouseout  = () => btnPend.style.background = 'rgba(255,140,0,0.18)';
                    // Insertar antes del menuUsuarios o al principio del nav
                    const ref = menuUsu || nav.firstChild;
                    nav.insertBefore(btnPend, ref);
                }
            }
            if (btnPend) {
                const areas = window.getAreasGenerales();
                if (areas.length > 0) {
                    const totalPend = areas.reduce((acc, a) => acc + window.getOTsPendientesPorArea(a).length, 0);
                    btnPend.style.display = 'flex';
                    btnPend.innerHTML = `🔔 Trabajos Pendientes${totalPend > 0 ? ` <span style="background:#e74c3c;color:#fff;border-radius:50%;padding:1px 7px;font-size:0.8em;margin-left:auto;">${totalPend}</span>` : ''}`;
                } else {
                    btnPend.style.display = 'none';
                }
            }
            // Botón dinámico "Nueva OT" para técnicos de calidad
            let btnNuevaOT = document.getElementById('menuNuevaOT');
            const esCalidad = window.esTecnico() && window.getAreasGenerales().includes('calidad');
            if (esCalidad && !btnNuevaOT) {
                const nav = el.closest('nav') || el.parentElement;
                if (nav) {
                    btnNuevaOT = document.createElement('button');
                    btnNuevaOT.id = 'menuNuevaOT';
                    btnNuevaOT.className = 'nav-btn';
                    btnNuevaOT.onclick = () => window.mostrarVista('crear');
                    btnNuevaOT.style.cssText = 'display:flex;width:100%;text-align:left;padding:10px 16px;border:none;background:rgba(0,120,80,0.18);color:#2ecc71;cursor:pointer;font-weight:700;font-size:0.88em;border-radius:6px;margin:4px 0;transition:background 0.2s;';
                    btnNuevaOT.onmouseover = () => btnNuevaOT.style.background = 'rgba(0,120,80,0.32)';
                    btnNuevaOT.onmouseout  = () => btnNuevaOT.style.background = 'rgba(0,120,80,0.18)';
                    btnNuevaOT.innerHTML = '➕ Nueva OT';
                    const refNode = document.getElementById('menuPendientes') || document.getElementById('menuUsuarios') || nav.firstChild;
                    nav.insertBefore(btnNuevaOT, refNode);
                }
            } else if (!esCalidad && btnNuevaOT) {
                btnNuevaOT.remove();
            }
        };

        // Cargar usuarios desde Firebase
        onValue(usersRef, (snap) => {
            const val = snap.val();
            if (val && typeof val === 'object') {
                window.usuarios = Object.values(val).filter(u => u && u.usuario);
            } else if (!val) {
                // Base de datos vacía → cargar todos los usuarios del sistema
                const usuariosIniciales = [
        {
                "usuario": "anibal.aguilar",
                "password": "anibal7618",
                "nombre": "Anibal Aguilar",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "desarme_mant"
                        }
                ]
        },
        {
                "usuario": "alan.araya",
                "password": "alan7238",
                "nombre": "Alan Araya",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "mecanica"
                        }
                ]
        },
        {
                "usuario": "eduardo.avellaneda",
                "password": "eduardo4278",
                "nombre": "Eduardo Avellaneda",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "armado_bal"
                        }
                ]
        },
        {
                "usuario": "gary.barbery",
                "password": "gary3929",
                "nombre": "Gary Barbery",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "armado_bal"
                        }
                ]
        },
        {
                "usuario": "cristian.carvajal",
                "password": "cristian4772",
                "nombre": "Cristian Carvajal",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "armado_bal"
                        },
                        {
                                "ot": "",
                                "area": "bobinado"
                        }
                ]
        },
        {
                "usuario": "jose.castillo",
                "password": "jose5070",
                "nombre": "Jose Castillo",
                "rol": "admin",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "sebastian.contreras",
                "password": "sebastian3183",
                "nombre": "Sebastian Contreras",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "desarme_mant"
                        },
                        {
                                "ot": "",
                                "area": "bobinado"
                        }
                ]
        },
        {
                "usuario": "alejandro.delgado",
                "password": "alejandro2418",
                "nombre": "Alejandro Delgado",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "calidad"
                        }
                ]
        },
        {
                "usuario": "martin.choque",
                "password": "martin5114",
                "nombre": "Martin Choque",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "desarme_mant"
                        }
                ]
        },
        {
                "usuario": "ronal.choque",
                "password": "ronal7276",
                "nombre": "Ronal Choque",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "desarme_mant"
                        }
                ]
        },
        {
                "usuario": "martirian.choque",
                "password": "martirian9696",
                "nombre": "Martirian Choque",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "desarme_mant"
                        }
                ]
        },
        {
                "usuario": "alejandro.cordero",
                "password": "alejandro9824",
                "nombre": "Alejandro Cordero",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "desarme_mant"
                        }
                ]
        },
        {
                "usuario": "carlos.delacruz",
                "password": "carlos2471",
                "nombre": "Carlos De la cruz",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "armado_bal"
                        }
                ]
        },
        {
                "usuario": "luis.dias",
                "password": "luis9016",
                "nombre": "Luis Dias",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "bobinado"
                        }
                ]
        },
        {
                "usuario": "fernando.duran",
                "password": "fernando4268",
                "nombre": "Fernando Duran",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "armado_bal"
                        }
                ]
        },
        {
                "usuario": "martin.gomez",
                "password": "martin7908",
                "nombre": "Martin Gomez",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "calidad"
                        }
                ]
        },
        {
                "usuario": "pedro.gutierrez",
                "password": "pedro4550",
                "nombre": "Pedro Gutierrez",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "armado_bal"
                        }
                ]
        },
        {
                "usuario": "samir.guerrero",
                "password": "samir7127",
                "nombre": "Samir Guerrero",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "desarme_mant"
                        }
                ]
        },
        {
                "usuario": "claudio.hernandez",
                "password": "claudio7358",
                "nombre": "Claudio Hernandez",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "bobinado"
                        }
                ]
        },
        {
                "usuario": "franz.mamani",
                "password": "franz4483",
                "nombre": "Franz Mamani",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "mecanica"
                        }
                ]
        },
        {
                "usuario": "matias.maturana",
                "password": "matias3494",
                "nombre": "Matias Maturana",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "armado_bal"
                        }
                ]
        },
        {
                "usuario": "esteban.mondaca",
                "password": "esteban8560",
                "nombre": "Esteban Mondaca",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "mecanica"
                        }
                ]
        },
        {
                "usuario": "edwin.montero",
                "password": "edwin3932",
                "nombre": "Edwin Montero",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "bobinado"
                        }
                ]
        },
        {
                "usuario": "william.montero",
                "password": "william6551",
                "nombre": "William Montero",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "bobinado"
                        }
                ]
        },
        {
                "usuario": "nicolas.montero",
                "password": "nicolas2359",
                "nombre": "Nicolas Montero",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "desarme_mant"
                        }
                ]
        },
        {
                "usuario": "fernando.perez",
                "password": "fernando9662",
                "nombre": "Fernando Perez",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "armado_bal"
                        },
                        {
                                "ot": "",
                                "area": "bobinado"
                        }
                ]
        },
        {
                "usuario": "gualberto.perez",
                "password": "gualberto2438",
                "nombre": "Gualberto Perez",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "mecanica"
                        }
                ]
        },
        {
                "usuario": "fidel.rios",
                "password": "fidel8684",
                "nombre": "Fidel Rios",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "mecanica"
                        }
                ]
        },
        {
                "usuario": "nicolas.soloaga",
                "password": "nicolas6183",
                "nombre": "Nicolas Soloaga",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "armado_bal"
                        }
                ]
        },
        {
                "usuario": "jorge.tapia",
                "password": "jorge7596",
                "nombre": "Jorge Tapia",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": [
                        {
                                "ot": "",
                                "area": "calidad"
                        }
                ]
        },
        {
                "usuario": "manuel.vazquez",
                "password": "manuel1698",
                "nombre": "Manuel Vazquez",
                "rol": "encargado",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "elizabeth.gomez",
                "password": "elizabeth5413",
                "nombre": "Elizabeth Gomez",
                "rol": "admin",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "ricardo.gomez",
                "password": "ricardo1124",
                "nombre": "Ricardo Gomez",
                "rol": "admin",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "usuario01",
                "password": "clave7966",
                "nombre": "Usuario 01",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "usuario02",
                "password": "clave4338",
                "nombre": "Usuario 02",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "usuario03",
                "password": "clave6939",
                "nombre": "Usuario 03",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "usuario04",
                "password": "clave9754",
                "nombre": "Usuario 04",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "usuario05",
                "password": "clave2324",
                "nombre": "Usuario 05",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "usuario06",
                "password": "clave8570",
                "nombre": "Usuario 06",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "usuario07",
                "password": "clave9497",
                "nombre": "Usuario 07",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "usuario08",
                "password": "clave4245",
                "nombre": "Usuario 08",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "usuario09",
                "password": "clave8580",
                "nombre": "Usuario 09",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": []
        },
        {
                "usuario": "usuario10",
                "password": "clave1840",
                "nombre": "Usuario 10",
                "rol": "tecnico",
                "activo": true,
                "asignaciones": []
        }
];
                window.usuarios = usuariosIniciales;
                const obj = {};
                usuariosIniciales.forEach(u => { obj[u.usuario.replace(/\./g,'_')] = u; }); // clave segura Firebase
                set(usersRef, obj);
                console.log('✅ Usuarios iniciales cargados:', usuariosIniciales.length);
            }
            window.usuariosCargados = true;
            // Refrescar sesión activa con datos actualizados
            if (window.usuarioActual) {
                const u = window.usuarios.find(u => u.usuario === window.usuarioActual.usuario);
                if (u && u.activo !== false) {
                    window.usuarioActual = u;
                    try { sessionStorage.setItem('byb_sesion', JSON.stringify(u)); } catch(e) {}
                    window.actualizarInfoUsuario();
                } else if (!u || u.activo === false) {
                    window.usuarioActual = null;
                    try { sessionStorage.removeItem('byb_sesion'); } catch(e) {}
                    window.mostrarLogin();
                    return;
                }
            } else {
                window.mostrarLogin();
            }
        });

        window.guardarUsuarios = () => {
            const obj = {};
            // Firebase no permite '.' en claves → reemplazamos por '_' solo en la clave
            window.usuarios.forEach(u => {
                if(u && u.usuario) {
                    const safeKey = u.usuario.replace(/\./g, '_');
                    obj[safeKey] = u;
                }
            });
            console.log('💾 Guardando usuarios en Firebase:', Object.keys(obj));
            return set(usersRef, obj);
        };
        window.vistaActual = "dashboard";
        window.filtroBusqueda = "";
        window.menuAbierto = false;

        let firebaseConectado = false;
        const fbTimeout = setTimeout(() => {
            if (!firebaseConectado) {
                try { window.data = JSON.parse(localStorage.getItem('taller_byb_backup') || '[]'); } catch(e) { window.data = []; }
                window.actualizarAlertas();
                window.render();
            }
        }, 8000);

        onValue(dbRef, (snapshot) => {
            firebaseConectado = true;
            clearTimeout(fbTimeout);
            window.data = snapshot.val() || [];
            try { localStorage.setItem('taller_byb_backup', JSON.stringify(window.data)); } catch(e) {}
            window.actualizarAlertas();
            window.actualizarInfoUsuario();
            window.render();
        }, (error) => {
            firebaseConectado = true;
            clearTimeout(fbTimeout);
            console.error('Firebase error:', error.message);
            try { window.data = JSON.parse(localStorage.getItem('taller_byb_backup') || '[]'); } catch(e) { window.data = []; }
            window.actualizarAlertas();
            window.render();
        });

        
        window.agregarTarea = (area, i) => {
            const input = document.getElementById(`tarea_${area}_${i}`);
            const txt = (input?.value || '').trim();
            if (!txt) return;
            const key = `tareas_${area}`;
            if (!window.data[i][key]) window.data[i][key] = [];
            window.data[i][key].push(txt);
            input.value = '';
            window.save();
            const lista = document.getElementById(`tarea_${area}_lista_${i}`);
            if (lista) {
                lista.innerHTML = window.data[i][key].map((item, ti) => `
                    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #d0dcf8;">
                        <label style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">
                            <input type="checkbox" ${(window.data[i][key+'_checks']||{})[ti]?'checked':''}
                                onchange="if(!window.data[${i}]['${key}_checks']) window.data[${i}]['${key}_checks']={};
                                          window.data[${i}]['${key}_checks'][${ti}]=this.checked; window.save();">
                            <span style="font-size:0.87em;">${item}</span>
                        </label>
                        <button onclick="window.quitarTarea('${area}',${i},${ti})" style="background:none;border:none;color:#e74c3c;cursor:pointer;padding:0 4px;">✕</button>
                    </div>`).join('');
                input.focus();
            }
        };

        window.quitarTarea = (area, i, ti) => {
            const key = `tareas_${area}`;
            if (!window.data[i][key]) return;
            window.data[i][key].splice(ti, 1);
            const checks = window.data[i][key+'_checks'] || {};
            const newChecks = {};
            window.data[i][key].forEach((_, ni) => { if (checks[ni >= ti ? ni+1 : ni]) newChecks[ni] = true; });
            window.data[i][key+'_checks'] = newChecks;
            window.save();
            window.render();
        };

        window.save = () => {
            if (!window.usuarioActual) return Promise.resolve();
            try { localStorage.setItem('taller_byb_backup', JSON.stringify(window.data)); } catch(e) {}
            return set(dbRef, window.data);
        };
        window.mostrarVista = (v) => {
            window.vistaActual = v;
            window.render();
            if (window.menuAbierto) {
                const sidebar = document.getElementById('sidebar');
                const btn = document.getElementById('menuToggleBtn');
                sidebar.classList.remove('expanded');
                btn.textContent = '☰';
                window.menuAbierto = false;
            }
        };

        // Función para alternar la visibilidad del menú en móviles
        window.toggleMenu = () => {
            const sidebar = document.getElementById('sidebar');
            const btn = document.getElementById('menuToggleBtn');
            const abierto = sidebar.classList.toggle('expanded');
            window.menuAbierto = abierto;
            btn.textContent = abierto ? '✕' : '☰';
        }

        window.subirArchivo = async (i) => {
            const input = document.getElementById(`file_input_${i}`);
            const file = input.files[0];
            if (!file) return alert("Selecciona un archivo");
            const btn = document.getElementById(`btn_file_${i}`);
            btn.innerText = "Subiendo..."; btn.disabled = true;
            try {
                const storagePath = sRef(storage, `ot_${window.data[i].ot}/${Date.now()}_${file.name}`);
                await uploadBytes(storagePath, file);
                const url = await getDownloadURL(storagePath);
                if (!window.data[i].archivos) window.data[i].archivos = [];
                window.data[i].archivos.push({ name: file.name, url: url });
                window.save();
                alert("Archivo subido correctamente");
            } catch (e) { alert("Error al subir archivo"); }
            finally { btn.innerText = "Subir"; btn.disabled = false; input.value = ""; }
        };

        window.verDetalle = (i) => {
            const d = window.data[i];
            const m = d.mediciones || {};
            const p = d.placa || {};
            const modal = document.getElementById('modalDetalle');
            const cont = document.getElementById('contenidoDetalle');
            cont.innerHTML = `
                <h2>Detalle OT: ${d.ot} - ${d.empresa}</h2>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                    <div>
                        <h4>📋 Datos de Placa</h4>
                        <p><b>Marca:</b> ${p.marca||'-'} | <b>Potencia:</b> ${p.pot||'-'}</p>
                        <p><b>RPM:</b> ${p.rpm||'-'} | <b>Volt:</b> ${p.volt||'-'}</p>
                        <p><b>Amp:</b> ${p.amp||'-'} | <b>Frame:</b> ${p.frame||'-'}</p>
                        <hr>
                        <h4>📊 Mediciones de Ingreso</h4>
                        <p><b>Resistencia (Ω):</b> 1-2: ${m.res12||'-'} | 1-3: ${m.res13||'-'} | 2-3: ${m.res23||'-'}</p>
                        <p><b>Inductancia (mH):</b> 1-2: ${m.ind12||'-'} | 1-3: ${m.ind13||'-'} | 2-3: ${m.ind23||'-'}</p>
                        <p><b>Surge (%):</b> 1: ${m.sur1||'-'} | 2: ${m.sur2||'-'} | 3: ${m.sur3||'-'}</p>
                        <p><b>Aislación:</b> ${m.aisla||'-'} MΩ</p>
                        <p><b>IP / DAR:</b> ${m.ipdar||'-'}</p>
                    </div>
                    <div>
                        <h4>📁 Archivos y Evidencia</h4>
                        ${(d.archivos || []).map(f => `<a href="${f.url}" target="_blank" style="display:block; margin-bottom:5px; color:#3498db;">📄 ${f.name}</a>`).join('') || 'Sin archivos cargados.'}
                    </div>
                </div>
            `;
            modal.style.display = "block";
        };


        // ── Calcular % avance por OT ──────────────────────────────
        window.calcularAvance = (d) => {
            if (!d) return 0;
            const ETAPAS = [
                'desarme_ok','med_ok','met_ok','detalle_ok',
                'mant_ok','mec_fin','bobinado_fin',
                'bal_ok','armado_ok','pruebas_ok','term_ok','salida_ok'
            ];
            const p = d.pasos || {};
            // Etapas del flujo
            const etapasTotal = ETAPAS.length;
            const etapasDone  = ETAPAS.filter(e => p[e]).length;

            // Tareas con check marcadas vs total
            const areas = ['desarme','mantencion','calidad','mecanica_ing','mecanica','armado','pruebas'];
            let tarTotal = 0, tarDone = 0;
            areas.forEach(a => {
                const lista = d[`tareas_${a}`] || [];
                const chks  = d[`tareas_${a}_checks`] || {};
                tarTotal += lista.length;
                tarDone  += lista.filter((_,ti) => chks[ti]).length;
            });

            // Terminaciones
            const tList   = d.terminaciones_lista || [];
            const tChecks = d.terminaciones_checks || {};
            tarTotal += tList.length;
            tarDone  += tList.filter((_,ti) => tChecks[ti]).length;

            // Peso: etapas 70%, tareas 30%
            const pEtapas = etapasTotal ? (etapasDone / etapasTotal) * 70 : 0;
            const pTareas = tarTotal     ? (tarDone    / tarTotal)    * 30 : (etapasDone > 0 ? 30 : 0);
            const pct = Math.round(pEtapas + pTareas);

            // Si estado es entregado → 100%
            if (d.estado === 'entregado') return 100;
            return Math.min(pct, 99); // nunca 100% hasta entregado
        };

        // Color según avance
        window.colorAvance = (pct) => {
            if (pct >= 80) return '#27ae60';
            if (pct >= 50) return '#f39c12';
            return '#e74c3c';
        };

        // Barra HTML de avance
        window.barraAvance = (pct, mostrarNum=true) => {
            const col = window.colorAvance(pct);
            return `<div style="display:flex;align-items:center;gap:6px;min-width:120px;">
                <div style="flex:1;background:#e0e0e0;border-radius:6px;height:8px;overflow:hidden;">
                    <div style="width:${pct}%;background:${col};height:8px;border-radius:6px;transition:width 0.4s;"></div>
                </div>
                ${mostrarNum?`<span style="font-size:0.78em;font-weight:700;color:${col};min-width:32px;">${pct}%</span>`:''}
            </div>`;
        };

        window.actualizarAlertas = () => {
            const counts = { desarme: 0, calidad: 0, mecanica: 0, bobinado: 0, armado: 0, despacho: 0 };
            window.data.forEach(d => {
                const p = d.pasos || {};
                if (d.estado === 'desarme' && !p.desarme_ok) counts.desarme++;
                if (d.estado === 'ejecucion_trabajos' && !p.mant_ok) counts.desarme++;
                if (d.estado === 'ingresos_pendientes' && !p.med_ok) counts.calidad++;
                if (d.estado === 'detalle_pendiente' && !p.detalle_ok) counts.calidad++;
                if (d.estado === 'pruebas_dinamicas' && !p.pruebas_ok) counts.calidad++;
                if (d.estado === 'check_salida' && !p.salida_ok) counts.calidad++;
                if (d.estado === 'ingresos_pendientes' && !p.met_ok) counts.mecanica++;
                if (d.estado === 'ejecucion_trabajos' && !p.mec_fin) counts.mecanica++;
                if (d.estado === 'ejecucion_trabajos' && d.tipoTrabajo === 'bobinado' && !p.bobinado_fin) counts.bobinado++;
                if (d.estado === 'ejecucion_trabajos' && !p.armado_ok) counts.armado++;
                if (d.estado === 'terminaciones' && !p.term_ok) counts.armado++;
                if (d.estado === 'terminaciones' && !p.term_ok) counts.calidad++;
                if (d.estado === 'despacho') counts.despacho++;
            });
            const setLabel = (id, text, num) => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = num > 0 ? `${text} <span class="alert-count">${num}</span>` : text;
            };
            setLabel('m-desarme', 'Desarme y Mant.', counts.desarme);
            setLabel('m-calidad', 'Control Calidad', counts.calidad);
            setLabel('m-mecanica', 'Área Mecánica', counts.mecanica);
            setLabel('m-bobinado', 'Área Bobinado', counts.bobinado);
            setLabel('m-armado', 'Balanceo y Armado', counts.armado);
            setLabel('m-despacho', 'Área Despacho', counts.despacho);
        };


        // ── Generador DOCX BYB Norte — COMPLETO ──
        const LOGO_B64 = "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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/xAAC/9oADAMBAAIAAwAAACEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIOMQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAd0IAAMwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAABOsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIPGMAAAAAAABO4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAABIQIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADq0AAAAAAAAAAAAIEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApO0AAAAAAAAAAAACEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACoBO0AAAAAAAAAAAASQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACkABO0AAAAAAAAMjBxUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsAABO0AAAAAVEl2n1UAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABFEAAAAAAABRcAMAJWkCPMA+pTgAgYNj4APHSIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABRcEIABXw4AAv2pWgADEkGyIAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABRIIMAEKDrhbpAFGAACDfMSxmXcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAABCDBBDCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/xAAC/9oADAMBAAIAAwAAABDzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzrqljzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzy2976v/wA8888888888888888888888888888888888888888888888888888888888888888888888888888888888888888887Fs+++++/18888888888888888888888888888888888888888888888888888888888888888888888888888888888888886+Xv8AvvvvvvvrUvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPAnvvvvvvvvvvvrGfvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPNmfvvvvvvvvvvvvHvvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPvGfvvvvvvvvvvvvu/vPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPffGfvvvvvvvvvvvpkvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPNPffGfvvvvvvvvat1UfPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPH/fffHfvvvvvL6HffRfPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPNfffffPfvtq4x6PffQfPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPfffffPtXVwl6PffVfPPPPPPPPOftNcvfPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPL/fffffeP/wBUJej330HzzzzzzzCb74emvpJDfzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz7333332j/8AVCXo999F888833Y+6cPLXHl59xY8888888888888888888888888888888888888888888888888888888888888885999999+//AFQl6PffUfOP1UUzyvoqyh+U1faMnvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOffffffav/wBUJej330COBcaksM7Z7QcMeOV3xFTLTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzy73333323/8AVCXo999Ab/LqxDHnau6rCzdTF9sfow3888888888888888888888888888888888888888888888888888888888889999999p//AFQl6PffUz4z38sQ+SlntY05a6XfBZgNPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPLffffffaf/wBUJej331Wk8edrGVOLqpjsLN9P34bKsFX/AM88888888888888888888888888888888888888888888888888888888q999999/8A/wBUJej330VXONsPLkNeL4a/JJhmpcPdd9Rfbzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyv333333r/8AVCXo999BhxXTTSNjj6S2bnVrrqXDXX/XXq+88888888888888888888888888888888888888888888888888888884999999s//AFQl6PffQeOZ+54x/U34qwV1a66lw11/1166FvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPL9vffffaP/wBUJej330Hxn8+PsYls6ukFdWuupcNdf9demxt7zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz7333337f8AVCXo999F8tN/bbmMq+rpBXVrrqXDXX/XXp8U2888888888888888888888888888888888888888888888888888888X99999r3/AFQl6PffQYLTTZ1Mvqvq6QV1a66lw11/116fVEVPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPffffb1v1Ql6PffQQsHyVVAvqvq6QV1a66lw11/116fFAVPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPN/fffffXv1Ql6PffQQglX/1Avqvq6QV1a66lw11/116fFARvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP/fffffff1Ql6PffQQgglP1Avqvq6QW+Yabmw11/116fVAU/PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPNffffffVP1Ql6PffQQgglP1AvqvobT32vMCySX18116PFAUPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOfffffffP1Ql6PffQQgglP1AvrujPPPCsY/PNTT/AN9ej1QEDzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz7333333b9UJej330EIIJT9QbNTzzzzkYWydCCWoXdej1QFXzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzX333333b9UJej330EIIJT9RGfzzzzzy7bWyU0s11dejxQGXzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxz333332r9UJej331EMILT9d7zzzzzwVOYOWAoY+ZdejxQFbzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz7333330T9UJej330FkAJSt3zzzzzyOqUdJcFjumFdej1Q5zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzy/333333/8AXCXo999F8/AT88888887xDChna/R3N0XXo9U7888888888888888888888888888888888888888888888888888888s999999X/AFQl6PffUfPKLPPPPPPPJ32ywic7srSKV16PEF/PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPLffffffX/wBcJej330XzzzzzzzzzzK3d8/NomuYKH9Nen3Zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzy7333331X9UJej331Hzzzzzzzzyttnj38vt7evZ3/denlXzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz7333331z9cJej330XzzzzzzzzpXxllHktNs7fdT9demxbzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzn333333z9UJej331HzzzzzzzDGHTxglhhvd+bRf8dervzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyj33333179UJej330Xzzzzzy4dlmXSxAlAiued9f99er7zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzv333331T9UJej331Hzzzzj8Mudti3SxD1QleNcf8devzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzy9X33331T9UJej330Xzz6cSXafedFn3yxU1gstde99BXzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzy5j33333z9UJej330TQu5Y6sGY++NiXXyxHmcNdftObzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz1X33333b9UJej331YQ1E/bqtF7v9M2XXygNcNde87/AM8888888888888888888888888888888888888888888888888888888888Yd9999X/AFQl6PffUuuUGe/mi0Wmz97Adeqlw119T/PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOMffffWf1Ql6PffVT4y0LWmpp3Un737Mq6ly113fPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPbffffff1Ql6PffRVKcS4JUypp7Qp1lK66hw12vfPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPLS9fffeP1Ql6PffV7m99jqFR0qt6dFVa66lw0//ADzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzytX33379UJej331dTxe3arhm7ZfsFdWuupeX/AM888888888888888888888888888888888888888888888888888888888888888vbQ99o/VCXo999XXW/YGR05bOrpBXVrrqCl888888888888888888888888888888888888888888888888888888888888888888tm99s/VCXo999XXDCnFOyeq+rpBXVrrs188888888888888888888888888888888888888888888888888888888888888888888z599/XCXo999XXDCW/wDBvqvq6QV1a5RPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPc0d9lAl6PffV1wwlv8Axb4r6ukFdX33zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz1mXZYJej331dcMJb/AMWuq+rpBSt98888888888888888888888888888888888888888888888888888888888888888888888888sroKkXo999XXDCW/wDAvqvq6TXvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPH+al6PffV1wwlv8AxLor6X9zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxtqn331dcMJb/AMU+A988888888888888888888888888888888888888888888888888888888897z1888888888888888888888889u331XXDCTwtd/888873z1888888888888888888888888888888888888888888888888888+DDA88888888888888888888888888+f8tv8AnPPPPPPPPKgwvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOgwxPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPKgw/vPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOgw0PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPKgw/vPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOgwwPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPKgw/vPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOgwwPNsWvN/PPPPPPNt4luP/ADzzzzzzzPVyf137zwT33TyoMPzrrnjPzzzzzzzjSQXrjzzzzzzzzfCbzzzzzzzzzzzzzzzzzzzzzzoMMTysMIINvzzzzy0IMMMNBvzzzzzyAMNWoMNfzwgML7yoMPz8MMMFHfzzzz+MMMMMGXTzzzzuqEMPzzzzzzzzzzzzzzzzzzzzzzoMNDwsMMMNP3zzzIMMMMMMMObzzy8AMMNWoMNfzwAMP7yoMPz8MMMMPfXzyCIMMMMMMOHTzz2AMMMPzzzzzzzzzzzzzzzzzzzzzyoMMDw0EYIIMH/ywMMMQ0cgMMLzzkgMMcd+gMNfzyAML7yoMPz8gAAMMMTzuMIMUsAsIMPbzykMMMA3zzzzzzzzzzzzzzzzzzzzzzoMMDzzzw+gMIbygMMhzzywwMMPzgMMEzzyoMNfzyAMP7yoMP7zzz2kMMFysMMHfzzzsIMP/sIMJp3zzzzzzzzzzzzzzzzzzzzzzyoMMDzzzzwsMMKUMMfTzzzzkEMPSAMMXzzyoMNfzwgMP7yoMP7zzzy0IMP+gMJTzzzywgMN78INV/zzzzzzzzzzzzzzzzzzzzzzzzoMMTzzzzyoMMPUMNH7zzzzwAMLcMML/wA88iDDX88ADC+8qDC888888ADDRiDD188888iCDQoDDH8888888888888888888888888rDDH088884DDFxDDBX8888+DCD8iDD8888rDD388gDD+8iDCf88888gDCcLDDW88888JDCdsDDA8888888888888888888888888sBDDw8884zDDQthDDV88884CCR8DDD8888pDDE28gDD+8LCDH18887jDC9qCCD+888rhDCc4DDA88888888888888888888888888ICDBSx9aDDDu8pDDTC73yjDDV8DDD88888BDCz1CDD+8rDDDm8w3BDDE8sBDDTzw9gDDEd8DDA88888888888888888888888888tDDDDDDDDDN98vnDDDDDCCCP/wDAwgvPPPPDgwwwwww/vPCgwwgwwwwxlPPCwwgwwwwwxb/PAwwPPPPPPPPPPPPPPPPPPPPPPPPPPPCCAwwwwgnv/PPLbAwwggg1nfPAww/PPPPLCSQgwggvvPPRQwwggwiRPPPLCyQgwwwxPPPPAgwPPPPPPPPPPPPPPPPPPPPPPPPPPPPLexSCSTHPPPPPPKygRBpXPPPAQgt/PPPPPLYRygw/vPPPLJhzC7nvPPPPPHzTxjBXfPPLQghvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPCgwvPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOgww9/PPPPPPPPPPPPPPPPPPOFEN/PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPO/ctEgwxnfPOPOBHMPPPMMPPPMHGOf7wFPOFNPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPKwwwwwxbPPPODHfTjKbOvivYBu4tH/vkl+nXzUPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPKwwwwwX/PPPKOH/8AD54wz74kO574Pz76iv8A03kQ88888888888888888888888888888888888888888888888888888888888888oBDKJf88888oo/kIZ1y+Qg/a/5TA0e5YC+CV/b888888888888888888888888888888888888888888888888888888888888888t/c8888888oo+88uo427U+r/oE8U99Gn2qxyJ8888888888888888888888888888888888888888888888888888888888888888888888888oo3188o7x++eA/pU8seLDpQ+2CU8888888888888888888888888888888888888888888888888888888888888888888888888sxCSwBCQGlLrohTU88YiP8A99iOHPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPHHHPPPPPPPLLLPDLPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP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";
        const loadJSZip = () => { if(window.JSZip) return Promise.resolve(window.JSZip); return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload=()=>res(window.JSZip); s.onerror=rej; document.head.appendChild(s); }); };

        const xE = s => String(s==null||s===undefined?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const fmtFecha = () => new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});
        const v = (val, suf='') => { const s=String(val||'').trim(); return s?(s+suf):'-'; };

        // ─ XML primitivos ─
        const CAL = (sz,col,bold) => `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${bold?'<w:b/>':''}<w:color w:val="${col||'2C3E50'}"/><w:sz w:val="${sz||16}"/><w:szCs w:val="${sz||16}"/>`;
        const R  = (t,sz,col,bold) => `<w:r><w:rPr>${CAL(sz,col,bold)}</w:rPr><w:t xml:space="preserve">${xE(t)}</w:t></w:r>`;
        const SP = (b=60) => `<w:p><w:pPr><w:spacing w:before="${b}" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:p>`;
        const BORD = `<w:tblBorders><w:top w:val="single" w:sz="1" w:space="0" w:color="DDE1E7"/><w:left w:val="single" w:sz="1" w:space="0" w:color="DDE1E7"/><w:bottom w:val="single" w:sz="1" w:space="0" w:color="DDE1E7"/><w:right w:val="single" w:sz="1" w:space="0" w:color="DDE1E7"/><w:insideH w:val="single" w:sz="1" w:space="0" w:color="DDE1E7"/><w:insideV w:val="single" w:sz="1" w:space="0" w:color="DDE1E7"/></w:tblBorders>`;

        const TC = (w,fill,xml,center=false,span=0) => `<w:tc><w:tcPr>${span>1?`<w:gridSpan w:val="${span}"/>`:''}<w:tcW w:w="${w}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${fill||'FFFFFF'}"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>${center?'<w:jc w:val="center"/>':''}</w:pPr>${xml}</w:p></w:tc>`;
        const TH = (t,w,c=true) => TC(w,'004F88',R(t,13,'FFFFFF',true),c);
        const TD = (t,w,c=false) => TC(w,'FFFFFF',R(v(t),13,'2C3E50',false),c);
        const TR = (cells,h=85) => `<w:tr><w:trPr><w:trHeight w:val="${h}"/></w:trPr>${cells.join('')}</w:tr>`;
        const TABLA = (cols,rows) => { const tot=cols.reduce((a,b)=>a+b,0); return `<w:tbl><w:tblPr><w:tblW w:w="${tot}" w:type="dxa"/><w:tblInd w:w="130" w:type="dxa"/>${BORD}<w:tblCellMar><w:left w:w="10" w:type="dxa"/><w:right w:w="10" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cols.map(c=>`<w:gridCol w:w="${c}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`; };
        const SECC = (t) => `<w:p><w:pPr><w:spacing w:before="50" w:after="20" w:line="240" w:lineRule="auto"/><w:shd w:val="clear" w:color="auto" w:fill="004F88"/><w:ind w:left="80" w:right="80"/></w:pPr>${R(t,13,'FFFFFF',true)}</w:p>`;
        const F2  = (label,val,W=9026) => { const w1=Math.round(W*0.36),w2=W-w1; return TABLA([w1,w2],[TR([TH(label,w1,false),TD(val,w2)])]); };
        const F2W = (label,val,W=9026) => { const w1=Math.round(W*0.36),w2=W-w1; return TABLA([w1,w2],[TR([TC(w1,'F5F6F7',R(label,13,'555555',true),false),TD(val,w2)])]); };  // obs style
        const PIE = () => `<w:p><w:pPr><w:spacing w:before="300" w:after="60" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${R('Documento generado: '+fmtFecha()+' — BORYBOR NORTE',14,'AAAAAA')}</w:p>`;
        const CHKROW = (on,txt,w) => TC(w,on?'E8F8F0':'FFFFFF',`<w:r><w:rPr>${CAL(13,on?'27AE60':'888888',on)}</w:rPr><w:t xml:space="preserve">${on?'☑':'☐'} ${xE(txt)}</w:t></w:r>`,false);

        // ─ Tablas reutilizables ─
        const tabEncab = (d,W=9026) => { const c=[2200,2313,2200,2313]; return TABLA(c,[TR([TH('OT',c[0]),TD(d.ot,c[1],true),TH('EMPRESA',c[2]),TD(d.empresa,c[3],true)]),TR([TH('FECHA',c[0]),TD(fmtFecha(),c[1],true),TH('TIPO TRABAJO',c[2]),TD((d.tipoTrabajo||'-').toUpperCase(),c[3],true)])]); };

        const tabPlaca = (d,W=9026) => { const p=d.placa||{}; const c=[1503,1503,1505,1505,1505,1505]; return TABLA(c,[TR([TH('MARCA',c[0]),TD(p.marca,c[1]),TH('POTENCIA',c[2]),TD(p.pot,c[3]),TH('FRAME',c[4]),TD(p.frame,c[5])]),TR([TH('RPM',c[0]),TD(p.rpm,c[1]),TH('VOLTAJE',c[2]),TD(p.volt,c[3]),TH('AMP',c[4]),TD(p.amp,c[5])])]); };

        const tabMedElec = (vals,W=9026) => {
            const c=[1652,1469,1469,1469,1553], cA=[1701,1843,1843];
            const tabRIS=TABLA(c,[TR([TH('',c[0]),TH('1-2',c[1]),TH('1-3',c[2]),TH('2-3',c[3]),TH('UNIDAD',c[4])]),TR([TH('RESISTENCIA',c[0],false),TD(vals.res12,c[1],true),TD(vals.res13,c[2],true),TD(vals.res23,c[3],true),TC(c[4],'FFFFFF',R('Ohm',16,'888888'),true)]),TR([TH('INDUCTANCIA',c[0],false),TD(vals.ind12,c[1],true),TD(vals.ind13,c[2],true),TD(vals.ind23,c[3],true),TC(c[4],'FFFFFF',R('mH',16,'888888'),true)]),TR([TH('SURGE',c[0],false),TD(vals.sur1,c[1],true),TD(vals.sur2,c[2],true),TD(vals.sur3,c[3],true),TC(c[4],'FFFFFF',R('%',16,'888888'),true)])]);
            const ai=v(vals.aisla);
            const tabA=TABLA(cA,[TR([TH('AISLACIÓN',cA[0]),TC(cA[1],'FFFFFF','',false),TC(cA[2],'FFFFFF',`<w:r><w:rPr>${CAL(16,'2C3E50')}</w:rPr><w:t xml:space="preserve">${xE(ai)}  M </w:t></w:r><w:r><w:rPr>${CAL(16,'888888')}</w:rPr><w:t>Ohm</w:t></w:r>`,false)]),TR([TH('IP / DAR',cA[0]),TD(vals.ipdar,cA[1])])]);
            return tabRIS+SP(0)+tabA;
        };


        // ─ tabMetroPlanillaCombinada: Entrada+Salida en una tabla (4 columnas) ─
        const tabMetroPlanillaCombinada = (d, prefijo_ing, prefijo_sal, titulo, W=9026) => {
            const c1=1800, c2=2208, c3=2208, c4=1810;
            const tot = c1+c2+c3+c4;
            const DIAMS = ['1-A','1-B','1-C','1-D','2-A','2-B','2-C','2-D','3-A','3-B','3-C','3-D'];
            const filas = DIAMS.map(dm => {
                const ki  = prefijo_ing+'_d'+dm.replace('-','');
                const ks  = prefijo_sal+'_d'+dm.replace('-','');
                const kia = prefijo_ing+'_d'+dm.replace('-','')+'_aj';
                const vi  = d[ki]  || '—';
                const vs  = d[ks]  || vi;   // si no hay salida, repetir ingreso
                const aj  = d[kia] || (d[prefijo_sal+'_d'+dm.replace('-','')+'_aj']) || '—';
                return TR([
                    TC(c1,'F5F5F5', R('Diámetro '+dm,11,'333333'), false),
                    TC(c2,'FFFFFF', R(vi+(vi==='—'?'':' mm'),11,'2C3E50'), false),
                    TC(c3,'FFFFFF', R(vs+(vs==='—'?'':' mm'),11,'2C3E50'), false),
                    TC(c4,'FFFFFF', R(aj,11,'2C3E50',true), true),
                ]);
            });
            // Tolerancia y conclusión — usar salida si existe, si no ingreso
            const pref = d[prefijo_sal+'_tol_min'] ? prefijo_sal : prefijo_ing;
            const tolMin  = d[pref+'_tol_min'] || '—';
            const tolMax  = d[pref+'_tol_max'] || '—';
            const concI   = d[prefijo_ing+'_conc'] || '';
            const concS   = d[prefijo_sal+'_conc'] || concI;
            const concTxt = (conc) => conc==='dentro' ? '✓ Dentro de tolerancia' : conc==='fuera' ? '✗ Fuera de tolerancia' : '—';
            const concClr = (conc) => conc==='dentro' ? '27AE60' : conc==='fuera' ? 'E74C3C' : '888888';
            return TABLA([c1,c2,c3,c4],[
                TR([TC(tot,'1A3A5C', R(titulo,12,'FFFFFF',true), false, 4)]),
                TR([
                    TC(c1,'D5E3F0', R('Parámetro',11,'003366',true),false),
                    TC(c2,'D5E3F0', R('Valores de Entrada',11,'003366',true),false),
                    TC(c3,'D5E3F0', R('Valores de Salida',11,'003366',true),false),
                    TC(c4,'D5E3F0', R('Unidad de ajuste',11,'003366',true),true),
                ]),
                ...filas,
                TR([
                    TC(c1,'EBEBEB', R('Tolerancia de ajuste',11,'333333',true),false),
                    TC(c2,'FFFFFF', R('± '+tolMin,11,'2C3E50'),false),
                    TC(c3,'FFFFFF', R('+ '+tolMax,11,'2C3E50'),false),
                    TC(c4,'FFFFFF', R('',11,'FFFFFF'),false),
                ]),
                TR([
                    TC(c1,'EBEBEB', R('Conclusión',11,'333333',true),false),
                    TC(c2, concI==='dentro'?'E8F8F0':concI==='fuera'?'FFF5F5':'F8F8F8', R(concTxt(concI),11,concClr(concI),true),false),
                    TC(c3+c4, concS==='dentro'?'E8F8F0':concS==='fuera'?'FFF5F5':'F8F8F8', R(concTxt(concS),11,concClr(concS),true),false,2),
                ]),
            ]);
        };


        const tabMetro = (ini,sal,W=9026) => { const c=[1858,1858,1858]; return TABLA(c,[TR([TH('',c[0]),TH('INICIALES',c[1]),TH('SALIDA',c[2])]),TR([TH('EN.LC',c[0],false),TD(ini.enc_lc,c[1],true),TD(sal.enc_lc,c[2],true)]),TR([TH('EN.LL',c[0],false),TD(ini.enc_ll,c[1],true),TD(sal.enc_ll,c[2],true)]),TR([TH('ME.LC',c[0],false),TD(ini.me_lc,c[1],true),TD(sal.me_lc,c[2],true)]),TR([TH('ME.LL',c[0],false),TD(ini.me_ll,c[1],true),TD(sal.me_ll,c[2],true)])]); };

        const tabBobCompleto = (d,W=9026) => {
            const b=d.bobinado||{}, obs_b=(d.observaciones||{}).bobinado||'';
            const c=[2256,2256,2257,2257];
            const filas = [
                TR([TH('TÉCNICO',c[0]),TD(b.tecnico,c[1]),TH('TIPO DE FALLA',c[2]),TD(b.tipo_falla,c[3])]),
                TR([TH('CONEXIÓN',c[0]),TD(b.conexion,c[1]),TH('HEBRAS',c[2]),TD(b.hebras,c[3])]),
                TR([TH('PASO',c[0]),TD(b.paso,c[1]),TH('CANAL',c[2]),TD(b.canal,c[3])]),
                TR([TH('GRUPOS',c[0]),TD(b.grupos,c[1]),TH('RANURAS',c[2]),TD(b.ranuras,c[3])]),
                TR([TH('BOBINAS',c[0]),TD(b.bobinas,c[1]),TH('ESPIRAS',c[2]),TD(b.espiras,c[3])]),
                TR([TH('DIÁM. ORIGINAL',c[0]),TD(b.diametro_original,c[1]),TH('DIÁM. UTILIZADO',c[2]),TD(b.diametro_utilizado,c[3])]),
                TR([TH('SECC. ORIGINAL',c[0]),TD(b.seccion_original,c[1]),TH('SECC. UTILIZADA',c[2]),TD(b.seccion_utilizada,c[3])]),
                TR([TH('VUELTAS ORIG.',c[0]),TD(b.vueltas_original,c[1]),TH('VUELTAS UTIL.',c[2]),TD(b.vueltas_utilizadas,c[3])]),
                TR([TH('PESO ALAMBRE',c[0]),TD(b.peso_alambre,c[1]),TH('CABLES',c[2]),TD(b.cables,c[3])]),
                TR([TH('AL. LADO CONEXIÓN',c[0]),TD(b.al_lado_conexion,c[1]),TH('AL. LADO OPUESTO',c[2]),TD(b.al_lado_opuesto,c[3])]),
                TR([TH('COILERA',c[0]),TD(b.coilera_utilizada,c[1]),TH('MEDIDA MOLDE',c[2]),TD(b.medida_molde,c[3])]),
                // Datos del fierro
                TR([TC(W,'E8F0FA',R('DATOS DEL FIERRO',13,'004F88',true),false,4)], 80),
                TR([TH('DIÁM. INTERIOR',c[0]),TD(b.diametro_interior,c[1]),TH('CULATAS',c[2]),TD(b.culatas,c[3])]),
                TR([TH('DIÁM. EXTERIOR',c[0]),TD(b.diametro_exterior,c[1]),TH('LAGO',c[2]),TD(b.lago,c[3])]),
                // Mediciones eléctricas bobinado
                TR([TC(W,'E8F0FA',R('MEDICIONES ELÉCTRICAS',13,'004F88',true),false,4)], 80),
                TR([TH('R 1-2 (Ω)',c[0]),TD((d.mediciones||{}).res12,c[1]),TH('R 1-3 (Ω)',c[2]),TD((d.mediciones||{}).res13,c[3])]),
                TR([TH('R 2-3 (Ω)',c[0]),TD((d.mediciones||{}).res23,c[1]),TH('AISLACIÓN (MΩ)',c[2]),TD((d.mediciones||{}).aisla,c[3])]),
                TR([TH('IND 1-2 (mH)',c[0]),TD((d.mediciones||{}).ind12,c[1]),TH('IND 1-3 (mH)',c[2]),TD((d.mediciones||{}).ind13,c[3])]),
                TR([TH('IND 2-3 (mH)',c[0]),TD((d.mediciones||{}).ind23,c[1]),TH('SURGE 1 (%)',c[2]),TD((d.mediciones||{}).sur1,c[3])]),
                TR([TH('SURGE 2 (%)',c[0]),TD((d.mediciones||{}).sur2,c[1]),TH('SURGE 3 (%)',c[2]),TD((d.mediciones||{}).sur3,c[3])]),
                // Observaciones
                TR([TC(W,'E8F0FA',R('OBSERVACIONES BOBINADO',13,'004F88',true),false,4)], 80),
                TR([TC(W,'FFFFFF',R(obs_b||'—',13,'555555'),false,4)], 160),
            ];
            return TABLA([c[0],c[1],c[2],c[3]], filas);
        };

        const tabBob = (d,W=9026) => { const b=d.bobinado||{}; const c=[2256,2256,2257,2257]; return TABLA(c,[TR([TH('CONEXIÓN',c[0]),TD(b.conexion,c[1]),TH('HEBRAS',c[2]),TD(b.hebras,c[3])]),TR([TH('PASO',c[0]),TD(b.paso,c[1]),TH('CANAL',c[2]),TD(b.canal,c[3])]),TR([TH('GRUPOS',c[0]),TD(b.grupos,c[1]),TH('RANURAS',c[2]),TD(b.ranuras,c[3])]),TR([TH('BOBINAS',c[0]),TD(b.bobinas,c[1]),TH('ESPIRAS',c[2]),TD(b.espiras,c[3])]),TR([TH('DIÁM. ORIGINAL',c[0]),TD(b.diametro_original,c[1]),TH('DIÁM. UTILIZADO',c[2]),TD(b.diametro_utilizado,c[3])]),TR([TH('SECC. ORIGINAL',c[0]),TD(b.seccion_original,c[1]),TH('SECC. UTILIZADA',c[2]),TD(b.seccion_utilizada,c[3])]),TR([TH('VUELTAS ORIG.',c[0]),TD(b.vueltas_original,c[1]),TH('VUELTAS UTIL.',c[2]),TD(b.vueltas_utilizadas,c[3])]),TR([TH('PESO ALAMBRE',c[0]),TD(b.peso_alambre,c[1]),TH('CABLES',c[2]),TD(b.cables,c[3])]),TR([TH('AL. CONEXIÓN',c[0]),TD(b.al_lado_conexion,c[1]),TH('AL. OPUESTO',c[2]),TD(b.al_lado_opuesto,c[3])])]); };

        const tabBobFierro = (d,W=9026) => { const b=d.bobinado||{}; const c=[2256,2256,2257,2257]; return TABLA(c,[TR([TH('DIÁM. INTERIOR',c[0]),TD(b.diametro_interior,c[1]),TH('CULATAS',c[2]),TD(b.culatas,c[3])]),TR([TH('DIÁM. EXTERIOR',c[0]),TD(b.diametro_exterior,c[1]),TH('LAGO',c[2]),TD(b.lago,c[3])]),TR([TH('MEDIDA MOLDE',c[0]),TD(b.medida_molde,c[1]),TH('COILERA',c[2]),TD(b.coilera_utilizada,c[3])])]); };

        const tabPruebas = (d,W=9026) => {
            const m=d.mediciones||{};
            const cVR=[3249,5777], cC=[1504,1502,1505,1505,1505,1505], cVib=[2257,2257,2257,2257];
            const tabVR=TABLA(cVR,[TR([TH('Voltaje Prueba Salida',cVR[0],false),TD(v(m.voltaje_prueba_salida)+' V',cVR[1])]),TR([TH('RPM Salida',cVR[0],false),TD(m.rpm_salida,cVR[1])])]);
            const tabC=TABLA(cC,[TR([TH('CONSUMO- R',cC[0]),TD(m.consumo_r,cC[1],true),TH('CONSUMO -S',cC[2]),TD(m.consumo_s,cC[3],true),TH('CONSUMO- T',cC[4]),TD(m.consumo_t,cC[5],true)])]);
            const tabVib=TABLA(cVib,[TR([TH('1-A',cVib[0]),TD(m.vib_1a,cVib[1],true),TH('2-A',cVib[2]),TD(m.vib_2a,cVib[3],true)]),TR([TH('1-H',cVib[0]),TD(m.vib_1h,cVib[1],true),TH('2-H',cVib[2]),TD(m.vib_2h,cVib[3],true)]),TR([TH('1-V',cVib[0]),TD(m.vib_1v,cVib[1],true),TH('2-V',cVib[2]),TD(m.vib_2v,cVib[3],true)])]);
            return tabVR+SP(0)+tabC+SP(0)+tabVib;
        };

        const tabRodamientos = (d,W=9026) => {
            const rods = d.rodamientos || [];
            const rodChecks = d.rodamientos_ok || {};
            // Compatibilidad: si no hay array pero hay rod_lc/rod_ll
            const lista = rods.length > 0 ? rods : [
                ...(d.rod_lc ? [{pos:'LC', mod:d.rod_lc, ok:d.rod_lc_ok}] : []),
                ...(d.rod_ll ? [{pos:'LL', mod:d.rod_ll, ok:d.rod_ll_ok}] : []),
            ];
            if (!lista.length) return TABLA([W],[TR([TD('(Sin rodamientos registrados)',W)])]);
            const c=[1500,5526,2000];
            return TABLA(c,[
                TR([TH('POSICIÓN',c[0]),TH('MODELO',c[1]),TH('ESTADO',c[2])]),
                ...lista.map((r,ri)=>{
                    const ok = r.ok !== undefined ? r.ok : !!rodChecks[ri];
                    return TR([
                        TC(c[0],'E8F0FA',R(r.pos||'—',13,'004F88',true),true),
                        TC(c[1],'FFFFFF',R(r.mod||'—',13,'2C3E50'),false),
                        TC(c[2],ok?'E8F8F0':'FFF5F5',R(ok?'✅ Instalado':'Pendiente',13,ok?'27AE60':'E74C3C',true),true),
                    ]);
                })
            ]);
        };

        const tabChecks = (items,marcados,W=9026) => { const w=Math.round(W/2); const rows=[]; for(let i=0;i<items.length;i+=2){ const a=items[i],b=items[i+1]; rows.push(`<w:tr><w:trPr><w:trHeight w:val="85"/></w:trPr>${CHKROW(marcados[a.k],a.l,w)}${b?CHKROW(marcados[b.k],b.l,W-w):`<w:tc><w:tcPr><w:tcW w:w="${W-w}" w:type="dxa"/></w:tcPr><w:p></w:p></w:tc>`}</w:tr>`); } return TABLA([w,W-w],rows); };

        const tabObsAreas = (areas,W=9026) => {
            // areas can be [label, obs] or [label, obs, responsable]
            const hasResp = areas.some(a => a.length >= 3);
            if (hasResp) {
                const c=[2100,2200,4726];
                return TABLA(c,[
                    TR([TC(c[0],'E8EEF6',R('ÁREA',12,'333333',true),false),TC(c[1],'E8EEF6',R('RESPONSABLE',12,'333333',true),false),TC(c[2],'E8EEF6',R('OBSERVACIONES',12,'333333',true),false)]),
                    ...areas.map(([l,vl,resp])=>TR([TC(c[0],'F5F6F7',R(l,12,'555555',true),false),TC(c[1],'EAF0FF',R(resp||'—',11,'1a2a6a',false),false),TD(vl,c[2])]))
                ]);
            }
            const c=[3249,5777]; return TABLA(c,areas.map(([l,vl])=>TR([TC(c[0],'F5F6F7',R(l,13,'555555',true),false),TD(vl,c[1])])));
        };

        // Tabla piezas recepción (SI/NO/MAL ESTADO + obs)
        const tabPiezasRecepcion = (piezas,W=9026) => {
            if(!piezas||piezas.length===0) return TABLA([W],[TR([TD('(Sin piezas registradas)',W)])]);
            const c=[3200,800,800,900,W-3200-800-800-900];
            const est = e => e==='si'?'SI':e==='no'?'NO':e==='mal'?'MAL ESTADO':'-';
            const col = e => e==='si'?'27AE60':e==='no'?'E74C3C':e==='mal'?'E67E22':'888888';
            return TABLA(c,[
                TR([TH('PIEZA',c[0],false),TH('SI',c[1]),TH('NO',c[2]),TH('MAL',c[3]),TH('OBSERVACIONES',c[4],false)]),
                ...piezas.map((p,pi)=>TR([
                    TC(c[0],pi%2===0?'F0F4FF':'FFFFFF',`<w:r><w:rPr>${CAL(13,'2C3E50',true)}</w:rPr><w:t>${xE(p.nombre)}</w:t></w:r>`,false),
                    TC(c[1],p.estado==='si'?'E8F8F0':'FFFFFF',p.estado==='si'?`<w:r><w:rPr>${CAL(13,'27AE60',true)}</w:rPr><w:t>✓</w:t></w:r>`:'',true),
                    TC(c[2],p.estado==='no'?'FFF0F0':'FFFFFF',p.estado==='no'?`<w:r><w:rPr>${CAL(13,'E74C3C',true)}</w:rPr><w:t>✗</w:t></w:r>`:'',true),
                    TC(c[3],p.estado==='mal'?'FFF8E8':'FFFFFF',p.estado==='mal'?`<w:r><w:rPr>${CAL(13,'E67E22',true)}</w:rPr><w:t>!</w:t></w:r>`:'',true),
                    TC(c[4],'FFFFFF',`<w:r><w:rPr>${CAL(13,'555555')}</w:rPr><w:t xml:space="preserve">${xE(p.obs||'')}</w:t></w:r>`,false),
                ]))
            ]);
        };

        // Tabla piezas de SALIDA (con estado SI/NO/NA definido en check salida)
        const tabPiezasSalida = (piezas, pSalida, W=9026) => {
            if(!piezas||piezas.length===0) return TABLA([W],[TR([TD('(Sin piezas registradas)',W)])]);
            const c=[3000,800,800,800,W-3000-800-800-800];
            return TABLA(c,[
                TR([TH('PIEZA',c[0],false),TH('INGRESÓ',c[1]),TH('SALE',c[2]),TH('N/A',c[3]),TH('OBS.',c[4],false)]),
                ...piezas.map((p,pi)=>{
                    const ingE = p.estado==='si'?'SI':p.estado==='no'?'NO':p.estado==='mal'?'MAL':'-';
                    const salE = (pSalida&&pSalida[pi]) || 'na';
                    return TR([
                        TC(c[0],pi%2===0?'F0F4FF':'FFFFFF',`<w:r><w:rPr>${CAL(16,'2C3E50',true)}</w:rPr><w:t>${xE(p.nombre)}</w:t></w:r>`,false),
                        TC(c[1],'FFFFFF',`<w:r><w:rPr>${CAL(14,p.estado==='si'?'27AE60':p.estado==='no'?'E74C3C':'E67E22')}</w:rPr><w:t>${xE(ingE)}</w:t></w:r>`,true),
                        TC(c[2],salE==='si'?'E8F8F0':'FFFFFF',salE==='si'?`<w:r><w:rPr>${CAL(16,'27AE60',true)}</w:rPr><w:t>✓</w:t></w:r>`:'',true),
                        TC(c[3],salE==='no'?'FFF0F0':'FFFFFF',salE==='no'?`<w:r><w:rPr>${CAL(16,'E74C3C',true)}</w:rPr><w:t>✗</w:t></w:r>`:'',true),
                        TC(c[4],salE==='na'?'F5F5F5':'FFFFFF',salE==='na'?`<w:r><w:rPr>${CAL(14,'888888',true)}</w:rPr><w:t>N/A</w:t></w:r>`:`<w:r><w:rPr>${CAL(14,'555555')}</w:rPr><w:t xml:space="preserve">${xE(p.obs||'')}</w:t></w:r>`,false),
                    ]);
                })
            ]);
        };

        // Tabla lista de texto simple (hallazgos, terminaciones)
        const tabLista = (items,W=9026) => {
            if(!items||items.length===0) return TABLA([W],[TR([TD('(Sin registros)',W)])]);
            return TABLA([W],items.map(item=>TR([TC(W,'FFFFFF',`<w:r><w:rPr>${CAL(16,'2C3E50')}</w:rPr><w:t xml:space="preserve">• ${xE(item)}</w:t></w:r>`,false)])));
        };

        // Tabla terminaciones con estado check
        const tabTerminaciones = (items,checks,W=9026) => {
            if(!items||items.length===0) return TABLA([W],[TR([TD('(Sin terminaciones registradas)',W)])]);
            const c=[500,W-500];
            return TABLA(c,[
                TR([TH('',c[0]),TH('ÍTEM',c[1],false)]),
                ...items.map((item,ti)=>TR([
                    TC(c[0],checks&&checks[ti]?'E8F8F0':'FFFFFF',
                       `<w:r><w:rPr>${CAL(16,checks&&checks[ti]?'27AE60':'888888',true)}</w:rPr><w:t>${checks&&checks[ti]?'☑':'☐'}</w:t></w:r>`,true),
                    TD(item,c[1])
                ]))
            ]);
        };

        // Tabla temperaturas
        const tabTemperaturas = (registros,W=9026) => {
            if(!registros||registros.length===0) return TABLA([W],[TR([TD('(Sin registros de temperatura)',W)])]);
            const c=[Math.round(W/4),Math.round(W/4),Math.round(W/4),W-Math.round(W/4)*3];
            return TABLA(c,[
                TR([TH('TIEMPO (min)',c[0]),TH('L. CARGA (°C)',c[1]),TH('L. LIBRE (°C)',c[2]),TH('ESTATOR (°C)',c[3])]),
                ...registros.map((r,ri)=>TR([
                    TC(c[0],ri%2===0?'F0F7FF':'FFFFFF',`<w:r><w:rPr>${CAL(16,'2C3E50',true)}</w:rPr><w:t>${xE(r.t)}'</w:t></w:r>`,true),
                    TC(c[1],ri%2===0?'F0F7FF':'FFFFFF',`<w:r><w:rPr>${CAL(16,'e74c3c')}</w:rPr><w:t>${xE(r.lc)}°</w:t></w:r>`,true),
                    TC(c[2],ri%2===0?'F0F7FF':'FFFFFF',`<w:r><w:rPr>${CAL(16,'3498db')}</w:rPr><w:t>${xE(r.ll)}°</w:t></w:r>`,true),
                    TC(c[3],ri%2===0?'F0F7FF':'FFFFFF',`<w:r><w:rPr>${CAL(16,'27ae60')}</w:rPr><w:t>${xE(r.est)}°</w:t></w:r>`,true),
                ]))
            ]);
        };

        const TRABAJOS_LIST=[{k:'fab_anillo',l:'Fab. anillo rectificado de anillos'},{k:'camb_carbones',l:'Cambio carbones / asentamiento'},{k:'mant_porta_escobilla',l:'Mant. porta escobilla'},{k:'camb_prensas',l:'Cambio de prensas'},{k:'camb_cable_salida',l:'Cambio cable de salida'},{k:'camb_ptc_rtd',l:'Cambio PTC / RTD'},{k:'camb_pt100',l:'Cambio PT-100'},{k:'camb_flexible',l:'Cambio de flexible'},{k:'camb_enchufe_3f',l:'Cambio enchufe 3F'},{k:'mant_calefactores',l:'Mant. calefactores bobinado'},{k:'bob_campos_comp',l:'Bobinado campos de compensación'},{k:'bob_interpolos',l:'Bobinado interpolos'},{k:'bob_inducido',l:'Bobinado inducido'},{k:'mant_campos',l:'Mant. campos'},{k:'mant_campos_comp',l:'Mant. campos de compensación'},{k:'mant_interpolos',l:'Mant. interpolos'},{k:'mant_inducido',l:'Mant. inducido'},{k:'rect_colector',l:'Rect. y desmicado de colector'},{k:'vicelado_colector',l:'Vicelado colector'},{k:'mant_tacometro',l:'Mant. tacómetro'},{k:'barn_camp_inter',l:'Barnizado y secado camp. inter.'},{k:'barn_inducido',l:'Barnizado y secado inducido'},{k:'camb_grasera',l:'Cambio grasera'},{k:'camb_ducto_grasera',l:'Cambio ducto de grasera'},{k:'armado',l:'Armado'},{k:'pintura',l:'Pintura'},{k:'pruebas_electricas',l:'Pruebas eléctricas'}];
        const FALLAS_LIST=[{k:'falla_metalado_lc',l:'Metalado descanso lado conexión'},{k:'falla_metalado_ll',l:'Metalado descanso lado libre'},{k:'falla_fab_descanso_lc',l:'Fabricación descanso LC'},{k:'falla_fab_descanso_ll',l:'Fabricación descanso LL'},{k:'falla_bob_campos',l:'Bobinado dos campos rueda polar'},{k:'falla_mant_correctivo',l:'Mant. correctivo / sumergido en agua'}];

        // ─ Imagen en Word ─
        const IMG_WORD = (W, alt) => {
            const cx = Math.round(W * 914.4 * 0.95); // EMU ≈ ancho página
            const cy = Math.round(cx * 300/800);      // ratio 800x300
            return `<w:p><w:pPr><w:spacing w:after="0" w:before="60"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="99" name="${alt}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${alt}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId9"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
        };

        // ─ buildDocx ─
        const buildDocx = async (fn,body,titulo,extraFiles) => {
            const JSZip=await loadJSZip(); const zip=new JSZip();
            zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`);
            zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
            zip.file('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>');
            zip.file('word/_rels/header1.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.jpeg"/></Relationships>`);
            zip.file('word/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`);
            zip.file('word/header1.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:p><w:pPr><w:spacing w:before="60" w:after="140" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251657216" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>-517830</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>-344323</wp:posOffset></wp:positionV><wp:extent cx="1053389" cy="599440"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="1053389" cy="599440"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r><w:r><w:rPr><w:b/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="2C3E50"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">                          BORYBOR NORTE   |   ${xE(titulo)}</w:t></w:r></w:p></w:hdr>`);
            zip.file('word/media/logo.jpeg', Uint8Array.from(atob(LOGO_B64),c=>c.charCodeAt(0)));
            zip.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rId6"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="1080" w:bottom="900" w:left="1080" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
            // Archivos extra (ej: gráfico de temperatura)
            if (extraFiles) {
                for (const [path, data] of Object.entries(extraFiles)) { zip.file(path, data); }
                // Si hay imagen del gráfico, actualizar rels para incluir rId9
                if (extraFiles['word/media/temp_chart.png']) {
                    zip.file('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/temp_chart.png"/></Relationships>');
                }
            }
            const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
            const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fn; a.click();
        };

        // ════════════════════════════════════════════
        //  DETALLE  —  todo lo del área Calidad/Detalle
        // ════════════════════════════════════════════
        window.descargarGuiaRecepcion = async (i) => {
            const d = window.data[i];
            const rec = d.recepcion || {};
            const piezas = d.piezas_recepcion || [];
            const W = 9026;
            const body = [
                SP(0),
                // Encabezado
                TABLA([4513,4513],[TR([
                    TC(4513,'FFFFFF',`<w:r><w:rPr>${CAL(20,'004F88',true)}</w:rPr><w:t>INGENIERÍA ELÉCTRICA BORYBOR SpA.</w:t></w:r>`,false),
                    TC(4513,'FFFFFF',`<w:r><w:rPr>${CAL(22,'004F88',true)}</w:rPr><w:t>GUÍA DE RECEPCIÓN</w:t></w:r>`,true),
                ])]), SP(0),
                TABLA([4513,4513],[TR([
                    TC(4513,'FFFFFF',`<w:r><w:rPr>${CAL(14,'888888')}</w:rPr><w:t>Calle 8 N°1194 - Manzana G2 - Lote 122, Barrio Industrial - Paipote - Copiapó</w:t></w:r>`,false),
                    TC(4513,'F5F6F7',`<w:r><w:rPr>${CAL(20,'2C3E50',true)}</w:rPr><w:t>O.T.:  ${xE(d.ot)}</w:t></w:r>`,true),
                ])]), SP(0),

                // Datos cliente
                SECC('DATOS DEL CLIENTE'), SP(0),
                TABLA([2256,2256,2257,2257],[
                    TR([TH('NOMBRE CLIENTE',2256,false),TD(d.empresa,2256,false,false,0),TH('GUÍA DESPACHO',2257,false),TD(rec.guia,2257)]),
                    TR([TH('R.U.T.',2256,false),TD(rec.rut,2256),TH('FECHA RECEPCIÓN',2257,false),TD(rec.fecha?(rec.fecha.split('-').reverse().join('/')):'-',2257)]),
                    TR([TH('CORRIENTE ALTERNA',2256,false),
                        TC(2256,rec.corriente==='alterna'?'E8F8F0':'FFFFFF',`<w:r><w:rPr>${CAL(16,rec.corriente==='alterna'?'27AE60':'888888',true)}</w:rPr><w:t>${rec.corriente==='alterna'?'☑':'☐'}</w:t></w:r>`,true),
                        TH('CORRIENTE CONTINUA',2257,false),
                        TC(2257,rec.corriente==='continua'?'E8F8F0':'FFFFFF',`<w:r><w:rPr>${CAL(16,rec.corriente==='continua'?'27AE60':'888888',true)}</w:rPr><w:t>${rec.corriente==='continua'?'☑':'☐'}</w:t></w:r>`,true),
                    ]),
                ]), SP(0),

                // Identificación del equipo
                SECC('IDENTIFICACIÓN DEL EQUIPO'), SP(0),
                TABLA([2256,2256,2257,2257],[
                    TR([TH('MARCA',2256,false),TD(d.placa?.marca,2256),TH('FRAME',2257,false),TD(d.placa?.frame,2257)]),
                    TR([TH('POTENCIA HP/CV',2256,false),TD(rec.pothp,2256),TH('KW',2257,false),TD(d.placa?.pot,2257)]),
                    TR([TH('RPM',2256,false),TD(d.placa?.rpm,2256),TH('COLOR',2257,false),TD(rec.color,2257)]),
                    TR([TH('N° SERIE',2256,false),TD(rec.serie,2256),TH('CICLOS (Hz)',2257,false),TD(rec.ciclos,2257)]),
                    TR([TH('VOLTS',2256,false),TD(d.placa?.volt,2256),TH('AMPERES',2257,false),TD(d.placa?.amp,2257)]),
                    TR([TH('OTROS',2256,false),TD(rec.otros_equipo,2256,false,false,0),TC(2257,'FFFFFF','',false),TC(2257,'FFFFFF','',false)]),
                ]), SP(0),

                // Identificación de piezas
                SECC('IDENTIFICACIÓN DE PARTES DEL EQUIPO'), SP(0),
                `<w:p><w:pPr><w:spacing w:after="0" w:before="40"/><w:ind w:left="130"/></w:pPr><w:r><w:rPr>${CAL(13,'555555',false)}</w:rPr><w:t>NOTA: Completar si el equipo contiene la pieza. De encontrarse en mal estado indicarlo en la columna correspondiente.</w:t></w:r></w:p>`,
                tabPiezasRecepcion(piezas,W), SP(0),

                // Firmas
                SECC('FIRMAS'), SP(0),
                TABLA([4513,4513],[
                    TR([TH('NOMBRE RECEPTOR DEL EQUIPO',4513,false),TH('V°B° SUPERVISOR GENERAL',4513,false)],[200]),
                    TR([TC(4513,'FFFFFF',`<w:r><w:rPr>${CAL(16,'2C3E50',true)}</w:rPr><w:t>${xE(rec.receptor||'')}</w:t></w:r>`,false),
                        TC(4513,'FFFFFF',`<w:r><w:rPr>${CAL(16,'2C3E50',true)}</w:rPr><w:t>${xE(rec.supervisor||'')}</w:t></w:r>`,false)],[500]),
                    TR([TC(4513,'FFFFFF','',false),TC(4513,'FFFFFF','',false)],[800]),
                ]),
                SP(0), PIE(),
            ].join('');
            await buildDocx(`GuiaRecepcion_OT_${d.ot}_${d.empresa}.docx`, body, 'GUÍA DE RECEPCIÓN');
        };

        window.descargarDetalle = async (i) => {
            const d=window.data[i], m=d.mediciones||{}, det=d.detalle||{}, obs=d.observaciones||{}, W=9026;
            const medIng={res12:m.res12,res13:m.res13,res23:m.res23,ind12:m.ind12,ind13:m.ind13,ind23:m.ind23,sur1:m.sur1,sur2:m.sur2,sur3:m.sur3,aisla:m.aisla,ipdar:m.ipdar};
            const hallazgos = d.hallazgos_lista || [];
            const body=[
                SP(0),
                tabEncab(d,W), SP(0),

                SECC('1.  DATOS DE PLACA'), SP(0),
                tabPlaca(d,W), SP(0),

                SECC('2.  HALLAZGOS DEL DESARME'), SP(0),
                tabLista(hallazgos,W), SP(0),
                F2W('OBSERVACIONES DESARME', obs.desarme||'', W), SP(0),

                SECC('3.  MEDICIONES ELÉCTRICAS DE INGRESO'), SP(0),
                tabMedElec(medIng,W), SP(0),

                SECC('4.  METROLOGÍA MECÁNICA'), SP(0),
                tabMetro(
                    {enc_lc:d.met_val_lc,enc_ll:d.met_val_ll,me_lc:d.met_val_mlc,me_ll:d.met_val_mll},
                    {enc_lc:'',enc_ll:'',me_lc:'',me_ll:''},W), SP(0),
                SECC('4b. CONTROL METROLÓGICO DE ALOJAMIENTOS Y ASENTAMIENTOS'), SP(0),
                tabMetroPlanillaCombinada(d,'metro_aloj_lc_ing','metro_aloj_lc_sal','ALOJAMIENTO LADO CARGA (Drive End)',W), SP(0),
                tabMetroPlanillaCombinada(d,'metro_aloj_ll_ing','metro_aloj_ll_sal','ALOJAMIENTO LADO LIBRE (Non Drive End)',W), SP(0),
                tabMetroPlanillaCombinada(d,'metro_asen_lc_ing','metro_asen_lc_sal','ASENTAMIENTO LADO CARGA (Drive End)',W), SP(0),
                tabMetroPlanillaCombinada(d,'metro_asen_ll_ing','metro_asen_ll_sal','ASENTAMIENTO LADO LIBRE (Non Drive End)',W), SP(0),
                F2W('OBSERVACIONES METROLOGÍA', obs.metrologia||'', W), SP(0),

                SECC('5.  RODAMIENTOS'), SP(0),
                tabRodamientos(d,W), SP(0),

                SECC('6.  PARTES / PIEZAS / COMPONENTES'), SP(0),
                tabChecks(TRABAJOS_LIST,det,W), SP(0),

                SECC('7.  TIPO DE FALLA'), SP(0),
                tabChecks(FALLAS_LIST,det,W), SP(0),

                SECC('8.  OBSERVACIONES'), SP(0),
                tabObsAreas([
                    ['Desarme', obs.desarme||''],
                    ['Detalle', obs.detalle||''],
                ], W),

                SP(0), PIE(),
            ].join('');
            await buildDocx(`Detalle_OT_${d.ot}_${d.empresa}.docx`,body,'REGISTRO DE DETALLE');
        };

        // ════════════════════════════════════════════
        //  INFORME FINAL  —  TODA la información
        // ════════════════════════════════════════════
        window.descargarInforme = async (i) => {
            const d=window.data[i], m=d.mediciones||{}, obs=d.observaciones||{}, b=d.bobinado||{}, W=9026;
            // Mediciones ingreso
            const medIng={res12:m.res12,res13:m.res13,res23:m.res23,ind12:m.ind12,ind13:m.ind13,ind23:m.ind23,sur1:m.sur1,sur2:m.sur2,sur3:m.sur3,aisla:m.aisla,ipdar:m.ipdar};
            // Mediciones salida
            const medSal={res12:m.res_salida12,res13:m.res_salida13,res23:m.res_salida23,ind12:m.ind_salida12,ind13:m.ind_salida13,ind23:m.ind_salida23,sur1:m.surge_salida1,sur2:m.surge_salida2,sur3:m.surge_salida3,aisla:m.aisla_salida,ipdar:m.ipdar_salida};
            // Metrología: iniciales desde área mecánica, finales desde ejecución
            const metIni={enc_lc:d.met_val_lc,enc_ll:d.met_val_ll,me_lc:d.met_val_mlc,me_ll:d.met_val_mll};
            const metSal={enc_lc:d.ejec_enc_lc,enc_ll:d.ejec_enc_ll,me_lc:d.ejec_met_lc,me_ll:d.ejec_met_ll};
            const det=d.detalle||{};

            const hallazgos = d.hallazgos_lista || [];
            const termLista = d.terminaciones_lista || [];
            const termChecks = d.terminaciones_checks || {};
            const tempRegs = d.temp_registros || [];
            const piezasRec = d.piezas_recepcion || [];
            const piezasSalida = d.piezas_salida_estado || {};
            const rec = d.recepcion || {};
            const tarDesarme   = d.tareas_desarme      || [];
            const tarMant      = d.tareas_mantencion    || [];
            const tarCalidad   = d.tareas_calidad       || [];
            const tarMecIng    = d.tareas_mecanica_ing  || [];
            const tarMec       = d.tareas_mecanica      || [];
            const tarArmado    = d.tareas_armado        || [];
            const tarPruebas   = d.tareas_pruebas       || [];

            // ── Generar PNG del gráfico de temperatura ──
            let tempChartPng = null;
            if (tempRegs.length >= 2) {
                try {
                    const expCv = document.createElement('canvas');
                    expCv.width = 800; expCv.height = 260;
                    expCv.style.position = 'fixed';
                    expCv.style.left = '-9999px';
                    expCv.style.top = '-9999px';
                    document.body.appendChild(expCv);
                    window._dibujarGrafEnCanvas(expCv, tempRegs);
                    tempChartPng = expCv.toDataURL('image/png').split(',')[1];
                    document.body.removeChild(expCv);
                } catch(e) { console.warn('Error generando gráfico:', e); }
            }

            const body=[
                SP(0),
                tabEncab(d,W), SP(0),

                // ── 1. DATOS DE RECEPCIÓN ──
                SECC('1.  DATOS DE RECEPCIÓN'), SP(0),
                TABLA([2256,2256,2257,2257],[
                    TR([TH('CLIENTE',2256,false),TD(d.empresa,2256),TH('R.U.T.',2257,false),TD(rec.rut,2257)]),
                    TR([TH('FECHA RECEPCIÓN',2256,false),TD(rec.fecha?(rec.fecha.split('-').reverse().join('/')):'-',2256),TH('GUÍA DESPACHO',2257,false),TD(rec.guia,2257)]),
                    TR([TH('CORRIENTE',2256,false),TD((rec.corriente||'').toUpperCase(),2256),TH('RECEPTOR',2257,false),TD(rec.receptor,2257)]),
                    TR([TH('SUPERVISOR',2256,false),TD(rec.supervisor,2256),TH('COLOR',2257,false),TD(rec.color,2257)]),
                    TR([TH('N° SERIE',2256,false),TD(rec.serie,2256),TH('CICLOS (Hz)',2257,false),TD(rec.ciclos,2257)]),
                ]), SP(0),

                // ── 2. DATOS DE PLACA ──
                SECC('2.  DATOS DE PLACA'), SP(0),
                tabPlaca(d,W), SP(0),

                // ── 3. PIEZAS RECIBIDAS / SALIDA ──
                SECC('3.  IDENTIFICACIÓN DE PIEZAS'), SP(0),
                tabPiezasSalida(piezasRec, piezasSalida, W), SP(0),

                // ── 4. DESARME ──
                SECC('4.  DESARME'), SP(0),
                tabLista(hallazgos,W), SP(0),
                tarDesarme.length>0 ? SECC('    TAREAS DE DESARME') : '',
                tarDesarme.length>0 ? tabLista(tarDesarme,W) : '',
                tarMant.length>0 ? SECC('    TAREAS DE MANTENCIÓN') : '',
                tarMant.length>0 ? tabLista(tarMant,W) : '',
                SP(0), F2W('OBSERVACIONES DESARME', obs.desarme||'', W), SP(0),

                // ── 5. MEDICIONES ELÉCTRICAS DE INGRESO ──
                SECC('5.  MEDICIONES ELÉCTRICAS DE INGRESO'), SP(0),
                tabMedElec(medIng,W), SP(0),
                tarCalidad.length>0 ? SECC('    TAREAS DE CALIDAD / MEDICIONES') : '',
                tarCalidad.length>0 ? tabLista(tarCalidad,W) : '',
                F2W('OBSERVACIONES', obs.med_ingreso||'', W), SP(0),

                // ── 6. METROLOGÍA MECÁNICA ──
                SECC('6.  METROLOGÍA MECÁNICA'), SP(0),
                SECC('   CONTROL METROLÓGICO DE ALOJAMIENTOS Y ASENTAMIENTOS'), SP(0),
                tabMetroPlanillaCombinada(d,'metro_aloj_lc_ing','metro_aloj_lc_sal','ALOJAMIENTO LADO CARGA (Drive End)',W), SP(0),
                tabMetroPlanillaCombinada(d,'metro_aloj_ll_ing','metro_aloj_ll_sal','ALOJAMIENTO LADO LIBRE (Non Drive End)',W), SP(0),
                tabMetroPlanillaCombinada(d,'metro_asen_lc_ing','metro_asen_lc_sal','ASENTAMIENTO LADO CARGA (Drive End)',W), SP(0),
                tabMetroPlanillaCombinada(d,'metro_asen_ll_ing','metro_asen_ll_sal','ASENTAMIENTO LADO LIBRE (Non Drive End)',W), SP(0),

                tarMecIng.length>0 ? SECC('    TAREAS METROLOGÍA INGRESO') : '',
                tarMecIng.length>0 ? tabLista(tarMecIng,W) : '',
                tarMec.length>0 ? SECC('    TAREAS MECÁNICA FINAL') : '',
                tarMec.length>0 ? tabLista(tarMec,W) : '',
                SP(0), F2W('OBSERVACIONES', obs.metrologia||'', W), SP(0),

                // ── 7. DATOS DE BOBINADO (plana completa) ──
                `<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>`,
                SECC('7.  DATOS DE BOBINADO'), SP(0),
                tabBobCompleto(d,W), SP(0),
                `<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>`,

                // ── 8. PARTES / PIEZAS / COMPONENTES ──
                SECC('8.  PARTES / PIEZAS / COMPONENTES'), SP(0),
                tabChecks(TRABAJOS_LIST,det,W), SP(0),
                SECC('    TIPO DE FALLA'), SP(0),
                tabChecks(FALLAS_LIST,det,W), SP(0),

                // ── 9. RODAMIENTOS Y ARMADO ──
                SECC('9.  RODAMIENTOS Y ARMADO'), SP(0),
                tabRodamientos(d,W), SP(0),
                tarArmado.length>0 ? SECC('    TAREAS DE ARMADO') : '',
                tarArmado.length>0 ? tabLista(tarArmado,W) : '',
                F2W('OBSERVACIONES ARMADO', obs.armado||'', W), SP(0),

                // ── 10. MEDICIONES ELÉCTRICAS DE SALIDA ──
                SECC('10. MEDICIONES ELÉCTRICAS DE SALIDA'), SP(0),
                tabMedElec(medSal,W), SP(0),

                // ── 11. PRUEBAS DINÁMICAS ──
                SECC('11. PRUEBAS DINÁMICAS'), SP(0),
                tabPruebas(d,W), SP(0),
                tarPruebas.length>0 ? SECC('    TAREAS DE PRUEBAS DINÁMICAS') : '',
                tarPruebas.length>0 ? tabLista(tarPruebas,W) : '',
                F2W('OBSERVACIONES PRUEBAS', obs.pruebas||'', W), SP(0),

                // ── 12. REGISTRO DE TEMPERATURAS ──
                SECC('12. REGISTRO DE TEMPERATURAS'), SP(0),
                tabTemperaturas(tempRegs,W), SP(0),
                tempChartPng ? IMG_WORD(W, 'Gráfico de Temperaturas') : '',

                // ── 13. TERMINACIONES ──
                SECC('13. TERMINACIONES'), SP(0),
                tabTerminaciones(termLista,termChecks,W), SP(0),
                F2W('OBSERVACIONES TERMINACIONES', obs.terminaciones||'', W), SP(0),

                // ── 14. OBSERVACIONES POR ÁREA ──
                SECC('14. OBSERVACIONES POR ÁREA'), SP(0),
                tabObsAreas([
                    ['Desarme',       obs.desarme||'',       (d.responsables||{}).desarme_ok||''],
                    ['Mantención',    obs.mantencion||'',    (d.responsables||{}).mant_ok||''],
                    ['Mediciones',    obs.med_ingreso||'',   (d.responsables||{}).med_ok||''],
                    ['Metrología',    obs.metrologia||'',    (d.responsables||{}).met_ok||''],
                    ['Mecánica',      obs.mecanica||'',      (d.responsables||{}).mec_fin||''],
                    ['Bobinado',      obs.bobinado||'',      (d.responsables||{}).bobinado_fin||''],
                    ['Balanceo',      obs.balanceo||'',      (d.responsables||{}).bal_ok||''],
                    ['Armado',        obs.armado||'',        (d.responsables||{}).armado_ok||''],
                    ['Pruebas',       obs.pruebas||'',       (d.responsables||{}).pruebas_ok||''],
                    ['Terminaciones', obs.terminaciones||'', (d.responsables||{}).term_ok||''],
                    ['Salida',        obs.salida||'',        (d.responsables||{}).salida_ok||''],
                ],W),

                SP(0), PIE(),
            ].join('');
            const extraFiles = {};
            if (tempChartPng) extraFiles['word/media/temp_chart.png'] = Uint8Array.from(atob(tempChartPng), c2=>c2.charCodeAt(0));
            await buildDocx(`Informe_OT_${d.ot}_${d.empresa}.docx`, body, 'PROTOCOLO TÉCNICO FINAL', extraFiles);
        };

                window.nuevaOT = () => {
            const ot = (document.getElementById('not')?.value||'').trim();
            const em = (document.getElementById('nemp')?.value||'').trim();
            if(!ot || !em) return alert('Complete al menos N° OT y Cliente.');
            const PIEZAS_N = ['CARCASA','TAPA RODAMIENTO','TAPA VENTILADOR','JAULA DE ARDILLA','VENTILADOR','PLACA DE CONEXIÓN','CAJA DE CONEXIÓN','CÁNCAMOS','CHAVETA','RODAMIENTOS','POLEA','MACHÓN DE ACOPLE','PIÑÓN','CARBONES','CONTRA TAPA','INDUCIDO','COLECTOR','PORTA ESCOBILLA','RETÉN','PERNOS','INTERCAMBIADOR','CONEXIÓN A TIERRA','OTROS (ESPECIFICAR)'];
            const piezas = PIEZAS_N.map((nombre,pi) => {
                const rad = document.querySelector(`input[name="pieza_${pi}"]:checked`);
                return { nombre, estado: rad?rad.value:'', obs: document.getElementById(`pobs_${pi}`)?.value||'' };
            });
            (window._piezasExtra||[]).forEach(pe => piezas.push(pe));
            const rec = {
                rut:          document.getElementById('nrut')?.value||'',
                fecha:        document.getElementById('nfecha')?.value||'',
                guia:         document.getElementById('nguia')?.value||'',
                corriente:    document.getElementById('ncorriente')?.value||'',
                receptor:     document.getElementById('nreceptor')?.value||'',
                supervisor:   document.getElementById('nsupervisor')?.value||'',
                otros_equipo: document.getElementById('notros_equipo')?.value||'',
                color:        document.getElementById('ncolor')?.value||'',
                serie:        document.getElementById('nserie')?.value||'',
                ciclos:       document.getElementById('nciclos')?.value||'',
                pothp:        document.getElementById('npothp')?.value||'',
                potkw:        document.getElementById('npotkw')?.value||'',
            };
            const nuevaEntrada = {
                ot, empresa: em, estado: 'desarme', pri: 'normal',
                pasos: {}, observaciones: {}, mediciones: {}, archivos: [],
                recepcion: rec,
                piezas_recepcion: piezas,
                piezas_recepcion_checks: {},
                placa: {
                    marca: document.getElementById('nmarca')?.value||'',
                    frame: document.getElementById('nframe')?.value||'',
                    pot:   document.getElementById('npotkw')?.value||'',
                    rpm:   document.getElementById('nrpm')?.value||'',
                    volt:  document.getElementById('nvolts')?.value||'',
                    amp:   document.getElementById('namps')?.value||'',
                    corriente: document.getElementById('ncorriente')?.value||'',
                },
                enc_lc:'no', enc_ll:'no', met_lc:'no', met_ll:'no',
                met_val_lc:'', met_val_ll:'', met_val_mlc:'', met_val_mll:'',
                ejec_enc_lc:'', ejec_enc_ll:'', ejec_met_lc:'', ejec_met_ll:'',
                rod_lc:'', rod_ll:'', rod_lc_ok:false, rod_ll_ok:false,
                tipoTrabajo:''
            };
            window.data.push(nuevaEntrada);
            window.save();
            // Generar Word Guía de Recepción automáticamente
            const idx = window.data.length - 1;
            window.descargarGuiaRecepcion(idx);
            window.mostrarVista('dashboard');
        };

        window.updateFlujo = (i, paso, sig) => {
            const ot = window.data[i]?.ot;
            if (!window.puedeEditarOT(ot, window.vistaActual)) { alert('⛔ No tienes permiso para modificar esta OT en esta área.'); return; }
            if (!window.data[i].pasos) window.data[i].pasos = {};
            window.data[i].pasos[paso] = true;
            // Registrar responsable del paso
            if (!window.data[i].responsables) window.data[i].responsables = {};
            window.data[i].responsables[paso] = window.usuarioActual?.nombre || window.usuarioActual?.usuario || '—';
            if (paso === 'med_ok' || paso === 'met_ok') {
                if (window.data[i].pasos.med_ok && window.data[i].pasos.met_ok) window.data[i].estado = 'detalle_pendiente';
            } else if (sig) {
                window.data[i].estado = sig;
            }
            window.save();
        };

        window.agregarHallazgo = (i) => {
            const input = document.getElementById(`des_input_${i}`);
            const txt = (input?.value || '').trim();
            if (!txt) return;
            if (!window.data[i].hallazgos_lista) window.data[i].hallazgos_lista = [];
            window.data[i].hallazgos_lista.push(txt);
            input.value = '';
            window.save(); window.render();
        };
        window.quitarHallazgo = (i, hi) => {
            if (!window.data[i].hallazgos_lista) return;
            window.data[i].hallazgos_lista.splice(hi, 1);
            window.save(); window.render();
        };

        // ── Mecánica: trabajos individuales por técnico ───────────
        window.tomarTrabajoMec = (i, clave) => {
            if (!window.data[i].mec_trab_usuario) window.data[i].mec_trab_usuario = {};
            if (window.data[i].mec_trab_usuario[clave]?.usuario) return;
            window.data[i].mec_trab_usuario[clave] = {
                usuario: window.usuarioActual?.nombre || window.usuarioActual?.usuario || '—',
                medidas: '', archivos: [], ok: false
            };
            window.save(); window.render();
        };
        window.guardarMecMedidas = (i, clave, valor) => {
            if (!window.data[i].mec_trab_usuario?.[clave]) return;
            window.data[i].mec_trab_usuario[clave].medidas = valor;
            window.save();
        };
        window.finalizarTrabajoMec = (i, clave) => {
            if (!window.data[i].mec_trab_usuario?.[clave]) return;
            if (!confirm('¿Marcar este trabajo como terminado?')) return;
            window.data[i].mec_trab_usuario[clave].ok = true;
            window.save(); window.render();
        };
        window.subirMecArchivo = async (i, clave) => {
            const input = document.getElementById(`mecfile_${i}_${clave}`);
            const file = input?.files[0];
            if (!file) return alert('Selecciona un archivo primero');
            try {
                const storagePath = sRef(storage, `ot_${window.data[i].ot}/mec_${clave}_${Date.now()}_${file.name}`);
                await uploadBytes(storagePath, file);
                const url = await getDownloadURL(storagePath);
                if (!window.data[i].mec_trab_usuario) window.data[i].mec_trab_usuario = {};
                if (!window.data[i].mec_trab_usuario[clave]) window.data[i].mec_trab_usuario[clave] = {usuario:'',medidas:'',archivos:[],ok:false};
                if (!window.data[i].mec_trab_usuario[clave].archivos) window.data[i].mec_trab_usuario[clave].archivos = [];
                window.data[i].mec_trab_usuario[clave].archivos.push({name: file.name, url});
                window.save(); window.render();
            } catch(e) { alert('Error al subir archivo: ' + e.message); }
        };

        // ── Gráfico de temperatura global ─────────────────────────
        // Núcleo del dibujo — recibe canvas y datos directamente
        window._dibujarGrafEnCanvas = function(canvas, datos) {
            if (!canvas || datos.length < 2) return;
            canvas.width  = canvas.offsetWidth  || 800;
            canvas.height = canvas.height || 230;
            const W=canvas.width, H=canvas.height;
            const pad={t:32,r:24,b:36,l:46};
            const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
            const ctx=canvas.getContext('2d');
            ctx.clearRect(0,0,W,H);
            ctx.fillStyle='#f4f8ff'; ctx.fillRect(0,0,W,H);
            ctx.strokeStyle='#dde1e7'; ctx.lineWidth=0.5;
            ctx.strokeRect(pad.l,pad.t,cW,cH);
            const allV=datos.flatMap(r=>[+r.lc,+r.ll,+r.est]).filter(n=>!isNaN(n));
            if (!allV.length) return;
            const minV=Math.floor(Math.min(...allV)-3), maxV=Math.ceil(Math.max(...allV)+3);
            const xS=n2=>pad.l+(n2/(datos.length-1))*cW;
            const yS=v=>pad.t+cH-((v-minV)/(maxV-minV||1))*cH;
            for(let g=0;g<=5;g++){
                const gy=pad.t+(g/5)*cH;
                ctx.beginPath(); ctx.strokeStyle='#e0e8f0'; ctx.lineWidth=1;
                ctx.moveTo(pad.l,gy); ctx.lineTo(pad.l+cW,gy); ctx.stroke();
                ctx.fillStyle='#666'; ctx.font='10px sans-serif'; ctx.textAlign='right';
                ctx.fillText(Math.round(maxV-((maxV-minV)/5)*g)+'°', pad.l-4, gy+4);
            }
            const stepX=Math.ceil(datos.length/12);
            ctx.fillStyle='#555'; ctx.font='10px sans-serif'; ctx.textAlign='center';
            datos.forEach((r,n)=>{ if(n%stepX===0||n===datos.length-1) ctx.fillText(r.t+"'", xS(n), H-6); });
            ctx.fillStyle='#888'; ctx.font='9px sans-serif';
            ctx.textAlign='left'; ctx.fillText('°C', 2, pad.t-10);
            ctx.textAlign='center'; ctx.fillText('Tiempo (min)', pad.l+cW/2, H-0);
            const series=[{k:'lc',c:'#e74c3c',l:'L. Carga'},{k:'ll',c:'#3498db',l:'L. Libre'},{k:'est',c:'#27ae60',l:'Estator'}];
            series.forEach(s=>{
                ctx.beginPath();
                datos.forEach((r,n)=>{ n===0?ctx.moveTo(xS(n),yS(+r[s.k])):ctx.lineTo(xS(n),yS(+r[s.k])); });
                ctx.lineTo(xS(datos.length-1),pad.t+cH); ctx.lineTo(xS(0),pad.t+cH); ctx.closePath();
                ctx.fillStyle=s.c+'28'; ctx.fill();
                ctx.beginPath(); ctx.strokeStyle=s.c; ctx.lineWidth=2.5;
                datos.forEach((r,n)=>{ n===0?ctx.moveTo(xS(n),yS(+r[s.k])):ctx.lineTo(xS(n),yS(+r[s.k])); });
                ctx.stroke();
                datos.forEach((r,n)=>{
                    const px=xS(n), py=yS(+r[s.k]);
                    ctx.beginPath(); ctx.arc(px,py,4,0,Math.PI*2);
                    ctx.fillStyle='white'; ctx.fill();
                    ctx.strokeStyle=s.c; ctx.lineWidth=2; ctx.stroke();
                    if(n%2===0||n===datos.length-1){
                        ctx.fillStyle=s.c; ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
                        ctx.fillText(r[s.k]+'°', px, py-8);
                    }
                });
            });
            series.forEach((s,si)=>{
                const lx=pad.l+si*(cW/3);
                ctx.fillStyle=s.c; ctx.fillRect(lx,6,14,10);
                ctx.fillStyle='#333'; ctx.font='11px sans-serif'; ctx.textAlign='left';
                ctx.fillText(s.l, lx+18, 15);
            });
        };

        window.dibujarGraficoTemp = function(idx) {
            const datos = window.data[idx]?.temp_registros || [];
            const canvas = document.getElementById('temp_chart_'+idx);
            const msg    = document.getElementById('temp_chart_msg_'+idx);
            if (!canvas) return;
            if (datos.length < 2) {
                canvas.style.display='none';
                if (msg) msg.style.display='block';
                return;
            }
            canvas.style.display='block';
            if (msg) msg.style.display='none';
            window._dibujarGrafEnCanvas(canvas, datos);
        };


        window.agregarRodamiento = (i) => {
            const pos = (document.getElementById('rod_pos_'+i)?.value || '').trim();
            const mod = (document.getElementById('rod_mod_'+i)?.value || '').trim();
            if (!mod) return;
            if (!window.data[i].rodamientos) window.data[i].rodamientos = [];
            window.data[i].rodamientos.push({ pos: pos || '—', mod });
            document.getElementById('rod_pos_'+i).value = '';
            document.getElementById('rod_mod_'+i).value = '';
            window.save();
            // Actualizar lista sin re-render completo
            const lista = document.getElementById('rod_lista_'+i);
            if (lista) {
                lista.innerHTML = window.data[i].rodamientos.map((r,ri) => `
                    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #e0e0e0;">
                        <span style="background:#004F88;color:white;border-radius:4px;padding:2px 8px;font-size:0.78em;font-weight:700;min-width:40px;text-align:center;">${r.pos}</span>
                        <span style="flex:1;font-size:0.88em;">${r.mod}</span>
                        <button onclick="window.quitarRodamiento(${i},${ri})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1em;">✕</button>
                    </div>`).join('');
                document.getElementById('rod_mod_'+i)?.focus();
            }
        };

        window.quitarRodamiento = (i, ri) => {
            if (!window.data[i].rodamientos) return;
            window.data[i].rodamientos.splice(ri, 1);
            const checks = window.data[i].rodamientos_ok || {};
            const newC = {};
            window.data[i].rodamientos.forEach((_,ni) => { if (checks[ni >= ri ? ni+1 : ni]) newC[ni] = true; });
            window.data[i].rodamientos_ok = newC;
            window.save(); window.render();
        };

        window.agregarTemp = (i) => {
            const t   = document.getElementById(`tmp_t_${i}`)?.value?.trim();
            const lc  = document.getElementById(`tmp_lc_${i}`)?.value?.trim();
            const ll  = document.getElementById(`tmp_ll_${i}`)?.value?.trim();
            const est = document.getElementById(`tmp_est_${i}`)?.value?.trim();
            if (!t || !lc || !ll || !est) { alert('Completa todos los campos de temperatura.'); return; }
            if (!window.data[i].temp_registros) window.data[i].temp_registros = [];
            window.data[i].temp_registros.push({ t, lc, ll, est });
            window.data[i].temp_registros.sort((a,b) => +a.t - +b.t);
            window.save();
            // Actualizar tabla sin re-render completo
            const tbody = document.querySelector(`#temp_tbody_${i}`);
            if (tbody) {
                tbody.innerHTML = window.data[i].temp_registros.map((r,ri)=>`
                    <tr style="background:${ri%2===0?'#f8fbff':'white'};border-bottom:1px solid #dde1e7;">
                        <td style="padding:3px 8px;text-align:center;font-weight:600;">${r.t}'</td>
                        <td style="padding:3px 8px;text-align:center;color:#e74c3c;">${r.lc}°</td>
                        <td style="padding:3px 8px;text-align:center;color:#3498db;">${r.ll}°</td>
                        <td style="padding:3px 8px;text-align:center;color:#27ae60;">${r.est}°</td>
                        <td style="padding:3px 4px;text-align:center;"><button onclick="window.quitarTemp(${i},${ri})" style="background:none;border:none;color:#e74c3c;cursor:pointer;">✕</button></td>
                    </tr>`).join('');
            }
            // Sugerir próximo tiempo
            const nextT = (+t + 10);
            setTimeout(() => {
                const inp = document.getElementById(`tmp_t_${i}`);
                if (inp) inp.value = nextT;
                const lcInp = document.getElementById(`tmp_lc_${i}`);
                if (lcInp) { lcInp.value = ''; lcInp.focus(); }
                const llInp = document.getElementById(`tmp_ll_${i}`);
                if (llInp) llInp.value = '';
                const estInp = document.getElementById(`tmp_est_${i}`);
                if (estInp) estInp.value = '';
            }, 30);
            // Redibujar gráfico en tiempo real
            setTimeout(() => window.dibujarGraficoTemp(i), 80);
        };
        window.quitarTemp = (i, ri) => {
            if (!window.data[i].temp_registros) return;
            window.data[i].temp_registros.splice(ri, 1);
            window.save();
            const tbody = document.querySelector(`#temp_tbody_${i}`);
            if (tbody) {
                tbody.innerHTML = window.data[i].temp_registros.map((r,ri2)=>`
                    <tr style="background:${ri2%2===0?'#f8fbff':'white'};border-bottom:1px solid #dde1e7;">
                        <td style="padding:3px 8px;text-align:center;font-weight:600;">${r.t}'</td>
                        <td style="padding:3px 8px;text-align:center;color:#e74c3c;">${r.lc}°</td>
                        <td style="padding:3px 8px;text-align:center;color:#3498db;">${r.ll}°</td>
                        <td style="padding:3px 8px;text-align:center;color:#27ae60;">${r.est}°</td>
                        <td style="padding:3px 4px;text-align:center;"><button onclick="window.quitarTemp(${i},${ri2})" style="background:none;border:none;color:#e74c3c;cursor:pointer;">✕</button></td>
                    </tr>`).join('');
            }
            setTimeout(() => window.dibujarGraficoTemp(i), 80);
        };
        window.agregarTerminacion = (i) => {
            const input = document.getElementById(`term_input_${i}`);
            const txt = (input?.value || '').trim();
            if (!txt) return;
            if (!window.data[i].terminaciones_lista) window.data[i].terminaciones_lista = [];
            window.data[i].terminaciones_lista.push(txt);
            input.value = '';
            window.save();
            window.render();
        };

        window.quitarTerminacion = (i, ti) => {
            if (!window.data[i].terminaciones_lista) return;
            window.data[i].terminaciones_lista.splice(ti, 1);
            // Reindexar los checks
            const checks = window.data[i].terminaciones_checks || {};
            const newChecks = {};
            window.data[i].terminaciones_lista.forEach((_, ni) => {
                const oldIdx = ni >= ti ? ni + 1 : ni;
                if (checks[oldIdx]) newChecks[ni] = true;
            });
            window.data[i].terminaciones_checks = newChecks;
            window.save();
            window.render();
        };

        window.guardarObs = (i, key) => {
            const txt = document.getElementById(`obs_${key}_${i}`);
            if (!window.data[i].observaciones) window.data[i].observaciones = {};
            window.data[i].observaciones[key] = txt ? txt.value : "";
            window.save();
        };

        // Función para manejar el acordeón
        window.acordeonesAbiertos = new Set();
        window.toggleAccordion = (event) => {
            const btn = event.currentTarget || event.target.closest('.accordion');
            const otId = String(btn.dataset.otId);
            btn.classList.toggle("active");
            const panel = btn.nextElementSibling;
            panel.classList.toggle("show");
            if (window.acordeonesAbiertos.has(otId)) {
                window.acordeonesAbiertos.delete(otId);
            } else {
                window.acordeonesAbiertos.add(otId);
            }
        }

        // Navegar directo a una OT en su área y abrirla
        window.irAOT = (areaId, otId) => {
            const vistaMap = {
                desarme_mant: 'desarme_mant',
                calidad: 'calidad',
                mecanica: 'mecanica',
                bobinado: 'bobinado',
                armado_bal: 'armado_bal',
                despacho: 'despacho'
            };
            window.acordeonesAbiertos.clear();
            window.acordeonesAbiertos.add(String(otId));
            window.mostrarVista(vistaMap[areaId] || areaId);
            // Scroll al acordeón tras render
            setTimeout(() => {
                const btn = document.querySelector(`.accordion[data-ot-id="${otId}"]`);
                if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        };

        window.render = () => {
            const v = document.getElementById("vista");
            if (!v) return;
            if (!window.usuarioActual) { window.mostrarLogin(); return; }

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
                                <button class="btn-finish" onclick="window.updateFlujo(${i},'desarme_ok','ingresos_pendientes')">✅ Fin Desarme</button>`;
                        }
                        else if (d.estado === 'ejecucion_trabajos') UI = `<h3>Mantención</h3>${obs('mantencion')}
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
                                        <div style="font-weight:700;font-size:0.95em;color:#1a7a44;margin-bottom:4px;">${tw.label} <span style="background:#27ae60;color:white;border-radius:10px;padding:2px 8px;font-size:0.78em;margin-left:6px;">✅ TERMINADO</span></div>
                                        <div style="font-size:0.83em;color:#555;margin-top:4px;">👤 <b>${tj.usuario}</b></div>
                                        ${tj.medidas ? `<div style="font-size:0.83em;margin-top:4px;"><b>Medidas:</b> ${tj.medidas}</div>` : ''}
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
                            <div class="det-seccion-titulo" style="margin-top:14px;">📐 Planilla Metrológica de Salida</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;"><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.79em;font-weight:700;">ALOJAMIENTO LADO CARGA (Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Parámetro</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d1A||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d1A_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d1B||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d1B_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d1C||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d1C_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d1D||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d1D_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d2A||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d2A_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d2B||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d2B_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d2C||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d2C_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d2D||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d2D_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d3A||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d3A_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d3B||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d3B_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d3C||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d3C_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_lc_sal_d3D||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_lc_sal_d3D_aj||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:5px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.75em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_aloj_lc_sal_tol_min||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_aloj_lc_sal_tol_max||''}" onchange="window.data[${i}]['metro_aloj_lc_sal_tol_max']=this.value;window.save()"><span style="font-size:0.75em;font-weight:700;color:#555;margin-left:4px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" onchange="window.data[${i}]['metro_aloj_lc_sal_conc']=this.value;window.save()"><option value="" ${d.metro_aloj_lc_sal_conc?'':'selected'}>-- --</option><option value="dentro" ${d.metro_aloj_lc_sal_conc==='dentro'?'selected':''}>✅ Dentro tolerancia</option><option value="fuera" ${d.metro_aloj_lc_sal_conc==='fuera'?'selected':''}>❌ Fuera tolerancia</option></select></div></div><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.79em;font-weight:700;">ALOJAMIENTO LADO LIBRE (Non Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Parámetro</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d1A||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d1A_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d1B||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d1B_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d1C||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d1C_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d1D||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d1D_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d2A||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d2A_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d2B||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d2B_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d2C||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d2C_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d2D||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d2D_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d3A||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d3A_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d3B||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d3B_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d3C||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d3C_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_aloj_ll_sal_d3D||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_aloj_ll_sal_d3D_aj||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:5px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.75em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_aloj_ll_sal_tol_min||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_aloj_ll_sal_tol_max||''}" onchange="window.data[${i}]['metro_aloj_ll_sal_tol_max']=this.value;window.save()"><span style="font-size:0.75em;font-weight:700;color:#555;margin-left:4px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" onchange="window.data[${i}]['metro_aloj_ll_sal_conc']=this.value;window.save()"><option value="" ${d.metro_aloj_ll_sal_conc?'':'selected'}>-- --</option><option value="dentro" ${d.metro_aloj_ll_sal_conc==='dentro'?'selected':''}>✅ Dentro tolerancia</option><option value="fuera" ${d.metro_aloj_ll_sal_conc==='fuera'?'selected':''}>❌ Fuera tolerancia</option></select></div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;"><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.79em;font-weight:700;">ASENTAMIENTO LADO CARGA (Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Parámetro</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d1A||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d1A_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d1B||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d1B_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d1C||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d1C_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d1D||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d1D_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d2A||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d2A_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d2B||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d2B_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d2C||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d2C_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d2D||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d2D_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d3A||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d3A_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d3B||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d3B_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d3C||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d3C_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_lc_sal_d3D||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_lc_sal_d3D_aj||''}" onchange="window.data[${i}]['metro_asen_lc_sal_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:5px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.75em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_asen_lc_sal_tol_min||''}" onchange="window.data[${i}]['metro_asen_lc_sal_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_asen_lc_sal_tol_max||''}" onchange="window.data[${i}]['metro_asen_lc_sal_tol_max']=this.value;window.save()"><span style="font-size:0.75em;font-weight:700;color:#555;margin-left:4px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" onchange="window.data[${i}]['metro_asen_lc_sal_conc']=this.value;window.save()"><option value="" ${d.metro_asen_lc_sal_conc?'':'selected'}>-- --</option><option value="dentro" ${d.metro_asen_lc_sal_conc==='dentro'?'selected':''}>✅ Dentro tolerancia</option><option value="fuera" ${d.metro_asen_lc_sal_conc==='fuera'?'selected':''}>❌ Fuera tolerancia</option></select></div></div><div style="background:#fff;border:1px solid #c0d0e8;border-radius:6px;overflow:hidden;margin-bottom:8px;"><div style="background:#004F88;color:white;padding:5px 10px;font-size:0.79em;font-weight:700;">ASENTAMIENTO LADO LIBRE (Non Drive End)</div><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f4fa;"><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Parámetro</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Valor (mm)</th><th style="padding:3px 6px;font-size:0.75em;text-align:left;color:#333;">Ajuste</th></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d1A||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d1A_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d1B||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d1B_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d1C||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d1C_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 1-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d1D||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d1D_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d1D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d2A||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d2A_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d2B||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d2B_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d2C||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d2C_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 2-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d2D||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d2D_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d2D_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-A</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d3A||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3A']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d3A_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3A_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-B</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d3B||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3B']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d3B_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3B_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-C</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d3C||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3C']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d3C_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3C_aj']=this.value;window.save()"></td></tr><tr><td style="padding:3px 6px;font-size:0.82em;color:#444;border-bottom:1px solid #eee;white-space:nowrap;">Diámetro 3-D</td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:82px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" value="${d.metro_asen_ll_sal_d3D||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3D']=this.value;window.save()"></td><td style="padding:2px 4px;border-bottom:1px solid #eee;"><input type="text" style="width:52px;padding:3px 4px;border:1px solid #bcd;border-radius:3px;font-size:0.82em;" placeholder="Ej:J6" value="${d.metro_asen_ll_sal_d3D_aj||''}" onchange="window.data[${i}]['metro_asen_ll_sal_d3D_aj']=this.value;window.save()"></td></tr></table><div style="display:flex;gap:5px;padding:5px 8px;background:#f8f9fa;border-top:1px solid #eee;flex-wrap:wrap;align-items:center;"><span style="font-size:0.75em;font-weight:700;color:#555;">Tolerancia:</span><input type="text" placeholder="Mín" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_asen_ll_sal_tol_min||''}" onchange="window.data[${i}]['metro_asen_ll_sal_tol_min']=this.value;window.save()"><input type="text" placeholder="Máx" style="width:72px;padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" value="${d.metro_asen_ll_sal_tol_max||''}" onchange="window.data[${i}]['metro_asen_ll_sal_tol_max']=this.value;window.save()"><span style="font-size:0.75em;font-weight:700;color:#555;margin-left:4px;">Conclusión:</span><select style="padding:3px;border:1px solid #bcd;border-radius:3px;font-size:0.75em;" onchange="window.data[${i}]['metro_asen_ll_sal_conc']=this.value;window.save()"><option value="" ${d.metro_asen_ll_sal_conc?'':'selected'}>-- --</option><option value="dentro" ${d.metro_asen_ll_sal_conc==='dentro'?'selected':''}>✅ Dentro tolerancia</option><option value="fuera" ${d.metro_asen_ll_sal_conc==='fuera'?'selected':''}>❌ Fuera tolerancia</option></select></div></div></div>
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
                            UI = `<h3>Balanceo</h3>${obs('balanceo')}<button class="btn-primary btn-sm" onclick="window.updateFlujo(${i},'bal_ok')">✅ Balanceo OK</button><hr><h3>Armado</h3>`;
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

        window.editarUsuario = (idx) => {
            const u = window.usuarios[idx];
            if (!u) return;
            const f = document.getElementById('formUsuario');
            if (!f) return;
            f.style.display = 'block';
            document.getElementById('formUsuTitulo').textContent = 'Editar Usuario';
            document.getElementById('fuIdx').value = idx;
            document.getElementById('fuNombre').value = u.nombre || '';
            document.getElementById('fuUsuario').value = u.usuario || '';
            document.getElementById('fuPass').value = u.password || '';
            document.getElementById('fuRol').value = u.rol || 'encargado';
            document.getElementById('formUsuError').textContent = '';
            if (document.getElementById('buscadorOT')) document.getElementById('buscadorOT').value = '';
            // Limpiar y recargar cards de OT con asignaciones previas
            const lista = document.getElementById('listaOTsForm');
            if (lista) lista.innerHTML = '';
            window._otsList_cache = [...window.data].map(d => d.ot).sort((a,b)=>{const na=parseInt(a),nb=parseInt(b);return isNaN(na)||isNaN(nb)?String(a).localeCompare(String(b)):na-nb;});
            const asig = u.asignaciones || [];
            const otsUnicas = [...new Set(asig.filter(a=>a.ot).map(a => String(a.ot)).filter(Boolean))];
            otsUnicas.forEach(ot => window.agregarOTCard(ot, asig));
            // Cargar área general
            const areasGen = window.getAreasGenerales(u);
            document.querySelectorAll('.chkAreaGen').forEach(c => {
                const checked = areasGen.includes(c.dataset.area);
                c.checked = checked;
                const lbl = c.closest('label');
                if (lbl) { lbl.style.background = checked ? '#e8eef5' : 'white'; lbl.style.borderColor = checked ? 'var(--primary,#1a2a3a)' : 'var(--border)'; }
            });
            window.toggleAsignaciones();
            f.scrollIntoView({behavior:'smooth'});
        };

        window.guardarUsuarioForm = () => {
            const err = document.getElementById('formUsuError');
            const idx = parseInt(document.getElementById('fuIdx').value);
            const nombre = document.getElementById('fuNombre').value.trim();
            const usuario = document.getElementById('fuUsuario').value.trim().toLowerCase().replace(/\s/g,'');
            const pass = document.getElementById('fuPass').value;
            const rol = document.getElementById('fuRol').value;

            if (!nombre || !usuario || !pass) { err.textContent = '⚠️ Completa todos los campos.'; return; }
            if (idx === -1 && window.usuarios.find(u => u.usuario === usuario)) { err.textContent = '⚠️ El nombre de usuario ya existe.'; return; }

            // Recoger asignaciones {ot, area}
            const asignaciones = [];
            if (rol === 'tecnico') {
                document.querySelectorAll('.chkAsigArea:checked').forEach(c => {
                    asignaciones.push({ ot: c.dataset.ot, area: c.dataset.area });
                });
            }

            // Recoger área general
            const areaGeneral = [];
            if (rol === 'tecnico') {
                document.querySelectorAll('.chkAreaGen:checked').forEach(c => {
                    areaGeneral.push(c.dataset.area);
                });
            }

            const nuevoU = { nombre, usuario, password: pass, rol, activo: true, asignaciones, areaGeneral };
            if (idx === -1) {
                window.usuarios.push(nuevoU);
            } else {
                window.usuarios[idx] = { ...window.usuarios[idx], ...nuevoU };
            }
            err.textContent = '⏳ Guardando...';
            console.log('📤 Enviando a Firebase:', nuevoU, '| Total usuarios:', window.usuarios.length);
            window.guardarUsuarios().then(() => {
                console.log('✅ Guardado OK. Usuarios en Firebase:', window.usuarios.length);
                err.textContent = '✅ Usuario guardado correctamente';
                setTimeout(() => {
                    document.getElementById('formUsuario').style.display = 'none';
                    window.render();
                }, 800);
            }).catch(e => {
                console.error('❌ Error Firebase:', e);
                err.textContent = '❌ Error al guardar: ' + e.message;
            });
        };

        window.toggleActivoUsuario = (idx) => {
            const u = window.usuarios[idx];
            if (!u || u.usuario === 'admin') return;
            u.activo = u.activo === false ? true : false;
            window.guardarUsuarios().then(() => window.render());
        };
