// Formatos de fecha/hora estilo WhatsApp para la bandeja (zona de Montevideo).

const TZ = "America/Montevideo";
const fmt = (opts) => new Intl.DateTimeFormat("es-UY", { timeZone: TZ, ...opts });
const fHora = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
const fDiaSemana = fmt({ weekday: "long" });
const fFechaCorta = fmt({ day: "2-digit", month: "2-digit", year: "2-digit" });
const fFechaLarga = fmt({ day: "numeric", month: "long", year: "numeric" });
const fClaveDia = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });

/** "YYYY-MM-DD" del día en Montevideo (para agrupar y comparar). */
export function claveDia(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(fClaveDia.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function diasDeDiferencia(fecha, ahora = new Date()) {
  const a = Date.parse(claveDia(ahora));
  const b = Date.parse(claveDia(fecha));
  return Math.round((a - b) / 86400000);
}

export function horaCorta(fecha) {
  if (!fecha) return "";
  return fHora.format(new Date(fecha));
}

/** Para la lista: hoy → "14:21", ayer → "Ayer", esta semana → "lunes", si no → "12/10/26". */
export function fechaLista(fecha) {
  if (!fecha) return "";
  const dias = diasDeDiferencia(fecha);
  if (dias <= 0) return horaCorta(fecha);
  if (dias === 1) return "Ayer";
  if (dias < 7) return fDiaSemana.format(new Date(fecha));
  return fFechaCorta.format(new Date(fecha));
}

/** Separador del chat: "Hoy", "Ayer", "lunes", "12 de octubre de 2026". */
export function etiquetaDia(fecha) {
  const dias = diasDeDiferencia(fecha);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 7) {
    const s = fDiaSemana.format(new Date(fecha));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return fFechaLarga.format(new Date(fecha));
}

export function iniciales(nombre) {
  const partes = (nombre || "?").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const ini = partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[partes.length - 1][0];
  return ini.toUpperCase();
}

/** Formato legible de un teléfono uruguayo: 59899123456 → 099 123 456. */
export function telefonoLegible(tel) {
  if (!tel) return "";
  const d = String(tel).replace(/\D/g, "");
  const local = d.startsWith("598") ? d.slice(3) : d.replace(/^0/, "");
  if (local.length === 8 && local.startsWith("9")) return `0${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  return tel;
}

/** Nombre a mostrar de una conversación. */
export function nombreConversacion(conv) {
  return conv?.contacto?.nombre || telefonoLegible(conv?.wa_id) || "Sin nombre";
}

export const CANAL_LABEL = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger" };

/** Número para un link tel: (formato internacional uruguayo por defecto). */
export function telefonoParaLlamar(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("598")) return `+${d}`;
  if (d.startsWith("09") && d.length === 9) return `+598${d.slice(1)}`;
  if (d.startsWith("9") && d.length === 8) return `+598${d}`;
  if (d.length >= 10) return `+${d}`;
  return `+598${d}`;
}
