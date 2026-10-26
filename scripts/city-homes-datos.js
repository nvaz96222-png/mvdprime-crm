/**
 * city-homes-datos.js
 * Copia al CRM los polígonos de las unidades sobre las plantas de City Homes,
 * en la forma compacta que consume el selector de la web.
 *
 *   city-homes-selector/src/datos/plantas.json   (polígonos normalizados)
 *        ↓  npm run city-homes-datos
 *   lib/desarrollos/city-homes/plantas.json      (sólo lo que la web dibuja)
 *
 * Geometría solamente. El precio y el estado de cada unidad viven en Supabase
 * (tabla proyecto_unidades) y se editan en el CRM, en
 * /proyectos/<id>/editar?tab=unidades: no pasan por acá ni por un deploy.
 * La carga inicial de esas filas la hace scripts/city-homes-unidades.js.
 *
 * Este script sólo hace falta si se vuelven a trazar las plantas.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const ORIGEN = path.join(RAIZ, "city-homes-selector", "src", "datos");
const DESTINO = path.join(RAIZ, "lib", "desarrollos", "city-homes");

const plantas = JSON.parse(
  fs.readFileSync(path.join(ORIGEN, "plantas.json"), "utf8")
);

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

fs.mkdirSync(DESTINO, { recursive: true });
fs.writeFileSync(
  path.join(DESTINO, "plantas.json"),
  JSON.stringify({ planos }),
  "utf8"
);

const kb = Math.round(fs.statSync(path.join(DESTINO, "plantas.json")).size / 1024);
const zonas = planos.reduce((n, p) => n + Object.keys(p.zonas).length, 0);

console.log(`plantas.json   ${planos.length} plantas · ${zonas} polígonos · ${kb} KB`);
