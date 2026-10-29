// =====================================================================
// Pruebas de normalizarTelefono() (lib/telefono.js).
//
// Uso:  node scripts/telefono-test.mjs
//
// Si cambiás la regla, actualizá también public.normalizar_telefono()
// en supabase/migrations/20261029_telefono_normalizado.sql y corré la
// SECCIÓN 2 (verificación) de esa migración: debe dar los mismos valores.
// =====================================================================

import { normalizarTelefono } from "../lib/telefono.js";

const casos = [
  ["099 123 456", "59899123456"],      // web / carga manual
  ["099123456", "59899123456"],
  ["99123456", "59899123456"],         // sin el 0
  ["59899123456", "59899123456"],      // WhatsApp
  ["+598 99 123 456", "59899123456"],
  ["0059899123456", "59899123456"],    // prefijo internacional 00
  ["(099) 12 34 56", "59899123456"],
  ["098-765-432", "59898765432"],
  ["2400 1234", "59824001234"],        // fijo de Montevideo
  ["+54 9 11 1234 5678", "5491112345678"], // Argentina, se deja igual
  ["+1 (415) 555-0172", "14155550172"],
  ["", null],
  [null, null],
  ["sin número", null],
];

let fallas = 0;
for (const [entrada, esperado] of casos) {
  const obtenido = normalizarTelefono(entrada);
  const ok = obtenido === esperado;
  if (!ok) fallas++;
  console.log(`${ok ? "✔" : "✘"} ${JSON.stringify(entrada)} → ${obtenido}${ok ? "" : ` (esperado ${esperado})`}`);
}
console.log(fallas ? `\n${fallas} falla(s)` : `\n${casos.length} casos OK`);
process.exit(fallas ? 1 : 0);
