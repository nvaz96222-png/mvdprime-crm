// =====================================================================
// Consultas en lenguaje natural sobre las conversaciones.
//
// Dos etapas, para que Claude procese lo mínimo indispensable:
//
//   1. PLANNER (modelo barato, Haiku): traduce la pregunta a filtros
//      estructurados con tool use. Acá es donde ocurre la expansión
//      semántica ("financiación" → cuotas, crédito, plan de pago), que
//      es lo que de otro modo habría que comprar con embeddings.
//   2. RECUPERACIÓN en Postgres: fechas, contacto, FTS. Devuelve solo
//      los mensajes candidatos, dentro de un presupuesto de tokens.
//   3. RESPUESTA (modelo bueno, Sonnet): redacta con ese contexto.
//
// Las preguntas agregadas ("cuántas consultas", "quién no recibió
// respuesta") se resuelven con SQL y ni siquiera llegan a la etapa 3
// con datos pesados: se le pasan números, no conversaciones.
// =====================================================================

import Anthropic from "@anthropic-ai/sdk";
import {
  recuperarContexto,
  renderizarContexto,
  buscarConversaciones,
  metricas,
} from "./busqueda";
import { MODELO_PLANNER, MODELO_CONSULTA, PRESUPUESTO_TOKENS, RETENCION_DIAS } from "./config";

// USD por millón de tokens. Solo para estimar el costo de cada consulta.
const PRECIOS = {
  "claude-haiku-4-5": { entrada: 1, salida: 5 },
  "claude-sonnet-5": { entrada: 2, salida: 10 },
  "claude-opus-5": { entrada: 5, salida: 25 },
};

const HERRAMIENTA_PLAN = {
  name: "planificar_busqueda",
  description:
    "Traduce la pregunta del usuario a filtros de búsqueda sobre la base de " +
    "conversaciones de WhatsApp. Se llama siempre, una sola vez.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      modo: {
        type: "string",
        enum: ["detalle", "agregado", "sin_responder"],
        description:
          "detalle = hay que leer conversaciones para responder. " +
          "agregado = alcanza con contar (cuántas consultas, cuántos clientes). " +
          "sin_responder = listar clientes que escribieron y no recibieron respuesta.",
      },
      dias: {
        type: "integer",
        description:
          "Ventana hacia atrás en días. 0 = sin límite (toda la retención). " +
          "Si el usuario dice 'últimos 30 días' poné 30.",
      },
      terminos: {
        type: "array",
        items: { type: "string" },
        description:
          "Palabras o frases a buscar en el texto. IMPORTANTE: incluí sinónimos " +
          "y variantes del rubro inmobiliario uruguayo. Ej: para financiación → " +
          "['financiación','cuotas','crédito','hipotecario','plan de pago','financiado']. " +
          "Vacío si la pregunta no es sobre un tema puntual.",
      },
      contacto: {
        type: "string",
        description:
          "Nombre, teléfono o parte del número de un cliente concreto. Vacío si no aplica.",
      },
      direccion: {
        type: "string",
        enum: ["entrante", "saliente", "ambas"],
        description:
          "entrante = solo lo que escribieron los clientes. saliente = solo lo que " +
          "escribió la empresa. ambas = ambos lados.",
      },
      max_conversaciones: {
        type: "integer",
        description: "Cuántas conversaciones traer como máximo (5 a 40). Por defecto 25.",
      },
    },
    required: ["modo", "dias", "terminos", "contacto", "direccion", "max_conversaciones"],
  },
};

function promptPlanner() {
  const hoy = new Date().toISOString().slice(0, 10);
  return [
    "Sos el planificador de un buscador de conversaciones de WhatsApp de una",
    "inmobiliaria uruguaya (MVDPrime). Tu única tarea es convertir la pregunta",
    "en filtros: no respondés la pregunta.",
    "",
    `Fecha de hoy: ${hoy}. Solo hay datos de los últimos ${RETENCION_DIAS} días.`,
    "",
    "Reglas:",
    "- Expandí siempre los términos a sinónimos y variantes del rubro. Es lo que",
    "  hace que la búsqueda encuentre 'me lo pueden dejar en cuotas?' cuando",
    "  preguntan por financiación.",
    "- Usá modo 'agregado' solo para preguntas de conteo puro.",
    "- Usá modo 'sin_responder' para 'quién no recibió respuesta' o 'a quién",
    "  hay que seguir'.",
    "- Si la pregunta no acota fechas, poné dias 0.",
  ].join("\n");
}

const PROMPT_RESPUESTA = [
  "Respondés preguntas sobre las conversaciones de WhatsApp de MVDPrime,",
  "una inmobiliaria de Montevideo. Escribís en español rioplatense, directo",
  "y sin relleno.",
  "",
  "Reglas:",
  "- Usá SOLO los datos que te paso. Si no alcanzan, decilo explícitamente.",
  "- Nombrá a los clientes por su nombre y teléfono cuando los tengas.",
  "- Si la respuesta es una lista de personas, usá viñetas con una línea por",
  "  persona: quién, qué preguntó, cuándo, y si quedó sin respuesta.",
  "- Citá las fechas de los mensajes relevantes.",
  "- No inventes conversaciones ni contactos que no estén en los datos.",
].join("\n");

function cliente() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Falta ANTHROPIC_API_KEY");
  }
  return new Anthropic();
}

