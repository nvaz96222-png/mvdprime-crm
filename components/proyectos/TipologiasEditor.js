"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TipologiaCard from "./TipologiaCard";

const FORM_VACIO = {
  nombre: "",
  dormitorios: "",
  superficie_desde: "",
  superficie_hasta: "",
  precio_desde: "",
  precio_hasta: "",
  moneda: "USD",
  unidades_total: "",
  unidades_disponibles: "",
};

const inputSm =
  "w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

function toNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function buildPayload(f) {
  return {
    nombre:              f.nombre.trim(),
    dormitorios:         toNum(f.dormitorios),
    superficie_desde:    toNum(f.superficie_desde),
    superficie_hasta:    toNum(f.superficie_hasta),
    precio_desde:        toNum(f.precio_desde),
    precio_hasta:        toNum(f.precio_hasta),
    moneda:              f.moneda,
    unidades_total:      toNum(f.unidades_total),
    unidades_disponibles: toNum(f.unidades_disponibles),
  };
}

// ─── Formulario inline (agregar o editar) ───────────────────────────────────

function TipologiaFormInline({ form, setForm, onSubmit, onCancel, cargando, titulo }) {
  function set(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
      <p className="mb-3 text-sm font-semibold text-accent">{titulo}</p>
      <form onSubmit={onSubmit} className="space-y-3">
        {/* Fila 1: nombre, dormitorios, moneda */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              required
              placeholder="Monoambiente, 1 Dormitorio…"
              className={inputSm}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Dormitorios
            </label>
            <input
              type="number"
              min="0"
              value={form.dormitorios}
              onChange={(e) => set("dormitorios", e.target.value)}
              placeholder="0 = mono"
              className={inputSm}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Moneda
            </label>
            <select
              value={form.moneda}
              onChange={(e) => set("moneda", e.target.value)}
              className={inputSm}
            >
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
          </div>
        </div>

        {/* Fila 2: superficie */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Sup. desde (m²)
            </label>
            <input
              type="number"
              min="0"
              value={form.superficie_desde}
              onChange={(e) => set("superficie_desde", e.target.value)}
              className={inputSm}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Sup. hasta (m²)
            </label>
            <input
              type="number"
              min="0"
              value={form.superficie_hasta}
              onChange={(e) => set("superficie_hasta", e.target.value)}
              className={inputSm}
            />
          </div>
        </div>

        {/* Fila 3: precio */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Precio desde
            </label>
            <input
              type="number"
              min="0"
              value={form.precio_desde}
              onChange={(e) => set("precio_desde", e.target.value)}
              className={inputSm}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Precio hasta
            </label>
            <input
              type="number"
              min="0"
              value={form.precio_hasta}
              onChange={(e) => set("precio_hasta", e.target.value)}
              className={inputSm}
            />
          </div>
        </div>

        {/* Fila 4: unidades */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Unidades totales
            </label>
            <input
              type="number"
              min="0"
              value={form.unidades_total}
              onChange={(e) => set("unidades_total", e.target.value)}
              className={inputSm}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Disponibles
            </label>
            <input
              type="number"
              min="0"
              value={form.unidades_disponibles}
              onChange={(e) => set("unidades_disponibles", e.target.value)}
              className={inputSm}
            />
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {cargando && (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {cargando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Editor principal ────────────────────────────────────────────────────────

export default function TipologiasEditor({
  proyectoId,
  monedaProyecto = "USD",
  tipologiasIniciales = [],
}) {
  const supabase = createClient();

  const [tipologias, setTipologias] = useState(
    [...tipologiasIniciales].sort((a, b) => a.orden - b.orden)
  );
  const [editandoId,       setEditandoId]       = useState(null);
  const [formEdit,         setFormEdit]          = useState({});
  const [agregando,        setAgregando]         = useState(false);
  const [formNueva,        setFormNueva]         = useState({ ...FORM_VACIO, moneda: monedaProyecto });
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [cargando,         setCargando]          = useState(null); // null | 'nueva' | uuid
  const [errorMsg,         setErrorMsg]          = useState(null);

  // MAX(orden) real sobre el array actual para evitar inconsistencias tras eliminaciones
  function maxOrdenActual() {
    if (tipologias.length === 0) return -1;
    return Math.max(...tipologias.map((t) => t.orden));
  }

  function manejarError(err) {
    if (err.code === "23505") {
      setErrorMsg("Ya existe una tipología con ese nombre en este proyecto.");
    } else {
      setErrorMsg(err.message);
    }
  }

  // ── Agregar ──────────────────────────────────────────────────────────────
  async function handleAgregar(e) {
    e.preventDefault();
    if (!formNueva.nombre.trim()) return;
    setCargando("nueva");
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("proyecto_tipologias")
      .insert({
        ...buildPayload(formNueva),
        proyecto_id: proyectoId,
        orden: maxOrdenActual() + 1,
      })
      .select()
      .single();

    setCargando(null);
    if (error) { manejarError(error); return; }

    setTipologias((prev) => [...prev, data]);
    setFormNueva({ ...FORM_VACIO, moneda: monedaProyecto });
    setAgregando(false);
  }

  // ── Iniciar edición ──────────────────────────────────────────────────────
  function iniciarEdicion(t) {
    setEditandoId(t.id);
    setFormEdit({
      nombre:              t.nombre || "",
      dormitorios:         t.dormitorios ?? "",
      superficie_desde:    t.superficie_desde ?? "",
      superficie_hasta:    t.superficie_hasta ?? "",
      precio_desde:        t.precio_desde ?? "",
      precio_hasta:        t.precio_hasta ?? "",
      moneda:              t.moneda || monedaProyecto,
      unidades_total:      t.unidades_total ?? "",
      unidades_disponibles: t.unidades_disponibles ?? "",
    });
    setErrorMsg(null);
    setAgregando(false);
    setConfirmarEliminar(null);
  }

  // ── Guardar edición ──────────────────────────────────────────────────────
  async function handleGuardarEdicion(e, id) {
    e.preventDefault();
    if (!formEdit.nombre?.trim()) return;
    setCargando(id);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("proyecto_tipologias")
      .update(buildPayload(formEdit))
      .eq("id", id)
      .select()
      .single();

    setCargando(null);
    if (error) { manejarError(error); return; }

    setTipologias((prev) => prev.map((t) => (t.id === id ? { ...data, orden: t.orden } : t)));
    setEditandoId(null);
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────
  async function handleEliminar(id) {
    setCargando(id);
    setErrorMsg(null);

    const { error } = await supabase
      .from("proyecto_tipologias")
      .delete()
      .eq("id", id);

    setCargando(null);
    if (error) { setErrorMsg(error.message); return; }

    setTipologias((prev) => prev.filter((t) => t.id !== id));
    setConfirmarEliminar(null);
  }

  // ── Reordenar ────────────────────────────────────────────────────────────
  // Swap por índice: normaliza el orden al array actual, no depende de orden en DB.
  async function swapPorIndice(idxA, idxB) {
    if (idxA < 0 || idxB >= tipologias.length) return;

    const newArr = [...tipologias];
    [newArr[idxA], newArr[idxB]] = [newArr[idxB], newArr[idxA]];
    // Normalizar orden = posición en array
    const normalizado = newArr.map((t, i) => ({ ...t, orden: i }));

    setCargando(normalizado[idxA].id);
    setTipologias(normalizado); // optimistic update

    await Promise.all([
      supabase.from("proyecto_tipologias").update({ orden: idxA }).eq("id", normalizado[idxA].id),
      supabase.from("proyecto_tipologias").update({ orden: idxB }).eq("id", normalizado[idxB].id),
    ]);

    setCargando(null);
  }

  function handleSubir(id) {
    const idx = tipologias.findIndex((t) => t.id === id);
    if (idx > 0) swapPorIndice(idx - 1, idx);
  }

  function handleBajar(id) {
    const idx = tipologias.findIndex((t) => t.id === id);
    if (idx < tipologias.length - 1) swapPorIndice(idx, idx + 1);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Tipologías{tipologias.length > 0 ? ` (${tipologias.length})` : ""}
        </h2>
        {!agregando && (
          <button
            onClick={() => {
              setAgregando(true);
              setEditandoId(null);
              setConfirmarEliminar(null);
              setErrorMsg(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/20"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Agregar tipología
          </button>
        )}
      </div>

      {/* Error global */}
      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Lista vacía */}
      {tipologias.length === 0 && !agregando && (
        <p className="py-6 text-center text-sm text-slate-400">
          No hay tipologías definidas. Agregá los tipos de unidades del proyecto.
        </p>
      )}

      {/* Lista de tipologías */}
      <div className="space-y-3">
        {tipologias.map((t, idx) => {
          // Estado: editando
          if (editandoId === t.id) {
            return (
              <TipologiaFormInline
                key={t.id}
                form={formEdit}
                setForm={setFormEdit}
                onSubmit={(e) => handleGuardarEdicion(e, t.id)}
                onCancel={() => { setEditandoId(null); setErrorMsg(null); }}
                cargando={cargando === t.id}
                titulo={`Editar — ${t.nombre}`}
              />
            );
          }

          // Estado: confirmando eliminación
          if (confirmarEliminar === t.id) {
            return (
              <div key={t.id} className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">
                  ¿Eliminar la tipología{" "}
                  <span className="font-semibold">&quot;{t.nombre}&quot;</span>?{" "}
                  Esta acción no se puede deshacer.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleEliminar(t.id)}
                    disabled={cargando === t.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {cargando === t.id ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                  <button
                    onClick={() => setConfirmarEliminar(null)}
                    className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          }

          // Estado: display normal
          return (
            <div key={t.id} className="flex items-stretch gap-2">
              {/* Card (flex-1 para que ocupe el espacio) */}
              <div className="min-w-0 flex-1">
                <TipologiaCard tipologia={t} />
              </div>

              {/* Controles de orden */}
              <div className="flex shrink-0 flex-col justify-center gap-0.5">
                <button
                  onClick={() => handleSubir(t.id)}
                  disabled={idx === 0 || cargando !== null}
                  title="Subir"
                  className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  onClick={() => handleBajar(t.id)}
                  disabled={idx === tipologias.length - 1 || cargando !== null}
                  title="Bajar"
                  className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {/* Controles de edición */}
              <div className="flex shrink-0 flex-col justify-center gap-0.5">
                <button
                  onClick={() => iniciarEdicion(t)}
                  title="Editar"
                  className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-accent"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setConfirmarEliminar(t.id);
                    setEditandoId(null);
                    setAgregando(false);
                  }}
                  title="Eliminar"
                  className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-red-600"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Formulario de nueva tipología */}
      {agregando && (
        <div className={tipologias.length > 0 ? "mt-4 border-t border-slate-200 pt-4" : "mt-2"}>
          <TipologiaFormInline
            form={formNueva}
            setForm={setFormNueva}
            onSubmit={handleAgregar}
            onCancel={() => {
              setAgregando(false);
              setFormNueva({ ...FORM_VACIO, moneda: monedaProyecto });
              setErrorMsg(null);
            }}
            cargando={cargando === "nueva"}
            titulo="Nueva tipología"
          />
        </div>
      )}
    </div>
  );
}
