import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProyectoCard from "@/components/proyectos/ProyectoCard";
import ProyectoFiltros from "@/components/proyectos/ProyectoFiltros";

export const dynamic = "force-dynamic";

export default async function ProyectosPage({ searchParams }) {
  const supabase = createClient();

  const { tipo, estado } = searchParams;

  let query = supabase
    .from("proyectos")
    .select("*, fotos:proyecto_fotos(url, es_principal, orden)")
    .order("created_at", { ascending: false });

  if (tipo)   query = query.eq("tipo", tipo);
  if (estado) query = query.eq("estado", estado);

  const { data: proyectos, error } = await query;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Proyectos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {error ? "—" : `${proyectos?.length || 0} proyecto(s)`}
          </p>
        </div>

        {/* Aviso Drive */}
        <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2 text-xs text-accent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Los proyectos se sincronizan desde Google Drive con{" "}
          <code className="rounded bg-accent/10 px-1">npm run sync-projects</code>
        </div>
      </div>

      <div className="mb-6">
        <ProyectoFiltros />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold">No se pudieron cargar los proyectos.</p>
          <p className="mt-1">{error.message}</p>
        </div>
      ) : proyectos?.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {proyectos.map((p) => (
            <ProyectoCard key={p.id} proyecto={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">
            {tipo || estado
              ? "No hay proyectos que coincidan con los filtros."
              : "Todavía no hay proyectos. Ejecutá npm run sync-projects para importar desde Google Drive."}
          </p>
        </div>
      )}
    </div>
  );
}
