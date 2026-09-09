-- =====================================================================
-- MVDPrime — Módulo WhatsApp (Cloud API) — Fase 2: esquema + retención
-- Fecha: 2026-09-09
--
-- Guarda los mensajes de WhatsApp Business de forma LIVIANA (solo texto y
-- metadatos; los archivos multimedia NO se descargan) durante N días, con
-- purga automática y protección contra borrado accidental.
--
-- Tablas:
--   wa_conversaciones  un hilo por número, enlazado a contactos del CRM
--   wa_mensajes        mensajes (entrantes y salientes) + FTS en español
--   wa_eventos_log     payload crudo de cada webhook (dead-letter queue)
--   wa_purga_log       auditoría de cada corrida de retención
--
-- Retención: /api/whatsapp/retencion (Vercel Cron diario) llama a
--   wa_purgar_mensajes(MESSAGE_RETENTION_DAYS). pg_cron queda como
--   respaldo semanal con un corte fijo conservador.
--
-- Correr en: Supabase → SQL Editor (el SUPABASE_ACCESS_TOKEN está vencido,
--   así que la Management API no está disponible). Es idempotente.
-- =====================================================================


-- ── 0. Configuración de búsqueda de texto en español, sin tildes ──────
-- El stemmer 'spanish' de Postgres NO quita acentos: buscar "financiacion"
-- no encontraría "financiación", y en el celular la gente escribe sin
-- tildes todo el tiempo. Con el diccionario unaccent el índice guarda la
-- forma sin acentos y ambas escrituras coinciden.
-- Si unaccent no estuviera disponible, es_unaccent queda como copia de
-- 'spanish' y todo lo demás sigue funcionando igual.
DO $bloque$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'es_unaccent') THEN
    EXECUTE 'CREATE TEXT SEARCH CONFIGURATION public.es_unaccent ( COPY = spanish )';
    BEGIN
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS unaccent';
      EXECUTE 'ALTER TEXT SEARCH CONFIGURATION public.es_unaccent '
              'ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem';
      RAISE NOTICE 'es_unaccent creada con unaccent (busqueda insensible a tildes).';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'unaccent no disponible (%). es_unaccent queda como copia de spanish.', SQLERRM;
    END;
  END IF;
END
$bloque$;


