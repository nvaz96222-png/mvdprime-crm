import { useState } from "react";
import type { Unidad } from "../tipos";
import { ETIQUETA_ESTADO } from "../datos";
import { areaTexto, dormitoriosTexto, precioTexto } from "../utiles";

type Columna = "unidad" | "piso" | "tipologia" | "habitable" | "total" | "precio" | "estado";

interface Props {
  unidades: Unidad[];
  seleccionada: Unidad | null;
  alSeleccionar: (u: Unidad) => void;
}

const valor = (u: Unidad, c: Columna): string | number => {
  switch (c) {
    case "unidad":
      return Number(u.unidad);
    case "piso":
      return u.piso;
    case "tipologia":
      return u.dormitorios ?? -1;
    case "habitable":
      return u.superficies.habitable ?? 0;
    case "total":
      return u.superficies.total ?? 0;
    case "precio":
      return u.precio ?? Number.MAX_SAFE_INTEGER;
    case "estado":
      return u.estado;
  }
};

export default function VistaLista({ unidades, seleccionada, alSeleccionar }: Props) {
  const [orden, setOrden] = useState<{ columna: Columna; asc: boolean }>({
    columna: "unidad",
    asc: true,
  });

  const ordenadas = [...unidades].sort((a, b) => {
    const va = valor(a, orden.columna);
    const vb = valor(b, orden.columna);
    const cmp = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb));
    return orden.asc ? cmp : -cmp;
  });

  const encabezado = (c: Columna, texto: string) => (
    <th
      scope="col"
      onClick={() => setOrden({ columna: c, asc: orden.columna === c ? !orden.asc : true })}
      aria-sort={orden.columna === c ? (orden.asc ? "ascending" : "descending") : "none"}
    >
      {texto}
      {orden.columna === c ? (orden.asc ? " ↑" : " ↓") : ""}
    </th>
  );

  if (unidades.length === 0) {
    return (
      <div className="tabla-envoltura" style={{ padding: 36, textAlign: "center" }}>
        <p>Ninguna unidad cumple con los filtros elegidos.</p>
      </div>
    );
  }

  return (
    <div className="tabla-envoltura">
      <table className="tabla">
        <caption className="solo-lectores">
          Unidades de City Homes con tipología, superficies, precio y estado comercial
        </caption>
        <thead>
          <tr>
            {encabezado("unidad", "Unidad")}
            {encabezado("piso", "Planta")}
            {encabezado("tipologia", "Tipología")}
            {encabezado("habitable", "Habitable")}
            {encabezado("total", "Área total")}
            {encabezado("precio", "Precio")}
            {encabezado("estado", "Estado")}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((u) => (
            <tr
              key={u.id}
              aria-selected={seleccionada?.id === u.id}
              tabIndex={0}
              onClick={() => alSeleccionar(u)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  alSeleccionar(u);
                }
              }}
            >
              <td className="tabla__numero">{u.etiqueta}</td>
              <td>{u.nivel}</td>
              <td>{dormitoriosTexto(u)}</td>
              <td className="tabla__numero">{areaTexto(u.superficies.habitable)}</td>
              <td className="tabla__numero">{areaTexto(u.superficies.total)}</td>
              <td className="tabla__numero">{precioTexto(u)}</td>
              <td>
                <span className={`insignia insignia--${u.estado}`}>{ETIQUETA_ESTADO[u.estado]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
