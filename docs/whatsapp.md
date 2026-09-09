# Módulo WhatsApp — arquitectura y operación

Ingesta de conversaciones de WhatsApp Business vía **Cloud API oficial**, con
retención de 90 días y consultas en lenguaje natural sobre lo almacenado.

Principio rector: **guardar liviano, analizar bajo demanda**. Ningún mensaje se
manda a Claude automáticamente; Claude entra solo cuando vos hacés una pregunta,
y recibe únicamente los mensajes que la búsqueda en Postgres seleccionó.

---

## Estado

| Fase | Alcance | Estado |
|---|---|---|
| 1 | Estructura, config, validación de firma, rutas públicas | ✅ verificado |
| 2 | Esquema, índices, FTS, RLS, retención + cron | ✅ aplicado en producción y verificado |
| 3 | Webhook: verificación, HMAC, normalización, dedupe, ingesta | ✅ verificado contra el dev server |
| 4 | Búsqueda: fecha, contacto, conversación, texto completo | ✅ verificado contra la base real |
| 5 | Consultas a Claude + página `/whatsapp` | ⚠️ código listo, sin probar contra la API |
| 6 | Logging, métricas de costo, evaluación de embeddings | ⏳ |

**Pendiente para que funcione de punta a punta:**

1. **Saldo en la cuenta de Anthropic.** Las consultas fallan con
   `Your credit balance is too low`. El camino planner → recuperación →
   respuesta está probado con el fetch interceptado (requests bien formadas,
   parseo y costeo correctos), pero nunca corrió contra la API real.
2. **Alta en Meta** (App Secret, token del System User, Embedded Signup v4).
3. **Copiar las variables a Vercel**, en especial `CRON_SECRET`: sin ella el
   cron diario responde 500 (falla cerrado, no borra nada, pero ensucia logs).
   `WHATSAPP_VERIFY_TOKEN` y `CRON_SECRET` ya están generadas en `.env.local`.
4. **Verificación visual de `/whatsapp`**: la página compila y el middleware la
   protege, pero no se vio renderizada porque requiere una sesión iniciada.

---

## Arquitectura

```
WhatsApp Cloud API (Meta)
   │  webhook POST firmado (HMAC-SHA256 con el App Secret)
   ▼
/api/whatsapp/webhook ── valida firma → normaliza → upsert idempotente → 200
   │                                       │ (siempre)
   │                                       ▼
   │                                 wa_eventos_log  (dead-letter reprocesable)
   ▼
wa_conversaciones ─1:N─ wa_mensajes        (FTS español sin tildes + índices)
        └── contacto_id ─→ contactos       (CRM existente)
   ▲
   │ 1) planner (Haiku)  pregunta → filtros estructurados
/api/whatsapp/consultar  2) recuperación en Postgres  ── agregados → SQL puro
   │                     3) contexto mínimo → Claude
   ▼
/whatsapp   bandeja + buscador + chat de consultas

Vercel Cron diario → /api/whatsapp/retencion → wa_purgar_mensajes(90)
pg_cron semanal (respaldo, corte fijo 120 días) ──┘
```

### Por qué dentro del CRM y no como servicio aparte

Infra $0 (webhook = un route handler en el deploy que ya existe), Supabase y
`@anthropic-ai/sdk` ya instalados, y —lo importante— cada conversación queda
enlazada al `contacto` y sus `leads`. En JavaScript porque el repo es JS por
decisión explícita; meter TypeScript para un módulo agregaría configuración de
build sin beneficio proporcional.

### Por qué no hay embeddings

El planner LLM hace **expansión semántica de la consulta** ("financiación" →
`financiación, cuotas, crédito, hipotecario, plan de pago`) por ~US$0.001, que
es exactamente lo que comprarían los embeddings, sin storage ni pipeline nuevo.
Sumado a eso, la búsqueda de texto es **insensible a tildes** (configuración
`es_unaccent`), que es el fallo real de FTS en español desde el celular.

Costo comparado, a volumen de ~3.000 mensajes/mes:

| | Diseño actual | Con embeddings |
|---|---|---|
| Storage por 90 días | ~5 MB | ~100 MB (vectores + índice HNSW) |
| Proveedores | Anthropic | Anthropic + Voyage/OpenAI |
| Modos de falla nuevos | 0 | backfill, reintentos, desync |

**Reevaluar si**: se superan ~50.000 mensajes en la ventana, o si medimos recall
pobre sobre consultas reales. No antes.

### Multimedia

Solo metadatos (`tipo`, `media_id`, `media_mime`, `media_filename`, caption como
`texto`). Los archivos **no se descargan**. `media_id` no es un puntero durable:
Meta expira las URLs en minutos y retiene el archivo ~30 días, así que sirve como
rastro de auditoría, no para recuperarlo el día 60. La arquitectura admite
agregar después una descarga bajo demanda dentro de esa ventana.

---

## Coexistence: cómo entra el número

