# CLAUDE.md — MVD Prime Real Estate (web pública)

> Guía para continuar el desarrollo en nuevas sesiones de Claude Code.
> Última actualización: 2026-06-10.

## 1. Qué es este proyecto
Web pública de la inmobiliaria **MVD Prime Real Estate** (Montevideo, Uruguay),
servida en **https://mvdprime.uy**. Es una **landing de una sola página**,
trilingüe (ES/EN/PT), que muestra propiedades destacadas. Las propiedades se
leen desde **Supabase** (alimentado por el CRM MVDPrime); si Supabase falla o no
hay datos, cae a un set estático de respaldo.

- Repo: https://github.com/nvaz96222-png/web-nico.git
- Hosting: **Cloudflare Workers** (vía OpenNext), worker `mvd-prime`.
- Proyecto hermano: **CRM MVDPrime** (carga las propiedades; comparte la BD Supabase).

## 2. Stack
- **Next.js 15.5** (App Router) + **React 18.3** + **TypeScript 5**
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **Supabase** (`@supabase/supabase-js`) — fuente de datos de propiedades
- **@opennextjs/cloudflare** + **wrangler** — build y deploy a Workers
- Fuentes: Playfair Display (serif display) + Inter (sans), vía `next/font/google`

## 3. Arquitectura
```
Navegador ─► Cloudflare (CDN/SSL/HSTS/Brotli/HTTP3)
           └► Worker "mvd-prime" (Next.js vía OpenNext)
                ├─ SSR / componentes
                ├─ binding ASSETS (estáticos en .open-next/assets)
                └─ Properties (Server Component) ─► Supabase REST (tabla propiedades + fotos)
                                                     └─ fallback: dict.properties.items (i18n)
```
- Render: la home es estática salvo `Properties`, que es **Server Component async**
  (SSR, SEO-friendly) con `Suspense` + skeleton.
- Canonicalización: `middleware.ts` redirige 308 `www` → apex.

## 4. Estructura de carpetas
```
app/
  page.tsx          Ensambla la home (orden de secciones)
  layout.tsx        Metadata SEO completa + JSON-LD RealEstateAgent
  sitemap.ts        -> /sitemap.xml  (lastmod fijo "2026-06-09")
  robots.ts         -> /robots.txt   (con Sitemap)
  manifest.ts       -> PWA manifest
  icon.jpg / apple-icon.jpg   Favicons (copia del logo)
  globals.css       Estilos globales + tokens Tailwind v4
components/
  Properties.tsx    Server Component: query a Supabase + map a PropItem (+ skeleton)
  PropertiesView.tsx Client: renderiza tarjetas; usa Supabase o fallback i18n
  Hero, Zones, Services, Project, Investors, OwnerForm,
  About, Testimonials, Contact, Footer, Nav, WhatsAppFloat, Reveal
lib/
  i18n.tsx          Diccionario ES/EN/PT + LangProvider/useLang/tr + datos estáticos fallback
  supabase.ts       Cliente Supabase público (anon, solo lectura, cache: no-store)
middleware.ts       Redirect canónico www -> apex (308)
wrangler.jsonc      Config del worker (name mvd-prime, nodejs_compat, assets, observability)
open-next.config.ts Config OpenNext (default)
next.config.ts      (vacío; el redirect vive en middleware)
public/images/      Fotos estáticas (.jpg)
```

## 5. Capa de datos (Supabase)
Cliente en `lib/supabase.ts` (anon key, `persistSession:false`, `cache:"no-store"`).
`Properties.tsx` consulta:
```sql
from("propiedades")
  .select("id, titulo, precio, moneda, dormitorios, banos, barrio,
           superficie_total, operacion, created_at,
           fotos(url, es_principal, orden)")
  .eq("publicar_web", true)
  .eq("estado", "disponible")
  .order("created_at", { ascending: false })
```
Tablas inferidas:
- **propiedades**: id, titulo, precio, moneda (UYU/USD), dormitorios, banos, barrio,
  superficie_total, operacion (venta/alquiler), created_at, publicar_web (bool), estado.
- **fotos**: url, es_principal (bool), orden (int), FK a propiedad.
Mapeo en `mapToItem()`; precio formateado con `Intl.NumberFormat("es-UY")`.
La foto mostrada = la `es_principal` o la de menor `orden`.

## 6. Variables de entorno (IMPORTANTES)
Requeridas para que las propiedades vengan del CRM (se inlinean en build):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
> ⚠️ HOY NO ESTÁN definidas en el repo (.env gitignored) ni en wrangler.jsonc.
> Sin ellas, el build falla o `Properties` cae al fallback estático de i18n.
> Para deploy: exportarlas en el entorno de build (local o Workers Builds).

Para Cloudflare (deploy manual): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## 7. APIs / servicios externos
- **Supabase REST** (lectura pública de propiedades).
- **WhatsApp** wa.me/59899972906, **email** contacto@mvdprime.uy (links, sin backend).
- **IndexNow** (clave `public/35aa6f0e7743f76086b51a7173d8403e.txt`) para notificar buscadores.
- No hay rutas API propias (`app/api/*`) ni backend de formularios.

