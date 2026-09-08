-- =====================================================================
-- MVDPrime — Lectura pública (rol anon) de PROYECTOS para la web mvdprime.uy
-- Fecha: 2026-09-08
--
-- La web pública lee con la anon key. Las políticas base de proyectos son solo
-- para autenticados (auth.uid() IS NOT NULL), así que anon veía 0 filas.
-- Estas políticas AGREGAN acceso de solo-lectura para anon a los proyectos
-- publicados (publicar_web=true) y sus tipologías/fotos. Son aditivas
-- (RLS combina políticas con OR) y no afectan al CRM.
--
-- OJO: si se re-corre rls_fix.sql (hace _drop_policies), reaplicar esto.
-- =====================================================================

-- ── proyectos ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "proyectos_anon_web" ON proyectos;
CREATE POLICY "proyectos_anon_web" ON proyectos
  FOR SELECT TO anon
  USING (
    publicar_web = true
    AND estado IN ('en_comercializacion', 'proximamente', 'en_obra')
  );

-- ── proyecto_tipologias (si el proyecto padre es público) ─────────────
DROP POLICY IF EXISTS "proyecto_tipologias_anon_web" ON proyecto_tipologias;
CREATE POLICY "proyecto_tipologias_anon_web" ON proyecto_tipologias
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = proyecto_tipologias.proyecto_id
        AND p.publicar_web = true
    )
  );

-- ── proyecto_fotos (si el proyecto padre es público) ──────────────────
DROP POLICY IF EXISTS "proyecto_fotos_anon_web" ON proyecto_fotos;
CREATE POLICY "proyecto_fotos_anon_web" ON proyecto_fotos
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = proyecto_fotos.proyecto_id
        AND p.publicar_web = true
    )
  );

-- Verificación (correr como anon key desde la web o REST):
--   GET /rest/v1/proyectos?select=slug&publicar_web=eq.true  → debe traer filas
