"use client";

import { useState } from "react";

// Ruta del CRM que inicia la conexión OAuth con Mercado Libre.
const CONECTAR_URL = "/api/mercadolibre/conectar";

export default function BtnPublicarML({
  propiedadId,
  conectado,
  mlItemId,
  mlEstado,
  mlPermalink,
  mlError,
}) {
  const [estado, setEstado] = useState(mlEstado || null);
  const [itemId, setItemId] = useState(mlItemId || null);
  const [permalink, setPermalink] = useState(mlPermalink || null);
  const [error, setError] = useState(mlError || "");
  const [cargando, setCargando] = useState("");

  async function llamar(accion) {
    setCargando(accion);
    setError("");
    try {
      const res = await fetch("/api/mercadolibre/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedadId, accion }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "NOT_CONNECTED") {
          setError("Mercado Libre no está conectado. Usá 'Conectar' primero.");
        } else {
          setError(data.message || data.error || "Error al publicar.");
        }
        if (accion === "publicar") setEstado("error");
        return;
      }
      if (accion === "publicar") {
        setItemId(data.itemId);
        setPermalink(data.permalink);
        setEstado(data.estado || "active");
      } else {
        setEstado(data.estado);
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando("");
    }
  }

  // --- Sin conexión OAuth: mostrar botón "Conectar" ---
  if (!conectado) {
    return (
      <a
        href={CONECTAR_URL}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFE600] px-3 py-1.5 text-sm font-semibold text-[#2D3277] hover:brightness-95 transition"
        title="Conectar la cuenta de Mercado Libre (una sola vez)"
      >
        <MlLogo />
        Conectar Mercado Libre
      </a>
    );
  }

  const publicada = !!itemId && estado !== "error";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {!publicada && (
          <button
            onClick={() => llamar("publicar")}
            disabled={cargando === "publicar"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFE600] px-3 py-1.5 text-sm font-semibold text-[#2D3277] hover:brightness-95 transition disabled:opacity-60"
          >
            <MlLogo />
            {cargando === "publicar" ? "Publicando…" : "Publicar en Mercado Libre"}
          </button>
        )}

        {publicada && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFE600] bg-[#FFF9C4] px-2.5 py-1.5 text-xs font-semibold text-[#2D3277]">
              <MlLogo />
              {estado === "paused" ? "Pausada en ML" : "Publicada en ML"}
            </span>
            {permalink && (
              <a
                href={permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-navy hover:text-navy"
              >
                Ver publicación ↗
              </a>
            )}
            <button
              onClick={() => llamar("publicar")}
              disabled={!!cargando}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-navy hover:text-navy disabled:opacity-60"
            >
              {cargando === "publicar" ? "Actualizando…" : "Actualizar datos"}
            </button>
            <button
              onClick={() => llamar(estado === "paused" ? "activar" : "pausar")}
              disabled={!!cargando}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-navy hover:text-navy disabled:opacity-60"
            >
              {cargando === "pausar" || cargando === "activar"
                ? "…"
                : estado === "paused"
                  ? "Reactivar"
                  : "Pausar"}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="max-w-md text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

function MlLogo() {
  return (
    <svg width="16" height="12" viewBox="0 0 40 30" aria-hidden="true">
      <ellipse cx="20" cy="15" rx="19" ry="13" fill="#2D3277" />
      <path
        d="M9 17c3-4 7-5 11-5s8 1 11 5c-3 3-7 4-11 4s-8-1-11-4z"
        fill="#FFE600"
      />
    </svg>
  );
}
