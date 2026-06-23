import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import KanbanBoard from "@/components/leads/KanbanBoard";
import BtnExportar from "@/components/ui/BtnExportar";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = createClient();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "*, contacto:contactos(id,nombre,telefono,email), propiedad:propiedades(id,titulo), agente:usuarios(id,nombre)"
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Pipeline de Leads</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {error ? "—" : `${leads?.length || 0} lead(s)`} · arrastrá las
            tarjetas para cambiar de etapa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BtnExportar
            datos={leads || []}
            nombre="leads"
            columnas={[
              { key: "contacto.nombre", label: "Contacto" },
              { key: "contacto.telefono", label: "Teléfono" },
              { key: "contacto.email", label: "Email" },
              { key: "etapa", label: "Etapa" },
              { key: "prioridad", label: "Prioridad" },
              { key: "propiedad.titulo", label: "Propiedad" },
              { key: "origen", label: "Origen" },
              { key: "agente.nombre", label: "Agente" },
              { key: "proximo_contacto", label: "Próximo contacto" },
              { key: "notas", label: "Notas" },
              { key: "created_at", label: "Fecha creación" },
            ]}
          />
          <Link
            href="/leads/nuevo"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark"
          >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo lead
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold">No se pudieron cargar los leads.</p>
          <p className="mt-1">{error.message}</p>
        </div>
      ) : (
        <KanbanBoard leads={leads || []} />
      )}
    </div>
  );
}
