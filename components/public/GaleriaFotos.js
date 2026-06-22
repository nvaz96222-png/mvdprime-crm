"use client";

import { useState } from "react";
import Image from "next/image";

export default function GaleriaFotos({ fotos, titulo }) {
  const principal = fotos.find((f) => f.es_principal) || fotos[0];
  const [activa, setActiva] = useState(principal?.url || null);
  const [lightbox, setLightbox] = useState(false);

  if (fotos.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-200 text-slate-400 sm:h-96">
        <div className="text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="mt-2 text-sm">Sin fotos disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Imagen principal */}
      <div
        className="relative cursor-zoom-in overflow-hidden rounded-2xl bg-slate-900"
        style={{ aspectRatio: "16/9", maxHeight: "480px" }}
        onClick={() => setLightbox(true)}
      >
        <img
          src={activa || fotos[0].url}
          alt={titulo}
          className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
        />
        {fotos.length > 1 && (
          <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {fotos.findIndex((f) => f.url === activa) + 1} / {fotos.length}
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition hover:opacity-100">
          <div className="rounded-full bg-black/40 p-3 text-white backdrop-blur-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Miniaturas */}
      {fotos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {fotos.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiva(f.url)}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                activa === f.url ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={f.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            onClick={() => setLightbox(false)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={activa || fotos[0].url}
            alt={titulo}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {fotos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/30"
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = fotos.findIndex((f) => f.url === activa);
                  setActiva(fotos[(idx - 1 + fotos.length) % fotos.length].url);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/30"
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = fotos.findIndex((f) => f.url === activa);
                  setActiva(fotos[(idx + 1) % fotos.length].url);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
