// =====================================================================
// Pipeline único de ingesta de leads — TODOS los canales pasan por acá.
//
// Trazabilidad: cada intento queda en lead_ingesta_log con el payload
// completo. Si un paso falla, el log registra en qué paso y por qué,
// y el payload sirve como dead-letter queue para reprocesar.
//
// Canales actuales: contacto-web (ficha propiedad), contacto-proyecto
// (desarrollos), inbound (webhook genérico: Meta Ads, Google Ads,
// Zapier/Make), mercadolibre (notificaciones).
// =====================================================================

import { notificarNuevoLead } from "./notificar";

const ORIGENES_VALIDOS = new Set([
  "mercadolibre", "whatsapp", "instagram", "infocasas", "gallito",
  "referido", "directo", "web", "meta_ads", "google_ads", "otro",
]);

// Un reintento inmediato para errores transitorios de red/DB.
async function conReintento(fn) {
  try {
    return await fn();
  } catch (_) {
    return await fn();
  }
}

/**
 * Ingesta un lead con trazabilidad completa.
 *
 * @param {object} supabase  Cliente admin (service_role).
 * @param {object} datos
 *   canal        - identificador del punto de entrada (obligatorio)
 *   nombre       - nombre del prospecto (obligatorio)
 *   telefono     - teléfono (obligatorio salvo permitirSinTelefono)
 *   email, mensaje
 *   origen       - valor de ORIGENES (default "web")
 *   propiedad_id, proyecto_id, agente_id
 *   utm          - { source, medium, campaign, term, content, referrer }
 *   contexto     - { ip, user_agent, referer } del request
 *   notasContacto - nota para el alta del contacto
 *   permitirSinTelefono - ej. preguntas de ML (no traen teléfono)
 *
 * @returns {{ ok: true, lead_id, contacto_id, log_id } | { ok: false, error, paso, log_id }}
 */
export async function ingestarLead(supabase, datos) {
  const {
    canal, nombre, telefono, email, mensaje,
    origen = "web", propiedad_id, proyecto_id, agente_id,
    utm, contexto, notasContacto, permitirSinTelefono = false,
  } = datos;

  // 0. Registrar el intento ANTES de validar — nada se pierde.
  const payload = {
    nombre, telefono, email, mensaje, origen,
    propiedad_id, proyecto_id, agente_id, utm,
  };
  const { data: logRow } = await supabase
    .from("lead_ingesta_log")
    .insert({
      canal,
      estado: "recibido",
      payload,
      ip: contexto?.ip || null,
      user_agent: contexto?.user_agent || null,
      referer: contexto?.referer || null,
    })
    .select("id")
    .single();
  const log_id = logRow?.id || null;

  async function marcarLog(campos) {
    if (!log_id) return;
    await supabase
      .from("lead_ingesta_log")
      .update({ ...campos, procesado_at: new Date().toISOString() })
      .eq("id", log_id);
  }

  async function fallar(paso, error) {
    await marcarLog({ estado: "error", paso_fallido: paso, error: String(error) });
    return { ok: false, error: String(error), paso, log_id };
  }

  try {
    // 1. Validación
    if (!nombre?.trim()) {
      await marcarLog({ estado: "invalido", paso_fallido: "validacion", error: "nombre requerido" });
      return { ok: false, error: "Nombre requerido", paso: "validacion", log_id };
    }
    if (!telefono?.trim() && !permitirSinTelefono) {
      await marcarLog({ estado: "invalido", paso_fallido: "validacion", error: "telefono requerido" });
      return { ok: false, error: "Teléfono requerido", paso: "validacion", log_id };
    }
    const origenFinal = ORIGENES_VALIDOS.has(origen) ? origen : "otro";

    // 2. Contacto — upsert por teléfono (o por email si no hay teléfono)
    const telefonoLimpio = telefono?.trim().replace(/\s/g, "") || null;
    let contacto_id = null;

    if (telefonoLimpio) {
      const { data: porTel } = await supabase
        .from("contactos").select("id").eq("telefono", telefonoLimpio).maybeSingle();
      contacto_id = porTel?.id || null;
    }
    if (!contacto_id && email?.trim()) {
      const { data: porMail } = await supabase
        .from("contactos").select("id").eq("email", email.trim()).maybeSingle();
      contacto_id = porMail?.id || null;
    }

    if (!contacto_id) {
      let nuevo, errC;
      try {
        ({ data: nuevo, error: errC } = await conReintento(() =>
          supabase.from("contactos").insert({
            nombre: nombre.trim(),
            telefono: telefonoLimpio,
            email: email?.trim() || null,
            notas: notasContacto || `Ingresado por canal: ${canal}`,
          }).select("id").single()
        ));
      } catch (e) {
        return await fallar("contacto", e?.message || e);
      }
      if (errC) return await fallar("contacto", errC.message);
      contacto_id = nuevo.id;
    }

    // 3. Lead
    const lineasNotas = [
      mensaje?.trim(),
      utm?.campaign ? `Campaña: ${utm.campaign}` : null,
      utm?.medium ? `Medio: ${utm.medium}` : null,
      utm?.source ? `Fuente: ${utm.source}` : null,
      utm?.content ? `Anuncio: ${utm.content}` : null,
      utm?.referrer ? `Referrer: ${utm.referrer}` : null,
      `Canal de ingesta: ${canal}`,
    ].filter(Boolean);

    let lead, errL;
    try {
      ({ data: lead, error: errL } = await conReintento(() =>
        supabase.from("leads").insert({
          contacto_id,
          propiedad_id: propiedad_id || null,
          proyecto_id: proyecto_id || null,
          agente_id: agente_id || null,
          etapa: "nuevo",
          origen: origenFinal,
          prioridad: "media",
          notas: lineasNotas.join("\n"),
        }).select("id").single()
      ));
    } catch (e) {
      return await fallar("lead", e?.message || e);
    }
    if (errL) return await fallar("lead", errL.message);

    // 4. Interacción de trazabilidad (no bloqueante)
    supabase.from("interacciones").insert({
      lead_id: lead.id,
      usuario_id: agente_id || null,
      tipo: "nota",
      descripcion: `Lead ingresado automáticamente (canal: ${canal})`,
      fecha: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.error(`[ingesta:${canal}] interacción:`, error.message);
    });

    // 5. Log OK
    await marcarLog({ estado: "ok", contacto_id, lead_id: lead.id });

    // 6. Aviso instantáneo al agente (best-effort, nunca rompe la ingesta).
    //    El título de la propiedad enriquece el mail si hay propiedad_id.
    let propiedad_titulo = null;
    if (propiedad_id) {
      const { data: prop } = await supabase
        .from("propiedades").select("titulo").eq("id", propiedad_id).maybeSingle();
      propiedad_titulo = prop?.titulo || null;
    }
    await notificarNuevoLead(supabase, {
      lead_id: lead.id,
      agente_id: agente_id || null,
      nombre: nombre.trim(),
      telefono: telefonoLimpio,
      email: email?.trim() || null,
      mensaje: mensaje?.trim() || null,
      propiedad_titulo,
      origen: origenFinal,
      canal,
    });

    return { ok: true, lead_id: lead.id, contacto_id, log_id };
  } catch (err) {
    return await fallar("desconocido", err?.message || err);
  }
}

// Extrae ip/user-agent/referer de un Request de Next.js.
export function contextoDeRequest(request) {
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: request.headers.get("user-agent") || null,
    referer: request.headers.get("referer") || null,
  };
}