## 8. Funcionalidades implementadas
- Landing trilingüe (ES/EN/PT) con selector de idioma (estado en memoria, no persiste).
- Propiedades desde Supabase con fallback estático.
- SEO técnico: canonical, Open Graph, Twitter Cards, JSON-LD, sitemap, robots, manifest, favicon.
- Seguridad/perf en Cloudflare: HTTPS forzado, HSTS, TLS 1.2+, Brotli, HTTP/3, Early Hints, 0-RTT.
- Redirect canónico www -> apex (middleware).

## 9. Funcionalidades PENDIENTES / conocidas
- [x] **Integración Supabase LIVE** (verificado 2026-06-11): el worker desplegado YA
      lee de Supabase (cache:no-store) y muestra las propiedades reales del CRM. Las
      env vars NEXT_PUBLIC_SUPABASE_* están definidas en el build vivo. Lo que faltaba
      eran las políticas RLS `anon` (ver `web_public_read.sql`), ya aplicadas → la prop
      "Carrasco Boating" aparece en mvdprime.uy sin redeploy.
- [x] **Pusheado a GitHub** (2026-06-11): los 6 commits (SEO, deploy, Supabase, filtros)
      mergeados ff a `main` y subidos a `nvaz96222-png/web-nico`. Remoto en sync.
- [ ] **Filtros de propiedades**: los botones (Venta/Alquiler/etc.) son decorativos, no filtran.
- [ ] **Botón "Ver todas las propiedades"**: apunta a `#` (sin destino).
- [ ] **OwnerForm** (vender) y **Contact**: validan en cliente pero NO envían a ningún lado
      (sin email/API/Supabase insert). Falta backend de leads.
- [ ] **Dominios secundarios**: mvdprime.com.uy / mvdprime.uy.com no registrados.
- [ ] **Página de detalle de propiedad** y listado completo (hoy solo destacadas en home).

## 10. Deploy
Deploy manual (no hay CI/CD conectado; el worker se sube con wrangler):
```bash
# requiere env vars de Supabase + token de Cloudflare
export CLOUDFLARE_API_TOKEN=...        # token con Workers Scripts:Edit
export CLOUDFLARE_ACCOUNT_ID=48f0fbcd9c47bb177eca2fdec755a927
export NEXT_PUBLIC_SUPABASE_URL=...
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
npm install
npx opennextjs-cloudflare build      # genera .open-next/worker.js + assets
npx wrangler deploy                  # sube al worker "mvd-prime"
```
Datos Cloudflare:
- Zona `mvdprime.uy` id `d2bfe78c52ebe5e83b1239bc2a260b5d`
- Account id `48f0fbcd9c47bb177eca2fdec755a927`
- Custom domains del worker `mvd-prime`: `mvdprime.uy` (apex) y `www.mvdprime.uy`
- Existe un worker `web-nico` ("Hello world") sin uso — candidato a eliminar.

Recomendado: conectar **Workers Builds** (GitHub) para deploy automático en cada push,
configurando las env vars en "Build variables and secrets".

## 11. Decisiones de diseño
- **Una sola página** con anclas (#propiedades, #zonas, #servicios, #vender, #contacto).
- **i18n casero** (sin librería): todo el texto en `lib/i18n.tsx` como `{ES,EN,PT}`; `tr()` elige.
- **SSR solo donde importa**: `Properties` es Server Component para SEO; el resto es estático/cliente.
- **Fallback robusto**: si Supabase falla, la web nunca queda vacía (usa datos i18n).
- **Sin caché en Supabase** (`no-store`): cambios de `publicar_web` en el CRM se reflejan sin redeploy.
- **Paleta**: verde profundo (green-900) + dorado (gold/gold-soft/gold-deep), tipografía serif (Playfair) + Inter.

## 12. Comandos útiles
```bash
npm run dev       # desarrollo local (Next dev server)
npm run build     # next build
npx opennextjs-cloudflare build && npx wrangler deploy   # build+deploy a Workers
```

---

## Actualización 2026-06-11 — features de código

Implementado (commit `feat: filtros reales, listado/detalle...`):
- ✅ **Filtros reales** de propiedades (Todas/Venta/Alquiler/Obra nueva), por índice (i18n-proof), con empty-state. Lógica en `components/PropertyGrid.tsx`.
- ✅ **Página de listado** `/propiedades` (Server Component, force-dynamic) con grid + filtros.
- ✅ **Página de detalle** `/propiedades/[id]` con galería, specs y `generateMetadata` SEO.
- ✅ **Capa de datos** centralizada en `lib/properties.ts` (`getPublished`, `getById`) + `lib/types.ts`.
- ✅ **Leads por WhatsApp**: `OwnerForm` abre `wa.me/59899972906` con el mensaje prearmado. `Contact` ya tenía links WhatsApp/email.
- ✅ Botón "Ver todas las propiedades" → ahora enlaza a `/propiedades`.

Notas para el deploy:
- Las env vars de Supabase **ya están** en `.env.local` (gitignored). `opennextjs-cloudflare build` las toma solas. NO exportar placeholders al hacer el build real.
- Para "Obra nueva" con datos reales del CRM hace falta un flag/columna (hoy `isNew=false` para items de Supabase; el filtro funciona con el fallback i18n). Si el CRM expone `es_obra_nueva`, agregarlo al SELECT de `lib/properties.ts` y a `mapRow`.

Pendiente real tras esta tanda:
- [ ] Rebuild + redeploy del worker con las env vars reales (ya disponibles).
- [ ] Push de los commits a GitHub (requiere token).
- [ ] (Opcional) Columna obra nueva / inversión en el CRM para enriquecer filtros.
