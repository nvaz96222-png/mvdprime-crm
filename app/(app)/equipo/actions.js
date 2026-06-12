"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/supabase/getPerfil";

async function checkAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const perfil = await getPerfil(supabase, user);
  if (perfil?.rol !== "admin") throw new Error("Solo los admins pueden realizar esta acción.");
  return perfil;
}

export async function crearUsuario(prevState, formData) {
  try {
    await checkAdmin();
  } catch (e) {
    return { error: e.message };
  }

  const nombre = formData.get("nombre")?.trim();
  const email = formData.get("email")?.trim().toLowerCase();
  const password = formData.get("password");
  const rol = formData.get("rol");

  if (!nombre || !email || !password || !rol) {
    return { error: "Todos los campos son requeridos." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const admin = createAdminClient();

  // Crear usuario en Supabase Auth (confirma el email automáticamente).
  const { data, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes("already registered")) {
      return { error: "Ya existe un usuario con ese email." };
    }
    return { error: authError.message };
  }

  // Insertar perfil en la tabla usuarios.
  const { error: dbError } = await admin.from("usuarios").insert({
    auth_id: data.user.id,
    nombre,
    email,
    rol,
    activo: true,
  });

  if (dbError) {
    // Revertir: borrar auth user si falló el insert.
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: dbError.message };
  }

  redirect("/equipo");
}

export async function toggleActivo(id, activo) {
  try {
    await checkAdmin();
  } catch (e) {
    return { error: e.message };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("usuarios").update({ activo }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/equipo");
}
