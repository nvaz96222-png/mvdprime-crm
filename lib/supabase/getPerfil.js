// Obtiene el perfil del usuario logueado desde la tabla `usuarios`.
// El vínculo con Supabase Auth es la columna `auth_id` == auth.uid().
// Es defensivo: si el RLS o el esquema fallan, devuelve null sin romper la app.
export async function getPerfil(supabase, user) {
  if (!user) return null;

  // Vínculo principal: usuarios.auth_id == auth.uid()
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, auth_id, nombre, email, rol, avatar_url, telefono, activo")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (!error && data) return data;
  } catch {
    /* ignorar */
  }

  // Fallback por email (por si auth_id aún no está cargado).
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, auth_id, nombre, email, rol, avatar_url, telefono, activo")
      .eq("email", user.email)
      .maybeSingle();
    if (!error && data) return data;
  } catch {
    /* ignorar */
  }

  return null;
}
