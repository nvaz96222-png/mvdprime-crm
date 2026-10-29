import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilDeSesion } from "@/lib/chats/sesion";
import { cargarConfig, limpiarConfig } from "@/lib/ia/config";

// =====================================================================
// GET / PUT /api/ia/config — configuración del agente IA. Solo admin.
// =====================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function soloAdmin() {
  const perfil = await perfilDeSesion();
  if (!perfil) return { res: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  if (perfil.rol !== "admin") return { res: NextResponse.json({ error: "Solo el admin puede configurar el agente IA." }, { status: 403 }) };
  return { perfil };
}

export async function GET() {
  const { res } = await soloAdmin();
  if (res) return res;
  return NextResponse.json({ config: await cargarConfig(createAdminClient()) });
}

export async function PUT(request) {
  const { res, perfil } = await soloAdmin();
  if (res) return res;
  const body = await request.json().catch(() => ({}));
  const fila = { id: 1, ...limpiarConfig(body), updated_at: new Date().toISOString(), updated_by: perfil.id };
  const admin = createAdminClient();
  const { error } = await admin.from("agente_ia_config").upsert([fila], { onConflict: "id" });
  if (error) {
    return NextResponse.json(
      { error: `No se pudo guardar: ${error.message}. ¿Corriste la migración 20261029_agente_ia.sql?` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, config: await cargarConfig(admin) });
}
