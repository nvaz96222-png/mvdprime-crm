// =====================================================================
// Configuración central del módulo WhatsApp.
//
// Todos los secretos viven en variables de entorno (.env.local en local,
// Vercel env en producción). Nada de credenciales en el código.
//
// Ver docs/whatsapp.md para el detalle de cada variable y cómo obtenerlas.
// =====================================================================

// Versión de la Graph API. v26.0 es la vigente (release 2026-07-29).
// Meta mantiene cada versión ~2 años; subirla es cambiar esta env var.
export const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v26.0";
export const GRAPH_API = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Credenciales de la app de Meta / WABA.
export const APP_SECRET = process.env.WHATSAPP_APP_SECRET || null;
export const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || null;
export const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN || null;
export const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || null;
export const WABA_ID = process.env.WHATSAPP_WABA_ID || null;

// ── Retención ────────────────────────────────────────────────────────
// Fuente de verdad de la política de retención. La purga diaria
// (/api/whatsapp/retencion, disparada por Vercel Cron) lee esta variable
// y se la pasa a wa_purgar_mensajes().
export const RETENCION_DIAS = Number(process.env.MESSAGE_RETENTION_DAYS) || 90;

// Piso duro anti-borrado-accidental: la función SQL aplica
// greatest(dias, 30), así que un valor bajo por error NUNCA puede borrar
// mensajes de menos de 30 días. Este mismo piso se replica acá para poder
// avisar antes de llamar a la DB.
export const RETENCION_DIAS_MINIMO = 30;

// ── Ingesta ──────────────────────────────────────────────────────────
// Los webhooks de estado (sent/delivered/read) triplican las escrituras y
// no alimentan ninguna consulta. Por defecto se descartan (salvo 'failed').
export const GUARDAR_ESTADOS = process.env.WHATSAPP_STORE_STATUSES === "true";

// ── Claude ───────────────────────────────────────────────────────────
// Dos modelos: uno barato traduce la pregunta a filtros estructurados,
// otro redacta la respuesta con el contexto ya recortado.
export const MODELO_PLANNER = process.env.WHATSAPP_MODELO_PLANNER || "claude-haiku-4-5";
export const MODELO_CONSULTA = process.env.WHATSAPP_MODELO_CONSULTA || "claude-sonnet-5";

// Tope de tokens de contexto que se le manda a Claude por consulta.
// Es un presupuesto explícito, no una consecuencia del volumen de datos.
export const PRESUPUESTO_TOKENS = Number(process.env.WHATSAPP_PRESUPUESTO_TOKENS) || 25000;

/**
 * Devuelve la lista de variables faltantes para operar el webhook.
 * Sirve para que la UI muestre "falta configurar" en vez de fallar raro.
 */
export function credencialesFaltantes() {
  const requeridas = {
    WHATSAPP_APP_SECRET: APP_SECRET,
    WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN,
    WHATSAPP_TOKEN: ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: PHONE_NUMBER_ID,
  };
  return Object.entries(requeridas)
    .filter(([, valor]) => !valor)
    .map(([nombre]) => nombre);
}
