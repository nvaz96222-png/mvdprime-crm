-- =====================================================================
-- MVDPrime CRM — Módulo Proyectos v1
-- Fecha: 2026-06-24
--
-- Cambios aprobados respecto al borrador inicial:
--   ✦ proyectos.slug           → campo nuevo UNIQUE (URLs SEO-friendly)
--   ✕ proyectos.unidades_disp  → eliminado (se calcula en runtime)
--   ✦ proyecto_tipologias      → tabla nueva (mono, 1 dorm, 2 dorm, etc.)
--   ✔ proyectos.agente_id      → mantenido como FK simple (v1)
--                                 documentado para migración N:N en v2
--
-- Reutiliza funciones ya existentes (rls_fix.sql):
--   public.mi_rol()         → rol del usuario autenticado
--   public.mi_usuario_id()  → usuarios.id del usuario autenticado
--   public._drop_policies() → limpia políticas antes de recrear
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 0 — VERIFICACIÓN PRE-VUELO
-- Ejecutar este bloque por separado ANTES del migration.
-- Todas las queries deben devolver 0 filas o los valores indicados.
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
  AND table_name IN (
    'proyectos', 'proyecto_fotos',
    'proyecto_documentos', 'proyecto_tipologias'
  );

-- [C] proyecto_id NO debe existir aún en propiedades ni leads (0 filas)
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('propiedades', 'leads')
  AND column_name = 'proyecto_id';
