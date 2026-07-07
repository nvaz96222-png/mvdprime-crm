# Arquitectura de ingesta de leads — MVD Prime CRM

> Última actualización: 2026-07-07
> Auditoría y fix: los formularios públicos perdían el 100% de los leads por
> dos bugs independientes (ver "Historial de incidentes" al final).

## Diagrama general

```
CANAL                      ENTRADA                        PIPELINE                    CRM
─────                      ───────                        ────────                    ───
Ficha propiedad /p/[id] ─→ POST /api/contacto-web ──┐
Desarrollos /desarrollos → POST /api/contacto-proyecto ─┤
Meta Ads / Google Ads /                                 ├─→ lib/leads/ingesta.js ─→ contactos
Zapier / Make / landings → POST /api/leads/inbound ─────┤    (ingestarLead)          leads
Preguntas MercadoLibre  ─→ POST /api/mercadolibre/      │         │                  interacciones
                            notificaciones ─────────────┘         ↓
Manual (agente)         ─→ LeadForm en el CRM            lead_ingesta_log
                            (client-side, con sesión)     (trazabilidad de TODO)
```

**Regla de oro:** todo canal automatizado pasa por `ingestarLead()` en
[lib/leads/ingesta.js](../lib/leads/ingesta.js). Nunca insertar leads
directamente desde una API route.

## El pipeline `ingestarLead()`

Pasos (cada uno con su registro de trazabilidad):

1. **Log "recibido"** — el payload completo se guarda en `lead_ingesta_log`
   ANTES de validar. Si todo lo demás explota, el lead es recuperable.
2. **Validación** — nombre y teléfono requeridos (salvo `permitirSinTelefono`,
   ej. preguntas ML que no traen teléfono). Falla → log `invalido`.
3. **Contacto** — dedupe por teléfono (sin espacios), fallback por email.
   Si no existe, se crea. Reintento automático x1 ante error transitorio.
4. **Lead** — `etapa=nuevo`, con origen validado contra la lista de la DB,
   notas con mensaje + UTM (campaña/medio/anuncio/referrer) + canal.
5. **Interacción** — nota de trazabilidad en el historial del lead (no bloqueante).
6. **Log final** — `ok` (con `lead_id` + `contacto_id`) o `error` (con
   `paso_fallido` y mensaje).

## Tabla `lead_ingesta_log`

| Columna | Uso |
|---|---|
| `canal` | `contacto-web` \| `contacto-proyecto` \| `inbound` \| `mercadolibre` |
| `estado` | `recibido` → `ok` \| `error` \| `invalido` |
| `paso_fallido` | `validacion` \| `contacto` \| `lead` \| `interaccion` |
| `payload` | JSON completo del intento — sirve de dead-letter queue |
| `contacto_id`, `lead_id` | FK del resultado si fue `ok` |
| `ip`, `user_agent`, `referer` | contexto del request |

### Monitoreo — detectar leads perdidos

```sql
-- Fallas de las últimas 48hs
SELECT canal, paso_fallido, error, payload, created_at
FROM lead_ingesta_log
WHERE estado IN ('error') AND created_at > now() - interval '48 hours'
ORDER BY created_at DESC;

-- Salud por canal (últimos 7 días)
SELECT canal, estado, count(*)
FROM lead_ingesta_log
WHERE created_at > now() - interval '7 days'
GROUP BY canal, estado ORDER BY canal;
```

### Reprocesar un lead que falló

El payload queda completo en el log. Reenviarlo por el webhook genérico:

```bash
curl -X POST https://mvdprime-crm.vercel.app/api/leads/inbound \
  -H "x-ingest-token: $LEADS_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '<payload de la fila del log>'
```

## Canales

### 1. Formulario ficha pública (`/p/[id]`)

- **Componente:** [components/public/FormContacto.js](../components/public/FormContacto.js)
- **API:** `POST /api/contacto-web` (pública, sin sesión)
- **Campos enviados:** nombre*, teléfono*, email, mensaje, propiedad_id,
  propiedad_titulo, `utm` (source/medium/campaign/term/content/referrer
  capturados de la URL), `_hp` (honeypot)
- **Validaciones:** requeridos + límites de largo; honeypot descarta bots
  silenciosamente (responde ok sin insertar).
- **Resultado:** contacto (dedupe por teléfono) + lead `origen=web` +
  interacción + log.
- **Probar:** `curl -X POST .../api/contacto-web -H "Content-Type: application/json" -d '{"nombre":"Test","telefono":"099111222"}'` → `{"ok":true}` y fila en `lead_ingesta_log` con estado `ok`.

### 2. Formulario desarrollos (`/desarrollos/[slug]`)

- **Componente:** [components/public/FormContactoProyecto.js](../components/public/FormContactoProyecto.js)
- **API:** `POST /api/contacto-proyecto` (pública)
- **Extra:** asigna automáticamente el `agente_id` del proyecto y registra
  evento `form_enviado` en `proyecto_eventos` (analytics).

