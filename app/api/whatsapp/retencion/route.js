import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { RETENCION_DIAS, RETENCION_DIAS_MINIMO } from "@/lib/whatsapp/config";

// =====================================================================
// GET/POST /api/whatsapp/retencion — purga de mensajes vencidos.
//
// Disparo primario: Vercel Cron (ver vercel.json), diario 07:00 UTC =
// 04:00 Uruguay. Vercel manda `Authorization: Bearer <CRON_SECRET>`.
//
// Lee MESSAGE_RETENTION_DAYS (default 90) y llama a wa_purgar_mensajes().
// La función SQL aplica greatest(dias, 30): aunque esta env var quedara
// mal configurada, es IMPOSIBLE borrar mensajes de menos de 30 días.
//
// Dry-run (no borra nada, informa qué borraría):
//   curl -H "x-cron-secret: $CRON_SECRET" \
//        "https://mvdprime-crm.vercel.app/api/whatsapp/retencion?simular=true"
//
// Respaldo independiente: job pg_cron semanal con corte fijo de 120 días
// (ver la migración), por si Vercel está caído.
// =====================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Comparación en tiempo constante para no filtrar el secreto por timing.
function coincide(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function autorizado(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ") && coincide(auth.slice(7), secreto)) return true;
  return coincide(request.headers.get("x-cron-secret") || "", secreto);
}

async function ejecutar(request) {
  // Fail-closed: sin secreto configurado, el endpoint no hace nada.
  if (!process.env.CRON_SECRET) {
    console.error("[whatsapp/retencion] falta CRON_SECRET");
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 });
  }
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const simular = new URL(request.url).searchParams.get("simular") === "true";

  if (RETENCION_DIAS < RETENCION_DIAS_MINIMO) {
    console.warn(
      `[whatsapp/retencion] MESSAGE_RETENTION_DAYS=${RETENCION_DIAS} es menor al piso ` +
        `de ${RETENCION_DIAS_MINIMO} días; la función SQL lo va a elevar al piso.`
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("wa_purgar_mensajes", {
      p_dias: RETENCION_DIAS,
      p_simular: simular,
      p_origen: "cron",
    });

    if (error) {
      console.error("[whatsapp/retencion]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[whatsapp/retencion]", JSON.stringify(data));
    return NextResponse.json(data);
  } catch (err) {
    console.error("[whatsapp/retencion]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export const GET = ejecutar;
export const POST = ejecutar;