-- ── 1. Conversaciones ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_conversaciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Clave natural: el número del cliente en E.164 sin '+' (como lo manda Meta).
  wa_id              text NOT NULL UNIQUE,
  telefono           text,
  nombre_perfil      text,

  -- Enlace al CRM. La ingesta lo resuelve por teléfono contra `contactos`.
  contacto_id        uuid REFERENCES contactos(id) ON DELETE SET NULL,

  primer_mensaje_at  timestamptz,
  ultimo_mensaje_at  timestamptz,
  ultimo_entrante_at timestamptz,
  ultimo_saliente_at timestamptz,

  -- "Escribió y todavía no le respondimos", resuelto con datos estructurados.
  -- Columna generada: no hace falta llamar a Claude para esta pregunta.
  sin_responder      boolean GENERATED ALWAYS AS (
    ultimo_entrante_at IS NOT NULL
    AND (ultimo_saliente_at IS NULL OR ultimo_entrante_at > ultimo_saliente_at)
  ) STORED,

  mensajes_count     integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_conversaciones_ultimo_idx
  ON wa_conversaciones (ultimo_mensaje_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS wa_conversaciones_contacto_idx
  ON wa_conversaciones (contacto_id) WHERE contacto_id IS NOT NULL;
-- Índice parcial: la bandeja de "pendientes de respuesta" es un scan mínimo.
CREATE INDEX IF NOT EXISTS wa_conversaciones_sin_responder_idx
  ON wa_conversaciones (ultimo_entrante_at DESC) WHERE sin_responder;


-- ── 2. Mensajes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_mensajes (
  id               bigserial PRIMARY KEY,   -- más barato que uuid a este volumen

  -- Dedupe: Meta reintenta los webhooks. Este UNIQUE es la única defensa
  -- necesaria contra duplicados (ON CONFLICT DO NOTHING en la ingesta).
  wa_message_id    text NOT NULL UNIQUE,

  conversacion_id  uuid NOT NULL REFERENCES wa_conversaciones(id) ON DELETE CASCADE,

  direccion        text NOT NULL CHECK (direccion IN ('entrante', 'saliente')),

  -- De dónde vino: enviado por la API, escrito desde la app del celular
  -- (webhook smb_message_echoes de Coexistence) o traído en la
  -- sincronización inicial de historial.
  origen           text NOT NULL DEFAULT 'api'
                     CHECK (origen IN ('api', 'app_echo', 'historial')),

  -- Momento del mensaje según Meta (epoch → timestamptz).
  -- Es la única información necesaria para calcular el vencimiento.
  ts               timestamptz NOT NULL,

  tipo             text NOT NULL DEFAULT 'text',  -- text|image|audio|video|document|location|interactive|reaction|...
  texto            text,                          -- body, caption o label del botón

  -- Multimedia: SOLO metadatos, el archivo nunca se descarga ni se guarda.
  -- OJO: media_id no es un puntero durable — Meta expira las URLs en
  -- minutos y retiene el archivo ~30 días. Sirve como rastro de auditoría.
  media_id         text,
  media_mime       text,
  media_filename   text,

  respondiendo_a   text,     -- context.id → reconstruye hilos de respuesta
  estado           text,     -- solo si WHATSAPP_STORE_STATUSES=true
  meta             jsonb,    -- lo que no cubren las columnas; normalmente NULL

  created_at       timestamptz NOT NULL DEFAULT now(),

  texto_tsv        tsvector GENERATED ALWAYS AS (
    to_tsvector('public.es_unaccent'::regconfig, coalesce(texto, ''))
  ) STORED
);

-- Reconstruir una conversación en orden cronológico.
CREATE INDEX IF NOT EXISTS wa_mensajes_conversacion_ts_idx
  ON wa_mensajes (conversacion_id, ts DESC);
-- Filtro por fecha y, sobre todo, la purga.
CREATE INDEX IF NOT EXISTS wa_mensajes_ts_idx ON wa_mensajes (ts);
-- Búsqueda de texto completo.
CREATE INDEX IF NOT EXISTS wa_mensajes_tsv_idx ON wa_mensajes USING GIN (texto_tsv);


-- ── 3. Log de webhooks (dead-letter queue) ───────────────────────────
-- Mismo patrón que lead_ingesta_log: si la normalización falla, el mensaje
-- no se pierde y se puede reprocesar desde el payload crudo.
CREATE TABLE IF NOT EXISTS wa_eventos_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Los webhooks con firma inválida NO se registran acá: se rechazan con 401
  -- antes de tocar la base, para que nadie pueda llenar la tabla desde afuera.
  estado           text NOT NULL DEFAULT 'recibido',  -- recibido|ok|ignorado|error
  campo            text,        -- messages|smb_message_echoes|history|statuses|...
  mensajes_nuevos  integer NOT NULL DEFAULT 0,
  error            text,
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  procesado_at     timestamptz
);

