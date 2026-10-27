// =====================================================================
// Pipeline único de ingesta de leads — TODOS los canales pasan por acá.
//
// Trazabilidad: cada intento queda en lead_ingesta_log con el payload
// completo. Si un paso falla, el log registra en qué paso y por qué,
// y el payload sirve como dead-letter queue para reprocesar.
//
// Canales actuales: contacto-web (ficha propiedad), contacto-proyecto
// (desarrollos), inbound (webhook genérico: Google Ads, Zapier/Make),
// mercadolibre (notificaciones), meta (WhatsApp / Instagram / Lead Ads).
// =====================================================================

import { notificarNuevoLead } from "./notificar";

const ORIGENES_VALIDOS = new Set([
  "mercadolibre", "whatsapp", "instagram", "infocasas", "gallito",
  "referido", "directo", "web", "meta_ads", "google_ads", "otro",
]);

// Un lead se considera "abierto" si todavía está en el pipeline activo.
const ETAPAS_CERRADAS = new Set(["cierre", "perdido"]);

// Un reintento inmediato para errores transitorios de red/DB.
async function conReintento(fn) {
  try {
    return await fn();
  } catch (_) {
    return await fn();
  }
}

// Agrega (idempotente) una propiedad de interés a un lead (tabla N:N).
async function agregarPropiedadInteres(supabase, lead_id, propiedad_id) {
  if (!lead_id || !propiedad_id) return;
  const { error } = await supabase
    .from("lead_propiedades")
    .upsert([{ lead_id, propiedad_id }], { onConflict: "lead_id,propiedad_id", ignoreDuplicates: true });
  if (error) console.error("[ingesta] lead_propiedades:", error.message);
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
 *   permitirSinTelefono - ej. preguntas de ML / DMs de Instagram (sin teléfono)
 *   instagram_id - IGSID (dedupe de contacto cuando no hay teléfono)
 *   reutilizarLeadAbierto - si el contacto ya tiene un lead abierto, usarlo
 *                           en vez de crear otro (chats de WhatsApp/Instagram)
 *   meta_ad_id, meta_campaign, ctwa_clid, meta_lead_id - atribución de Meta
 *
 * @returns {{ ok:true, lead_id, contacto_id, log_id, reutilizado:boolean } |
 *           { ok:false, error, paso, log_id }}
 */
export async function ingestarLead(supabase, datos) {
  const {
    canal, nombre, telefono, email, mensaje,
    origen = "web", propiedad_id, proyecto_id, agente_id,
    utm, contexto, notasContacto, permitirSinTelefono = false,
    instagram_id = null, reutilizarLeadAbierto = false,
    meta_ad_id = null, meta_campaign = null, ctwa_clid = null, meta_lead_id = null,
  } = datos;

  // 0. Registrar el intento ANTES de validar — nada se pierde.
  const payload = {
    nombre, telefono, email, mensaje, origen,
    propiedad_id, proyecto_id, agente_id, utm,
    instagram_id, meta_ad_id, meta_campaign, ctwa_clid, meta_lead_id,
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
    // 1. Validación — nombre siempre; teléfono salvo que haya instagram_id o permiso.
    if (!nombre?.trim()) {
      await marcarLog({ estado: "invalido", paso_fallido: "validacion", error: "nombre requerido" });
      return { ok: false, error: "Nombre requerido", paso: "validacion", log_id };
    }
    const sinTelefonoOk = permitirSinTelefono || !!instagram_id;
    if (!telefono?.trim() && !sinTelefonoOk) {
      await marcarLog({ estado: "invalido", paso_fallido: "validacion", error: "telefono requerido" });
      return { ok: false, error: "Teléfono requerido", paso: "validacion", log_id };
    }
    const origenFinal = ORIGENES_VALIDOS.has(origen) ? origen : "otro";

    // 2. Contacto — dedupe por teléfono → email → instagram_id.
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
    if (!contacto_id && instagram_id) {
      const { data: porIg } = await supabase
        .from("contactos").select("id").eq("instagram_id", instagram_id).maybeSingle();
      contacto_id = porIg?.id || null;
    }

    if (!contacto_id) {
      let nuevo, errC;
      try {
        ({ data: nuevo, error: errC } = await conReintento(() =>
          supabase.from("contactos").insert({
            nombre: nombre.trim(),
            telefono: telefonoLimpio,
            email: email?.trim() || null,
            instagram_id: instagram_id || null,
            notas: notasContacto || `Ingresado por canal: ${canal}`,
          }).select("id").single()
        ));
      } catch (e) {
        return await fallar("contacto", e?.message || e);
      }
      if (errC) return await fallar("contacto", errC.message);
      contacto_id = nuevo.id;
    } else if (instagram_id) {
      // Completar el IGSID si el contacto ya existía sin él (no pisa nada).
      await supabase.from("contactos")
        .update({ instagram_id })
        .eq("id", contacto_id)
        .is("instagram_id", null);
    }

    // 2b. Reutilizar lead abierto (chats): no crear uno nuevo por cada mensaje.
    if (reutilizarLeadAbierto) {
      const { data: abiertos } = await supabase
        .from("leads")
        .select("id, etapa")
        .eq("contacto_id", contacto_id)
        .order("created_at", { ascending: false })
        .limit(5);
      const abierto = (abiertos || []).find((l) => !ETAPAS_CERRADAS.has(l.etapa));
      if (abierto) {
        // Sumar la propiedad de interés y enriquecer atribución si faltaba.
        await agregarPropiedadInteres(supabase, abierto.id, propiedad_id);
        const parche = {};
        if (meta_ad_id) parche.meta_ad_id = meta_ad_id;
        if (meta_campaign) parche.meta_campaign = meta_campaign;
        if (ctwa_clid) parche.ctwa_clid = ctwa_clid;
        if (Object.keys(parche).length) {
          await supabase.from("leads").update(parche).eq("id", abierto.id);
        }
        await marcarLog({ estado: "ok", contacto_id, lead_id: abierto.id });
        return { ok: true, lead_id: abierto.id, contacto_id, log_id, reutilizado: true };
      }
    }

    // 3. Lead nuevo
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
          meta_ad_id: meta_ad_id || null,
          meta_campaign: meta_campaign || null,
          ctwa_clid: ctwa_clid || null,
          meta_lead_id: meta_lead_id || null,
        }).select("id").single()
      ));
    } catch (e) {
      return await fallar("lead", e?.message || e);
    }
    if (errL) return await fallar("lead", errL.message);

    // 3b. Propiedad de interés en la tabla N:N (además de leads.propiedad_id).
    await agregarPropiedadInteres(supabase, lead.id, propiedad_id);

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

    return { ok: true, lead_id: lead.id, contacto_id, log_id, reutilizado: false };
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
