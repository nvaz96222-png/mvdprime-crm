# MVDPrime Real Estate CRM

CRM inmobiliario construido con Next.js 14 (App Router), Tailwind CSS y Supabase.

## Stack

- Next.js 14 (App Router, JavaScript)
- Tailwind CSS
- Supabase (`@supabase/supabase-js` + `@supabase/ssr`)
- Supabase Auth (sesión por cookies, protección de rutas en middleware)

## Arranque

```bash
npm install
npm run dev
```

Las credenciales viven en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Estructura

```
app/
  layout.js            # layout raíz (fuente + metadata, lang es)
  page.js              # redirige a /dashboard
  login/page.js        # Módulo 1 — pantalla de login
  (app)/
    layout.js          # layout protegido (sidebar + guard de sesión)
    dashboard/page.js  # placeholder (Módulo 5)
components/
  Sidebar.js           # navegación + datos del usuario + logout
lib/supabase/
  client.js            # cliente browser
  server.js            # cliente server (cookies)
  middleware.js        # refresco de sesión + protección de rutas
  getPerfil.js         # carga el perfil desde `usuarios` (defensivo)
middleware.js          # entrada del middleware
```

## Módulos

- [x] **Módulo 1 — Auth**: login, protección de rutas, logout, datos del usuario en sidebar.
- [x] **Módulo 2 — Propiedades**: listado con filtros (tipo/operación/estado/barrio),
      tarjetas con cambio de estado rápido, formulario crear/editar con todos los
      campos y carga múltiple de fotos a Storage.
- [x] **Módulo 3 — Leads y Pipeline**: kanban con drag & drop por etapa, tarjeta de
      lead (contacto/propiedad/origen/fecha/agente), formulario crear lead + crear
      contacto en el mismo paso, detalle con historial de interacciones y asignación
      de agente.
- [x] **Módulo 4 — Contactos**: listado con búsqueda (nombre/teléfono/email) y contador
      de leads, perfil de contacto con sus leads asociados, formulario crear/editar
      (incluye barrios de interés y presupuesto).
- [x] **Módulo 5 — Dashboard**: KPIs (propiedades disponibles, leads nuevos hoy, leads
      activos, contactos), gráfico de leads por etapa, propiedades por estado, actividad
      reciente (últimas interacciones) y alerta de leads sin contactar hace +3 días.

### Setup de infraestructura requerido en Supabase

Para que los módulos que leen/escriben datos funcionen:

1. **RLS** — ejecutar [`supabase/rls_fix.sql`](supabase/rls_fix.sql) (ver abajo).
2. **Storage** — ejecutar [`supabase/storage_setup.sql`](supabase/storage_setup.sql)
   para crear el bucket `propiedades` y sus políticas (necesario para subir fotos).

---

## ⚠️ BLOQUEANTE: recursión infinita en RLS de `usuarios`

Al conectar contra Supabase, **todas** las tablas devuelven:

```
code 42P17 — infinite recursion detected in policy for relation "usuarios"
```

La política RLS de `usuarios` se consulta a sí misma (patrón típico: "para saber
si el usuario es admin, hago SELECT sobre usuarios"), lo que genera recursión.
Como las demás tablas (`propiedades`, `leads`, `contactos`, etc.) también
verifican el rol consultando `usuarios`, **ninguna tabla se puede leer**.

El **login NO está afectado** (Supabase Auth es independiente), pero ningún
módulo que lea datos funcionará hasta resolver esto.

### Fix (ejecutar en el SQL Editor de Supabase)

El fix completo y autocontenido está en **[`supabase/rls_fix.sql`](supabase/rls_fix.sql)**.

Resumen: el vínculo Auth ↔ `usuarios` es la columna `auth_id` (= `auth.uid()`),
mientras que `usuarios.id` es el ID interno al que apuntan `leads.agente_id`,
`propiedades.agente_id`, `interacciones.usuario_id`, etc. El fix crea dos
funciones `SECURITY DEFINER` (`mi_rol()` y `mi_usuario_id()`) que leen sin
disparar RLS, y reemplaza las políticas recursivas de `usuarios`. Arreglando
solo `usuarios` (la raíz), el resto de las tablas vuelve a leerse.
