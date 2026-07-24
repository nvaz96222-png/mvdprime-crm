import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TIPOS_VALIDOS = new Set([
  "vista",
  "brochure_click",
  "form_enviado",
  "whatsapp_click",
  "compartir_click",
]);

export async function POST(request) {
  try {
    const { proyecto_id, slug, tipo } = await request.json();
    if (!slug || !tipo || !TIPOS_VALIDOS.has(tipo)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const supabase = createAdminClient();
    await supabase
      .from("proyecto_eventos")
      .insert({ proyecto_id: proyecto_id || null, slug, tipo });
    return NextResponse.json({ ok: true });
  } catch {
    // Analytics nunca debe romper la UX — silencioso
    return NextResponse.json({ ok: true });
  }
}
