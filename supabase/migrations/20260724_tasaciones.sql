-- =====================================================================
-- MVDPrime CRM — Módulo Tasaciones v1
-- Fecha: 2026-07-24
--
-- Qué resuelve: tasación por método comparativo de mercado (MCM). El agente
-- carga comparables (de Mercado Libre, InfoCasas, inventario propio o a mano)
-- y el CRM calcula un rango de valor a partir del precio/m² de esos comparables.
--
-- Decisiones de diseño v1 (documentadas para v2):
--   ✦ tasaciones.propiedad_id → FK OPCIONAL. Muchas tasaciones son de
--     captación: el inmueble aún no está en `propiedades`. Por eso la
--     tasación guarda un SNAPSHOT de los atributos del inmueble tasado
--     (tipo, barrio, superficie, dormitorios). Congela qué se tasó.
--   ✦ tasaciones.metodo → solo 'comparativo' se usa en v1. 'costo' y 'renta'
--     quedan en el CHECK para no migrar el constraint en v2.
--   ✦ Sin bucket de Storage: el informe PDF se genera al vuelo desde los datos.
--   ✕ Sin comparables automáticos de ML: su API de búsqueda está restringida
--     (403 forbidden). fuente='mercadolibre' se carga a mano por ahora.
--
-- Reutiliza funciones ya existentes (rls_fix.sql):
--   public.mi_rol()  ·  public.mi_usuario_id()  ·  public._drop_policies()
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 0 — VERIFICACIÓN PRE-VUELO
-- Ejecutar este bloque por separado ANTES del migration.
-- ─────────────────────────────────────────────────────────────────────

