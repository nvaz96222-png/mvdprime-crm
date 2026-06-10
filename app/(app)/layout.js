import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/supabase/getPerfil";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Doble protección (además del middleware).
  if (!user) {
    redirect("/login");
  }

  const perfil = await getPerfil(supabase, user);

  // Datos a mostrar en el sidebar (con fallback al email si el perfil no carga).
  const usuario = {
    email: user.email,
    nombre: perfil?.nombre || perfil?.nombre_completo || user.email,
    rol: perfil?.rol || null,
  };

  return (
    <div className="min-h-screen md:flex">
      <Sidebar usuario={usuario} />
      <main className="flex-1 overflow-x-hidden bg-slate-100">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
