import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilDeSesion } from "@/lib/chats/sesion";
import { simularIA } from "@/lib/ia/agente";
import { limpiarConfig } from "@/lib/ia/config";

// =====================================================================
// POST /api/ia/simular — el admin escribe como si fuera un cliente y ve
// cómo respondería el agente. No escribe en la base ni manda mensajes.
// Body: { propiedad_id, historial:[{rol:'cliente'|'ia', texto}], lead, config? }
// Si viene `config` (borrador sin guardar de la pantalla), se usa esa.
// =====================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const perfil = await perfilDeSesion();
  if (!perfil) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (perfil.rol !== "admin") return NextResponse.json({ error: "Solo el admin puede usar el simulador." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const historial = (Array.isArray(body.historial) ? body.historial : [])
    .filter((m) => m && (m.rol === "cliente" || m.rol === "ia") && typeof m.texto === "string" && m.texto.trim())
    .slice(-30)
    .map((m) => ({ rol: m.rol, texto: m.texto.slice(0, 2000) }));

  try {
    const r = await simularIA(createAdminClient(), {
      propiedad_id: body.propiedad_id || null,
      historial,
      lead: body.lead || null,
      configOverride: body.config ? limpiarConfig(body.config) : null,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json(r);
  } catch (e) {
    const msg = e?.status === 401 ? "La API key de Anthropic no es válida." : e?.message || "Error del agente.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
