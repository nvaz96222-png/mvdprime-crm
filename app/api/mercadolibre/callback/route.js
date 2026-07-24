import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { intercambiarCode, guardarToken } from "@/lib/mercadolibre";

// GET /api/mercadolibre/callback?code=...
// Recibe el authorization code de Mercado Libre, lo intercambia por tokens y
// los guarda en ml_tokens. Redirige a /propiedades con el resultado.
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      `${url.origin}/propiedades?ml=error`
    );
  }

  const redirectUri = `${url.origin}/api/mercadolibre/callback`;

  try {
    const tokens = await intercambiarCode(code, redirectUri);
    await guardarToken(createAdminClient(), tokens);
    return NextResponse.redirect(`${url.origin}/propiedades?ml=conectado`);
  } catch (err) {
    console.error("[mercadolibre/callback]", err);
    return NextResponse.redirect(`${url.origin}/propiedades?ml=error`);
  }
}