/*
-- [A] Funciones helper deben existir (debe devolver 3 filas)
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('mi_rol', 'mi_usuario_id', '_drop_policies');

-- [B] Tablas del módulo NO deben existir aún (debe devolver 0 filas)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tasaciones', 'tasacion_comparables');
*/


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 1 — TABLA PRINCIPAL: tasaciones
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasaciones (

  -- ── Identidad ────────────────────────────────────────────────────
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK opcional. Si está seteada, la tasación es de una propiedad del
  -- inventario. NULL = tasación de captación (inmueble aún no listado).
  propiedad_id uuid REFERENCES propiedades(id) ON DELETE SET NULL,

  -- ── Snapshot del inmueble tasado ──────────────────────────────────
  -- Se copia al crear la tasación. Independiente de propiedades: congela
  -- lo que se tasó y permite tasar inmuebles fuera del inventario.
  titulo   text,                       -- referencia: "Apto Pocitos 2 dorm"
  tipo     text NOT NULL DEFAULT 'apartamento'
           CHECK (tipo IN (
             'apartamento', 'casa', 'local', 'terreno', 'garage', 'otro'
           )),
  operacion text NOT NULL DEFAULT 'venta'
           CHECK (operacion IN ('venta', 'alquiler')),

  barrio       text,
  departamento text,
  superficie   numeric,                -- m² del inmueble tasado
  dormitorios  int,
  banos        int,

  -- ── Método ────────────────────────────────────────────────────────
  -- v1 solo usa 'comparativo'. Los otros quedan para no migrar el CHECK.
  metodo text NOT NULL DEFAULT 'comparativo'
         CHECK (metodo IN ('comparativo', 'costo', 'renta')),

  estado text NOT NULL DEFAULT 'borrador'
         CHECK (estado IN ('borrador', 'finalizada')),

  -- ── Resultado ─────────────────────────────────────────────────────
  moneda text NOT NULL DEFAULT 'USD'
         CHECK (moneda IN ('USD', 'UYU')),

  valor_min       numeric,             -- rango inferior sugerido
  valor_probable  numeric,             -- valor más probable (precio de lista)
  valor_max       numeric,             -- rango superior sugerido

  -- Precio/m² mediano de los comparables incluidos (base del cálculo).
  precio_m2_referencia numeric,

  -- Margen de negociación aplicado (asking → cierre). Default 8% (UY típico
  -- 5–10%). Se guarda para poder reproducir el cálculo.
  margen_negociacion numeric NOT NULL DEFAULT 0.08,

  notas text,

  -- Quién hizo la tasación.
  agente_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,

  -- ── Auditoría ─────────────────────────────────────────────────────
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE tasaciones IS
  'Tasaciones por método comparativo de mercado. propiedad_id es opcional '
  '(tasaciones de captación). El snapshot de atributos congela qué se tasó.';

COMMENT ON COLUMN tasaciones.propiedad_id IS
  'FK opcional. NULL = tasación de captación (inmueble fuera del inventario). '
  'Seteada = tasación de una propiedad existente.';

COMMENT ON COLUMN tasaciones.margen_negociacion IS
  'Ajuste asking→cierre aplicado al precio/m² de comparables (que son de '
  'publicación, no de venta cerrada). Default 0.08 (8%). Rango UY típico 5–10%.';

COMMENT ON COLUMN tasaciones.metodo IS
  'v1: solo comparativo. costo/renta reservados para v2 sin migrar el CHECK.';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 2 — TABLA HIJA: tasacion_comparables
-- Cada comparable usado en la tasación. CASCADE: se borran con la tasación.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasacion_comparables (

  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tasacion_id uuid NOT NULL REFERENCES tasaciones(id) ON DELETE CASCADE,

  -- De dónde salió el comparable.
  fuente text NOT NULL DEFAULT 'manual'
         CHECK (fuente IN (
           'mercadolibre', 'infocasas', 'gallito',
           'inventario_propio', 'manual', 'otro'
         )),

  url    text,                         -- link a la publicación (si hay)
  titulo text,

  precio numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'USD'
         CHECK (moneda IN ('USD', 'UYU')),

  superficie  numeric,                 -- m² del comparable
  dormitorios int,
  banos       int,
  barrio      text,

  -- precio/m² del comparable (precio/superficie). Lo calcula la app al
  -- guardar; se persiste para no recalcular y para ordenar/filtrar.
  precio_m2 numeric,

  -- Ajuste manual del agente a este comparable (+/- %). Ej: -0.05 si es
  -- mejor que el inmueble tasado. Default 0 (sin ajuste).
  ajuste_pct numeric NOT NULL DEFAULT 0,

  -- Si cuenta en el cálculo. El agente puede excluir uno sin borrarlo.
  incluido boolean NOT NULL DEFAULT true,

  -- Marcado por el motor cuando cae fuera del rango intercuartílico (IQR).
  es_outlier boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE tasacion_comparables IS
  'Comparables de una tasación. precio_m2 = precio/superficie (calculado por '
  'la app). incluido=false excluye del cálculo sin borrar; es_outlier lo marca '
  'el motor por IQR.';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 3 — ALTERACIONES A TABLAS EXISTENTES
-- (ninguna: el módulo no agrega columnas a tablas existentes)
-- ─────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 4 — TRIGGER updated_at
-- La función handle_updated_at() ya existe (creada por proyectos/otros).
-- ─────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_tasaciones_updated_at ON tasaciones;
CREATE TRIGGER set_tasaciones_updated_at
  BEFORE UPDATE ON tasaciones
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 5 — ÍNDICES
-- ─────────────────────────────────────────────────────────────────────

-- tasaciones — filtros del listado CRM
CREATE INDEX IF NOT EXISTS idx_tasaciones_estado
  ON tasaciones (estado);

CREATE INDEX IF NOT EXISTS idx_tasaciones_propiedad_id
  ON tasaciones (propiedad_id)
  WHERE propiedad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasaciones_agente_id
  ON tasaciones (agente_id)
  WHERE agente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasaciones_barrio
  ON tasaciones (barrio)
  WHERE barrio IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasaciones_created_at
  ON tasaciones (created_at DESC);

-- tasacion_comparables
CREATE INDEX IF NOT EXISTS idx_tasacion_comparables_tasacion_id
  ON tasacion_comparables (tasacion_id);

-- Búsqueda tipo BuscadorGlobal (ilike → trigram) sobre el título del inmueble
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_tasaciones_titulo_trgm
  ON tasaciones USING gin (titulo gin_trgm_ops)
  WHERE titulo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasaciones_barrio_trgm
  ON tasaciones USING gin (barrio gin_trgm_ops)
  WHERE barrio IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 6 — ROW LEVEL SECURITY
-- Modelo estándar del CRM:
--   tasaciones           → SELECT/INSERT autenticado; UPDATE agente/admin; DELETE admin
--   tasacion_comparables → catálogo compartido (autenticado), como proyecto_fotos
-- ─────────────────────────────────────────────────────────────────────

-- ── tasaciones ────────────────────────────────────────────────────────
SELECT public._drop_policies('tasaciones');
ALTER TABLE tasaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasaciones_select" ON tasaciones
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasaciones_insert" ON tasaciones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: agente que hizo la tasación O cualquier admin
CREATE POLICY "tasaciones_update" ON tasaciones
  FOR UPDATE
  USING (
    public.mi_rol() = 'admin'
    OR agente_id = public.mi_usuario_id()
  )
  WITH CHECK (
    public.mi_rol() = 'admin'
    OR agente_id = public.mi_usuario_id()
  );

-- DELETE: solo admin (alineado con propiedades, contactos, etc.)
CREATE POLICY "tasaciones_delete" ON tasaciones
  FOR DELETE USING (public.mi_rol() = 'admin');


-- ── tasacion_comparables ──────────────────────────────────────────────
SELECT public._drop_policies('tasacion_comparables');
ALTER TABLE tasacion_comparables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasacion_comparables_select" ON tasacion_comparables
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasacion_comparables_insert" ON tasacion_comparables
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tasacion_comparables_update" ON tasacion_comparables
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tasacion_comparables_delete" ON tasacion_comparables
  FOR DELETE USING (auth.uid() IS NOT NULL);


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 7 — VERIFICACIÓN POST-MIGRACIÓN
-- Descomentar y ejecutar en bloque separado DESPUÉS del migration.
-- ─────────────────────────────────────────────────────────────────────

/*
-- [1] Tablas creadas con cantidad de columnas correcta
SELECT table_name, COUNT(*) AS columnas
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('tasaciones', 'tasacion_comparables')
GROUP BY table_name ORDER BY table_name;
-- Esperado:
--   tasacion_comparables → 16
--   tasaciones           → 22

-- [2] propiedad_id es nullable (tasación de captación)
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasaciones'
  AND column_name = 'propiedad_id';
-- Esperado: 1 fila, is_nullable = YES

-- [3] RLS activo en las 2 tablas
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tasaciones', 'tasacion_comparables');
-- Esperado: rowsecurity = true en las 2

-- [4] Políticas RLS (4 por tabla)
SELECT tablename, COUNT(*) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tasaciones', 'tasacion_comparables')
GROUP BY tablename ORDER BY tablename;
-- Esperado: 4 en cada tabla

-- [5] Trigger updated_at en tasaciones
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'tasaciones';
-- Esperado: set_tasaciones_updated_at (BEFORE UPDATE)

-- [6] Índices del módulo
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tasaciones', 'tasacion_comparables')
ORDER BY tablename, indexname;
-- Esperado: ~10 índices

-- [7] Smoke test: tasación + comparable (se revierte)
BEGIN;
  INSERT INTO tasaciones (titulo, tipo, operacion, barrio, superficie, dormitorios, estado)
  VALUES ('__TEST__ Apto Pocitos', 'apartamento', 'venta', 'Pocitos', 100, 2, 'borrador')
  RETURNING id, titulo, created_at, updated_at;

  INSERT INTO tasacion_comparables (
    tasacion_id, fuente, precio, moneda, superficie, precio_m2
  )
  SELECT id, 'manual', 300000, 'USD', 100, 3000
  FROM tasaciones WHERE titulo = '__TEST__ Apto Pocitos'
  RETURNING id, fuente, precio_m2;
ROLLBACK;
-- Ambos INSERT deben devolver 1 fila. ROLLBACK no deja basura.
*/


-- ─────────────────────────────────────────────────────────────────────
-- ROLLBACK COMPLETO (ejecutar SOLO si la migración falló)
-- ─────────────────────────────────────────────────────────────────────

/*
DROP TABLE IF EXISTS tasacion_comparables CASCADE;
DROP TABLE IF EXISTS tasaciones           CASCADE;
-- handle_updated_at() se mantiene: la usan otras tablas.
*/
