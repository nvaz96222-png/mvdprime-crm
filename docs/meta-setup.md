# Integración con Meta (WhatsApp / Instagram / Lead Ads) — setup

> Checklist para conectar el CRM a Meta. La Fase 1 hace que **leads y mensajes
> de Meta entren solos al CRM**. Las respuestas desde el CRM y el agente IA son
> Fases 2 y 3.

El webhook ya está implementado en el código:
`POST /api/meta/webhook` (verificación + recepción de eventos, firma HMAC).

---

## 0. Antes de empezar
- Cuenta de **Facebook Business** (Business Manager) con tu página y tu número
  de **WhatsApp Business** actuales.
- Acceso de admin al proyecto en **Vercel** (para cargar variables).
- El número de WhatsApp que ya usás: lo conectamos por **Embedded Signup con
  coexistencia** — no perdés la app ni el historial del teléfono.

## 1. Crear la app en Meta
1. https://developers.facebook.com → **My Apps → Create App** → tipo **Business**.
2. Anotá el **App ID** y el **App Secret** (Settings → Basic → App Secret → "Show").
   → `META_APP_SECRET`.
3. Agregá los productos: **WhatsApp**, **Messenger/Instagram** y **Webhooks**.

## 2. Verificar el negocio
- Business Settings → **Security Center → Business Verification**.
- Necesario para permisos avanzados de WhatsApp/IG y para subir límites de envío.

## 3. Variables en Vercel (Production + Preview)
Cargalas en Vercel → Project → Settings → **Environment Variables** (sin comillas):

| Variable | De dónde sale |
|---|---|
| `META_APP_SECRET` | App → Settings → Basic |
| `META_VERIFY_TOKEN` | **lo inventás vos** (string random); lo repetís al suscribir el webhook |
| `META_PAGE_ACCESS_TOKEN` | Token de la página (Lead Ads + perfil de Instagram) |
| `META_WA_ACCESS_TOKEN` | Token del sistema de WhatsApp (envío, Fase 2) |
| `META_WA_PHONE_NUMBER_ID` | WhatsApp → API Setup → "Phone number ID" |
| `META_WABA_ID` | WhatsApp → API Setup → "WhatsApp Business Account ID" |
| `META_IG_ACCOUNT_ID` | ID de la cuenta de Instagram vinculada |
| `META_GRAPH_VERSION` | opcional (default `v21.0`) |

> También tiene que estar `SUPABASE_SERVICE_ROLE_KEY` (ya la usa el CRM).
> **Nunca** commitear estos valores: van solo en Vercel y en `.env.local` local.

## 4. Suscribir el webhook
1. App → **Webhooks** (o WhatsApp → Configuration → Webhook).
2. **Callback URL:** `https://<tu-dominio-vercel>/api/meta/webhook`
   (p. ej. `https://mvdprime-crm.vercel.app/api/meta/webhook`).
3. **Verify Token:** el mismo valor que pusiste en `META_VERIFY_TOKEN`.
4. Al guardar, Meta hace un GET de verificación → debe quedar **verificado** (✓).
5. Suscribí los campos:
   - **WhatsApp Business Account:** `messages`, `message_echoes` (o
     `smb_message_echoes` para coexistencia), `message_template_status_update`.
   - **Page (Lead Ads):** `leadgen`.
   - **Instagram:** `messages` (mensajería de Instagram).

## 5. Conectar tu WhatsApp con coexistencia (Embedded Signup)
- WhatsApp → **API Setup / Embedded Signup** → elegí tu número **existente** y la
  opción de **coexistencia** (seguís usando la app de WhatsApp Business en el
  celular y además recibís los mensajes por la API).
- Resultado: los mensajes entrantes llegan al webhook; lo que respondas desde el
  **celular** llega como **eco** (`message_echoes`) y queda en el historial del CRM.

## 6. Conectar Instagram
- Vinculá la cuenta de Instagram (profesional) a tu página de Facebook.
- En Messenger/Instagram → **Access** y permisos, habilitá la mensajería.
- Suscribí `messages` de Instagram en el webhook.

## 7. Permisos (App Review cuando salgas de modo desarrollo)
- `whatsapp_business_messaging`, `whatsapp_business_management`
- `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`
- `instagram_manage_messages`, `instagram_basic`
- `business_management`

## 8. Vincular anuncios a propiedades (en el CRM)
- En la ficha de cada propiedad (**Propiedades → editar**) hay una sección
  **"Anuncios de Meta"**: pegá el **ID del anuncio** (Ads Manager → columna
  "ID del anuncio") y guardá.
- Con eso, los leads de ese aviso (Lead Ads) y los mensajes **Click-to-WhatsApp**
  se asignan **solos** a esa propiedad.

## 9. Probar
- **Lead Ads:** Meta → **Lead Ads Testing Tool**
  (https://developers.facebook.com/tools/lead-ads-testing) → elegí la página y el
  formulario → **Create Lead**. Debe aparecer el lead en el CRM (origen
  `meta_ads`) y una fila `ok` en `lead_ingesta_log`.
- **WhatsApp:** mandá un mensaje a tu número → se crea conversación + mensaje +
  lead. Si venís desde un anuncio CTWA, queda atribuido a la propiedad.
- **Instagram:** mandá un DM a la cuenta → conversación + lead (sin teléfono).
- **Local / simulado:** `node scripts/meta-webhook-test.mjs http://localhost:3000`
  (firma válida/ inválida, duplicados, ecos y estados).

## 10. Diagnóstico
```sql
-- Últimos eventos de Meta registrados
SELECT estado, error, payload, created_at
FROM lead_ingesta_log
WHERE canal = 'meta'
ORDER BY created_at DESC
LIMIT 50;

-- Conversaciones y mensajes recientes
SELECT * FROM conversaciones ORDER BY ultimo_mensaje_at DESC NULLS LAST LIMIT 20;
SELECT * FROM mensajes ORDER BY created_at DESC LIMIT 50;
```
> Si el webhook se "deshabilita" en Meta, suele ser porque devolvió != 200:
> revisá los logs de Vercel y `lead_ingesta_log`.
