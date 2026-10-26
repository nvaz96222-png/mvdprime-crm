-- =====================================================================
-- MVDPrime CRM — Unidades por proyecto (selector editable)
-- Fecha: 2026-10-26
--
-- Motivo: el selector de City Homes servía 158 unidades desde archivos
-- JSON generados a mano (planilla de Drive → script Python → JSON del
-- selector → JSON del CRM → copia manual al repo de la web). Cambiar un
-- precio exigía regenerar, copiar, commitear y desplegar dos repos, y la
-- copia manual podía quedar atrás sin que nada avisara.
--
-- Con esta tabla el precio y el estado de cada unidad se editan desde el
-- CRM y la web los lee en vivo, igual que ya hace con proyectos,
-- tipologías y fotos.
--
-- Lo que NO entra acá: los polígonos de cada unidad sobre la planta
-- (lib/desarrollos/city-homes/plantas.json). Son geometría derivada de
-- los planos del arquitecto, no dato comercial: no cambian con las
-- ventas y se versionan en el repo. El vínculo entre una fila y su
-- polígono son las columnas `plano` + `zona`.
--
-- Trazabilidad: el planteo original del selector exige que todo precio
-- diga de qué documento salió. Las columnas fuente_* y la jsonb
-- `historico` conservan eso de la carga inicial, y cada edición manual
-- queda registrada en proyecto_unidad_historial con autor y fecha.
--
-- Reutiliza funciones ya existentes (rls_fix.sql):
--   public.mi_rol()         → rol del usuario autenticado
--   public.mi_usuario_id()  → usuarios.id del usuario autenticado
--   public._drop_policies() → limpia políticas antes de recrear
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 0 — VERIFICACIÓN PRE-VUELO
-- Ejecutar por separado ANTES de la migración.
-- ─────────────────────────────────────────────────────────────────────

/*
-- [A] Funciones helper deben existir (3 filas)
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('mi_rol', 'mi_usuario_id', '_drop_policies');

-- [B] Las tablas nuevas NO deben existir aún (0 filas)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('proyecto_unidades', 'proyecto_unidad_historial');

-- [C] proyectos debe existir con su trigger de updated_at (1 fila)
SELECT tgname FROM pg_trigger WHERE tgname = 'set_proyectos_updated_at';
*/


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 1 — TEXTOS COMERCIALES DEL PROYECTO
--
-- Los tres los mostraba el selector desde constantes escritas en el
-- script generador, así que cambiarlos también pedía un deploy.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS aviso_precios text,
  ADD COLUMN IF NOT EXISTS conexiones    text,
  ADD COLUMN IF NOT EXISTS forma_de_pago text;

COMMENT ON COLUMN proyectos.aviso_precios IS
  'Letra chica que acompaña los precios en la web. Ej: "Precios sujetos a ajuste por avance de ventas."';

COMMENT ON COLUMN proyectos.conexiones IS
  'Costos extra al precio de lista. Ej: "Conexiones: 4% del precio de venta."';

COMMENT ON COLUMN proyectos.forma_de_pago IS
  'Plan de pago del proyecto. Ej: "25% compromiso · 6 trimestres de 10% · 15% a la entrega".';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 2 — TABLA: proyecto_unidades
