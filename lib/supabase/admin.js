import { createClient } from "@supabase/supabase-js";

// Solo usar en Server Components / Server Actions (nunca en client).
// Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local (sin prefijo NEXT_PUBLIC_).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
