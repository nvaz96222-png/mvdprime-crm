import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Rutas públicas que no requieren sesión.
const RUTAS_PUBLICAS = ["/login", "/p/", "/desarrollos"];

// APIs que reciben tráfico anónimo (formularios públicos, webhooks, OAuth).
// Cada endpoint valida lo suyo (honeypot, token de ingesta, code OAuth).
const APIS_PUBLICAS = [
  "/api/contacto-web",
  "/api/contacto-proyecto",
  "/api/proyecto-evento",
  "/api/leads/inbound",
  "/api/mercadolibre/callback",
  "/api/mercadolibre/notificaciones",
];

// Assets públicos de la PWA (iconos dinámicos, manifest, service worker) —
// los necesitan navegadores anónimos y crawlers (Meta, Google).
const ASSETS_PUBLICOS = [
  "/icon",
  "/apple-icon",
  "/icon-192",
  "/icon-512",
  "/manifest.webmanifest",
  "/sw.js",
  "/robots.txt",
  "/sitemap.xml",
];

// Refresca la sesión en cada request y protege las rutas privadas.
export async function updateSession(request) {
  const pathname = request.nextUrl.pathname;

  // Las APIs públicas y assets de PWA pasan directo, sin chequeo de sesión.
  if (
    APIS_PUBLICAS.some((ruta) => pathname.startsWith(ruta)) ||
    ASSETS_PUBLICOS.some((ruta) => pathname === ruta || pathname.startsWith(ruta + "/"))
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: usar getUser() (valida el token contra Supabase), no getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) =>
    pathname.startsWith(ruta)
  );

  // APIs privadas sin sesión → 401 JSON (un redirect HTML rompe los fetch).
  if (!user && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Sin sesión y en ruta privada -> al login.
  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Con sesión y en /login → al dashboard.
  // Rutas /p/ y /desarrollos son siempre accesibles (agentes también las usan para preview).
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
