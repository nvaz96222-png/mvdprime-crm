-- Tareas por lead
CREATE TABLE IF NOT EXISTS tareas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  titulo         text NOT NULL,
  vencimiento    date,
  responsable_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  completada     boolean NOT NULL DEFAULT false,
  completada_en  timestamptz,
  created_by     uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tareas_lead_id_idx ON tareas(lead_id);

ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_tareas" ON tareas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_tareas" ON tareas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_tareas" ON tareas
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_delete_tareas" ON tareas
  FOR DELETE TO authenticated USING (true);
