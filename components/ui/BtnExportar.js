"use client";

export default function BtnExportar({ datos = [], columnas = [], nombre = "exportacion" }) {
  function exportar() {
    if (!datos.length) return;

    const encabezado = columnas.map((c) => `"${c.label}"`).join(",");
    const filas = datos.map((fila) =>
      columnas
        .map((c) => {
          const val = c.key.split(".").reduce((o, k) => o?.[k], fila) ?? "";
          const str = Array.isArray(val) ? val.join(", ") : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csv = "﻿" + [encabezado, ...filas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nombre}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={exportar}
      disabled={!datos.length}
      title="Exportar a CSV (Excel)"
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:opacity-40 transition"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Exportar CSV
    </button>
  );
}
