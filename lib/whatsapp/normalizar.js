// =====================================================================
// Normalización de los webhooks de WhatsApp Cloud API → filas de wa_mensajes.
//
// Bajo Coexistence llegan TRES formas de payload distintas, no una:
//
//   messages            mensajes que nos escriben los clientes      → entrante
//   smb_message_echoes  lo que el equipo escribe desde el celular   → saliente
//   history             sincronización inicial (hasta 180 días)     → ambas
//
// Meta documenta en detalle solo el primero. Por eso este módulo es
// deliberadamente tolerante: prueba varias formas conocidas, deduce la
// dirección comparando contra el número del negocio, y nunca tira una
// excepción por un campo que no reconoce. El payload crudo queda en
// wa_eventos_log, así que cualquier forma nueva se puede reprocesar.
//
// De multimedia se guardan SOLO metadatos. Nada se descarga.
// =====================================================================

const CAMPOS_CONOCIDOS = new Set(["messages", "smb_message_echoes", "history"]);

// Tipos que traen un objeto media con { id, mime_type, filename?, caption? }.
const TIPOS_MEDIA = new Set(["image", "video", "audio", "document", "sticker", "voice"]);

function soloDigitos(valor) {
  return valor ? String(valor).replace(/\D/g, "") : null;
}

function aISO(timestamp) {
  const segundos = Number(timestamp);
  if (!Number.isFinite(segundos) || segundos <= 0) return new Date().toISOString();
  return new Date(segundos * 1000).toISOString();
}

// Extrae tipo, texto y metadatos de multimedia de un objeto message de Meta.
function extraerContenido(m) {
  const tipo = m?.type || "unknown";
  const salida = {
    tipo,
    texto: null,
    media_id: null,
    media_mime: null,
    media_filename: null,
    respondiendo_a: m?.context?.id || null,
    meta: null,
  };

  if (Array.isArray(m?.errors) && m.errors.length) {
    salida.tipo = "unsupported";
    salida.texto = m.errors[0]?.title || null;
    salida.meta = { errores: m.errors };
    return salida;
  }

  if (TIPOS_MEDIA.has(tipo)) {
    const media = m[tipo] || {};
    salida.media_id = media.id || null;
    salida.media_mime = media.mime_type || null;
    salida.media_filename = media.filename || null;
    salida.texto = media.caption || null;
    return salida;
  }

  switch (tipo) {
    case "text":
      salida.texto = m.text?.body ?? null;
      break;

    case "location": {
      const l = m.location || {};
      salida.texto =
        [l.name, l.address].filter(Boolean).join(" — ") ||
        (l.latitude ? `Ubicación ${l.latitude}, ${l.longitude}` : null);
      break;
    }

    case "contacts":
      salida.texto =
        (m.contacts || [])
          .map((c) => c?.name?.formatted_name)
          .filter(Boolean)
          .join(", ") || null;
      break;

    // Respuesta a un botón de plantilla.
    case "button":
      salida.texto = m.button?.text || null;
      break;

    // Respuesta a botones o listas interactivas.
    case "interactive": {
      const i = m.interactive || {};
      const r = i.button_reply || i.list_reply || {};
      salida.texto = [r.title, r.description].filter(Boolean).join(" — ") || null;
      break;
    }

    case "reaction":
      salida.texto = m.reaction?.emoji || null;
      salida.respondiendo_a = m.reaction?.message_id || salida.respondiendo_a;
      break;

    case "order":
      salida.texto = m.order?.text || null;
      break;

    case "system":
      salida.texto = m.system?.body || null;
      break;

    default:
      // Tipo que todavía no conocemos: guardamos el crudo para poder
      // agregarle soporte después sin haber perdido el mensaje.
      salida.meta = { crudo: m };
      break;
  }

  return salida;
}

/**
 * Convierte un objeto message de Meta en una fila de wa_mensajes.
 * `direccion` puede venir forzada (echoes) o deducirse del número del negocio.
 */
