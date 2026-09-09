// =====================================================================
// Recuperación y búsqueda sobre las conversaciones guardadas.
//
// Esta capa es la que hace barato el sistema: filtra en Postgres y le
// entrega a Claude solo los mensajes que pueden responder la pregunta,
// nunca los 90 días completos.
//
// Todo lo que se pueda contestar con datos estructurados (quién no
// recibió respuesta, cuántas consultas hubo, quién escribió) se contesta
// acá, sin gastar un token.
// =====================================================================

const CONFIG_FTS = "es_unaccent"; // spanish + unaccent (ver la migración)

const CAMPOS_MENSAJE = "id, wa_message_id, ts, direccion, origen, tipo, texto, media_mime, respondiendo_a, conversacion_id";
const CAMPOS_CONVERSACION =
  "id, wa_id, telefono, nombre_perfil, contacto_id, sin_responder, mensajes_count, primer_mensaje_at, ultimo_mensaje_at, ultimo_entrante_at, ultimo_saliente_at";

/**
 * Convierte términos en lenguaje natural a una tsquery.
 *
 * Cada término se une con AND entre sus palabras y con OR entre términos:
 *   ["financiación", "plan de pago"] → 'financiación' | ('plan' & 'de' & 'pago')
 *
 * El OR entre términos es lo que le da alcance semántico a la búsqueda: el
 * planner expande "financiación" a sus sinónimos antes de llegar acá, que es
 * justamente lo que comprarían los embeddings.
 */
