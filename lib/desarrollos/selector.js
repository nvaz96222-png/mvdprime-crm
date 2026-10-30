// Selector visual de unidades por desarrollo.
//
// Precio y estado salen de Supabase (proyecto_unidades) y se editan en el CRM:
// /proyectos/<id>/editar?tab=unidades. La página pública revalida cada 5
// minutos, así que un cambio se ve solo, sin build ni deploy.
//
// Los polígonos de cada unidad sobre el plano siguen viviendo en el repo
// (./<slug>/plantas.json): son geometría trazada sobre los planos del
// proyecto, no dato comercial, y no cambian con las ventas. El vínculo entre
// una fila de la base y su polígono son las columnas `plano` y `zona`.
//
// Un desarrollo tiene selector sólo si está en PLANTAS: sin plantas relevadas
// no hay dónde dibujar las unidades.

const PLANTAS = {
  "city-homes": () => import("./city-homes/plantas.json"),
  "jardines-del-polo": () => import("./jardines-del-polo/plantas.json"),
};

// Las unidades que el proyecto vende como tales. Un garaje se cotiza pero no
// se elige sobre el plano, y no puede arrastrar el "desde" del desarrollo.
const PRINCIPALES = ["apartamento", "casa"];

const SUSTANTIVOS = {
  apartamento: { singular: "apartamento", plural: "apartamentos", unidad: "unidad", unidades: "unidades" },
  casa: { singular: "casa", plural: "casas", unidad: "casa", unidades: "casas" },
};

export function tieneSelector(slug) {
  return Boolean(PLANTAS[slug]);
}

/**
 * @param supabase  cliente de Supabase (el de la página pública ya es admin)
 * @param proyecto  fila de `proyectos` (necesita id, slug y los textos)
 */
export async function cargarSelector(supabase, proyecto) {
  const cargarPlantas = PLANTAS[proyecto?.slug];
  if (!cargarPlantas) return null;

  const [plantas, { data: filas, error }] = await Promise.all([
    cargarPlantas(),
    supabase
      .from("proyecto_unidades")
      .select(
        "id, codigo, etiqueta, tipo, piso, nivel, tipologia, dormitorios, banos, " +
          "sup_habitable, sup_terrazas, sup_subtotal, sup_comunes, sup_total, " +
          "sup_parcela, desglose, precio, moneda, estado, plano, zona, observaciones"
      )
      .eq("proyecto_id", proyecto.id)
      .order("codigo"),
  ]);

  // Sin unidades cargadas no se muestra un selector vacío: la página sigue
  // mostrando el resto del desarrollo como siempre.
  if (error || !filas?.length) return null;

  const principales = filas.filter((f) => PRINCIPALES.includes(f.tipo));
  if (principales.length === 0) return null;

  const garajes = filas.filter((f) => f.tipo === "garaje");
  const tipoDominante = principales[0].tipo;

  return {
    datos: {
      sustantivo: SUSTANTIVOS[tipoDominante] || SUSTANTIVOS.apartamento,
      avisoPrecios: proyecto.aviso_precios || "",
      conexiones: proyecto.conexiones || "",
      formaDePago: proyecto.forma_de_pago || "",
      garajes: resumenGarajes(garajes),
      unidades: principales.map(aUnidad),
    },
    plantas: plantas.default,
  };
}

// La base usa los nombres de las columnas; el selector, los del documento
// original. La traducción vive acá y en ningún otro lado.
function aUnidad(f) {
  return {
    id: f.id,
    unidad: f.codigo,
    etiqueta: f.etiqueta,
    tipo: f.tipo,
    piso: f.piso,
    nivel: f.nivel,
    tipologia: f.tipologia,
    dormitorios: f.dormitorios,
    banos: f.banos,
    habitable: f.sup_habitable,
    terrazas: f.sup_terrazas,
    subTotal: f.sup_subtotal,
    comunes: f.sup_comunes,
    total: f.sup_total,
    parcela: f.sup_parcela,
    // Lista de [rótulo, m²] en el orden del documento de origen.
    desglose: Array.isArray(f.desglose) && f.desglose.length ? f.desglose : null,
    precio: f.precio,
    estado: f.estado,
    plano: f.plano,
    zona: f.zona,
    ...(f.observaciones?.length ? { observaciones: f.observaciones } : {}),
  };
}

// Los garajes no se eligen sobre el plano: se muestran como un conteo y un
// precio. Si hay varios precios distintos se informa el más bajo, que es el
// que acompaña la frase "garaje opcional desde".
function resumenGarajes(filas) {
  const precios = filas.map((g) => g.precio).filter((p) => p != null);
  const conteo = filas.reduce(
    (acc, g) => ({ ...acc, [g.estado]: (acc[g.estado] || 0) + 1 }),
    {}
  );
  return {
    ...conteo,
    precio: precios.length ? Math.min(...precios) : null,
    moneda: filas[0]?.moneda || "USD",
  };
}
