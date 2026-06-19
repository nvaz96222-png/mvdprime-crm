import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VisitaForm from "@/components/calendario/VisitaForm";

export const dynamic = "force-dynamic";

export default async function EditarVisitaPage({ params }) {
  const supabase = createClient();

  const [{ data: visita }, { data: leads }, { data: agentes }] = await Promise.all([
    supabase.from("visitas").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("leads")
      .select("id, etapa, contacto:contactos(nombre), propiedad:propiedades(titulo)")
      .neq("etapa", "perdido")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  if (!visita) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/calendario" className="text-sm text-slate-500 hover:text-accent">
          ← Volver al calendario
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Editar visita</h1>
      </div>
      <VisitaForm
        visita={visita}
        leads={leads || []}
        agentes={agentes || []}
      />
    </div>
  );
}
