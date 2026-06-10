"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  TIPOS,
  OPERACIONES,
  MONEDAS,
  ESTADOS,
  DEPARTAMENTOS,
  BUCKET_FOTOS,
} from "@/lib/constants";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

const booleanos = [
  ["acepta_mascotas", "Acepta mascotas"],
  ["amueblado", "Amueblado"],
  ["parking", "Parking"],
  ["parrillero", "Parrillero"],
  ["piscina", "Piscina"],
  ["publicar_web", "Publicar en web (mvdprime.uy)"],
  ["publicar_ml", "Publicar en MercadoLibre"],
  ["publicar_infocasas", "Publicar en InfoCasas"],
];

function toNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export default function PropiedadForm({
  propiedad = null,
  propietarios = [],
  agentes = [],
  fotosExistentes = [],
  agenteDefault = null,
}) {
  const router = useRouter();
  const supabase = createClient();
  const esEdicion = Boolean(propiedad);

  const [form, setForm] = useState({
    titulo: propiedad?.titulo || "",
    tipo: propiedad?.tipo || TIPOS[0].value,
    operacion: propiedad?.operacion || OPERACIONES[0].value,
    estado: propiedad?.estado || "disponible",
    precio: propiedad?.precio ?? "",
    moneda: propiedad?.moneda || "USD",
    descripcion: propiedad?.descripcion || "",
    propietario_id: propiedad?.propietario_id || "",
    agente_id: propiedad?.agente_id || agenteDefault || "",
    direccion: propiedad?.direccion || "",
    barrio: propiedad?.barrio || "",
    departamento: propiedad?.departamento || "",
    dormitorios: propiedad?.dormitorios ?? "",
    banos: propiedad?.banos ?? "",
    superficie_total: propiedad?.superficie_total ?? "",
    superficie_cubierta: propiedad?.superficie_cubierta ?? "",
    ano_construccion: propiedad?.ano_construccion ?? "",
    acepta_mascotas: propiedad?.acepta_mascotas || false,
    amueblado: propiedad?.amueblado || false,
    parking: propiedad?.parking || false,
    parrillero: propiedad?.parrillero || false,
    piscina: propiedad?.piscina || false,
    publicar_web: propiedad?.publicar_web || false,
    publicar_ml: propiedad?.publicar_ml || false,
    publicar_infocasas: propiedad?.publicar_infocasas || false,
  });

  // Fotos existentes (con marca de borrado) + nuevas a subir.
  const [existentes, setExistentes] = useState(
    fotosExistentes.map((f) => ({ ...f, _delete: false }))
  );
  const [nuevas, setNuevas] = useState([]); // {file, preview, key}
  const principalInicial =
    fotosExistentes.find((f) => f.es_principal)?.id || null;
  const [principalKey, setPrincipalKey] = useState(
    principalInicial ? `exist:${principalInicial}` : null
  );

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function agregarArchivos(e) {
    const files = Array.from(e.target.files || []);
    const items = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }));
    setNuevas((prev) => {
      const todas = [...prev, ...items];
      // Si no hay principal aún, la primera nueva pasa a principal.
      if (!principalKey && existentes.every((x) => x._delete) && todas.length) {
        setPrincipalKey(`new:${todas[0].key}`);
      }
      return todas;
    });
    e.target.value = "";
  }

  function quitarNueva(key) {
    setNuevas((prev) => prev.filter((n) => n.key !== key));
    if (principalKey === `new:${key}`) setPrincipalKey(null);
  }

  function toggleEliminarExistente(id) {
    setExistentes((prev) =>
      prev.map((f) => (f.id === id ? { ...f, _delete: !f._delete } : f))
    );
    if (principalKey === `exist:${id}`) setPrincipalKey(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    if (toNum(form.precio) === null) {
      setError("El precio es obligatorio.");
      return;
    }
    setGuardando(true);

    try {
      const payload = {
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        operacion: form.operacion,
        estado: form.estado,
        precio: toNum(form.precio),
        moneda: form.moneda,
        descripcion: form.descripcion.trim() || null,
        propietario_id: form.propietario_id || null,
        agente_id: form.agente_id || null,
        direccion: form.direccion.trim() || null,
        barrio: form.barrio.trim() || null,
        departamento: form.departamento || null,
        dormitorios: toNum(form.dormitorios),
        banos: toNum(form.banos),
        superficie_total: toNum(form.superficie_total),
        superficie_cubierta: toNum(form.superficie_cubierta),
        ano_construccion: toNum(form.ano_construccion),
        acepta_mascotas: form.acepta_mascotas,
        amueblado: form.amueblado,
        parking: form.parking,
        parrillero: form.parrillero,
        piscina: form.piscina,
        publicar_web: form.publicar_web,
        publicar_ml: form.publicar_ml,
        publicar_infocasas: form.publicar_infocasas,
      };

      // 1) Crear o actualizar la propiedad.
      let propId = propiedad?.id;
      if (esEdicion) {
        const { error } = await supabase
          .from("propiedades")
          .update(payload)
          .eq("id", propId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("propiedades")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        propId = data.id;
      }

      // 2) Borrar fotos marcadas.
      const aBorrar = existentes.filter((f) => f._delete);
      if (aBorrar.length) {
        await supabase.storage
          .from(BUCKET_FOTOS)
          .remove(aBorrar.map((f) => f.storage_path).filter(Boolean));
        await supabase
          .from("fotos")
          .delete()
          .in(
            "id",
            aBorrar.map((f) => f.id)
          );
      }

      // 3) Subir fotos nuevas a Storage e insertar filas.
      const baseOrden = existentes.filter((f) => !f._delete).length;
      const insertadas = [];
      for (let i = 0; i < nuevas.length; i++) {
        const { file, key } = nuevas[i];
        const ext = file.name.split(".").pop();
        const path = `${propId}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET_FOTOS)
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path);
        const { data, error: insErr } = await supabase
          .from("fotos")
          .insert({
            propiedad_id: propId,
            url: publicUrl,
            storage_path: path,
            orden: baseOrden + i,
            es_principal: false,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        insertadas.push({ key, id: data.id });
      }

      // 4) Definir la foto principal.
      let principalId = null;
      if (principalKey?.startsWith("exist:")) {
        const id = principalKey.slice(6);
        if (existentes.find((f) => f.id === id && !f._delete)) principalId = id;
      } else if (principalKey?.startsWith("new:")) {
        const k = principalKey.slice(4);
        principalId = insertadas.find((n) => n.key === k)?.id || null;
      }
      // Fallback: primera disponible.
      if (!principalId) {
        const primeraExist = existentes.find((f) => !f._delete);
        principalId = primeraExist?.id || insertadas[0]?.id || null;
      }
      if (principalId) {
        await supabase
          .from("fotos")
          .update({ es_principal: false })
          .eq("propiedad_id", propId);
        await supabase
          .from("fotos")
          .update({ es_principal: true })
          .eq("id", principalId);
      }

      router.push("/propiedades");
      router.refresh();
    } catch (err) {
      setError(err?.message || "Ocurrió un error al guardar.");
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos principales */}
      <Seccion titulo="Datos principales">
        <Campo label="Título *" className="sm:col-span-2">
          <input
            className={inputClass}
            value={form.titulo}
            onChange={(e) => set("titulo", e.target.value)}
            placeholder="Ej: Apartamento 2 dormitorios en Pocitos"
          />
        </Campo>
        <Campo label="Tipo">
          <select className={inputClass} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Operación">
          <select className={inputClass} value={form.operacion} onChange={(e) => set("operacion", e.target.value)}>
            {OPERACIONES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Estado">
          <select className={inputClass} value={form.estado} onChange={(e) => set("estado", e.target.value)}>
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Precio *">
          <div className="flex gap-2">
            <select
              className={`${inputClass} w-24`}
              value={form.moneda}
              onChange={(e) => set("moneda", e.target.value)}
            >
              {MONEDAS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              className={inputClass}
              value={form.precio}
              onChange={(e) => set("precio", e.target.value)}
              placeholder="0"
            />
          </div>
        </Campo>
        <Campo label="Descripción" className="sm:col-span-2">
          <textarea
            className={inputClass}
            rows={3}
            value={form.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
          />
        </Campo>
        <Campo label="Propietario">
          <select className={inputClass} value={form.propietario_id} onChange={(e) => set("propietario_id", e.target.value)}>
            <option value="">— Sin asignar —</option>
            {propietarios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Agente">
          <select className={inputClass} value={form.agente_id} onChange={(e) => set("agente_id", e.target.value)}>
            <option value="">— Sin asignar —</option>
            {agentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </Seccion>

      {/* Ubicación */}
      <Seccion titulo="Ubicación">
        <Campo label="Dirección" className="sm:col-span-2">
          <input className={inputClass} value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
        </Campo>
        <Campo label="Barrio">
          <input className={inputClass} value={form.barrio} onChange={(e) => set("barrio", e.target.value)} />
        </Campo>
        <Campo label="Departamento">
          <select className={inputClass} value={form.departamento} onChange={(e) => set("departamento", e.target.value)}>
            <option value="">— Seleccionar —</option>
            {DEPARTAMENTOS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Campo>
      </Seccion>

      {/* Características */}
      <Seccion titulo="Características">
        <Campo label="Dormitorios">
          <input type="number" className={inputClass} value={form.dormitorios} onChange={(e) => set("dormitorios", e.target.value)} />
        </Campo>
        <Campo label="Baños">
          <input type="number" className={inputClass} value={form.banos} onChange={(e) => set("banos", e.target.value)} />
        </Campo>
        <Campo label="Sup. total (m²)">
          <input type="number" className={inputClass} value={form.superficie_total} onChange={(e) => set("superficie_total", e.target.value)} />
        </Campo>
        <Campo label="Sup. cubierta (m²)">
          <input type="number" className={inputClass} value={form.superficie_cubierta} onChange={(e) => set("superficie_cubierta", e.target.value)} />
        </Campo>
        <Campo label="Año construcción">
          <input type="number" className={inputClass} value={form.ano_construccion} onChange={(e) => set("ano_construccion", e.target.value)} />
        </Campo>
      </Seccion>

      {/* Comodidades + Publicación */}
      <Seccion titulo="Comodidades y publicación">
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-3">
          {booleanos.map(([campo, label]) => (
            <label key={campo} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form[campo]}
                onChange={(e) => set(campo, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
              />
              {label}
            </label>
          ))}
        </div>
      </Seccion>

      {/* Fotos */}
      <Seccion titulo="Fotos">
        <div className="sm:col-span-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 hover:border-accent hover:text-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Agregar fotos
            <input type="file" accept="image/*" multiple onChange={agregarArchivos} className="hidden" />
          </label>
          <p className="mt-1 text-xs text-slate-400">
            Seleccioná la estrella para marcar la foto principal.
          </p>

          {(existentes.some((f) => !f._delete) || nuevas.length > 0) && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {existentes
                .filter((f) => !f._delete)
                .map((f) => (
                  <Miniatura
                    key={`e-${f.id}`}
                    url={f.url}
                    principal={principalKey === `exist:${f.id}`}
                    onPrincipal={() => setPrincipalKey(`exist:${f.id}`)}
                    onEliminar={() => toggleEliminarExistente(f.id)}
                  />
                ))}
              {nuevas.map((n) => (
                <Miniatura
                  key={`n-${n.key}`}
                  url={n.preview}
                  nueva
                  principal={principalKey === `new:${n.key}`}
                  onPrincipal={() => setPrincipalKey(`new:${n.key}`)}
                  onEliminar={() => quitarNueva(n.key)}
                />
              ))}
            </div>
          )}
        </div>
      </Seccion>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
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
          {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear propiedad"}
        </button>
      </div>
    </form>
  );
}

/* --- Subcomponentes --- */
function Seccion({ titulo, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Campo({ label, className = "", children }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function Miniatura({ url, principal, nueva, onPrincipal, onEliminar }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      {nueva && (
        <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
          nueva
        </span>
      )}
      <button
        type="button"
        onClick={onPrincipal}
        title="Marcar como principal"
        className={`absolute right-1 top-1 rounded-full p-1 ${
          principal ? "bg-amber-400 text-white" : "bg-white/80 text-slate-400 hover:text-amber-500"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={principal ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onEliminar}
        title="Eliminar"
        className="absolute bottom-1 right-1 rounded-full bg-white/80 p-1 text-slate-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}
