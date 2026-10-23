import type { Estado, Unidad } from "./tipos";

const formatoMoneda = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });
const formatoArea = new Intl.NumberFormat("es-UY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const precioTexto = (u: Unidad) => {
  if (u.precio !== null) return `${u.moneda} ${formatoMoneda.format(u.precio)}`;
  if (u.estado === "vendido") return "No disponible";
  if (u.estado === "reservado") return "Reservada";
  return "Consultar disponibilidad";
};

export const montoTexto = (monto: number | null, moneda = "USD") =>
  monto === null ? "—" : `${moneda} ${formatoMoneda.format(monto)}`;

export const areaTexto = (m2: number | null) =>
  m2 === null ? "—" : `${formatoArea.format(m2)} m²`;

export const dormitoriosTexto = (u: Unidad) => {
  if (u.dormitorios === null) return "—";
  if (u.dormitorios === 0) return "Monoambiente";
  return u.dormitorios === 1 ? "1 dormitorio" : `${u.dormitorios} dormitorios`;
};

export const seleccionable = (estado: Estado) => estado !== "vendido";

/** Centro aproximado de un polígono normalizado, para ubicar el número y el globo. */
export const centroide = (puntos: [number, number][]): [number, number] => {
  const n = puntos.length;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = puntos[i];
    const [x1, y1] = puntos[(i + 1) % n];
    const cruz = x0 * y1 - x1 * y0;
    area += cruz;
    cx += (x0 + x1) * cruz;
    cy += (y0 + y1) * cruz;
  }
  if (area === 0) {
    const sx = puntos.reduce((s, p) => s + p[0], 0) / n;
    const sy = puntos.reduce((s, p) => s + p[1], 0) / n;
    return [sx, sy];
  }
  area *= 0.5;
  return [cx / (6 * area), cy / (6 * area)];
};

export const caja = (puntos: [number, number][]) => {
  const xs = puntos.map((p) => p[0]);
  const ys = puntos.map((p) => p[1]);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
};

export const claseEstado = (estado: Estado) => estado;
