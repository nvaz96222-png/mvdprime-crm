import { NextResponse } from "next/server";

// GET /api/mercadolibre/conectar
// Redirige al usuario a la pantalla de autorización de Mercado Libre.
// El redirect_uri se calcula desde el origen de la request, así funciona
// tanto en local como deployado (ese origen debe estar registrado en la app
// de ML como Redirect URI).
export async function GET(request) {
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/mercadolibre/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ML_CLIENT_ID || "",
    redirect_uri: redirectUri,
  });

  return NextResponse.redirect(
    `https://auth.mercadolibre.com.uy/authorization?${params}`
  );
}
