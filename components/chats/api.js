// =====================================================================
// Acceso a datos de la bandeja desde el navegador.
//
// Lecturas y Realtime: cliente de Supabase con la sesión del usuario (el
// RLS decide qué conversaciones ve). Escrituras sobre conversaciones,
// mensajes y lead_propiedades: API routes del CRM (solo service_role
// escribe esas tablas). Las etapas/prioridad del lead se editan directo
// (el RLS de leads lo permite al admin y al agente asignado).
//
// Se expone como objeto para poder inyectar uno simulado (pruebas/preview).
// =====================================================================

export const SELECT_CONVERSACION =
  "id, canal, wa_id, instagram_id, messenger_id, contacto_id, lead_id, ultimo_mensaje_at, " +
  "ultimo_mensaje_texto, ultimo_entrante_at, no_leidos, asignado_a, ia_activa, created_at, " +
  "contacto:contactos(id, nombre, telefono, email), " +
  "lead:leads(id, etapa, prioridad, origen, propiedad_id, agente_id, meta_ad_id, meta_campaign, created_at, " +
  "intereses:lead_propiedades(propiedad_id))";

const POR_PAGINA = 60;

async function postJSON(url, body, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error || `Error ${res.status}`);
    e.codigo = data?.codigo;
    e.status = res.status;
    throw e;
  }
  return data;
}

export function crearApiChats(supabase) {
  return {
    /** Últimos mensajes (o los anteriores a `antesDe`), en orden cronológico. */
    async cargarMensajes(conversacionId, antesDe = null) {
      let q = supabase
        .from("mensajes")
        .select("id, conversacion_id, direccion, autor, usuario_id, meta_message_id, tipo, texto, media, estado, error, created_at")
        .eq("conversacion_id", conversacionId)
        .order("created_at", { ascending: false })
        .limit(POR_PAGINA);
      if (antesDe) q = q.lt("created_at", antesDe);
      const { data, error } = await q;
      if (error) throw error;
      return { mensajes: (data || []).reverse(), hayMas: (data || []).length === POR_PAGINA };
    },

    /** Una conversación con sus datos de contacto y lead (para altas por Realtime). */
    async cargarConversacion(id) {
      const { data } = await supabase.from("conversaciones").select(SELECT_CONVERSACION).eq("id", id).maybeSingle();
      return data || null;
    },

    enviar(conversacionId, texto) {
      return postJSON("/api/chats/enviar", { conversacion_id: conversacionId, texto });
    },

    marcarLeida(conversacionId) {
      return postJSON(`/api/chats/${conversacionId}/leer`).catch(() => null);
    },

    asignar(conversacionId, usuarioId) {
      return postJSON(`/api/chats/${conversacionId}/asignar`, { usuario_id: usuarioId });
    },

    cambiarInteres(leadId, propiedadId, quitar = false) {
      return postJSON(`/api/leads/${leadId}/propiedades`, { propiedad_id: propiedadId }, quitar ? "DELETE" : "POST");
    },

    async actualizarLead(leadId, cambios) {
      const { error } = await supabase.from("leads").update(cambios).eq("id", leadId);
      if (error) throw error;
    },

    /**
     * Suscripción en tiempo real. Devuelve una función para cancelarla.
     * onConversacion(evento, fila) · onMensaje(evento, fila)
     */
    suscribir({ onConversacion, onMensaje }) {
      const canal = supabase
        .channel(`bandeja-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" },
          (p) => onConversacion?.(p.eventType, p.new && Object.keys(p.new).length ? p.new : p.old))
        .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" },
          (p) => onMensaje?.(p.eventType, p.new && Object.keys(p.new).length ? p.new : p.old))
        .subscribe();
      return () => supabase.removeChannel(canal);
    },
  };
}
