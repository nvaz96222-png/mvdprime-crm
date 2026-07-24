// =====================================================================
// Motor de tasación por método comparativo de mercado (MCM).
//
// Lógica pura (sin DB, sin red): recibe el inmueble y sus comparables,
// devuelve el rango de valor. Testeable en aislamiento.
//
// Idea: cada comparable aporta un precio/m². Se descartan outliers por
// IQR, se toma la mediana de los que quedan como precio/m² de referencia,
// y se arma un rango con el margen de negociación (los comparables son
// precios de PUBLICACIÓN, no de cierre).
// =====================================================================

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

// Redondea a la centena más cercana (montos de tasación no van al peso).
function redondear(n) {
  if (n == null) return null;
  return Math.round(n / 100) * 100;
}

/**
 * Calcula precio/m² ajustado de un comparable.
 * ajuste_pct ajusta el $/m² del comparable hacia el inmueble tasado:
 * negativo si el comparable es MEJOR (su precio sobreestima al tasado).
 */
export function precioM2Comparable(comp) {
  const precio = Number(comp.precio);
  const sup = Number(comp.superficie);
  if (!precio || !sup || sup <= 0) return null;
  const ajuste = Number(comp.ajuste_pct) || 0;
  return (precio / sup) * (1 + ajuste);
}

/**
 * Motor principal.
 *
 * @param {object} params
 *   superficie          - m² del inmueble a tasar (para pasar $/m² a valor)
 *   comparables         - [{ precio, superficie, moneda, ajuste_pct, incluido }]
 *   margenNegociacion   - fracción (default 0.08 = 8%)
 *   moneda              - moneda de la tasación (para chequear consistencia)
 *
 * @returns {{
 *   precio_m2_referencia, valor_min, valor_probable, valor_max,
 *   comparables,  // cada uno con { precio_m2, es_outlier, usado }
 *   stats,        // { n_total, n_usados, p25_m2, p75_m2, min_m2, max_m2 }
 *   advertencias  // string[]
 * }}
 */
export function calcularTasacion({
  superficie,
  comparables = [],
  margenNegociacion = 0.08,
  moneda = "USD",
} = {}) {
  const advertencias = [];

  // 1. Precio/m² por comparable (solo los incluidos y con datos válidos).
  const enriquecidos = comparables.map((c) => {
    const precio_m2 = precioM2Comparable(c);
    return { ...c, precio_m2, usado: false, es_outlier: false };
  });

  // Aviso por monedas mezcladas (v1 no convierte; el agente las unifica).
  const monedasComps = new Set(
    comparables.map((c) => c.moneda).filter(Boolean)
  );
  if (monedasComps.size > 1 || (monedasComps.size === 1 && !monedasComps.has(moneda))) {
    advertencias.push(
      "Hay comparables en distinta moneda que la tasación; unificá la moneda para un cálculo correcto."
    );
  }

  const candidatos = enriquecidos.filter(
    (c) => c.incluido !== false && c.precio_m2 != null && c.precio_m2 > 0
  );

  if (candidatos.length === 0) {
    advertencias.push("No hay comparables válidos con precio y superficie.");
    return {
      precio_m2_referencia: null,
      valor_min: null,
      valor_probable: null,
      valor_max: null,
      comparables: enriquecidos,
      stats: { n_total: comparables.length, n_usados: 0 },
      advertencias,
    };
  }

  // 2. Detección de outliers por IQR sobre el $/m² de los candidatos.
  const valores = candidatos.map((c) => c.precio_m2);
  const q1 = cuantil(valores, 0.25);
  const q3 = cuantil(valores, 0.75);
  const iqr = q3 - q1;
  const limInf = q1 - 1.5 * iqr;
  const limSup = q3 + 1.5 * iqr;

  // Con pocos comparables el IQR no es confiable: solo marcamos outliers
  // si hay al menos 4 (con 3 o menos, todos cuentan).
  const aplicaIqr = candidatos.length >= 4;

  const usados = [];
  for (const c of candidatos) {
    const esOut = aplicaIqr && (c.precio_m2 < limInf || c.precio_m2 > limSup);
    c.es_outlier = esOut;
    if (!esOut) {
      c.usado = true;
      usados.push(c.precio_m2);
    }
  }

  if (usados.length === 0) {
    // Todos quedaron marcados outlier (raro): usar todos los candidatos.
    candidatos.forEach((c) => {
      c.usado = true;
      c.es_outlier = false;
      usados.push(c.precio_m2);
    });
  }

  // 3. Precio/m² de referencia = mediana de los usados.
  const precio_m2_referencia = mediana(usados);

  // 4. Valor: solo si tenemos la superficie del inmueble tasado.
  const sup = Number(superficie);
  let valor_min = null;
  let valor_probable = null;
  let valor_max = null;

  if (sup && sup > 0) {
    const m = Math.max(0, Math.min(Number(margenNegociacion) || 0, 0.5));
    valor_probable = redondear(precio_m2_referencia * sup);
    valor_min = redondear(precio_m2_referencia * sup * (1 - m));
    valor_max = redondear(precio_m2_referencia * sup * (1 + m));
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

  return {
    precio_m2_referencia: precio_m2_referencia
      ? Math.round(precio_m2_referencia)
      : null,
    valor_min,
    valor_probable,
    valor_max,
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
