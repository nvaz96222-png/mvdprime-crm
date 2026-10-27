// =====================================================================
// Procesador de eventos de los webhooks de Meta.
//
// Un dispatcher por tipo de `object`:
//   · page                         → Lead Ads (leadgen)
//   · whatsapp_business_account    → mensajes / estados / ecos (coexistencia)
//   · instagram                    → DMs
//
// Diseño: nunca lanza hacia afuera. Cada entry se procesa aislada; si una
// falla, se registra en lead_ingesta_log (canal "meta") y se sigue, para
// que el webhook SIEMPRE pueda responder 200 (si no, Meta lo deshabilita).
// =====================================================================

import { ingestarLead } from "@/lib/leads/ingesta";
import { obtenerLead, obtenerNombreInstagram, mapearFieldData } from "./graph";
import { upsertConversacion, guardarMensaje, actualizarEstado } from "./conversaciones";

const UUID_RE = /\/p\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const ESTADO_MAP = { sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido" };

function tipoWhatsApp(t) {
  return ["text", "image", "audio", "video", "document", "location"].includes(t)
    ? { text: "texto", image: "imagen", audio: "audio", video: "video", document: "documento", location: "ubicacion" }[t]
    : "otro";
}

async function logError(supabase, payload, error, estado = "error") {
  try {
    await supabase.from("lead_ingesta_log").insert({
      canal: "meta", estado, error: String(error?.message || error),
      payload, procesado_at: new Date().toISOString(),
    });
  } catch (_) { /* nada que hacer */ }
}

// Asigna propiedad: anuncio (meta_anuncios) → link /p/<uuid> en el texto → nada.
async function resolverPropiedad(supabase, { ad_id, texto }) {
  if (ad_id) {
    const { data } = await supabase
      .from("meta_anuncios").select("propiedad_id, proyecto_id, nombre").eq("ad_id", ad_id).maybeSingle();
    if (data) return { propiedad_id: data.propiedad_id || null, proyecto_id: data.proyecto_id || null };
  }
  if (texto) {
    const m = texto.match(UUID_RE);
    if (m) {
      const { data } = await supabase.from("propiedades").select("id").eq("id", m[1]).maybeSingle();
      if (data) return { propiedad_id: data.id, proyecto_id: null };
    }
  }
  return { propiedad_id: null, proyecto_id: null };
}

function textoDeMensajeWhatsApp(msg) {
  if (msg.type === "text") return msg.text?.body || null;
  if (msg.type === "button") return msg.button?.text || null;
  if (msg.type === "interactive") {
    return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || null;
  }
  const cap = msg[msg.type]?.caption;
  return cap || null;
}

// ─── WhatsApp ────────────────────────────────────────────────────────
async function procesarWhatsApp(supabase, value, campo) {
  // Ecos de la app del celular (coexistencia): salientes, autor "app".
  if (campo === "smb_message_echoes") {
    for (const eco of value.message_echoes || []) {
      const waCliente = eco.to;
      const { data: contacto } = await supabase
        .from("contactos").select("id").eq("telefono", waCliente).maybeSingle();
      if (!contacto) continue; // sin conversación previa, no hay a quién asociarlo
      const conv = await upsertConversacion(supabase, { contacto_id: contacto.id, canal: "whatsapp", wa_id: waCliente });
      if (!conv) continue;
      await guardarMensaje(supabase, conv, {
        canal: "whatsapp", direccion: "saliente", autor: "app",
        meta_message_id: eco.id, tipo: tipoWhatsApp(eco.type),
        texto: textoDeMensajeWhatsApp(eco), payload: eco,
      });
    }
    return;
  }

  // Estados de entrega de mensajes salientes.
  for (const st of value.statuses || []) {
    await actualizarEstado(supabase, st.id, ESTADO_MAP[st.status] || null);
  }

  // Mensajes entrantes del cliente.
  const perfil = {};
  for (const c of value.contacts || []) perfil[c.wa_id] = c.profile?.name || null;

  for (const msg of value.messages || []) {
    const waId = msg.from;
    const nombre = perfil[waId] || waId;
    const texto = textoDeMensajeWhatsApp(msg);

    // Referral = vino de un anuncio Click-to-WhatsApp (solo el primer mensaje).
    const ref = msg.referral || null;
    const adId = ref?.source_id || ref?.ad_id || null;
    const ctwaClid = ref?.ctwa_clid || null;
    const { propiedad_id, proyecto_id } = await resolverPropiedad(supabase, { ad_id: adId, texto });

    const res = await ingestarLead(supabase, {
      canal: "meta",
      nombre,
      telefono: waId,
      mensaje: ref ? `Mensaje desde anuncio${texto ? `: ${texto}` : ""}` : texto,
      origen: ref ? "meta_ads" : "whatsapp",
      propiedad_id, proyecto_id,
      reutilizarLeadAbierto: true,
      meta_ad_id: adId, ctwa_clid: ctwaClid,
      meta_campaign: ref?.headline || null,
      notasContacto: "Contacto por WhatsApp",
    });
    if (!res.ok) { await logError(supabase, { msg }, res.error); continue; }

    const conv = await upsertConversacion(supabase, {
      contacto_id: res.contacto_id, lead_id: res.lead_id, canal: "whatsapp", wa_id: waId,
    });
    if (!conv) continue;
    await guardarMensaje(supabase, conv, {
      canal: "whatsapp", direccion: "entrante", autor: "cliente",
      meta_message_id: msg.id, tipo: tipoWhatsApp(msg.type),
      texto, media: msg.type !== "text" ? msg[msg.type] || null : null, payload: msg,
    });
  }
}

// ─── Instagram ───────────────────────────────────────────────────────
async function procesarInstagram(supabase, messaging) {
  const esEco = !!messaging.message?.is_echo;
  // En entrantes el cliente es el sender; en ecos (salientes), el recipient.
  const igsid = esEco ? messaging.recipient?.id : messaging.sender?.id;
  if (!igsid) return;

  const texto = messaging.message?.text || null;
  const mid = messaging.message?.mid || null;

  if (esEco) {
    const { data: contacto } = await supabase
      .from("contactos").select("id").eq("instagram_id", igsid).maybeSingle();
    if (!contacto) return;
    const conv = await upsertConversacion(supabase, { contacto_id: contacto.id, canal: "instagram", instagram_id: igsid });
    if (!conv) return;
    await guardarMensaje(supabase, conv, {
      canal: "instagram", direccion: "saliente", autor: "app",
      meta_message_id: mid, tipo: texto ? "texto" : "otro", texto, payload: messaging,
    });
    return;
  }

  const ref = messaging.referral || messaging.postback?.referral || null;
  const adId = ref?.ad_id || null;
  const { propiedad_id, proyecto_id } = await resolverPropiedad(supabase, { ad_id: adId, texto });
  const nombre = (await obtenerNombreInstagram(igsid)) || `Instagram ${igsid.slice(-6)}`;

  const res = await ingestarLead(supabase, {
    canal: "meta",
    nombre,
    mensaje: texto,
    origen: ref ? "meta_ads" : "instagram",
    propiedad_id, proyecto_id,
    permitirSinTelefono: true,
    instagram_id: igsid,
    reutilizarLeadAbierto: true,
    meta_ad_id: adId,
    notasContacto: "Contacto por Instagram",
  });
  if (!res.ok) { await logError(supabase, { messaging }, res.error); return; }

  const conv = await upsertConversacion(supabase, {
    contacto_id: res.contacto_id, lead_id: res.lead_id, canal: "instagram", instagram_id: igsid,
  });
  if (!conv) return;
  await guardarMensaje(supabase, conv, {
    canal: "instagram", direccion: "entrante", autor: "cliente",
    meta_message_id: mid, tipo: texto ? "texto" : "otro",
    texto, media: messaging.message?.attachments || null, payload: messaging,
  });
}

// ─── Lead Ads ────────────────────────────────────────────────────────
async function procesarLeadgen(supabase, value) {
  const leadgenId = value.leadgen_id;
  if (!leadgenId) return;

  // Idempotencia: si ya existe un lead con este meta_lead_id, no duplicar.
  const { data: existente } = await supabase
    .from("leads").select("id").eq("meta_lead_id", leadgenId).maybeSingle();
  if (existente) return;

  const lead = await obtenerLead(leadgenId);
  if (!lead) { await logError(supabase, { leadgenId, value }, "no se pudo leer el lead de la Graph API"); return; }

  const { nombre, telefono, email, extra } = mapearFieldData(lead.field_data);
  const adId = lead.ad_id || value.ad_id || null;
  const { propiedad_id, proyecto_id } = await resolverPropiedad(supabase, { ad_id: adId, texto: null });

  const res = await ingestarLead(supabase, {
    canal: "meta",
    nombre: nombre || "Lead de Meta",
    telefono,
    email,
    mensaje: extra.length ? extra.join("\n") : null,
    origen: "meta_ads",
    propiedad_id, proyecto_id,
    permitirSinTelefono: true, // algunos formularios no piden teléfono
    meta_ad_id: adId,
    meta_campaign: lead.campaign_name || null,
    meta_lead_id: leadgenId,
    notasContacto: "Lead de formulario instantáneo (Meta)",
  });
  if (!res.ok) await logError(supabase, { leadgenId }, res.error);
}

/**
 * Punto de entrada: procesa el body ya parseado de un webhook de Meta.
 * Siempre resuelve (no lanza).
 */
export async function procesarEvento(supabase, body) {
  const object = body?.object;
  for (const entry of body?.entry || []) {
    try {
      if (object === "page") {
        for (const ch of entry.changes || []) {
          if (ch.field === "leadgen") await procesarLeadgen(supabase, ch.value || {});
        }
      } else if (object === "whatsapp_business_account") {
        for (const ch of entry.changes || []) {
          await procesarWhatsApp(supabase, ch.value || {}, ch.field);
        }
      } else if (object === "instagram") {
        for (const m of entry.messaging || []) {
          await procesarInstagram(supabase, m);
        }
      }
    } catch (err) {
      await logError(supabase, { object, entry }, err);
    }
  }
}
