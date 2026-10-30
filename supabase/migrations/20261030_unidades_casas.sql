-- =====================================================================
-- MVDPrime CRM — proyecto_unidades: casas
-- Fecha: 2026-10-30
--
-- El selector se estrenó con City Homes, un edificio: las unidades eran
-- apartamentos y garajes, y las superficies venían con los nombres de la
-- lista de ese desarrollo (habitable, terrazas, áreas comunes).
--
-- Jardines del Polo son 18 casas sobre un loteo. La lista del desarrollador
-- da otras dos superficies —área de la parcela y metros construidos— y el
-- brochure agrega el desglose por tipo de casa (planta baja, planta alta,
-- lavadero, galería). Esta migración hace lugar a eso sin tocar lo que ya
-- funciona:
--
--   · `casa` como tipo de unidad
--   · sup_parcela, que un apartamento no tiene
--   · desglose, para los metrajes que cada desarrollador parte a su manera
--
-- El criterio es el mismo de siempre: respetar los nombres del documento de
-- origen en vez de forzarlos a un molde común.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 0 — VERIFICACIÓN PRE-VUELO
-- ─────────────────────────────────────────────────────────────────────

/*
-- [A] La tabla y su CHECK de tipo actuales
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'proyecto_unidades'::regclass AND contype = 'c';

-- [B] Ninguna unidad debería tener todavía tipo 'casa' (0 filas)
SELECT COUNT(*) FROM proyecto_unidades WHERE tipo = 'casa';
*/


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 1 — TIPO 'casa'
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE proyecto_unidades
  DROP CONSTRAINT IF EXISTS proyecto_unidades_tipo_check;

ALTER TABLE proyecto_unidades
  ADD CONSTRAINT proyecto_unidades_tipo_check
  CHECK (tipo IN ('apartamento', 'casa', 'garaje', 'local', 'otro'));


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 2 — SUPERFICIES DE CASA
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE proyecto_unidades
  ADD COLUMN IF NOT EXISTS sup_parcela numeric,
  ADD COLUMN IF NOT EXISTS desglose    jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN proyecto_unidades.sup_parcela IS
  'Área del terreno de la unidad, para casas y lotes. NULL en apartamentos.';

COMMENT ON COLUMN proyecto_unidades.desglose IS
  'Metrajes parciales con el nombre que les da el documento de origen, '
  'en orden de lectura. Ej: {"Planta baja": 84, "Planta alta": 98, '
  '"Lavadero": 5, "Galería": 21}. Se muestra tal cual en la ficha.';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 3 — RANGO DE PRECIOS DEL PROYECTO
--
-- El trigger miraba sólo los apartamentos disponibles. En un proyecto de
-- casas eso dejaba el rango en blanco. Ahora mira la unidad principal del
-- proyecto, sea apartamento o casa; garajes, locales y otros siguen fuera,
-- que es el punto: un garaje de USD 20.000 no puede ser el "desde" de un
-- edificio.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recalcular_precios_proyecto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- En un trigger de DELETE, NEW no está asignado: leerlo da error.
  pid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := OLD.proyecto_id;
  ELSE
    pid := NEW.proyecto_id;
  END IF;

  UPDATE proyectos p
  SET precio_desde = r.minimo,
      precio_hasta = r.maximo
  FROM (
    SELECT MIN(precio) AS minimo, MAX(precio) AS maximo
    FROM proyecto_unidades
    WHERE proyecto_id = pid
      AND tipo IN ('apartamento', 'casa')
      AND estado = 'disponible'
      AND precio IS NOT NULL
  ) r
  WHERE p.id = pid
    -- Sin disponibles no se toca nada: dejar el rango anterior dice más
    -- que dos NULL, y un proyecto agotado se comunica por su estado.
    AND r.minimo IS NOT NULL
    AND (p.precio_desde IS DISTINCT FROM r.minimo
         OR p.precio_hasta IS DISTINCT FROM r.maximo);

  RETURN NULL;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 4 — VERIFICACIÓN POST-MIGRACIÓN
-- ─────────────────────────────────────────────────────────────────────

/*
-- [1] El CHECK acepta 'casa'
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'proyecto_unidades'::regclass AND conname = 'proyecto_unidades_tipo_check';

-- [2] Las columnas nuevas
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'proyecto_unidades' AND column_name IN ('sup_parcela', 'desglose');

-- [3] Tras cargar las casas: el rango del proyecto sale de las disponibles
SELECT p.slug, p.precio_desde, p.precio_hasta, COUNT(*) FILTER (WHERE u.estado = 'disponible') AS disponibles
FROM proyectos p JOIN proyecto_unidades u ON u.proyecto_id = p.id
WHERE p.slug = 'jardines-del-polo' GROUP BY p.slug, p.precio_desde, p.precio_hasta;
*/
