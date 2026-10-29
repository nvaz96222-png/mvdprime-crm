-- =====================================================================
-- MVDPrime CRM — Teléfonos normalizados en contactos
-- Fecha: 2026-10-29
--
-- Problema: los teléfonos se comparaban como texto. Los formularios web y
-- la carga manual guardan "099123456" y WhatsApp manda "59899123456", así
-- que un cliente existente que escribía por WhatsApp quedaba duplicado
-- (contacto + lead nuevos) y los mensajes enviados desde la app del celular
-- (smb_message_echoes) no encontraban al contacto.
--
-- Solución NO destructiva: no se modifica contactos.telefono (se sigue
-- mostrando como se cargó). Se agrega una columna GENERADA telefono_norm
-- con el número canónico, indexada, y el código busca por ella
-- (lib/telefono.js → buscarContactoPorTelefono).
--
-- ⚠️ normalizar_telefono() replica EXACTAMENTE normalizarTelefono() de
-- lib/telefono.js. Si se cambia una, cambiar la otra.
--
-- Orden de despliegue: el código funciona con o sin esta migración (si la
-- columna no existe, compara variantes de texto). Lo ideal es correr esta
-- migración antes o junto con el deploy.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 0 — VISTA PREVIA (ejecutar por separado, ANTES de la sección 1)
-- No modifica nada. Muestra los contactos que hoy son el MISMO número
-- escrito de distintas formas, para revisarlos antes de aplicar.
-- ─────────────────────────────────────────────────────────────────────
/*
WITH norm AS (
  SELECT
    id, nombre, telefono, email, created_at,
    CASE
      WHEN d = '' THEN NULL
      WHEN d2 LIKE '598%' THEN d2
      WHEN d2 LIKE '09%' AND length(d2) = 9 THEN '598' || substr(d2, 2)
      WHEN d2 LIKE '9%'  AND length(d2) = 8 THEN '598' || d2
      WHEN length(d2) >= 10 THEN d2
      ELSE '598' || d2
    END AS telefono_norm
  FROM (
    SELECT c.*,
      regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g') AS d,
      CASE WHEN regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g') LIKE '00%'
           THEN substr(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g'), 3)
           ELSE regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g') END AS d2
    FROM contactos c
  ) x
)
SELECT telefono_norm,
       count(*) AS cantidad,
       json_agg(json_build_object(
         'id', id, 'nombre', nombre, 'telefono', telefono,
         'email', email, 'creado', created_at
       ) ORDER BY created_at) AS contactos
FROM norm
WHERE telefono_norm IS NOT NULL
GROUP BY telefono_norm
HAVING count(*) > 1
ORDER BY cantidad DESC;
*/
-- Si aparecen duplicados: NO se fusionan automáticamente. El CRM va a usar
-- el contacto MÁS ANTIGUO de cada grupo para los mensajes nuevos. Los
-- demás se pueden revisar y unificar a mano (ver docs/leads-ingesta.md).


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 1 — APLICAR
-- ─────────────────────────────────────────────────────────────────────

-- 1. Función de normalización (IMMUTABLE: requisito de columna generada).
CREATE OR REPLACE FUNCTION public.normalizar_telefono(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN d = '' THEN NULL
    WHEN d2 LIKE '598%' THEN d2
    WHEN d2 LIKE '09%' AND length(d2) = 9 THEN '598' || substr(d2, 2)
    WHEN d2 LIKE '9%'  AND length(d2) = 8 THEN '598' || d2
    WHEN length(d2) >= 10 THEN d2
    ELSE '598' || d2
  END
  FROM (
    SELECT d,
           CASE WHEN d LIKE '00%' THEN substr(d, 3) ELSE d END AS d2
    FROM (SELECT regexp_replace(coalesce(t, ''), '\D', '', 'g') AS d) s
  ) x
$$;

COMMENT ON FUNCTION public.normalizar_telefono(text) IS
  'Teléfono canónico (dígitos, 598 para Uruguay). Debe coincidir con normalizarTelefono() de lib/telefono.js';

-- 2. Columna generada + índice.
ALTER TABLE contactos
  ADD COLUMN IF NOT EXISTS telefono_norm text
  GENERATED ALWAYS AS (public.normalizar_telefono(telefono)) STORED;

CREATE INDEX IF NOT EXISTS contactos_telefono_norm_idx
  ON contactos (telefono_norm)
  WHERE telefono_norm IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 2 — VERIFICACIÓN (después de aplicar)
-- ─────────────────────────────────────────────────────────────────────
/*
-- Casos esperados (todas deben dar 59899123456, salvo el fijo):
SELECT t, public.normalizar_telefono(t) FROM (VALUES
  ('099 123 456'), ('099123456'), ('99123456'), ('59899123456'),
  ('+598 99 123 456'), ('0059899123456'), ('2400 1234')
) v(t);

-- Muestra de contactos con su número normalizado:
SELECT nombre, telefono, telefono_norm FROM contactos
WHERE telefono IS NOT NULL ORDER BY created_at DESC LIMIT 20;
*/

-- Rollback (si hiciera falta):
--   DROP INDEX IF EXISTS contactos_telefono_norm_idx;
--   ALTER TABLE contactos DROP COLUMN IF EXISTS telefono_norm;
--   DROP FUNCTION IF EXISTS public.normalizar_telefono(text);
