import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadOpcionesPropiedad } from "@/lib/data/propiedades";
import PropiedadForm from "@/components/propiedades/PropiedadForm";
import BtnCopiarFicha from "@/components/public/BtnCopiarFicha";

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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mvdprime.vercel.app";
  const fichaUrl = `${baseUrl}/p/${params.id}`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link href="/propiedades" className="text-sm text-slate-500 hover:text-accent">
          ← Volver a propiedades
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-navy">Editar propiedad</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link
              href={`/propiedades/${params.id}/analisis`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/5 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              Análisis de mercado
            </Link>
            <Link
              href={`/p/${params.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-navy hover:text-navy"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Ver ficha pública
            </Link>
            <BtnCopiarFicha url={fichaUrl} />
          </div>
        </div>
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