### 3. Webhook genérico (`/api/leads/inbound`)

Para **Meta Lead Ads, Google Ads, Zapier, Make** o cualquier canal futuro.

- **Auth:** header `x-ingest-token` = env `LEADS_INGEST_TOKEN`
  (en `.env.local` y Vercel Production).
- **Body:** `{ origen, nombre*, telefono*, email, mensaje, campana, medio, anuncio, propiedad_id, proyecto_id }`
- **Orígenes válidos:** `mercadolibre, whatsapp, instagram, infocasas, gallito, referido, directo, web, meta_ads, google_ads, otro` (otros caen a `otro`).
- **Conectar Meta Lead Ads:** Zapier/Make → trigger "Facebook Lead Ads →
  New Lead" → action HTTP POST a este endpoint con el token.
- **Conectar Google Ads:** webhook de lead form extension apuntando acá
  (o vía Zapier igual que Meta).

### 4. MercadoLibre — preguntas (`/api/mercadolibre/notificaciones`)

- **Configurar:** en la app ML (developers.mercadolibre.com.uy) → Notificaciones
  → Callback URL: `https://mvdprime-crm.vercel.app/api/mercadolibre/notificaciones`
  → Tópico: `questions`.
- **Flujo:** ML notifica `{topic:"questions", resource:"/questions/ID"}` →
  se registra SIEMPRE en el log → GET a la API ML por la pregunta y el
  nickname del usuario → mapea `item_id` → propiedad del CRM vía
  `propiedades.ml_item_id` → lead `origen=mercadolibre` sin teléfono
  (ML no lo expone en preguntas).
- **Prerequisito:** cuenta ML conectada (OAuth vía `/api/mercadolibre/conectar`).
- **Siempre responde 200** (ML reintenta si no) — los errores quedan en el log.

### 5. WhatsApp — estado actual: SIN integración automática

Los botones de WhatsApp del CRM y la web abren `wa.me` → la conversación
va al teléfono de la agencia, **no genera lead automático**. Opciones:

- **Hoy (manual):** el agente crea el lead desde el CRM con origen `whatsapp`.
- **Futuro (automático):** WhatsApp Business Cloud API (requiere verificación
  del negocio en Meta) → webhook de mensajes entrantes → POST a
  `/api/leads/inbound` con `origen=whatsapp`. El punto de entrada ya existe.

### 6. Manual (CRM)

`LeadForm` en `/leads/nuevo` — usuario autenticado, client-side con RLS.
No pasa por el pipeline (no lo necesita: el agente es la validación).

## Seguridad / middleware

[lib/supabase/middleware.js](../lib/supabase/middleware.js) define:

- `APIS_PUBLICAS` — pasan sin sesión (los endpoints validan lo suyo:
  honeypot, token, code OAuth).
- Resto de `/api/*` sin sesión → **401 JSON** (nunca redirect a /login).
- Rutas de página sin sesión → redirect a `/login` (igual que siempre).

**⚠️ Al agregar una API pública nueva hay que sumarla a `APIS_PUBLICAS`,
si no el middleware la bloquea con 401/redirect.**

## Cómo agregar un canal nuevo

1. Crear `app/api/<canal>/route.js` que llame a `ingestarLead()` con un
   `canal` identificatorio.
2. Si recibe tráfico anónimo → agregarlo a `APIS_PUBLICAS` en
   `lib/supabase/middleware.js` y protegerlo (token o validación propia).
3. Si usa un `origen` nuevo → agregarlo al CHECK `leads_origen_check`
   (migración SQL) **y** a `ORIGENES` en `lib/constants.js` **y** al set
   `ORIGENES_VALIDOS` de `lib/leads/ingesta.js`.
4. Probar con curl y verificar la fila en `lead_ingesta_log`.

## Historial de incidentes

**2026-07-07 — Pérdida total de leads web (resuelto).** Dos bugs independientes:

1. El matcher del middleware cubría `/api/*` y redirigía a `/login` todo
   request sin sesión → los POST anónimos de los formularios públicos nunca
   llegaban a la API (evidencia: `curl` devolvía `307 → /login`). También
   rompía el callback OAuth de ML y los eventos de analytics.
2. El CHECK `leads_origen_check` de la DB no incluía `'web'` → aunque el
   request llegara, el INSERT fallaba (la lista de `constants.js` estaba
   desalineada con la migración).

Por qué no se detectó: probado siempre con sesión de agente activa (las
cookies pasaban el middleware) y el constraint nunca se ejercitó porque
el middleware bloqueaba antes. La ficha pública cargaba 200 OK, solo el
submit fallaba. Fix: `APIS_PUBLICAS` + constraint alineado + pipeline con
`lead_ingesta_log` para que una pérdida silenciosa no pueda repetirse.
