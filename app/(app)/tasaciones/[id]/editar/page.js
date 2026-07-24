import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadOpcionesTasacion } from "@/lib/data/tasaciones";
import TasacionForm from "@/components/tasaciones/TasacionForm";

export const dynamic = "force-dynamic";

export default async function EditarTasacionPage({ params }) {
  const supabase = createClient();

  const { data: tasacion, error } = await supabase
    .from("tasaciones")
    .select("*, comparables:tasacion_comparables(*)")
    .eq("id", params.id)
    .single();

  if (error || !tasacion) notFound();

  const opciones = await loadOpcionesTasacion(supabase);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          href={`/tasaciones/${tasacion.id}`}
          className="text-sm text-slate-500 hover:text-accent"
        >
          ← Volver a la tasación
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Editar tasación</h1>
      </div>

      <TasacionForm opciones={opciones} initial={tasacion} />
    </div>
  );
}
