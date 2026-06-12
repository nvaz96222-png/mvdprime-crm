"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";

export default function PropietariosBuscador() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timer = useRef(null);

  const buscar = useCallback(
    (valor) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (valor.trim()) {
          params.set("q", valor.trim());
        } else {
          params.delete("q");
        }
        router.push(`/propietarios?${params.toString()}`);
      }, 350);
    },
    [router, searchParams]
  );

  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        defaultValue={searchParams.get("q") || ""}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Buscar por nombre, teléfono o email…"
        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
