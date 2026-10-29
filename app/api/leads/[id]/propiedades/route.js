import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilDeSesion } from "@/lib/chats/sesion";
import { cambiarPropiedadInteres } from "@/lib/chats/servidor";

// =====================================================================
// Propiedades de interés de un lead (tabla lead_propiedades, solo
// escribible con service_role).
//   POST   { propiedad_id } → agregar
//   DELETE { propiedad_id } → quitar
// =====================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function manejar(request, params, quitar) {
  const perfil = await perfilDeSesion();
  if (!perfil) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const r = await cambiarPropiedadInteres(createAdminClient(), perfil, {
    lead_id: params.id,
    propiedad_id: body?.propiedad_id,
    quitar,
  });
  if (!r.ok) return NextResponse.json({ error: r.error, codigo: r.codigo }, { status: r.status });
  return NextResponse.json({ ok: true });
}

export async function POST(request, { params }) {
  return manejar(request, params, false);
}

export async function DELETE(request, { params }) {
  return manejar(request, params, true);
}
