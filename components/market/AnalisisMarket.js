"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import TablaComparables from "./TablaComparables";
import EstadisticasComparables from "./EstadisticasComparables";
import AnalisisIA from "./AnalisisIA";
import { formatPrecio } from "@/lib/format";
import { TIPO_MAP, OPERACION_MAP } from "@/lib/constants";

const MapaComparables = dynamic(() => import("./MapaComparables"), { ssr: false });

const TABS = [
  { id: "mapa", label: "Mapa" },
  { id: "tabla", label: "Tabla" },
  { id: "estadisticas", label: "Estadísticas" },
  { id: "ia", label: "Análisis IA" },
];

export default function AnalisisMarket({ propiedad, comparables }) {
  const [tab, setTab] = useState("mapa");

  const conCoordenadas = useMemo(
    () => comparables.filter((c) => c.lat && c.lng),
    [comparables]
  );

  const precioPropio = propiedad.precio;
  const monedaPropia = propiedad.moneda;

  return (
    <div>
      {/* Resumen propiedad */}
      <div className="mb-6 rounded-xl border border-navy/20 bg-navy/5 p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="font-semibold text-navy">
            {TIPO_MAP[propiedad.tipo] || propiedad.tipo} en {OPERACION_MAP[propiedad.operacion] || propiedad.operacion}
          </span>
          {precioPropio && (
            <span className="text-slate-700">
              Precio: <strong>{formatPrecio(precioPropio, monedaPropia)}</strong>
            </span>
          )}
          {propiedad.superficie_total && (
            <span className="text-slate-700">
              Superficie: <strong>{propiedad.superficie_total} m²</strong>
            </span>
          )}
          {propiedad.barrio && (
            <span className="text-slate-700">
              Zona: <strong>{propiedad.barrio}</strong>
            </span>
          )}
          <span className="ml-auto text-slate-500">
            {comparables.length} comparables encontrados
          </span>
        </div>
      </div>

      {comparables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">No hay datos de mercado disponibles todavía.</p>
          <p className="mt-1 text-sm text-slate-400">
            El crawler corre cada 8 horas y poblará comparables de MercadoLibre.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 w-fit">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-white text-navy shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "mapa" && (
            <MapaComparables
              propiedad={propiedad}
              comparables={conCoordenadas}
            />
          )}
          {tab === "tabla" && (
            <TablaComparables comparables={comparables} monedaPropia={monedaPropia} />
          )}
          {tab === "estadisticas" && (
            <EstadisticasComparables
              propiedad={propiedad}
              comparables={comparables}
            />
          )}
          {tab === "ia" && (
            <AnalisisIA propiedad={propiedad} comparables={comparables} />
          )}
        </>
      )}
    </div>
  );
}
