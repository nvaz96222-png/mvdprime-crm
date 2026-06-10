"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { INTERACCION_TIPOS } from "@/lib/constants";
import { formatFechaHora } from "@/lib/format";

const TIPO_MAP = Object.fromEntries(
  INTERACCION_TIPOS.map((t) => [t.value, t.label])
);

const TIPO_ICON = {
  llamada: "📞",
  whatsapp: "💬",
  email: "✉️",
  visita: "🏠",
  nota: "📝",
  otro: "•",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function InteraccionesPanel({
  leadId,
  interacciones = [],
  usuarioId = null,
}) {
  const router = useRouter();
  const supabase = createClient();

  const [tipo, setTipo] = useState("llamada");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function agregar(e) {
    e.preventDefault();
    if (!descripcion.trim()) {
      setError("Escribí una descripción.");
      return;
    }
    setError("");
    setGuardando(true);
    const { error } = await supabase.from("interacciones").insert({
      lead_id: leadId,
      usuario_id: usuarioId,
      tipo,
      descripcion: descripcion.trim(),
      fecha: new Date().toISOString(),
    });
    setGuardando(false);
    if (error) {
      setError(error.message);
    } else {
      setDescripcion("");
      setTipo("llamada");
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Historial de interacciones
      </h2>

      {/* Form para agregar */}
      <form onSubmit={agregar} className="mb-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={`${inputClass} sm:w-40`}
          >
            {INTERACCION_TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder="¿Qué pasó? (ej: llamé y agendamos visita)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <button
            type="submit"
            disabled={guardando}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {guardando ? "…" : "Registrar"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {/* Lista */}
      {interacciones.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Todavía no hay interacciones registradas.
        </p>
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-5">
          {interacciones.map((it) => (
            <li key={it.id} className="relative">
              <span className="absolute -left-[27px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs">
                {TIPO_ICON[it.tipo] || "•"}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {TIPO_MAP[it.tipo] || it.tipo}
                </span>
                <span className="text-xs text-slate-400">
                  {formatFechaHora(it.fecha)}
                </span>
                {it.usuario?.nombre && (
                  <span className="text-xs text-slate-400">
                    · {it.usuario.nombre}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-slate-600">{it.descripcion}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
