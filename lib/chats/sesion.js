// Perfil (tabla usuarios) del usuario con sesión, para las API routes de chats.
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/supabase/getPerfil";

export async function perfilDeSesion() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const perfil = await getPerfil(supabase, user);
  if (!perfil || perfil.activo === false) return null;
  return perfil;
}
