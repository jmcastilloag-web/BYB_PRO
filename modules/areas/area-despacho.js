// ============================================================
// ÁREA: DESPACHO
// ¿Qué cambiar aquí?
//   - Información mostrada antes de entregar
//   - Botón de marcar como entregado
//   - Cualquier checklist o dato extra de despacho
// ============================================================

window.renderAreaDespacho = (d, i, obs) => {
    if (d.estado !== 'despacho') return "";

    return `<h3>Despacho</h3>
        <button class="btn-finish" onclick="window.updateFlujo(${i},'salida_final','entregado')">🚚 MARCAR ENTREGADO</button>`;
};