--
-- Una fila por unidad vendible del proyecto: apartamentos, garajes y
-- locales. Es la unidad comercial concreta ("AP. 909"), no la tipología
-- ("2 dormitorios"), que sigue viviendo en proyecto_tipologias.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proyecto_unidades (

  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,

  -- ── Identidad dentro del proyecto ────────────────────────────────
  -- codigo: como lo nombra la lista de precios ("909", "23").
  -- etiqueta: como se muestra ("AP. 909", "Garaje 23").
  codigo   text NOT NULL,
  etiqueta text NOT NULL,

  tipo text NOT NULL DEFAULT 'apartamento'
       CHECK (tipo IN ('apartamento', 'garaje', 'local', 'otro')),

  -- piso numérico para filtrar y ordenar; nivel es la etiqueta textual
  -- del documento original, que se respeta tal cual ("1er PISO").
  piso  int,
  nivel text,

  -- ── Características ──────────────────────────────────────────────
  tipologia   text,
  dormitorios int,
  banos       int,

  -- ── Superficies ──────────────────────────────────────────────────
  -- Los nombres replican los de la lista oficial: habitable, terrazas
  -- de uso exclusivo, subtotal, áreas comunes y total. No se recalculan
  -- ni se redondean: se guardan como las publica el desarrollador.
  sup_habitable numeric,
  sup_terrazas  numeric,
  sup_subtotal  numeric,
  sup_comunes   numeric,
  sup_total     numeric,

  -- ── Comercial ────────────────────────────────────────────────────
  -- precio NULL = no publicado en la lista vigente (pasa con las
  -- vendidas). La web no inventa un número: muestra "Consultar".
  precio numeric,
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD', 'UYU')),

  -- 'consultar' es el default a propósito: una unidad cargada sin dato
  -- no se anuncia como disponible.
  estado text NOT NULL DEFAULT 'consultar'
         CHECK (estado IN ('disponible', 'reservado', 'vendido', 'consultar')),

  -- ── Vínculo con el plano ─────────────────────────────────────────
  -- plano: id del plano en plantas.json ("piso-01", "pisos-02-09").
  -- zona: clave del polígono dentro de ese plano.
  -- Sin estos dos la unidad existe y se lista, pero no es clickeable
  -- sobre la planta.
  plano text,
  zona  text,

  observaciones text[] NOT NULL DEFAULT '{}',

  -- ── Trazabilidad documental ──────────────────────────────────────
  fuente_precio      text,
  fuente_superficies text,
  fuente_plano       text,

  -- Lecturas anteriores del mismo dato en otros documentos, para poder
  -- justificar un precio frente al cliente. Ej:
  --   {"listaOficialPdf": {"precio": 179300, "estado": "disponible",
  --                        "documento": "LISTA OFICIAL ... (2026-06-24)"}}
  historico jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- ── Auditoría de ediciones manuales ──────────────────────────────
  editado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  editado_en  timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Dos unidades del mismo tipo no pueden compartir código.
  -- Garaje 12 y apartamento 12 sí pueden coexistir.
  CONSTRAINT uq_unidad_codigo UNIQUE (proyecto_id, tipo, codigo)

);

COMMENT ON TABLE proyecto_unidades IS
  'Unidades vendibles concretas de un proyecto (apartamentos, garajes, locales). '
  'Fuente de verdad de precio y estado para el CRM y para el selector de la web. '
  'Los polígonos sobre la planta viven en el repo (plantas.json) y se vinculan por plano+zona.';

COMMENT ON COLUMN proyecto_unidades.precio IS
  'NULL = sin precio publicado en la lista vigente. La web muestra "Consultar", nunca un estimado.';

COMMENT ON COLUMN proyecto_unidades.estado IS
  'disponible | reservado | vendido | consultar. El default es consultar: '
  'una unidad sin dato confirmado no se publica como disponible.';

COMMENT ON COLUMN proyecto_unidades.historico IS
  'Lecturas del mismo dato en documentos anteriores, para trazabilidad. No lo escribe la app.';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 3 — TABLA: proyecto_unidad_historial
--
-- Toda edición de precio o estado queda registrada con autor y fecha.
-- Es lo que permite responder "¿quién bajó el precio de la 909?".
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proyecto_unidad_historial (

  id        uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidad_id uuid NOT NULL REFERENCES proyecto_unidades(id) ON DELETE CASCADE,

  -- Desnormalizado a propósito: permite listar el historial de todo un
  -- proyecto sin join, y sobrevive al borrado de la unidad si algún día
  -- se cambia el ON DELETE.
  proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,

  campo text NOT NULL CHECK (campo IN ('precio', 'estado')),

  -- Como texto para que un solo registro sirva a los dos campos.
  valor_anterior text,
  valor_nuevo    text,

  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()

);

