"use client";

import { useState, useMemo } from "react";
import { formatPrecio } from "@/lib/format";

const PORTAL_LABEL = { mercadolibre: "MercadoLibre" };

function precioPorM2(price, area) {
  if (!price || !area || area === 0) return null;
  return Math.round(price / area);
}

export default function TablaComparables({ comparables, monedaPropia }) {
  const [sortKey, setSortKey] = useState("price");
  const [sortDir, setSortDir] = useState("asc");
  const [busqueda, setBusqueda] = useState("");

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const rows = useMemo(() => {
    let data = comparables.map((c) => ({
      ...c,
      precio_m2: precioPorM2(c.price, c.area_total),
    }));

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      data = data.filter(
        (c) =>
          c.neighborhood?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      let va = a[sortKey] ?? -Infinity;
      let vb = b[sortKey] ?? -Infinity;
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [comparables, sortKey, sortDir, busqueda]);

  function SortIcon({ field }) {
    if (sortKey !== field) return <span className="ml-1 text-slate-300">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const thClass =
    "px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-navy whitespace-nowrap";

  return (
    <div>
      {/* Buscador */}
      <div className="mb-3">
        <input
          type="search"
          placeholder="Buscar por barrio, ciudad o título…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={thClass} onClick={() => toggleSort("title")}>
                Publicación <SortIcon field="title" />
              </th>
              <th className={thClass} onClick={() => toggleSort("neighborhood")}>
                Barrio <SortIcon field="neighborhood" />
              </th>
              <th className={thClass} onClick={() => toggleSort("price")}>
                Precio <SortIcon field="price" />
              </th>
              <th className={thClass} onClick={() => toggleSort("area_total")}>
                m² <SortIcon field="area_total" />
              </th>
              <th className={thClass} onClick={() => toggleSort("precio_m2")}>
                $/m² <SortIcon field="precio_m2" />
              </th>
              <th className={thClass} onClick={() => toggleSort("bedrooms")}>
                Dorm. <SortIcon field="bedrooms" />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Portal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No hay resultados
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="max-w-[220px] px-3 py-3">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 font-medium text-navy hover:underline"
                    >
                      {c.title || "Sin título"}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {c.neighborhood || c.city || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-800">
                    {formatPrecio(c.price, c.currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {c.area_total ? `${c.area_total} m²` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {c.precio_m2 ? formatPrecio(c.precio_m2, c.currency) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center text-slate-600">
                    {c.bedrooms ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {PORTAL_LABEL[c.portal] || c.portal}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
          {rows.length} de {comparables.length} comparables
        </div>
      </div>
    </div>
  );
}
