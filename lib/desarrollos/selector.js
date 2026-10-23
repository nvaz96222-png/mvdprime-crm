// Selector visual de unidades por desarrollo.
//
// Sólo algunos proyectos tienen las plantas relevadas y los polígonos de cada
// unidad; los datos se generan con `npm run city-homes-datos` (ver el script
// para la cadena completa desde los documentos originales). Los proyectos que
// no están acá siguen mostrando la página de siempre.

const DISPONIBLES = {
  "city-homes": () =>
    Promise.all([
      import("./city-homes/unidades.json"),
      import("./city-homes/plantas.json"),
    ]),
};

export async function cargarSelector(slug) {
  const cargar = DISPONIBLES[slug];
  if (!cargar) return null;
  const [unidades, plantas] = await cargar();
  return { datos: unidades.default, plantas: plantas.default };
}
