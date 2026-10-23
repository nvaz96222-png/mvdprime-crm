export type Estado = "disponible" | "reservado" | "vendido" | "consultar";

export interface Superficies {
  /** Área habitable (m²), tal como la nombran las listas oficiales. */
  habitable: number | null;
  /** Terrazas de uso exclusivo (m²). */
  terrazasUsoExclusivo: number | null;
  /** Sub total = habitable + terrazas, cuando el documento lo define. */
  subTotal: number | null;
  /** Áreas comunes (m²). */
  areasComunes: number | null;
  /** Área total (m²). */
  total: number | null;
}

export interface Fuentes {
  estadoYPrecio: string;
  superficies: string;
  plano: string;
}

export interface Unidad {
  id: string;
  unidad: string;
  etiqueta: string;
  piso: number;
  nivel: string;
  tipologia: string;
  dormitorios: number | null;
  banos: number | null;
  superficies: Superficies;
  precio: number | null;
  moneda: string;
  estado: Estado;
  /** id del plano en plantas.json */
  plano: string | null;
  /** clave de la zona dentro de ese plano */
  zona: string;
  observaciones: string[];
  fuentes: Fuentes;
  historico: {
    listaOficialPdf: { estado: Estado; precio: number | null; documento: string } | null;
    precioPlanillaAnterior: number | null;
  };
}

export interface Garaje {
  numero: string;
  estado: Estado;
  precio: number | null;
  moneda: string;
  fuente: string;
}

export interface Discrepancia {
  tipo: "estado" | "precio";
  unidad: string;
  listaOficialPdf: string | number | null;
  planillaVigente: string | number | null;
}

export interface Plano {
  id: string;
  titulo: string;
  imagen: string;
  ancho: number;
  alto: number;
  pisos: number[];
  /** polígonos en coordenadas normalizadas 0..1 sobre la imagen original */
  zonas: Record<string, [number, number][]>;
}

export interface PlantaInformativa {
  id: string;
  titulo: string;
  imagen: string;
  descripcion: string;
}

export interface Filtros {
  pisos: number[];
  dormitorios: number[];
  tipologias: string[];
  estados: Estado[];
  precioMax: number | null;
  superficieMin: number | null;
  soloConPrecio: boolean;
}
