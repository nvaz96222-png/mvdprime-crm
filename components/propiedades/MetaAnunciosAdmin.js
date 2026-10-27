"use client";

import { useState } from "react";

// =====================================================================
// Vincula IDs de anuncios de Meta a esta propiedad (tabla meta_anuncios).
//
// Con esto, los leads de Lead Ads y los mensajes Click-to-WhatsApp que
// vengan de un anuncio se asignan solos a la propiedad correcta.
// El ad_id se copia de Meta Ads Manager (columna "ID del anuncio").
// =====================================================================

export default function MetaAnunciosAdmin({ propiedadId, anunciosIniciales = [] }) {
  const [anuncios, setAnuncios] = useState(anunciosIniciales);
  const [adId, setAdId] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function agregar(e) {
    e.preventDefault();
    if (!adId.trim()) return;
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/meta/anuncios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: adId.trim(), propiedad_id: propiedadId, nombre: nombre.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo vincular el anuncio."); return; }
      setAnuncios((prev) => [data.anuncio, ...prev.filter((a) => a.ad_id !== data.anuncio.ad_id)]);
      setAdId("");
      setNombre("");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  async function quitar(ad_id) {
    setError("");
    const previo = anuncios;
    setAnuncios((prev) => prev.filter((a) => a.ad_id !== ad_id)); // optimista
    try {
      const res = await fetch("/api/meta/anuncios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id }),
      });
      if (!res.ok) { setAnuncios(previo); const d = await res.json().catch(() => ({})); setError(d.error || "No se pudo quitar."); }
    } catch {
      setAnuncios(previo);
      setError("No se pudo conectar con el servidor.");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-navy">
        <MetaLogo />
        Anuncios de Meta
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        Vinculá los IDs de anuncios para que los leads de esos avisos se asignen solos a esta propiedad.
      </p>

      {anuncios.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {anuncios.map((a) => (
            <li key={a.ad_id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
              <span className="min-w-0 text-xs text-slate-600">
                <span className="font-mono text-slate-800">{a.ad_id}</span>
                {a.nombre ? <span className="text-slate-500"> · {a.nombre}</span> : null}
              </span>
              <button
                onClick={() => quitar(a.ad_id)}
                className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                title="Quitar vínculo"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={agregar} className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={adId}
          onChange={(e) => setAdId(e.target.value)}
          placeholder="ID del anuncio (ad_id)"
          className="min-w-[180px] flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (opcional)"
          className="min-w-[140px] flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={cargando || !adId.trim()}
          className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {cargando ? "Vinculando…" : "Vincular"}
        </button>
      </form>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function MetaLogo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7c-1.2-1.8-2.5-3-4.2-3C5.1 4 3.5 6.6 3.5 10c0 2.4 1 4 2.6 4 1.4 0 2.4-1 3.9-3.7C11.3 8.2 12 7 12 7z" stroke="#0D7377" strokeWidth="1.6" />
      <path d="M12 7c1.2-1.8 2.5-3 4.2-3C18.9 4 20.5 6.6 20.5 10c0 2.4-1 4-2.6 4-1.4 0-2.4-1-3.9-3.7C12.7 8.2 12 7 12 7z" stroke="#0D7377" strokeWidth="1.6" />
    </svg>
  );
}
