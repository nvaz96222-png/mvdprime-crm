import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/supabase/getPerfil";
import LeadControles from "@/components/leads/LeadControles";
import InteraccionesPanel from "@/components/leads/InteraccionesPanel";
import {
  LEAD_ETAPA_MAP,
  ORIGENES,
  CONTACTO_INTERESES,
} from "@/lib/constants";
import { formatPrecio, formatFecha, formatFechaHora } from "@/lib/format";

export const dynamic = "force-dynamic";

const ORIGEN_MAP = Object.fromEntries(ORIGENES.map((o) => [o.value, o.label]));
const INTERES_MAP = Object.fromEntries(
  CONTACTO_INTERESES.map((i) => [i.value, i.label])
);

export default async function LeadDetallePage({ params }) {
  const supabase = createClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      "*, contacto:contactos(*), propiedad:propiedades(id,titulo,barrio,precio,moneda), agente:usuarios(id,nombre)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        No se pudo cargar el lead: {error.message}
      </div>
    );
  }
  if (!lead) notFound();

  const [{ data: interacciones }, { data: agentes }, perfil] = await Promise.all([
    supabase
      .from("interacciones")
      .select("*, usuario:usuarios(id,nombre)")
      .eq("lead_id", params.id)
      .order("fecha", { ascending: false }),
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.auth.getUser().then(({ data: { user } }) => getPerfil(supabase, user)),
  ]);

  const etapa = LEAD_ETAPA_MAP[lead.etapa];
  const c = lead.contacto;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/leads" className="text-sm text-slate-500 hover:text-accent">
          ← Volver al pipeline
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-navy">
            {c?.nombre || "Lead"}
          </h1>
          {etapa && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              <span className={`h-2 w-2 rounded-full ${etapa.color}`} />
              {etapa.label}
            </span>
          )}
          <Link
            href={`/calendario/nueva?lead_id=${lead.id}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-navy hover:text-navy"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Agendar visita
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-2">
          {/* Contacto */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Contacto
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Dato label="Teléfono" valor={c?.telefono} />
              <Dato label="Email" valor={c?.email} />
              <Dato label="Interés" valor={INTERES_MAP[c?.interes] || c?.interes} />
              <Dato
                label="Presupuesto"
                valor={
                  c?.presupuesto_min || c?.presupuesto_max
                    ? `${formatPrecio(c?.presupuesto_min)} – ${formatPrecio(c?.presupuesto_max)}`
                    : null
                }
              />
              {c?.barrios_interes?.length > 0 && (
                <Dato
                  label="Barrios de interés"
                  valor={c.barrios_interes.join(", ")}
                  full
                />
              )}
            </dl>
            {c?.id && (
              <Link
                href={`/contactos/${c.id}`}
                className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
              >
                Ver perfil del contacto →
              </Link>
            )}
          </div>

          {/* Datos del lead */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Datos del lead
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Dato
                label="Propiedad"
                valor={
                  lead.propiedad ? (
                    <Link
                      href={`/propiedades/${lead.propiedad.id}/editar`}
                      className="text-accent hover:underline"
                    >
                      {lead.propiedad.titulo}
                    </Link>
                  ) : null
                }
              />
              <Dato label="Origen" valor={ORIGEN_MAP[lead.origen] || lead.origen} />
              <Dato
                label="Próximo contacto"
                valor={lead.proximo_contacto ? formatFechaHora(lead.proximo_contacto) : null}
              />
              <Dato label="Creado" valor={formatFecha(lead.created_at)} />
              {lead.notas && <Dato label="Notas" valor={lead.notas} full />}
            </dl>
          </div>

          {/* Interacciones */}
          <InteraccionesPanel
            leadId={lead.id}
            interacciones={interacciones || []}
            usuarioId={perfil?.id || null}
          />
        </div>

        {/* Columna lateral: controles */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Gestión
            </h2>
            <LeadControles lead={lead} agentes={agentes || []} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({ label, valor, full = false }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{valor || "—"}</dd>
    </div>
  );
}
