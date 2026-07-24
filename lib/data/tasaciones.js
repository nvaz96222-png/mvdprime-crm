import { getPerfil } from "@/lib/supabase/getPerfil";

// Opciones para el formulario de tasación: agentes activos, el perfil como
// default, y las propiedades del inventario (para prefiltrar el inmueble a
// tasar y sembrar comparables de inventario propio).
export async function loadOpcionesTasacion(supabase) {
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

  let propiedades = [];
  try {
    const { data } = await supabase
      .from("propiedades")
      .select(
        "id, titulo, tipo, operacion, barrio, departamento, superficie_cubierta, superficie_total, dormitorios, banos, precio, moneda"
      )
      .order("created_at", { ascending: false })
      .limit(500);
    propiedades = data || [];
  } catch {
    /* ignorar */
  }

  return {
    agentes,
    agenteDefault: perfil?.id || null,
    propiedades,
  };
}
