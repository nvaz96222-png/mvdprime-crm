"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  PROYECTO_TIPOS,
  PROYECTO_ESTADOS,
  PROYECTO_AMENITIES,
  MONEDAS,
  DEPARTAMENTOS,
} from "@/lib/constants";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
const labelClass = "block text-sm font-medium text-slate-700";

function toNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function SeccionHeader({ titulo }) {
  return (
    <h2 className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
      {titulo}
    </h2>
  );
}

export default function ProyectoForm({ proyecto, agentes = [], agenteDefault = null }) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    descripcion:            proyecto?.descripcion || "",
    tipo:                   proyecto?.tipo || PROYECTO_TIPOS[0].value,
    estado:                 proyecto?.estado || "en_comercializacion",
    barrio:                 proyecto?.barrio || "",
    departamento:           proyecto?.departamento || "",
    direccion:              proyecto?.direccion || "",
    precio_desde:           proyecto?.precio_desde ?? "",
    precio_hasta:           proyecto?.precio_hasta ?? "",
    moneda:                 proyecto?.moneda || "USD",
    superficie_desde:       proyecto?.superficie_desde ?? "",
    superficie_hasta:       proyecto?.superficie_hasta ?? "",
    dormitorios_desde:      proyecto?.dormitorios_desde ?? "",
    dormitorios_hasta:      proyecto?.dormitorios_hasta ?? "",
    unidades_total:         proyecto?.unidades_total ?? "",
    desarrollador:          proyecto?.desarrollador || "",
    fecha_inicio_obras:     proyecto?.fecha_inicio_obras || "",
    fecha_entrega_estimada: proyecto?.fecha_entrega_estimada || "",
    amenities:              proyecto?.amenities || [],
    agente_id:              proyecto?.agente_id || agenteDefault || "",
    publicar_web:           proyecto?.publicar_web || false,
    destacado:              proyecto?.destacado || false,
    lat:                    proyecto?.lat ?? "",
    lng:                    proyecto?.lng ?? "",
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);
  const exitoTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(exitoTimerRef.current), []);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAmenity(value) {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(value)
        ? prev.amenities.filter((a) => a !== value)
        : [...prev.amenities, value],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setExito(false);

    // C3: cross-field validations
    const pd = toNum(form.precio_desde);
    const ph = toNum(form.precio_hasta);
    const sd = toNum(form.superficie_desde);
    const sh = toNum(form.superficie_hasta);
    const dd = toNum(form.dormitorios_desde);
    const dh = toNum(form.dormitorios_hasta);
    if (pd !== null && ph !== null && ph < pd) {
      setError("El precio hasta debe ser mayor o igual al precio desde.");
      return;
    }
    if (sd !== null && sh !== null && sh < sd) {
      setError("La superficie hasta debe ser mayor o igual a la superficie desde.");
      return;
    }
    if (dd !== null && dh !== null && dh < dd) {
      setError("Los dormitorios hasta deben ser mayor o igual a los dormitorios desde.");
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        descripcion:            form.descripcion || null,
        tipo:                   form.tipo,
        estado:                 form.estado,
        barrio:                 form.barrio || null,
        departamento:           form.departamento || null,
        direccion:              form.direccion || null,
        precio_desde:           pd,
        precio_hasta:           ph,
        moneda:                 form.moneda,
        superficie_desde:       sd,
        superficie_hasta:       sh,
        dormitorios_desde:      dd,
        dormitorios_hasta:      dh,
        unidades_total:         toNum(form.unidades_total),
        desarrollador:          form.desarrollador || null,
        fecha_inicio_obras:     form.fecha_inicio_obras || null,
        fecha_entrega_estimada: form.fecha_entrega_estimada || null,
        amenities:              form.amenities,
        agente_id:              form.agente_id || null,
        publicar_web:           form.publicar_web,
        destacado:              form.destacado,
        lat:                    toNum(form.lat),
        lng:                    toNum(form.lng),
        updated_at:             new Date().toISOString(),
      };

      const { error: err } = await supabase
        .from("proyectos")
        .update(payload)
        .eq("id", proyecto.id);

      if (err) {
        setError(err.message);
        return;
      }

      setExito(true);
      router.refresh();
      exitoTimerRef.current = setTimeout(() => {
        router.push("/proyectos");
      }, 1500);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Información del proyecto (sincronizado desde Drive — read-only) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Información Drive (solo lectura)" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Nombre</label>
            <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {proyecto?.nombre}
            </p>
          </div>
          <div>
            <label className={labelClass}>Slug</label>
            <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
              {proyecto?.slug}
            </p>
          </div>
        </div>
      </div>

      {/* Clasificación */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Clasificación" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Tipo *</label>
            <select
              value={form.tipo}
              onChange={(e) => set("tipo", e.target.value)}
              className={`mt-1 ${inputClass}`}
              required
            >
              {PROYECTO_TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Estado *</label>
            <select
              value={form.estado}
              onChange={(e) => set("estado", e.target.value)}
              className={`mt-1 ${inputClass}`}
              required
            >
              {PROYECTO_ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass}>Descripción</label>
          <textarea
            value={form.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
            rows={4}
            className={`mt-1 ${inputClass} resize-y`}
            placeholder="Descripción del proyecto para la web y el CRM…"
          />
        </div>

        <div className="mt-4">
          <label className={labelClass}>Desarrollador</label>
          <input
            type="text"
            value={form.desarrollador}
            onChange={(e) => set("desarrollador", e.target.value)}
            className={`mt-1 ${inputClass}`}
            placeholder="Empresa constructora o desarrolladora"
          />
        </div>
      </div>

      {/* Ubicación */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Ubicación" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Barrio</label>
            <input
              type="text"
              value={form.barrio}
              onChange={(e) => set("barrio", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="Ej: Pocitos, Punta Carretas…"
            />
          </div>
          <div>
            <label className={labelClass}>Departamento</label>
            <select
              value={form.departamento}
              onChange={(e) => set("departamento", e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">Seleccionar…</option>
              {DEPARTAMENTOS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Dirección</label>
            <input
              type="text"
              value={form.direccion}
              onChange={(e) => set("direccion", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="Calle y número"
            />
          </div>
          <div>
            <label className={labelClass}>Latitud</label>
            <input
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => set("lat", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="-34.9011"
            />
          </div>
          <div>
            <label className={labelClass}>Longitud</label>
            <input
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => set("lng", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="-56.1645"
            />
          </div>
        </div>
      </div>

      {/* Precios */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Precios (rango global)" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Moneda</label>
            <select
              value={form.moneda}
              onChange={(e) => set("moneda", e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Precio desde</label>
            <input
              type="number"
              min="0"
              value={form.precio_desde}
              onChange={(e) => set("precio_desde", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="0"
            />
          </div>
          <div>
            <label className={labelClass}>Precio hasta</label>
            <input
              type="number"
              min="0"
              value={form.precio_hasta}
              onChange={(e) => set("precio_hasta", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Dimensiones y unidades */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Dimensiones y unidades" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Superficie desde (m²)</label>
            <input
              type="number"
              min="0"
              value={form.superficie_desde}
              onChange={(e) => set("superficie_desde", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass}>Superficie hasta (m²)</label>
            <input
              type="number"
              min="0"
              value={form.superficie_hasta}
              onChange={(e) => set("superficie_hasta", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass}>Dormitorios desde</label>
            <input
              type="number"
              min="0"
              value={form.dormitorios_desde}
              onChange={(e) => set("dormitorios_desde", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass}>Dormitorios hasta</label>
            <input
              type="number"
              min="0"
              value={form.dormitorios_hasta}
              onChange={(e) => set("dormitorios_hasta", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>
        <div className="mt-4 max-w-xs">
          <label className={labelClass}>Total de unidades</label>
          <input
            type="number"
            min="0"
            value={form.unidades_total}
            onChange={(e) => set("unidades_total", e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      {/* Cronograma */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Cronograma" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Inicio de obras</label>
            <input
              type="date"
              value={form.fecha_inicio_obras}
              onChange={(e) => set("fecha_inicio_obras", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass}>Entrega estimada</label>
            <input
              type="date"
              value={form.fecha_entrega_estimada}
              onChange={(e) => set("fecha_entrega_estimada", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>
      </div>

      {/* Amenities */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Amenities" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {PROYECTO_AMENITIES.map((a) => (
            <label
              key={a.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-accent hover:bg-accent/5 has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:checked]:text-accent"
            >
              <input
                type="checkbox"
                checked={form.amenities.includes(a.value)}
                onChange={() => toggleAmenity(a.value)}
                className="accent-accent"
              />
              {a.label}
            </label>
          ))}
        </div>
      </div>

      {/* Responsable y publicación */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Responsable y publicación" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Agente responsable</label>
            <select
              value={form.agente_id}
              onChange={(e) => set("agente_id", e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">Sin asignar</option>
              {agentes.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-3 pt-1">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.publicar_web}
                onChange={(e) => set("publicar_web", e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-sm text-slate-700">Publicar en web (mvdprime.uy)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.destacado}
                onChange={(e) => set("destacado", e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-sm text-slate-700">Proyecto destacado</span>
            </label>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {exito && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          ✓ Proyecto guardado correctamente. Volviendo a proyectos…
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/proyectos")}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {guardando && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
