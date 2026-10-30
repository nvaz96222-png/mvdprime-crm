"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Selector visual de unidades sobre las plantas del proyecto.
// Los polígonos vienen en coordenadas normalizadas (0..1) sobre la imagen
// original de cada planta, así que la capa SVG acompaña a la imagen a
// cualquier ancho. Ver scripts/city-homes-datos.js para el origen de los datos.

const ESTADOS = {
  disponible: {
    label: "Disponible",
    punto: "bg-emerald-600",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    fill: "#059669",
    etiqueta: "bg-emerald-600",
  },
  reservado: {
    label: "Reservado",
    punto: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    fill: "#d97706",
    etiqueta: "bg-amber-500",
  },
  vendido: {
    label: "Vendido",
    punto: "bg-rose-600",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    fill: "#e11d48",
    etiqueta: "bg-rose-600/80",
  },
  consultar: {
    label: "Consultar disponibilidad",
    punto: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600 ring-slate-200",
    fill: "#64748b",
    etiqueta: "bg-slate-500",
  },
};

const nf = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });
const af = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const precioTexto = (u) => {
  if (u.precio != null) return `US$ ${nf.format(u.precio)}`;
  if (u.estado === "vendido") return "No disponible";
  if (u.estado === "reservado") return "Reservada";
  return "Consultar";
};
const areaTexto = (m2) => (m2 == null ? "—" : `${af.format(m2)} m²`);

// Cada desarrollo nombra sus metrajes como los nombra su documento: en un
// edificio el total es el área total de la unidad; en un housing, los metros
// construidos de la casa.
const ROTULO_TOTAL = { casa: "Metros construidos", apartamento: "Área total" };
const rotuloTotal = (tipo) => ROTULO_TOTAL[tipo] || "Área total";

// Sólo se muestra la superficie que la unidad realmente tiene: un apartamento
// no tiene parcela y una casa no tiene áreas comunes. El desglose por ambiente
// va al final, con los nombres que le puso el desarrollador.
function superficies(u) {
  const filas = [];
  const agregar = (k, v) => {
    if (v != null) filas.push([k, areaTexto(v)]);
  };
  agregar("Área de la parcela", u.parcela);
  agregar("Área habitable", u.habitable);
  agregar("Terrazas uso exclusivo", u.terrazas);
  agregar("Sub total", u.subTotal);
  agregar("Áreas comunes", u.comunes);
  agregar(rotuloTotal(u.tipo), u.total);
  for (const [k, v] of u.desglose || []) agregar(k, v);
  return filas;
}

// Centroide del polígono, para ubicar el número de la unidad.
function centroide(puntos) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < puntos.length; i++) {
    const [x0, y0] = puntos[i];
    const [x1, y1] = puntos[(i + 1) % puntos.length];
    const cruz = x0 * y1 - x1 * y0;
    area += cruz;
    cx += (x0 + x1) * cruz;
    cy += (y0 + y1) * cruz;
  }
  if (!area) {
    return [
      puntos.reduce((s, p) => s + p[0], 0) / puntos.length,
      puntos.reduce((s, p) => s + p[1], 0) / puntos.length,
    ];
  }
  area *= 0.5;
  return [cx / (6 * area), cy / (6 * area)];
}

