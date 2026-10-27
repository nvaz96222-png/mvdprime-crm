-- =====================================================================
-- MVDPrime CRM — Integración Meta (WhatsApp / Instagram / Lead Ads) — Fase 1
-- Fecha: 2026-10-27
--
-- Centraliza en el CRM los clientes que llegan por publicidad de Meta:
--   · Lead Ads (formularios instantáneos)
--   · WhatsApp Cloud API (mensajes)
--   · Instagram Messaging (DMs)
--
-- Diseñado pensando en las Fases 2 (bandeja de chats) y 3 (agente IA):
--   · conversaciones.ia_activa / ia_pausada_hasta ya existen desde ahora.
--   · mensajes.autor incluye 'ia'.
--   · Realtime activado en conversaciones y mensajes (se usa en Fase 2).
--
-- RLS: lectura para authenticated (diagnóstico/uso en el CRM), escritura
--      solo service_role (bypassa RLS), igual criterio que lead_ingesta_log.
--
-- Reutiliza public.handle_updated_at() creada en 20260624_proyectos.sql.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 0 — VERIFICACIÓN PRE-VUELO (ejecutar por separado ANTES)
-- ─────────────────────────────────────────────────────────────────────
/*
-- [A] handle_updated_at() debe existir (1 fila)
SELECT routine_name FROM information_schema.routines
WHERE routine_schema='public' AND routine_name='handle_updated_at';

-- [B] Tablas nuevas NO deben existir aún (0 filas)
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('conversaciones','mensajes','meta_anuncios','lead_propiedades');

-- [C] Columnas nuevas NO deben existir aún (0 filas)
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND (
  (table_name='leads'     AND column_name IN ('meta_ad_id','meta_campaign','ctwa_clid','meta_lead_id')) OR
  (table_name='contactos' AND column_name='instagram_id')
);

-- [D] leads_origen_check debe permitir whatsapp/instagram/meta_ads (ya desde 20260707)
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='leads_origen_check';

-- [E] La publicación de Realtime debe existir (1 fila)
SELECT pubname FROM pg_publication WHERE pubname='supabase_realtime';
*/


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 1 — ALTERACIONES A TABLAS EXISTENTES (todo nullable → seguro)
-- ─────────────────────────────────────────────────────────────────────

-- Atribución de Meta en leads. meta_lead_id UNIQUE → idempotencia de Lead Ads.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS meta_ad_id   text,
  ADD COLUMN IF NOT EXISTS meta_campaign text,
  ADD COLUMN IF NOT EXISTS ctwa_clid    text,
  ADD COLUMN IF NOT EXISTS meta_lead_id text;

COMMENT ON COLUMN leads.meta_ad_id   IS 'ID del anuncio de Meta que originó el lead (ad_id en meta_anuncios).';
COMMENT ON COLUMN leads.meta_campaign IS 'Nombre/ID de la campaña de Meta.';
COMMENT ON COLUMN leads.ctwa_clid    IS 'Click-to-WhatsApp click id (solo primer mensaje con referral).';
COMMENT ON COLUMN leads.meta_lead_id IS 'ID del lead de un formulario instantáneo. UNIQUE: evita duplicar el mismo lead si Meta reintenta.';

-- UNIQUE parcial: varios leads pueden NO tener meta_lead_id (NULL),
-- pero un mismo meta_lead_id no puede entrar dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS leads_meta_lead_id_key
  ON leads (meta_lead_id) WHERE meta_lead_id IS NOT NULL;

-- Instagram no expone teléfono: identificamos al contacto por su IGSID.
ALTER TABLE contactos
  ADD COLUMN IF NOT EXISTS instagram_id text;

COMMENT ON COLUMN contactos.instagram_id IS 'IGSID del usuario de Instagram (no trae teléfono). Dedupe de contacto.';

CREATE UNIQUE INDEX IF NOT EXISTS contactos_instagram_id_key
  ON contactos (instagram_id) WHERE instagram_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 2 — lead_propiedades (N:N: un lead puede interesarse en varias)
-- La columna leads.propiedad_id se MANTIENE por compatibilidad.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_propiedades (
  lead_id      uuid NOT NULL REFERENCES leads(id)       ON DELETE CASCADE,
  propiedad_id uuid NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, propiedad_id)
);

COMMENT ON TABLE lead_propiedades IS
  'Propiedades de interés de un lead (N:N). leads.propiedad_id se mantiene por compatibilidad.';

CREATE INDEX IF NOT EXISTS idx_lead_propiedades_propiedad
  ON lead_propiedades (propiedad_id);

