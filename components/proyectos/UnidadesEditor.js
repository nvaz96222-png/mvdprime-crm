"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Mismos colores que el selector público, para que lo que se ve acá y lo que
// ve el cliente en la web sean reconociblemente lo mismo.
const ESTADOS = {
  disponible: { label: "Disponible", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  reservado:  { label: "Reservado",  chip: "bg-amber-50 text-amber-700 ring-amber-200" },
  vendido:    { label: "Vendido",    chip: "bg-red-50 text-red-700 ring-red-200" },
  consultar:  { label: "Consultar",  chip: "bg-slate-100 text-slate-600 ring-slate-200" },
};

const nf = new Intl.NumberFormat("es-UY");

const inputSm =
  "w-full rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

function areaTexto(m2) {
  return m2 != null ? `${nf.format(m2)} m²` : "—";
}

function fechaCorta(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

// ─── Fila ────────────────────────────────────────────────────────────────────

function Fila({ u, guardando, onGuardar, onVerHistorial, historial }) {
  // El precio se edita con un borrador local: recién se guarda al salir del
  // campo o con Enter, para no mandar un UPDATE por cada tecla.
  const [borrador, setBorrador] = useState(u.precio ?? "");
  const sucio = String(borrador) !== String(u.precio ?? "");

  function confirmarPrecio() {
    if (!sucio) return;
    const valor = borrador === "" ? null : Number(borrador);
    if (valor !== null && Number.isNaN(valor)) {
      setBorrador(u.precio ?? "");
      return;
    }
    onGuardar(u, { precio: valor });
  }

  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50/60">
        <td className="px-3 py-2">
          <span className="font-medium text-navy">{u.etiqueta}</span>
          {u.observaciones?.length > 0 && (
            <span
              title={u.observaciones.join(" · ")}
              className="ml-1.5 cursor-help text-amber-500"
            >
              ⚠
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-slate-500">{u.nivel || "—"}</td>
        <td className="px-3 py-2 text-slate-500">{u.tipologia || "—"}</td>
        <td className="px-3 py-2 tabular-nums text-slate-500">{areaTexto(u.sup_total)}</td>

        {/* Precio */}
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">{u.moneda}</span>
            <input
              type="number"
              min="0"
              step="1"
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              onBlur={confirmarPrecio}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setBorrador(u.precio ?? "");
              }}
              placeholder="Sin precio"
              className={`${inputSm} w-28 tabular-nums ${sucio ? "border-accent bg-accent/5" : ""}`}
            />
          </div>
        </td>

        {/* Estado */}
        <td className="px-3 py-2">
          <select
            value={u.estado}
            onChange={(e) => onGuardar(u, { estado: e.target.value })}
            className={`${inputSm} w-32`}
          >
            {Object.entries(ESTADOS).map(([valor, e]) => (
              <option key={valor} value={valor}>
                {e.label}
              </option>
            ))}
          </select>
        </td>

        {/* Última edición */}
        <td className="px-3 py-2 text-right text-xs text-slate-400">
          {guardando ? (
            <span className="text-accent">Guardando…</span>
          ) : (
            <button
              onClick={() => onVerHistorial(u.id)}
              className="hover:text-accent hover:underline"
              title="Ver cambios de precio y estado"
            >
              {u.editado_en ? fechaCorta(u.editado_en) : "historial"}
            </button>
          )}
        </td>
      </tr>

      {/* Historial desplegado */}
      {historial && (
        <tr className="border-t border-slate-100 bg-slate-50">
          <td colSpan={7} className="px-3 py-2">
            {historial.length === 0 ? (
              <p className="text-xs text-slate-400">
                Sin cambios desde la carga inicial. Precio y estado son los del documento
                de origen.
              </p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-600">
                {historial.map((h) => (
                  <li key={h.id}>
                    <span className="text-slate-400">{fechaCorta(h.created_at)}</span>{" "}
                    {h.campo}: <span className="line-through">{h.valor_anterior ?? "—"}</span>{" "}
                    → <span className="font-medium">{h.valor_nuevo ?? "—"}</span>
                    {h.usuario?.nombre ? ` · ${h.usuario.nombre}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────────

export default function UnidadesEditor({ unidadesIniciales = [] }) {
  const supabase = createClient();

  const [unidades, setUnidades] = useState(unidadesIniciales);
  const [tipo, setTipo] = useState("apartamento");
  const [piso, setPiso] = useState("todos");
  const [estado, setEstado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [historiales, setHistoriales] = useState({});

  // Por piso y después por número. El orden del código como texto pondría el
  // garaje 10 antes que el 2; con los apartamentos de tres cifras no se nota,
  // con los garajes sí.
  const delTipo = useMemo(
    () =>
      unidades
        .filter((u) => u.tipo === tipo)
        .sort(
          (a, b) =>
            (a.piso ?? 0) - (b.piso ?? 0) ||
            (Number(a.codigo) || 0) - (Number(b.codigo) || 0) ||
            a.codigo.localeCompare(b.codigo)
        ),
    [unidades, tipo]
  );

  const pisos = useMemo(
    () =>
      [...new Set(delTipo.map((u) => u.piso).filter((p) => p != null))].sort(
        (a, b) => a - b
      ),
    [delTipo]
  );

  const filtradas = useMemo(
    () =>
      delTipo.filter((u) => {
        if (piso !== "todos" && u.piso !== Number(piso)) return false;
        if (estado !== "todos" && u.estado !== estado) return false;
        if (busqueda && !u.etiqueta.toLowerCase().includes(busqueda.toLowerCase()))
          return false;
        return true;
      }),
    [delTipo, piso, estado, busqueda]
  );

  const conteo = useMemo(
    () =>
      delTipo.reduce((acc, u) => ({ ...acc, [u.estado]: (acc[u.estado] || 0) + 1 }), {}),
    [delTipo]
  );

  const hayGarajes = unidades.some((u) => u.tipo === "garaje");

  // ── Guardar ───────────────────────────────────────────────────────────────
  async function guardar(u, cambios) {
    setGuardando(u.id);
    setErrorMsg(null);

    // Optimista: la fila se actualiza ya, y se revierte si el UPDATE falla.
    const previo = u;
    setUnidades((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, ...cambios } : x))
    );

    const { data, error } = await supabase
      .from("proyecto_unidades")
      .update(cambios)
      .eq("id", u.id)
      .select("id, precio, estado, editado_en")
      .single();

    setGuardando(null);

    if (error) {
      setUnidades((prev) => prev.map((x) => (x.id === u.id ? previo : x)));
      setErrorMsg(`No se pudo guardar ${u.etiqueta}: ${error.message}`);
      return;
    }

    setUnidades((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...data } : x)));
    // El historial en pantalla quedó viejo: que se vuelva a pedir.
    setHistoriales((prev) => {
      const { [u.id]: _, ...resto } = prev;
      return resto;
    });
  }

  // ── Historial bajo demanda ────────────────────────────────────────────────
  async function verHistorial(id) {
    if (historiales[id]) {
      setHistoriales((prev) => {
        const { [id]: _, ...resto } = prev;
        return resto;
      });
      return;
    }
    const { data } = await supabase
      .from("proyecto_unidad_historial")
      .select("id, campo, valor_anterior, valor_nuevo, created_at, usuario:usuarios(nombre)")
      .eq("unidad_id", id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistoriales((prev) => ({ ...prev, [id]: data || [] }));
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Unidades ({delTipo.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ESTADOS).map(([valor, e]) =>
              conteo[valor] ? (
                <span
                  key={valor}
                  className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ${e.chip}`}
                >
                  {e.label} {conteo[valor]}
                </span>
              ) : null
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Lo que cambies acá sale publicado en la web del desarrollo. La página se
          refresca sola a los pocos minutos: no hace falta volver a publicar nada.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {hayGarajes && (
          <div className="flex rounded-lg border border-slate-300 p-0.5">
            {[
              ["apartamento", "Apartamentos"],
              ["garaje", "Garajes"],
            ].map(([valor, label]) => (
              <button
                key={valor}
                onClick={() => {
                  setTipo(valor);
                  setPiso("todos");
                }}
                className={`rounded px-3 py-1 text-sm font-medium ${
                  tipo === valor ? "bg-navy text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {pisos.length > 0 && (
          <select
            value={piso}
            onChange={(e) => setPiso(e.target.value)}
            className={`${inputSm} w-auto`}
          >
            <option value="todos">Todos los pisos</option>
            {pisos.map((p) => (
              <option key={p} value={p}>
                Piso {p}
              </option>
            ))}
          </select>
        )}

        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className={`${inputSm} w-auto`}
        >
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([valor, e]) => (
            <option key={valor} value={valor}>
              {e.label}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar unidad…"
          className={`${inputSm} w-40`}
        />

        {(piso !== "todos" || estado !== "todos" || busqueda) && (
          <button
            onClick={() => {
              setPiso("todos");
              setEstado("todos");
              setBusqueda("");
            }}
            className="text-sm text-slate-400 hover:text-accent"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      {unidades.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-slate-400">
            Este proyecto todavía no tiene unidades cargadas.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Se cargan desde la lista de precios del desarrollador con{" "}
            <code className="rounded bg-slate-100 px-1">npm run city-homes-unidades</code>.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2 font-medium">Unidad</th>
                <th className="px-3 py-2 font-medium">Nivel</th>
                <th className="px-3 py-2 font-medium">Tipología</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Precio</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Editado</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((u) => (
                <Fila
                  key={u.id}
                  u={u}
                  guardando={guardando === u.id}
                  onGuardar={guardar}
                  onVerHistorial={verHistorial}
                  historial={historiales[u.id]}
                />
              ))}
            </tbody>
          </table>

          {filtradas.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              Ninguna unidad con esos filtros.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
