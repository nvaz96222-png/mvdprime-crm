// =====================================================================
// Normalización de teléfonos (Uruguay) — una sola regla para todo el CRM.
//
// Problema que resuelve: los formularios web y la carga manual guardan el
// teléfono como se escribió ("099 123 456", "099123456"), mientras que
// WhatsApp lo manda en formato internacional ("59899123456"). Comparados
// como texto no coinciden, y se duplicaban contactos/leads.
//
// Regla (formato canónico = solo dígitos, con 598 para Uruguay):
//   "+598 99 123 456" / "0059899123456" / "59899123456" → "59899123456"
//   "099 123 456" / "099123456"                         → "59899123456"
//   "99123456"                                          → "59899123456"
//   "2400 1234" (fijo)                                  → "59824001234"
//   otros internacionales (10+ dígitos)                 → se dejan igual
//
// ⚠️ La función SQL public.normalizar_telefono()
// (supabase/migrations/20261029_telefono_normalizado.sql) implementa
// EXACTAMENTE la misma regla para la columna contactos.telefono_norm.
// Si se cambia una, hay que cambiar la otra.
// =====================================================================

/**
 * @param {string|null|undefined} telefono
 * @returns {string|null} dígitos en formato canónico, o null si no hay dígitos
 */
export function normalizarTelefono(telefono) {
  if (!telefono) return null;
  let d = String(telefono).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2); // prefijo internacional 00
  if (d.startsWith("598")) return d;
  if (d.startsWith("09") && d.length === 9) return "598" + d.slice(1);
  if (d.startsWith("9") && d.length === 8) return "598" + d;
  if (d.length >= 10) return d;
  return "598" + d;
}

/**
 * Formas en que un mismo número uruguayo puede estar guardado como texto
 * en registros viejos. Se usa solo como respaldo si la columna
 * telefono_norm todavía no existe (migración pendiente).
 */
function variantesTexto(telefono) {
  const norm = normalizarTelefono(telefono);
  const crudo = telefono ? String(telefono).trim().replace(/\s/g, "") : null;
  const set = new Set([norm, crudo].filter(Boolean));
  if (norm?.startsWith("598")) {
    const local = norm.slice(3); // 99123456
    set.add(local);
    if (local.startsWith("9")) set.add("0" + local); // 099123456
    set.add("+" + norm);
  }
  return [...set];
}

/**
 * Busca un contacto por teléfono sin importar el formato en que se guardó.
 * Usa contactos.telefono_norm (columna generada); si la migración aún no
 * corrió, cae a comparar las variantes de texto más comunes.
 *
 * @param {object} supabase  cliente (admin en server)
 * @param {string} telefono
 * @param {string} [campos="id"]  columnas a devolver
 * @returns {Promise<object|null>} el contacto más antiguo que coincide
 */
export async function buscarContactoPorTelefono(supabase, telefono, campos = "id") {
  const norm = normalizarTelefono(telefono);
  if (!norm) return null;

  const { data, error } = await supabase
    .from("contactos")
    .select(campos)
    .eq("telefono_norm", norm)
    .order("created_at", { ascending: true })
    .limit(1);
  if (!error) return data?.[0] || null;

  // Respaldo: columna telefono_norm inexistente (migración no aplicada).
  const { data: porTexto } = await supabase
    .from("contactos")
    .select(campos)
    .in("telefono", variantesTexto(telefono))
    .order("created_at", { ascending: true })
    .limit(1);
  return porTexto?.[0] || null;
}
