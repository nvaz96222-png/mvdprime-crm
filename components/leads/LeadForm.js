"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LEAD_ETAPAS,
  LEAD_PRIORIDADES,
  ORIGENES,
  CONTACTO_INTERESES,
} from "@/lib/constants";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function LeadForm({
  contactos = [],
  propiedades = [],
  agentes = [],
  agenteDefault = null,
}) {
  const router = useRouter();
  const supabase = createClient();

  const [modoContacto, setModoContacto] = useState(
    contactos.length ? "existente" : "nuevo"
  );

  // Contacto existente
  const [contactoId, setContactoId] = useState("");

  // Contacto nuevo
  const [nuevoContacto, setNuevoContacto] = useState({
    nombre: "",
    telefono: "",
    email: "",
    fuente: "directo",
    interes: "compra",
  });

  // Lead
  const [lead, setLead] = useState({
    propiedad_id: "",
    agente_id: agenteDefault || "",
    etapa: "nuevo",
    origen: "directo",
    prioridad: "media",
    proximo_contacto: "",
    notas: "",
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function setC(campo, valor) {
    setNuevoContacto((c) => ({ ...c, [campo]: valor }));
  }
  function setL(campo, valor) {
    setLead((l) => ({ ...l, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Validación de contacto.
    if (modoContacto === "existente" && !contactoId) {
      setError("Seleccioná un contacto.");
      return;
    }
    if (modoContacto === "nuevo" && !nuevoContacto.nombre.trim()) {
      setError("El nombre del contacto es obligatorio.");
      return;
    }

    setGuardando(true);
    try {
      // 1) Resolver contacto.
      let cid = contactoId;
      if (modoContacto === "nuevo") {
        const { data, error } = await supabase
          .from("contactos")
          .insert({
            nombre: nuevoContacto.nombre.trim(),
            telefono: nuevoContacto.telefono.trim() || null,
            email: nuevoContacto.email.trim() || null,
            fuente: nuevoContacto.fuente,
            interes: nuevoContacto.interes,
          })
          .select("id")
          .single();
        if (error) throw error;
        cid = data.id;
      }

      // 2) Crear lead.
      const { data: leadCreado, error: leadErr } = await supabase
        .from("leads")
        .insert({
          contacto_id: cid,
          propiedad_id: lead.propiedad_id || null,
          agente_id: lead.agente_id || null,
          etapa: lead.etapa,
          origen: lead.origen,
          prioridad: lead.prioridad,
          proximo_contacto: lead.proximo_contacto || null,
          notas: lead.notas.trim() || null,
        })
        .select("id")
        .single();
      if (leadErr) throw leadErr;

      router.push(`/leads/${leadCreado.id}`);
      router.refresh();
    } catch (err) {
      setError(err?.message || "Ocurrió un error al guardar.");
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contacto */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Contacto
          </h2>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setModoContacto("existente")}
              className={`rounded-md px-3 py-1 font-medium ${
                modoContacto === "existente"
                  ? "bg-accent text-white"
                  : "text-slate-500"
              }`}
            >
              Existente
            </button>
            <button
              type="button"
              onClick={() => setModoContacto("nuevo")}
              className={`rounded-md px-3 py-1 font-medium ${
                modoContacto === "nuevo" ? "bg-accent text-white" : "text-slate-500"
              }`}
            >
              Nuevo
            </button>
          </div>
        </div>

        {modoContacto === "existente" ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Seleccionar contacto *
            </label>
            <select
              className={inputClass}
              value={contactoId}
              onChange={(e) => setContactoId(e.target.value)}
            >
              <option value="">— Elegir —</option>
              {contactos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.telefono ? ` · ${c.telefono}` : ""}
                </option>
              ))}
            </select>
            {contactos.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No hay contactos. Cambiá a “Nuevo”.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Nombre *">
              <input
                className={inputClass}
                value={nuevoContacto.nombre}
                onChange={(e) => setC("nombre", e.target.value)}
              />
            </Campo>
            <Campo label="Teléfono">
              <input
                className={inputClass}
                value={nuevoContacto.telefono}
                onChange={(e) => setC("telefono", e.target.value)}
              />
            </Campo>
            <Campo label="Email">
              <input
                type="email"
                className={inputClass}
                value={nuevoContacto.email}
                onChange={(e) => setC("email", e.target.value)}
              />
            </Campo>
            <Campo label="Fuente">
              <select
                className={inputClass}
                value={nuevoContacto.fuente}
                onChange={(e) => setC("fuente", e.target.value)}
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
                value={nuevoContacto.interes}
                onChange={(e) => setC("interes", e.target.value)}
              >
                {CONTACTO_INTERESES.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        )}
      </div>

      {/* Lead */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Datos del lead
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Propiedad de interés">
            <select
              className={inputClass}
              value={lead.propiedad_id}
              onChange={(e) => setL("propiedad_id", e.target.value)}
            >
              <option value="">— Sin asignar —</option>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Agente asignado">
            <select
              className={inputClass}
              value={lead.agente_id}
              onChange={(e) => setL("agente_id", e.target.value)}
            >
              <option value="">— Sin asignar —</option>
              {agentes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Etapa">
            <select
              className={inputClass}
              value={lead.etapa}
              onChange={(e) => setL("etapa", e.target.value)}
            >
              {LEAD_ETAPAS.map((et) => (
                <option key={et.value} value={et.value}>
                  {et.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Origen">
            <select
              className={inputClass}
              value={lead.origen}
              onChange={(e) => setL("origen", e.target.value)}
            >
              {ORIGENES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Prioridad">
            <select
              className={inputClass}
              value={lead.prioridad}
              onChange={(e) => setL("prioridad", e.target.value)}
            >
              {LEAD_PRIORIDADES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Próximo contacto">
            <input
              type="datetime-local"
              className={inputClass}
              value={lead.proximo_contacto}
              onChange={(e) => setL("proximo_contacto", e.target.value)}
            />
          </Campo>
          <Campo label="Notas" className="sm:col-span-2">
            <textarea
              className={inputClass}
              rows={3}
              value={lead.notas}
              onChange={(e) => setL("notas", e.target.value)}
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
          {guardando ? "Guardando…" : "Crear lead"}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, className = "", children }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}
