-- =====================================================================
-- MVDPrime CRM — Bandeja de chats (Fase 2a): permisos por agente
-- Fecha: 2026-10-29
--
-- En la Fase 1, conversaciones y mensajes quedaron legibles para CUALQUIER
-- usuario autenticado, mientras que los leads son privados por agente
-- (rls_fix.sql: el admin ve todo, el agente solo lo suyo). Esta migración
-- alinea los chats con esa misma regla:
--
--   · admin  → ve todas las conversaciones y mensajes.
--   · agente → ve las conversaciones asignadas a él (asignado_a) o cuyo
--              lead tiene agente_id = él.
--
-- Las conversaciones sin asignar solo las ve el admin, que las asigna
-- desde la bandeja ("Asignar"). Realtime respeta estas políticas.
--
-- La escritura sigue siendo solo service_role (las API routes del CRM
-- validan la sesión y escriben con el cliente admin).
--
-- Requiere public.mi_rol() y public.mi_usuario_id() (rls_fix.sql).
-- =====================================================================

-- Helper: ¿el usuario actual puede ver esta conversación?
CREATE OR REPLACE FUNCTION public.puedo_ver_conversacion(conv_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    public.mi_rol() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM conversaciones c
      LEFT JOIN leads l ON l.id = c.lead_id
      WHERE c.id = conv_id
        AND (c.asignado_a = public.mi_usuario_id()
             OR l.agente_id = public.mi_usuario_id())
    );
$$;

DROP POLICY IF EXISTS conversaciones_select ON conversaciones;
CREATE POLICY conversaciones_select ON conversaciones
  FOR SELECT TO authenticated
  USING (public.puedo_ver_conversacion(id));

DROP POLICY IF EXISTS mensajes_select ON mensajes;
CREATE POLICY mensajes_select ON mensajes
  FOR SELECT TO authenticated
  USING (public.puedo_ver_conversacion(conversacion_id));

-- Índice para el filtro "por propiedad" de la bandeja.
CREATE INDEX IF NOT EXISTS idx_conversaciones_lead
  ON conversaciones (lead_id) WHERE lead_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN (después de aplicar)
-- ─────────────────────────────────────────────────────────────────────
/*
SELECT policyname, qual FROM pg_policies
WHERE tablename IN ('conversaciones', 'mensajes');
*/

-- Rollback (vuelve a "todos ven todo"):
--   DROP POLICY IF EXISTS conversaciones_select ON conversaciones;
--   CREATE POLICY conversaciones_select ON conversaciones FOR SELECT TO authenticated USING (true);
--   DROP POLICY IF EXISTS mensajes_select ON mensajes;
--   CREATE POLICY mensajes_select ON mensajes FOR SELECT TO authenticated USING (true);
--   DROP FUNCTION IF EXISTS public.puedo_ver_conversacion(uuid);
