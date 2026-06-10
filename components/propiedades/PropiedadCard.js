"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ESTADOS, TIPO_MAP, OPERACION_MAP } from "@/lib/constants";
import { formatPrecio } from "@/lib/format";
import EstadoBadge from "./EstadoBadge";

export default function PropiedadCard({ propiedad }) {
  const router = useRouter();
  const supabase = createClient();
  const [estado, setEstado] = useState(propiedad.estado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const fotos = propiedad.fotos || [];
  const principal =
    fotos.find((f) => f.es_principal) ||
    [...fotos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0];

  async function cambiarEstado(nuevo) {
    const previo = estado;
    setEstado(nuevo);
    setGuardando(true);
    setError("");
    const { error } = await supabase
      .from("propiedades")
      .update({ estado: nuevo })
      .eq("id", propiedad.id);
    setGuardando(false);
    if (error) {
      setEstado(previo);
      setError("No se pudo actualizar");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Imagen */}
      <Link href={`/propiedades/${propiedad.id}/editar`} className="block">
        <div className="relative aspect-[4/3] w-full bg-slate-100">
          {principal?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={principal.url}
              alt={propiedad.titulo || "Propiedad"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            <EstadoBadge estado={estado} />
            {propiedad.publicar_web && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                En web
              </span>
            )}
          </div>
          {propiedad.operacion && (
            <span className="absolute right-2 top-2 rounded-full bg-navy/90 px-2.5 py-1 text-xs font-medium text-white">
              {OPERACION_MAP[propiedad.operacion] || propiedad.operacion}
            </span>
          )}
        </div>
      </Link>

      {/* Cuerpo */}
      <div className="p-4">
        <p className="text-lg font-bold text-navy">
          {formatPrecio(propiedad.precio, propiedad.moneda)}
        </p>
        <Link href={`/propiedades/${propiedad.id}/editar`}>
          <h3 className="mt-0.5 truncate font-medium text-slate-800 hover:text-accent">
            {propiedad.titulo || "Sin título"}
          </h3>
        </Link>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {[propiedad.barrio, propiedad.departamento].filter(Boolean).join(", ") || "Sin ubicación"}
        </p>

        {/* Métricas */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          {propiedad.dormitorios != null && (
            <span className="inline-flex items-center gap-1">
              <strong>{propiedad.dormitorios}</strong> dorm.
            </span>
          )}
          {propiedad.banos != null && (
            <span className="inline-flex items-center gap-1">
              <strong>{propiedad.banos}</strong> baños
            </span>
          )}
          {propiedad.tipo && (
            <span className="text-slate-400">· {TIPO_MAP[propiedad.tipo] || propiedad.tipo}</span>
          )}
        </div>

        {/* Cambio de estado rápido */}
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
          <label className="text-xs text-slate-400">Estado:</label>
          <select
            value={estado}
            disabled={guardando}
            onChange={(e) => cambiarEstado(e.target.value)}
            className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-accent disabled:opacity-60"
          >
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
          {guardando && <span className="text-xs text-slate-400">…</span>}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      </div>
    </div>
  );
}
