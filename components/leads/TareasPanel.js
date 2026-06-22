"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function TareasPanel({ leadId, tareas = [], agentes = [], usuarioId = null }) {
  const router = useRouter();
  const supabase = createClient();

  const [titulo, setTitulo] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);

  const pendientes = tareas.filter((t) => !t.completada);
  const completadas = tareas.filter((t) => t.completada);

  async function agregar(e) {
    e.preventDefault();
    if (!titulo.trim()) { setError("Ingresá un título."); return; }
    setError("");
    setGuardando(true);
    const { error: err } = await supabase.from("tareas").insert({
      lead_id: leadId,
      titulo: titulo.trim(),
      vencimiento: vencimiento || null,
      responsable_id: responsableId || null,
      created_by: usuarioId,
    });
    setGuardando(false);
    if (err) { setError(err.message); return; }
    setTitulo("");
    setVencimiento("");
    setResponsableId("");
    router.refresh();
  }

  async function toggleCompletada(tarea) {
    const completada = !tarea.completada;
    await supabase
      .from("tareas")
      .update({ completada, completada_en: completada ? new Date().toISOString() : null })
      .eq("id", tarea.id);
    router.refresh();
  }

  async function eliminar(id) {
    await supabase.from("tareas").delete().eq("id", id);
    router.refresh();
  }

  const hoy = new Date().toISOString().split("T")[0];

  function vencimientoLabel(fecha) {
    if (!fecha) return null;
    if (fecha < hoy) return { text: "Vencida", cls: "text-red-600" };
    if (fecha === hoy) return { text: "Hoy", cls: "text-amber-600 font-semibold" };
    return { text: fecha, cls: "text-slate-400" };
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Tareas
          </h2>
          {pendientes.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
              {pendientes.length}
            </span>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-5 pt-4 space-y-4">
          {/* Form agregar */}
          <form onSubmit={agregar} className="space-y-2">
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="Nueva tarea…"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
              <button
                type="submit"
                disabled={guardando}
                className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
              >
                {guardando ? "…" : "Agregar"}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                className={`${inputClass} max-w-[160px]`}
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
              />
              {agentes.length > 0 && (
                <select
                  className={inputClass}
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {agentes.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>

          {/* Pendientes */}
          {pendientes.length > 0 && (
            <ul className="space-y-2">
              {pendientes.map((t) => {
                const vLabel = vencimientoLabel(t.vencimiento);
                return (
                  <li key={t.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <button
                      onClick={() => toggleCompletada(t)}
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-slate-300 hover:border-accent transition"
                      title="Marcar como completada"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">{t.titulo}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                        {vLabel && (
                          <span className={vLabel.cls}>{vLabel.text}</span>
                        )}
                        {t.responsable?.nombre && (
                          <span className="text-slate-400">{t.responsable.nombre}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => eliminar(t.id)}
                      className="shrink-0 text-slate-300 hover:text-red-400 transition"
                      title="Eliminar tarea"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {pendientes.length === 0 && completadas.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">
              No hay tareas pendientes.
            </p>
          )}

          {/* Completadas */}
          {completadas.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600 select-none">
                {completadas.length} completada{completadas.length > 1 ? "s" : ""}
              </summary>
              <ul className="mt-2 space-y-1.5">
                {completadas.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-lg px-3 py-2 opacity-60">
                    <button
                      onClick={() => toggleCompletada(t)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-accent bg-accent text-white transition hover:bg-accent/80"
                      title="Desmarcar"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <p className="flex-1 text-sm text-slate-500 line-through">{t.titulo}</p>
                    <button
                      onClick={() => eliminar(t.id)}
                      className="shrink-0 text-slate-300 hover:text-red-400 transition"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
