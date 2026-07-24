// =====================================================================
// Cliente de la API de Mercado Libre para publicar propiedades del CRM.
// Server-side ONLY (usa la service_role de Supabase para leer/escribir el
// token OAuth guardado en la tabla `ml_tokens`).
//
// Flujo:
//  1) La conexión inicial (OAuth) la hace la web pública mvdprime.uy y deja
//     el refresh_token en `ml_tokens` (misma base Supabase).
//  2) Acá leemos ese token, lo refrescamos solo si está por vencer, y
//     publicamos/actualizamos/pausamos vía POST/PUT /items.
// =====================================================================

const ML_API = "https://api.mercadolibre.com";

// --- Mapeo (tipo, operación) -> categoría HOJA de Mercado Libre Uruguay ---
// Rama "Inmuebles" (MLU1459). ML exige la categoría hoja (dividida por
// operación). IDs verificados contra la API de categorías 2026-07.
// Venta usa la hoja "Propiedades Individuales" (aptos/casas/terrenos tienen un
// nivel extra que separa reventa de "Emprendimientos"). Alquiler es hoja directa.
const CATEGORIA_MLU = {
  apartamento: { venta: "MLU1474", alquiler: "MLU1473" }, // Apartamentos
  casa: { venta: "MLU1468", alquiler: "MLU1467" }, // Casas
  local: { venta: "MLU1483", alquiler: "MLU1482" }, // Locales
  terreno: { venta: "MLU1495", alquiler: "MLU1494" }, // Terrenos y Lotes
  garage: { venta: "MLU50638", alquiler: "MLU50637" }, // Cocheras
};

function categoriaDe(tipo, operacion) {
  const op = operacion === "alquiler" ? "alquiler" : "venta";
  const porTipo = CATEGORIA_MLU[tipo] || CATEGORIA_MLU.apartamento;
  return porTipo[op];
}

// Tipo de publicación del plan inmobiliario. Puede sobreescribirse por env.
const LISTING_TYPE = process.env.ML_LISTING_TYPE || "gold_premium";

// --- OAuth token endpoint --------------------------------------------------

