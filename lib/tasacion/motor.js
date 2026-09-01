// =====================================================================
// Motor de tasación por método comparativo de mercado (MCM).
//
// Lógica pura (sin DB, sin red): recibe el inmueble y sus comparables,
// devuelve el rango de valor. Testeable en aislamiento.
//
// Método:
//  1. m² EQUIVALENTES: interior + exterior × coef (el m² de terraza no vale
//     igual que el interior). Comparables y sujeto se miden en la misma base.
//  2. precio/m² equivalente de cada comparable → outliers por IQR → mediana
//     = precio/m² de referencia.
//  3. valor vivienda = precio/m² ref × m² equiv del sujeto × (1 + ajuste extras)
//     (extras = amenities/estado/piso/vista, premium global).
//  4. + valor de cochera (monto fijo, no va por m²).
//  5. rango con el margen de negociación (los comparables son precios de
//     PUBLICACIÓN, no de cierre).
// =====================================================================

function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Mediana de un array de números (no muta el input).
function mediana(nums) {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Cuantil por interpolación lineal (p entre 0 y 1).
function cuantil(nums, p) {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function redondear(n) {
  if (n == null) return null;
  return Math.round(n / 100) * 100;
}

/**
 * m² equivalentes de un ítem: interior + exterior × coef.
 * Si no hay desglose interior/exterior, cae al total (superficie).
 */
export function m2Equivalentes(item, coefExterior = 0.5) {
  const int = num(item.superficie_interior);
  const ext = num(item.superficie_exterior);
  if (int != null || ext != null) {
    return (int || 0) + (ext || 0) * (num(coefExterior) ?? 0.5);
  }
  return num(item.superficie); // fallback: total
}

/** Precio/m² equivalente de un comparable (sin ajuste). */
export function precioM2Comparable(comp, coefExterior = 0.5) {
  const precio = num(comp.precio);
  const eq = m2Equivalentes(comp, coefExterior);
  if (!precio || !eq || eq <= 0) return null;
  return precio / eq;
}

/**
 * Motor principal.
 *
 * @param {object} params
 *   superficie_interior, superficie_exterior, superficie  - m² del inmueble (superficie = total fallback)
 *   coefExterior        - peso del m² exterior (default 0.5)
 *   cocheraValor        - monto fijo de la cochera (se suma al final)
 *   ajusteExtrasPct     - premium/descuento global (fracción) por amenities/estado
 *   comparables         - [{ precio, superficie_interior, superficie_exterior, superficie, moneda, ajuste_pct, incluido }]
 *   margenNegociacion   - fracción (default 0.08)
 *   moneda              - moneda de la tasación
 */
export function calcularTasacion({
  superficie_interior,
  superficie_exterior,
  superficie,
  coefExterior = 0.5,
  cocheraValor = 0,
  ajusteExtrasPct = 0,
  comparables = [],
  margenNegociacion = 0.08,
  moneda = "USD",
} = {}) {
  const advertencias = [];
  const coef = num(coefExterior) ?? 0.5;

  // 1. Precio/m² equivalente por comparable.
  const enriquecidos = comparables.map((c) => {
    const precio_m2 = precioM2Comparable(c, coef);
    return { ...c, precio_m2, usado: false, es_outlier: false };
  });

  const monedasComps = new Set(comparables.map((c) => c.moneda).filter(Boolean));
  if (monedasComps.size > 1 || (monedasComps.size === 1 && !monedasComps.has(moneda))) {
    advertencias.push(
      "Hay comparables en distinta moneda que la tasación; unificá la moneda para un cálculo correcto."
    );
  }

  const candidatos = enriquecidos.filter(
    (c) => c.incluido !== false && c.precio_m2 != null && c.precio_m2 > 0
  );

  const sujeto = {
    superficie_interior,
    superficie_exterior,
    superficie,
  };
  const subjEquiv = m2Equivalentes(sujeto, coef);
  const cochera = num(cocheraValor) || 0;
  const extras = num(ajusteExtrasPct) || 0;

  if (candidatos.length === 0) {
    advertencias.push("No hay comparables válidos con precio y superficie.");
    return {
      precio_m2_referencia: null,
      valor_min: null,
      valor_probable: null,
      valor_max: null,
      superficie_equivalente: subjEquiv || null,
      valor_cochera: cochera,
      comparables: enriquecidos,
      stats: { n_total: comparables.length, n_usados: 0 },
      advertencias,
    };
  }

  // 2. Ajuste por comparable + outliers por IQR.
  const ajustados = candidatos.map((c) => ({
    ref: c,
    v: c.precio_m2 * (1 + (num(c.ajuste_pct) || 0)),
  }));
  const valores = ajustados.map((a) => a.v);
  const q1 = cuantil(valores, 0.25);
  const q3 = cuantil(valores, 0.75);
  const iqr = q3 - q1;
  const limInf = q1 - 1.5 * iqr;
  const limSup = q3 + 1.5 * iqr;
  const aplicaIqr = candidatos.length >= 4;

  const usados = [];
  for (const a of ajustados) {
    const esOut = aplicaIqr && (a.v < limInf || a.v > limSup);
    a.ref.es_outlier = esOut;
    if (!esOut) {
      a.ref.usado = true;
      usados.push(a.v);
    }
  }
  if (usados.length === 0) {
    ajustados.forEach((a) => {
      a.ref.usado = true;
      a.ref.es_outlier = false;
      usados.push(a.v);
    });
  }

  // 3. Precio/m² de referencia = mediana de los ajustados usados.
  const precio_m2_referencia = mediana(usados);

  // 4. Valor.
  let valor_min = null;
  let valor_probable = null;
  let valor_max = null;

  if (subjEquiv && subjEquiv > 0) {
    const m = Math.max(0, Math.min(num(margenNegociacion) || 0, 0.5));
    const vivienda = precio_m2_referencia * subjEquiv * (1 + extras);
    valor_probable = redondear(vivienda + cochera);
    valor_min = redondear(vivienda * (1 - m) + cochera);
    valor_max = redondear(vivienda * (1 + m) + cochera);
  } else {
    advertencias.push(
      "Falta la superficie del inmueble tasado: se calcula el precio/m² pero no el valor total."
    );
  }

  if (usados.length < 3) {
    advertencias.push(
      `Solo ${usados.length} comparable(s) usados: la tasación es orientativa. Sumá más para mayor confianza.`
    );
  }
  if (extras !== 0) {
    advertencias.push(
      `Ajuste por amenities/estado aplicado: ${extras > 0 ? "+" : ""}${Math.round(extras * 100)}%.`
    );
  }

  return {
    precio_m2_referencia: precio_m2_referencia ? Math.round(precio_m2_referencia) : null,
    valor_min,
    valor_probable,
    valor_max,
    superficie_equivalente: subjEquiv ? Math.round(subjEquiv * 10) / 10 : null,
    valor_cochera: cochera,
    comparables: enriquecidos,
    stats: {
      n_total: comparables.length,
      n_usados: usados.length,
      p25_m2: q1 ? Math.round(q1) : null,
      p75_m2: q3 ? Math.round(q3) : null,
      min_m2: Math.round(Math.min(...valores)),
      max_m2: Math.round(Math.max(...valores)),
    },
    advertencias,
  };
}
