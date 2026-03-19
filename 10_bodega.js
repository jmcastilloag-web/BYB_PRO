// ============================================================
// 10_bodega.js — Módulo de Bodega (Pernos/Piezas y Motores)
// ============================================================
// Colecciones Firebase:
//   bodegas/{bodegaId}                     → info de la bodega
//   bodegas/{bodegaId}/items/{itemId}       → ítems almacenados
//   bodegas/{bodegaId}/movimientos/{movId}  → ingresos y salidas
//   bodegas/{bodegaId}/observaciones/{obsId}→ observaciones con fotos
// ============================================================

import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ─── IDs de bodegas fijas ──────────────────────────────────
export const BODEGAS = {
  PERNOS_PIEZAS: "bodega_pernos_piezas",
  MOTORES:       "bodega_motores"
};

// ─── Rol requerido para operar bodega ─────────────────────
const ROL_BODEGUERO = "bodeguero";

// ═══════════════════════════════════════════════════════════
//  INICIALIZAR BODEGAS (correr 1 sola vez)
// ═══════════════════════════════════════════════════════════
export async function inicializarBodegas(db) {
  const datos = [
    { id: BODEGAS.PERNOS_PIEZAS, nombre: "Bodega de Pernos y Piezas", tipo: "pernos_piezas" },
    { id: BODEGAS.MOTORES,       nombre: "Bodega de Motores",          tipo: "motores"       }
  ];
  for (const b of datos) {
    await updateDoc(doc(db, "bodegas", b.id), b).catch(() =>
      addDoc(collection(db, "bodegas"), { ...b, creadoEn: serverTimestamp() })
        .catch(() => {}) // ya existe
    );
  }
}

