// =====================================================================
// Lógica server-side de la bandeja de chats (Fase 2a).
//
// Las API routes validan la sesión, obtienen el perfil (usuarios) y llaman
// a estas funciones con el cliente ADMIN (conversaciones/mensajes solo se
// escriben con service_role). Los permisos replican la regla de los leads
// (rls_fix.sql): el admin ve todo; el agente, lo asignado a él.
//
// Cada función devuelve { ok:true, ... } o { ok:false, status, codigo, error }
// para que la route responda sin lógica propia.
// =====================================================================

import { enviarTexto, marcarLeidoEnMeta, destinatarioDe } from "@/lib/meta/enviar";
import { ventanaAbierta } from "./ventana";

// Tras un mensaje humano, la IA (Fase 3) no responde por este tiempo.
const PAUSA_IA_MS = 12 * 60 * 60 * 1000;
const LIMITE_TEXTO = { whatsapp: 4096, instagram: 1000, messenger: 2000 };

const error = (status, codigo, msg) => ({ ok: false, status, codigo, error: msg });

const esAdmin = (perfil) => perfil?.rol === "admin";

async function cargarConversacion(admin, id) {
  const { data } = await admin
    .from("conversaciones")
    .select("*, lead:leads(id, agente_id, propiedad_id)")
    .eq("id", id)
    .maybeSingle();
  return data || null;
}

/** ¿El usuario puede ver/operar esta conversación? (misma regla que el RLS) */
export function puedeOperar(perfil, conv) {
  if (!perfil || !conv) return false;
  if (esAdmin(perfil)) return true;
  return conv.asignado_a === perfil.id || conv.lead?.agente_id === perfil.id;
}

// Quien responde se queda con la conversación (y el lead) si no tenían dueño.
async function asignarSiNoTieneDueno(admin, conv, perfil) {
  if (!conv.asignado_a) {
    await admin.from("conversaciones").update({ asignado_a: perfil.id }).eq("id", conv.id).is("asignado_a", null);
  }
  if (conv.lead_id && conv.lead && !conv.lead.agente_id) {
    await admin.from("leads").update({ agente_id: perfil.id }).eq("id", conv.lead_id).is("agente_id", null);
  }
}

/**
 * Envía un mensaje de texto desde el CRM.
 * @returns {{ok:true, mensaje:object} | {ok:false, status, codigo, error}}
 */
export async function enviarMensaje(admin, perfil, { conversacion_id, texto }) {
  const cuerpo = (texto || "").trim();
  if (!conversacion_id) return error(400, "datos", "Falta la conversación.");
  if (!cuerpo) return error(400, "datos", "Escribí un mensaje.");

  const conv = await cargarConversacion(admin, conversacion_id);
  if (!conv) return error(404, "no_existe", "La conversación no existe.");
  if (!puedeOperar(perfil, conv)) return error(403, "permiso", "No tenés acceso a esta conversación.");

  const limite = LIMITE_TEXTO[conv.canal] || 1000;
  if (cuerpo.length > limite) return error(400, "largo", `El mensaje supera los ${limite} caracteres de ${conv.canal}.`);

  if (!ventanaAbierta(conv)) {
    return error(409, "ventana_cerrada", "Pasaron más de 24 h desde el último mensaje del cliente.");
  }

  const r = await enviarTexto(conv.canal, destinatarioDe(conv), cuerpo);
  if (!r.ok) {
    if (r.ventanaCerrada) return error(409, "ventana_cerrada", "Meta indica que la ventana de 24 h está cerrada.");
    return error(502, r.codigo || "meta", r.error);
  }

  // Guardar. Upsert por meta_message_id SIN ignorar duplicados: en Instagram
  // y Messenger, Meta manda un eco (is_echo) del mismo mensaje que puede
  // llegar antes que esta respuesta y guardarse como autor "app"; acá se
  // corrige a autor "agente" con el usuario que lo envió.
  const fila = {
    conversacion_id: conv.id,
    contacto_id: conv.contacto_id,
    lead_id: conv.lead_id || null,
    canal: conv.canal,
    direccion: "saliente",
    autor: "agente",
    usuario_id: perfil.id,
    meta_message_id: r.message_id || null,
    tipo: "texto",
    texto: cuerpo,
    estado: "enviado",
  };
  const consulta = r.message_id
    ? admin.from("mensajes").upsert([fila], { onConflict: "meta_message_id" })
    : admin.from("mensajes").insert([fila]);
  const { data: guardado, error: errG } = await consulta.select("*");
  if (errG) {
    // El mensaje YA salió hacia el cliente: no reintentar el envío.
    console.error("[chats:enviar] guardar:", errG.message);
    return error(500, "guardar", "El mensaje se envió pero no se pudo guardar en el CRM.");
  }

  const ahora = new Date();
  await admin.from("conversaciones").update({
    ultimo_mensaje_at: ahora.toISOString(),
    ultimo_mensaje_texto: cuerpo.slice(0, 500),
    ia_pausada_hasta: new Date(ahora.getTime() + PAUSA_IA_MS).toISOString(),
  }).eq("id", conv.id);
  await asignarSiNoTieneDueno(admin, conv, perfil);
  // Respondió una persona: si la IA había derivado, queda resuelto.
  // Update aparte: si la migración de la Fase 3 no corrió, no rompe lo demás.
  if (conv.ia_derivada) {
    await admin.from("conversaciones").update({ ia_derivada: false, ia_motivo_derivacion: null }).eq("id", conv.id);
  }

  return { ok: true, mensaje: guardado?.[0] || fila };
}

