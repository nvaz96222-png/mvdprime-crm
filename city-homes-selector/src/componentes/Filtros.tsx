import type { Estado, Filtros as TipoFiltros } from "../tipos";
import {
  ETIQUETA_ESTADO,
  estadosPresentes,
  precioMaximo,
  precioMinimo,
  superficieMaxima,
  superficieMinima,
  tipologias,
} from "../datos";
import { montoTexto } from "../utiles";

interface Props {
  filtros: TipoFiltros;
  alCambiar: (f: TipoFiltros) => void;
  cantidadFiltrada: number;
  cantidadTotal: number;
  vista: "plano" | "lista";
  alCambiarVista: (v: "plano" | "lista") => void;
}

const alternar = <T,>(lista: T[], valor: T): T[] =>
  lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

export const filtrosVacios: TipoFiltros = {
  pisos: [],
  dormitorios: [],
  tipologias: [],
  estados: [],
  precioMax: null,
  superficieMin: null,
  soloConPrecio: false,
};

export const hayFiltros = (f: TipoFiltros) =>
  f.pisos.length > 0 ||
  f.dormitorios.length > 0 ||
  f.tipologias.length > 0 ||
  f.estados.length > 0 ||
  f.precioMax !== null ||
  f.superficieMin !== null ||
  f.soloConPrecio;

export default function Filtros({
  filtros,
  alCambiar,
  cantidadFiltrada,
  cantidadTotal,
  vista,
  alCambiarVista,
}: Props) {
  return (
    <section className="filtros" aria-label="Filtros de búsqueda">
      <div className="filtros__grilla">
        <div>
          <span className="campo__etiqueta" id="f-tipologia">
            Tipología
          </span>
          <div className="fichas-opcion" role="group" aria-labelledby="f-tipologia">
            {tipologias.map((t) => (
              <button
                key={t}
                className="opcion"
                aria-pressed={filtros.tipologias.includes(t)}
                onClick={() => alCambiar({ ...filtros, tipologias: alternar(filtros.tipologias, t) })}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="campo__etiqueta" id="f-dorm">
            Dormitorios
          </span>
          <div className="fichas-opcion" role="group" aria-labelledby="f-dorm">
            {[0, 1, 2].map((d) => (
              <button
                key={d}
                className="opcion"
                aria-pressed={filtros.dormitorios.includes(d)}
                onClick={() =>
                  alCambiar({ ...filtros, dormitorios: alternar(filtros.dormitorios, d) })
                }
              >
                {d === 0 ? "Monoambiente" : d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="campo__etiqueta" id="f-estado">
            Estado comercial
          </span>
          <div className="fichas-opcion" role="group" aria-labelledby="f-estado">
            {estadosPresentes.map((e: Estado) => (
              <button
                key={e}
                className="opcion"
                aria-pressed={filtros.estados.includes(e)}
                onClick={() => alCambiar({ ...filtros, estados: alternar(filtros.estados, e) })}
              >
                {ETIQUETA_ESTADO[e]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="campo__etiqueta" htmlFor="f-precio">
            Precio máximo
          </label>
          <input
            id="f-precio"
            className="rango"
            type="range"
            min={precioMinimo}
            max={precioMaximo}
            step={500}
            value={filtros.precioMax ?? precioMaximo}
            onChange={(e) => {
              const v = Number(e.target.value);
              alCambiar({ ...filtros, precioMax: v >= precioMaximo ? null : v });
            }}
          />
          <div className="rango__valor">
            <span>{montoTexto(precioMinimo)}</span>
            <span>
              {filtros.precioMax === null ? "Sin tope" : `hasta ${montoTexto(filtros.precioMax)}`}
            </span>
          </div>
        </div>

        <div>
          <label className="campo__etiqueta" htmlFor="f-superficie">
            Área total mínima
          </label>
          <input
            id="f-superficie"
            className="rango"
            type="range"
            min={superficieMinima}
            max={superficieMaxima}
            step={1}
            value={filtros.superficieMin ?? superficieMinima}
            onChange={(e) => {
              const v = Number(e.target.value);
              alCambiar({ ...filtros, superficieMin: v <= superficieMinima ? null : v });
            }}
          />
          <div className="rango__valor">
            <span>
              {filtros.superficieMin === null
                ? "Sin mínimo"
                : `desde ${filtros.superficieMin} m²`}
            </span>
            <span>{superficieMaxima} m²</span>
          </div>
        </div>
      </div>

      <div className="filtros__pie">
        <p className="filtros__resumen">
          <strong>{cantidadFiltrada}</strong> de {cantidadTotal} unidades
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {hayFiltros(filtros) && (
            <button className="boton boton--fantasma boton--chico" onClick={() => alCambiar(filtrosVacios)}>
              Limpiar filtros
            </button>
          )}
          <div className="interruptor" role="group" aria-label="Forma de ver las unidades">
            <button aria-pressed={vista === "plano"} onClick={() => alCambiarVista("plano")}>
              Plano
            </button>
            <button aria-pressed={vista === "lista"} onClick={() => alCambiarVista("lista")}>
              Lista
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
