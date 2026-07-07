import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestarLead, contextoDeRequest } from "@/lib/leads/ingesta";

// POST /api/contacto-proyecto — formulario público de desarrollos.
// Ruta pública (ver APIS_PUBLICAS en lib/supabase/middleware.js).
export async function POST(request) {
  try {
    const {
      nombre, telefono, email, mensaje,
      proyecto_id, proyecto_nombre, utm, _hp,
    } = await request.json();

    // Anti-spam honeypot
    if (_hp) return NextResponse.json({ ok: true });

    if (!nombre?.trim() || !telefono?.trim()) {
      return NextResponse.json(
        { error: "Nombre y teléfono son requeridos" },
        { status: 400 }
      );
    }
    if (
      nombre.trim().length > 120 ||
      telefono.trim().length > 30 ||
      (email && email.length > 200) ||
      (mensaje && mensaje.length > 2000)
    ) {
      return NextResponse.json({ error: "Datos demasiado largos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Agente y slug del proyecto → asignación automática + analytics.
    let agente_id = null;
    let proyecto_slug = proyecto_nombre || "";
    if (proyecto_id) {
      const { data: proy } = await supabase
        .from("proyectos")
        .select("agente_id, slug")
        .eq("id", proyecto_id)
        .maybeSingle();
      agente_id = proy?.agente_id || null;
      proyecto_slug = proy?.slug || proyecto_slug;
    }

    const resultado = await ingestarLead(supabase, {
      canal: "contacto-proyecto",
      nombre,
      telefono,
      email,
      mensaje: [
        mensaje?.trim(),
        proyecto_nombre ? `Desarrollo de interés: ${proyecto_nombre}` : null,
      ].filter(Boolean).join("\n"),
      origen: "web",
      proyecto_id,
      agente_id,
      utm,
      contexto: contextoDeRequest(request),
      notasContacto: `Registrado desde desarrollo web${proyecto_nombre ? `: ${proyecto_nombre}` : ""}`,
    });

    if (!resultado.ok) {
      console.error("[contacto-proyecto] ingesta falló:", resultado.paso, resultado.error);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }

    // Analytics del proyecto — no bloqueante.
    if (proyecto_id) {
      supabase
        .from("proyecto_eventos")
        .insert({ proyecto_id, slug: proyecto_slug, tipo: "form_enviado" })
        .then(({ error }) => {
          if (error) console.error("[contacto-proyecto] evento:", error.message);
        });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contacto-proyecto]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