function caja(puntos) {
  const xs = puntos.map((p) => p[0]);
  const ys = puntos.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export default function SelectorUnidades({ datos, plantas, proyectoNombre }) {
  const { unidades, avisoPrecios, conexiones, formaDePago, garajes, sustantivo } = datos;
  const planos = plantas.planos;

  // Un desarrollo de casas tiene un solo plano —el loteo— y ninguna unidad
  // tiene piso: ahí no va el rail de pisos ni el encabezado "Piso 3".
  const porPisos = planos.length > 1;

  const pisos = useMemo(
    () => [...new Set(unidades.map((u) => u.piso).filter((p) => p != null))].sort((a, b) => b - a),
    [unidades]
  );
  const hayNiveles = useMemo(() => unidades.some((u) => u.nivel), [unidades]);
  const tipologias = useMemo(() => {
    const orden = ["Monoambiente", "1 dormitorio", "2 dormitorios"];
    return [...new Set(unidades.map((u) => u.tipologia))].sort(
      (a, b) =>
        orden.indexOf(a) - orden.indexOf(b) || String(a).localeCompare(String(b), "es")
    );
  }, [unidades]);
  const estadosPresentes = useMemo(
    () => Object.keys(ESTADOS).filter((e) => unidades.some((u) => u.estado === e)),
    [unidades]
  );
  const precioMaximo = useMemo(
    () => Math.max(...unidades.filter((u) => u.precio != null).map((u) => u.precio)),
    [unidades]
  );
  const precioMinimo = useMemo(
    () => Math.min(...unidades.filter((u) => u.precio != null).map((u) => u.precio)),
    [unidades]
  );

  // Letra chica de la ficha, armada con lo que haya cargado el CRM.
  const condiciones = useMemo(() => {
    const partes = [];
    if (formaDePago) partes.push(`Forma de pago: ${formaDePago}.`);
    if (conexiones) partes.push(conexiones);
    if (garajes?.precio != null)
      partes.push(`Garaje opcional: US$ ${nf.format(garajes.precio)}.`);
    return partes;
  }, [formaDePago, conexiones, garajes]);

  const [piso, setPiso] = useState(pisos[pisos.length - 1]);
  const [vista, setVista] = useState("plano");
  const [sel, setSel] = useState(null);
  const [globo, setGlobo] = useState(null);
  const [filtros, setFiltros] = useState({ tipologias: [], estados: [], precioMax: null });
  // Planta abierta en grande. Las del brochure se leen recién a tamaño
  // completo: en el ancho de la ficha no se distinguen los ambientes.
  const [lupa, setLupa] = useState(null);
  const lienzo = useRef(null);

  useEffect(() => {
    if (!lupa) return;
    const cerrar = (e) => e.key === "Escape" && setLupa(null);
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [lupa]);

  const hayFiltros =
    filtros.tipologias.length || filtros.estados.length || filtros.precioMax != null;

  const pasa = (u) => {
    if (filtros.tipologias.length && !filtros.tipologias.includes(u.tipologia)) return false;
    if (filtros.estados.length && !filtros.estados.includes(u.estado)) return false;
    if (filtros.precioMax != null && (u.precio == null || u.precio > filtros.precioMax)) return false;
    return true;
  };

  const filtradas = useMemo(
    () => unidades.filter(pasa),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtros, unidades]
  );
  const visibles = useMemo(() => new Set(filtradas.map((u) => u.id)), [filtradas]);

  const plano = porPisos ? planos.find((p) => p.pisos.includes(piso)) || null : planos[0];
  const planoDeSel = sel ? planos.find((p) => p.id === sel.plano) : null;
  const enElPlano = porPisos ? unidades.filter((u) => u.piso === piso) : unidades;

  const alternar = (lista, v) =>
    lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];

  function elegir(u) {
    setSel(u);
    if (porPisos && u.piso !== piso) setPiso(u.piso);
  }

  // El botón de la ficha prellena el formulario de contacto que ya tiene la
  // página y lleva el foco hasta ahí: un solo formulario para todo el sitio.
  function consultarUnidad(u) {
    window.dispatchEvent(
      new CustomEvent("mvdprime:unidad-elegida", {
        detail: {
          titulo: u.etiqueta,
          mensaje:
            `Hola, me interesa la ${sustantivo.unidad} ${u.etiqueta} de ${proyectoNombre} ` +
            `(${[u.nivel, u.tipologia, areaTexto(u.total)].filter(Boolean).join(", ")}` +
            `${u.precio != null ? `, ${precioTexto(u)}` : ""}). ¿Pueden contactarme?`,
        },
      })
    );
    document
      .getElementById("contacto-desarrollo")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function moverGlobo(u, e) {
    if (e.pointerType !== "mouse") return;
    const r = lienzo.current?.getBoundingClientRect();
    if (!r) return;
    setGlobo({ x: e.clientX - r.left, y: e.clientY - r.top, u });
  }

  return (
    // En pantallas grandes la sección se ensancha más allá del contenedor de
    // la página: la planta es el contenido principal y necesita aire.
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:-mx-32 2xl:-mx-48">
      {/* Cabecera */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-navy">Elegí tu {sustantivo.singular}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {unidades.filter((u) => u.estado === "disponible").length} {sustantivo.unidades}{" "}
            disponibles de {unidades.length} · desde US$ {nf.format(precioMinimo)}
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {estadosPresentes.map((e) => (
            <li key={e} className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${ESTADOS[e].punto}`} />
              {ESTADOS[e].label}
              <span className="text-slate-400">
                ({unidades.filter((u) => u.estado === e).length})
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Tipología
          </span>
          {tipologias.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={filtros.tipologias.includes(t)}
              onClick={() => setFiltros((f) => ({ ...f, tipologias: alternar(f.tipologias, t) }))}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                filtros.tipologias.includes(t)
                  ? "border-navy bg-navy text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Estado
          </span>
          {estadosPresentes.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={filtros.estados.includes(e)}
              onClick={() => setFiltros((f) => ({ ...f, estados: alternar(f.estados, e) }))}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                filtros.estados.includes(e)
                  ? "border-navy bg-navy text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {ESTADOS[e].label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Hasta
          </span>
          <input
            type="range"
            min={precioMinimo}
            max={precioMaximo}
            step={500}
            value={filtros.precioMax ?? precioMaximo}
            onChange={(ev) => {
              const v = Number(ev.target.value);
              setFiltros((f) => ({ ...f, precioMax: v >= precioMaximo ? null : v }));
            }}
            className="h-1 w-32 accent-accent"
            aria-label="Precio máximo"
          />
          <span className="w-28 tabular-nums">
            {filtros.precioMax == null ? "Sin tope" : `US$ ${nf.format(filtros.precioMax)}`}
          </span>
        </label>

        <div className="ml-auto flex items-center gap-2">
          {hayFiltros && (
            <button
              type="button"
              onClick={() => setFiltros({ tipologias: [], estados: [], precioMax: null })}
              className="text-sm text-slate-500 underline-offset-2 transition hover:text-navy hover:underline"
            >
              Limpiar
            </button>
          )}
          <span className="text-sm text-slate-500">
            <strong className="font-semibold text-navy">{filtradas.length}</strong> unidades
          </span>
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {["plano", "lista"].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={vista === v}
                onClick={() => setVista(v)}
                className={`px-3 py-1.5 text-sm capitalize transition ${
                  vista === v ? "bg-navy text-white" : "bg-white text-slate-600"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[auto_minmax(0,1fr)_320px]">
        {/* Rail de pisos */}
        {vista === "plano" && porPisos && (
          <nav
            aria-label="Pisos del edificio"
            className="flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200 p-1.5 lg:w-16 lg:flex-col lg:overflow-visible"
          >
            {pisos.map((p) => {
              const cantidad = filtradas.filter((u) => u.piso === p).length;
              return (
                <button
                  key={p}
                  type="button"
                  aria-current={p === piso}
                  onClick={() => setPiso(p)}
                  className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 transition lg:px-1 ${
                    p === piso ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"
                  } ${cantidad === 0 ? "opacity-40" : ""}`}
                >
                  <span className="text-sm font-semibold">{p}</span>
                  <span className="text-[10px] opacity-70">{cantidad}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Plano o lista */}
        {vista === "plano" ? (
          // Sin rail de pisos hay una columna menos ocupada: el plano toma las
          // dos primeras, igual que la tabla, para que la ficha conserve la
          // suya. Si no, la columna del medio se encoge a cero y la ficha
          // desaparece.
          <div className={`min-w-0 ${porPisos ? "" : "lg:col-span-2"}`}>
            <p className="mb-2 text-sm text-slate-500">
              {porPisos ? `Piso ${piso}` : plano.titulo} · tocá o pasá el cursor sobre una{" "}
              {sustantivo.unidad}
            </p>
            <div className="overflow-x-auto">
              {/* Abajo de lg la planta se desplaza en horizontal para que cada
                  unidad siga siendo tocable con el dedo. */}
              <div ref={lienzo} className="relative max-lg:min-w-[620px]">
                <img
                  src={plano.imagen}
                  width={plano.ancho}
                  height={plano.alto}
                  alt={`${plano.titulo} de ${proyectoNombre}`}
                  className="block w-full"
                />
                <svg
                  viewBox={`0 0 ${plano.ancho} ${plano.alto}`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                  onPointerLeave={() => setGlobo(null)}
                >
                  {enElPlano
                    .filter((u) => plano.zonas[u.zona])
                    .map((u) => {
                      const apagada = !visibles.has(u.id);
                      const activa = sel?.id === u.id;
                      return (
                        <polygon
                          key={u.id}
                          points={plano.zonas[u.zona]
                            .map(([x, y]) => `${x * plano.ancho},${y * plano.alto}`)
                            .join(" ")}
                          fill={ESTADOS[u.estado].fill}
                          stroke={ESTADOS[u.estado].fill}
                          strokeWidth={activa ? 4 : 2}
                          strokeLinejoin="round"
                          fillOpacity={apagada ? 0.04 : activa ? 0.55 : 0.28}
                          strokeOpacity={apagada ? 0.15 : 1}
                          tabIndex={apagada ? -1 : 0}
                          role="button"
                          aria-pressed={activa}
                          aria-label={`${u.etiqueta}, ${u.tipologia}, ${ESTADOS[u.estado].label}, ${precioTexto(u)}`}
                          className={apagada ? "" : "cursor-pointer transition-[fill-opacity]"}
                          onClick={() => !apagada && elegir(u)}
                          onKeyDown={(ev) => {
                            if (!apagada && (ev.key === "Enter" || ev.key === " ")) {
                              ev.preventDefault();
                              elegir(u);
                            }
                          }}
                          onPointerEnter={(ev) => !apagada && moverGlobo(u, ev)}
                          onPointerMove={(ev) => !apagada && moverGlobo(u, ev)}
                        />
                      );
                    })}
                </svg>

                {/* Números: en HTML para que no se achiquen con la imagen */}
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  {enElPlano
                    .filter((u) => plano.zonas[u.zona] && visibles.has(u.id))
                    .map((u) => {
                      const [cx, cy] = centroide(plano.zonas[u.zona]);
                      return (
                        <span
                          key={u.id}
                          style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded px-1.5 text-[11px] font-semibold text-white ${
                            sel?.id === u.id ? "bg-navy ring-2 ring-white" : ESTADOS[u.estado].etiqueta
                          }`}
                        >
                          {u.unidad}
                        </span>
                      );
                    })}
                </div>

                {globo && (
                  <div
                    style={{ left: globo.x, top: globo.y }}
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-lg bg-navy px-3 py-2 text-white shadow-lg"
                  >
                    <strong className="block text-sm font-semibold">{globo.u.etiqueta}</strong>
                    <span className="text-xs opacity-80">
                      {globo.u.tipologia} · {ESTADOS[globo.u.estado].label}
                      {globo.u.precio != null && ` · ${precioTexto(globo.u)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 lg:col-span-2">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">
                Unidades de {proyectoNombre} con tipología, superficie, precio y estado
              </caption>
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Unidad</th>
                  {hayNiveles && <th className="px-4 py-2.5 font-medium">Planta</th>}
                  <th className="px-4 py-2.5 font-medium">Tipología</th>
                  <th className="px-4 py-2.5 font-medium">{rotuloTotal(unidades[0]?.tipo)}</th>
                  <th className="px-4 py-2.5 font-medium">Precio</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((u) => (
                  <tr
                    key={u.id}
                    tabIndex={0}
                    aria-selected={sel?.id === u.id}
                    onClick={() => elegir(u)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        elegir(u);
                      }
                    }}
                    className={`cursor-pointer border-t border-slate-100 transition hover:bg-slate-50 ${
                      sel?.id === u.id ? "bg-slate-50" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium text-navy">{u.etiqueta}</td>
                    {hayNiveles && <td className="px-4 py-2.5 text-slate-600">{u.nivel}</td>}
                    <td className="px-4 py-2.5 text-slate-600">{u.tipologia}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{areaTexto(u.total)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">{precioTexto(u)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ${ESTADOS[u.estado].chip}`}
                      >
                        {ESTADOS[u.estado].label}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={hayNiveles ? 6 : 5} className="px-4 py-10 text-center text-slate-400">
                      Ninguna unidad cumple con los filtros elegidos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Ficha */}
        <aside aria-live="polite" className="lg:w-80">
          {!sel ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm font-medium text-slate-600">Elegí una {sustantivo.unidad}</p>
              <p className="mt-1.5 text-sm text-slate-400">
                Tocá {sustantivo.singular === "casa" ? "una casa" : "un apartamento"} en el plano o
                en la lista para ver su tipología, superficies, precio y estado.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
                <div>
                  <p className="text-xl font-bold text-navy">{sel.etiqueta}</p>
                  <p className="text-sm text-slate-500">
                    {[sel.nivel, sel.tipologia].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ring-1 ${ESTADOS[sel.estado].chip}`}
                >
                  {ESTADOS[sel.estado].label}
                </span>
              </div>

              <div className="px-4 pb-3">
                <p className="text-2xl font-bold text-accent">{precioTexto(sel)}</p>
                {sel.precio != null && (
                  <p className="text-xs text-slate-400">{avisoPrecios}</p>
                )}
              </div>

              {planoDeSel && planoDeSel.zonas[sel.zona] && (
                <div className="border-y border-slate-100 bg-slate-50">
                  <MiniPlano plano={planoDeSel} puntos={planoDeSel.zonas[sel.zona]} unidad={sel.unidad} />
                </div>
              )}

              {sel.imagenes?.length > 0 && (
                <div className="grid grid-cols-2 gap-px border-y border-slate-100 bg-slate-100">
                  {sel.imagenes.map((im) => (
                    <button
                      key={im.imagen}
                      type="button"
                      onClick={() => setLupa({ ...im, unidad: sel.etiqueta })}
                      className="group bg-white p-2 text-left transition hover:bg-slate-50"
                    >
                      <img
                        src={im.imagen}
                        alt={`${im.titulo} de la ${sel.etiqueta}`}
                        loading="lazy"
                        className="block h-24 w-full rounded object-cover object-top"
                      />
                      <span className="mt-1 block text-[11px] font-medium text-slate-500 group-hover:text-accent">
                        {im.titulo} ↗
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-px bg-slate-100 text-sm">
                <Dato
                  k="Dormitorios"
                  v={sel.dormitorios === 0 ? "Monoambiente" : sel.dormitorios ?? "A confirmar"}
                />
                <Dato k="Baños" v={sel.banos ?? "A confirmar"} />
                {superficies(sel).map(([k, v], i, todas) => (
                  <Dato key={k} k={k} v={v} ancha={i === todas.length - 1 && todas.length % 2 === 1} />
                ))}
              </dl>

              {sel.observaciones?.map((o) => (
                <p
                  key={o}
                  className="border-l-2 border-amber-400 bg-amber-50/60 px-4 py-2.5 text-xs leading-relaxed text-slate-600"
                >
                  {o}
                </p>
              ))}

              {/* Cada parte aparece sólo si el dato está cargado: sin precio
                  de garaje no se anuncia un "US$ 0". */}
              {condiciones.length > 0 && (
                <p className="bg-white px-4 py-3 text-xs leading-relaxed text-slate-500">
                  {condiciones.join(" ")}
                </p>
              )}

              <div className="border-t border-slate-100 bg-slate-50 p-3">
                <button
                  type="button"
                  onClick={() => consultarUnidad(sel)}
                  className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dark"
                >
                  Consultar por la {sel.etiqueta}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Planta en grande */}
      {lupa && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${lupa.titulo} de la ${lupa.unidad}`}
          onClick={() => setLupa(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-navy/85 p-4"
        >
          <img
            src={lupa.imagen}
            alt={`${lupa.titulo} de la ${lupa.unidad}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] w-auto max-w-full rounded-lg bg-white shadow-2xl"
          />
          <p className="text-sm text-white/90">
            {lupa.unidad} · {lupa.titulo}
          </p>
          <button
            type="button"
            onClick={() => setLupa(null)}
            className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur transition hover:bg-white/25"
          >
            Cerrar
          </button>
        </div>
      )}
    </section>
  );
}

function Dato({ k, v, ancha }) {
  return (
    <div className={`bg-white px-4 py-2 ${ancha ? "col-span-2" : ""}`}>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{k}</dt>
      <dd className="text-slate-700">{v}</dd>
    </div>
  );
}

// Recorte de la unidad sobre la planta original, como plano de la ficha.
function MiniPlano({ plano, puntos, unidad }) {
  const [x0, y0, x1, y1] = caja(puntos);
  const m = 0.03;
  const vx = Math.max(0, x0 - m) * plano.ancho;
  const vy = Math.max(0, y0 - m) * plano.alto;
  const vw = (Math.min(1, x1 + m) - Math.max(0, x0 - m)) * plano.ancho;
  const vh = (Math.min(1, y1 + m) - Math.max(0, y0 - m)) * plano.alto;

  return (
    <svg
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      className="block w-full"
      role="img"
      aria-label={`Plano de la unidad ${unidad}, recortado de la planta original`}
    >
      <image
        href={plano.imagen}
        x={0}
        y={0}
        width={plano.ancho}
        height={plano.alto}
        preserveAspectRatio="none"
      />
      <polygon
        points={puntos.map(([x, y]) => `${x * plano.ancho},${y * plano.alto}`).join(" ")}
        fill="none"
        stroke="#1A2B4A"
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  );
}
