import Link from "next/link";
import { LEAD_ETAPA_MAP } from "@/lib/constants";
import { formatFecha } from "@/lib/format";

export default function ProyectoLeadsPanel({ leads = [], proyectoId }) {
  const porEtapa = {};
  for (const l of leads) {
    porEtapa[l.etapa] = (porEtapa[l.etapa] || 0) + 1;
  }

  const enProceso =
    (porEtapa["calificado"] || 0) +
    (porEtapa["propuesta"] || 0) +
    (porEtapa["negociacion"] || 0);
  const conversion =
    leads.length > 0
      ? Math.round(((porEtapa["cierre"] || 0) / leads.length) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Total leads" value={leads.length} color="text-navy" />
        <KPICard label="Nuevos" value={porEtapa["nuevo"] || 0} color="text-accent" />
        <KPICard label="En proceso" value={enProceso} color="text-amber-600" />
        <KPICard label="Cerrados" value={porEtapa["cierre"] || 0} color="text-green-600" />
      </div>

      {/* Barra de conversión */}
      {leads.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs text-slate-400">Conversión leads → cierre</p>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${conversion}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-accent">{conversion}%</span>
          </div>
        </div>
      )}

      {/* Tabla de leads */}
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">
            No hay leads asociados a este proyecto todavía.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Los leads del formulario web se asignan automáticamente.
          </p>
          <Link
            href={`/leads/nuevo${proyectoId ? `?proyecto_id=${proyectoId}` : ""}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            + Crear lead manual
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </span>
            <Link
              href={`/leads/nuevo${proyectoId ? `?proyecto_id=${proyectoId}` : ""}`}
              className="text-xs font-medium text-accent hover:underline"
            >
              + Nuevo lead
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  Contacto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  Etapa
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400 sm:table-cell">
                  Agente
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400 md:table-cell">
                  Fecha
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leads.map((l) => {
                const etapa = LEAD_ETAPA_MAP[l.etapa];
                return (
                  <tr key={l.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-700">
                        {l.contacto?.nombre || "—"}
                      </span>
                      {l.contacto?.telefono && (
                        <span className="block text-xs text-slate-400">
                          {l.contacto.telefono}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {etapa ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          <span className={`h-1.5 w-1.5 rounded-full ${etapa.color}`} />
                          {etapa.label}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                      {l.agente?.nombre || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 md:table-cell">
                      {formatFecha(l.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/leads/${l.id}`}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
