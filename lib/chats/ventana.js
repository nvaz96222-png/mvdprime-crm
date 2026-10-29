// =====================================================================
// Regla de las 24 horas de Meta (compartida por server y cliente).
//
// Se puede escribir texto libre solo si el cliente mandó un mensaje en las
// últimas 24 h (conversaciones.ultimo_entrante_at). Pasado ese plazo hace
// falta una plantilla aprobada (Fase 2b) o escribir desde la app de WhatsApp
// Business del celular (con coexistencia, la app no tiene esa restricción).
// =====================================================================

export const VENTANA_MS = 24 * 60 * 60 * 1000;

/** @returns {boolean} true si todavía se puede mandar texto libre. */
export function ventanaAbierta(conversacion, ahora = Date.now()) {
  const t = conversacion?.ultimo_entrante_at ? Date.parse(conversacion.ultimo_entrante_at) : NaN;
  return Number.isFinite(t) && ahora - t < VENTANA_MS;
}

/** Milisegundos que le quedan a la ventana (0 si está cerrada). */
export function restanteVentana(conversacion, ahora = Date.now()) {
  const t = conversacion?.ultimo_entrante_at ? Date.parse(conversacion.ultimo_entrante_at) : NaN;
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, VENTANA_MS - (ahora - t));
}
