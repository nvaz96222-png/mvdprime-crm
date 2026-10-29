# Bandeja de chats — MVD Prime CRM

> Fase 2a · 2026-10-29

Pantalla `/chats`: WhatsApp, Instagram y Messenger en un solo lugar, con una
interfaz similar a WhatsApp (en el celular primero la lista y después el chat
a pantalla completa).

## Qué hace

| Función | Dónde |
|---|---|
| Lista de conversaciones con no leídos, último mensaje, etapa y propiedad | `components/chats/ListaConversaciones.js` |
| Filtros: Todos / Sin leer / Míos, canal, etapa y **propiedad** | ídem (`?propiedad=<id>` en la URL lo preselecciona) |
| Chat con burbujas, tildes de estado, separadores por día, firma de IA / celular / compañero | `components/chats/VistaChat.js` |
| Enviar texto (optimista, con reintento si falla) | `POST /api/chats/enviar` |
| Regla de 24 h: fuera de la ventana no se puede escribir texto libre; en WhatsApp se ofrece abrir la app del celular | `lib/chats/ventana.js` |
| Marcar leído (CRM + tildes azules en WhatsApp / "visto" en IG y Messenger) | `POST /api/chats/[id]/leer` |
| Ficha del lead: etapa, prioridad, asignación, propiedades de interés, origen | `components/chats/PanelLead.js` |
| Enviar ficha de propiedad (link a `/p/[id]`) y sumarla a los intereses del lead | `components/chats/ModalFicha.js` |
| Tiempo real (Supabase Realtime) en la lista, el chat y el contador del menú | `components/chats/api.js`, `components/Sidebar.js` |
| Llamar con un toque (`tel:`) | encabezado del chat |

Link directo a un chat: `/chats?c=<conversacion_id>`.

## Reglas

- **Permisos** (migración `20261029_chats_permisos.sql`): igual que los leads.
  El admin ve todas las conversaciones; cada agente, las asignadas a él o cuyo
  lead es suyo. Las nuevas sin asignar las ve el admin y las asigna desde la
  ficha. Quien responde primero un chat sin dueño queda asignado (y su lead).
- **IA:** cuando una persona escribe (desde el CRM o desde la app del celular),
  `conversaciones.ia_pausada_hasta` se corre 12 h. El agente IA (Fase 3)
  respetará esa pausa.
- **Escritura:** conversaciones, mensajes y `lead_propiedades` solo se escriben
  con service_role, a través de las API routes (`lib/chats/servidor.js`), que
  validan sesión y permisos. Etapa y prioridad del lead se editan directo
  (RLS de leads).

## Variables (ya cargadas para la Fase 1)

`META_WA_ACCESS_TOKEN`, `META_WA_PHONE_NUMBER_ID` (enviar por WhatsApp) y
`META_PAGE_ACCESS_TOKEN` (Instagram y Messenger). Ver `docs/meta-setup.md`.

## Pendiente — Fase 2b

Plantillas aprobadas para retomar chats fuera de las 24 h, notificaciones push
de la PWA, ver y mandar fotos/documentos, accesos desde el kanban y pestaña
"Consultas" en la ficha de cada propiedad.