*/


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 1 — TABLA PRINCIPAL: proyectos
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proyectos (

  -- ── Identidad ────────────────────────────────────────────────────
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text  NOT NULL,

  -- slug: identificador URL-friendly, inmutable después de creación.
  -- Generado por la app desde el nombre: "Oceana Pocitos" → "oceana-pocitos".
  -- Nunca cambiar una vez publicado (rompe URLs indexadas).
  slug        text  NOT NULL UNIQUE,

  descripcion text,

  -- ── Clasificación ────────────────────────────────────────────────
  tipo   text NOT NULL DEFAULT 'edificio'
         CHECK (tipo IN (
           'edificio',
           'casa_en_pozo',
           'urbanizacion',
           'complejo_comercial',
           'local_comercial',
           'otro'
         )),

  estado text NOT NULL DEFAULT 'en_comercializacion'
         CHECK (estado IN (
           'en_comercializacion',
           'proximamente',
           'en_obra',
           'pausado',
           'entregado',
           'cancelado'
         )),

  -- ── Ubicación ────────────────────────────────────────────────────
  barrio       text,
  departamento text,
  direccion    text,
  lat          numeric,
  lng          numeric,

  -- ── Precios del proyecto (rango global) ──────────────────────────
  -- Detalles por tipología van en proyecto_tipologias.
  precio_desde numeric,
  precio_hasta numeric,
  moneda       text NOT NULL DEFAULT 'USD'
               CHECK (moneda IN ('USD', 'UYU')),

  -- ── Dimensiones del proyecto (rango global) ──────────────────────
  superficie_desde   numeric,
  superficie_hasta   numeric,
  dormitorios_desde  int,
  dormitorios_hasta  int,

  -- ── Unidades ─────────────────────────────────────────────────────
  -- unidades_total: capacidad del proyecto (no cambia con ventas).
  -- unidades_disponibles: NO se almacena aquí para evitar inconsistencias.
  --   Calcularlo en runtime:
  --     SELECT COUNT(*) FROM propiedades
  --     WHERE proyecto_id = $1 AND estado = 'disponible'
  --   O desde tipologías: SELECT SUM(unidades_disponibles) FROM proyecto_tipologias
  --   WHERE proyecto_id = $1
  unidades_total int,

  -- ── Desarrollador / cronograma ───────────────────────────────────
  desarrollador          text,
  fecha_inicio_obras     date,
  fecha_entrega_estimada date,

  -- ── Amenities ────────────────────────────────────────────────────
  -- Array de strings con valores de PROYECTO_AMENITIES en lib/constants.js.
  amenities text[] NOT NULL DEFAULT '{}',

  -- ── Responsable comercial ─────────────────────────────────────────
  -- v1: un único agente responsable del proyecto.
  -- v2 (futura migración): agregar tabla proyecto_agentes (N:N) sin
  --   eliminar esta columna. Ruta de migración:
  --     CREATE TABLE proyecto_agentes (
  --       proyecto_id uuid REFERENCES proyectos(id),
  --       agente_id   uuid REFERENCES usuarios(id),
  --       rol         text DEFAULT 'colaborador',
  --       PRIMARY KEY (proyecto_id, agente_id)
  --     );
  --     INSERT INTO proyecto_agentes (proyecto_id, agente_id, rol)
  --       SELECT id, agente_id, 'responsable'
  --       FROM proyectos WHERE agente_id IS NOT NULL;
  --   La RLS de UPDATE pasará de `agente_id = mi_usuario_id()`
  --   a EXISTS(SELECT 1 FROM proyecto_agentes WHERE ...).
  agente_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,

  -- ── Publicación web ──────────────────────────────────────────────
  publicar_web boolean NOT NULL DEFAULT false,
  destacado    boolean NOT NULL DEFAULT false,

  -- ── Enriquecimiento inicial ───────────────────────────────────────
  -- URL de PROP.com.uy usada una sola vez en la carga inicial.
  -- Sin sincronización posterior. Solo trazabilidad de fuente.
  prop_url text,

  -- ── Auditoría ────────────────────────────────────────────────────
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE proyectos IS
  'Emprendimientos inmobiliarios (edificios en pozo, urbanizaciones, etc.). '
  'Unidades individuales se cargan en propiedades con proyecto_id seteado. '
  'Tipologías con precios y disponibilidad por tipo en proyecto_tipologias.';

COMMENT ON COLUMN proyectos.slug IS
  'Identificador URL-friendly único. Inmutable tras publicación. '
  'Generado desde nombre: toLowerCase + reemplazar espacios por guiones + quitar caracteres especiales.';

COMMENT ON COLUMN proyectos.agente_id IS
  'v1: agente único responsable. '
  'v2: agregar tabla proyecto_agentes N:N y migrar con INSERT FROM proyectos.agente_id.';

COMMENT ON COLUMN proyectos.unidades_total IS
  'Capacidad total del proyecto. Inmutable o casi. '
  'Para disponibles: COUNT(propiedades WHERE proyecto_id=X AND estado=disponible) '
  'o SUM(proyecto_tipologias.unidades_disponibles WHERE proyecto_id=X).';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 2 — TABLA: proyecto_fotos
-- Galería multimedia: renders 3D, fotos de obra, planos de planta
-- Bucket Storage: proyectos-fotos
-- Path:           {proyecto_id}/{tipo}/{timestamp}-{i}.ext
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proyecto_fotos (

  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  uuid        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,

  url          text        NOT NULL,
  storage_path text,

  tipo         text        NOT NULL DEFAULT 'foto'
               CHECK (tipo IN ('foto', 'render', 'plano', 'foto_obra')),

  es_principal boolean     NOT NULL DEFAULT false,
  orden        int         NOT NULL DEFAULT 0,
  nombre       text,                          -- caption: "Vista desde terraza piso 12"

  created_at   timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE proyecto_fotos IS
  'Galería del proyecto. Tipos: foto|render|plano|foto_obra. '
  'Bucket: proyectos-fotos. Path: {proyecto_id}/{tipo}/{timestamp}-{i}.ext';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 3 — TABLA: proyecto_documentos
-- PDFs: brochures, fichas técnicas, planos generales, contratos tipo
-- Bucket Storage: proyectos-docs
-- Path:           {proyecto_id}/{timestamp}-{nombre}.pdf
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proyecto_documentos (

  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  uuid        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,

  url          text        NOT NULL,
  storage_path text,
  tamano_bytes int,

  nombre       text        NOT NULL,          -- display: "Brochure Q2 2025"
  tipo         text        NOT NULL DEFAULT 'brochure'
               CHECK (tipo IN (
                 'brochure',
                 'ficha_tecnica',
                 'plano_general',
                 'contrato_tipo',
                 'otro'
               )),

  created_at   timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE proyecto_documentos IS
  'Documentos PDF del proyecto. '
  'Bucket: proyectos-docs. Path: {proyecto_id}/{timestamp}-{nombre}.pdf';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 4 — TABLA: proyecto_tipologias
-- Detalle comercial por tipo de unidad dentro del proyecto.
-- Permite mostrar "Monoambiente desde USD 85k · 3 disp." por tipología.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proyecto_tipologias (

  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,

  -- Nombre de display: "Monoambiente", "1 Dormitorio", "2 Dormitorios", "Penthouse"
  nombre      text        NOT NULL,

  -- Dormitorios: 0 = monoambiente, NULL = no aplica (ej: local comercial)
  dormitorios int,

  -- Dimensiones de las unidades de esta tipología
  superficie_desde numeric,
  superficie_hasta numeric,

  -- Precio de las unidades de esta tipología
  precio_desde numeric,
  precio_hasta numeric,
  moneda       text NOT NULL DEFAULT 'USD'
               CHECK (moneda IN ('USD', 'UYU')),

  -- Disponibilidad por tipología.
  -- Campo manual: actualizado por el agente al pre-vender unidades.
  -- En fase de marketing (sin propiedades cargadas) es la única fuente.
  -- Cuando las unidades sí existen en propiedades, este valor es referencial.
  unidades_total       int,
  unidades_disponibles int,

  -- Orden de aparición en la ficha pública (monoambiente primero, etc.)
  orden int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- Un proyecto no puede tener dos tipologías con el mismo nombre
  CONSTRAINT uq_tipologia_nombre UNIQUE (proyecto_id, nombre)

);

COMMENT ON TABLE proyecto_tipologias IS
  'Tipologías comerciales del proyecto (monoambiente, 1 dorm, 2 dorm, etc.). '
  'unidades_disponibles es un campo manual; refleja el estado comercial, '
  'no necesariamente sincronizado con propiedades.estado.';

COMMENT ON COLUMN proyecto_tipologias.dormitorios IS
  '0 = monoambiente, 1/2/3/4 = dormitorios, NULL = no aplica.';

COMMENT ON COLUMN proyecto_tipologias.unidades_disponibles IS
  'Contador manual. En fase de marketing es la fuente primaria de disponibilidad. '
  'Cuando las unidades existen en propiedades, calcular también con: '
  'COUNT(*) FROM propiedades WHERE proyecto_id=X AND estado=disponible.';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 5 — ALTERACIONES A TABLAS EXISTENTES
-- Ambas columnas son nullable → no afectan registros existentes.
-- ON DELETE SET NULL → si se borra el proyecto, el registro queda intacto.
-- ─────────────────────────────────────────────────────────────────────

-- Una propiedad puede ser una unidad concreta dentro del proyecto
ALTER TABLE propiedades
  ADD COLUMN IF NOT EXISTS proyecto_id uuid
  REFERENCES proyectos(id) ON DELETE SET NULL;

COMMENT ON COLUMN propiedades.proyecto_id IS
  'FK opcional. Si está seteado, esta propiedad es una unidad del proyecto. '
  'NULL = propiedad standalone independiente de cualquier emprendimiento.';

-- Un lead puede interesarse en el proyecto general (antes de elegir unidad)
-- o en una unidad específica (proyecto_id + propiedad_id coexisten)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS proyecto_id uuid
  REFERENCES proyectos(id) ON DELETE SET NULL;

COMMENT ON COLUMN leads.proyecto_id IS
  'FK opcional. Lead interesado en el proyecto en general. '
  'Puede coexistir con propiedad_id cuando el interesado ya eligió una unidad.';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 6 — TRIGGER updated_at
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_proyectos_updated_at ON proyectos;
CREATE TRIGGER set_proyectos_updated_at
  BEFORE UPDATE ON proyectos
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 7 — ÍNDICES
-- ─────────────────────────────────────────────────────────────────────

-- proyectos — filtros del listado CRM
CREATE INDEX IF NOT EXISTS idx_proyectos_estado
  ON proyectos (estado);

CREATE INDEX IF NOT EXISTS idx_proyectos_tipo
  ON proyectos (tipo);

CREATE INDEX IF NOT EXISTS idx_proyectos_barrio
  ON proyectos (barrio)
  WHERE barrio IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_departamento
  ON proyectos (departamento)
  WHERE departamento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_agente_id
  ON proyectos (agente_id)
  WHERE agente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_created_at
  ON proyectos (created_at DESC);

-- Filtros de publicación (partial index: solo filas relevantes)
CREATE INDEX IF NOT EXISTS idx_proyectos_publicar_web
  ON proyectos (publicar_web)
  WHERE publicar_web = true;

CREATE INDEX IF NOT EXISTS idx_proyectos_destacado
  ON proyectos (destacado)
  WHERE destacado = true;

-- slug: la constraint UNIQUE ya crea un índice; este es explícito para claridad
-- (el UNIQUE INDEX se crea automáticamente con el UNIQUE constraint)

-- proyecto_fotos
CREATE INDEX IF NOT EXISTS idx_proyecto_fotos_proyecto_id
  ON proyecto_fotos (proyecto_id);

CREATE INDEX IF NOT EXISTS idx_proyecto_fotos_principal
  ON proyecto_fotos (proyecto_id, es_principal)
  WHERE es_principal = true;

-- proyecto_documentos
CREATE INDEX IF NOT EXISTS idx_proyecto_docs_proyecto_id
  ON proyecto_documentos (proyecto_id);

-- proyecto_tipologias
CREATE INDEX IF NOT EXISTS idx_proyecto_tipologias_proyecto_id
  ON proyecto_tipologias (proyecto_id);

CREATE INDEX IF NOT EXISTS idx_proyecto_tipologias_orden
  ON proyecto_tipologias (proyecto_id, orden);

-- propiedades: unidades de un proyecto
CREATE INDEX IF NOT EXISTS idx_propiedades_proyecto_id
  ON propiedades (proyecto_id)
  WHERE proyecto_id IS NOT NULL;

-- leads: leads asociados a un proyecto
CREATE INDEX IF NOT EXISTS idx_leads_proyecto_id
  ON leads (proyecto_id)
  WHERE proyecto_id IS NOT NULL;

-- Búsqueda tipo BuscadorGlobal (ilike → trigram)
-- pg_trgm ya viene activa en Supabase; CREATE EXTENSION es idempotente.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_proyectos_nombre_trgm
  ON proyectos USING gin (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_proyectos_barrio_trgm
  ON proyectos USING gin (barrio gin_trgm_ops)
  WHERE barrio IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_slug_trgm
  ON proyectos USING gin (slug gin_trgm_ops);


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 8 — ROW LEVEL SECURITY
--
-- Modelo consistente con rls_fix.sql del proyecto:
--   proyectos         → catálogo compartido (= propiedades)
--   proyecto_fotos    → catálogo compartido (= fotos)
--   proyecto_docs     → catálogo compartido (= fotos)
--   proyecto_tipologias → catálogo compartido
-- ─────────────────────────────────────────────────────────────────────

-- ── proyectos ────────────────────────────────────────────────────────
SELECT public._drop_policies('proyectos');
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proyectos_select" ON proyectos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "proyectos_insert" ON proyectos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: agente responsable del proyecto O cualquier admin
CREATE POLICY "proyectos_update" ON proyectos
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
CREATE POLICY "proyectos_delete" ON proyectos
  FOR DELETE USING (public.mi_rol() = 'admin');


-- ── proyecto_fotos ───────────────────────────────────────────────────
SELECT public._drop_policies('proyecto_fotos');
ALTER TABLE proyecto_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proyecto_fotos_select" ON proyecto_fotos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_fotos_insert" ON proyecto_fotos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_fotos_update" ON proyecto_fotos
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_fotos_delete" ON proyecto_fotos
  FOR DELETE USING (auth.uid() IS NOT NULL);


-- ── proyecto_documentos ──────────────────────────────────────────────
SELECT public._drop_policies('proyecto_documentos');
ALTER TABLE proyecto_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proyecto_docs_select" ON proyecto_documentos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_docs_insert" ON proyecto_documentos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_docs_update" ON proyecto_documentos
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_docs_delete" ON proyecto_documentos
  FOR DELETE USING (auth.uid() IS NOT NULL);


-- ── proyecto_tipologias ──────────────────────────────────────────────
SELECT public._drop_policies('proyecto_tipologias');
ALTER TABLE proyecto_tipologias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proyecto_tipologias_select" ON proyecto_tipologias
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_tipologias_insert" ON proyecto_tipologias
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_tipologias_update" ON proyecto_tipologias
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_tipologias_delete" ON proyecto_tipologias
  FOR DELETE USING (auth.uid() IS NOT NULL);


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 9 — STORAGE BUCKETS
-- Mismo patrón que storage_setup.sql del proyecto
-- ─────────────────────────────────────────────────────────────────────

-- Bucket: imágenes y renders (10 MB max, solo imágenes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proyectos-fotos',
  'proyectos-fotos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "pfotos_obj_select" ON storage.objects;
CREATE POLICY "pfotos_obj_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'proyectos-fotos');

DROP POLICY IF EXISTS "pfotos_obj_insert" ON storage.objects;
CREATE POLICY "pfotos_obj_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'proyectos-fotos');

DROP POLICY IF EXISTS "pfotos_obj_update" ON storage.objects;
CREATE POLICY "pfotos_obj_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'proyectos-fotos');

DROP POLICY IF EXISTS "pfotos_obj_delete" ON storage.objects;
CREATE POLICY "pfotos_obj_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'proyectos-fotos');


-- Bucket: documentos PDF (25 MB max, solo PDF)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proyectos-docs',
  'proyectos-docs',
  true,
  26214400,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "pdocs_obj_select" ON storage.objects;
CREATE POLICY "pdocs_obj_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'proyectos-docs');

DROP POLICY IF EXISTS "pdocs_obj_insert" ON storage.objects;
CREATE POLICY "pdocs_obj_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'proyectos-docs');

DROP POLICY IF EXISTS "pdocs_obj_update" ON storage.objects;
CREATE POLICY "pdocs_obj_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'proyectos-docs');

DROP POLICY IF EXISTS "pdocs_obj_delete" ON storage.objects;
CREATE POLICY "pdocs_obj_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'proyectos-docs');


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 10 — VERIFICACIÓN POST-MIGRACIÓN
-- Descomentar y ejecutar en bloque separado DESPUÉS del migration.
-- ─────────────────────────────────────────────────────────────────────

/*
-- [1] Tablas creadas con cantidad de columnas correcta
SELECT table_name, COUNT(*) AS columnas
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'proyectos', 'proyecto_fotos',
    'proyecto_documentos', 'proyecto_tipologias'
  )
GROUP BY table_name ORDER BY table_name;
-- Esperado:
--   proyecto_documentos   → 7
--   proyecto_fotos        → 9
--   proyecto_tipologias   → 12
--   proyectos             → 23

-- [2] slug existe y NO existe unidades_disponibles en proyectos
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'proyectos'
  AND column_name IN ('slug', 'unidades_disponibles')
ORDER BY column_name;
-- Esperado: 1 fila (slug). unidades_disponibles NO debe aparecer.

-- [3] UNIQUE constraint en slug
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'proyectos'
  AND constraint_name LIKE '%slug%';
-- Esperado: 1 fila UNIQUE

-- [4] UNIQUE constraint en proyecto_tipologias (proyecto_id, nombre)
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'proyecto_tipologias'
  AND constraint_type = 'UNIQUE';
-- Esperado: 1 fila (uq_tipologia_nombre)

-- [5] proyecto_id en propiedades y leads (nullable)
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('propiedades', 'leads')
  AND column_name = 'proyecto_id';
-- Esperado: 2 filas, ambas is_nullable = YES

-- [6] Índices del módulo
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    tablename IN ('proyectos','proyecto_fotos','proyecto_documentos','proyecto_tipologias')
    OR indexname LIKE '%proyecto%'
  )
ORDER BY tablename, indexname;
-- Esperado: ~15 índices

-- [7] RLS activo en las 4 tablas nuevas
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'proyectos', 'proyecto_fotos',
    'proyecto_documentos', 'proyecto_tipologias'
  );
-- Esperado: rowsecurity = true en las 4

-- [8] Políticas RLS (4 por tabla)
SELECT tablename, COUNT(*) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'proyectos', 'proyecto_fotos',
    'proyecto_documentos', 'proyecto_tipologias'
  )
GROUP BY tablename ORDER BY tablename;
-- Esperado: 4 en cada tabla

-- [9] Trigger updated_at en proyectos
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'proyectos';
-- Esperado: set_proyectos_updated_at (BEFORE UPDATE)

-- [10] Buckets de Storage
SELECT id, name, public
FROM storage.buckets
WHERE id IN ('proyectos-fotos', 'proyectos-docs');
-- Esperado: 2 filas, public = true

-- [11] Smoke test: insertar un proyecto de prueba (se revierte)
BEGIN;
  INSERT INTO proyectos (nombre, slug, tipo, estado)
  VALUES ('__TEST__', '__test-migration__', 'edificio', 'pausado')
  RETURNING id, nombre, slug, created_at, updated_at;

  INSERT INTO proyecto_tipologias (
    proyecto_id, nombre, dormitorios,
    precio_desde, moneda, unidades_total, unidades_disponibles, orden
  )
  SELECT id, '2 Dormitorios', 2, 150000, 'USD', 10, 10, 0
  FROM proyectos WHERE slug = '__test-migration__'
  RETURNING id, nombre, precio_desde;
ROLLBACK;
-- Ambos INSERT deben devolver 1 fila cada uno. ROLLBACK no deja basura.
*/


-- ─────────────────────────────────────────────────────────────────────
-- ROLLBACK COMPLETO (ejecutar SOLO si la migración falló)
-- ─────────────────────────────────────────────────────────────────────

/*
ALTER TABLE leads        DROP COLUMN IF EXISTS proyecto_id;
ALTER TABLE propiedades  DROP COLUMN IF EXISTS proyecto_id;

DROP TABLE IF EXISTS proyecto_tipologias  CASCADE;
DROP TABLE IF EXISTS proyecto_documentos  CASCADE;
DROP TABLE IF EXISTS proyecto_fotos       CASCADE;
DROP TABLE IF EXISTS proyectos            CASCADE;

DROP TRIGGER IF EXISTS set_proyectos_updated_at ON proyectos;
-- handle_updated_at() se mantiene: puede usarse para otras tablas futuras.

DELETE FROM storage.buckets WHERE id IN ('proyectos-fotos', 'proyectos-docs');
*/
