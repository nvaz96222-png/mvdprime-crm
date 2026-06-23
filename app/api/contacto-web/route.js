import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request) {
  try {
    const { nombre, telefono, email, mensaje, propiedad_id, propiedad_titulo } =
      await request.json();

    if (!nombre?.trim() || !telefono?.trim()) {
      return NextResponse.json(
        { error: "Nombre y teléfono son requeridos" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Buscar contacto existente por teléfono
    const telefonoLimpio = telefono.trim().replace(/\s/g, "");
    const { data: existente } = await supabase
      .from("contactos")
      .select("id")
      .eq("telefono", telefonoLimpio)
      .maybeSingle();

    let contacto_id;

    if (existente) {
      contacto_id = existente.id;
    } else {
      const { data: nuevo, error: errC } = await supabase
        .from("contactos")
        .insert({
          nombre: nombre.trim(),
          telefono: telefonoLimpio,
          email: email?.trim() || null,
          notas: `Registrado desde ficha web${propiedad_titulo ? `: ${propiedad_titulo}` : ""}`,
        })
        .select("id")
        .single();

      if (errC) {
        console.error("[contacto-web] Error contacto:", errC);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
      }
      contacto_id = nuevo.id;
    }

    // Crear lead
    const notasLead = [
      mensaje?.trim(),
      propiedad_titulo ? `Propiedad de interés: ${propiedad_titulo}` : null,
      "Origen: formulario web",
    ]
      .filter(Boolean)
      .join("\n");

    const { error: errL } = await supabase.from("leads").insert({
      contacto_id,
      propiedad_id: propiedad_id || null,
      etapa: "nuevo",
      origen: "web",
      prioridad: "media",
      notas: notasLead,
    });

    if (errL) {
      console.error("[contacto-web] Error lead:", errL);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contacto-web]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
