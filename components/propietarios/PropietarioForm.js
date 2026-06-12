"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PropietarioForm({ propietario = null, contactoId = null, nombreDefault = "" }) {
  const router = useRouter();
  const supabase = createClient();
  const esEdicion = !!propietario;

  const [form, setForm] = useState({
    nombre: propietario?.nombre || nombreDefault || "",
    telefono: propietario?.telefono || "",
    email: propietario?.email || "",
    documento: propietario?.documento || "",
    notas: propietario?.notas || "",
    es_propio: propietario?.es_propio ?? false,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setError("El nombre es requerido.");
      return;
    }
    setGuardando(true);
    setError(null);

    const payload = {
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      documento: form.documento.trim() || null,
      notas: form.notas.trim() || null,
      es_propio: form.es_propio,
      ...(contactoId && !esEdicion ? { contacto_id: contactoId } : {}),
    };

    let resultado;
    if (esEdicion) {
      resultado = await supabase
        .from("propietarios")
        .update(payload)
        .eq("id", propietario.id);
    } else {
      resultado = await supabase.from("propietarios").insert(payload);
    }

    if (resultado.error) {
      setError(resultado.error.message);
      setGuardando(false);
      return;
    }

    // Si vino desde un contacto, volver a su perfil.
    if (contactoId) {
      router.push(`/contactos/${contactoId}`);
    } else {
      router.push("/propietarios");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Nombre */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Nombre completo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          required
          placeholder="Ej: Carlos Rodríguez"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Teléfono + Email */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Teléfono
          </label>
          <input
            type="tel"
            value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            placeholder="Ej: 099 123 456"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="carlos@ejemplo.com"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Documento */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Documento (CI / pasaporte)
        </label>
        <input
          type="text"
          value={form.documento}
          onChange={(e) => set("documento", e.target.value)}
          placeholder="Ej: 1.234.567-8"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* es_propio */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={form.es_propio}
          onChange={(e) => set("es_propio", e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-accent accent-teal-600"
        />
        <div>
          <p className="text-sm font-medium text-slate-700">Vende propiedad propia</p>
          <p className="text-xs text-slate-400">
            El propietario es dueño directo (no intermediario).
          </p>
        </div>
      </label>

      {/* Notas */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Notas internas
        </label>
        <textarea
          value={form.notas}
          onChange={(e) => set("notas", e.target.value)}
          rows={3}
          placeholder="Observaciones, preferencias, disponibilidad…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={guardando}
          className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
        >
          {guardando
            ? esEdicion
              ? "Guardando…"
              : "Creando…"
            : esEdicion
            ? "Guardar cambios"
            : "Crear propietario"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
