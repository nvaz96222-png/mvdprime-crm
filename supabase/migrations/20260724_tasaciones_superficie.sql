-- =====================================================================
-- MVDPrime CRM — Tasaciones: superficie interior/exterior + cochera + extras
-- Fecha: 2026-07-24 (extensión de 20260724_tasaciones.sql)
--
-- Por qué: un m² de terraza/balcón NO vale igual que un m² interior. Se tasa
-- sobre "m² equivalentes" = interior + exterior × coef (coef típico 0.5 en UY).
-- La cochera tiene valor de mercado propio → monto fijo aparte, no por m².
-- Amenities/estado/piso/vista → premium % global sobre el valor.
--
-- Todo aditivo y con IF NOT EXISTS (idempotente). La columna `superficie`
-- existente se mantiene como TOTAL para compatibilidad; el motor cae a ella
-- si no hay desglose interior/exterior.
-- =====================================================================

-- ── tasaciones (inmueble tasado) ──────────────────────────────────────
ALTER TABLE tasaciones ADD COLUMN IF NOT EXISTS superficie_interior numeric;
ALTER TABLE tasaciones ADD COLUMN IF NOT EXISTS superficie_exterior numeric;

-- Cuánto vale el m² exterior respecto al interior (0..1). Default 0.5 (50%).
ALTER TABLE tasaciones ADD COLUMN IF NOT EXISTS coef_exterior numeric NOT NULL DEFAULT 0.5;

-- Valor de la cochera (monto fijo que se suma al valor de la vivienda). NULL/0 = sin cochera.
ALTER TABLE tasaciones ADD COLUMN IF NOT EXISTS cochera_valor numeric;

-- Premium/descuento global por amenities, estado, piso, vista (fracción; 0.05 = +5%).
ALTER TABLE tasaciones ADD COLUMN IF NOT EXISTS ajuste_extras_pct numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN tasaciones.superficie_interior IS
  'm² cubiertos/interiores. Con superficie_exterior forman los m² equivalentes.';
COMMENT ON COLUMN tasaciones.superficie_exterior IS
  'm² de terraza/balcón/exterior. Se ponderan por coef_exterior en el cálculo.';
COMMENT ON COLUMN tasaciones.coef_exterior IS
  'Peso del m² exterior vs interior (0..1). m² equivalentes = interior + exterior*coef. Default 0.5.';
COMMENT ON COLUMN tasaciones.cochera_valor IS
  'Valor de mercado de la cochera. Se SUMA al valor de la vivienda (no va por m²).';
COMMENT ON COLUMN tasaciones.ajuste_extras_pct IS
  'Premium/descuento global (fracción) por amenities/estado/piso/vista. Aplica al valor de la vivienda.';

-- ── tasacion_comparables ──────────────────────────────────────────────
ALTER TABLE tasacion_comparables ADD COLUMN IF NOT EXISTS superficie_interior numeric;
ALTER TABLE tasacion_comparables ADD COLUMN IF NOT EXISTS superficie_exterior numeric;

COMMENT ON COLUMN tasacion_comparables.superficie_interior IS
  'm² cubiertos del comparable. Si hay desglose, el precio/m² se calcula sobre m² equivalentes.';
COMMENT ON COLUMN tasacion_comparables.superficie_exterior IS
  'm² exteriores del comparable (terraza/balcón).';

-- ── Verificación (descomentar y correr aparte) ────────────────────────
/*
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='tasaciones'
  AND column_name IN ('superficie_interior','superficie_exterior','coef_exterior','cochera_valor','ajuste_extras_pct')
ORDER BY column_name;
-- Esperado: 5 filas. coef_exterior default 0.5, ajuste_extras_pct default 0.

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='tasacion_comparables'
  AND column_name IN ('superficie_interior','superficie_exterior');
-- Esperado: 2 filas.
*/

-- ── ROLLBACK (solo si hace falta) ─────────────────────────────────────
/*
ALTER TABLE tasaciones DROP COLUMN IF EXISTS superficie_interior;
ALTER TABLE tasaciones DROP COLUMN IF EXISTS superficie_exterior;
ALTER TABLE tasaciones DROP COLUMN IF EXISTS coef_exterior;
ALTER TABLE tasaciones DROP COLUMN IF EXISTS cochera_valor;
ALTER TABLE tasaciones DROP COLUMN IF EXISTS ajuste_extras_pct;
ALTER TABLE tasacion_comparables DROP COLUMN IF EXISTS superficie_interior;
ALTER TABLE tasacion_comparables DROP COLUMN IF EXISTS superficie_exterior;
*/
