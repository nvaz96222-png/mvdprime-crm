import type { Plano, Unidad } from "../tipos";
import { ETIQUETA_ESTADO } from "../datos";
import { proyecto } from "../datos/proyecto";
import { areaTexto, caja, dormitoriosTexto, montoTexto, precioTexto } from "../utiles";

interface Props {
  unidad: Unidad | null;
  plano: Plano | null;
  alConsultar: (u: Unidad) => void;
  alCerrar: () => void;
}

function MiniPlano({ unidad, plano }: { unidad: Unidad; plano: Plano }) {
  const puntos = plano.zonas[unidad.zona];
  if (!puntos) return null;
  const b = caja(puntos);
  const margen = 0.03;
  const x0 = Math.max(0, b.x0 - margen) * plano.ancho;
  const y0 = Math.max(0, b.y0 - margen) * plano.alto;
  const x1 = Math.min(1, b.x1 + margen) * plano.ancho;
  const y1 = Math.min(1, b.y1 + margen) * plano.alto;

  return (
    <div className="ficha__miniplano">
      <svg
        viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}
        role="img"
        aria-label={`Plano de la unidad ${unidad.unidad} recortado de la planta original`}
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
          stroke="#1b1b1a"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function FichaUnidad({ unidad, plano, alConsultar, alCerrar }: Props) {
  if (!unidad) {
    return (
      <aside className="ficha ficha--vacia">
        <h3 style={{ fontSize: 20, color: "var(--tinta)" }}>Elegí una unidad</h3>
        <p>
          Tocá un apartamento sobre la planta o elegilo en la lista para ver su tipología,
          superficies, precio y estado.
        </p>
        <p className="detalle-fuentes">
          Los datos salen de la lista oficial del proyecto y de la planilla comercial vigente.
        </p>
      </aside>
    );
  }

  const s = unidad.superficies;
  const conexiones = unidad.precio !== null ? Math.round(unidad.precio * 0.04) : null;

  return (
    <aside className="ficha" aria-live="polite">
      <header className="ficha__cabecera">
        <div className="ficha__fila">
          <div>
            <h3 className="ficha__unidad">{unidad.etiqueta}</h3>
            <p className="ficha__nivel">
              {unidad.nivel} · {unidad.tipologia}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <span className={`insignia insignia--${unidad.estado}`}>
              {ETIQUETA_ESTADO[unidad.estado]}
            </span>
            <button className="cerrar" onClick={alCerrar} aria-label="Cerrar la ficha">
              ×
            </button>
          </div>
        </div>
        <div className="ficha__precio">
          <strong>{precioTexto(unidad)}</strong>
          {unidad.precio !== null && <span>{proyecto.comercial.aviso}</span>}
        </div>
      </header>

      {plano && <MiniPlano unidad={unidad} plano={plano} />}

      <div className="ficha__cuerpo">
        <dl className="datos">
          <div className="datos__celda">
            <dt>Planta</dt>
            <dd>{unidad.nivel}</dd>
          </div>
          <div className="datos__celda">
            <dt>Tipología</dt>
            <dd>{dormitoriosTexto(unidad)}</dd>
          </div>
          <div className="datos__celda">
            <dt>Baños</dt>
            <dd>{unidad.banos ?? "A confirmar"}</dd>
          </div>
          <div className="datos__celda">
            <dt>Área habitable</dt>
            <dd>{areaTexto(s.habitable)}</dd>
          </div>
          <div className="datos__celda">
            <dt>Terrazas uso exclusivo</dt>
            <dd>{areaTexto(s.terrazasUsoExclusivo)}</dd>
          </div>
          <div className="datos__celda">
            <dt>Sub total</dt>
            <dd>{areaTexto(s.subTotal)}</dd>
          </div>
          <div className="datos__celda">
            <dt>Áreas comunes</dt>
            <dd>{areaTexto(s.areasComunes)}</dd>
          </div>
          <div className="datos__celda">
            <dt>Área total</dt>
            <dd>{areaTexto(s.total)}</dd>
          </div>
          {conexiones !== null && (
            <div className="datos__celda datos__celda--ancha">
              <dt>Conexiones (4% del precio de venta)</dt>
              <dd>{montoTexto(conexiones, unidad.moneda)}</dd>
            </div>
          )}
        </dl>

        {unidad.observaciones.map((nota) => (
          <p className="nota" key={nota}>
            {nota}
          </p>
        ))}

        <p className="nota nota--neutra">
          Forma de pago:{" "}
          {proyecto.comercial.formaDePago.map((e) => `${e.etapa} ${e.porcentaje}%`).join(" · ")}.
          Garaje opcional: {montoTexto(proyecto.garajes.precioUnitario)}.
        </p>

        <details className="detalle-fuentes">
          <summary>De dónde sale cada dato</summary>
          <ul>
            <li>
              <strong>Precio y estado:</strong> {unidad.fuentes.estadoYPrecio}
            </li>
            <li>
              <strong>Superficies y tipología:</strong> {unidad.fuentes.superficies}
            </li>
            <li>
              <strong>Plano:</strong> {unidad.fuentes.plano}
            </li>
            {unidad.historico.listaOficialPdf && (
              <li>
                <strong>Lista oficial del 24/06/2026:</strong>{" "}
                {ETIQUETA_ESTADO[unidad.historico.listaOficialPdf.estado]}
                {unidad.historico.listaOficialPdf.precio !== null &&
                  ` · ${montoTexto(unidad.historico.listaOficialPdf.precio)}`}
              </li>
            )}
          </ul>
        </details>
      </div>

      <footer className="ficha__pie">
        <button className="boton boton--bloque" onClick={() => alConsultar(unidad)}>
          Solicitar información de la {unidad.etiqueta}
        </button>
        <a
          className="boton boton--fantasma boton--bloque boton--chico"
          href={proyecto.documentos.brochure}
          target="_blank"
          rel="noreferrer"
        >
          Ver brochure del proyecto (PDF)
        </a>
      </footer>
    </aside>
  );
}
