"use client";

import { useState, useMemo } from "react";

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

function buildStats(comparables) {
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
  };
}

export default function AnalisisIA({ propiedad, comparables }) {
  const [estado, setEstado] = useState("idle"); // idle | loading | done | error
  const [analisis, setAnalisis] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const moneda = comparables[0]?.currency || propiedad.moneda || "USD";
  const stats = useMemo(() => buildStats(comparables), [comparables]);

  async function generarAnalisis() {
    setEstado("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/analisis-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedad, stats, moneda }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error desconocido");
      }
      setAnalisis(data.analisis);
      setEstado("done");
    } catch (err) {
      setErrorMsg(err.message);
      setEstado("error");
    }
  }

  if (comparables.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-slate-500">Se necesitan comparables para generar el análisis IA.</p>
        <p className="mt-1 text-sm text-slate-400">
          El crawler corre cada 8 horas y poblará datos de MercadoLibre.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Análisis IA con Claude Haiku</p>
            <p className="text-sm text-slate-500">
              Interpretación del mercado basada en {comparables.length} comparables activos
            </p>
          </div>
        </div>
        <button
          onClick={generarAnalisis}
          disabled={estado === "loading"}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent/90 disabled:opacity-60 transition"
        >
          {estado === "loading" ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Analizando…
            </>
          ) : estado === "done" ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Regenerar
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Generar análisis
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {estado === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {/* Resultado */}
      {estado === "done" && analisis && (
        <div className="space-y-4">
          {/* Posición en el mercado */}
          {analisis.posicion && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </span>
                <h3 className="text-sm font-semibold text-slate-700">Posición en el mercado</h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{analisis.posicion}</p>
            </div>
          )}

          {/* Recomendación de precio */}
          {analisis.recomendacion && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </span>
                <h3 className="text-sm font-semibold text-slate-700">Recomendación de precio</h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{analisis.recomendacion}</p>
            </div>
          )}

          {/* Insights clave */}
          {analisis.insights?.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </span>
                <h3 className="text-sm font-semibold text-slate-700">Insights clave</h3>
              </div>
              <ul className="space-y-2">
                {analisis.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-100 text-[10px] font-bold text-green-600">
                      {i + 1}
                    </span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-right text-xs text-slate-400">
            Generado por Claude Haiku · Basado en datos de mercado al momento del análisis
          </p>
        </div>
      )}

      {/* Estado idle — placeholder */}
      {estado === "idle" && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
          </svg>
          <p className="text-sm font-medium text-slate-500">Presioná &quot;Generar análisis&quot; para obtener insights IA</p>
          <p className="mt-1 text-xs text-slate-400">
            Claude Haiku analizará el precio, la zona y los comparables del mercado
          </p>
        </div>
      )}
    </div>
  );
}
