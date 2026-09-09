import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { responderConsulta } from "@/lib/whatsapp/consulta";

// =====================================================================
// POST /api/whatsapp/consultar — pregunta en lenguaje natural.
//
// Body: { "pregunta": "¿Qué clientes preguntaron por financiación?" }
// Respuesta: { respuesta, plan, diagnostico }
//
// Ruta privada: el middleware exige sesión, y las consultas corren con
// el cliente de sesión (RLS activa), no con service_role.
// =====================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Techo defensivo: una pregunta larguísima infla el prompt del planner.
const MAX_LARGO_PREGUNTA = 1000;

export async function POST(request) {
  try {
    const { pregunta } = await request.json();

    if (!pregunta?.trim()) {
      return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
    }
    if (pregunta.length > MAX_LARGO_PREGUNTA) {
      return NextResponse.json(
        { error: `La pregunta no puede superar ${MAX_LARGO_PREGUNTA} caracteres` },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const resultado = await responderConsulta(supabase, pregunta.trim());

    console.log(
      `[whatsapp/consultar] "${pregunta.slice(0, 60)}" → ` +
        `${resultado.diagnostico.modo}, ${resultado.diagnostico.tokensEntrada} tok in, ` +
        `US$${resultado.diagnostico.costoUSD}, ${resultado.diagnostico.ms}ms`
    );

    return NextResponse.json(resultado);
  } catch (err) {
    const mensaje = err?.message || "Error interno";
    console.error("[whatsapp/consultar]", mensaje);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
