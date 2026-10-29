-- =====================================================================
-- MVDPrime CRM — Agente IA calificador (Fase 3)
-- Fecha: 2026-10-29
--
-- · agente_ia_config: configuración editable por el admin (una sola fila).
--   El agente arranca APAGADO (activo = false) hasta que el admin lo active.
-- · ia_eventos: auditoría de cada respuesta, herramienta, derivación y
--   error del agente, con tokens usados (costos).
-- · leads.calificacion: respuestas de filtrado que junta el agente (jsonb).
-- · conversaciones: estado de la IA (derivada a humano, candado de
--   ejecución para no responder dos veces a la vez).
--
-- Requiere 20261027_meta_ingesta.sql y public.mi_rol() (rls_fix.sql).
-- =====================================================================

-- 1. Configuración (fila única id = 1).
CREATE TABLE IF NOT EXISTS agente_ia_config (
  id                 int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  activo             boolean NOT NULL DEFAULT false,  -- interruptor global
  activar_en_nuevas  boolean NOT NULL DEFAULT false,  -- prender la IA sola en conversaciones nuevas
  nombre_asistente   text NOT NULL DEFAULT 'el asistente de MVD Prime',
  mensaje_bienvenida text,
  tono               text,
  preguntas          jsonb NOT NULL DEFAULT '[]'::jsonb,  -- preguntas de filtrado (texto)
  instrucciones_extra text,
  horario_desde      time,          -- null = todo el día
  horario_hasta      time,
  dias_activos       int[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}',  -- 1 = lunes … 7 = domingo
  max_mensajes_conversacion int NOT NULL DEFAULT 12,
  max_mensajes_dia   int NOT NULL DEFAULT 200,
  modelo             text,          -- null = valor por defecto del código
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES usuarios(id) ON DELETE SET NULL
);

INSERT INTO agente_ia_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE agente_ia_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agente_ia_config_select ON agente_ia_config;
CREATE POLICY agente_ia_config_select ON agente_ia_config
  FOR SELECT TO authenticated USING (true);
-- Escritura: solo vía API (service_role), que valida rol admin.

-- 2. Auditoría.
CREATE TABLE IF NOT EXISTS ia_eventos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid REFERENCES conversaciones(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  tipo            text NOT NULL CHECK (tipo IN ('respuesta', 'herramienta', 'derivacion', 'omitido', 'error', 'simulacion')),
  detalle         jsonb NOT NULL DEFAULT '{}'::jsonb,
  modelo          text,
  input_tokens    int,
  output_tokens   int,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_eventos_conversacion ON ia_eventos (conversacion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_eventos_fecha ON ia_eventos (created_at DESC);

ALTER TABLE ia_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ia_eventos_select ON ia_eventos;
CREATE POLICY ia_eventos_select ON ia_eventos
  FOR SELECT TO authenticated USING (public.mi_rol() = 'admin');

-- 3. Calificación del lead.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS calificacion jsonb;
COMMENT ON COLUMN leads.calificacion IS
  'Respuestas de filtrado (operación, presupuesto, financiación/garantía, zona, plazo, ocupantes, visita, resumen). Lo completa el agente IA o un agente.';

-- 4. Estado de la IA en la conversación.
ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS ia_derivada        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ia_motivo_derivacion text,
  ADD COLUMN IF NOT EXISTS ia_mensajes        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ia_lock_hasta      timestamptz;
COMMENT ON COLUMN conversaciones.ia_derivada IS
  'El agente IA pidió que responda una persona (y se pausó). Se limpia al responder un humano.';
COMMENT ON COLUMN conversaciones.ia_lock_hasta IS
  'Candado de ejecución del agente: evita dos respuestas simultáneas a la misma conversación.';

-- Candado atómico: devuelve true si este proceso tomó la conversación.
CREATE OR REPLACE FUNCTION public.ia_tomar_conversacion(conv_id uuid, segundos int DEFAULT 90)
RETURNS boolean
LANGUAGE sql
AS $$
  WITH t AS (
    UPDATE conversaciones
       SET ia_lock_hasta = now() + make_interval(secs => segundos)
     WHERE id = conv_id
       AND (ia_lock_hasta IS NULL OR ia_lock_hasta < now())
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM t);
$$;
REVOKE ALL ON FUNCTION public.ia_tomar_conversacion(uuid, int) FROM PUBLIC, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────────────
/*
SELECT * FROM agente_ia_config;
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'conversaciones' AND column_name LIKE 'ia_%';
SELECT public.ia_tomar_conversacion(gen_random_uuid());  -- false (no existe)
*/

-- Rollback:
--   DROP FUNCTION IF EXISTS public.ia_tomar_conversacion(uuid, int);
--   ALTER TABLE conversaciones DROP COLUMN IF EXISTS ia_derivada, DROP COLUMN IF EXISTS ia_motivo_derivacion,
--     DROP COLUMN IF EXISTS ia_mensajes, DROP COLUMN IF EXISTS ia_lock_hasta;
--   ALTER TABLE leads DROP COLUMN IF EXISTS calificacion;
--   DROP TABLE IF EXISTS ia_eventos;
--   DROP TABLE IF EXISTS agente_ia_config;
