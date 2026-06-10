"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TIPOS, OPERACIONES, ESTADOS } from "@/lib/constants";

export default function PropiedadesFiltros({ barrios = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setFiltro(key, value) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function limpiar() {
    router.push(pathname);
  }

  const hayFiltros = ["tipo", "operacion", "estado", "barrio"].some((k) =>
    searchParams.get(k)
  );

  const selectClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <select
        value={searchParams.get("tipo") || ""}
        onChange={(e) => setFiltro("tipo", e.target.value)}
        className={selectClass}
      >
        <option value="">Tipo: todos</option>
        {TIPOS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("operacion") || ""}
        onChange={(e) => setFiltro("operacion", e.target.value)}
        className={selectClass}
      >
        <option value="">Operación: todas</option>
        {OPERACIONES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("estado") || ""}
        onChange={(e) => setFiltro("estado", e.target.value)}
        className={selectClass}
      >
        <option value="">Estado: todos</option>
        {ESTADOS.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <select
          value={searchParams.get("barrio") || ""}
          onChange={(e) => setFiltro("barrio", e.target.value)}
          className={selectClass}
        >
          <option value="">Barrio: todos</option>
          {barrios.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        {hayFiltros && (
          <button
            onClick={limpiar}
            title="Limpiar filtros"
            className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