// ═══════════════════════════════════════════════════════════
//  SUBIR FOTOS A STORAGE
// ═══════════════════════════════════════════════════════════
async function subirFotos(storage, files, carpeta) {
  const urls = [];
  for (const file of files) {
    const nombre = `${carpeta}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, nombre);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    urls.push(url);
  }
  return urls;
}

// ═══════════════════════════════════════════════════════════
//  1. INGRESAR ÍTEM A BODEGA
// ═══════════════════════════════════════════════════════════
/**
 * Registra el ingreso de un ítem a la bodega.
 * @param {object} db       Firestore instance
 * @param {object} storage  Firebase Storage instance
 * @param {string} bodegaId BODEGAS.PERNOS_PIEZAS | BODEGAS.MOTORES
 * @param {object} datos    { nombre, descripcion, cantidad, ubicaciones:[{nivel,fila}], otId? }
 * @param {File[]} fotos    Fotos de recepción
 * @param {object} usuario  { uid, nombre, rol }
 */
export async function ingresarItem(db, storage, bodegaId, datos, fotos = [], usuario) {
  if (usuario.rol !== ROL_BODEGUERO)
    throw new Error("Solo el bodeguero puede ingresar ítems.");

  const fotosUrls = fotos.length
    ? await subirFotos(storage, fotos, `bodegas/${bodegaId}/ingresos`)
    : [];

  const item = {
    bodegaId,
    nombre:      datos.nombre,
    descripcion: datos.descripcion || "",
    cantidad:    Number(datos.cantidad),
    ubicaciones: datos.ubicaciones || [],   // [{ nivel: "A", fila: 3 }, ...]
    estado:      "en_bodega",               // en_bodega | reservado | entregado
    otId:        datos.otId || null,
    fotosIngreso: fotosUrls,
    fotosEntrega: [],
    bodegueroId:  usuario.uid,
    bodegueroNombre: usuario.nombre,
    creadoEn:    serverTimestamp()
  };

  const itemRef = await addDoc(
    collection(db, "bodegas", bodegaId, "items"),
    item
  );

  // Registrar movimiento
  await addDoc(collection(db, "bodegas", bodegaId, "movimientos"), {
    itemId:    itemRef.id,
    tipo:      "ingreso",
    cantidad:  item.cantidad,
    ubicaciones: item.ubicaciones,
    fotos:     fotosUrls,
    usuario:   { uid: usuario.uid, nombre: usuario.nombre },
    fecha:     serverTimestamp()
  });

  return itemRef.id;
}

// ═══════════════════════════════════════════════════════════
//  2. SOLICITAR SALIDA (bodeguero pide autorización al usuario)
// ═══════════════════════════════════════════════════════════
/**
 * El bodeguero genera una solicitud de entrega.
 * El usuario receptor debe confirmar con autorizarSalida().
 * @param {string} receptorUid   UID del usuario que va a recibir
 * @param {string} receptorNombre
 */
export async function solicitarSalida(db, bodegaId, itemId, receptorUid, receptorNombre, otId, usuario) {
  if (usuario.rol !== ROL_BODEGUERO)
    throw new Error("Solo el bodeguero puede solicitar una salida.");

  const itemRef = doc(db, "bodegas", bodegaId, "items", itemId);
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) throw new Error("Ítem no encontrado.");

  const item = itemSnap.data();
  if (item.estado !== "en_bodega") throw new Error("El ítem no está disponible.");

  await updateDoc(itemRef, {
    estado:          "reservado",
    solicitudSalida: {
      receptorUid,
      receptorNombre,
      otId:         otId || item.otId || null,
      bodegueroId:  usuario.uid,
      bodegueroNombre: usuario.nombre,
      fechaSolicitud: serverTimestamp(),
      autorizado:   false
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  3. AUTORIZAR SALIDA (usuario receptor confirma recepción)
// ═══════════════════════════════════════════════════════════
/**
 * El usuario receptor confirma que recibió el ítem.
 * Adjunta fotos de entrega.
 */
export async function autorizarSalida(db, storage, bodegaId, itemId, fotos = [], usuario) {
  const itemRef = doc(db, "bodegas", bodegaId, "items", itemId);
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) throw new Error("Ítem no encontrado.");

  const item = itemSnap.data();
  if (!item.solicitudSalida)    throw new Error("No hay solicitud de salida pendiente.");
  if (item.solicitudSalida.receptorUid !== usuario.uid)
    throw new Error("Solo el receptor designado puede autorizar la entrega.");

  const fotosUrls = fotos.length
    ? await subirFotos(storage, fotos, `bodegas/${bodegaId}/entregas`)
    : [];

  await updateDoc(itemRef, {
    estado:       "entregado",
    fotosEntrega: fotosUrls,
    entregadoEn:  serverTimestamp(),
    "solicitudSalida.autorizado":    true,
    "solicitudSalida.fechaEntrega":  serverTimestamp()
  });

  // Registrar movimiento
  await addDoc(collection(db, "bodegas", bodegaId, "movimientos"), {
    itemId,
    tipo:      "salida",
    cantidad:  item.cantidad,
    otId:      item.solicitudSalida.otId || null,
    fotos:     fotosUrls,
    receptor:  { uid: usuario.uid, nombre: usuario.nombre },
    bodeguero: { uid: item.solicitudSalida.bodegueroId, nombre: item.solicitudSalida.bodegueroNombre },
    fecha:     serverTimestamp()
  });
}

// ═══════════════════════════════════════════════════════════
//  4. AGREGAR OBSERVACIÓN (texto + fotos)
// ═══════════════════════════════════════════════════════════
export async function agregarObservacion(db, storage, bodegaId, itemId, texto, fotos = [], usuario) {
  const fotosUrls = fotos.length
    ? await subirFotos(storage, fotos, `bodegas/${bodegaId}/observaciones`)
    : [];

  await addDoc(collection(db, "bodegas", bodegaId, "observaciones"), {
    itemId,
    texto,
    fotos:    fotosUrls,
    usuario:  { uid: usuario.uid, nombre: usuario.nombre },
    fecha:    serverTimestamp()
  });
}

// ═══════════════════════════════════════════════════════════
//  5. OBTENER ÍTEMS DE BODEGA (con filtros opcionales)
// ═══════════════════════════════════════════════════════════
export async function obtenerItems(db, bodegaId, filtros = {}) {
  let q = collection(db, "bodegas", bodegaId, "items");
  const restricciones = [];

  if (filtros.estado)    restricciones.push(where("estado", "==", filtros.estado));
  if (filtros.otId)      restricciones.push(where("otId", "==", filtros.otId));

  restricciones.push(orderBy("creadoEn", "desc"));

  const snap = await getDocs(query(q, ...restricciones));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════════════════
//  6. OBTENER MOVIMIENTOS DE UN ÍTEM
// ═══════════════════════════════════════════════════════════
export async function obtenerMovimientos(db, bodegaId, itemId) {
  const snap = await getDocs(
    query(
      collection(db, "bodegas", bodegaId, "movimientos"),
      where("itemId", "==", itemId),
      orderBy("fecha", "asc")
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════════════════
//  7. OBTENER OBSERVACIONES DE UN ÍTEM
// ═══════════════════════════════════════════════════════════
export async function obtenerObservaciones(db, bodegaId, itemId) {
  const snap = await getDocs(
    query(
      collection(db, "bodegas", bodegaId, "observaciones"),
      where("itemId", "==", itemId),
      orderBy("fecha", "asc")
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════════════════
//  8. INFORME COMPLETO DE UN ÍTEM
//     Retorna: datos del ítem + movimientos + observaciones
// ═══════════════════════════════════════════════════════════
export async function obtenerInformeItem(db, bodegaId, itemId) {
  const itemSnap = await getDoc(doc(db, "bodegas", bodegaId, "items", itemId));
  if (!itemSnap.exists()) throw new Error("Ítem no encontrado.");

  const [movimientos, observaciones] = await Promise.all([
    obtenerMovimientos(db, bodegaId, itemId),
    obtenerObservaciones(db, bodegaId, itemId)
  ]);

  return {
    item:          { id: itemSnap.id, ...itemSnap.data() },
    movimientos,
    observaciones
  };
}

// ═══════════════════════════════════════════════════════════
//  9. BUSCAR ÍTEM POR UBICACIÓN (nivel + fila)
// ═══════════════════════════════════════════════════════════
export async function buscarPorUbicacion(db, bodegaId, nivel, fila) {
  const items = await obtenerItems(db, bodegaId, { estado: "en_bodega" });
  return items.filter(item =>
    item.ubicaciones?.some(
      u => u.nivel?.toUpperCase() === nivel?.toUpperCase() &&
           String(u.fila) === String(fila)
    )
  );
}

// ═══════════════════════════════════════════════════════════
//  10. PENDIENTES DE AUTORIZACIÓN para un usuario
// ═══════════════════════════════════════════════════════════
export async function obtenerPendientesAutorizacion(db, bodegaId, usuarioUid) {
  const snap = await getDocs(
    query(
      collection(db, "bodegas", bodegaId, "items"),
      where("estado", "==", "reservado"),
      where("solicitudSalida.receptorUid", "==", usuarioUid),
      where("solicitudSalida.autorizado",  "==", false)
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════════════════
//  RENDER — UI principal de Bodega
// ═══════════════════════════════════════════════════════════
export function renderBodega(container, db, storage, usuario) {
  container.innerHTML = `
    <div class="bodega-wrapper">
      <h2 class="section-title">📦 Bodega</h2>

      <!-- Selector de bodega -->
      <div class="bodega-tabs">
        <button class="bodega-tab active" data-id="${BODEGAS.PERNOS_PIEZAS}">
          🔩 Pernos y Piezas
        </button>
        <button class="bodega-tab" data-id="${BODEGAS.MOTORES}">
          ⚙️ Motores
        </button>
      </div>

      <!-- Contenido dinámico -->
      <div id="bodega-content"></div>
    </div>
  `;

  let bodegaActual = BODEGAS.PERNOS_PIEZAS;

  const tabs = container.querySelectorAll(".bodega-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      bodegaActual = tab.dataset.id;
      renderContenidoBodega(bodegaActual);
    });
  });

  renderContenidoBodega(bodegaActual);

  // ── Render contenido de una bodega específica ──
  async function renderContenidoBodega(bodegaId) {
    const content = document.getElementById("bodega-content");
    content.innerHTML = `<p>Cargando...</p>`;

    const esBodeguero = usuario.rol === ROL_BODEGUERO;
    const items       = await obtenerItems(db, bodegaId);
    const pendientes  = esBodeguero
      ? []
      : await obtenerPendientesAutorizacion(db, bodegaId, usuario.uid);

    content.innerHTML = `
      <!-- Alertas de pendientes para el receptor -->
      ${pendientes.length ? `
        <div class="bodega-alertas">
          <h3>⚠️ Tienes ${pendientes.length} entrega(s) pendiente(s) de autorizar</h3>
          ${pendientes.map(it => `
            <div class="bodega-pendiente-card" data-item="${it.id}" data-bodega="${bodegaId}">
              <strong>${it.nombre}</strong>
              <span>Solicitado por: ${it.solicitudSalida.bodegueroNombre}</span>
              <span>OT: ${it.solicitudSalida.otId || "—"}</span>
              <button class="btn-autorizar-salida" data-item="${it.id}" data-bodega="${bodegaId}">
                ✅ Autorizar entrega
              </button>
            </div>
          `).join("")}
        </div>
      ` : ""}

      <!-- Buscador -->
      <div class="bodega-busqueda">
        <input id="buscar-bodega" type="text" placeholder="Buscar por nombre, nivel o fila...">
        <button id="btn-buscar-bodega">🔍 Buscar</button>
        ${esBodeguero ? `<button id="btn-nuevo-item" class="btn-primary">+ Nuevo ingreso</button>` : ""}
      </div>

      <!-- Tabla de ítems -->
      <div class="bodega-tabla-wrapper">
        <table class="bodega-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cantidad</th>
              <th>Ubicación(es)</th>
              <th>Estado</th>
              <th>OT</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="bodega-tbody">
            ${items.length === 0
              ? `<tr><td colspan="6">Sin ítems registrados.</td></tr>`
              : items.map(it => `
                <tr class="estado-${it.estado}">
                  <td>${it.nombre}</td>
                  <td>${it.cantidad}</td>
                  <td>${(it.ubicaciones || []).map(u => `<span class="ubicacion-badge">${u.nivel}-${u.fila}</span>`).join(" ")}</td>
                  <td><span class="estado-badge estado-${it.estado}">${estadoLabel(it.estado)}</span></td>
                  <td>${it.otId || "—"}</td>
                  <td>
                    <button class="btn-ver-item" data-item="${it.id}" data-bodega="${bodegaId}">👁 Ver</button>
                    ${esBodeguero && it.estado === "en_bodega"
                      ? `<button class="btn-solicitar-salida" data-item="${it.id}" data-bodega="${bodegaId}">📤 Entrega</button>`
                      : ""}
                  </td>
                </tr>
              `).join("")
            }
          </tbody>
        </table>
      </div>
    `;

    // ── Eventos ──
    if (esBodeguero) {
      document.getElementById("btn-nuevo-item")?.addEventListener("click", () =>
        mostrarModalIngreso(bodegaId)
      );
      content.querySelectorAll(".btn-solicitar-salida").forEach(btn => {
        btn.addEventListener("click", () =>
          mostrarModalSolicitarSalida(btn.dataset.bodega, btn.dataset.item)
        );
      });
    }

    content.querySelectorAll(".btn-ver-item").forEach(btn => {
      btn.addEventListener("click", () =>
        mostrarModalInforme(btn.dataset.bodega, btn.dataset.item)
      );
    });

    content.querySelectorAll(".btn-autorizar-salida").forEach(btn => {
      btn.addEventListener("click", () =>
        mostrarModalAutorizarSalida(btn.dataset.bodega, btn.dataset.item)
      );
    });

    // Búsqueda rápida
    document.getElementById("btn-buscar-bodega")?.addEventListener("click", () => {
      const q = document.getElementById("buscar-bodega").value.toLowerCase();
      document.querySelectorAll("#bodega-tbody tr").forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  }

  // ── Label de estado ──
  function estadoLabel(estado) {
    return { en_bodega: "En Bodega", reservado: "Reservado", entregado: "Entregado" }[estado] || estado;
  }

  // ─────────────────────────────────────────────
  //  MODAL: NUEVO INGRESO
  // ─────────────────────────────────────────────
  function mostrarModalIngreso(bodegaId) {
    abrirModal(`
      <h3>📥 Nuevo Ingreso</h3>
      <label>Nombre / Tipo</label>
      <input id="inp-nombre" type="text" placeholder="Ej: Perno 1/2 x 3">
      <label>Descripción</label>
      <textarea id="inp-desc" rows="2"></textarea>
      <label>Cantidad</label>
      <input id="inp-cantidad" type="number" min="1" value="1">
      <label>OT Asociada (opcional)</label>
      <input id="inp-ot" type="text" placeholder="ID de OT">
      <label>Ubicaciones (puede agregar varias)</label>
      <div id="ubicaciones-list">
        <div class="ubicacion-row">
          <input type="text" class="inp-nivel" placeholder="Nivel (ej: A)" maxlength="3">
          <input type="text" class="inp-fila"  placeholder="Fila (ej: 3)" maxlength="5">
          <button class="btn-add-ubicacion">+</button>
        </div>
      </div>
      <label>Fotos de recepción</label>
      <input id="inp-fotos-ingreso" type="file" multiple accept="image/*">
      <button id="btn-confirmar-ingreso" class="btn-primary">Guardar ingreso</button>
    `);

    document.querySelector(".btn-add-ubicacion").addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "ubicacion-row";
      row.innerHTML = `
        <input type="text" class="inp-nivel" placeholder="Nivel" maxlength="3">
        <input type="text" class="inp-fila" placeholder="Fila" maxlength="5">
        <button class="btn-remove-ubicacion">−</button>
      `;
      row.querySelector(".btn-remove-ubicacion").addEventListener("click", () => row.remove());
      document.getElementById("ubicaciones-list").appendChild(row);
    });

    document.getElementById("btn-confirmar-ingreso").addEventListener("click", async () => {
      const ubicaciones = [...document.querySelectorAll(".ubicacion-row")].map(r => ({
        nivel: r.querySelector(".inp-nivel").value.toUpperCase().trim(),
        fila:  r.querySelector(".inp-fila").value.trim()
      })).filter(u => u.nivel && u.fila);

      const filesInput = document.getElementById("inp-fotos-ingreso");
      const fotos = Array.from(filesInput.files || []);

      await ingresarItem(db, storage, bodegaId, {
        nombre:      document.getElementById("inp-nombre").value,
        descripcion: document.getElementById("inp-desc").value,
        cantidad:    document.getElementById("inp-cantidad").value,
        otId:        document.getElementById("inp-ot").value || null,
        ubicaciones
      }, fotos, usuario);

      cerrarModal();
      renderContenidoBodega(bodegaId);
    });
  }

  // ─────────────────────────────────────────────
  //  MODAL: SOLICITAR SALIDA (bodeguero)
  // ─────────────────────────────────────────────
  function mostrarModalSolicitarSalida(bodegaId, itemId) {
    abrirModal(`
      <h3>📤 Solicitar Entrega</h3>
      <label>UID del receptor</label>
      <input id="inp-receptor-uid" type="text" placeholder="UID del usuario">
      <label>Nombre del receptor</label>
      <input id="inp-receptor-nombre" type="text" placeholder="Nombre">
      <label>OT Asociada (opcional)</label>
      <input id="inp-ot-salida" type="text" placeholder="ID de OT">
      <p class="modal-info">El receptor deberá confirmar la recepción desde su vista.</p>
      <button id="btn-confirmar-solicitud" class="btn-primary">Enviar solicitud</button>
    `);

    document.getElementById("btn-confirmar-solicitud").addEventListener("click", async () => {
      await solicitarSalida(
        db, bodegaId, itemId,
        document.getElementById("inp-receptor-uid").value,
        document.getElementById("inp-receptor-nombre").value,
        document.getElementById("inp-ot-salida").value || null,
        usuario
      );
      cerrarModal();
      renderContenidoBodega(bodegaId);
    });
  }

  // ─────────────────────────────────────────────
  //  MODAL: AUTORIZAR SALIDA (receptor)
  // ─────────────────────────────────────────────
  function mostrarModalAutorizarSalida(bodegaId, itemId) {
    abrirModal(`
      <h3>✅ Autorizar Recepción</h3>
      <p>Al confirmar, quedará registrado que recibiste este ítem.</p>
      <label>Fotos de entrega (opcional)</label>
      <input id="inp-fotos-entrega" type="file" multiple accept="image/*">
      <button id="btn-confirmar-autorizacion" class="btn-primary">Confirmar recepción</button>
    `);

    document.getElementById("btn-confirmar-autorizacion").addEventListener("click", async () => {
      const fotos = Array.from(document.getElementById("inp-fotos-entrega").files || []);
      await autorizarSalida(db, storage, bodegaId, itemId, fotos, usuario);
      cerrarModal();
      renderContenidoBodega(bodegaId);
    });
  }

  // ─────────────────────────────────────────────
  //  MODAL: INFORME COMPLETO DEL ÍTEM
  // ─────────────────────────────────────────────
  async function mostrarModalInforme(bodegaId, itemId) {
    abrirModal(`<p>Cargando informe...</p>`);
    const { item, movimientos, observaciones } = await obtenerInformeItem(db, bodegaId, itemId);

    const fotosHtml = (urls) => urls.map(u =>
      `<img src="${u}" class="informe-foto" alt="foto">`
    ).join("");

    const ubicHtml = (item.ubicaciones || []).map(u =>
      `<span class="ubicacion-badge grande">${u.nivel}−${u.fila}</span>`
    ).join(" ");

    actualizarModal(`
      <h3>📋 Informe: ${item.nombre}</h3>

      <div class="informe-seccion">
        <h4>📍 Ubicación actual</h4>
        <div>${ubicHtml || "Sin ubicación"}</div>
      </div>

      <div class="informe-seccion">
        <h4>ℹ️ Datos</h4>
        <p>Cantidad: <strong>${item.cantidad}</strong></p>
        <p>Estado: <strong>${estadoLabel(item.estado)}</strong></p>
        <p>OT: <strong>${item.otId || "—"}</strong></p>
        <p>Descripción: ${item.descripcion || "—"}</p>
      </div>

      ${item.fotosIngreso?.length ? `
        <div class="informe-seccion">
          <h4>📷 Fotos de Recepción</h4>
          <div class="informe-fotos">${fotosHtml(item.fotosIngreso)}</div>
        </div>
      ` : ""}

      ${item.fotosEntrega?.length ? `
        <div class="informe-seccion">
          <h4>📷 Fotos de Entrega</h4>
          <div class="informe-fotos">${fotosHtml(item.fotosEntrega)}</div>
          <p>Entregado a: <strong>${item.solicitudSalida?.receptorNombre || "—"}</strong></p>
        </div>
      ` : ""}

      <div class="informe-seccion">
        <h4>🔄 Historial de movimientos</h4>
        ${movimientos.length === 0
          ? `<p>Sin movimientos.</p>`
          : movimientos.map(m => `
            <div class="movimiento-row">
              <span class="mov-tipo ${m.tipo}">${m.tipo === "ingreso" ? "📥 Ingreso" : "📤 Salida"}</span>
              <span>${formatearFecha(m.fecha)}</span>
              <span>${m.tipo === "salida"
                ? `Receptor: ${m.receptor?.nombre || "—"}`
                : `Bodeguero: ${m.usuario?.nombre || "—"}`
              }</span>
              <span>OT: ${m.otId || "—"}</span>
            </div>
          `).join("")
        }
      </div>

      <div class="informe-seccion">
        <h4>💬 Observaciones</h4>
        ${observaciones.length === 0
          ? `<p>Sin observaciones.</p>`
          : observaciones.map(o => `
            <div class="obs-row">
              <p>${o.texto}</p>
              <small>${o.usuario?.nombre} — ${formatearFecha(o.fecha)}</small>
              ${o.fotos?.length ? `<div class="informe-fotos">${fotosHtml(o.fotos)}</div>` : ""}
            </div>
          `).join("")
        }
        <div class="obs-nueva">
          <textarea id="inp-obs-texto" rows="2" placeholder="Nueva observación..."></textarea>
          <input id="inp-obs-fotos" type="file" multiple accept="image/*">
          <button id="btn-guardar-obs" class="btn-secondary">💬 Guardar observación</button>
        </div>
      </div>
    `);

    document.getElementById("btn-guardar-obs")?.addEventListener("click", async () => {
      const texto = document.getElementById("inp-obs-texto").value.trim();
      const fotos = Array.from(document.getElementById("inp-obs-fotos").files || []);
      if (!texto && !fotos.length) return;
      await agregarObservacion(db, storage, bodegaId, itemId, texto, fotos, usuario);
      mostrarModalInforme(bodegaId, itemId);
    });
  }

  // ─────────────────────────────────────────────
  //  Helpers de modal genérico
  // ─────────────────────────────────────────────
  function abrirModal(html) {
    let overlay = document.getElementById("bodega-modal-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "bodega-modal-overlay";
      overlay.innerHTML = `<div id="bodega-modal"><button id="modal-cerrar">✕</button><div id="modal-body"></div></div>`;
      document.body.appendChild(overlay);
      document.getElementById("modal-cerrar").addEventListener("click", cerrarModal);
      overlay.addEventListener("click", e => { if (e.target === overlay) cerrarModal(); });
    }
    document.getElementById("modal-body").innerHTML = html;
    overlay.style.display = "flex";
  }

  function actualizarModal(html) {
    document.getElementById("modal-body").innerHTML = html;
  }

  function cerrarModal() {
    const overlay = document.getElementById("bodega-modal-overlay");
    if (overlay) overlay.style.display = "none";
  }

  function formatearFecha(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-CL") + " " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  }
}

// ═══════════════════════════════════════════════════════════
//  ESTILOS CSS para bodega (inyectar en <head>)
// ═══════════════════════════════════════════════════════════
export function inyectarEstilosBodega() {
  if (document.getElementById("bodega-styles")) return;
  const style = document.createElement("style");
  style.id = "bodega-styles";
  style.textContent = `
    .bodega-wrapper { padding: 16px; }
    .bodega-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .bodega-tab { padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; background: #e5e7eb; font-weight: 600; }
    .bodega-tab.active { background: #2563eb; color: white; }
    .bodega-busqueda { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .bodega-busqueda input { flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid #d1d5db; }
    .btn-primary { background: #2563eb; color: white; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-weight: 600; }
    .btn-secondary { background: #6b7280; color: white; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; }
    .bodega-tabla-wrapper { overflow-x: auto; }
    .bodega-tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
    .bodega-tabla th, .bodega-tabla td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    .bodega-tabla th { background: #f3f4f6; font-weight: 700; }
    .bodega-tabla tr:hover { background: #f9fafb; }
    .ubicacion-badge { background: #dbeafe; color: #1e40af; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 700; margin: 2px; display: inline-block; }
    .ubicacion-badge.grande { font-size: 15px; padding: 4px 12px; }
    .estado-badge { border-radius: 12px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
    .estado-badge.estado-en_bodega { background: #d1fae5; color: #065f46; }
    .estado-badge.estado-reservado  { background: #fef9c3; color: #854d0e; }
    .estado-badge.estado-entregado  { background: #e0e7ff; color: #3730a3; }
    .btn-ver-item, .btn-solicitar-salida, .btn-autorizar-salida {
      padding: 4px 10px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; margin-right: 4px;
    }
    .btn-ver-item          { background: #e0e7ff; color: #1e1b4b; }
    .btn-solicitar-salida  { background: #fef3c7; color: #92400e; }
    .btn-autorizar-salida  { background: #d1fae5; color: #064e3b; font-weight: 700; }
    .bodega-alertas { background: #fff7ed; border: 1px solid #fdba74; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .bodega-pendiente-card { background: white; border-radius: 8px; padding: 12px; margin: 8px 0; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; border: 1px solid #fed7aa; }
    /* Modal */
    #bodega-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: none; align-items: center; justify-content: center; z-index: 1000; }
    #bodega-modal { background: white; border-radius: 16px; padding: 24px; width: 90%; max-width: 620px; max-height: 88vh; overflow-y: auto; position: relative; }
    #modal-cerrar { position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 20px; cursor: pointer; }
    #bodega-modal h3 { margin-top: 0; }
    #bodega-modal label { display: block; margin-top: 12px; font-weight: 600; font-size: 13px; }
    #bodega-modal input[type=text], #bodega-modal input[type=number], #bodega-modal textarea {
      width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; margin-top: 4px; box-sizing: border-box;
    }
    .ubicacion-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
    .ubicacion-row input { flex: 1; }
    .btn-add-ubicacion, .btn-remove-ubicacion { padding: 4px 10px; border-radius: 6px; border: none; cursor: pointer; background: #e5e7eb; }
    .modal-info { background: #eff6ff; border-radius: 8px; padding: 10px; font-size: 13px; color: #1e40af; }
    /* Informe */
    .informe-seccion { margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; }
    .informe-seccion h4 { margin: 0 0 8px; }
    .informe-fotos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .informe-foto { width: 90px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer; }
    .informe-foto:hover { transform: scale(1.04); }
    .movimiento-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .mov-tipo { font-weight: 700; padding: 2px 8px; border-radius: 6px; }
    .mov-tipo.ingreso { background: #d1fae5; color: #065f46; }
    .mov-tipo.salida  { background: #fef3c7; color: #92400e; }
    .obs-row { background: #f9fafb; border-radius: 8px; padding: 10px; margin: 8px 0; }
    .obs-row small { color: #6b7280; font-size: 11px; }
    .obs-nueva { margin-top: 12px; }
    .obs-nueva textarea { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 8px; box-sizing: border-box; }
    .obs-nueva input[type=file] { margin: 8px 0; }
  `;
  document.head.appendChild(style);
}
