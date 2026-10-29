// =====================================================================
// Envío de mensajes salientes por las APIs de Meta (server-side ONLY).
//
//   · WhatsApp  → Cloud API:  POST /{META_WA_PHONE_NUMBER_ID}/messages
//                 (Bearer META_WA_ACCESS_TOKEN)
//   · Instagram → Messenger Platform for Instagram: POST /me/messages
//   · Messenger → Messenger Platform:                POST /me/messages
//                 (ambos con META_PAGE_ACCESS_TOKEN)
//
// Sin dependencias (fetch). Nunca lanza: devuelve { ok, message_id } o
// { ok:false, error, codigo } con el detalle de Meta para mostrar en el CRM.
// =====================================================================

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Códigos de Meta que significan "pasó la ventana de 24 h".
// WhatsApp: 131047 (re-engagement). Messenger/IG: 10 con subcódigo 2018278.
const CODIGOS_VENTANA = new Set([131047, 2018278]);

async function graphPost(path, body, { bearer, accessToken } = {}) {
  try {
    const url = new URL(`${GRAPH}/${path}`);
    if (accessToken) url.searchParams.set("access_token", accessToken);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      const e = data?.error || {};
      const codigo = e.error_subcode || e.code || res.status;
      return {
        ok: false,
        codigo,
        ventanaCerrada: CODIGOS_VENTANA.has(e.code) || CODIGOS_VENTANA.has(e.error_subcode),
        error: e.error_user_msg || e.message || `Error ${res.status} de Meta`,
      };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, codigo: "red", error: `No se pudo conectar con Meta: ${err?.message || err}` };
  }
}

function faltaConfig(nombre) {
  return { ok: false, codigo: "config", error: `Falta configurar ${nombre} en Vercel.` };
}

/**
 * Envía un texto libre (dentro de la ventana de 24 h).
 * @param {"whatsapp"|"instagram"|"messenger"} canal
 * @param {string} destinatario  wa_id (WhatsApp) | IGSID | PSID
 * @param {string} texto
 * @returns {Promise<{ok:true, message_id:string} | {ok:false, error:string, codigo, ventanaCerrada?:boolean}>}
 */
export async function enviarTexto(canal, destinatario, texto) {
  if (!destinatario) return { ok: false, codigo: "destinatario", error: "La conversación no tiene destinatario." };

  if (canal === "whatsapp") {
    const token = process.env.META_WA_ACCESS_TOKEN;
    const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
    if (!token) return faltaConfig("META_WA_ACCESS_TOKEN");
    if (!phoneId) return faltaConfig("META_WA_PHONE_NUMBER_ID");
    const r = await graphPost(`${phoneId}/messages`, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: destinatario,
      type: "text",
      text: { body: texto, preview_url: true },
    }, { bearer: token });
    if (!r.ok) return r;
    return { ok: true, message_id: r.data?.messages?.[0]?.id || null };
  }

  if (canal === "instagram" || canal === "messenger") {
    const token = process.env.META_PAGE_ACCESS_TOKEN;
    if (!token) return faltaConfig("META_PAGE_ACCESS_TOKEN");
    const r = await graphPost("me/messages", {
      recipient: { id: destinatario },
      messaging_type: "RESPONSE",
      message: { text: texto },
    }, { accessToken: token });
    if (!r.ok) return r;
    return { ok: true, message_id: r.data?.message_id || null };
  }

  return { ok: false, codigo: "canal", error: `Canal no soportado: ${canal}` };
}

/**
 * Acuse de lectura (best-effort): tildes azules en WhatsApp, "visto" en
 * Messenger/Instagram. Nunca falla hacia afuera.
 */
export async function marcarLeidoEnMeta(canal, { destinatario, ultimoMetaMessageId }) {
  if (canal === "whatsapp") {
    const token = process.env.META_WA_ACCESS_TOKEN;
    const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
    if (!token || !phoneId || !ultimoMetaMessageId) return;
    await graphPost(`${phoneId}/messages`, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: ultimoMetaMessageId,
    }, { bearer: token });
    return;
  }
  if (canal === "instagram" || canal === "messenger") {
    const token = process.env.META_PAGE_ACCESS_TOKEN;
    if (!token || !destinatario) return;
    await graphPost("me/messages", {
      recipient: { id: destinatario },
      sender_action: "mark_seen",
    }, { accessToken: token });
  }
}

/** Destinatario de Meta según el canal de la conversación. */
export function destinatarioDe(conversacion) {
  if (!conversacion) return null;
  if (conversacion.canal === "whatsapp") return conversacion.wa_id;
  if (conversacion.canal === "instagram") return conversacion.instagram_id;
  if (conversacion.canal === "messenger") return conversacion.messenger_id;
  return null;
}
