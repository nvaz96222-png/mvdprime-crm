"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { PROYECTO_TIPOS, PROYECTO_ESTADOS, DEPARTAMENTOS } from "@/lib/constants";

const ESTADOS_PUBLICOS = PROYECTO_ESTADOS.filter(
  (e) => !["pausado", "cancelado"].includes(e.value)
);

export default function FiltrosDesarrollos({ barrios = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = (k) => searchParams.get(k) || "";

  const set = useCallback(
    (k, v) => {
      const params = new URLSearchParams(searchParams.toString());
      if (v) {
        params.set(k, v);
      } else {
        params.delete(k);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const limpiar = () => router.replace(pathname);
  const hayFiltros = ["barrio", "departamento", "tipo", "estado", "destacado"].some(
    (k) => searchParams.get(k)
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Barrio */}
      {barrios.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Barrio
          </label>
          <select
            value={get("barrio")}
            onChange={(e) => set("barrio", e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Todos</option>
            {barrios.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Departamento */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Departamento
        </label>
        <select
          value={get("departamento")}
          onChange={(e) => set("departamento", e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
        >
          <option value="">Todos</option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Tipo */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Tipo
        </label>
        <select
          value={get("tipo")}
          onChange={(e) => set("tipo", e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
        >
          <option value="">Todos</option>
          {PROYECTO_TIPOS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Estado */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Estado
        </label>
        <select
          value={get("estado")}
          onChange={(e) => set("estado", e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
        >
          <option value="">Todos</option>
          {ESTADOS_PUBLICOS.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
      </div>

      {/* Destacado */}
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-accent/50 has-[:checked]:border-accent has-[:checked]:bg-accent/5 has-[:checked]:text-accent">
        <input
          type="checkbox"
          checked={get("destacado") === "1"}
          onChange={(e) => set("destacado", e.target.checked ? "1" : "")}
          className="accent-accent"
        />
        Solo destacados
      </label>

      {/* Limpiar */}
      {hayFiltros && (
        <button
          onClick={limpiar}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
