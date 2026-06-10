import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadOpcionesPropiedad } from "@/lib/data/propiedades";
import PropiedadForm from "@/components/propiedades/PropiedadForm";

export const dynamic = "force-dynamic";

export default async function EditarPropiedadPage({ params }) {
  const supabase = createClient();

  const { data: propiedad, error } = await supabase
    .from("propiedades")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error && error.code === "42P17") {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">No se pudo cargar la propiedad.</p>
        <p className="mt-1">
          Recursión en las políticas RLS. Ejecutá{" "}
          <code className="rounded bg-red-100 px-1">supabase/rls_fix.sql</code>.
        </p>
      </div>
    );
  }

  if (!propiedad) notFound();

  const { data: fotos } = await supabase
    .from("fotos")
    .select("id, url, storage_path, orden, es_principal")
    .eq("propiedad_id", params.id)
    .order("orden");

  const { propietarios, agentes } = await loadOpcionesPropiedad(supabase);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link href="/propiedades" className="text-sm text-slate-500 hover:text-accent">
          ← Volver a propiedades
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Editar propiedad</h1>
        <p className="mt-0.5 text-sm text-slate-500">{propiedad.titulo}</p>
      </div>

      <PropiedadForm
        propiedad={propiedad}
        propietarios={propietarios}
        agentes={agentes}
        fotosExistentes={fotos || []}
      />
    </div>
  );
}
