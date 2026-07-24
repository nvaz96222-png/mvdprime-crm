import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  TASACION_ESTADO_MAP,
  TASACION_TIPO_MAP,
  OPERACION_MAP,
  COMPARABLE_FUENTE_MAP,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

function fmtMonto(n, moneda) {
  if (n == null) return "—";
  return `${moneda || "USD"} ${Number(n).toLocaleString("es-UY")}`;
}
function fmtM2(n) {
  if (n == null) return "—";
  return `${Number(n).toLocaleString("es-UY")} /m²`;
}

export default async function TasacionDetallePage({ params }) {
  const supabase = createClient();

  const { data: t, error } = await supabase
    .from("tasaciones")
    .select(
      "*, agente:usuarios(nombre), propiedad:propiedades(id, titulo), comparables:tasacion_comparables(*)"
    )
    .eq("id", params.id)
    .single();

  if (error || !t) notFound();

  const est = TASACION_ESTADO_MAP[t.estado];
  const comparables = (t.comparables || []).sort(
    (a, b) => (b.precio_m2 || 0) - (a.precio_m2 || 0)
  );
  const maxM2 = Math.max(1, ...comparables.map((c) => c.precio_m2 || 0));
  const ubicacion = [t.barrio, t.departamento].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-4xl">
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/tasaciones" className="text-sm text-slate-500 hover:text-accent">
            ← Tasaciones
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy">
              {t.titulo || "Tasación"}
            </h1>
            {est && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${est.badge}`}>
                {est.label}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {TASACION_TIPO_MAP[t.tipo] || t.tipo}
            {t.operacion ? ` · ${OPERACION_MAP[t.operacion] || t.operacion}` : ""}
            {ubicacion ? ` · ${ubicacion}` : ""}
          </p>
        </div>
        <Link
          href={`/tasaciones/${t.id}/editar`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Editar
        </Link>
      </div>

      {/* Rango de valor */}
      <div className="mb-6 rounded-xl border border-accent/20 bg-accent/5 p-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Mínimo</p>
            <p className="mt-1 text-lg font-semibold text-slate-700">
              {fmtMonto(t.valor_min, t.moneda)}
            </p>
          </div>
          <div className="rounded-lg bg-white py-1 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-accent">Probable</p>
            <p className="mt-1 text-2xl font-bold text-accent">
              {fmtMonto(t.valor_probable, t.moneda)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Máximo</p>
            <p className="mt-1 text-lg font-semibold text-slate-700">
              {fmtMonto(t.valor_max, t.moneda)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>
            Precio/m² de referencia:{" "}
            <strong className="text-slate-700">
              {t.moneda} {fmtM2(t.precio_m2_referencia)}
            </strong>
          </span>
          {t.superficie != null && <span>Superficie: {t.superficie} m²</span>}
          <span>
            Margen de negociación:{" "}
            {Math.round((Number(t.margen_negociacion) || 0) * 100)}%
          </span>
        </div>
      </div>

      {/* Comparables */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Comparables ({comparables.length})
        </h2>

        {comparables.length === 0 ? (
          <p className="text-sm text-slate-500">Esta tasación no tiene comparables cargados.</p>
        ) : (
          <div className="space-y-3">
            {comparables.map((c) => {
              const pct = Math.round(((c.precio_m2 || 0) / maxM2) * 100);
              const excluido = c.incluido === false || c.es_outlier;
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-40 shrink-0">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {c.titulo ||
                        COMPARABLE_FUENTE_MAP[c.fuente] ||
                        c.fuente}
                    </p>
                    <p className="text-xs text-slate-400">
                      {COMPARABLE_FUENTE_MAP[c.fuente] || c.fuente}
                      {c.superficie ? ` · ${c.superficie} m²` : ""}
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="h-5 w-full overflow-hidden rounded bg-slate-100">
                      <div
                        className={`h-full ${excluido ? "bg-slate-300" : "bg-accent"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-28 shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-700">
                      {c.moneda} {fmtM2(c.precio_m2)}
                    </p>
                    {c.es_outlier && (
                      <span className="text-[10px] font-medium text-red-500">
                        outlier (excluido)
                      </span>
                    )}
                    {!c.es_outlier && c.incluido === false && (
                      <span className="text-[10px] font-medium text-slate-400">
                        excluido
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notas y meta */}
      {t.notas && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Notas
          </h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{t.notas}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-400">
        {t.propiedad?.id && (
          <Link href={`/propiedades/${t.propiedad.id}`} className="hover:text-accent">
            Propiedad vinculada: {t.propiedad.titulo}
          </Link>
        )}
        <span>Agente: {t.agente?.nombre || "Sin asignar"}</span>
      </div>
    </div>
  );
}