/** Marca la conversación como leída (CRM + acuse en Meta, best-effort). */
export async function marcarLeida(admin, perfil, conversacion_id) {
  const conv = await cargarConversacion(admin, conversacion_id);
  if (!conv) return error(404, "no_existe", "La conversación no existe.");
  if (!puedeOperar(perfil, conv)) return error(403, "permiso", "No tenés acceso a esta conversación.");
  if (!conv.no_leidos) return { ok: true };

  await admin.from("conversaciones").update({ no_leidos: 0 }).eq("id", conv.id);

  const { data: ultimo } = await admin
    .from("mensajes")
    .select("meta_message_id")
    .eq("conversacion_id", conv.id)
    .eq("direccion", "entrante")
    .order("created_at", { ascending: false })
    .limit(1);
  try {
    await marcarLeidoEnMeta(conv.canal, {
      destinatario: destinatarioDe(conv),
      ultimoMetaMessageId: ultimo?.[0]?.meta_message_id || null,
    });
  } catch (_) { /* best-effort */ }
  return { ok: true };
}

/**
 * Asigna la conversación (y su lead) a un usuario.
 * El admin asigna a cualquiera; un agente solo puede asignarse a sí mismo
 * conversaciones que ya puede ver.
 */
export async function asignarConversacion(admin, perfil, conversacion_id, usuario_id) {
  const conv = await cargarConversacion(admin, conversacion_id);
  if (!conv) return error(404, "no_existe", "La conversación no existe.");
  if (!puedeOperar(perfil, conv)) return error(403, "permiso", "No tenés acceso a esta conversación.");
  if (!esAdmin(perfil) && usuario_id !== perfil.id) {
    return error(403, "permiso", "Solo el admin puede asignar a otra persona.");
  }

  await admin.from("conversaciones").update({ asignado_a: usuario_id || null }).eq("id", conv.id);
  if (conv.lead_id && usuario_id) {
    await admin.from("leads").update({ agente_id: usuario_id }).eq("id", conv.lead_id);
  }
  return { ok: true };
}

/** Agrega o quita una propiedad de interés de un lead. */
export async function cambiarPropiedadInteres(admin, perfil, { lead_id, propiedad_id, quitar = false }) {
  if (!lead_id || !propiedad_id) return error(400, "datos", "Faltan datos.");
  const { data: lead } = await admin
    .from("leads").select("id, agente_id, propiedad_id").eq("id", lead_id).maybeSingle();
  if (!lead) return error(404, "no_existe", "El lead no existe.");
  if (!esAdmin(perfil) && lead.agente_id !== perfil.id) {
    return error(403, "permiso", "No tenés acceso a este lead.");
  }

  if (quitar) {
    await admin.from("lead_propiedades").delete().eq("lead_id", lead_id).eq("propiedad_id", propiedad_id);
    if (lead.propiedad_id === propiedad_id) {
      // Mantener leads.propiedad_id (compatibilidad) apuntando a otra de interés, si queda alguna.
      const { data: resto } = await admin
        .from("lead_propiedades").select("propiedad_id").eq("lead_id", lead_id).limit(1);
      await admin.from("leads").update({ propiedad_id: resto?.[0]?.propiedad_id || null }).eq("id", lead_id);
    }
    return { ok: true };
  }

  const { error: errU } = await admin
    .from("lead_propiedades")
    .upsert([{ lead_id, propiedad_id }], { onConflict: "lead_id,propiedad_id", ignoreDuplicates: true });
  if (errU) return error(500, "guardar", errU.message);
  if (!lead.propiedad_id) {
    await admin.from("leads").update({ propiedad_id }).eq("id", lead_id);
  }
  return { ok: true };
}

/**
 * Prende o apaga el agente IA en una conversación. Prenderlo a mano también
 * levanta la derivación y la pausa por respuesta humana.
 */
export async function cambiarIA(admin, perfil, conversacion_id, activa) {
  const conv = await cargarConversacion(admin, conversacion_id);
  if (!conv) return error(404, "no_existe", "La conversación no existe.");
  if (!puedeOperar(perfil, conv)) return error(403, "permiso", "No tenés acceso a esta conversación.");
  const cambios = activa
    ? { ia_activa: true, ia_derivada: false, ia_motivo_derivacion: null, ia_pausada_hasta: null }
    : { ia_activa: false };
  const { error: errU } = await admin.from("conversaciones").update(cambios).eq("id", conv.id);
  if (errU) return error(500, "guardar", "No se pudo cambiar la IA (¿falta la migración 20261029_agente_ia.sql?).");
  return { ok: true, cambios };
}
