-- =====================================================================
-- Integración Mercado Libre: almacenamiento del token OAuth + estado de
-- publicación por propiedad.
-- =====================================================================

-- Token OAuth de la cuenta de la inmobiliaria (una sola fila, id=1).
-- Contiene secretos: RLS habilitado SIN políticas => solo accesible con la
-- service_role key (server-side). Nunca exponer al cliente.
CREATE TABLE IF NOT EXISTS ml_tokens (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token  text        NOT NULL,
  refresh_token text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  ml_user_id    bigint,
  scope         text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ml_tokens ENABLE ROW LEVEL SECURITY;
-- (sin policies: solo la service_role puede leer/escribir)

-- Estado de la publicación en Mercado Libre por propiedad.
ALTER TABLE propiedades ADD COLUMN IF NOT EXISTS ml_item_id   text;
ALTER TABLE propiedades ADD COLUMN IF NOT EXISTS ml_permalink text;
ALTER TABLE propiedades ADD COLUMN IF NOT EXISTS ml_estado    text;   -- active | paused | closed | error | null
ALTER TABLE propiedades ADD COLUMN IF NOT EXISTS ml_error     text;   -- último error de publicación
ALTER TABLE propiedades ADD COLUMN IF NOT EXISTS ml_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS propiedades_ml_item_id_idx ON propiedades(ml_item_id);
