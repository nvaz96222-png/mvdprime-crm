import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/supabase/getPerfil";
import { toggleActivo } from "./actions";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const perfil = await getPerfil(supabase, user);
  const esAdmin = perfil?.rol === "admin";

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Equipo</h1>
          <p className="mt-1 text-sm text-slate-500">
            {usuarios?.length || 0} miembro{usuarios?.length !== 1 ? "s" : ""}
          </p>
        </div>
        {esAdmin && (
          <Link
            href="/equipo/nuevo"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"
          >
            + Agregar usuario
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-6 py-4">Nombre</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Rol</th>
              <th className="px-6 py-4">Estado</th>
              {esAdmin && <th className="px-6 py-4" />}
            </tr>
          </thead>
          <tbody>
            {usuarios?.map((u) => {
              const esMiMismo = u.auth_id === user.id;
              return (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                        {(u.nombre || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{u.nombre}</p>
                        {esMiMismo && (
                          <p className="text-xs text-slate-400">Tú</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{u.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        u.rol === "admin"
                          ? "bg-navy/10 text-navy"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {u.rol === "admin" ? "Admin" : "Agente"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        u.activo
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {esAdmin && (
                    <td className="px-6 py-4 text-right">
                      {!esMiMismo && (
                        <form action={toggleActivo.bind(null, u.id, !u.activo)}>
                          <button
                            type="submit"
                            className="rounded px-2 py-1 text-xs text-slate-400 underline hover:text-slate-600"
                          >
                            {u.activo ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {(!usuarios || usuarios.length === 0) && (
          <div className="py-16 text-center text-slate-400">
            No hay usuarios registrados.
          </div>
        )}
      </div>

      {esAdmin && (
        <p className="mt-4 text-xs text-slate-400">
          Los usuarios inactivos no pueden iniciar sesión aunque tengan credenciales válidas.
        </p>
      )}
    </div>
  );
}