export function construirTsquery(terminos) {
  const partes = [];

  for (const termino of terminos || []) {
    const palabras = String(termino)
      .toLowerCase()
      // Fuera todo lo que tenga significado en tsquery.
      .replace(/[&|!():*'"<>\\]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 1);

    if (!palabras.length) continue;
    partes.push(palabras.length === 1 ? palabras[0] : `(${palabras.join(" & ")})`);
  }

  return partes.join(" | ");
}

/**
 * Conversaciones que matchean criterios estructurales (sin tocar el texto).
 * Sirve tanto para la bandeja del CRM como para acotar una búsqueda.
 */
export async function buscarConversaciones(supabase, filtros = {}) {
  const { contacto, waIds, sinResponder, desde, hasta, limite = 100 } = filtros;

  let q = supabase
    .from("wa_conversaciones")
    .select(CAMPOS_CONVERSACION)
    .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false })
    .limit(limite);

  if (waIds?.length) q = q.in("wa_id", waIds);
  if (sinResponder === true) q = q.eq("sin_responder", true);
  if (sinResponder === false) q = q.eq("sin_responder", false);
  if (desde) q = q.gte("ultimo_mensaje_at", desde);
  if (hasta) q = q.lte("ultimo_mensaje_at", hasta);
  if (contacto) {
    const t = contacto.replace(/[%,]/g, "");
    q = q.or(`nombre_perfil.ilike.%${t}%,telefono.ilike.%${t}%,wa_id.ilike.%${t}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`buscarConversaciones: ${error.message}`);
  return data || [];
}

/**
 * Mensajes que matchean fecha / dirección / tipo / texto completo.
 * Devuelve los "hits": los mensajes que dispararon la coincidencia.
 */
export async function buscarMensajes(supabase, filtros = {}) {
  const {
    desde,
    hasta,
    terminos,
    direccion,
    tipos,
    conversacionIds,
    limite = 200,
  } = filtros;

  let q = supabase
    .from("wa_mensajes")
    .select(CAMPOS_MENSAJE)
    .order("ts", { ascending: false })
    .limit(limite);

  if (desde) q = q.gte("ts", desde);
  if (hasta) q = q.lte("ts", hasta);
  if (direccion && direccion !== "ambas") q = q.eq("direccion", direccion);
  if (tipos?.length) q = q.in("tipo", tipos);
  if (conversacionIds?.length) q = q.in("conversacion_id", conversacionIds);

  const tsquery = construirTsquery(terminos);
  if (tsquery) q = q.textSearch("texto_tsv", tsquery, { config: CONFIG_FTS });

  const { data, error } = await q;
  if (error) throw new Error(`buscarMensajes: ${error.message}`);
  return data || [];
}

/**
 * Reconstruye una conversación en orden cronológico dentro de una ventana.
 */
export async function obtenerConversacion(supabase, conversacionId, opciones = {}) {
  const { desde, hasta, limite = 60 } = opciones;

  let q = supabase
    .from("wa_mensajes")
    .select(CAMPOS_MENSAJE)
    .eq("conversacion_id", conversacionId)
    // Se traen los más recientes y después se ordenan ascendente: si hay que
    // recortar, se recorta lo viejo, no lo que acaba de pasar.
    .order("ts", { ascending: false })
    .limit(limite);

  if (desde) q = q.gte("ts", desde);
  if (hasta) q = q.lte("ts", hasta);

  const { data, error } = await q;
  if (error) throw new Error(`obtenerConversacion: ${error.message}`);
  return (data || []).sort((a, b) => new Date(a.ts) - new Date(b.ts));
}

/**
 * Búsqueda completa: encuentra los mensajes relevantes y los devuelve
 * agrupados por conversación, con su contexto alrededor.
 *
 * @returns {{ conversaciones: Array, totalHits: number }}
 */
export async function recuperarContexto(supabase, filtros = {}) {
  const {
    desde,
    hasta,
    terminos,
    contacto,
    direccion,
    sinResponder,
    maxConversaciones = 25,
    mensajesPorConversacion = 30,
  } = filtros;

  // 1. Acotar por conversación cuando el filtro es estructural.
  let conversacionIds = null;
  let conversacionesBase = null;

  if (contacto || sinResponder === true) {
    conversacionesBase = await buscarConversaciones(supabase, {
      contacto,
      sinResponder: sinResponder === true ? true : undefined,
      limite: maxConversaciones * 4,
    });
    conversacionIds = conversacionesBase.map((c) => c.id);
    if (!conversacionIds.length) return { conversaciones: [], totalHits: 0 };
  }

  // 2. Buscar los mensajes relevantes.
  const hits = await buscarMensajes(supabase, {
    desde,
    hasta,
    terminos,
    direccion,
    conversacionIds,
    limite: maxConversaciones * 8,
  });

  // 3. Agrupar por conversación, priorizando las que más matchearon.
  const porConversacion = new Map();
  for (const hit of hits) {
    if (!porConversacion.has(hit.conversacion_id)) {
      porConversacion.set(hit.conversacion_id, []);
    }
    porConversacion.get(hit.conversacion_id).push(hit);
  }

  const idsOrdenados = [...porConversacion.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxConversaciones)
    .map(([id]) => id);

  if (!idsOrdenados.length) return { conversaciones: [], totalHits: hits.length };

  // 4. Traer los datos de cada conversación y su hilo completo.
  const { data: metadatos, error } = await supabase
    .from("wa_conversaciones")
    .select(CAMPOS_CONVERSACION)
    .in("id", idsOrdenados);
  if (error) throw new Error(`recuperarContexto: ${error.message}`);

  const conversaciones = [];
  for (const meta of metadatos || []) {
    const mensajes = await obtenerConversacion(supabase, meta.id, {
      desde,
      hasta,
      limite: mensajesPorConversacion,
    });
    conversaciones.push({
      ...meta,
      hits: porConversacion.get(meta.id)?.length || 0,
      mensajes,
    });
  }

  conversaciones.sort((a, b) => b.hits - a.hits);
  return { conversaciones, totalHits: hits.length };
}

// ── Agregados: se responden con SQL, sin pasar por Claude ─────────────

/**
 * Métricas de un período. Cubre "cuántas consultas recibimos", "cuántos
 * clientes escribieron", "cuántos siguen sin respuesta".
 */
export async function metricas(supabase, { desde, hasta } = {}) {
  const contar = async (tabla, aplicar) => {
    let q = supabase.from(tabla).select("*", { count: "exact", head: true });
    q = aplicar(q);
    const { count, error } = await q;
    if (error) throw new Error(`metricas(${tabla}): ${error.message}`);
    return count || 0;
  };

  const rango = (q, columna) => {
    if (desde) q = q.gte(columna, desde);
    if (hasta) q = q.lte(columna, hasta);
    return q;
  };

  const [entrantes, salientes, conversaciones, sinResponder] = await Promise.all([
    contar("wa_mensajes", (q) => rango(q.eq("direccion", "entrante"), "ts")),
    contar("wa_mensajes", (q) => rango(q.eq("direccion", "saliente"), "ts")),
    contar("wa_conversaciones", (q) => rango(q, "ultimo_mensaje_at")),
    contar("wa_conversaciones", (q) => rango(q.eq("sin_responder", true), "ultimo_entrante_at")),
  ]);

  return { entrantes, salientes, conversaciones, sinResponder, desde: desde || null, hasta: hasta || null };
}

// ── Render del contexto para Claude ───────────────────────────────────

const CHARS_POR_TOKEN = 4; // estimación conservadora para español

function etiqueta(conversacion) {
  return (
    conversacion.nombre_perfil ||
    conversacion.telefono ||
    `+${conversacion.wa_id}`
  );
}

function fechaCorta(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Montevideo",
  });
}

/**
 * Convierte las conversaciones recuperadas en texto plano compacto,
 * respetando un presupuesto de tokens explícito.
 *
 * El presupuesto es un parámetro del sistema, no una consecuencia del
 * volumen de datos: si hay más conversaciones de las que entran, se
 * incluyen las más relevantes y se avisa cuántas quedaron afuera.
 */
export function renderizarContexto(conversaciones, presupuestoTokens) {
  const limiteChars = presupuestoTokens * CHARS_POR_TOKEN;
  const bloques = [];
  let usados = 0;
  let incluidas = 0;

  for (const c of conversaciones) {
    const encabezado = [
      `### ${etiqueta(c)} (+${c.wa_id})`,
      c.contacto_id ? `contacto CRM: ${c.contacto_id}` : "sin contacto en el CRM",
      c.sin_responder ? "ESTADO: escribió y no recibió respuesta" : "ESTADO: respondida",
      `mensajes guardados: ${c.mensajes_count}`,
    ].join(" · ");

    const lineas = c.mensajes.map((m) => {
      const quien = m.direccion === "entrante" ? "Cliente" : "Empresa";
      const cuerpo =
        m.texto || (m.media_mime ? `[${m.tipo}: ${m.media_mime}]` : `[${m.tipo}]`);
      return `[${fechaCorta(m.ts)}] ${quien}: ${cuerpo}`;
    });

    const bloque = `${encabezado}\n${lineas.join("\n")}`;
    if (usados + bloque.length > limiteChars && incluidas > 0) break;

    bloques.push(bloque);
    usados += bloque.length;
    incluidas++;
  }

  const omitidas = conversaciones.length - incluidas;
  const aviso = omitidas > 0 ? `\n\n(Se omitieron ${omitidas} conversaciones menos relevantes por límite de contexto.)` : "";

  return {
    texto: bloques.join("\n\n") + aviso,
    incluidas,
    omitidas,
    tokensEstimados: Math.round(usados / CHARS_POR_TOKEN),
  };
}
