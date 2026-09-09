// =====================================================================
// Validación de las peticiones del webhook de WhatsApp.
//
// Meta firma cada POST con HMAC-SHA256 sobre el CUERPO CRUDO usando el
// App Secret de la app de Meta, y lo manda en X-Hub-Signature-256.
//
// ⚠️ La firma se calcula sobre los bytes exactos que mandó Meta. Hay que
// leer el body con `await request.text()` y validar ANTES de parsear.
// Si se hace JSON.parse + JSON.stringify el hash no coincide nunca.
// =====================================================================

import crypto from "node:crypto";

/**
 * Verifica la firma HMAC-SHA256 de un webhook de Meta.
 *
 * @param {string} cuerpoCrudo  El body tal cual llegó (request.text()).
 * @param {string|null} cabecera Valor del header X-Hub-Signature-256 ("sha256=<hex>").
 * @param {string|null} secreto  WHATSAPP_APP_SECRET.
 * @returns {boolean} true solo si la firma es válida.
 */
export function verificarFirma(cuerpoCrudo, cabecera, secreto) {
  if (!secreto || !cabecera || typeof cuerpoCrudo !== "string") return false;

  const [algoritmo, hashRecibido] = String(cabecera).split("=");
  if (algoritmo !== "sha256" || !hashRecibido) return false;

  const hashEsperado = crypto
    .createHmac("sha256", secreto)
    .update(cuerpoCrudo, "utf8")
    .digest("hex");

  const esperado = Buffer.from(hashEsperado, "hex");
  const recibido = Buffer.from(hashRecibido, "hex");

  // timingSafeEqual exige mismo largo; un hex inválido da un buffer corto.
  if (esperado.length !== recibido.length || esperado.length === 0) return false;

  return crypto.timingSafeEqual(esperado, recibido);
}

/**
 * Resuelve el handshake GET de verificación del webhook.
 * Meta llama una sola vez con hub.mode / hub.verify_token / hub.challenge.
 *
 * @param {URLSearchParams} params  request.nextUrl.searchParams
 * @param {string|null} verifyToken WHATSAPP_VERIFY_TOKEN
 * @returns {string|null} El challenge a devolver en texto plano, o null si no valida.
 */
export function resolverHandshake(params, verifyToken) {
  if (!verifyToken) return null;
  const modo = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (modo !== "subscribe" || token !== verifyToken || !challenge) return null;
  return challenge;
}
