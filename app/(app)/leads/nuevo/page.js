import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadOpcionesLead } from "@/lib/data/leads";
import LeadForm from "@/components/leads/LeadForm";

export const dynamic = "force-dynamic";

export default async function NuevoLeadPage() {
  const supabase = createClient();
  const { contactos, propiedades, agentes, agenteDefault } =
    await loadOpcionesLead(supabase);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link href="/leads" className="text-sm text-slate-500 hover:text-accent">
          ← Volver al pipeline
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Nuevo lead</h1>
      </div>

      <LeadForm
        contactos={contactos}
        propiedades={propiedades}
        agentes={agentes}
        agenteDefault={agenteDefault}
      />
    </div>
  );
}
