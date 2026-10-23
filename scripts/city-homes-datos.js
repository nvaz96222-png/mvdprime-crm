/**
 * city-homes-datos.js
 * Arma el payload liviano que consume el selector de unidades de la web
 * (/desarrollos/city-homes) a partir de los datos completos del proyecto
 * city-homes-selector/, que a su vez salen de los documentos originales.
 *
 *   city-homes-selector/src/datos/unidades.json   (158 unidades + trazabilidad)
 *   city-homes-selector/src/datos/plantas.json    (polígonos normalizados)
 *        ↓  npm run city-homes-datos
 *   lib/desarrollos/city-homes/unidades.json      (sólo lo que la web muestra)
 *   lib/desarrollos/city-homes/plantas.json
 *
 * Para actualizar precios o estados: regenerar el origen con
 * `npm --prefix city-homes-selector run datos` y después correr este script.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const ORIGEN = path.join(RAIZ, "city-homes-selector", "src", "datos");
const DESTINO = path.join(RAIZ, "lib", "desarrollos", "city-homes");

const leer = (f) => JSON.parse(fs.readFileSync(path.join(ORIGEN, f), "utf8"));

const completo = leer("unidades.json");
const plantas = leer("plantas.json");

// La web no necesita el histórico ni las rutas de los documentos fuente: con el
// dato vigente y la observación de conflicto alcanza, y el bundle queda chico.
const unidades = completo.unidades.map((u) => ({
  id: u.id,
  unidad: u.unidad,
  etiqueta: u.etiqueta,
  piso: u.piso,
  nivel: u.nivel,
  tipologia: u.tipologia,
  dormitorios: u.dormitorios,
  banos: u.banos,
  habitable: u.superficies.habitable,
  terrazas: u.superficies.terrazasUsoExclusivo,
  subTotal: u.superficies.subTotal,
  comunes: u.superficies.areasComunes,
  total: u.superficies.total,
  precio: u.precio,
  estado: u.estado,
  plano: u.plano,
  zona: u.zona,
  ...(u.observaciones.length ? { observaciones: u.observaciones } : {}),
}));

// Las imágenes de las plantas se sirven como estáticos del sitio.
const planos = plantas.planos.map((p) => ({
  id: p.id,
  titulo: p.titulo,
  imagen: `/desarrollos/city-homes/plantas/${path.basename(p.imagen)}`,
  ancho: p.ancho,
  alto: p.alto,
  pisos: p.pisos,
  zonas: p.zonas,
}));

const garajes = completo.garajes.reduce(
  (acc, g) => ({ ...acc, [g.estado]: (acc[g.estado] || 0) + 1 }),
  {}
);

const salida = {
  generado: "scripts/city-homes-datos.js",
  fuente: completo.fuentes.planillaVigente,
  avisoPrecios: "Precios sujetos a ajuste por avance de ventas.",
  conexiones: "Conexiones: 4% del precio de venta.",
  formaDePago: "25% compromiso · 6 trimestres de 10% · 15% a la entrega",
  garajes: { ...garajes, precio: 20000, moneda: "USD" },
  unidades,
};

fs.mkdirSync(DESTINO, { recursive: true });
fs.writeFileSync(
  path.join(DESTINO, "unidades.json"),
  JSON.stringify(salida),
  "utf8"
);
fs.writeFileSync(
  path.join(DESTINO, "plantas.json"),
  JSON.stringify({ planos }),
  "utf8"
);

const kb = (f) => Math.round(fs.statSync(path.join(DESTINO, f)).size / 1024);
const porEstado = unidades.reduce(
  (acc, u) => ({ ...acc, [u.estado]: (acc[u.estado] || 0) + 1 }),
  {}
);

console.log(`unidades.json  ${unidades.length} unidades  ${kb("unidades.json")} KB`, porEstado);
console.log(`plantas.json   ${planos.length} plantas    ${kb("plantas.json")} KB`);
