import { getPerfil } from "@/lib/supabase/getPerfil";

const ESTADOS_PROYECTO_ACTIVOS = ["en_comercializacion", "proximamente", "en_obra", "entregado"];

// Carga las opciones que necesitan los formularios de leads.
// Defensivo ante errores de RLS/esquema.
export async function loadOpcionesLead(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const perfil = await getPerfil(supabase, user);

  let contactos = [];
  let propiedades = [];
  let agentes = [];
  let proyectos = [];

  try {
    const { data } = await supabase
      .from("contactos")
      .select("id, nombre, telefono, email")
      .order("nombre");
    contactos = data || [];
  } catch {
    /* ignorar */
  }

  try {
    const { data } = await supabase
      .from("propiedades")
      .select("id, titulo")
      .order("created_at", { ascending: false });
    propiedades = data || [];
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

  try {
    const { data } = await supabase
      .from("proyectos")
      .select("id, nombre, tipo")
      .in("estado", ESTADOS_PROYECTO_ACTIVOS)
      .order("nombre");
    proyectos = data || [];
  } catch {
    /* ignorar */
  }

  return { contactos, propiedades, agentes, proyectos, agenteDefault: perfil?.id || null };
}