El número se usa hoy desde la **app WhatsApp Business del celular**. Conectarlo a
Cloud API de la forma clásica lo sacaría de la app. La solución es
**Coexistence** (Meta, desde mayo 2025): app y Cloud API sobre el mismo número.

Consecuencias de diseño:

1. **Los salientes llegan por webhook.** Lo que el equipo escribe desde el
   celular llega como campo `smb_message_echoes`. Sin eso no habría forma
   legítima de saber si un cliente recibió respuesta.
2. **Tres formas de payload**, no una: `messages` (entrantes),
   `smb_message_echoes` (salientes desde la app) e `history` (carga inicial).
   Por eso existe `wa_mensajes.origen`.
3. **El historial inicial trae 180 días**, el doble de la retención. La ingesta
   lo filtra a la ventana configurada para no cargar datos que la purga borraría
   al día siguiente.
4. **Embedded Signup v4.** La v2 se apaga el 8 de octubre de 2026. El alta es un
   flujo JavaScript en el navegador (Fase 3: página `/whatsapp/conectar`).
5. No soporta grupos, mensajes temporales, view-once ni listas de difusión.

---

## Variables de entorno

Todas en `.env.local` (local, gitignored) y en Vercel → Settings → Environment
Variables (producción). Ninguna credencial va en el código.

| Variable | Para qué | De dónde sale |
|---|---|---|
| `WHATSAPP_GRAPH_VERSION` | Versión de Graph API (`v26.0`) | fija |
| `WHATSAPP_VERIFY_TOKEN` | Handshake GET del webhook | lo inventás vos y lo pegás en Meta |
| `WHATSAPP_APP_SECRET` | Valida la firma HMAC de cada webhook | App de Meta → Configuración → Básica |
| `WHATSAPP_TOKEN` | Llamadas a la Graph API | System User de Business Manager (token permanente) |
| `WHATSAPP_PHONE_NUMBER_ID` | Número emisor | lo devuelve el alta |
| `WHATSAPP_WABA_ID` | Cuenta de WhatsApp Business | lo devuelve el alta |
| `MESSAGE_RETENTION_DAYS` | Días de retención (default 90) | vos |
| `CRON_SECRET` | Autentica el cron de Vercel | `openssl rand -hex 32` |
| `WHATSAPP_STORE_STATUSES` | Guardar sent/delivered/read (default `false`) | vos |
| `WHATSAPP_MODELO_PLANNER` | Traduce la pregunta a filtros | `claude-haiku-4-5` |
| `WHATSAPP_MODELO_CONSULTA` | Redacta la respuesta | `claude-sonnet-5` |

`ANTHROPIC_API_KEY` ya existe en el proyecto.

### Alta en Meta (lo hacés vos)

1. Meta Business Account + **verificación de empresa** (es lo que más tarda).
2. App de Meta tipo *Business* con el producto **WhatsApp** → App ID + App Secret.
3. **System User** en Business Manager con permisos `whatsapp_business_messaging`
   y `whatsapp_business_management` → generar token permanente.
4. Webhook: `https://mvdprime-crm.vercel.app/api/whatsapp/webhook` + el verify
   token. Suscribir los campos `messages`, `smb_message_echoes` y `history`.

---

## Base de datos

Migración: `supabase/migrations/20260909_whatsapp.sql`. Es idempotente y se corre
en **Supabase → SQL Editor** (el `SUPABASE_ACCESS_TOKEN` está vencido, así que la
Management API no está disponible).

### `wa_conversaciones`
Un hilo por número (`wa_id`, clave natural única). `contacto_id` enlaza al CRM.

`sin_responder` es una **columna generada**:

```sql
ultimo_entrante_at IS NOT NULL
AND (ultimo_saliente_at IS NULL OR ultimo_entrante_at > ultimo_saliente_at)
```

*"Mostrame los clientes que escribieron y no recibieron respuesta"* se contesta
con un `WHERE sin_responder` sobre un índice parcial. Cero tokens de Claude.

### `wa_mensajes`
`wa_message_id UNIQUE` es la defensa contra duplicados: Meta reintenta los
webhooks, y la ingesta usa `ON CONFLICT DO NOTHING`.

`texto_tsv` es generada con `to_tsvector('public.es_unaccent', texto)` + índice
GIN. La configuración `es_unaccent` es `spanish` + diccionario `unaccent`, así
que "financiacion" encuentra "financiación". Si `unaccent` no estuviera
disponible en la instancia, la migración deja `es_unaccent` como copia de
`spanish` y todo lo demás funciona igual.

**Sobre `expira_at`:** no existe como columna, a propósito. Una columna generada
debe ser inmutable y por lo tanto no puede leer `MESSAGE_RETENTION_DAYS`; un
`expira_at` fijo a 90 días se desincronizaría en cuanto cambies la variable.
`ts` (indexado) es información suficiente para calcular el vencimiento, y la
fuente de verdad de la política es la env var.

