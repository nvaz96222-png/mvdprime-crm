// =====================================================================
// Cliente mínimo de la Graph API de Meta (solo lo que usa la ingesta).
//
// No agrega dependencias: usa fetch. Cada función es best-effort y nunca
// lanza hacia afuera (devuelve null ante error) — el webhook debe seguir
// respondiendo 200 aunque la Graph API falle.
// =====================================================================

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function graphGet(path, params) {
  try {
    const url = new URL(`${GRAPH}/${path}`);
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null) url.searchParams.set(k, v);
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error(`[meta:graph] ${path} → ${res.status}: ${detalle.slice(0, 300)}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[meta:graph] ${path}:`, err?.message || err);
    return null;
  }
}

/**
 * Trae los datos de un lead de formulario instantáneo.
 * @returns {{ field_data, ad_id, campaign_name, created_time } | null}
 */
export async function obtenerLead(leadgenId) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token || !leadgenId) return null;
  return graphGet(leadgenId, {
    access_token: token,
    fields: "field_data,ad_id,ad_name,campaign_id,campaign_name,form_id,created_time",
  });
}

/**
 * Nombre de un usuario de Instagram por su IGSID (si los permisos lo permiten).
 * @returns {string|null}
 */
export async function obtenerNombreInstagram(igsid) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token || !igsid) return null;
  const data = await graphGet(igsid, { access_token: token, fields: "name,username" });
  return data?.name || data?.username || null;
}

/**
 * Mapea field_data de un Lead Ad a campos normalizados.
 * Las preguntas estándar (full_name/phone_number/email) van a sus campos;
 * el resto (preguntas custom) se concatena para las notas del lead.
 */
export function mapearFieldData(fieldData) {
  const out = { nombre: null, telefono: null, email: null, extra: [] };
  for (const campo of fieldData || []) {
    const name = (campo.name || "").toLowerCase();
    const valor = Array.isArray(campo.values) ? campo.values.join(", ") : campo.values;
    if (!valor) continue;
    if (["full_name", "name", "first_name"].includes(name) && !out.nombre) {
      out.nombre = valor;
    } else if (["phone_number", "phone", "telefono"].includes(name)) {
      out.telefono = valor;
    } else if (["email", "correo"].includes(name)) {
      out.email = valor;
    } else {
      out.extra.push(`${campo.name}: ${valor}`);
    }
  }
  return out;
}
