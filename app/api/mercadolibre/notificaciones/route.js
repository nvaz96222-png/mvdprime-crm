import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessTokenValido } from "@/lib/mercadolibre";
import { ingestarLead } from "@/lib/leads/ingesta";

// =====================================================================
// POST /api/mercadolibre/notificaciones — webhook de Mercado Libre.
//
// Configurar en la app ML (developers.mercadolibre.com.uy):
//   Callback URL de notificaciones → https://<dominio>/api/mercadolibre/notificaciones
//   Tópicos: questions (preguntas de interesados en publicaciones)
//
// ML espera 200 en <500ms o reintenta. Por eso: registrar SIEMPRE la
// notificación en lead_ingesta_log y responder rápido; el procesamiento
// pesado corre después del registro.
//
// Payload típico de ML:
// { "resource": "/questions/123456", "user_id": 999, "topic": "questions",
//   "application_id": ..., "attempts": 1, "sent": "...", "received": "..." }
// =====================================================================

const ML_API = "https://api.mercadolibre.com";

export async function POST(request) {
  const supabase = createAdminClient();
  let notif = null;

  try {
    notif = await request.json();
  } catch {
    return NextResponse.json({ ok: true }); // payload inválido: 200 para que ML no reintente infinito
  }

  // 1. SIEMPRE registrar la notificación cruda (trazabilidad).
  const { data: logRow } = await supabase
    .from("lead_ingesta_log")
    .insert({
      canal: "mercadolibre",
      estado: "recibido",
      payload: notif || {},
    })
    .select("id")
    .single();

  // 2. Solo procesamos preguntas; el resto queda logueado.
  if (notif?.topic !== "questions" || !notif?.resource) {
    if (logRow?.id) {
      await supabase
        .from("lead_ingesta_log")
        .update({ estado: "ok", error: `topic ${notif?.topic || "?"} ignorado`, procesado_at: new Date().toISOString() })
        .eq("id", logRow.id);
    }
    return NextResponse.json({ ok: true });
  }

  try {
    // 3. Traer la pregunta desde la API de ML.
    const token = await getAccessTokenValido(supabase);
    const res = await fetch(`${ML_API}${notif.resource}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pregunta = await res.json();
    if (!res.ok) throw new Error(`GET ${notif.resource}: ${pregunta.message || res.status}`);

    // 4. Datos del usuario que pregunta (nickname; ML no expone teléfono).
    let nombreUsuario = `Usuario ML ${pregunta.from?.id || ""}`.trim();
    try {
      const resUser = await fetch(`${ML_API}/users/${pregunta.from?.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await resUser.json();
      if (resUser.ok && user.nickname) nombreUsuario = user.nickname;
    } catch { /* seguimos con el nombre genérico */ }

    // 5. Mapear item ML → propiedad del CRM.
    let propiedad_id = null;
    let tituloPropiedad = null;
    if (pregunta.item_id) {
      const { data: prop } = await supabase
        .from("propiedades")
        .select("id, titulo")
        .eq("ml_item_id", pregunta.item_id)
        .maybeSingle();
      propiedad_id = prop?.id || null;
      tituloPropiedad = prop?.titulo || null;
    }

    // 6. Ingestar como lead (sin teléfono: ML no lo da en preguntas).
    const resultado = await ingestarLead(supabase, {
      canal: "mercadolibre",
      nombre: nombreUsuario,
      telefono: null,
      permitirSinTelefono: true,
      mensaje: [
        `Pregunta en MercadoLibre: "${pregunta.text || ""}"`,
        tituloPropiedad ? `Publicación: ${tituloPropiedad}` : `Item ML: ${pregunta.item_id || "?"}`,
      ].join("\n"),
      origen: "mercadolibre",
      propiedad_id,
      notasContacto: `Usuario de MercadoLibre (${nombreUsuario})`,
    });

    if (logRow?.id) {
      await supabase
        .from("lead_ingesta_log")
        .update({
          estado: resultado.ok ? "ok" : "error",
          error: resultado.ok ? null : `${resultado.paso}: ${resultado.error}`,
          lead_id: resultado.lead_id || null,
          contacto_id: resultado.contacto_id || null,
          procesado_at: new Date().toISOString(),
        })
        .eq("id", logRow.id);
    }
  } catch (err) {
    console.error("[ml/notificaciones]", err);
    if (logRow?.id) {
      await supabase
        .from("lead_ingesta_log")
        .update({ estado: "error", error: String(err?.message || err), procesado_at: new Date().toISOString() })
        .eq("id", logRow.id);
    }
  }

  // ML solo necesita el 200 — los errores quedan en el log para reproceso.
  return NextResponse.json({ ok: true });
}
