import { useRef, useState } from "react";
import type { Plano, Unidad } from "../tipos";
import { ETIQUETA_ESTADO } from "../datos";
import { centroide, precioTexto } from "../utiles";

interface Props {
  plano: Plano;
  unidades: Unidad[];
  /** unidades que pasan los filtros: el resto se atenúa */
  visibles: Set<string>;
  seleccionada: Unidad | null;
  alSeleccionar: (u: Unidad) => void;
  tituloPiso: string;
}

interface Globo {
  x: number;
  y: number;
  unidad: Unidad;
}

export default function PlanoInteractivo({
  plano,
  unidades,
  visibles,
  seleccionada,
  alSeleccionar,
  tituloPiso,
}: Props) {
  const [globo, setGlobo] = useState<Globo | null>(null);
  const lienzo = useRef<HTMLDivElement>(null);

  const conZona = unidades.filter((u) => plano.zonas[u.zona]);
  const sinZona = unidades.filter((u) => !plano.zonas[u.zona]);

  const mostrarGlobo = (u: Unidad, evento: React.PointerEvent) => {
    if (evento.pointerType !== "mouse") return;
    const caja = lienzo.current?.getBoundingClientRect();
    if (!caja) return;
    setGlobo({ x: evento.clientX - caja.left, y: evento.clientY - caja.top, unidad: u });
  };

  return (
    <div className="plano">
      <div className="plano__barra">
        <div>
          <h3 className="plano__titulo">{tituloPiso}</h3>
          <p className="plano__subtitulo">
            {conZona.length} unidades en la planta · tocá o pasá el cursor sobre una para verla
          </p>
        </div>
      </div>

      <div className="plano__scroll">
      <div className="plano__lienzo" ref={lienzo}>
        <img
          className="plano__imagen"
          src={plano.imagen}
          width={plano.ancho}
          height={plano.alto}
          alt={`Planta de ${tituloPiso} del edificio City Homes`}
        />

        <svg
          className="plano__svg"
          viewBox={`0 0 ${plano.ancho} ${plano.alto}`}
          preserveAspectRatio="none"
          role="group"
          aria-label={`Selector de apartamentos — ${tituloPiso}`}
          onPointerLeave={() => setGlobo(null)}
        >
          {conZona.map((u) => {
            const puntos = plano.zonas[u.zona];
            const atenuada = !visibles.has(u.id);
            const activa = seleccionada?.id === u.id;
            const [cx, cy] = centroide(puntos);
            return (
              <g key={u.id}>
                <polygon
                  className={[
                    "zona",
                    `zona--${u.estado}`,
                    activa ? "zona--activa" : "",
                    atenuada ? "zona--apagada" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  points={puntos
                    .map(([x, y]) => `${x * plano.ancho},${y * plano.alto}`)
                    .join(" ")}
                  tabIndex={atenuada ? -1 : 0}
                  role="button"
                  aria-pressed={activa}
                  aria-label={`${u.etiqueta}, ${u.tipologia}, ${ETIQUETA_ESTADO[u.estado]}, ${precioTexto(u)}`}
                  onClick={() => !atenuada && alSeleccionar(u)}
                  onKeyDown={(e) => {
                    if (!atenuada && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      alSeleccionar(u);
                    }
                  }}
                  onFocus={() => !atenuada && setGlobo(null)}
                  onPointerEnter={(e) => !atenuada && mostrarGlobo(u, e)}
                  onPointerMove={(e) => !atenuada && mostrarGlobo(u, e)}
                  data-centro={`${cx},${cy}`}
                />
              </g>
            );
          })}
        </svg>

        {/* Los números van en HTML y no dentro del SVG para que mantengan un
            tamaño legible sea cual sea el ancho al que se escale la planta. */}
        <div className="plano__numeros" aria-hidden="true">
          {conZona
            .filter((u) => visibles.has(u.id))
            .map((u) => {
              const [cx, cy] = centroide(plano.zonas[u.zona]);
              return (
                <span
                  key={u.id}
                  className={`plano__numero plano__numero--${u.estado}${
                    seleccionada?.id === u.id ? " plano__numero--activo" : ""
                  }`}
                  style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }}
                >
                  {u.unidad}
                </span>
              );
            })}
        </div>

        {globo && (
          <div className="globo" style={{ left: globo.x, top: globo.y }}>
            <strong>{globo.unidad.etiqueta}</strong>
            <span>
              {globo.unidad.tipologia} · {ETIQUETA_ESTADO[globo.unidad.estado]}
              {globo.unidad.precio !== null && ` · ${precioTexto(globo.unidad)}`}
            </span>
          </div>
        )}
      </div>
      </div>

      {sinZona.length > 0 && (
        <p className="nota" style={{ marginTop: 12 }}>
          Sin zona dibujada en esta planta: {sinZona.map((u) => u.etiqueta).join(", ")}.
        </p>
      )}
    </div>
  );
}
