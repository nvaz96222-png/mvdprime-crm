-- =====================================================================
-- Fix ingesta de leads + trazabilidad (2026-07-07)
--
-- 1. leads_origen_check NO incluía 'web' → todo INSERT con origen='web'
--    (formularios públicos) violaba el constraint. Se alinea con
--    lib/constants.js ORIGENES y se agregan meta_ads / google_ads.
-- 2. lead_ingesta_log: tabla de trazabilidad. Cada intento de ingesta
--    (de cualquier canal) queda registrado con payload completo, para
--    poder rastrear/reprocesar leads perdidos.
-- =====================================================================

-- 1. Constraint de origen alineado con la app
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_origen_check;
ALTER TABLE leads ADD CONSTRAINT leads_origen_check CHECK (
  origen = ANY (ARRAY[
    'mercadolibre', 'whatsapp', 'instagram', 'infocasas', 'gallito',
    'referido', 'directo', 'web', 'meta_ads', 'google_ads', 'otro'
  ]::text[])
);

-- Mismo fix para contactos si tuviera constraint de fuente (no aplica hoy).

-- 2. Log de ingesta (dead-letter queue + trazabilidad)
CREATE TABLE IF NOT EXISTS lead_ingesta_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal text NOT NULL,              -- contacto-web | contacto-proyecto | inbound | mercadolibre | ...
  estado text NOT NULL DEFAULT 'recibido',  -- recibido | ok | error | spam | invalido
  paso_fallido text,                -- validacion | contacto | lead | interaccion
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  contacto_id uuid,
  lead_id uuid,
  ip text,
  user_agent text,
  referer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  procesado_at timestamptz
);

CREATE INDEX IF NOT EXISTS lead_ingesta_log_estado_idx ON lead_ingesta_log (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_ingesta_log_canal_idx ON lead_ingesta_log (canal, created_at DESC);

-- RLS: los agentes pueden LEER el log (para diagnóstico en el CRM).
-- La escritura la hace solo el service_role (bypassa RLS).
ALTER TABLE lead_ingesta_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_ingesta_log_select ON lead_ingesta_log;
CREATE POLICY lead_ingesta_log_select ON lead_ingesta_log
  FOR SELECT TO authenticated USING (true);