COMMENT ON TABLE proyecto_unidad_historial IS
  'Bitácora de cambios de precio y estado por unidad. La escribe un trigger, no la app.';


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 4 — TRIGGERS
-- ─────────────────────────────────────────────────────────────────────

-- ── 4.1 updated_at (reutiliza la función del módulo proyectos) ───────
DROP TRIGGER IF EXISTS set_proyecto_unidades_updated_at ON proyecto_unidades;
CREATE TRIGGER set_proyecto_unidades_updated_at
  BEFORE UPDATE ON proyecto_unidades
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();


-- ── 4.2 Sello de autor en ediciones comerciales ──────────────────────
-- Sólo cuando cambia precio o estado: un reordenamiento o una
-- corrección de metraje no debería figurar como "lo editó Nicolás".
CREATE OR REPLACE FUNCTION public.sellar_edicion_unidad()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.precio IS DISTINCT FROM OLD.precio
     OR NEW.estado IS DISTINCT FROM OLD.estado THEN
    NEW.editado_por := public.mi_usuario_id();  -- NULL si corre un script
    NEW.editado_en  := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sellar_proyecto_unidades ON proyecto_unidades;
CREATE TRIGGER sellar_proyecto_unidades
  BEFORE UPDATE ON proyecto_unidades
  FOR EACH ROW
  EXECUTE FUNCTION public.sellar_edicion_unidad();


-- ── 4.3 Bitácora ─────────────────────────────────────────────────────
-- SECURITY DEFINER: el usuario que edita la unidad no necesita permiso
-- de INSERT sobre el historial, y así tampoco puede falsearlo.
CREATE OR REPLACE FUNCTION public.registrar_historial_unidad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.precio IS DISTINCT FROM OLD.precio THEN
    INSERT INTO proyecto_unidad_historial
      (unidad_id, proyecto_id, campo, valor_anterior, valor_nuevo, usuario_id)
    VALUES
      (NEW.id, NEW.proyecto_id, 'precio',
       OLD.precio::text, NEW.precio::text, public.mi_usuario_id());
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO proyecto_unidad_historial
      (unidad_id, proyecto_id, campo, valor_anterior, valor_nuevo, usuario_id)
    VALUES
      (NEW.id, NEW.proyecto_id, 'estado',
       OLD.estado, NEW.estado, public.mi_usuario_id());
  END IF;

  RETURN NULL;  -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS historial_proyecto_unidades ON proyecto_unidades;
CREATE TRIGGER historial_proyecto_unidades
  AFTER UPDATE ON proyecto_unidades
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_historial_unidad();


-- ── 4.4 Rango de precios del proyecto ────────────────────────────────
-- precio_desde/precio_hasta de la tarjeta pública se calculan sobre los
-- APARTAMENTOS DISPONIBLES con precio. Es lo que el comprador puede
-- comprar hoy: anunciar "desde USD 85.239" cuando esa unidad ya se
-- vendió es publicidad falsa, y promediar garajes de USD 20.000 rompe
-- el rango.
--
-- SECURITY DEFINER porque la RLS de UPDATE sobre proyectos sólo deja al
-- admin o al agente responsable, y el trigger tiene que correr igual
-- para cualquiera que pueda editar una unidad.
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
      AND tipo = 'apartamento'
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

DROP TRIGGER IF EXISTS recalcular_precios_proyecto ON proyecto_unidades;
CREATE TRIGGER recalcular_precios_proyecto
  AFTER INSERT OR UPDATE OF precio, estado, tipo OR DELETE ON proyecto_unidades
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precios_proyecto();


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 5 — ÍNDICES
-- ─────────────────────────────────────────────────────────────────────

-- Carga del selector: todas las unidades de un proyecto, por piso y código.
CREATE INDEX IF NOT EXISTS idx_proyecto_unidades_proyecto
  ON proyecto_unidades (proyecto_id, tipo, piso, codigo);

