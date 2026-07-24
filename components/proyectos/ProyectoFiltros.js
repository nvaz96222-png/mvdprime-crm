"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PROYECTO_TIPOS, PROYECTO_ESTADOS } from "@/lib/constants";

export default function ProyectoFiltros() {
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

  const hayFiltros = ["tipo", "estado"].some((k) => searchParams.get(k));

  const selectClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={searchParams.get("tipo") || ""}
        onChange={(e) => setFiltro("tipo", e.target.value)}
        className={selectClass}
        style={{ maxWidth: 200 }}
      >
        <option value="">Tipo: todos</option>
        {PROYECTO_TIPOS.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <select
        value={searchParams.get("estado") || ""}
        onChange={(e) => setFiltro("estado", e.target.value)}
        className={selectClass}
        style={{ maxWidth: 220 }}
      >
        <option value="">Estado: todos</option>
        {PROYECTO_ESTADOS.map((e) => (
          <option key={e.value} value={e.value}>{e.label}</option>
        ))}
      </select>

      {hayFiltros && (
        <button
          onClick={limpiar}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
