// =====================================================================
// Configuración del agente IA (tabla agente_ia_config, fila id = 1).
// Si la tabla no existe todavía (migración pendiente) devuelve los valores
// por defecto con activo = false: el agente nunca responde sin config.
// =====================================================================

export const MODELO_DEFAULT = process.env.AGENTE_IA_MODELO || "claude-haiku-4-5-20251001";

export const PREGUNTAS_DEFAULT = [
  "¿Busca comprar o alquilar?",
  "¿Cuál es su presupuesto aproximado?",
  "Compra: ¿cómo piensa pagar (contado, crédito hipotecario, ya tiene el crédito preaprobado)? Alquiler: ¿con qué garantía (ANDA, CGN, seguro de alquiler, depósito, propietaria)?",
  "¿En qué zona o barrio le interesa?",
  "¿Para cuándo necesita mudarse o concretar?",
  "Alquiler: ¿cuántas personas van a vivir? ¿Tiene mascotas?",
  "¿Qué días y horarios le quedan cómodos para visitar?",
];

export const CONFIG_DEFAULT = {
  id: 1,
  activo: false,
  activar_en_nuevas: false,
  nombre_asistente: "el asistente de MVD Prime",
  mensaje_bienvenida: null,
  tono: null,
  preguntas: PREGUNTAS_DEFAULT,
  instrucciones_extra: null,
  horario_desde: null,
  horario_hasta: null,
  dias_activos: [1, 2, 3, 4, 5, 6, 7],
  max_mensajes_conversacion: 12,
  max_mensajes_dia: 200,
  modelo: null,
};

export async function cargarConfig(supabase) {
  try {
    const { data, error } = await supabase.from("agente_ia_config").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return { ...CONFIG_DEFAULT, _sinTabla: !!error };
    const preguntas = Array.isArray(data.preguntas) && data.preguntas.length ? data.preguntas : PREGUNTAS_DEFAULT;
    return { ...CONFIG_DEFAULT, ...data, preguntas };
  } catch {
    return { ...CONFIG_DEFAULT, _sinTabla: true };
  }
}

const TZ = "America/Montevideo";

/** ¿Está dentro del horario configurado? (hora de Montevideo) */
export function enHorario(config, ahora = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(ahora).map((p) => [p.type, p.value])
  );
  const dia = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[partes.weekday];
  const dias = config.dias_activos?.length ? config.dias_activos : [1, 2, 3, 4, 5, 6, 7];
  if (!dias.includes(dia)) return false;
  if (!config.horario_desde || !config.horario_hasta) return true;
  const min = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); };
  const ahoraMin = Number(partes.hour) * 60 + Number(partes.minute);
  const desde = min(config.horario_desde), hasta = min(config.horario_hasta);
  // Soporta franjas que cruzan la medianoche (ej. 20:00 → 08:00).
  return desde <= hasta ? ahoraMin >= desde && ahoraMin < hasta : ahoraMin >= desde || ahoraMin < hasta;
}

/** Normaliza y valida lo que manda la pantalla de configuración. */
export function limpiarConfig(entrada = {}) {
  const hora = (v) => (v && /^\d{2}:\d{2}/.test(v) ? String(v).slice(0, 5) : null);
  const entero = (v, def, min, max) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const texto = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const preguntas = (Array.isArray(entrada.preguntas) ? entrada.preguntas : [])
    .map((p) => String(p || "").trim()).filter(Boolean).slice(0, 15).map((p) => p.slice(0, 300));
  const dias = (Array.isArray(entrada.dias_activos) ? entrada.dias_activos : [])
    .map(Number).filter((d) => d >= 1 && d <= 7);
  return {
    activo: !!entrada.activo,
    activar_en_nuevas: !!entrada.activar_en_nuevas,
    nombre_asistente: texto(entrada.nombre_asistente, 80) || CONFIG_DEFAULT.nombre_asistente,
    mensaje_bienvenida: texto(entrada.mensaje_bienvenida, 500),
    tono: texto(entrada.tono, 500),
    preguntas: preguntas.length ? preguntas : PREGUNTAS_DEFAULT,
    instrucciones_extra: texto(entrada.instrucciones_extra, 2000),
    horario_desde: hora(entrada.horario_desde),
    horario_hasta: hora(entrada.horario_hasta),
    dias_activos: dias.length ? [...new Set(dias)].sort() : [1, 2, 3, 4, 5, 6, 7],
    max_mensajes_conversacion: entero(entrada.max_mensajes_conversacion, 12, 1, 50),
    max_mensajes_dia: entero(entrada.max_mensajes_dia, 200, 1, 2000),
    modelo: texto(entrada.modelo, 80),
  };
}
