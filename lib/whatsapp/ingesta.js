// =====================================================================
// Ingesta de mensajes de WhatsApp → wa_conversaciones + wa_mensajes.
//
// Idempotente por diseño: el UNIQUE sobre wa_message_id absorbe los
// reintentos de Meta, y los agregados de la conversación se recalculan
// con max()/min() contra lo que ya había, así que un mensaje que llega
// fuera de orden (típico en la sincronización de historial) no rompe
// ni ultimo_mensaje_at ni sin_responder.
//
// Escribe con el cliente admin (service_role); RLS no aplica.
// =====================================================================

/** Devuelve la más reciente de dos fechas ISO (o la que exista). */
function masReciente(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

/** Devuelve la más antigua de dos fechas ISO (o la que exista). */
function masAntigua(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a) < new Date(b) ? a : b;
}

/**
 * Busca el contacto del CRM que corresponde a un número de WhatsApp.
 *
 * Meta entrega el número en E.164 sin '+' ("59899123456") pero en el CRM
 * los teléfonos se cargaron a mano en formatos variados ("099123456",
 * "+598 99 123 456"). Comparar los últimos 8 dígitos cubre los dos casos
 * sin falsos positivos a la escala de esta agenda.
 */
async function buscarContacto(supabase, waId) {
  const ultimos8 = String(waId).slice(-8);
  if (ultimos8.length < 8) return null;

  const { data } = await supabase
    .from("contactos")
    .select("id, telefono")
    .ilike("telefono", `%${ultimos8}%`)
    .limit(2);

  // Si hay más de uno, no adivinamos: queda sin vincular y se resuelve a mano.
  return data?.length === 1 ? data[0].id : null;
}

/**
 * Devuelve la conversación de un wa_id, creándola si no existe.
 * Al crearla intenta vincularla con el contacto del CRM.
 */
async function obtenerOCrearConversacion(supabase, waId, nombrePerfil) {
  const { data: existente } = await supabase
    .from("wa_conversaciones")
    .select("id, nombre_perfil, contacto_id, mensajes_count, primer_mensaje_at, ultimo_mensaje_at, ultimo_entrante_at, ultimo_saliente_at")
    .eq("wa_id", waId)
    .maybeSingle();

  if (existente) return existente;

  const contacto_id = await buscarContacto(supabase, waId);

  const { data: creada, error } = await supabase
    .from("wa_conversaciones")
    .insert({
      wa_id: waId,
      telefono: `+${waId}`,
      nombre_perfil: nombrePerfil || null,
      contacto_id,
    })
    .select("id, nombre_perfil, contacto_id, mensajes_count, primer_mensaje_at, ultimo_mensaje_at, ultimo_entrante_at, ultimo_saliente_at")
    .single();

  if (!error) return creada;

  // Carrera entre dos webhooks simultáneos del mismo número: el UNIQUE
  // sobre wa_id hace que uno falle; ese lee la fila que creó el otro.
  const { data: reintento } = await supabase
    .from("wa_conversaciones")
    .select("id, nombre_perfil, contacto_id, mensajes_count, primer_mensaje_at, ultimo_mensaje_at, ultimo_entrante_at, ultimo_saliente_at")
    .eq("wa_id", waId)
    .maybeSingle();

  if (reintento) return reintento;
  throw new Error(`No se pudo crear la conversación ${waId}: ${error.message}`);
}

/**
 * Guarda un lote de mensajes ya normalizados.
 *
 * @param {object} supabase  Cliente admin (service_role).
 * @param {object[]} mensajes Filas de normalizarWebhook().
 * @returns {{ nuevos: number, duplicados: number, conversaciones: number }}
 */
export async function ingestarMensajes(supabase, mensajes) {
  if (!mensajes?.length) return { nuevos: 0, duplicados: 0, conversaciones: 0 };

  // Agrupar por número: una conversación, un lote de inserts.
  const porNumero = new Map();
  for (const m of mensajes) {
    if (!porNumero.has(m.wa_id)) porNumero.set(m.wa_id, []);
    porNumero.get(m.wa_id).push(m);
  }

  let nuevos = 0;
  let conversaciones = 0;

  for (const [waId, grupo] of porNumero) {
    const nombrePerfil = grupo.find((m) => m.nombre_perfil)?.nombre_perfil || null;
    const conv = await obtenerOCrearConversacion(supabase, waId, nombrePerfil);
    conversaciones++;

    const filas = grupo.map((m) => ({
      wa_message_id: m.wa_message_id,
      conversacion_id: conv.id,
      direccion: m.direccion,
      origen: m.origen,
      ts: m.ts,
      tipo: m.tipo,
      texto: m.texto,
      media_id: m.media_id,
      media_mime: m.media_mime,
      media_filename: m.media_filename,
      respondiendo_a: m.respondiendo_a,
      meta: m.meta,
    }));

    // ignoreDuplicates: los reintentos de Meta se descartan en la base.
    // Devuelve SOLO las filas realmente insertadas.
    const { data: insertados, error } = await supabase
      .from("wa_mensajes")
      .upsert(filas, { onConflict: "wa_message_id", ignoreDuplicates: true })
      .select("ts, direccion");

    if (error) throw new Error(`Insert de mensajes (${waId}): ${error.message}`);
    if (!insertados?.length) continue;

    nuevos += insertados.length;

    // Agregados: siempre contra lo que ya había, nunca pisando con el último
    // que llegó (el historial llega desordenado).
    let primero = conv.primer_mensaje_at;
    let ultimo = conv.ultimo_mensaje_at;
    let ultimoEntrante = conv.ultimo_entrante_at;
    let ultimoSaliente = conv.ultimo_saliente_at;

    for (const fila of insertados) {
      primero = masAntigua(primero, fila.ts);
      ultimo = masReciente(ultimo, fila.ts);
      if (fila.direccion === "entrante") ultimoEntrante = masReciente(ultimoEntrante, fila.ts);
      else ultimoSaliente = masReciente(ultimoSaliente, fila.ts);
    }

    const cambios = {
      primer_mensaje_at: primero,
      ultimo_mensaje_at: ultimo,
      ultimo_entrante_at: ultimoEntrante,
      ultimo_saliente_at: ultimoSaliente,
      mensajes_count: (conv.mensajes_count || 0) + insertados.length,
      updated_at: new Date().toISOString(),
    };
    if (!conv.nombre_perfil && nombrePerfil) cambios.nombre_perfil = nombrePerfil;

    // Si todavía no está vinculada al CRM, reintentar: el contacto puede
    // haberse creado después de la primera conversación.
    if (!conv.contacto_id) {
      const contacto_id = await buscarContacto(supabase, waId);
      if (contacto_id) cambios.contacto_id = contacto_id;
    }

    const { error: errUpd } = await supabase
      .from("wa_conversaciones")
      .update(cambios)
      .eq("id", conv.id);

    if (errUpd) throw new Error(`Update de conversación (${waId}): ${errUpd.message}`);
  }

  return { nuevos, duplicados: mensajes.length - nuevos, conversaciones };
}

/**
 * Aplica estados de entrega (sent/delivered/read/failed).
 * Solo se llama si WHATSAPP_STORE_STATUSES=true.
 */
export async function aplicarEstados(supabase, estados) {
  if (!estados?.length) return 0;
  let aplicados = 0;
  for (const e of estados) {
    const { error } = await supabase
      .from("wa_mensajes")
      .update({ estado: e.estado })
      .eq("wa_message_id", e.wa_message_id);
    if (!error) aplicados++;
  }
  return aplicados;
}
