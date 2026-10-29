import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilDeSesion } from "@/lib/chats/sesion";
import { marcarLeida } from "@/lib/chats/servidor";

// POST /api/chats/[id]/leer — pone en 0 los no leídos y manda el acuse a Meta.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const perfil = await perfilDeSesion();
  if (!perfil) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const r = await marcarLeida(createAdminClient(), perfil, params.id);
  if (!r.ok) return NextResponse.json({ error: r.error, codigo: r.codigo }, { status: r.status });
  return NextResponse.json({ ok: true });
}
