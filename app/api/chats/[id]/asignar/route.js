import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilDeSesion } from "@/lib/chats/sesion";
import { asignarConversacion } from "@/lib/chats/servidor";

// POST /api/chats/[id]/asignar — Body: { usuario_id }  (null = sin asignar)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const perfil = await perfilDeSesion();
  if (!perfil) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const r = await asignarConversacion(createAdminClient(), perfil, params.id, body?.usuario_id ?? null);
  if (!r.ok) return NextResponse.json({ error: r.error, codigo: r.codigo }, { status: r.status });
  return NextResponse.json({ ok: true });
}
