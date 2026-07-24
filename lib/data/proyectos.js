import { getPerfil } from "@/lib/supabase/getPerfil";

export async function loadOpcionesProyecto(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const perfil = await getPerfil(supabase, user);

  let agentes = [];
  try {
    const { data } = await supabase
      .from("usuarios")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre");
    agentes = data || [];
  } catch {
    /* ignorar */
  }

  return {
    agentes,
    agenteDefault: perfil?.id || null,
  };
}
