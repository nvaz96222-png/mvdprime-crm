import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PropiedadCard from "@/components/propiedades/PropiedadCard";
import PropiedadesFiltros from "@/components/propiedades/PropiedadesFiltros";

export const dynamic = "force-dynamic";

export default async function PropiedadesPage({ searchParams }) {
  const supabase = createClient();

  const { tipo, operacion, estado, barrio } = searchParams;

  let query = supabase
    .from("propiedades")
    .select("*, fotos(url, es_principal, orden)")
    .order("created_at", { ascending: false });

  if (tipo) query = query.eq("tipo", tipo);
  if (operacion) query = query.eq("operacion", operacion);
  if (estado) query = query.eq("estado", estado);
  if (barrio) query = query.eq("barrio", barrio);

  const { data: propiedades, error } = await query;

  // Barrios para el filtro (de todas las propiedades).
  const { data: barriosData } = await supabase
    .from("propiedades")
    .select("barrio");
  const barrios = [
    ...new Set((barriosData || []).map((p) => p.barrio).filter(Boolean)),
  ].sort();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Propiedades</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {error ? "—" : `${propiedades?.length || 0} propiedad(es)`}
          </p>
        </div>
        <Link
          href="/propiedades/nueva"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva propiedad
        </Link>
      </div>

      <div className="mb-6">
        <PropiedadesFiltros barrios={barrios} />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold">No se pudieron cargar las propiedades.</p>
          <p className="mt-1">{error.message}</p>
          {error.code === "42P17" && (
            <p className="mt-2 text-red-600">
              Hay una recursión en las políticas RLS de Supabase. Ejecutá{" "}
              <code className="rounded bg-red-100 px-1">supabase/rls_fix.sql</code>{" "}
              en el SQL Editor para destrabar la lectura de datos.
            </p>
          )}
        </div>
      ) : propiedades?.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {propiedades.map((p) => (
            <PropiedadCard key={p.id} propiedad={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">No hay propiedades que coincidan.</p>
          <Link href="/propiedades/nueva" className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
            Cargar la primera propiedad
          </Link>
        </div>
      )}
    </div>
  );
}
