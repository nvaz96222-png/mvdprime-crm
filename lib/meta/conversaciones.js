// =====================================================================
// Helpers de conversaciones y mensajes (service_role).
//
// - upsertConversacion: una conversación por (contacto, canal).
// - guardarMensaje: insert idempotente por meta_message_id; si es nuevo,
//   actualiza el resumen de la conversación (último mensaje, no leídos,
//   ventana de 24h).
// - actualizarEstado: marca entregado/leído/fallido por meta_message_id.
//
// Todas asumen un cliente admin (service_role) que bypassa RLS.
// =====================================================================

/**
 * Busca la conversación del contacto en ese canal; si no existe, la crea.
 * @returns {object|null} fila de conversaciones
 */
export async function upsertConversacion(supabase, { contacto_id, lead_id, canal, wa_id, instagram_id, messenger_id }) {
  const { data: existente } = await supabase
    .from("conversaciones")
    .select("*")
    .eq("contacto_id", contacto_id)
    .eq("canal", canal)
    .maybeSingle();

  if (existente) {
    // Completar identificadores/lead si llegaron ahora y faltaban.
    const parche = {};
    if (lead_id && !existente.lead_id) parche.lead_id = lead_id;
    if (wa_id && !existente.wa_id) parche.wa_id = wa_id;
    if (instagram_id && !existente.instagram_id) parche.instagram_id = instagram_id;
    if (messenger_id && !existente.messenger_id) parche.messenger_id = messenger_id;
    if (Object.keys(parche).length) {
      const { data } = await supabase
        .from("conversaciones").update(parche).eq("id", existente.id).select("*").single();
      return data || existente;
    }
    return existente;
  }

  const { data: nueva, error } = await supabase
    .from("conversaciones")
    .insert({ contacto_id, lead_id: lead_id || null, canal, wa_id: wa_id || null, instagram_id: instagram_id || null, messenger_id: messenger_id || null })
    .select("*")
    .single();
  if (error) {
    console.error("[meta:conversaciones] crear:", error.message);
    return null;
  }
  return nueva;
}

/**
 * Guarda un mensaje de forma idempotente (ON CONFLICT meta_message_id DO NOTHING).
 * Si es nuevo, actualiza el resumen de la conversación.
 * @returns {{ ok:boolean, duplicado:boolean, mensaje_id?:string }}
 */
export async function guardarMensaje(supabase, conversacion, msg) {
  const fila = {
    conversacion_id: conversacion.id,
    contacto_id: conversacion.contacto_id,
    lead_id: conversacion.lead_id || null,
    canal: msg.canal,
    direccion: msg.direccion,
    autor: msg.autor,
    usuario_id: msg.usuario_id || null,
    meta_message_id: msg.meta_message_id || null,
    tipo: msg.tipo || "texto",
    texto: msg.texto || null,
    media: msg.media || null,
    estado: msg.estado || null,
    payload: msg.payload || null,
  };

  // ignoreDuplicates → INSERT ... ON CONFLICT (meta_message_id) DO NOTHING.
  // Si devuelve fila, fue inserción nueva; si viene vacío, era duplicado.
  const { data, error } = await supabase
    .from("mensajes")
    .upsert([fila], { onConflict: "meta_message_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[meta:conversaciones] guardar mensaje:", error.message);
    return { ok: false, duplicado: false };
  }
  const insertado = Array.isArray(data) && data.length > 0;
  if (!insertado) return { ok: true, duplicado: true };

  // Actualizar el resumen de la conversación (solo si el mensaje es nuevo).
  const ahora = new Date().toISOString();
  const parche = {
    ultimo_mensaje_at: ahora,
    ultimo_mensaje_texto: (msg.texto || `[${fila.tipo}]`).slice(0, 500),
  };
  if (msg.direccion === "entrante") {
    parche.ultimo_entrante_at = ahora;
    parche.no_leidos = (conversacion.no_leidos || 0) + 1;
  }
  await supabase.from("conversaciones").update(parche).eq("id", conversacion.id);

  return { ok: true, duplicado: false, mensaje_id: data[0].id };
}

/**
 * Actualiza el estado de entrega de un mensaje saliente por meta_message_id.
 * Respeta un orden lógico (no "baja" de leído a entregado).
 */
export async function actualizarEstado(supabase, meta_message_id, estado) {
  if (!meta_message_id || !estado) return;
  const { error } = await supabase
    .from("mensajes")
    .update({ estado })
    .eq("meta_message_id", meta_message_id);
  if (error) console.error("[meta:conversaciones] estado:", error.message);
}
