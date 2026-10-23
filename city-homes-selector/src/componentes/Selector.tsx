import { useMemo, useState } from "react";
import type { Filtros as TipoFiltros, Plano, Unidad } from "../tipos";
import {
  ETIQUETA_ESTADO,
  estadosPresentes,
  pisos,
  planoDePiso,
  planos as planosBase,
  unidades,
} from "../datos";
import Filtros, { filtrosVacios } from "./Filtros";
import PlanoInteractivo from "./PlanoInteractivo";
import FichaUnidad from "./FichaUnidad";
import VistaLista from "./VistaLista";
import EditorZonas from "./EditorZonas";

interface Props {
  alConsultar: (u: Unidad) => void;
}

const pasaFiltros = (u: Unidad, f: TipoFiltros) => {
  if (f.tipologias.length && !f.tipologias.includes(u.tipologia)) return false;
  if (f.dormitorios.length && (u.dormitorios === null || !f.dormitorios.includes(u.dormitorios)))
    return false;
  if (f.estados.length && !f.estados.includes(u.estado)) return false;
  if (f.pisos.length && !f.pisos.includes(u.piso)) return false;
  if (f.precioMax !== null && (u.precio === null || u.precio > f.precioMax)) return false;
  if (f.superficieMin !== null) {
    const total = u.superficies.total;
    if (total === null || total < f.superficieMin) return false;
  }
  return true;
};

export default function Selector({ alConsultar }: Props) {
  const [pisoActivo, setPisoActivo] = useState(pisos[0]);
  const [vista, setVista] = useState<"plano" | "lista">("plano");
  const [filtros, setFiltros] = useState<TipoFiltros>(filtrosVacios);
  const [seleccionada, setSeleccionada] = useState<Unidad | null>(null);
  const [zonasEditadas, setZonasEditadas] = useState<Record<string, Plano["zonas"]>>({});
  const [editor, setEditor] = useState(
    () => new URLSearchParams(window.location.search).get("editor") === "1",
  );

  const filtradas = useMemo(() => unidades.filter((u) => pasaFiltros(u, filtros)), [filtros]);
  const visibles = useMemo(() => new Set(filtradas.map((u) => u.id)), [filtradas]);

  const planoBase = planoDePiso(pisoActivo);
  const plano: Plano | null = planoBase
    ? { ...planoBase, zonas: zonasEditadas[planoBase.id] ?? planoBase.zonas }
    : null;

  const unidadesDelPiso = useMemo(
    () => unidades.filter((u) => u.piso === pisoActivo),
    [pisoActivo],
  );

  const elegir = (u: Unidad) => {
    setSeleccionada(u);
    if (u.piso !== pisoActivo) setPisoActivo(u.piso);
  };

  const planoDeSeleccionada = seleccionada
    ? (() => {
        const base = planosBase.find((p) => p.id === seleccionada.plano);
        return base ? { ...base, zonas: zonasEditadas[base.id] ?? base.zonas } : null;
      })()
    : null;

  return (
    <section className="seccion seccion--borde" id="unidades">
      <div className="contenedor">
        <header className="seccion__encabezado">
          <div>
            <p className="ojo">Elegí tu apartamento</p>
            <h2 className="seccion__titulo">Disponibilidad planta por planta</h2>
            <p className="seccion__ayuda">
              Las plantas son las del proyecto original. Cada unidad está pintada según su estado
              comercial; los precios y estados salen de la lista oficial y de la planilla comercial
              vigente.
            </p>
          </div>
          <ul className="leyenda" aria-label="Referencia de estados">
            {estadosPresentes.map((e) => (
              <li className="leyenda__item" key={e}>
                <span className="leyenda__punto" style={{ background: `var(--${e})` }} />
                {ETIQUETA_ESTADO[e]}
                <span style={{ color: "var(--tinta-suave)" }}>
                  ({unidades.filter((u) => u.estado === e).length})
                </span>
              </li>
            ))}
          </ul>
        </header>

        <Filtros
          filtros={filtros}
          alCambiar={(f) => setFiltros(f)}
          cantidadFiltrada={filtradas.length}
          cantidadTotal={unidades.length}
          vista={vista}
          alCambiarVista={setVista}
        />

        {vista === "lista" ? (
          <div className="selector" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
            <VistaLista unidades={filtradas} seleccionada={seleccionada} alSeleccionar={elegir} />
            <FichaUnidad
              unidad={seleccionada}
              plano={planoDeSeleccionada}
              alConsultar={alConsultar}
              alCerrar={() => setSeleccionada(null)}
            />
          </div>
        ) : (
          <div className="selector">
            <nav className="rail" aria-label="Plantas del edificio">
              <p className="rail__titulo">Piso</p>
              {[...pisos].reverse().map((p) => {
                const disponiblesEnPiso = filtradas.filter((u) => u.piso === p).length;
                return (
                  <button
                    key={p}
                    className="rail__piso"
                    aria-current={p === pisoActivo}
                    data-vacio={disponiblesEnPiso === 0}
                    onClick={() => setPisoActivo(p)}
                  >
                    <strong>{p}</strong>
                    <small>{disponiblesEnPiso}</small>
                  </button>
                );
              })}
            </nav>

            {plano ? (
              <div style={{ position: "relative" }}>
                <PlanoInteractivo
                  plano={plano}
                  unidades={unidadesDelPiso}
                  visibles={visibles}
                  seleccionada={seleccionada}
                  alSeleccionar={elegir}
                  tituloPiso={`Piso ${pisoActivo}`}
                />
                {editor && (
                  <EditorZonas
                    plano={plano}
                    zonaActiva={seleccionada?.piso === pisoActivo ? seleccionada.zona : null}
                    alActualizar={(zona, puntos) =>
                      setZonasEditadas((previo) => ({
                        ...previo,
                        [plano.id]: { ...plano.zonas, [zona]: puntos },
                      }))
                    }
                    alCerrar={() => setEditor(false)}
                  />
                )}
              </div>
            ) : (
              <p className="nota">No hay planta cargada para el piso {pisoActivo}.</p>
            )}

            <FichaUnidad
              unidad={seleccionada}
              plano={planoDeSeleccionada}
              alConsultar={alConsultar}
              alCerrar={() => setSeleccionada(null)}
            />
          </div>
        )}
      </div>
    </section>
  );
}
