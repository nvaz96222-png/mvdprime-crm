import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadOpcionesTasacion } from "@/lib/data/tasaciones";
import TasacionForm from "@/components/tasaciones/TasacionForm";

export const dynamic = "force-dynamic";

export default async function NuevaTasacionPage({ searchParams }) {
  const supabase = createClient();
  const opciones = await loadOpcionesTasacion(supabase);
  const propiedadIdInicial = searchParams?.propiedad_id || null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          href="/tasaciones"
          className="text-sm text-slate-500 hover:text-accent"
        >
          ← Tasaciones
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Nueva tasación</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Cargá el inmueble y sus comparables. El valor se calcula en vivo.
        </p>
      </div>

      <TasacionForm
        opciones={opciones}
        propiedadIdInicial={propiedadIdInicial}
      />
    </div>
  );
}
