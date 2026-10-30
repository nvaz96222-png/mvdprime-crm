/**
 * cargar-unidades.js
 * Carga en Supabase las unidades de un desarrollo, desde los datos ya
 * conciliados de sus documentos originales.
 *
 *   selectores/<slug>/datos-fuente/*          (listas y brochure del desarrollador)
 *        ↓  python -I construir_datos.py
 *   selectores/<slug>/salida/unidades.json    (unidades + trazabilidad)
 *        ↓  node scripts/cargar-unidades.js <slug>
 *   Supabase · proyecto_unidades              ← fuente de verdad desde acá
 *
 * Después de la carga, precio y estado se editan en el CRM
 * (/proyectos/<id>/editar?tab=unidades) y la web los lee en vivo. Este script
 * no corre en la operación diaria: es para la carga inicial y para cuando el
 * desarrollador manda una lista nueva completa.
 *
 * Uso:
 *   node scripts/cargar-unidades.js jardines-del-polo
 *       → simulacro, no escribe nada
 *   node scripts/cargar-unidades.js jardines-del-polo --aplicar
 *       → inserta las que falten
 *   node scripts/cargar-unidades.js jardines-del-polo --aplicar --pisar-precios
 *       → además pisa precio y estado de las que ya existen
 *
 * Sin --pisar-precios una unidad que ya está en la base no se toca: lo que
 * editó una persona en el CRM vale más que una relectura del mismo documento.
 *
 * City Homes se cargó antes de que existiera este script, con
 * scripts/city-homes-unidades.js; aquel lee el formato del selector original.
 * Para desarrollos nuevos va éste.
 */

"use strict";

require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const RAIZ = path.resolve(__dirname, "..");

const slug = process.argv[2];
const aplicar = process.argv.includes("--aplicar");
const pisarPrecios = process.argv.includes("--pisar-precios");

if (!slug || slug.startsWith("--")) {
  console.error("Uso: node scripts/cargar-unidades.js <slug> [--aplicar] [--pisar-precios]");
  process.exit(1);
}

const ORIGEN = path.join(RAIZ, "selectores", slug, "salida", "unidades.json");
if (!fs.existsSync(ORIGEN)) {
  console.error(`❌  No existe ${path.relative(RAIZ, ORIGEN)}`);
  console.error(`    Generalo con: python -I selectores/${slug}/construir_datos.py`);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("❌  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// ─── Documento → fila ───────────────────────────────────────────────────────

// Las superficies se guardan con la columna que les corresponde, y el resto
// del desglose va tal cual lo nombra el documento. Un apartamento trae
// habitable/terrazas/comunes; una casa, parcela y construidos.
function filaUnidad(u, proyectoId) {
  const s = u.superficies || {};
  return {
    proyecto_id: proyectoId,
    codigo: u.unidad,
    etiqueta: u.etiqueta,
    tipo: u.tipo || "apartamento",
    piso: u.piso ?? null,
    nivel: u.nivel ?? null,
    tipologia: u.tipologia ?? null,
    dormitorios: u.dormitorios ?? null,
    banos: u.banos ?? null,
    sup_habitable: s.habitable ?? null,
    sup_terrazas: s.terrazasUsoExclusivo ?? s.terrazas ?? null,
    sup_subtotal: s.subTotal ?? null,
    sup_comunes: s.areasComunes ?? null,
    // En una casa el "total" es lo construido: es el metraje que publica la
    // lista y por el que se compara con otra casa.
    sup_total: s.total ?? s.construidos ?? null,
    sup_parcela: s.parcela ?? null,
    desglose: s.desglose ?? {},
    precio: u.precio ?? null,
    moneda: u.moneda || "USD",
    estado: u.estado,
    plano: u.plano ?? null,
    zona: u.zona ?? null,
    observaciones: u.observaciones || [],
    fuente_precio: u.fuentes?.estadoYPrecio ?? null,
    fuente_superficies: u.fuentes?.superficies ?? null,
    fuente_plano: u.fuentes?.plano ?? null,
    historico: u.historico ?? {},
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
    .eq("slug", slug)
    .maybeSingle();

  if (errProyecto) {
    console.error("❌  No se pudo leer el proyecto:", errProyecto.message);
    process.exit(1);
  }
  if (!proyecto) {
    console.error(`❌  No existe un proyecto con slug "${slug}".`);
    process.exit(1);
  }

  const filas = doc.unidades.map((u) => filaUnidad(u, proyecto.id));

  const { data: existentes, error: errExistentes } = await supabase
    .from("proyecto_unidades")
    .select("id, tipo, codigo, precio, estado")
    .eq("proyecto_id", proyecto.id);

  if (errExistentes) {
    console.error("❌  No se pudieron leer las unidades existentes:", errExistentes.message);
    process.exit(1);
  }

  const clave = (f) => `${f.tipo}:${f.codigo}`;
  const porClave = new Map((existentes || []).map((e) => [clave(e), e]));

  const nuevas = filas.filter((f) => !porClave.has(clave(f)));
  const yaEstaban = filas.filter((f) => porClave.has(clave(f)));
  const difieren = yaEstaban.filter((f) => {
    const e = porClave.get(clave(f));
    return Number(e.precio) !== Number(f.precio) || e.estado !== f.estado;
  });

  console.log(`Proyecto: ${proyecto.nombre} (${slug})`);
  console.log(`Documento: ${filas.length} unidades`);
  console.log(`En la base: ${existentes?.length ?? 0}`);
  console.log(`  · a insertar: ${nuevas.length}`);
  console.log(`  · ya estaban: ${yaEstaban.length} (${difieren.length} con precio o estado distinto)`);

  if (doc.discrepancias?.length) {
    console.log(`\n⚠  ${doc.discrepancias.length} diferencias entre los documentos de origen (quedan como observación en la unidad).`);
  }

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

  if (nuevas.length > 0) {
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

  if (pisarPrecios && difieren.length > 0) {
    for (const f of difieren) {
      const e = porClave.get(clave(f));
      const cambios = Object.fromEntries(CAMPOS_COMERCIALES.map((c) => [c, f[c]]));
      const { error } = await supabase.from("proyecto_unidades").update(cambios).eq("id", e.id);
      if (error) {
        console.error(`❌  Error actualizando ${f.etiqueta}:`, error.message);
        process.exit(1);
      }
    }
    console.log(`✔  ${difieren.length} unidades actualizadas desde el documento.`);
  }

  // ── Condiciones comerciales del proyecto (sólo si están vacías) ──────────
  const c = doc.condiciones || {};
  const textos = {
    aviso_precios: c.avisoPrecios,
    conexiones: c.conexiones ?? c.gastos,
    forma_de_pago: c.formaDePago,
  };
  const faltantes = Object.fromEntries(
    Object.entries(textos).filter(([k, v]) => v && !proyecto[k])
  );
  if (Object.keys(faltantes).length > 0) {
    const { error } = await supabase.from("proyectos").update(faltantes).eq("id", proyecto.id);
    if (error) console.error("⚠  No se pudieron cargar los textos del proyecto:", error.message);
    else console.log(`✔  Textos del proyecto cargados: ${Object.keys(faltantes).join(", ")}`);
  }

  // ── Verificación ─────────────────────────────────────────────────────────
  const { data: final } = await supabase
    .from("proyecto_unidades")
    .select("tipo, estado")
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