function costo(modelo, uso) {
  const p = PRECIOS[modelo];
  if (!p || !uso) return 0;
  return (
    ((uso.input_tokens || 0) * p.entrada + (uso.output_tokens || 0) * p.salida) / 1_000_000
  );
}

/** Aplica el plan devuelto por el planner a fechas concretas. */
function ventana(plan) {
  const dias = Number(plan?.dias) > 0 ? Number(plan.dias) : RETENCION_DIAS;
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  return { desde, dias };
}

/**
 * Etapa 1: pregunta → filtros estructurados.
 */
export async function planificar(pregunta) {
  const anthropic = cliente();
  const respuesta = await anthropic.messages.create({
    model: MODELO_PLANNER,
    max_tokens: 1024,
    system: promptPlanner(),
    messages: [{ role: "user", content: pregunta }],
    tools: [HERRAMIENTA_PLAN],
    tool_choice: { type: "tool", name: HERRAMIENTA_PLAN.name },
  });

  const bloque = respuesta.content.find((b) => b.type === "tool_use");
  if (!bloque) throw new Error("El planner no devolvió filtros");

  return { plan: bloque.input, uso: respuesta.usage, modelo: MODELO_PLANNER };
}

/**
 * Consulta completa: planifica, recupera y responde.
 *
 * @returns {{ respuesta, plan, diagnostico }}
 */
export async function responderConsulta(supabase, pregunta) {
  const anthropic = cliente();
  const inicio = Date.now();

  // ── 1. Planificar ──────────────────────────────────────────────────
  const { plan, uso: usoPlan } = await planificar(pregunta);
  const { desde, dias } = ventana(plan);
  const maxConversaciones = Math.min(Math.max(Number(plan.max_conversaciones) || 25, 5), 40);

  // ── 2. Recuperar solo lo necesario ─────────────────────────────────
  let datos = "";
  let diagnosticoDatos = {};

  if (plan.modo === "agregado") {
    const m = await metricas(supabase, { desde });
    datos = [
      `Métricas de los últimos ${dias} días:`,
      `- Mensajes recibidos de clientes: ${m.entrantes}`,
      `- Mensajes enviados por la empresa: ${m.salientes}`,
      `- Conversaciones con actividad: ${m.conversaciones}`,
      `- Conversaciones sin responder: ${m.sinResponder}`,
    ].join("\n");
    diagnosticoDatos = { modo: "agregado", ...m };
  } else if (plan.modo === "sin_responder") {
    const convs = await buscarConversaciones(supabase, {
      sinResponder: true,
      desde,
      limite: maxConversaciones,
    });
    datos = convs.length
      ? [
          `Conversaciones sin respuesta en los últimos ${dias} días (${convs.length}):`,
          ...convs.map(
            (c) =>
              `- ${c.nombre_perfil || "Sin nombre"} (+${c.wa_id}) · último mensaje del cliente: ` +
              `${new Date(c.ultimo_entrante_at).toLocaleString("es-UY", { timeZone: "America/Montevideo" })} · ` +
              `${c.mensajes_count} mensajes · ${c.contacto_id ? "está en el CRM" : "no está en el CRM"}`
          ),
        ].join("\n")
      : `No hay conversaciones sin responder en los últimos ${dias} días.`;
    diagnosticoDatos = { modo: "sin_responder", conversaciones: convs.length };
  } else {
    const { conversaciones, totalHits } = await recuperarContexto(supabase, {
      desde,
      terminos: plan.terminos,
      contacto: plan.contacto || undefined,
      direccion: plan.direccion,
      maxConversaciones,
    });

    const render = renderizarContexto(conversaciones, PRESUPUESTO_TOKENS);
    datos = conversaciones.length
      ? `Conversaciones relevantes de los últimos ${dias} días:\n\n${render.texto}`
      : `No se encontraron conversaciones que coincidan en los últimos ${dias} días.`;
    diagnosticoDatos = {
      modo: "detalle",
      conversaciones: conversaciones.length,
      hits: totalHits,
      incluidas: render.incluidas,
      omitidas: render.omitidas,
      tokensContexto: render.tokensEstimados,
    };
  }

  // ── 3. Responder ───────────────────────────────────────────────────
  const respuesta = await anthropic.messages.create({
    model: MODELO_CONSULTA,
    max_tokens: 4096,
    output_config: { effort: "medium" },
    system: PROMPT_RESPUESTA,
    messages: [
      {
        role: "user",
        content: `Pregunta: ${pregunta}\n\n--- DATOS ---\n${datos}`,
      },
    ],
  });

  const texto = respuesta.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const costoTotal = costo(MODELO_PLANNER, usoPlan) + costo(MODELO_CONSULTA, respuesta.usage);

  return {
    respuesta: texto,
    plan,
    diagnostico: {
      ...diagnosticoDatos,
      dias,
      modeloPlanner: MODELO_PLANNER,
      modeloRespuesta: MODELO_CONSULTA,
      tokensEntrada: (usoPlan?.input_tokens || 0) + (respuesta.usage?.input_tokens || 0),
      tokensSalida: (usoPlan?.output_tokens || 0) + (respuesta.usage?.output_tokens || 0),
      costoUSD: Number(costoTotal.toFixed(5)),
      ms: Date.now() - inicio,
    },
  };
}
