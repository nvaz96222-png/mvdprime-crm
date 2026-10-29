import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilDeSesion } from "@/lib/chats/sesion";
import { enviarMensaje } from "@/lib/chats/servidor";

// =====================================================================
// POST /api/chats/enviar — envía un mensaje de texto desde la bandeja.
// Body: { conversacion_id, texto }
// Respuesta: { ok:true, mensaje } | { error, codigo }  (409 = ventana cerrada)
// Requiere sesión (no está en APIS_PUBLICAS).
// =====================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const perfil = await perfilDeSesion();
  if (!perfil) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido", codigo: "datos" }, { status: 400 });
  }

  const r = await enviarMensaje(createAdminClient(), perfil, {
    conversacion_id: body?.conversacion_id,
    texto: body?.texto,
  });
  if (!r.ok) return NextResponse.json({ error: r.error, codigo: r.codigo }, { status: r.status });
  return NextResponse.json({ ok: true, mensaje: r.mensaje });
}
