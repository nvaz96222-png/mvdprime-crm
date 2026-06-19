import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import VisitaForm from "@/components/calendario/VisitaForm";

export const dynamic = "force-dynamic";

export default async function NuevaVisitaPage({ searchParams }) {
  const supabase = createClient();

  const [{ data: leads }, { data: agentes }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, etapa, contacto:contactos(nombre), propiedad:propiedades(titulo)")
      .neq("etapa", "perdido")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/calendario" className="text-sm text-slate-500 hover:text-accent">
          ← Volver al calendario
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Nueva visita</h1>
      </div>
      <VisitaForm
        leads={leads || []}
        agentes={agentes || []}
        leadIdDefault={searchParams.lead_id || ""}
        propiedadIdDefault={searchParams.propiedad_id || ""}
      />
    </div>
  );
}
