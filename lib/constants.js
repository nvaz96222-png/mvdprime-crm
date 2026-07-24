// Constantes del dominio inmobiliario (Uruguay).
// Los `value` coinciden EXACTAMENTE con los CHECK constraints de la base.

// --- PROPIEDADES ---
export const TIPOS = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "local", label: "Local" },
  { value: "terreno", label: "Terreno" },
  { value: "garage", label: "Garage" },
];

export const OPERACIONES = [
  { value: "venta", label: "Venta" },
  { value: "alquiler", label: "Alquiler" },
];

export const TIPO_MAP = Object.fromEntries(TIPOS.map((t) => [t.value, t.label]));
export const OPERACION_MAP = Object.fromEntries(
  OPERACIONES.map((o) => [o.value, o.label])
);

export const MONEDAS = ["USD", "UYU"];

export const ESTADOS = [
  { value: "disponible", label: "Disponible", badge: "bg-green-100 text-green-700", dot: "bg-green-500" },
  { value: "reservado", label: "Reservado", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { value: "vendido", label: "Vendido", badge: "bg-slate-200 text-slate-700", dot: "bg-slate-500" },
  { value: "alquilado", label: "Alquilado", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { value: "retirado", label: "Retirado", badge: "bg-red-100 text-red-700", dot: "bg-red-500" },
];
export const ESTADO_MAP = Object.fromEntries(ESTADOS.map((e) => [e.value, e]));

// --- LEADS ---
export const LEAD_ETAPAS = [
  { value: "nuevo", label: "Nuevo", color: "bg-sky-500" },
  { value: "calificado", label: "Calificado", color: "bg-indigo-500" },
  { value: "visita", label: "Visita", color: "bg-violet-500" },
  { value: "propuesta", label: "Propuesta", color: "bg-amber-500" },
  { value: "cierre", label: "Cierre", color: "bg-green-500" },
  { value: "perdido", label: "Perdido", color: "bg-red-500" },
];
export const LEAD_ETAPA_MAP = Object.fromEntries(
  LEAD_ETAPAS.map((e) => [e.value, e])
);

export const LEAD_PRIORIDADES = [
  { value: "alta", label: "Alta", badge: "bg-red-100 text-red-700" },
  { value: "media", label: "Media", badge: "bg-amber-100 text-amber-700" },
  { value: "baja", label: "Baja", badge: "bg-slate-100 text-slate-600" },
];

// Origen de leads / fuente de contactos (mismos valores en la base).
export const ORIGENES = [
  { value: "mercadolibre", label: "MercadoLibre" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "infocasas", label: "InfoCasas" },
  { value: "gallito", label: "Gallito" },
  { value: "referido", label: "Referido" },
  { value: "directo", label: "Directo" },
  { value: "web", label: "Web" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "otro", label: "Otro" },
];

// --- CONTACTOS ---
export const CONTACTO_INTERESES = [
  { value: "compra", label: "Comprar" },
  { value: "alquiler", label: "Alquilar" },
  { value: "vender", label: "Vender" },
  { value: "rentar", label: "Rentar" },
  { value: "ambos", label: "Ambos" },
];

// --- INTERACCIONES ---
export const INTERACCION_TIPOS = [
  { value: "llamada", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "visita", label: "Visita" },
  { value: "nota", label: "Nota" },
  { value: "otro", label: "Otro" },
];

// --- USUARIOS ---
export const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "agente", label: "Agente" },
];

export const DEPARTAMENTOS = [
  "Montevideo",
  "Canelones",
  "Maldonado",
  "Colonia",
  "Rocha",
  "San José",
  "Salto",
  "Paysandú",
  "Soriano",
  "Florida",
  "Lavalleja",
  "Durazno",
  "Tacuarembó",
  "Rivera",
  "Artigas",
  "Cerro Largo",
  "Treinta y Tres",
  "Flores",
  "Río Negro",
];

// Bucket de Supabase Storage para las fotos de propiedades.
export const BUCKET_FOTOS = "propiedades";

