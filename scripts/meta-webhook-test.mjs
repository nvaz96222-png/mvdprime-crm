// =====================================================================
// Pruebas del webhook de Meta con payloads simulados y firma HMAC.
//
// Uso:
//   node scripts/meta-webhook-test.mjs [baseUrl]
//   (baseUrl por defecto: http://localhost:3000)
//
// Lee META_APP_SECRET y META_VERIFY_TOKEN de .env.local.
// Cubre: verificación GET, firma inválida, formulario instantáneo,
// 1er WhatsApp desde anuncio, mensaje con lead abierto, eco de la app,
// estado de entrega, DM de Instagram y reenvío duplicado (idempotencia).
//
// Nota: el caso "formulario instantáneo" llama a la Graph API para leer el
// lead real; con un leadgen_id ficticio, el server lo registra como error en
// lead_ingesta_log (esperado). Para una prueba end-to-end de Lead Ads usá el
// Lead Ads Testing Tool de Meta (ver docs/meta-setup.md).
// =====================================================================

import crypto from "crypto";
import fs from "fs";

const BASE = process.argv[2] || "http://localhost:3000";
const URL_WEBHOOK = `${BASE}/api/meta/webhook`;

// --- cargar secretos de .env.local ---
function envLocal(key) {
  try {
    const txt = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    return (txt.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1] || "").trim();
  } catch {
    return "";
  }
}
const APP_SECRET = process.env.META_APP_SECRET || envLocal("META_APP_SECRET");
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || envLocal("META_VERIFY_TOKEN");

if (!APP_SECRET) {
  console.error("Falta META_APP_SECRET (en env o .env.local).");
  process.exit(1);
}

function firmar(raw) {
  return "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw, "utf8").digest("hex");
}

let okCount = 0, failCount = 0;
async function post(nombre, body, { firmaOk = true, esperado = 200 } = {}) {
  const raw = JSON.stringify(body);
  const firma = firmaOk ? firmar(raw) : "sha256=deadbeef";
  const res = await fetch(URL_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": firma },
    body: raw,
  });
  const txt = await res.text();
  const ok = res.status === esperado;
  console.log(`${ok ? "✓" : "✗"} ${nombre} → ${res.status} ${txt.slice(0, 80)}`);
  ok ? okCount++ : failCount++;
}

// --- payloads ---
const WA = "59899000777";
const IG = "17841400000000999";

const waMsg = (id, text, extra = {}) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp",
    metadata: { phone_number_id: "PNID" },
    contacts: [{ wa_id: WA, profile: { name: "Cliente Test" } }],
    messages: [{ from: WA, id, timestamp: "1700000000", type: "text", text: { body: text }, ...extra }],
  } }] }],
});

async function main() {
  console.log(`Webhook: ${URL_WEBHOOK}\n`);

  // 1. Verificación GET
  if (VERIFY_TOKEN) {
    const u = `${URL_WEBHOOK}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY_TOKEN)}&hub.challenge=12345`;
    const r = await fetch(u);
    const t = await r.text();
    const ok = r.status === 200 && t === "12345";
    console.log(`${ok ? "✓" : "✗"} GET verificación → ${r.status} "${t}"`);
    ok ? okCount++ : failCount++;
  } else {
    console.log("· GET verificación omitida (sin META_VERIFY_TOKEN)");
  }

  // 2. Firma inválida → 401
  await post("Firma inválida (401)", waMsg("wamid.INVALID", "hola"), { firmaOk: false, esperado: 401 });

  // 3. Formulario instantáneo (Lead Ads)
  await post("Lead Ads (leadgen)", {
    object: "page",
    entry: [{ id: "PAGE", changes: [{ field: "leadgen", value: {
      leadgen_id: "TEST_LEADGEN_1", ad_id: "AD_TEST_1", form_id: "FORM_1", created_time: 1700000000,
    } }] }],
  });

  // 4. Primer WhatsApp desde un anuncio (Click-to-WhatsApp, trae referral)
  await post("WhatsApp 1er msg desde anuncio", waMsg("wamid.AD1", "Hola, vi el aviso", {
    referral: { source_type: "ad", source_id: "AD_TEST_1", ctwa_clid: "CLID123", headline: "Apto Pocitos" },
  }));

  // 5. Mensaje de un contacto con lead abierto (mismo número, otro id)
  await post("WhatsApp msg con lead abierto", waMsg("wamid.AD2", "¿Sigue disponible?"));

  // 6. Eco de la app del celular (saliente, autor app)
  await post("Eco de la app (coexistencia)", {
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "smb_message_echoes", value: {
      messaging_product: "whatsapp",
      message_echoes: [{ id: "wamid.ECHO1", from: "59890000000", to: WA, timestamp: "1700000100", type: "text", text: { body: "Sí, disponible" } }],
    } }] }],
  });

  // 7. Estado de entrega
  await post("Estado de entrega", {
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { phone_number_id: "PNID" },
      statuses: [{ id: "wamid.ECHO1", status: "delivered", timestamp: "1700000200", recipient_id: WA }],
    } }] }],
  });

  // 8. DM de Instagram
  await post("Instagram DM", {
    object: "instagram",
    entry: [{ id: "IGPAGE", messaging: [{
      sender: { id: IG }, recipient: { id: "IGBIZ" }, timestamp: 1700000300,
      message: { mid: "ig.MID1", text: "Hola, info del depto?" },
    }] }],
  });

  // 9. Reenvío duplicado (mismo wamid) → NO debe duplicar el mensaje
  await post("Reenvío duplicado (idempotencia)", waMsg("wamid.AD1", "Hola, vi el aviso", {
    referral: { source_type: "ad", source_id: "AD_TEST_1", ctwa_clid: "CLID123" },
  }));

  console.log(`\nResultado: ${okCount} ok, ${failCount} fallidos`);
  console.log("Verificá en la DB: 1 contacto por WA, 1 lead (no duplicado), mensajes sin repetir wamid.AD1,");
  console.log("y el eco/estado aplicados. Revisá lead_ingesta_log (canal 'meta') para los errores esperados.");
}

main().catch((e) => { console.error(e); process.exit(1); });
