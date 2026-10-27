// =====================================================================
// Verificación de la firma de los webhooks de Meta.
//
// Meta firma cada POST con HMAC-SHA256 del body CRUDO usando el App Secret,
// en el header X-Hub-Signature-256: "sha256=<hex>".
//
// Importante: hay que firmar el body TAL CUAL llega (bytes crudos), no el
// JSON reparseado — por eso la route lee request.text() antes de JSON.parse.
// La comparación es en tiempo constante (crypto.timingSafeEqual).
// =====================================================================

import crypto from "crypto";

/**
 * Valida X-Hub-Signature-256 contra el body crudo.
 * @param {string} rawBody  cuerpo tal como llegó (string)
 * @param {string|null} firmaHeader  valor de X-Hub-Signature-256
 * @param {string} appSecret  META_APP_SECRET
 * @returns {boolean}
 */
export function firmaValida(rawBody, firmaHeader, appSecret) {
  if (!appSecret || !firmaHeader || !firmaHeader.startsWith("sha256=")) {
    return false;
  }

  const esperado = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const recibido = firmaHeader.slice("sha256=".length);

  // timingSafeEqual exige buffers del mismo largo.
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(recibido, "hex");
  if (a.length !== b.length) return false;

  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
