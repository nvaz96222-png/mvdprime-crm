import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ORIGENES,
  CONTACTO_INTERESES,
  LEAD_ETAPA_MAP,
} from "@/lib/constants";
import { formatPrecio, formatFecha } from "@/lib/format";

export const dynamic = "force-dynamic";

const FUENTE_MAP = Object.fromEntries(ORIGENES.map((o) => [o.value, o.label]));
const INTERES_MAP = Object.fromEntries(
  CONTACTO_INTERESES.map((i) => [i.value, i.label])
);

export default async function ContactoPerfilPage({ params }) {
  const supabase = createClient();

  const { data: contacto, error } = await supabase
    .from("contactos")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        No se pudo cargar el contacto: {error.message}
      </div>
    );
  }
  if (!contacto) notFound();

  const { data: leads } = await supabase
    .from("leads")
    .select("*, propiedad:propiedades(id,titulo), agente:usuarios(nombre)")
    .eq("contacto_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/contactos" className="text-sm text-slate-500 hover:text-accent">
            ← Volver a contactos
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-lg font-semibold text-white">
              {(contacto.nombre || "?").charAt(0).toUpperCase()}
            </span>
            <h1 className="text-2xl font-bold text-navy">{contacto.nombre}</h1>
          </div>
        </div>
        <Link
          href={`/contactos/${contacto.id}/editar`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Editar
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Datos */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Información
            </h2>
            <dl className="space-y-3 text-sm">
              <Dato label="Teléfono" valor={contacto.telefono} />
              <Dato label="Email" valor={contacto.email} />
              <Dato label="Fuente" valor={FUENTE_MAP[contacto.fuente] || contacto.fuente} />
              <Dato label="Interés" valor={INTERES_MAP[contacto.interes] || contacto.interes} />
              <Dato
                label="Presupuesto"
                valor={
                  contacto.presupuesto_min || contacto.presupuesto_max
                    ? `${formatPrecio(contacto.presupuesto_min)} – ${formatPrecio(contacto.presupuesto_max)}`
                    : null
                }
              />
              <Dato
                label="Barrios de interés"
                valor={contacto.barrios_interes?.length ? contacto.barrios_interes.join(", ") : null}
              />
              <Dato label="Notas" valor={contacto.notas} />
            </dl>
          </div>
        </div>

        {/* Leads asociados */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Leads asociados
              </h2>
              <Link
                href={`/leads/nuevo`}
                className="text-sm font-medium text-accent hover:underline"
              >
                + Nuevo lead
              </Link>
            </div>

            {leads?.length ? (
              <ul className="divide-y divide-slate-100">
                {leads.map((l) => {
                  const etapa = LEAD_ETAPA_MAP[l.etapa];
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/leads/${l.id}`}
                        className="flex items-center gap-3 py-3 transition hover:bg-slate-50"
                      >
                        {etapa && (
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            <span className={`h-2 w-2 rounded-full ${etapa.color}`} />
                            {etapa.label}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-700">
                            {l.propiedad?.titulo || "Sin propiedad asignada"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatFecha(l.created_at)}
                            {l.agente?.nombre ? ` · ${l.agente.nombre}` : ""}
                          </p>
                        </div>
                        <svg className="shrink-0 text-slate-300" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">
                Este contacto no tiene leads todavía.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({ label, valor }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{valor || "—"}</dd>
    </div>
  );
}
