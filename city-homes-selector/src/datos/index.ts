import crudo from "./unidades.json";
import plantasCrudas from "./plantas.json";
import type { Discrepancia, Estado, Garaje, Plano, PlantaInformativa, Unidad } from "../tipos";

export const unidades = crudo.unidades as Unidad[];
export const garajes = crudo.garajes as Garaje[];
export const discrepancias = crudo.discrepancias as Discrepancia[];
export const fuentes = crudo.fuentes;
export const reglaDePrecedencia = crudo.reglaDePrecedencia;

export const planos = plantasCrudas.planos as unknown as Plano[];
export const plantasInformativas = plantasCrudas.plantasInformativas as PlantaInformativa[];
export const metodoZonas = plantasCrudas.metodo;

export const pisos = [...new Set(unidades.map((u) => u.piso))].sort((a, b) => a - b);

export const tipologias = [...new Set(unidades.map((u) => u.tipologia))].sort((a, b) => {
  const orden = ["Monoambiente", "1 dormitorio", "2 dormitorios"];
  return orden.indexOf(a) - orden.indexOf(b);
});

export const planoDePiso = (piso: number) => planos.find((p) => p.pisos.includes(piso)) ?? null;

export const unidadesDePiso = (piso: number) =>
  unidades.filter((u) => u.piso === piso).sort((a, b) => a.unidad.localeCompare(b.unidad));

const preciosConocidos = unidades.map((u) => u.precio).filter((p): p is number => p !== null);
export const precioMinimo = Math.min(...preciosConocidos);
export const precioMaximo = Math.max(...preciosConocidos);

const superficies = unidades
  .map((u) => u.superficies.total)
  .filter((s): s is number => s !== null);
export const superficieMinima = Math.floor(Math.min(...superficies));
export const superficieMaxima = Math.ceil(Math.max(...superficies));

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  consultar: "Consultar disponibilidad",
};

/** Sólo aparecen en la leyenda los estados que realmente existen en la documentación. */
export const estadosPresentes = (["disponible", "reservado", "vendido", "consultar"] as Estado[])
  .filter((e) => unidades.some((u) => u.estado === e));
