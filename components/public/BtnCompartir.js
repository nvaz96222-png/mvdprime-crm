"use client";

import { useState } from "react";

export default function BtnCompartir({ titulo, proyectoId, slug }) {
  const [copiado, setCopiado] = useState(false);

  function trackCompartir() {
    if (!proyectoId && !slug) return;
    const payload = JSON.stringify({ proyecto_id: proyectoId, slug: slug || "", tipo: "compartir_click" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/proyecto-evento", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/proyecto-evento", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }).catch(() => {});
    }
  }

  async function copiar() {
    const url = window.location.href;
    trackCompartir();
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // fallback: seleccionar texto
      const el = document.createElement("input");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  return (
    <button
      onClick={copiar}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-navy"
    >
      {copiado ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          ¡Link copiado!
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Copiar enlace
        </>
      )}
    </button>
  );
}
