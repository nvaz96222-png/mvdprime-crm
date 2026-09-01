"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calcularTasacion, m2Equivalentes } from "@/lib/tasacion/motor";
import {
  TASACION_TIPOS,
  TASACION_ESTADOS,
  COMPARABLE_FUENTES,
  OPERACIONES,
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
function fmtMonto(n, moneda) {
  if (n == null) return "—";
  return `${moneda || "USD"} ${Number(n).toLocaleString("es-UY")}`;
}
// pct guardado como fracción (0.5) ↔ mostrado como entero (50)
function fracToPct(f) {
  return f == null ? "" : Math.round(Number(f) * 100);
}

function SeccionHeader({ titulo, children }) {
  return (
    <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </h2>
      {children}
    </div>
  );
}

function comparableVacio(defaults = {}) {
  return {
    fuente: "manual",
    titulo: "",
    url: "",
    precio: "",
    moneda: "USD",
    superficie_interior: "",
    superficie_exterior: "",
    dormitorios: "",
    banos: "",
    barrio: "",
    ajuste_pct: "",
    incluido: true,
    ...defaults,
  };
}

export default function TasacionForm({
  opciones = {},
  initial = null,
  propiedadIdInicial = null,
}) {
  const router = useRouter();
  const supabase = createClient();

  const { agentes = [], agenteDefault = null, propiedades = [] } = opciones;

  const [form, setForm] = useState({
    propiedad_id: initial?.propiedad_id || propiedadIdInicial || "",
    titulo: initial?.titulo || "",
    tipo: initial?.tipo || TASACION_TIPOS[0].value,
    operacion: initial?.operacion || "venta",
    barrio: initial?.barrio || "",
    departamento: initial?.departamento || "",
    superficie_interior: initial?.superficie_interior ?? "",
    superficie_exterior: initial?.superficie_exterior ?? "",
    dormitorios: initial?.dormitorios ?? "",
    banos: initial?.banos ?? "",
    moneda: initial?.moneda || "USD",
    // parámetros de cálculo
    coef_exterior: initial?.coef_exterior != null ? fracToPct(initial.coef_exterior) : 50,
    cochera_valor: initial?.cochera_valor ?? "",
    ajuste_extras_pct: initial?.ajuste_extras_pct != null ? fracToPct(initial.ajuste_extras_pct) : "",
    margen_negociacion: initial?.margen_negociacion != null ? fracToPct(initial.margen_negociacion) : 8,
    estado: initial?.estado || "borrador",
    agente_id: initial?.agente_id || agenteDefault || "",
    notas: initial?.notas || "",
  });

  const [comparables, setComparables] = useState(
    initial?.comparables?.length
      ? initial.comparables.map((c) => ({
          fuente: c.fuente || "manual",
          titulo: c.titulo || "",
          url: c.url || "",
          precio: c.precio ?? "",
          moneda: c.moneda || "USD",
          // compat: comps viejos sólo tenían `superficie` (total) → va a interior
          superficie_interior: c.superficie_interior ?? c.superficie ?? "",
          superficie_exterior: c.superficie_exterior ?? "",
          dormitorios: c.dormitorios ?? "",
          banos: c.banos ?? "",
          barrio: c.barrio || "",
          ajuste_pct: c.ajuste_pct ? Math.round(c.ajuste_pct * 100) : "",
          incluido: c.incluido !== false,
        }))
      : [comparableVacio()]
  );

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);
  const exitoTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(exitoTimerRef.current), []);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Superficie total del inmueble (interior + exterior), para mostrar.
  const supTotal =
    (toNum(form.superficie_interior) || 0) + (toNum(form.superficie_exterior) || 0);

  // Prefill del inmueble desde una propiedad del inventario.
  function elegirPropiedad(id) {
    set("propiedad_id", id);
    const p = propiedades.find((x) => x.id === id);
    if (!p) return;
    const cubierta = p.superficie_cubierta ?? null;
    const total = p.superficie_total ?? null;
    const exterior =
      cubierta != null && total != null && total > cubierta ? total - cubierta : "";
    setForm((prev) => ({
      ...prev,
      propiedad_id: id,
      titulo: p.titulo || prev.titulo,
      tipo: p.tipo || prev.tipo,
      operacion: p.operacion || prev.operacion,
      barrio: p.barrio || prev.barrio,
      departamento: p.departamento || prev.departamento,
      superficie_interior: cubierta ?? total ?? prev.superficie_interior,
      superficie_exterior: exterior,
      dormitorios: p.dormitorios ?? prev.dormitorios,
      banos: p.banos ?? prev.banos,
      moneda: p.moneda || prev.moneda,
    }));
  }

  function sembrarInventario() {
    const mismos = propiedades.filter(
      (p) =>
        p.id !== form.propiedad_id &&
        p.tipo === form.tipo &&
        p.precio &&
        (p.superficie_cubierta || p.superficie_total)
    );
    if (mismos.length === 0) return;
    const nuevos = mismos.slice(0, 6).map((p) => {
      const cubierta = p.superficie_cubierta ?? null;
      const total = p.superficie_total ?? null;
      const exterior =
        cubierta != null && total != null && total > cubierta ? total - cubierta : "";
      return comparableVacio({
        fuente: "inventario_propio",
        titulo: p.titulo || "",
        precio: p.precio,
        moneda: p.moneda || "USD",
        superficie_interior: cubierta ?? total ?? "",
        superficie_exterior: exterior,
        dormitorios: p.dormitorios ?? "",
        banos: p.banos ?? "",
        barrio: p.barrio || "",
      });
    });
    setComparables((prev) => {
      const base = prev.filter(
        (c) => c.precio !== "" || c.titulo !== "" || c.url !== ""
      );
      return [...base, ...nuevos];
    });
  }

  function setComp(i, key, value) {
    setComparables((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [key]: value } : c))
    );
  }
  function addComp() {
    setComparables((prev) => [...prev, comparableVacio()]);
  }
  function removeComp(i) {
    setComparables((prev) => prev.filter((_, idx) => idx !== i));
  }

  const coefFrac = (toNum(form.coef_exterior) ?? 50) / 100;

  // Cálculo en vivo con el motor.
  const resultado = useMemo(() => {
    const comps = comparables.map((c) => ({
      precio: toNum(c.precio),
      superficie_interior: toNum(c.superficie_interior),
      superficie_exterior: toNum(c.superficie_exterior),
      moneda: c.moneda,
      ajuste_pct: c.ajuste_pct === "" ? 0 : (toNum(c.ajuste_pct) || 0) / 100,
      incluido: c.incluido,
    }));
    return calcularTasacion({
      superficie_interior: toNum(form.superficie_interior),
      superficie_exterior: toNum(form.superficie_exterior),
      coefExterior: coefFrac,
      cocheraValor: toNum(form.cochera_valor) || 0,
      ajusteExtrasPct: form.ajuste_extras_pct === "" ? 0 : (toNum(form.ajuste_extras_pct) || 0) / 100,
      comparables: comps,
      margenNegociacion: (toNum(form.margen_negociacion) || 0) / 100,
      moneda: form.moneda,
    });
  }, [
    comparables,
    form.superficie_interior,
    form.superficie_exterior,
    form.coef_exterior,
    form.cochera_valor,
    form.ajuste_extras_pct,
    form.margen_negociacion,
    form.moneda,
    coefFrac,
  ]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setExito(false);

    if (!form.titulo.trim()) {
      setError("Poné un título o nombre de referencia para la tasación.");
      return;
    }

    setGuardando(true);
    try {
      const margen = (toNum(form.margen_negociacion) || 0) / 100;
      const supInt = toNum(form.superficie_interior);
      const supExt = toNum(form.superficie_exterior);
      const payload = {
        propiedad_id: form.propiedad_id || null,
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        operacion: form.operacion,
        barrio: form.barrio || null,
        departamento: form.departamento || null,
        superficie: (supInt || 0) + (supExt || 0) || null, // total
        superficie_interior: supInt,
        superficie_exterior: supExt,
        coef_exterior: coefFrac,
        cochera_valor: toNum(form.cochera_valor),
        ajuste_extras_pct: form.ajuste_extras_pct === "" ? 0 : (toNum(form.ajuste_extras_pct) || 0) / 100,
        dormitorios: toNum(form.dormitorios),
        banos: toNum(form.banos),
        metodo: "comparativo",
        estado: form.estado,
        moneda: form.moneda,
        valor_min: resultado.valor_min,
        valor_probable: resultado.valor_probable,
        valor_max: resultado.valor_max,
        precio_m2_referencia: resultado.precio_m2_referencia,
        margen_negociacion: margen,
        notas: form.notas || null,
        agente_id: form.agente_id || null,
        updated_at: new Date().toISOString(),
      };

      const filasComp = comparables
        .map((c, i) => {
          const precio = toNum(c.precio);
          if (precio == null) return null;
          const int = toNum(c.superficie_interior);
          const ext = toNum(c.superficie_exterior);
          const eq = m2Equivalentes(
            { superficie_interior: int, superficie_exterior: ext },
            coefFrac
          );
          const precio_m2 = precio && eq ? Math.round(precio / eq) : null;
          return {
            fuente: c.fuente,
            url: c.url || null,
            titulo: c.titulo || null,
            precio,
            moneda: c.moneda,
            superficie: (int || 0) + (ext || 0) || null,
            superficie_interior: int,
            superficie_exterior: ext,
            dormitorios: toNum(c.dormitorios),
            banos: toNum(c.banos),
            barrio: c.barrio || null,
            precio_m2,
            ajuste_pct: c.ajuste_pct === "" ? 0 : (toNum(c.ajuste_pct) || 0) / 100,
            incluido: c.incluido !== false,
            es_outlier: !!resultado.comparables[i]?.es_outlier,
          };
        })
        .filter(Boolean);

      let tasacionId = initial?.id;

      if (initial?.id) {
        const { error: errU } = await supabase
          .from("tasaciones")
          .update(payload)
          .eq("id", initial.id);
        if (errU) {
          setError(errU.message);
          return;
        }
        await supabase
          .from("tasacion_comparables")
          .delete()
          .eq("tasacion_id", initial.id);
      } else {
        const { data: nueva, error: errI } = await supabase
          .from("tasaciones")
          .insert(payload)
          .select("id")
          .single();
        if (errI) {
          setError(errI.message);
          return;
        }
        tasacionId = nueva.id;
      }

      if (filasComp.length > 0) {
        const { error: errC } = await supabase
          .from("tasacion_comparables")
          .insert(filasComp.map((f) => ({ ...f, tasacion_id: tasacionId })));
        if (errC) {
          setError(errC.message);
          return;
        }
      }

      setExito(true);
      router.refresh();
      exitoTimerRef.current = setTimeout(() => {
        router.push(`/tasaciones/${tasacionId}`);
      }, 1200);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Inmueble a tasar */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Inmueble a tasar" />

        {propiedades.length > 0 && (
          <div className="mb-4">
            <label className={labelClass}>Desde una propiedad del inventario</label>
            <select
              value={form.propiedad_id}
              onChange={(e) => elegirPropiedad(e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">Cargar datos manualmente…</option>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id}>{p.titulo}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Opcional: prellena los datos. Podés tasar un inmueble de captación
              sin elegir ninguno.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Título / referencia *</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="Ej: Apto Pocitos 2 dorm — captación González"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Tipo</label>
            <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} className={`mt-1 ${inputClass}`}>
              {TASACION_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Operación</label>
            <select value={form.operacion} onChange={(e) => set("operacion", e.target.value)} className={`mt-1 ${inputClass}`}>
              {OPERACIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Barrio</label>
            <input type="text" value={form.barrio} onChange={(e) => set("barrio", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Pocitos" />
          </div>
          <div>
            <label className={labelClass}>Departamento</label>
            <select value={form.departamento} onChange={(e) => set("departamento", e.target.value)} className={`mt-1 ${inputClass}`}>
              <option value="">Seleccionar…</option>
              {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Superficies interior / exterior / total */}
          <div>
            <label className={labelClass}>Superficie interior (m²)</label>
            <input
              type="number" min="0"
              value={form.superficie_interior}
              onChange={(e) => set("superficie_interior", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="Cubierta / interior"
            />
          </div>
          <div>
            <label className={labelClass}>Superficie exterior (m²)</label>
            <input
              type="number" min="0"
              value={form.superficie_exterior}
              onChange={(e) => set("superficie_exterior", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="Terraza / balcón"
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
            <span>Superficie total: <strong className="text-slate-700">{supTotal || 0} m²</strong></span>
            <span>
              m² equivalentes (para el cálculo):{" "}
              <strong className="text-slate-700">{resultado.superficie_equivalente ?? "—"} m²</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Dormitorios</label>
              <input type="number" min="0" value={form.dormitorios} onChange={(e) => set("dormitorios", e.target.value)} className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>Baños</label>
              <input type="number" min="0" value={form.banos} onChange={(e) => set("banos", e.target.value)} className={`mt-1 ${inputClass}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Ajustes de valor */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Ajustes de valor" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Coef. m² exterior (%)</label>
            <input
              type="number" min="0" max="100"
              value={form.coef_exterior}
              onChange={(e) => set("coef_exterior", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
            <p className="mt-1 text-xs text-slate-400">Cuánto vale el m² de terraza vs. interior. Típico 50%.</p>
          </div>
          <div>
            <label className={labelClass}>Cochera (valor {form.moneda})</label>
            <input
              type="number" min="0"
              value={form.cochera_valor}
              onChange={(e) => set("cochera_valor", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="0 = sin cochera"
            />
            <p className="mt-1 text-xs text-slate-400">Monto fijo que se suma al valor.</p>
          </div>
          <div>
            <label className={labelClass}>Ajuste amenities/estado (%)</label>
            <input
              type="number"
              value={form.ajuste_extras_pct}
              onChange={(e) => set("ajuste_extras_pct", e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="Ej: +8"
            />
            <p className="mt-1 text-xs text-slate-400">Premium/descuento por piscina, gimnasio, estado, piso, vista.</p>
          </div>
        </div>
      </div>

      {/* Comparables */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Comparables">
          {propiedades.length > 0 && (
            <button type="button" onClick={sembrarInventario} className="text-xs font-medium text-accent hover:underline">
              + Agregar del inventario (mismo tipo)
            </button>
          )}
        </SeccionHeader>

        <div className="space-y-3">
          {comparables.map((c, i) => {
            const esOut = resultado.comparables[i]?.es_outlier;
            const eq = m2Equivalentes(
              { superficie_interior: toNum(c.superficie_interior), superficie_exterior: toNum(c.superficie_exterior) },
              coefFrac
            );
            const precioM2 = toNum(c.precio) && eq ? Math.round(toNum(c.precio) / eq) : null;
            return (
              <div key={i} className={`rounded-lg border p-3 ${esOut ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                  <select value={c.fuente} onChange={(e) => setComp(i, "fuente", e.target.value)} className={`${inputClass} sm:col-span-3`}>
                    {COMPARABLE_FUENTES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <input type="number" min="0" value={c.precio} onChange={(e) => setComp(i, "precio", e.target.value)} className={`${inputClass} sm:col-span-3`} placeholder="Precio" />
                  <input type="number" min="0" value={c.superficie_interior} onChange={(e) => setComp(i, "superficie_interior", e.target.value)} className={`${inputClass} sm:col-span-2`} placeholder="m² int" title="Superficie interior/cubierta" />
                  <input type="number" min="0" value={c.superficie_exterior} onChange={(e) => setComp(i, "superficie_exterior", e.target.value)} className={`${inputClass} sm:col-span-2`} placeholder="m² ext" title="Superficie exterior/terraza" />
                  <div className="flex items-center justify-end gap-2 sm:col-span-2">
                    <span className="text-xs font-medium text-slate-500">{precioM2 ? `${precioM2}/m²` : "—"}</span>
                    <button type="button" onClick={() => removeComp(i)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Quitar comparable">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-12">
                  <input type="text" value={c.titulo} onChange={(e) => setComp(i, "titulo", e.target.value)} className={`${inputClass} sm:col-span-4`} placeholder="Referencia (opcional)" />
                  <input type="text" value={c.url} onChange={(e) => setComp(i, "url", e.target.value)} className={`${inputClass} sm:col-span-4`} placeholder="URL (opcional)" />
                  <input type="number" value={c.ajuste_pct} onChange={(e) => setComp(i, "ajuste_pct", e.target.value)} className={`${inputClass} sm:col-span-2`} placeholder="Ajuste %" title="Ajuste de este comparable respecto al inmueble tasado (−% si el comparable es mejor)" />
                  <label className="flex items-center justify-end gap-2 text-xs text-slate-600 sm:col-span-2">
                    <input type="checkbox" checked={c.incluido} onChange={(e) => setComp(i, "incluido", e.target.checked)} className="accent-accent" />
                    Incluir
                  </label>
                </div>
                {esOut && <p className="mt-1 text-xs font-medium text-red-500">Marcado como outlier por el motor (fuera del rango; no cuenta).</p>}
              </div>
            );
          })}
        </div>

        <button type="button" onClick={addComp} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-accent hover:text-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Agregar comparable
        </button>
      </div>

      {/* Resultado en vivo */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">Valor estimado (en vivo)</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Margen negociación</label>
            <input type="number" min="0" max="50" value={form.margen_negociacion} onChange={(e) => set("margen_negociacion", e.target.value)} className="w-16 rounded border border-slate-300 px-2 py-1 text-sm" />
            <span className="text-xs text-slate-500">%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Mínimo</p>
            <p className="mt-1 text-base font-semibold text-slate-700">{fmtMonto(resultado.valor_min, form.moneda)}</p>
          </div>
          <div className="rounded-lg bg-white py-1 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-accent">Probable</p>
            <p className="mt-1 text-2xl font-bold text-accent">{fmtMonto(resultado.valor_probable, form.moneda)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Máximo</p>
            <p className="mt-1 text-base font-semibold text-slate-700">{fmtMonto(resultado.valor_max, form.moneda)}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>
            Precio/m² referencia:{" "}
            <strong className="text-slate-700">
              {resultado.precio_m2_referencia ? `${form.moneda} ${resultado.precio_m2_referencia.toLocaleString("es-UY")}` : "—"}
            </strong>
          </span>
          <span>m² equivalentes: {resultado.superficie_equivalente ?? "—"}</span>
          {resultado.valor_cochera > 0 && <span>Cochera: +{fmtMonto(resultado.valor_cochera, form.moneda)}</span>}
          <span>Comparables usados: {resultado.stats?.n_usados ?? 0}</span>
        </div>

        {resultado.advertencias?.length > 0 && (
          <ul className="mt-3 space-y-1">
            {resultado.advertencias.map((a, i) => <li key={i} className="text-xs text-amber-700">⚠ {a}</li>)}
          </ul>
        )}
      </div>

      {/* Estado, agente, notas */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <SeccionHeader titulo="Detalles" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Moneda</label>
            <select value={form.moneda} onChange={(e) => set("moneda", e.target.value)} className={`mt-1 ${inputClass}`}>
              {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <select value={form.estado} onChange={(e) => set("estado", e.target.value)} className={`mt-1 ${inputClass}`}>
              {TASACION_ESTADOS.map((e2) => <option key={e2.value} value={e2.value}>{e2.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Agente</label>
            <select value={form.agente_id} onChange={(e) => set("agente_id", e.target.value)} className={`mt-1 ${inputClass}`}>
              <option value="">Sin asignar</option>
              {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Notas</label>
          <textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={3} className={`mt-1 ${inputClass} resize-y`} placeholder="Observaciones, ajustes considerados, contexto para el dueño…" />
        </div>
      </div>

      {exito && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">✓ Tasación guardada. Abriendo el informe…</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => router.push("/tasaciones")} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancelar</button>
        <button type="submit" disabled={guardando} className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60">
          {guardando && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {guardando ? "Guardando…" : "Guardar tasación"}
        </button>
      </div>
    </form>
  );
}
