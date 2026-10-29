import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { firmaValida } from "@/lib/meta/firma";
import { procesarEvento } from "@/lib/meta/procesador";
import { waitUntil } from "@vercel/functions";
import { procesarConversacionIA } from "@/lib/ia/agente";

// =====================================================================
// Webhook de Meta — WhatsApp / Instagram / Lead Ads.
//
// GET  : verificación del webhook (hub.mode + hub.verify_token → challenge).
// POST : eventos. Se valida la firma HMAC del body CRUDO (X-Hub-Signature-256).
//        Firma inválida → 401. Todo lo demás responde 200 SIEMPRE y rápido:
//        los errores se registran en lead_ingesta_log (canal "meta"); si no,
//        Meta reintenta y termina deshabilitando el webhook.
//
// Pública: está en APIS_PUBLICAS (lib/supabase/middleware.js); valida lo
// suyo (verify_token en GET, firma en POST).
// =====================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El agente IA corre en segundo plano (waitUntil) después de responder 200;
// necesita margen para esperar mensajes seguidos + llamar a Claude + enviar.
export const maxDuration = 60;

// GET — handshake de verificación de Meta.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST — recepción de eventos.
export async function POST(request) {
  // 1. Body CRUDO (la firma se calcula sobre estos bytes, no sobre el JSON reparseado).
  const raw = await request.text();
  const firma = request.headers.get("x-hub-signature-256");

  if (!firmaValida(raw, firma, process.env.META_APP_SECRET)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  // 2. A partir de acá SIEMPRE 200: cualquier error va al log.
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, ignorado: "json_invalido" });
  }

  const paraIA = new Set();
  let supabase = null;
  try {
    supabase = createAdminClient();
    await procesarEvento(supabase, body, {
      alMensajeEntrante: (conversacionId) => paraIA.add(conversacionId),
    });
  } catch (err) {
    console.error("[meta/webhook]", err?.message || err);
  }

  // 3. Agente IA (Fase 3) en segundo plano: Meta ya recibe su 200. El agente
  //    decide solo si le corresponde responder (interruptores, pausas, horario).
  if (supabase && paraIA.size) {
    waitUntil(
      Promise.allSettled([...paraIA].map((id) => procesarConversacionIA(supabase, id)))
        .then((rs) => rs.forEach((r) => r.status === "rejected" && console.error("[meta/webhook] IA:", r.reason)))
    );
  }

  return NextResponse.json({ ok: true });
}
