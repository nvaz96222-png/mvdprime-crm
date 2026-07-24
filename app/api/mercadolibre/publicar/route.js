import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  publicarItem,
  actualizarItem,
  cambiarEstadoItem,
} from "@/lib/mercadolibre";

// POST /api/mercadolibre/publicar
// body: { propiedadId, accion?: "publicar" | "pausar" | "activar" }
// Publica (o actualiza) una propiedad en Mercado Libre, o cambia su estado.
export async function POST(request) {
  try {
    // Solo usuarios autenticados del CRM pueden disparar esto.
    const auth = createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { propiedadId, accion = "publicar" } = await request.json();
    if (!propiedadId) {
      return NextResponse.json({ error: "Falta propiedadId" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: prop, error: errProp } = await admin
      .from("propiedades")
      .select("*")
      .eq("id", propiedadId)
      .maybeSingle();

    if (errProp || !prop) {
      return NextResponse.json(
        { error: "Propiedad no encontrada" },
        { status: 404 }
      );
    }

    // --- Pausar / activar una publicación existente ---
    if (accion === "pausar" || accion === "activar") {
      if (!prop.ml_item_id) {
        return NextResponse.json(
          { error: "La propiedad no está publicada en Mercado Libre." },
          { status: 400 }
        );
      }
      const status = accion === "pausar" ? "paused" : "active";
      const r = await cambiarEstadoItem(admin, prop.ml_item_id, status);
      await admin
        .from("propiedades")
        .update({ ml_estado: r.status || status, ml_synced_at: new Date().toISOString() })
        .eq("id", propiedadId);
      return NextResponse.json({ ok: true, estado: r.status || status });
    }

    // --- Publicar o actualizar ---
    const { data: fotos } = await admin
      .from("fotos")
      .select("url, orden, es_principal")
      .eq("propiedad_id", propiedadId)
      .order("es_principal", { ascending: false })
      .order("orden");

    try {
      let resultado;
      if (prop.ml_item_id) {
        resultado = await actualizarItem(admin, prop.ml_item_id, prop, fotos || []);
      } else {
        resultado = await publicarItem(admin, prop, fotos || []);
      }

      await admin
        .from("propiedades")
        .update({
          ml_item_id: resultado.id,
          ml_permalink: resultado.permalink || prop.ml_permalink || null,
          ml_estado: resultado.status || "active",
          ml_error: null,
          ml_synced_at: new Date().toISOString(),
          publicar_ml: true,
        })
        .eq("id", propiedadId);

      return NextResponse.json({
        ok: true,
        itemId: resultado.id,
        permalink: resultado.permalink || null,
        estado: resultado.status || "active",
      });
    } catch (mlErr) {
      // Guardar el error de ML para diagnóstico y devolverlo legible.
      await admin
        .from("propiedades")
        .update({ ml_estado: "error", ml_error: String(mlErr.message).slice(0, 500) })
        .eq("id", propiedadId);

      if (mlErr.code === "NOT_CONNECTED") {
        return NextResponse.json(
          { error: "NOT_CONNECTED", message: "Conectá Mercado Libre primero." },
          { status: 409 }
        );
      }
      console.error("[mercadolibre/publicar]", mlErr.status, mlErr.message);
      return NextResponse.json(
        { error: "ML_ERROR", message: mlErr.message },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[mercadolibre/publicar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
