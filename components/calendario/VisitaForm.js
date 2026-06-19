"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

function toLocalDatetimeValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultFechaInicio() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalDatetimeValue(d.toISOString());
}

function defaultFechaFin(inicio) {
  if (!inicio) return "";
  const d = new Date(inicio);
  d.setHours(d.getHours() + 1);
  return toLocalDatetimeValue(d.toISOString());
}

export default function VisitaForm({ visita = null, leads = [], agentes = [], leadIdDefault = "", propiedadIdDefault = "" }) {
  const router = useRouter();
  const supabase = createClient();
  const esEdicion = Boolean(visita);

  const inicioDefault = visita?.fecha_inicio
    ? toLocalDatetimeValue(visita.fecha_inicio)
    : defaultFechaInicio();

  const [form, setForm] = useState({
    lead_id: visita?.lead_id || leadIdDefault || "",
    agente_id: visita?.agente_id || "",
    fecha_inicio: inicioDefault,
    fecha_fin: visita?.fecha_fin
      ? toLocalDatetimeValue(visita.fecha_fin)
      : defaultFechaFin(inicioDefault),
    notas: visita?.notas || "",
    estado: visita?.estado || "pendiente",
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function set(campo, valor) {
    setForm((f) => {
      const next = { ...f, [campo]: valor };
      // Auto-ajustar fecha_fin cuando cambia fecha_inicio
      if (campo === "fecha_inicio" && valor) {
        const inicioMs = new Date(valor).getTime();
        const finMs = new Date(f.fecha_fin || valor).getTime();
        const duracion = finMs - new Date(f.fecha_inicio || valor).getTime();
        const nuevaFin = new Date(inicioMs + Math.max(duracion, 60 * 60 * 1000));
        next.fecha_fin = toLocalDatetimeValue(nuevaFin.toISOString());
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.fecha_inicio || !form.fecha_fin) {
      setError("Las fechas son obligatorias.");
      return;
    }
    if (new Date(form.fecha_fin) <= new Date(form.fecha_inicio)) {
      setError("La fecha de fin debe ser posterior a la de inicio.");
      return;
    }

    setGuardando(true);

    const payload = {
      lead_id: form.lead_id || null,
      agente_id: form.agente_id || null,
      fecha_inicio: new Date(form.fecha_inicio).toISOString(),
      fecha_fin: new Date(form.fecha_fin).toISOString(),
      notas: form.notas.trim() || null,
      estado: form.estado,
    };

    const { error: err } = esEdicion
      ? await supabase.from("visitas").update(payload).eq("id", visita.id)
      : await supabase.from("visitas").insert(payload);

    setGuardando(false);

    if (err) {
      setError(err.message);
      return;
    }

    router.push("/calendario");
    router.refresh();
  }

  async function handleEliminar() {
    if (!confirm("¿Eliminar esta visita?")) return;
    setGuardando(true);
    await supabase.from("visitas").delete().eq("id", visita.id);
    router.push("/calendario");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-5">
        {/* Lead */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Lead / Contacto</label>
          <select value={form.lead_id} onChange={(e) => set("lead_id", e.target.value)} className={inputClass}>
            <option value="">Sin lead asociado</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.contacto?.nombre || "Sin nombre"}
                {l.propiedad?.titulo ? ` — ${l.propiedad.titulo}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Agente */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Agente responsable</label>
          <select value={form.agente_id} onChange={(e) => set("agente_id", e.target.value)} className={inputClass}>
            <option value="">Sin asignar</option>
            {agentes.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Inicio *</label>
            <input
              type="datetime-local"
              value={form.fecha_inicio}
              onChange={(e) => set("fecha_inicio", e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fin *</label>
            <input
              type="datetime-local"
              value={form.fecha_fin}
              onChange={(e) => set("fecha_fin", e.target.value)}
              required
              className={inputClass}
            />
          </div>
        </div>

        {/* Estado */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
          <div className="flex gap-3">
            {[
              { value: "pendiente", label: "Pendiente", color: "bg-amber-100 text-amber-700 border-amber-300" },
              { value: "realizada", label: "Realizada", color: "bg-green-100 text-green-700 border-green-300" },
              { value: "cancelada", label: "Cancelada", color: "bg-red-100 text-red-700 border-red-300" },
            ].map((op) => (
              <button
                key={op.value}
                type="button"
                onClick={() => set("estado", op.value)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  form.estado === op.value
                    ? op.color + " ring-2 ring-offset-1 ring-accent/40"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Notas</label>
          <textarea
            value={form.notas}
            onChange={(e) => set("notas", e.target.value)}
            rows={3}
            placeholder="Dirección, indicaciones, acuerdos previos…"
            className={inputClass + " resize-none"}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {esEdicion ? (
          <button
            type="button"
            onClick={handleEliminar}
            disabled={guardando}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/calendario")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-navy hover:text-navy"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-accent px-6 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Agendar visita"}
          </button>
        </div>
      </div>
    </form>
  );
}
