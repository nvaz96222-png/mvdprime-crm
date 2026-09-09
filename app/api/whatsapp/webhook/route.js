import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarFirma, resolverHandshake } from "@/lib/whatsapp/firma";
import { normalizarWebhook, dentroDeRetencion } from "@/lib/whatsapp/normalizar";
import { ingestarMensajes, aplicarEstados } from "@/lib/whatsapp/ingesta";
import { APP_SECRET, VERIFY_TOKEN, GUARDAR_ESTADOS, RETENCION_DIAS } from "@/lib/whatsapp/config";

// =====================================================================
// Webhook de WhatsApp Cloud API.
//
// Configurar en la app de Meta:
//   Callback URL  → https://mvdprime-crm.vercel.app/api/whatsapp/webhook
//   Verify token  → WHATSAPP_VERIFY_TOKEN
//   Campos        → messages, smb_message_echoes, history
//
// GET  = handshake de verificación (una sola vez, al dar de alta).
// POST = eventos. SIEMPRE responde 200, salvo firma inválida (401):
//        un 500 hace que Meta reintente y termine desactivando el webhook.
//        Los errores quedan en wa_eventos_log con el payload completo,
//        que funciona como dead-letter queue reprocesable.
// =====================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const challenge = resolverHandshake(request.nextUrl.searchParams, VERIFY_TOKEN);
  if (!challenge) {
    console.warn("[whatsapp/webhook] handshake rechazado");
    return new NextResponse("Forbidden", { status: 403 });
  }
  // Meta espera el challenge en texto plano, sin comillas ni JSON.
  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request) {
  // ⚠️ El cuerpo CRUDO: la firma se calcula sobre estos bytes exactos.
  // Parsear y volver a serializar rompe el HMAC.
  const crudo = await request.text();
  const firma = request.headers.get("x-hub-signature-256");

  if (!APP_SECRET) {
    console.error("[whatsapp/webhook] falta WHATSAPP_APP_SECRET");
    return NextResponse.json({ error: "No configurado" }, { status: 500 });
  }

  if (!verificarFirma(crudo, firma, APP_SECRET)) {
    console.warn("[whatsapp/webhook] firma inválida");
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(crudo);
  } catch {
    // Firma válida pero JSON roto: 200 para que Meta no reintente eternamente.
    return NextResponse.json({ ok: true, ignorado: "json_invalido" });
  }

  const supabase = createAdminClient();
  let logId = null;

  try {
    // 1. Registrar SIEMPRE el evento crudo antes de tocarlo.
    const campo = body?.entry?.[0]?.changes?.[0]?.field || null;
    const { data: logRow } = await supabase
      .from("wa_eventos_log")
      .insert({ estado: "recibido", campo, payload: body })
      .select("id")
      .single();
    logId = logRow?.id || null;

    // 2. Normalizar los tres formatos posibles.
    const norm = normalizarWebhook(body, { guardarEstados: GUARDAR_ESTADOS });

    // 3. El historial trae 180 días; nosotros guardamos RETENCION_DIAS.
    const aGuardar = dentroDeRetencion(norm.mensajes, RETENCION_DIAS);
    const fueraDeVentana = norm.mensajes.length - aGuardar.length;

    // 4. Guardar.
    const resultado = await ingestarMensajes(supabase, aGuardar);
    if (GUARDAR_ESTADOS) await aplicarEstados(supabase, norm.estados);

    const nota = [
      norm.ignorados.length ? `campos ignorados: ${norm.ignorados.join(",")}` : null,
      fueraDeVentana ? `${fueraDeVentana} fuera de la ventana de retención` : null,
      resultado.duplicados ? `${resultado.duplicados} duplicados` : null,
    ]
      .filter(Boolean)
      .join("; ");

    if (logId) {
      await supabase
        .from("wa_eventos_log")
        .update({
          estado: resultado.nuevos > 0 ? "ok" : "ignorado",
          campo: norm.campos.join(",") || campo,
          mensajes_nuevos: resultado.nuevos,
          error: nota || null,
          procesado_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return NextResponse.json({ ok: true, nuevos: resultado.nuevos });
  } catch (err) {
    const mensaje = err?.message || String(err);
    console.error("[whatsapp/webhook]", mensaje);

    if (logId) {
      await supabase
        .from("wa_eventos_log")
        .update({ estado: "error", error: mensaje, procesado_at: new Date().toISOString() })
        .eq("id", logId);
    }

    // 200 igual: el payload quedó guardado y se puede reprocesar.
    return NextResponse.json({ ok: true, error: "registrado" });
  }
}