-- Contadores "117 de 158 disponibles".
CREATE INDEX IF NOT EXISTS idx_proyecto_unidades_estado
  ON proyecto_unidades (proyecto_id, estado);

-- Historial de una unidad, lo más reciente primero.
CREATE INDEX IF NOT EXISTS idx_unidad_historial_unidad
  ON proyecto_unidad_historial (unidad_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unidad_historial_proyecto
  ON proyecto_unidad_historial (proyecto_id, created_at DESC);


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 6 — ROW LEVEL SECURITY
--
-- proyecto_unidades: catálogo compartido, igual que proyecto_tipologias.
-- El agregado es la lectura anónima para la web pública, con la misma
-- forma que 20260908_proyectos_web_public_read.sql.
-- ─────────────────────────────────────────────────────────────────────

SELECT public._drop_policies('proyecto_unidades');
ALTER TABLE proyecto_unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proyecto_unidades_select" ON proyecto_unidades
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_unidades_insert" ON proyecto_unidades
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "proyecto_unidades_update" ON proyecto_unidades
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE sólo admin: borrar una unidad del listado oficial no es una
-- operación de todos los días, y se pierde su historial en cascada.
CREATE POLICY "proyecto_unidades_delete" ON proyecto_unidades
  FOR DELETE USING (public.mi_rol() = 'admin');

-- Lectura pública (rol anon) de las unidades de proyectos publicados.
CREATE POLICY "proyecto_unidades_anon_web" ON proyecto_unidades
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = proyecto_unidades.proyecto_id
        AND p.publicar_web = true
    )
  );


-- ── proyecto_unidad_historial ────────────────────────────────────────
-- Lectura para autenticados; la escritura es sólo del trigger
-- (SECURITY DEFINER), así que no hay política de INSERT. Nadie edita ni
-- borra la bitácora desde la app.
SELECT public._drop_policies('proyecto_unidad_historial');
ALTER TABLE proyecto_unidad_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proyecto_unidad_historial_select" ON proyecto_unidad_historial
  FOR SELECT USING (auth.uid() IS NOT NULL);


-- ─────────────────────────────────────────────────────────────────────
-- SECCIÓN 7 — VERIFICACIÓN POST-MIGRACIÓN
-- Ejecutar por separado DESPUÉS de la migración.
-- ─────────────────────────────────────────────────────────────────────

/*
-- [1] Tablas creadas
SELECT table_name, COUNT(*) AS columnas
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('proyecto_unidades', 'proyecto_unidad_historial')
GROUP BY table_name;
-- Esperado: proyecto_unidad_historial → 8 ; proyecto_unidades → 29

-- [2] Triggers en su lugar (4 filas)
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'proyecto_unidades'::regclass AND NOT tgisinternal;

-- [3] Políticas (5 en unidades, 1 en historial)
SELECT tablename, policyname, roles FROM pg_policies
WHERE tablename IN ('proyecto_unidades', 'proyecto_unidad_historial')
ORDER BY tablename, policyname;

-- [4] Columnas nuevas en proyectos (3 filas)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'proyectos'
  AND column_name IN ('aviso_precios', 'conexiones', 'forma_de_pago');

-- [5] Tras cargar las unidades: el rango debe coincidir con los disponibles
SELECT p.precio_desde, p.precio_hasta,
       MIN(u.precio) AS min_disp, MAX(u.precio) AS max_disp
FROM proyectos p
JOIN proyecto_unidades u ON u.proyecto_id = p.id
WHERE p.slug = 'city-homes'
  AND u.tipo = 'apartamento' AND u.estado = 'disponible' AND u.precio IS NOT NULL
GROUP BY p.precio_desde, p.precio_hasta;

-- [6] La bitácora se escribe (cambiar un precio y volver a dejarlo)
SELECT campo, valor_anterior, valor_nuevo, created_at
FROM proyecto_unidad_historial ORDER BY created_at DESC LIMIT 5;
*/