// --- PROYECTOS ---
// Valores coinciden exactamente con los CHECK constraints de la migración.
export const PROYECTO_TIPOS = [
  { value: "edificio",             label: "Edificio" },
  { value: "casa_en_pozo",         label: "Casa en pozo" },
  { value: "urbanizacion",         label: "Urbanización" },
  { value: "complejo_comercial",   label: "Complejo comercial" },
  { value: "local_comercial",      label: "Local comercial" },
  { value: "otro",                 label: "Otro" },
];
export const PROYECTO_TIPO_MAP = Object.fromEntries(
  PROYECTO_TIPOS.map((t) => [t.value, t.label])
);

export const PROYECTO_ESTADOS = [
  { value: "en_comercializacion", label: "En comercialización", badge: "bg-green-100 text-green-700",  dot: "bg-green-500" },
  { value: "proximamente",        label: "Próximamente",        badge: "bg-sky-100 text-sky-700",      dot: "bg-sky-500" },
  { value: "en_obra",             label: "En obra",             badge: "bg-amber-100 text-amber-700",  dot: "bg-amber-500" },
  { value: "pausado",             label: "Pausado",             badge: "bg-slate-200 text-slate-600",  dot: "bg-slate-400" },
  { value: "entregado",           label: "Entregado",           badge: "bg-indigo-100 text-indigo-700",dot: "bg-indigo-500" },
  { value: "cancelado",           label: "Cancelado",           badge: "bg-red-100 text-red-700",      dot: "bg-red-500" },
];
export const PROYECTO_ESTADO_MAP = Object.fromEntries(
  PROYECTO_ESTADOS.map((e) => [e.value, e])
);

export const PROYECTO_AMENITIES = [
  { value: "piscina",               label: "Piscina" },
  { value: "gimnasio",              label: "Gimnasio" },
  { value: "salon_fiestas",         label: "Salón de fiestas" },
  { value: "parrillero",            label: "Parrillero" },
  { value: "terraza_comun",         label: "Terraza común" },
  { value: "rooftop",               label: "Rooftop" },
  { value: "seguridad_24h",         label: "Seguridad 24h" },
  { value: "cochera",               label: "Cochera" },
  { value: "bodega",                label: "Bodega" },
  { value: "coworking",             label: "Coworking" },
  { value: "spa",                   label: "Spa" },
  { value: "juegos_infantiles",     label: "Juegos infantiles" },
  { value: "pet_friendly",          label: "Pet friendly" },
  { value: "acceso_discapacitados", label: "Acceso para discapacitados" },
  { value: "lavadero",              label: "Lavadero" },
  { value: "bicicletero",           label: "Bicicletero" },
];

// --- TASACIONES ---
// Valores coinciden exactamente con los CHECK constraints de la migración
// 20260724_tasaciones.sql.
export const TASACION_TIPOS = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa",        label: "Casa" },
  { value: "local",       label: "Local" },
  { value: "terreno",     label: "Terreno" },
  { value: "garage",      label: "Garage" },
  { value: "otro",        label: "Otro" },
];
export const TASACION_TIPO_MAP = Object.fromEntries(
  TASACION_TIPOS.map((t) => [t.value, t.label])
);

export const TASACION_ESTADOS = [
  { value: "borrador",   label: "Borrador",   badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { value: "finalizada", label: "Finalizada", badge: "bg-green-100 text-green-700", dot: "bg-green-500" },
];
export const TASACION_ESTADO_MAP = Object.fromEntries(
  TASACION_ESTADOS.map((e) => [e.value, e])
);

export const TASACION_METODOS = [
  { value: "comparativo", label: "Comparativo de mercado" },
  { value: "costo",       label: "Costo / reposición" },
  { value: "renta",       label: "Capitalización de renta" },
];
export const TASACION_METODO_MAP = Object.fromEntries(
  TASACION_METODOS.map((m) => [m.value, m.label])
);

export const COMPARABLE_FUENTES = [
  { value: "mercadolibre",      label: "Mercado Libre" },
  { value: "infocasas",         label: "InfoCasas" },
  { value: "gallito",           label: "Gallito" },
  { value: "inventario_propio", label: "Inventario propio" },
  { value: "manual",            label: "Manual" },
  { value: "otro",              label: "Otro" },
];
export const COMPARABLE_FUENTE_MAP = Object.fromEntries(
  COMPARABLE_FUENTES.map((f) => [f.value, f.label])
);
