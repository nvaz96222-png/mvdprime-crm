// =====================================================================
// Herramientas (tool use) del agente IA.
//
// Cada herramienta actúa SOLO sobre el lead/conversación en curso: el
// modelo no elige a quién escribir ni qué registros tocar. En modo
// simulación (ctx.simulado) ninguna escribe en la base: registran lo que
// harían en ctx.acciones para mostrarlo en el simulador.
// =====================================================================

import { buscarDisponibles } from "./ficha";

const PAUSA_DERIVACION_MS = 48 * 60 * 60 * 1000;
const PRIORIDADES = ["alta", "media", "baja"];

export const DEFINICIONES = [
  {
    name: "actualizar_calificacion",
    description:
      "Guarda en el CRM lo que el cliente dijo sobre lo que busca. Llamala cada vez que el cliente dé un dato nuevo de filtrado. " +
      "Solo con datos que el cliente dijo explícitamente; nunca inventes ni supongas.",
    input_schema: {
      type: "object",
      properties: {
        operacion: { type: "string", enum: ["compra", "alquiler"] },
        presupuesto: { type: "string", description: "Tal como lo dijo, ej. 'hasta USD 220.000' o '$ 35.000 por mes'" },
        financiacion: { type: "string", description: "Compra: contado, crédito hipotecario, preaprobado, etc." },
        garantia: { type: "string", description: "Alquiler: ANDA, CGN, seguro de alquiler, depósito, propietaria, etc." },
        zona: { type: "string" },
        plazo: { type: "string", description: "Para cuándo necesita mudarse o concretar" },
        ocupantes: { type: "string", description: "Quiénes van a vivir (alquiler)" },
        mascotas: { type: "string" },
        disponibilidad_visita: { type: "string" },
        resumen: { type: "string", description: "Resumen de 1 o 2 líneas del perfil del cliente" },
        completa: { type: "boolean", description: "true cuando ya tenés operación, presupuesto, forma de pago/garantía y plazo" },
        prioridad: { type: "string", enum: PRIORIDADES, description: "alta: listo para avanzar pronto y con forma de pago; baja: solo curiosea o plazo lejano" },
      },
    },
  },
  {
    name: "buscar_propiedades",
    description:
      "Busca propiedades DISPONIBLES de MVD Prime que coincidan con lo que pide el cliente. Usala si la propiedad consultada no le sirve " +
      "o si no se sabe por qué propiedad escribe. Devuelve hasta 5, con su link.",
    input_schema: {
      type: "object",
      properties: {
        operacion: { type: "string", enum: ["venta", "alquiler"] },
        tipo: { type: "string", enum: ["apartamento", "casa", "local", "terreno", "garage"] },
        barrio: { type: "string" },
        dormitorios_min: { type: "integer" },
        precio_max: { type: "number" },
        moneda: { type: "string", enum: ["USD", "UYU"] },
      },
    },
  },
  {
    name: "asignar_propiedad",
    description: "Registra que el cliente está interesado en una propiedad (por su id, de la ficha o de buscar_propiedades).",
    input_schema: {
      type: "object",
      properties: { propiedad_id: { type: "string" } },
      required: ["propiedad_id"],
    },
  },
  {
    name: "proponer_visita",
    description:
      "Deja en el calendario del CRM una visita TENTATIVA que un asesor tiene que confirmar. Usala cuando el cliente propone un día y hora concretos. " +
      "Al cliente decile que un asesor le confirma, nunca que la visita está confirmada.",
    input_schema: {
      type: "object",
      properties: {
        fecha_hora: { type: "string", description: "Fecha y hora local de Montevideo en formato YYYY-MM-DDTHH:MM" },
        propiedad_id: { type: "string" },
        notas: { type: "string" },
      },
      required: ["fecha_hora"],
    },
  },
  {
    name: "derivar_a_humano",
    description:
      "Pasa la conversación a una persona del equipo y te pausa. Usala ante: negociación de precio u ofertas, reclamos, pedido de hablar con una persona, " +
      "temas legales o de contratos, cualquier pregunta que la ficha no responda, o si el cliente ya está calificado y quiere avanzar.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string", description: "Motivo breve para el asesor" } },
      required: ["motivo"],
    },
  },
];

// "2026-11-02T10:30" en hora de Montevideo (UTC-3, sin horario de verano) → Date
function parsearFechaLocal(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(s || ""));
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Ejecuta una herramienta.
 * @param {object} ctx { admin, conv, lead, simulado, acciones[], siteUrl, propiedadesConocidas:Set, avisarDerivacion }
 * @returns {Promise<object>} resultado que se le devuelve al modelo
 */