// Intercambia un authorization code por tokens (usado por el callback).
export async function intercambiarCode(code, redirectUri) {
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri || process.env.ML_REDIRECT_URI,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OAuth token: ${data.message || JSON.stringify(data)}`);
  }
  return data; // { access_token, refresh_token, expires_in, user_id, scope }
}

// Refresca el access_token usando el refresh_token.
async function refrescarToken(refreshToken) {
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Refresh token: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

// Guarda/actualiza el token en la única fila de ml_tokens (id=1).
export async function guardarToken(supabase, data) {
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);
  const { error } = await supabase.from("ml_tokens").upsert({
    id: 1,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt.toISOString(),
    ml_user_id: data.user_id ?? null,
    scope: data.scope ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`No se pudo guardar el token ML: ${error.message}`);
}

// Devuelve un access_token válido, refrescándolo si está vencido/por vencer.
// `supabase` debe ser un cliente con service_role (admin).
export async function getAccessTokenValido(supabase) {
  const { data: row, error } = await supabase
    .from("ml_tokens")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(`Error leyendo ml_tokens: ${error.message}`);
  if (!row) {
    const err = new Error("Mercado Libre no está conectado todavía.");
    err.code = "NOT_CONNECTED";
    throw err;
  }

  const venceEn = new Date(row.expires_at).getTime();
  // Margen de 2 minutos.
  if (venceEn - Date.now() > 120 * 1000) {
    return row.access_token;
  }

  // Refrescar.
  const nuevo = await refrescarToken(row.refresh_token);
  await guardarToken(supabase, nuevo);
  return nuevo.access_token;
}

export async function estaConectado(supabase) {
  const { data } = await supabase
    .from("ml_tokens")
    .select("id, ml_user_id, updated_at")
    .eq("id", 1)
    .maybeSingle();
  return data || null;
}

// --- Construcción del item -------------------------------------------------

function attr(id, valueName) {
  return { id, value_name: String(valueName) };
}

// Arma el payload de un item de Mercado Libre a partir de una propiedad del
// CRM y sus fotos (array de { url }).
export function construirItem(prop, fotos = []) {
  const categoria = categoriaDe(prop.tipo, prop.operacion);
  const operacion = prop.operacion === "alquiler" ? "Alquiler" : "Venta";

  // Las categorías de alquiler exigen: BEDROOMS, FULL_BATHROOMS, PARKING_LOTS,
  // TOTAL_AREA y COVERED_AREA (estas dos con unidad, tipo number_unit).
  const atributos = [attr("OPERATION", operacion)];
  if (prop.dormitorios != null) {
    atributos.push(attr("BEDROOMS", prop.dormitorios));
    atributos.push(attr("ROOMS", prop.dormitorios));
  }
  if (prop.banos != null) atributos.push(attr("FULL_BATHROOMS", prop.banos));
  // PARKING_LOTS es requerido en apto/casa: mapeamos el booleano parking.
  atributos.push(attr("PARKING_LOTS", prop.parking ? 1 : 0));
  if (prop.superficie_total != null)
    atributos.push(attr("TOTAL_AREA", `${prop.superficie_total} m²`));
  if (prop.superficie_cubierta != null)
    atributos.push(attr("COVERED_AREA", `${prop.superficie_cubierta} m²`));

  const pictures = (fotos || [])
    .filter((f) => f?.url)
    .slice(0, 12) // ML permite hasta 12 fotos
    .map((f) => ({ source: f.url }));

  const item = {
    title: (prop.titulo || "Propiedad").slice(0, 60),
    category_id: categoria,
    price: Number(prop.precio),
    currency_id: prop.moneda === "UYU" ? "UYU" : "USD",
    available_quantity: 1,
    buying_mode: "classified",
    listing_type_id: LISTING_TYPE,
    condition: prop.es_obra_nueva ? "new" : "used",
    attributes: atributos,
    pictures,
    location: {
      address_line: prop.direccion || undefined,
      city: { name: prop.barrio || prop.departamento || "Montevideo" },
      state: { name: prop.departamento || "Montevideo" },
      country: { id: "UY", name: "Uruguay" },
    },
  };

  if (prop.descripcion) {
    item.description = { plain_text: prop.descripcion };
  }
  return item;
}

// --- Operaciones sobre items ----------------------------------------------

async function mlFetch(token, path, method, body) {
  const res = await fetch(`${ML_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle =
      data.message ||
      (data.cause && JSON.stringify(data.cause)) ||
      JSON.stringify(data);
    const err = new Error(detalle);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// Publica una propiedad nueva. Devuelve { id, permalink, status }.
export async function publicarItem(supabase, prop, fotos) {
  const token = await getAccessTokenValido(supabase);
  const item = construirItem(prop, fotos);
  const creado = await mlFetch(token, "/items", "POST", item);
  // La descripción va aparte en algunos casos; ML la acepta inline arriba.
  return creado;
}

// Actualiza una publicación existente (precio, estado, atributos).
export async function actualizarItem(supabase, mlItemId, prop, fotos) {
  const token = await getAccessTokenValido(supabase);
  const item = construirItem(prop, fotos);
  // En update no se reenvían category_id ni buying_mode.
  delete item.category_id;
  delete item.buying_mode;
  delete item.listing_type_id;
  delete item.available_quantity;
  return mlFetch(token, `/items/${mlItemId}`, "PUT", item);
}

// Cambia el estado de una publicación: "paused" | "active" | "closed".
export async function cambiarEstadoItem(supabase, mlItemId, status) {
  const token = await getAccessTokenValido(supabase);
  return mlFetch(token, `/items/${mlItemId}`, "PUT", { status });
}

// URL de autorización OAuth (para el botón "Conectar Mercado Libre").
export function urlAutorizacion(state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ML_CLIENT_ID,
    redirect_uri: process.env.ML_REDIRECT_URI,
  });
  if (state) params.set("state", state);
  return `https://auth.mercadolibre.com.uy/authorization?${params}`;
}