### `wa_eventos_log`
Payload crudo de cada webhook, mismo patrón que `lead_ingesta_log`: si la
normalización falla, el mensaje no se pierde y se reprocesa desde acá.
Retención propia de 14 días.

### `wa_purga_log`
Una fila por corrida de purga: corte aplicado, filas borradas, duración.

### RLS
Lectura para `authenticated`, escritura solo `service_role`. Políticas planas a
propósito: nada de subconsultas contra `usuarios`, para no repetir la recursión
42P17 (`rls-recursion-usuarios`).

---

## Retención

`wa_purgar_mensajes(dias, simular, origen, lote)` con **cuatro protecciones**:

1. **Piso duro**: `greatest(dias, 30)`. Aunque llegue `dias=1`, nunca borra nada
   de menos de 30 días.
2. **Lotes de 5.000 filas**: no toma locks largos.
3. **`simular=true`**: dry-run, cuenta sin borrar.
4. **`wa_purga_log`**: cada corrida queda auditada.

Después de borrar recalcula los agregados de cada conversación
(`wa_recalcular_conversaciones()`), porque si no `sin_responder` mentiría; luego
elimina conversaciones sin mensajes y sin vínculo al CRM.

**Disparo primario**: Vercel Cron diario 07:00 UTC (04:00 Uruguay) →
`/api/whatsapp/retencion`, que lee `MESSAGE_RETENTION_DAYS`.
**Respaldo**: job `pg_cron` semanal con corte fijo de 120 días, por si Vercel
está caído. Nunca depende de un borrado manual.

```bash
# Dry-run contra producción
curl -H "x-cron-secret: $CRON_SECRET" \
  "https://mvdprime-crm.vercel.app/api/whatsapp/retencion?simular=true"
```

---

## Qué se verificó (2026-09-09)

La migración se aplicó al proyecto de producción y se probó con datos
sintéticos que después se borraron. La base quedó vacía.

- **Esquema (22 chequeos):** tablas, 15 índices, RLS en las 4 tablas, dedupe por
  `wa_message_id`, `sin_responder` en ambos sentidos, FTS con y sin tildes,
  reconstrucción cronológica, dry-run, piso duro de 30 días, purga real
  borrando solo lo vencido, conversación huérfana eliminada, auditoría.
- **Normalización y búsqueda (33 chequeos):** los tres formatos de payload
  (`messages`, `smb_message_echoes`, `history`), dirección deducida por número
  de negocio, filtro de la ventana de retención, tsquery con OR entre términos,
  FTS por PostgREST con la configuración `es_unaccent`, agrupación por
  conversación y presupuesto de tokens.
- **Webhook contra el dev server (23 chequeos):** handshake correcto y
  rechazado, POST sin firma / con firma inválida → 401 sin escribir nada,
  firma válida → ingesta, reintento de Meta → 0 duplicados, echo del celular
  guardado como saliente, campo desconocido ignorado, endpoint de retención
  con y sin secreto.

**Un hallazgo de seguridad, encontrado por estas pruebas:** revocar la función
de purga de `PUBLIC` no alcanzaba. Supabase concede `EXECUTE` a `anon` y
`authenticated` por default privileges, así que cualquiera con la anon key
—que viaja en el JavaScript de la web pública— podía llamar
`POST /rest/v1/rpc/wa_purgar_mensajes` y borrar conversaciones. Se revocó
explícitamente de ambos roles y se verificó que solo `service_role` puede
ejecutarla.

## Trampas conocidas

- **Middleware**: `/api/whatsapp/webhook` y `/api/whatsapp/retencion` están en
  `APIS_PUBLICAS` (`lib/supabase/middleware.js`). Sin eso el middleware devuelve
  401 y Meta termina desactivando el webhook — el mismo bug que costó el 100% de
  los leads web en julio.
- **La firma se calcula sobre el cuerpo crudo.** Hay que leer con
  `await request.text()` y validar **antes** de parsear. Un `JSON.parse` +
  `JSON.stringify` cambia los bytes y el HMAC nunca coincide.
- **Responder 200 siempre** (salvo firma inválida). Un 500 hace que Meta
  reintente y eventualmente desactive el webhook; los errores van a
  `wa_eventos_log`. Mismo criterio que `/api/mercadolibre/notificaciones`.
- **`main` tiene que quedar buildeable**: no dejar imports a archivos sin
  commitear (incidente del 24/07).

---

## Costos

| Componente | Mensual |
|---|---|
| Cloud API — recibir mensajes | $0 |
| Cloud API — responder dentro de la ventana de 24 h | $0 |
| Cloud API — plantillas (solo si iniciamos nosotros) | por mensaje, fuera del alcance inicial |
| Supabase | $0 — ~5 MB por 90 días; el plan free da 500 MB |
| Vercel | $0 — Hobby existente |
| Claude | ~US$2–6 con 100 consultas/mes |

Por consulta: agregada (sin respuesta, conteos) US$0; detalle con Sonnet 5
~US$0.02–0.06; con Opus 5 ~US$0.10.
