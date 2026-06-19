"use client";

import { useMemo } from "react";
import { formatPrecio } from "@/lib/format";

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentil(arr, p) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function buildHistograma(precios, bins = 8) {
  if (!precios.length) return [];
  const min = Math.min(...precios);
  const max = Math.max(...precios);
  if (min === max) return [{ desde: min, hasta: max, count: precios.length }];
  const step = (max - min) / bins;
  const result = Array.from({ length: bins }, (_, i) => ({
    desde: min + i * step,
    hasta: min + (i + 1) * step,
    count: 0,
  }));
  for (const p of precios) {
    const idx = Math.min(Math.floor((p - min) / step), bins - 1);
    result[idx].count++;
  }
  return result;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-navy">{value ?? "—"}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function EstadisticasComparables({ propiedad, comparables }) {
  const moneda = comparables[0]?.currency || propiedad.moneda || "USD";

  const stats = useMemo(() => {
    const precios = comparables.map((c) => c.price).filter(Boolean);
    const precioM2 = comparables
      .filter((c) => c.price && c.area_total)
      .map((c) => Math.round(c.price / c.area_total));

    if (!precios.length) return null;

    return {
      n: precios.length,
      min: Math.min(...precios),
      max: Math.max(...precios),
      avg: Math.round(precios.reduce((s, p) => s + p, 0) / precios.length),
      med: Math.round(median(precios)),
      p25: Math.round(percentil(precios, 25)),
      p75: Math.round(percentil(precios, 75)),
      avgM2: precioM2.length
        ? Math.round(precioM2.reduce((s, p) => s + p, 0) / precioM2.length)
        : null,
      medM2: precioM2.length ? Math.round(median(precioM2)) : null,
      histograma: buildHistograma(precios),
      histogramaM2: precioM2.length ? buildHistograma(precioM2) : [],
    };
  }, [comparables]);

  if (!stats) {
    return (
      <p className="text-sm text-slate-400">No hay datos suficientes para estadísticas.</p>
    );
  }

  const maxCount = Math.max(...stats.histograma.map((b) => b.count));
  const maxCountM2 = stats.histogramaM2.length
    ? Math.max(...stats.histogramaM2.map((b) => b.count))
    : 0;

  // Posición del precio propio en el histograma
  const precioPropio = propiedad.precio;

  function posicionRelativa(precio, min, max) {
    if (!precio || min === max) return null;
    const pct = ((precio - min) / (max - min)) * 100;
    if (pct < 25) return { label: "por debajo del mercado", color: "text-green-600" };
    if (pct < 60) return { label: "en línea con el mercado", color: "text-slate-600" };
    return { label: "por encima del mercado", color: "text-red-600" };
  }

  const pos = posicionRelativa(precioPropio, stats.min, stats.max);

  return (
    <div className="space-y-6">
      {/* Posición relativa */}
      {precioPropio && pos && (
        <div className={`rounded-xl border bg-white p-4 shadow-sm ${pos.color === "text-green-600" ? "border-green-200 bg-green-50" : pos.color === "text-red-600" ? "border-red-200 bg-red-50" : "border-slate-200"}`}>
          <p className="text-sm">
            Tu propiedad ({formatPrecio(precioPropio, propiedad.moneda)}) está{" "}
            <strong className={pos.color}>{pos.label}</strong>{" "}
            frente a los {stats.n} comparables.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Precio promedio"
          value={formatPrecio(stats.avg, moneda)}
          sub={`Mediana: ${formatPrecio(stats.med, moneda)}`}
        />
        <StatCard
          label="Rango"
          value={`${formatPrecio(stats.min, moneda)} – ${formatPrecio(stats.max, moneda)}`}
          sub={`P25: ${formatPrecio(stats.p25, moneda)} · P75: ${formatPrecio(stats.p75, moneda)}`}
        />
        {stats.avgM2 && (
          <StatCard
            label="Precio/m² promedio"
            value={formatPrecio(stats.avgM2, moneda)}
            sub={stats.medM2 ? `Mediana: ${formatPrecio(stats.medM2, moneda)}` : undefined}
          />
        )}
        <StatCard
          label="Comparables"
          value={stats.n}
          sub="propiedades activas en el portal"
        />
      </div>

      {/* Histograma precios */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Distribución de precios</h3>
        <div className="flex items-end gap-1.5" style={{ height: "120px" }}>
          {stats.histograma.map((bin, i) => {
            const h = maxCount > 0 ? (bin.count / maxCount) * 100 : 0;
            // ¿el precio propio cae en este bin?
            const esPropio =
              precioPropio &&
              precioPropio >= bin.desde &&
              precioPropio < bin.hasta;
            return (
              <div key={i} className="group relative flex flex-1 flex-col items-center">
                <span className="mb-1 hidden text-[10px] text-slate-500 group-hover:block">
                  {bin.count}
                </span>
                <div
                  style={{ height: `${h}%` }}
                  className={`w-full min-h-[2px] rounded-t transition-all ${
                    esPropio ? "bg-amber-400" : "bg-blue-500"
                  }`}
                />
                <span className="mt-1 hidden text-[9px] text-slate-400 group-hover:block whitespace-nowrap">
                  {formatPrecio(Math.round(bin.desde / 1000) * 1000, moneda)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500"></span>
            Comparables
          </span>
          {precioPropio && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400"></span>
              Tu propiedad
            </span>
          )}
          <span className="ml-auto">
            {formatPrecio(stats.min, moneda)} → {formatPrecio(stats.max, moneda)}
          </span>
        </div>
      </div>

      {/* Histograma precio/m² */}
      {stats.histogramaM2.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Distribución precio/m²</h3>
          <div className="flex items-end gap-1.5" style={{ height: "100px" }}>
            {stats.histogramaM2.map((bin, i) => {
              const h = maxCountM2 > 0 ? (bin.count / maxCountM2) * 100 : 0;
              return (
                <div key={i} className="group relative flex flex-1 flex-col items-center">
                  <span className="mb-1 hidden text-[10px] text-slate-500 group-hover:block">
                    {bin.count}
                  </span>
                  <div
                    style={{ height: `${h}%` }}
                    className="w-full min-h-[2px] rounded-t bg-indigo-400 transition-all"
                  />
                  <span className="mt-1 hidden text-[9px] text-slate-400 group-hover:block whitespace-nowrap">
                    {formatPrecio(Math.round(bin.desde), moneda)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-400"></span>
              Precio/m² comparables
            </span>
            <span>
              Promedio: {formatPrecio(stats.avgM2, moneda)}/m²
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
