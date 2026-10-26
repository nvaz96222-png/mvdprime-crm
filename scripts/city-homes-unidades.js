/**
 * city-homes-unidades.js
 * Carga inicial de las unidades de City Homes en Supabase (proyecto_unidades),
 * desde los datos ya conciliados de los documentos originales:
 *
 *   city-homes-selector/datos-fuente/*            (PDF oficial + planilla Pires)
 *        ↓  npm --prefix city-homes-selector run datos
 *   city-homes-selector/src/datos/unidades.json   (158 unidades + 22 garajes)
 *        ↓  node scripts/city-homes-unidades.js
 *   Supabase · proyecto_unidades                  ← fuente de verdad desde acá
 *
 * Después de esta carga, precio y estado se editan en el CRM
 * (/proyectos/<id>/editar?tab=unidades) y la web los lee en vivo. Este script
 * NO vuelve a correr en la operación diaria: es para la carga inicial y para
 * cuando el desarrollador manda una lista nueva completa.
 *
 * Uso:
 *   node scripts/city-homes-unidades.js            → simulacro, no escribe nada
 *   node scripts/city-homes-unidades.js --aplicar  → inserta las que falten
 *   node scripts/city-homes-unidades.js --aplicar --pisar-precios
 *                                                  → además pisa precio y estado
 *                                                    de las que ya existen con
 *                                                    lo que diga el documento
 *
 * Sin --pisar-precios, una unidad que ya está en la base no se toca: lo que
 * editó una persona en el CRM vale más que una relectura del mismo documento.
 *
 * Variables de entorno (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

"use strict";

require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SLUG = "city-homes";
const ORIGEN = path.resolve(
  __dirname,
  "..",
  "city-homes-selector",
  "src",
  "datos",
  "unidades.json"
);

// Textos comerciales que hasta ahora vivían escritos en el generador del
// payload. Se cargan una vez en el proyecto y después se editan en el CRM.
const TEXTOS = {
  aviso_precios: "Precios sujetos a ajuste por avance de ventas.",
  conexiones: "Conexiones: 4% del precio de venta.",
  forma_de_pago: "25% compromiso · 6 trimestres de 10% · 15% a la entrega",
};

const aplicar = process.argv.includes("--aplicar");
const pisarPrecios = process.argv.includes("--pisar-precios");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("❌  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// ─── Mapeo documento → fila ─────────────────────────────────────────────────

function filaApartamento(u, proyectoId) {
  return {
    proyecto_id: proyectoId,
    codigo: u.unidad,
    etiqueta: u.etiqueta,
    tipo: "apartamento",
    piso: u.piso,
    nivel: u.nivel,
    tipologia: u.tipologia,
    dormitorios: u.dormitorios,
    banos: u.banos,
    sup_habitable: u.superficies.habitable,
    sup_terrazas: u.superficies.terrazasUsoExclusivo,
    sup_subtotal: u.superficies.subTotal,
    sup_comunes: u.superficies.areasComunes,
    sup_total: u.superficies.total,
    precio: u.precio,
    moneda: u.moneda || "USD",
    estado: u.estado,
    plano: u.plano,
    zona: u.zona,
    observaciones: u.observaciones || [],
    fuente_precio: u.fuentes?.estadoYPrecio || null,
    fuente_superficies: u.fuentes?.superficies || null,
    fuente_plano: u.fuentes?.plano || null,
    historico: u.historico || {},
  };
}

// Los garajes no tienen planta relevada: se listan y se cotizan, pero no se
// eligen sobre el plano. Por eso van sin plano/zona.
function filaGaraje(g, proyectoId) {
  return {
    proyecto_id: proyectoId,
    codigo: g.numero,
    etiqueta: `Garaje ${g.numero}`,
    tipo: "garaje",
    precio: g.precio,
    moneda: g.moneda || "USD",
    estado: g.estado,
    observaciones: [],
    fuente_precio: g.fuente || null,
    historico: {},
  };
}

// Lo que una relectura del documento puede pisar. El resto (código, etiqueta,
// plano, zona, fuentes) no cambia entre lecturas del mismo listado.
const CAMPOS_COMERCIALES = ["precio", "estado", "observaciones"];

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  const doc = JSON.parse(fs.readFileSync(ORIGEN, "utf8"));

  const { data: proyecto, error: errProyecto } = await supabase
    .from("proyectos")
    .select("id, nombre, aviso_precios, conexiones, forma_de_pago")
    .eq("slug", SLUG)
    .maybeSingle();

  if (errProyecto) {
    console.error("❌  No se pudo leer el proyecto:", errProyecto.message);
    process.exit(1);
  }
  if (!proyecto) {
    console.error(`❌  No existe un proyecto con slug "${SLUG}".`);
    process.exit(1);
  }

  const filas = [
    ...doc.unidades.map((u) => filaApartamento(u, proyecto.id)),
    ...doc.garajes.map((g) => filaGaraje(g, proyecto.id)),
  ];

  const { data: existentes, error: errExistentes } = await supabase
    .from("proyecto_unidades")
    .select("id, tipo, codigo, precio, estado")
    .eq("proyecto_id", proyecto.id);

  if (errExistentes) {
    console.error("❌  No se pudieron leer las unidades existentes:", errExistentes.message);
    console.error("    ¿Corriste la migración 20261026_proyecto_unidades.sql?");
    process.exit(1);
  }

  const clave = (f) => `${f.tipo}:${f.codigo}`;
  const porClave = new Map((existentes || []).map((e) => [clave(e), e]));

  const nuevas = filas.filter((f) => !porClave.has(clave(f)));
  const yaEstaban = filas.filter((f) => porClave.has(clave(f)));

  // Diferencias entre lo que hay en la base y lo que dice el documento.
  const difieren = yaEstaban.filter((f) => {
    const e = porClave.get(clave(f));
    return Number(e.precio) !== Number(f.precio) || e.estado !== f.estado;
  });

  console.log(`Proyecto: ${proyecto.nombre}`);
  console.log(`Documento: ${doc.unidades.length} apartamentos + ${doc.garajes.length} garajes`);
  console.log(`En la base: ${existentes?.length ?? 0} unidades`);
  console.log(`  · a insertar: ${nuevas.length}`);
  console.log(`  · ya estaban: ${yaEstaban.length} (${difieren.length} con precio o estado distinto)`);

  if (difieren.length > 0) {
    console.log(
      pisarPrecios
        ? "\n  Se van a pisar con el documento:"
        : "\n  NO se tocan (corré con --pisar-precios si querés imponer el documento):"
    );
    for (const f of difieren.slice(0, 10)) {
      const e = porClave.get(clave(f));
      console.log(
        `    ${f.etiqueta.padEnd(12)} base: ${e.estado}/${e.precio ?? "—"}` +
          `   documento: ${f.estado}/${f.precio ?? "—"}`
      );
    }
    if (difieren.length > 10) console.log(`    … y ${difieren.length - 10} más`);
  }

  if (!aplicar) {
    console.log("\nSimulacro: no se escribió nada. Agregá --aplicar para hacerlo.");
    return;
  }

  // ── Insertar las que faltan ──────────────────────────────────────────────
  if (nuevas.length > 0) {
    // De a 100 para no mandar un body gigante.
    for (let i = 0; i < nuevas.length; i += 100) {
      const lote = nuevas.slice(i, i + 100);
      const { error } = await supabase.from("proyecto_unidades").insert(lote);
      if (error) {
        console.error(`❌  Error insertando el lote ${i / 100 + 1}:`, error.message);
        process.exit(1);
      }
    }
    console.log(`\n✔  ${nuevas.length} unidades insertadas.`);
  }

  // ── Pisar las existentes, si se pidió ────────────────────────────────────
  if (pisarPrecios && difieren.length > 0) {
    for (const f of difieren) {
      const e = porClave.get(clave(f));
      const cambios = Object.fromEntries(CAMPOS_COMERCIALES.map((c) => [c, f[c]]));
      const { error } = await supabase
        .from("proyecto_unidades")
        .update(cambios)
        .eq("id", e.id);
      if (error) {
        console.error(`❌  Error actualizando ${f.etiqueta}:`, error.message);
        process.exit(1);
      }
    }
    console.log(`✔  ${difieren.length} unidades actualizadas desde el documento.`);
  }

  // ── Textos comerciales del proyecto (sólo si están vacíos) ───────────────
  const faltantes = Object.fromEntries(
    Object.entries(TEXTOS).filter(([k]) => !proyecto[k])
  );
  if (Object.keys(faltantes).length > 0) {
    const { error } = await supabase
      .from("proyectos")
      .update(faltantes)
      .eq("id", proyecto.id);
    if (error) console.error("⚠  No se pudieron cargar los textos del proyecto:", error.message);
    else console.log(`✔  Textos del proyecto cargados: ${Object.keys(faltantes).join(", ")}`);
  }

  // ── Verificación ─────────────────────────────────────────────────────────
  const { data: final } = await supabase
    .from("proyecto_unidades")
    .select("tipo, estado, precio")
    .eq("proyecto_id", proyecto.id);

  const porEstado = (final || []).reduce(
    (acc, u) => ({ ...acc, [`${u.tipo}/${u.estado}`]: (acc[`${u.tipo}/${u.estado}`] || 0) + 1 }),
    {}
  );
  console.log("\nEn la base ahora:", porEstado);

  const { data: p } = await supabase
    .from("proyectos")
    .select("precio_desde, precio_hasta")
    .eq("id", proyecto.id)
    .single();
  console.log(`Rango recalculado por el trigger: USD ${p.precio_desde} – ${p.precio_hasta}`);
})();
