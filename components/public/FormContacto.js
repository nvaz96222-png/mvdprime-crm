"use client";
import { useState } from "react";

export default function FormContacto({ propiedadId, propiedadTitulo }) {
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    email: "",
    mensaje: `Hola, me interesa la propiedad "${propiedadTitulo}". ¿Pueden contactarme?`,
  });
  const [estado, setEstado] = useState("idle"); // idle | loading | ok | error
  const [errorMsg, setErrorMsg] = useState("");

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.telefono.trim()) return;
    setEstado("loading");
    try {
      const res = await fetch("/api/contacto-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim(),
          email: form.email.trim() || null,
          mensaje: form.mensaje.trim(),
          propiedad_id: propiedadId,
          propiedad_titulo: propiedadTitulo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      setEstado("ok");
    } catch (err) {
      setErrorMsg(err.message);
      setEstado("error");
    }
  }

  if (estado === "ok") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="font-semibold text-green-800">¡Consulta enviada!</p>
        <p className="mt-1 text-sm text-green-700">
          Te contactaremos a la brevedad. También podés escribirnos por WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-semibold text-navy">Solicitar información</p>
      <p className="text-xs text-slate-500">Te contactamos sin compromiso.</p>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          placeholder="Tu nombre"
          value={form.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Teléfono <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          required
          placeholder="09X XXX XXX"
          value={form.telefono}
          onChange={(e) => set("telefono", e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
        <input
          type="email"
          placeholder="tu@email.com"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Mensaje</label>
        <textarea
          rows={3}
          value={form.mensaje}
          onChange={(e) => set("mensaje", e.target.value)}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {estado === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={estado === "loading" || !form.nombre.trim() || !form.telefono.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50"
      >
        {estado === "loading" ? (
          <>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Enviando…
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Enviar consulta
          </>
        )}
      </button>
    </form>
  );
}
