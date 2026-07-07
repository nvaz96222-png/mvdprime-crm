import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestarLead, contextoDeRequest } from "@/lib/leads/ingesta";

// =====================================================================
// POST /api/leads/inbound — webhook genérico de ingesta de leads.
//
// Punto de entrada para cualquier canal externo: Meta Lead Ads,
// Google Ads lead forms, Zapier, Make, landing pages de terceros.
//
// Auth: header  x-ingest-token: <LEADS_INGEST_TOKEN>
//
// Body JSON:
// {
//   "origen":   "meta_ads" | "google_ads" | "whatsapp" | "web" | ... ,
//   "nombre":   "...",            (requerido)
//   "telefono": "...",            (requerido)
//   "email":    "...",
//   "mensaje":  "...",
//   "campana":  "nombre campaña",
//   "medio":    "cpc | social | ...",
//   "anuncio":  "nombre del anuncio",
//   "propiedad_id": "uuid",       (opcional)
//   "proyecto_id":  "uuid"        (opcional)
// }
//
// Respuesta: { ok: true, lead_id } | { error }
// Todo intento queda en lead_ingesta_log (canal "inbound").
// =====================================================================

export async function POST(request) {
  const token = request.headers.get("x-ingest-token");
  if (!process.env.LEADS_INGEST_TOKEN || token !== process.env.LEADS_INGEST_TOKEN) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const {
      origen, nombre, telefono, email, mensaje,
      campana, medio, anuncio, propiedad_id, proyecto_id,
    } = await request.json();

    if (!nombre?.trim() || !telefono?.trim()) {
      return NextResponse.json(
        { error: "nombre y telefono son requeridos" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const resultado = await ingestarLead(supabase, {
      canal: "inbound",
      nombre,
      telefono,
      email,
      mensaje,
      origen: origen || "otro",
      propiedad_id,
      proyecto_id,
      utm: {
        campaign: campana || null,
        medium: medio || null,
        content: anuncio || null,
        source: origen || null,
      },
      contexto: contextoDeRequest(request),
      notasContacto: `Ingresado vía webhook (${origen || "sin origen"})`,
    });

    if (!resultado.ok) {
      return NextResponse.json(
        { error: resultado.error, paso: resultado.paso, log_id: resultado.log_id },
        { status: resultado.paso === "validacion" ? 400 : 500 }
      );
    }

    return NextResponse.json({ ok: true, lead_id: resultado.lead_id });
  } catch (err) {
    console.error("[leads/inbound]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