CREATE INDEX IF NOT EXISTS wa_eventos_log_estado_idx ON wa_eventos_log (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_eventos_log_created_idx ON wa_eventos_log (created_at);


-- ── 4. Auditoría de la purga ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_purga_log (
  id                      bigserial PRIMARY KEY,
  corrida_at              timestamptz NOT NULL DEFAULT now(),
  origen                  text NOT NULL DEFAULT 'cron',  -- cron|pg_cron|manual
  dias_retencion          integer NOT NULL,
  corte                   timestamptz NOT NULL,
  simulado                boolean NOT NULL DEFAULT false,
  mensajes_borrados       integer NOT NULL DEFAULT 0,
  conversaciones_borradas integer NOT NULL DEFAULT 0,
  eventos_borrados        integer NOT NULL DEFAULT 0,
  duracion_ms             integer
);

CREATE INDEX IF NOT EXISTS wa_purga_log_corrida_idx ON wa_purga_log (corrida_at DESC);


-- ── 5. Recalcular contadores de conversación ─────────────────────────
-- Después de purgar, los agregados de wa_conversaciones tienen que
-- reflejar SOLO los mensajes que quedan (si no, sin_responder mentiría).
-- Toca únicamente las filas que realmente cambiaron.
CREATE OR REPLACE FUNCTION wa_recalcular_conversaciones()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  afectadas integer;
BEGIN
  UPDATE wa_conversaciones c SET
    mensajes_count     = coalesce(s.n, 0),
    primer_mensaje_at  = s.primero,
    ultimo_mensaje_at  = s.ultimo,
    ultimo_entrante_at = s.ult_entrante,
    ultimo_saliente_at = s.ult_saliente,
    updated_at         = now()
  FROM (
    SELECT c2.id,
           count(m.id)                                              AS n,
           min(m.ts)                                                AS primero,
           max(m.ts)                                                AS ultimo,
           max(m.ts) FILTER (WHERE m.direccion = 'entrante')        AS ult_entrante,
           max(m.ts) FILTER (WHERE m.direccion = 'saliente')        AS ult_saliente
    FROM wa_conversaciones c2
    LEFT JOIN wa_mensajes m ON m.conversacion_id = c2.id
    GROUP BY c2.id
  ) s
  WHERE s.id = c.id
    AND (c.mensajes_count     IS DISTINCT FROM coalesce(s.n, 0)
      OR c.ultimo_mensaje_at  IS DISTINCT FROM s.ultimo
      OR c.ultimo_entrante_at IS DISTINCT FROM s.ult_entrante
      OR c.ultimo_saliente_at IS DISTINCT FROM s.ult_saliente);

  GET DIAGNOSTICS afectadas = ROW_COUNT;
  RETURN afectadas;
END
$fn$;


-- ── 6. Purga con retención configurable ──────────────────────────────
-- Cuatro protecciones contra borrado accidental:
--   1. Piso duro: greatest(dias, 30). Aunque llegue dias=1, nunca borra
--      nada de menos de 30 días.
--   2. Borrado por lotes: no toma locks largos sobre la tabla.
--   3. simular=true: devuelve el conteo sin borrar nada (dry-run).
--   4. Todo queda registrado en wa_purga_log.
-- Los parámetros llevan prefijo p_ para que nunca puedan confundirse con las
-- columnas homónimas de wa_purga_log dentro de la función.
CREATE OR REPLACE FUNCTION wa_purgar_mensajes(
  p_dias    integer DEFAULT 90,
  p_simular boolean DEFAULT false,
  p_origen  text    DEFAULT 'manual',
  p_lote    integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  dias_seguro     integer     := greatest(coalesce(p_dias, 90), 30);
  corte           timestamptz;
  corte_eventos   timestamptz := now() - interval '14 days';
  inicio          timestamptz := clock_timestamp();
  borrados        integer;
  n_mensajes      integer := 0;
  n_conversas     integer := 0;
  n_eventos       integer := 0;
BEGIN
  corte := now() - make_interval(days => dias_seguro);

  IF p_simular THEN
    SELECT count(*) INTO n_mensajes FROM wa_mensajes WHERE ts < corte;
    SELECT count(*) INTO n_eventos  FROM wa_eventos_log WHERE created_at < corte_eventos;
    -- Conversaciones que quedarían huérfanas (sin mensajes y sin contacto).
    SELECT count(*) INTO n_conversas
    FROM wa_conversaciones c
    WHERE c.contacto_id IS NULL
      AND c.created_at < now() - interval '1 day'
      AND NOT EXISTS (
        SELECT 1 FROM wa_mensajes m
        WHERE m.conversacion_id = c.id AND m.ts >= corte
      );
  ELSE
    -- 1. Mensajes vencidos, por lotes.
    LOOP
      DELETE FROM wa_mensajes
      WHERE ctid IN (
        SELECT ctid FROM wa_mensajes WHERE ts < corte LIMIT p_lote
      );
      GET DIAGNOSTICS borrados = ROW_COUNT;
      n_mensajes := n_mensajes + borrados;
      EXIT WHEN borrados = 0;
    END LOOP;

    -- 2. Reflejar la purga en los agregados de cada conversación.
    PERFORM wa_recalcular_conversaciones();

    -- 3. Conversaciones sin mensajes y sin vínculo al CRM.
    --    El filtro por created_at evita borrar un hilo recién creado que
    --    todavía no insertó su primer mensaje.
    DELETE FROM wa_conversaciones c
    WHERE c.contacto_id IS NULL
      AND c.created_at < now() - interval '1 day'
      AND NOT EXISTS (SELECT 1 FROM wa_mensajes m WHERE m.conversacion_id = c.id);
    GET DIAGNOSTICS n_conversas = ROW_COUNT;

    -- 4. Log de webhooks: retención propia más corta (14 días).
    DELETE FROM wa_eventos_log WHERE created_at < corte_eventos;
    GET DIAGNOSTICS n_eventos = ROW_COUNT;
  END IF;

  INSERT INTO wa_purga_log (
    origen, dias_retencion, corte, simulado,
    mensajes_borrados, conversaciones_borradas, eventos_borrados, duracion_ms
  ) VALUES (
    p_origen, dias_seguro, corte, p_simular,
    n_mensajes, n_conversas, n_eventos,
    (extract(epoch FROM clock_timestamp() - inicio) * 1000)::integer
  );

  RETURN jsonb_build_object(
    'ok', true,
    'simulado', p_simular,
    'dias_retencion', dias_seguro,
    'dias_solicitados', coalesce(p_dias, 90),
    'corte', corte,
    'mensajes', n_mensajes,
    'conversaciones', n_conversas,
    'eventos_log', n_eventos,
    'duracion_ms', (extract(epoch FROM clock_timestamp() - inicio) * 1000)::integer
  );
END
$fn$;

-- La purga solo la puede ejecutar el backend (service_role) o pg_cron.
--
-- ⚠️ Revocar de PUBLIC NO alcanza: Supabase tiene ALTER DEFAULT PRIVILEGES que
-- concede EXECUTE a anon y authenticated sobre toda función nueva de `public`,
-- y esos son grants propios, independientes del de PUBLIC. Sin revocarlos
-- explícitamente, cualquiera con la anon key (que es pública, va en el JS de
-- la web) podría llamar POST /rest/v1/rpc/wa_purgar_mensajes y borrar datos.
REVOKE ALL ON FUNCTION wa_purgar_mensajes(integer, boolean, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION wa_recalcular_conversaciones()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION wa_purgar_mensajes(integer, boolean, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION wa_recalcular_conversaciones() TO service_role;


-- ── 7. RLS ───────────────────────────────────────────────────────────
-- Lectura para usuarios autenticados del CRM; escritura solo service_role
-- (que bypassa RLS). Políticas planas a propósito: nada de subconsultas a
-- `usuarios`, para no repetir la recursión 42P17 que ya nos mordió.
ALTER TABLE wa_conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_mensajes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_eventos_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_purga_log      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_conversaciones_select ON wa_conversaciones;
CREATE POLICY wa_conversaciones_select ON wa_conversaciones
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS wa_mensajes_select ON wa_mensajes;
CREATE POLICY wa_mensajes_select ON wa_mensajes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS wa_eventos_log_select ON wa_eventos_log;
CREATE POLICY wa_eventos_log_select ON wa_eventos_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS wa_purga_log_select ON wa_purga_log;
CREATE POLICY wa_purga_log_select ON wa_purga_log
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON wa_conversaciones, wa_mensajes, wa_eventos_log, wa_purga_log TO authenticated;
GRANT ALL ON wa_conversaciones, wa_mensajes, wa_eventos_log, wa_purga_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE wa_mensajes_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE wa_purga_log_id_seq TO service_role;


-- ── 8. pg_cron: red de respaldo ──────────────────────────────────────
-- El disparo primario es Vercel Cron → /api/whatsapp/retencion, que lee
-- MESSAGE_RETENTION_DAYS. Esto es el cinturón además de los tirantes: si
-- Vercel está caído o el cron se desconfigura, igual se purga, con un
-- corte fijo conservador de 120 días. Corre los domingos 04:15 Uruguay
-- (07:15 UTC).
DO $bloque$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('wa_purga_respaldo')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa_purga_respaldo');

    PERFORM cron.schedule(
      'wa_purga_respaldo',
      '15 7 * * 0',
      $cmd$SELECT wa_purgar_mensajes(120, false, 'pg_cron')$cmd$
    );
    RAISE NOTICE 'pg_cron: job wa_purga_respaldo programado (domingos 07:15 UTC).';
  ELSE
    RAISE NOTICE 'pg_cron no está instalado. Activarlo en Dashboard → Database → Extensions y re-correr este bloque para tener el respaldo semanal.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No se pudo programar el respaldo en pg_cron (%). El cron de Vercel sigue siendo el disparo primario.', SQLERRM;
END
$bloque$;


-- =====================================================================
-- Verificación (correr a mano después de aplicar):
--
--   -- 1. Dry-run de la purga: no borra nada, dice qué borraría.
--   SELECT wa_purgar_mensajes(90, true, 'manual');
--
--   -- 2. Que el piso de 30 días funcione (debe devolver dias_retencion=30):
--   SELECT wa_purgar_mensajes(1, true, 'manual');
--
--   -- 3. Que la búsqueda sin tildes funcione:
--   SELECT to_tsvector('public.es_unaccent'::regconfig, 'financiación en cuotas')
--          @@ plainto_tsquery('public.es_unaccent'::regconfig, 'financiacion');
--   -- → true
--
--   -- 4. Auditoría:
--   SELECT * FROM wa_purga_log ORDER BY corrida_at DESC LIMIT 5;
-- =====================================================================
