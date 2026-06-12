"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORIGENES, CONTACTO_INTERESES } from "@/lib/constants";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

function toNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export default function ContactoForm({ contacto = null }) {
  const router = useRouter();
  const supabase = createClient();
  const esEdicion = Boolean(contacto);

  const [form, setForm] = useState({
    nombre: contacto?.nombre || "",
    telefono: contacto?.telefono || "",
    email: contacto?.email || "",
    fuente: contacto?.fuente || "directo",
    interes: contacto?.interes || "compra",
    presupuesto_min: contacto?.presupuesto_min ?? "",
    presupuesto_max: contacto?.presupuesto_max ?? "",
    barrios_interes: (contacto?.barrios_interes || []).join(", "),
    notas: contacto?.notas || "",
    es_propietario: contacto?.es_propietario ?? false,
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setGuardando(true);

    const barrios = form.barrios_interes
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);

    const payload = {
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      fuente: form.fuente,
      interes: form.interes,
      presupuesto_min: toNum(form.presupuesto_min),
      presupuesto_max: toNum(form.presupuesto_max),
      barrios_interes: barrios.length ? barrios : null,
      notas: form.notas.trim() || null,
      es_propietario: form.es_propietario,
    };

    try {
      if (esEdicion) {
        const { error } = await supabase
          .from("contactos")
          .update(payload)
          .eq("id", contacto.id);
        if (error) throw error;
        router.push(`/contactos/${contacto.id}`);
      } else {
        const { data, error } = await supabase
          .from("contactos")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        router.push(`/contactos/${data.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err?.message || "Ocurrió un error al guardar.");
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Datos del contacto
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nombre *" full>
            <input
              className={inputClass}
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="Nombre y apellido"
            />
          </Campo>
          <Campo label="Teléfono">
            <input
              className={inputClass}
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)}
            />
          </Campo>
          <Campo label="Email">
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Campo>
          <Campo label="Fuente">
            <select
              className={inputClass}
              value={form.fuente}
              onChange={(e) => set("fuente", e.target.value)}
            >
              {ORIGENES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Interés">
            <select
              className={inputClass}
              value={form.interes}
              onChange={(e) => set("interes", e.target.value)}
            >
              {CONTACTO_INTERESES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Presupuesto mínimo (US$)">
            <input
              type="number"
              className={inputClass}
              value={form.presupuesto_min}
              onChange={(e) => set("presupuesto_min", e.target.value)}
            />
          </Campo>
          <Campo label="Presupuesto máximo (US$)">
            <input
              type="number"
              className={inputClass}
              value={form.presupuesto_max}
              onChange={(e) => set("presupuesto_max", e.target.value)}
            />
          </Campo>
          {/* Toggle Propietario */}
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-slate-700">Etiqueta</p>
            <button
              type="button"
              onClick={() => set("es_propietario", !form.es_propietario)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                form.es_propietario
                  ? "border-navy bg-navy text-white"
                  : "border-slate-300 bg-white text-slate-500 hover:border-navy hover:text-navy"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Propietario
              {form.es_propietario && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
            <p className="mt-1.5 text-xs text-slate-400">
              Marcalo si este contacto quiere vender o alquilar una propiedad propia.
            </p>
          </div>

          <Campo label="Barrios de interés (separados por coma)" full>
            <input
              className={inputClass}
              value={form.barrios_interes}
              onChange={(e) => set("barrios_interes", e.target.value)}
              placeholder="Pocitos, Punta Carretas, Carrasco"
            />
          </Campo>
          <Campo label="Notas" full>
            <textarea
              className={inputClass}
              rows={3}
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
            />
          </Campo>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear contacto"}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, full = false, children }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}