function aFila(m, { direccionForzada, origen, telefonoNegocio, perfiles, waIdFallback }) {
  if (!m?.id) return null;

  const de = soloDigitos(m.from);
  const para = soloDigitos(m.to || m.recipient_id);

  let direccion = direccionForzada;
  if (!direccion) {
    // Si el remitente es nuestro propio número, el mensaje es saliente.
    if (de && telefonoNegocio && de === telefonoNegocio) direccion = "saliente";
    else if (!de && para) direccion = "saliente";
    else direccion = "entrante";
  }

  // wa_id = SIEMPRE el número del cliente (la contraparte), nunca el nuestro.
  let waId = direccion === "saliente" ? para : de;
  if (waId && telefonoNegocio && waId === telefonoNegocio) {
    waId = direccion === "saliente" ? de : para;
  }
  waId = waId || soloDigitos(waIdFallback);
  if (!waId) return null;

  const contenido = extraerContenido(m);

  return {
    wa_message_id: m.id,
    wa_id: waId,
    nombre_perfil: perfiles?.[waId] || null,
    direccion,
    origen,
    ts: aISO(m.timestamp),
    ...contenido,
  };
}

// contacts[] → { wa_id: nombre }
function mapaPerfiles(contacts) {
  const mapa = {};
  for (const c of contacts || []) {
    const id = soloDigitos(c?.wa_id);
    if (id && c?.profile?.name) mapa[id] = c.profile.name;
  }
  return mapa;
}

/**
 * Normaliza un webhook completo.
 *
 * @param {object} body  El body ya parseado del POST de Meta.
 * @param {{ guardarEstados?: boolean }} opciones
 * @returns {{ mensajes: object[], estados: object[], campos: string[], ignorados: string[] }}
 */
export function normalizarWebhook(body, { guardarEstados = false } = {}) {
  const salida = { mensajes: [], estados: [], campos: [], ignorados: [] };

  for (const entry of body?.entry || []) {
    for (const cambio of entry?.changes || []) {
      const campo = cambio?.field;
      const value = cambio?.value || {};
      if (campo && !salida.campos.includes(campo)) salida.campos.push(campo);

      if (!CAMPOS_CONOCIDOS.has(campo)) {
        if (campo && !salida.ignorados.includes(campo)) salida.ignorados.push(campo);
        continue;
      }

      const telefonoNegocio = soloDigitos(value?.metadata?.display_phone_number);
      const perfiles = mapaPerfiles(value?.contacts);
      const primerContacto = Object.keys(perfiles)[0] || null;

      // ── Entrantes ──────────────────────────────────────────────────
      if (campo === "messages") {
        for (const m of value.messages || []) {
          const fila = aFila(m, {
            direccionForzada: "entrante",
            origen: "api",
            telefonoNegocio,
            perfiles,
            waIdFallback: primerContacto,
          });
          if (fila) salida.mensajes.push(fila);
        }

        // Estados de entrega: solo si se activaron explícitamente.
        if (guardarEstados) {
          for (const s of value.statuses || []) {
            if (!s?.id) continue;
            salida.estados.push({ wa_message_id: s.id, estado: s.status || null });
          }
        }
        continue;
      }

      // ── Salientes escritos desde la app del celular ────────────────
      if (campo === "smb_message_echoes") {
        // Meta no publica el nombre exacto del array; probamos los dos
        // que aparecen en la práctica.
        const lista = value.message_echoes || value.messages || [];
        for (const m of lista) {
          const fila = aFila(m, {
            direccionForzada: "saliente",
            origen: "app_echo",
            telefonoNegocio,
            perfiles,
            waIdFallback: primerContacto,
          });
          if (fila) salida.mensajes.push(fila);
        }
        continue;
      }

      // ── Sincronización de historial ────────────────────────────────
      if (campo === "history") {
        for (const bloque of value.history || []) {
          const perfilesBloque = { ...perfiles, ...mapaPerfiles(bloque?.contacts) };
          for (const hilo of bloque?.threads || []) {
            for (const m of hilo?.messages || []) {
              const fila = aFila(m, {
                // Acá la dirección NO viene dada: se deduce comparando
                // el remitente con nuestro propio número.
                direccionForzada: null,
                origen: "historial",
                telefonoNegocio,
                perfiles: perfilesBloque,
                waIdFallback: hilo?.id || primerContacto,
              });
              if (fila) salida.mensajes.push(fila);
            }
          }
        }
      }
    }
  }

  return salida;
}

/**
 * Descarta mensajes fuera de la ventana de retención.
 * El historial de Coexistence trae 180 días, el doble de lo que guardamos:
 * sin este filtro cargaríamos datos que la purga borraría al día siguiente.
 */
export function dentroDeRetencion(mensajes, dias) {
  const corte = Date.now() - dias * 24 * 60 * 60 * 1000;
  return mensajes.filter((m) => new Date(m.ts).getTime() >= corte);
}
