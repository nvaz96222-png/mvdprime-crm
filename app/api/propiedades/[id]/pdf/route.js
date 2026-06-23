import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import PlanComercializacion from "@/components/pdf/PlanComercializacion";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const supabase = createClient();

    const { data: propiedad, error } = await supabase
      .from("propiedades")
      .select("*, fotos(url, es_principal, orden), agente:agente_id(id, nombre)")
      .eq("id", params.id)
      .single();

    if (error || !propiedad) {
      return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
    }

    // Obtener foto principal como base64 para incluir en el PDF
    let fotoBase64 = null;
    const fotoUrl =
      propiedad.fotos?.find((f) => f.es_principal)?.url ||
      propiedad.fotos?.[0]?.url ||
      null;

    if (fotoUrl) {
      try {
        const res = await fetch(fotoUrl);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const b64 = Buffer.from(buf).toString("base64");
          const mime = res.headers.get("content-type") || "image/jpeg";
          fotoBase64 = `data:${mime};base64,${b64}`;
        }
      } catch (_) {
        // Si falla la foto, el PDF se genera sin imagen
      }
    }

    const agente = propiedad.agente || null;

    const buffer = await renderToBuffer(
      React.createElement(PlanComercializacion, { propiedad, fotoBase64, agente })
    );

    const slug = (propiedad.titulo || "propiedad")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="plan-comercializacion-${slug}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[PDF] Error generando plan:", err);
    return NextResponse.json(
      { error: "Error generando el PDF", detail: err?.message },
      { status: 500 }
    );
  }
}
