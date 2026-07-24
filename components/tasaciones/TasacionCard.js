import Link from "next/link";
import {
  TASACION_ESTADO_MAP,
  TASACION_TIPO_MAP,
} from "@/lib/constants";

function fmtMonto(n, moneda) {
  if (n == null) return "—";
  return `${moneda || "USD"} ${Number(n).toLocaleString("es-UY")}`;
}

function fmtFecha(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-UY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function TasacionCard({ tasacion }) {
  const est = TASACION_ESTADO_MAP[tasacion.estado];
  const ubicacion = [tasacion.barrio, tasacion.departamento]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/tasaciones/${tasacion.id}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-accent hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-navy group-hover:text-accent">
            {tasacion.titulo || "Tasación sin título"}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {TASACION_TIPO_MAP[tasacion.tipo] || tasacion.tipo}
            {ubicacion ? ` · ${ubicacion}` : ""}
          </p>
        </div>
        {est && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${est.badge}`}
          >
            {est.label}
          </span>
        )}
      </div>

      <div className="mt-auto rounded-lg bg-slate-50 p-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          Valor probable
        </p>
        <p className="text-lg font-bold text-accent">
          {fmtMonto(tasacion.valor_probable, tasacion.moneda)}
        </p>
        {(tasacion.valor_min != null || tasacion.valor_max != null) && (
          <p className="text-xs text-slate-500">
            {fmtMonto(tasacion.valor_min, tasacion.moneda)} –{" "}
            {fmtMonto(tasacion.valor_max, tasacion.moneda)}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>{tasacion.agente?.nombre || "Sin agente"}</span>
        <span>{fmtFecha(tasacion.created_at)}</span>
      </div>
    </Link>
  );
}
