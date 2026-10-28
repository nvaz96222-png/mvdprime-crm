-- =====================================================================
-- MVDPrime CRM — Soporte de Messenger (Facebook Page messaging) — Fase 1.5
-- Fecha: 2026-10-28
--
-- Los anuncios "Mensajes" de reels de Facebook caen en Messenger (mensajes
-- de la página), que la integración Meta inicial (WhatsApp/Instagram/Lead
-- Ads) no capturaba. Esta migración agrega el canal 'messenger':
--   · canal 'messenger' en conversaciones y mensajes (CHECK).
--   · contactos.messenger_id (PSID page-scoped) + conversaciones.messenger_id.
--   · origen 'messenger' en leads_origen_check (alineado con constants.js e
--     ingesta.js).
--
-- Idempotente. No rompe datos existentes.
-- =====================================================================

-- ── Canal 'messenger' en conversaciones y mensajes ────────────────────
ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS conversaciones_canal_check;
ALTER TABLE conversaciones ADD CONSTRAINT conversaciones_canal_check
  CHECK (canal IN ('whatsapp', 'instagram', 'messenger'));

ALTER TABLE mensajes DROP CONSTRAINT IF EXISTS mensajes_canal_check;
ALTER TABLE mensajes ADD CONSTRAINT mensajes_canal_check
  CHECK (canal IN ('whatsapp', 'instagram', 'messenger'));

-- ── Identificador de Messenger (PSID) ─────────────────────────────────
-- Facebook Messenger identifica al usuario con un PSID (page-scoped id).
ALTER TABLE contactos      ADD COLUMN IF NOT EXISTS messenger_id text;
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS messenger_id text;

COMMENT ON COLUMN contactos.messenger_id IS
  'PSID (page-scoped ID) del usuario de Facebook Messenger. No trae teléfono. Dedupe de contacto.';

CREATE UNIQUE INDEX IF NOT EXISTS contactos_messenger_id_key
  ON contactos (messenger_id) WHERE messenger_id IS NOT NULL;

-- ── Origen 'messenger' en leads ───────────────────────────────────────
-- Mantener alineado con lib/constants.js (ORIGENES) y lib/leads/ingesta.js.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_origen_check;
ALTER TABLE leads ADD CONSTRAINT leads_origen_check CHECK (
  origen = ANY (ARRAY[
    'mercadolibre', 'whatsapp', 'instagram', 'infocasas', 'gallito',
    'referido', 'directo', 'web', 'meta_ads', 'google_ads', 'messenger', 'otro'
  ]::text[])
);

-- ── Verificación (correr después) ─────────────────────────────────────
/*
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='conversaciones_canal_check';
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='mensajes_canal_check';
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='leads_origen_check';
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='contactos' AND column_name='messenger_id';
*/
