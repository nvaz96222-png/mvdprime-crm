import { getPerfil } from "@/lib/supabase/getPerfil";

// Carga las opciones que necesita el formulario de propiedad.
// Defensivo: si el RLS bloquea, devuelve listas vacías sin romper.
export async function loadOpcionesPropiedad(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const perfil = await getPerfil(supabase, user);

  let propietarios = [];
  let agentes = [];

  try {
    const { data } = await supabase
      .from("propietarios")
      .select("id, nombre")
      .order("nombre");
    propietarios = data || [];
  } catch {
    /* ignorar */
  }

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
    propietarios,
    agentes,
    agenteDefault: perfil?.id || null,
  };
}
