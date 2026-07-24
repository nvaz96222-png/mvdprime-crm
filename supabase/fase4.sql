-- ============================================================
-- Fase 4 — Conversión comercial
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Tabla de eventos analíticos por proyecto
CREATE TABLE IF NOT EXISTS proyecto_eventos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID        REFERENCES proyectos(id) ON DELETE CASCADE,
  slug        TEXT        NOT NULL,
  tipo        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pev_proyecto ON proyecto_eventos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_pev_tipo     ON proyecto_eventos(tipo);
CREATE INDEX IF NOT EXISTS idx_pev_created  ON proyecto_eventos(created_at);

ALTER TABLE proyecto_eventos ENABLE ROW LEVEL SECURITY;
-- Acceso solo via service role (admin client) — sin políticas públicas

-- 2. Tipología asociada al lead (columna opcional)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tipologia_id UUID REFERENCES proyecto_tipologias(id) ON DELETE SET NULL;
