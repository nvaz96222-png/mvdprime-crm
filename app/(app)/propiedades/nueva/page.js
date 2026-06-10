import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadOpcionesPropiedad } from "@/lib/data/propiedades";
import PropiedadForm from "@/components/propiedades/PropiedadForm";

export const dynamic = "force-dynamic";

export default async function NuevaPropiedadPage() {
  const supabase = createClient();
  const { propietarios, agentes, agenteDefault } =
    await loadOpcionesPropiedad(supabase);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link href="/propiedades" className="text-sm text-slate-500 hover:text-accent">
          ← Volver a propiedades
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Nueva propiedad</h1>
      </div>

      <PropiedadForm
        propietarios={propietarios}
        agentes={agentes}
        agenteDefault={agenteDefault}
      />
    </div>
  );
}
