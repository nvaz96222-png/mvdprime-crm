import { useEffect, useRef, useState } from "react";
import type { Plano } from "../tipos";

interface Props {
  plano: Plano;
  zonaActiva: string | null;
  alActualizar: (zona: string, puntos: [number, number][]) => void;
  alCerrar: () => void;
}

/**
 * Herramienta de edición de zonas. Se abre agregando ?editor=1 a la URL.
 * Permite arrastrar los vértices del polígono de la unidad seleccionada y copiar
 * el JSON resultante para pegarlo en src/datos/plantas.json.
 */
export default function EditorZonas({ plano, zonaActiva, alActualizar, alCerrar }: Props) {
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const puntos = zonaActiva ? plano.zonas[zonaActiva] : null;

  useEffect(() => {
    if (arrastrando === null || !puntos || !zonaActiva) return;

    const mover = (e: PointerEvent) => {
      const caja = svgRef.current?.getBoundingClientRect();
      if (!caja) return;
      const x = Math.min(1, Math.max(0, (e.clientX - caja.left) / caja.width));
      const y = Math.min(1, Math.max(0, (e.clientY - caja.top) / caja.height));
      const nuevos = puntos.map((p, i) =>
        i === arrastrando ? ([Number(x.toFixed(4)), Number(y.toFixed(4))] as [number, number]) : p,
      );
      alActualizar(zonaActiva, nuevos);
    };
    const soltar = () => setArrastrando(null);

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
  }, [arrastrando, puntos, zonaActiva, alActualizar]);

  const json = JSON.stringify(plano.zonas, null, 1);

  return (
    <>
      {puntos && (
        <svg
          ref={svgRef}
          className="plano__svg"
          viewBox={`0 0 ${plano.ancho} ${plano.alto}`}
          preserveAspectRatio="none"
          style={{ zIndex: 5 }}
        >
          <polygon
            points={puntos.map(([x, y]) => `${x * plano.ancho},${y * plano.alto}`).join(" ")}
            fill="none"
            stroke="#1b1b1a"
            strokeDasharray="6 4"
            strokeWidth={2}
          />
          {puntos.map(([x, y], i) => (
            <circle
              key={i}
              className="vertice"
              cx={x * plano.ancho}
              cy={y * plano.alto}
              r={9}
              onPointerDown={() => setArrastrando(i)}
            />
          ))}
        </svg>
      )}

      <div className="editor">
        <h4>Editor de zonas · {plano.titulo}</h4>
        <p style={{ color: "var(--tinta-media)" }}>
          {zonaActiva
            ? `Arrastrá los vértices de la unidad ${zonaActiva} sobre la planta.`
            : "Elegí una unidad en la planta para editar su polígono."}
        </p>
        <textarea readOnly value={json} aria-label="JSON de zonas del plano" />
        <div className="editor__acciones">
          <button
            className="boton boton--chico"
            onClick={() => navigator.clipboard?.writeText(json)}
          >
            Copiar JSON
          </button>
          <button className="boton boton--fantasma boton--chico" onClick={alCerrar}>
            Salir del editor
          </button>
        </div>
      </div>
    </>
  );
}