-- Backfill desde la relación 1:1 existente.
INSERT INTO lead_propiedades (lead_id, propiedad_id)
  SELECT id, propiedad_id FROM leads WHERE propiedad_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 3 — meta_anuncios (anuncio de Meta → propiedad/proyecto)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_anuncios (
  ad_id        text PRIMARY KEY,
  propiedad_id uuid REFERENCES propiedades(id) ON DELETE CASCADE,
  proyecto_id  uuid REFERENCES proyectos(id)   ON DELETE CASCADE,
  nombre       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE meta_anuncios IS
  'Mapea cada anuncio de Meta (ad_id) a la propiedad/proyecto que promociona. '
  'Usado para atribuir leads y mensajes Click-to-WhatsApp a la propiedad correcta.';

CREATE INDEX IF NOT EXISTS idx_meta_anuncios_propiedad ON meta_anuncios (propiedad_id) WHERE propiedad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meta_anuncios_proyecto  ON meta_anuncios (proyecto_id)  WHERE proyecto_id  IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 4 — conversaciones (una por contacto y canal)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversaciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  contacto_id  uuid NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,
  lead_id      uuid REFERENCES leads(id) ON DELETE SET NULL,

  canal        text NOT NULL CHECK (canal IN ('whatsapp', 'instagram')),

  -- Identificadores del lado de Meta (según canal).
  wa_id        text,    -- número en formato wa (E.164 sin +) para WhatsApp
  instagram_id text,    -- IGSID para Instagram

  -- Resumen para la lista de chats (Fase 2).
  ultimo_mensaje_at    timestamptz,
  ultimo_mensaje_texto text,
  -- Momento del último mensaje ENTRANTE → base para la ventana de 24h.
  ultimo_entrante_at   timestamptz,

  no_leidos    int NOT NULL DEFAULT 0,
  asignado_a   uuid REFERENCES usuarios(id) ON DELETE SET NULL,

  -- Agente IA (Fase 3): apagado por defecto.
  ia_activa        boolean NOT NULL DEFAULT false,
  ia_pausada_hasta timestamptz,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_conversacion_contacto_canal UNIQUE (contacto_id, canal)
);

COMMENT ON TABLE conversaciones IS
  'Hilo de chat por contacto y canal (whatsapp|instagram). ultimo_entrante_at '
  'es la base de la ventana de 24h. ia_activa/ia_pausada_hasta: Fase 3.';

CREATE INDEX IF NOT EXISTS idx_conversaciones_ultimo
  ON conversaciones (ultimo_mensaje_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversaciones_asignado
  ON conversaciones (asignado_a) WHERE asignado_a IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversaciones_canal
  ON conversaciones (canal);
CREATE INDEX IF NOT EXISTS idx_conversaciones_contacto
  ON conversaciones (contacto_id);

DROP TRIGGER IF EXISTS set_conversaciones_updated_at ON conversaciones;
CREATE TRIGGER set_conversaciones_updated_at
  BEFORE UPDATE ON conversaciones
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 5 — mensajes
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mensajes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  conversacion_id uuid NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  contacto_id     uuid REFERENCES contactos(id) ON DELETE SET NULL,
  lead_id         uuid REFERENCES leads(id)     ON DELETE SET NULL,

  canal     text NOT NULL CHECK (canal IN ('whatsapp', 'instagram')),
  direccion text NOT NULL CHECK (direccion IN ('entrante', 'saliente')),

  -- Quién originó el mensaje: cliente | agente (humano) | ia | app (eco del celular).
  autor      text NOT NULL CHECK (autor IN ('cliente', 'agente', 'ia', 'app')),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,

  -- Idempotencia: Meta reintenta webhooks. Un mismo mensaje no se guarda dos veces.
  meta_message_id text UNIQUE,

  tipo   text NOT NULL DEFAULT 'texto'
         CHECK (tipo IN ('texto','imagen','audio','video','documento','plantilla','ubicacion','otro')),
  texto  text,
  media  jsonb,

  -- Estado de entrega (salientes). NULL en entrantes.
  estado text CHECK (estado IN ('enviado','entregado','leido','fallido')),
  error  text,

  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mensajes IS
  'Mensajes de las conversaciones. meta_message_id UNIQUE garantiza idempotencia '
  'ante reintentos de Meta. autor=app = eco de la app del celular (coexistencia).';

CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion
  ON mensajes (conversacion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mensajes_lead
  ON mensajes (lead_id) WHERE lead_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 6 — RLS (lectura authenticated; escritura solo service_role)
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE lead_propiedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_anuncios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_propiedades_select ON lead_propiedades;
CREATE POLICY lead_propiedades_select ON lead_propiedades
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS meta_anuncios_select ON meta_anuncios;
CREATE POLICY meta_anuncios_select ON meta_anuncios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS conversaciones_select ON conversaciones;
CREATE POLICY conversaciones_select ON conversaciones
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mensajes_select ON mensajes;
CREATE POLICY mensajes_select ON mensajes
  FOR SELECT TO authenticated USING (true);
-- Escrituras: las hace el service_role (webhook/APIs del CRM), que bypassa RLS.


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 7 — Realtime (se consume en la Fase 2)
-- ADD TABLE falla si ya es miembro → lo envolvemos para que sea idempotente.
-- ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversaciones;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 8 — VERIFICACIÓN POST (correr después, deben dar lo indicado)
-- ─────────────────────────────────────────────────────────────────────
/*
-- Tablas creadas (4 filas)
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('conversaciones','mensajes','meta_anuncios','lead_propiedades');

-- Realtime incluye las dos tablas (2 filas)
SELECT tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND tablename IN ('conversaciones','mensajes');

-- Backfill de lead_propiedades = cantidad de leads con propiedad_id
SELECT
  (SELECT count(*) FROM lead_propiedades) AS en_lead_propiedades,
  (SELECT count(*) FROM leads WHERE propiedad_id IS NOT NULL) AS leads_con_propiedad;
*/