export async function ejecutarHerramienta(nombre, input, ctx) {
  const { admin, conv, lead, simulado } = ctx;
  const registrar = (detalle) => { ctx.acciones.push({ herramienta: nombre, input, ...detalle }); };

  switch (nombre) {
    case "actualizar_calificacion": {
      if (!lead) return { ok: false, error: "La conversación no tiene lead." };
      const { completa, prioridad, ...datos } = input || {};
      const limpios = Object.fromEntries(
        Object.entries(datos).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 300)])
      );
      const calificacion = { ...(lead.calificacion || {}), ...limpios, actualizado_por: "ia", actualizado_at: new Date().toISOString() };
      const cambios = { calificacion };
      if (completa && (!lead.etapa || lead.etapa === "nuevo")) cambios.etapa = "calificado";
      if (PRIORIDADES.includes(prioridad)) cambios.prioridad = prioridad;
      registrar({ cambios });
      if (!simulado) {
        const { error } = await admin.from("leads").update(cambios).eq("id", lead.id);
        if (error) return { ok: false, error: error.message };
      }
      Object.assign(lead, cambios);
      return { ok: true, etapa: lead.etapa, prioridad: lead.prioridad };
    }

    case "buscar_propiedades": {
      const r = await buscarDisponibles(admin, input || {}, ctx.siteUrl);
      for (const p of r.propiedades || []) ctx.propiedadesConocidas.add(p.id);
      registrar({ encontradas: (r.propiedades || []).map((p) => p.titulo) });
      return r.error ? { ok: false, error: r.error } : { ok: true, propiedades: r.propiedades };
    }

    case "asignar_propiedad": {
      const id = input?.propiedad_id;
      if (!lead) return { ok: false, error: "La conversación no tiene lead." };
      if (!id || !ctx.propiedadesConocidas.has(id)) {
        return { ok: false, error: "Solo podés asignar propiedades de la ficha o de buscar_propiedades." };
      }
      registrar({});
      if (!simulado) {
        await admin.from("lead_propiedades").upsert([{ lead_id: lead.id, propiedad_id: id }], { onConflict: "lead_id,propiedad_id", ignoreDuplicates: true });
        if (!lead.propiedad_id) {
          await admin.from("leads").update({ propiedad_id: id }).eq("id", lead.id);
          lead.propiedad_id = id;
        }
      }
      return { ok: true };
    }

    case "proponer_visita": {
      if (!lead) return { ok: false, error: "La conversación no tiene lead." };
      const inicio = parsearFechaLocal(input?.fecha_hora);
      const ahora = Date.now();
      if (!inicio) return { ok: false, error: "Fecha inválida: usá YYYY-MM-DDTHH:MM." };
      if (inicio.getTime() < ahora + 30 * 60 * 1000) return { ok: false, error: "La visita tiene que ser al menos 30 minutos en el futuro." };
      if (inicio.getTime() > ahora + 60 * 24 * 3600 * 1000) return { ok: false, error: "La visita no puede ser a más de 60 días." };
      const fin = new Date(inicio.getTime() + 45 * 60 * 1000);
      const propiedadId = input?.propiedad_id && ctx.propiedadesConocidas.has(input.propiedad_id) ? input.propiedad_id : lead.propiedad_id;
      const fila = {
        lead_id: lead.id,
        agente_id: conv.asignado_a || lead.agente_id || null,
        fecha_inicio: inicio.toISOString(),
        fecha_fin: fin.toISOString(),
        estado: "pendiente",
        notas: [
          "Propuesta por el agente IA — CONFIRMAR con el cliente.",
          propiedadId ? `Propiedad: ${propiedadId}` : null,
          input?.notas ? String(input.notas).slice(0, 300) : null,
        ].filter(Boolean).join("\n"),
      };
      registrar({ visita: fila });
      if (!simulado) {
        const { error } = await admin.from("visitas").insert(fila);
        if (error) return { ok: false, error: error.message };
        if (lead.etapa === "nuevo" || lead.etapa === "calificado") {
          await admin.from("leads").update({ etapa: "visita" }).eq("id", lead.id);
          lead.etapa = "visita";
        }
      }
      return { ok: true, mensaje: "Visita tentativa registrada; un asesor la confirma." };
    }

    case "derivar_a_humano": {
      const motivo = String(input?.motivo || "Sin motivo").slice(0, 300);
      ctx.derivada = motivo;
      registrar({ motivo });
      if (!simulado) {
        await admin.from("conversaciones").update({
          ia_derivada: true,
          ia_motivo_derivacion: motivo,
          ia_pausada_hasta: new Date(Date.now() + PAUSA_DERIVACION_MS).toISOString(),
        }).eq("id", conv.id);
        try { await ctx.avisarDerivacion?.(motivo); } catch (_) { /* best-effort */ }
      }
      return { ok: true, mensaje: "Derivado. Despedite brevemente diciendo que un asesor le escribe en breve." };
    }

    default:
      return { ok: false, error: `Herramienta desconocida: ${nombre}` };
  }
}
