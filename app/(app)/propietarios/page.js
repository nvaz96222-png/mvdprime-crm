import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PropietariosBuscador from "@/components/propietarios/PropietariosBuscador";

export const dynamic = "force-dynamic";

export default async function PropietariosPage({ searchParams }) {
  const supabase = createClient();
  const q = searchParams.q?.trim();

  let query = supabase
    .from("propietarios")
    .select("*, propiedades(count)")
    .order("nombre");

  if (q) {
    query = query.or(
      `nombre.ilike.*${q}*,email.ilike.*${q}*,telefono.ilike.*${q}*`
    );
  }

  const { data: propietarios, error } = await query;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Propietarios</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {error ? "—" : `${propietarios?.length || 0} propietario(s)`}
          </p>
        </div>
        <Link
          href="/propietarios/nuevo"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo propietario
        </Link>
      </div>

      <div className="mb-5">
        <PropietariosBuscador />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold">No se pudieron cargar los propietarios.</p>
          <p className="mt-1">{error.message}</p>
        </div>
      ) : propietarios?.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {propietarios.map((p) => {
              const nPropiedades = p.propiedades?.[0]?.count ?? 0;
              return (
                <li key={p.id}>
                  <Link
                    href={`/propietarios/${p.id}`}
                    className="flex items-center gap-4 px-4 py-3 transition hover:bg-slate-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                      {p.nombre.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-slate-800">{p.nombre}</p>
                        {p.es_propio && (
                          <span className="hidden rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent sm:inline">
                            Prop. propia
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-slate-500">
                        {[p.telefono, p.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {nPropiedades} propiedad{nPropiedades === 1 ? "" : "es"}
                    </span>
                    <svg className="shrink-0 text-slate-300" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">
            {q ? `No hay propietarios que coincidan con "${q}".` : "Todavía no hay propietarios."}
          </p>
          {!q && (
            <Link href="/propietarios/nuevo" className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
              Cargar el primer propietario
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
