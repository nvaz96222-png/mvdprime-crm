import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TasacionCard from "@/components/tasaciones/TasacionCard";
import TasacionFiltros from "@/components/tasaciones/TasacionFiltros";

export const dynamic = "force-dynamic";

export default async function TasacionesPage({ searchParams }) {
  const supabase = createClient();
  const { estado } = searchParams;

  let query = supabase
    .from("tasaciones")
    .select("*, agente:usuarios(nombre)")
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);

  const { data: tasaciones, error } = await query;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Tasaciones</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {error ? "—" : `${tasaciones?.length || 0} tasación(es)`}
          </p>
        </div>
        <Link
          href="/tasaciones/nuevo"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva tasación
        </Link>
      </div>

      <div className="mb-6">
        <TasacionFiltros />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold">No se pudieron cargar las tasaciones.</p>
          <p className="mt-1">{error.message}</p>
        </div>
      ) : tasaciones?.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tasaciones.map((t) => (
            <TasacionCard key={t.id} tasacion={t} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">
            {estado
              ? "No hay tasaciones que coincidan con el filtro."
              : "Todavía no hay tasaciones. Creá la primera con «Nueva tasación»."}
          </p>
        </div>
      )}
    </div>
  );
}
