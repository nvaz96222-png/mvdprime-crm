"use client";

import Link from "next/link";
import { LEAD_PRIORIDADES, ORIGENES } from "@/lib/constants";
import { formatFecha } from "@/lib/format";

const ORIGEN_MAP = Object.fromEntries(ORIGENES.map((o) => [o.value, o.label]));
const PRIORIDAD_MAP = Object.fromEntries(
  LEAD_PRIORIDADES.map((p) => [p.value, p])
);

export default function LeadCard({ lead, onDragStart }) {
  const prioridad = PRIORIDAD_MAP[lead.prioridad];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/leads/${lead.id}`}
          className="font-medium text-slate-800 hover:text-accent"
        >
          {lead.contacto?.nombre || "Contacto sin nombre"}
        </Link>
        {prioridad && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${prioridad.badge}`}
          >
            {prioridad.label}
          </span>
        )}
      </div>

      {lead.propiedad?.titulo && (
        <p className="mt-1 truncate text-xs text-slate-500">
          🏠 {lead.propiedad.titulo}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
        {lead.origen && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
            {ORIGEN_MAP[lead.origen] || lead.origen}
          </span>
        )}
        <span>{formatFecha(lead.created_at)}</span>
      </div>

      {lead.agente?.nombre && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-white">
            {lead.agente.nombre.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-xs text-slate-500">
            {lead.agente.nombre}
          </span>
        </div>
      )}
    </div>
  );
}
