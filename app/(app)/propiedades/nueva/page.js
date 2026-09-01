import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadOpcionesPropiedad } from "@/lib/data/propiedades";
import PropiedadForm from "@/components/propiedades/PropiedadForm";

export const dynamic = "force-dynamic";

export default async function NuevaPropiedadPage({ searchParams }) {
  const supabase = createClient();
  const { propietarios, agentes, agenteDefault } =
    await loadOpcionesPropiedad(supabase);

  // Permite pre-seleccionar propietario desde /propietarios/[id]
  const propietarioDefault = searchParams.propietario_id || null;

  // Prellenado desde una tasación: cargar la unidad con el valor tasado.
  let prefill = null;
  let tasacionRef = null;
  if (searchParams.tasacion) {
    const { data: t } = await supabase
      .from("tasaciones")
      .select(
        "id, titulo, tipo, operacion, barrio, departamento, superficie, superficie_interior, dormitorios, banos, moneda, valor_probable, cochera_valor, agente_id"
      )
      .eq("id", searchParams.tasacion)
      .maybeSingle();
    if (t) {
      tasacionRef = t;
      prefill = {
        titulo: t.titulo || "",
        tipo: t.tipo,
        operacion: t.operacion,
        precio: t.valor_probable ?? "",
        moneda: t.moneda || "USD",
        barrio: t.barrio || "",
        departamento: t.departamento || "",
        dormitorios: t.dormitorios ?? "",
        banos: t.banos ?? "",
        superficie_total: t.superficie ?? "",
        superficie_cubierta: t.superficie_interior ?? "",
        parking: (t.cochera_valor || 0) > 0,
        agente_id: t.agente_id || "",
      };
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link href="/propiedades" className="text-sm text-slate-500 hover:text-accent">
          ← Volver a propiedades
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Nueva propiedad</h1>
      </div>

      {tasacionRef && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Datos precargados desde la tasación{" "}
          <strong>{tasacionRef.titulo || "—"}</strong> · precio ={" "}
          <strong>
            {tasacionRef.moneda}{" "}
            {tasacionRef.valor_probable
              ? Number(tasacionRef.valor_probable).toLocaleString("es-UY")
              : "—"}
          </strong>
          . Revisá y ajustá antes de guardar.
        </div>
      )}

      <PropiedadForm
        propietarios={propietarios}
        agentes={agentes}
        agenteDefault={agenteDefault}
        propietarioDefault={propietarioDefault}
        prefill={prefill}
      />
    </div>
  );
}
