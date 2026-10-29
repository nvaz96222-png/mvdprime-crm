"use client";

import { useMemo, useState } from "react";
import { formatPrecio } from "@/lib/format";
import { IconBuscar, IconCerrar } from "./iconos";

// Elegir una propiedad para mandar su ficha pública (/p/[id]) en el chat.
export default function ModalFicha({ propiedades, onElegir, onCerrar }) {
  const [texto, setTexto] = useState("");

  const lista = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const filtradas = q
      ? propiedades.filter((p) => [p.titulo, p.barrio].filter(Boolean).join(" ").toLowerCase().includes(q))
      : propiedades;
    // Disponibles primero.
    return [...filtradas].sort((a, b) => (a.estado === "disponible" ? 0 : 1) - (b.estado === "disponible" ? 0 : 1));
  }, [propiedades, texto]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCerrar}>
      <div className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <p className="flex-1 font-semibold text-slate-800">Enviar ficha de propiedad</p>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <IconCerrar size={18} />
          </button>
        </div>
        <label className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-slate-500">
          <IconBuscar size={16} />
          <input autoFocus type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por título o barrio" className="w-full bg-transparent text-sm text-slate-800 outline-none" />
        </label>
        <ul className="mt-2 min-h-0 flex-1 overflow-y-auto pb-3">
          {lista.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">No hay propiedades que coincidan.</li>}
          {lista.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onElegir(p)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{p.titulo || "Sin título"}</p>
                  <p className="text-xs text-slate-500">{formatPrecio(p.precio, p.moneda)}{p.barrio ? ` · ${p.barrio}` : ""}</p>
                </div>
                {p.estado && p.estado !== "disponible" && (
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] capitalize text-slate-500">{p.estado}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
