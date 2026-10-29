// =====================================================================
// Datos de propiedades que el agente IA puede ver y decir.
//
// SOLO los campos que ya son públicos en la ficha web (/p/[id]). Nunca
// propietario, comisiones, notas internas ni datos de otros clientes.
// =====================================================================

import { TIPO_MAP, OPERACION_MAP } from "@/lib/constants";

export const CAMPOS_PUBLICOS =
  "id, titulo, tipo, operacion, precio, moneda, barrio, departamento, direccion, dormitorios, banos, " +
  "superficie_cubierta, superficie_total, parking, parrillero, piscina, amueblado, acepta_mascotas, " +
  "ano_construccion, es_obra_nueva, descripcion, estado";

const siNo = (v) => (v === true ? "sí" : v === false ? "no" : null);

function precioTexto(precio, moneda) {
  if (precio == null) return null;
  const n = Number(precio);
  if (!Number.isFinite(n)) return null;
  return `${moneda === "UYU" ? "$" : "US$"} ${n.toLocaleString("es-UY")}`;
}

/** Ficha compacta para el contexto del modelo (sin campos vacíos). */
export function fichaParaIA(p, siteUrl) {
  if (!p) return null;
  const f = {
    id: p.id,
    titulo: p.titulo,
    tipo: TIPO_MAP[p.tipo] || p.tipo,
    operacion: OPERACION_MAP[p.operacion] || p.operacion,
    precio: precioTexto(p.precio, p.moneda),
    ubicacion: [p.direccion, p.barrio, p.departamento].filter(Boolean).join(", ") || null,
    dormitorios: p.dormitorios,
    banos: p.banos,
    superficie_cubierta_m2: p.superficie_cubierta,
    superficie_total_m2: p.superficie_total,
    garage_o_parking: siNo(p.parking),
    parrillero: siNo(p.parrillero),
    piscina: siNo(p.piscina),
    amueblado: siNo(p.amueblado),
    acepta_mascotas: siNo(p.acepta_mascotas),
    ano_construccion: p.ano_construccion,
    obra_nueva: siNo(p.es_obra_nueva),
    estado: p.estado,
    descripcion: p.descripcion ? String(p.descripcion).slice(0, 1500) : null,
    link_ficha: siteUrl ? `${siteUrl}/p/${p.id}` : null,
  };
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null && v !== undefined && v !== ""));
}

export async function cargarFichas(supabase, ids, siteUrl) {
  const unicos = [...new Set((ids || []).filter(Boolean))].slice(0, 3);
  if (!unicos.length) return [];
  const { data } = await supabase.from("propiedades").select(CAMPOS_PUBLICOS).in("id", unicos);
  return (data || []).map((p) => fichaParaIA(p, siteUrl));
}

/** Búsqueda de propiedades disponibles para sugerir (máx. 5). */
export async function buscarDisponibles(supabase, filtros = {}, siteUrl) {
  let q = supabase.from("propiedades").select(CAMPOS_PUBLICOS).eq("estado", "disponible");
  if (filtros.operacion === "venta" || filtros.operacion === "alquiler") q = q.eq("operacion", filtros.operacion);
  if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
  if (filtros.barrio) q = q.ilike("barrio", `%${String(filtros.barrio).replace(/[%_]/g, "").slice(0, 60)}%`);
  if (Number.isFinite(Number(filtros.dormitorios_min)) && filtros.dormitorios_min != null) q = q.gte("dormitorios", Number(filtros.dormitorios_min));
  if (Number.isFinite(Number(filtros.precio_max)) && filtros.precio_max != null) {
    q = q.lte("precio", Number(filtros.precio_max));
    if (filtros.moneda === "USD" || filtros.moneda === "UYU") q = q.eq("moneda", filtros.moneda);
  }
  const { data, error } = await q.order("created_at", { ascending: false }).limit(5);
  if (error) return { error: error.message, propiedades: [] };
  return { propiedades: (data || []).map((p) => fichaParaIA(p, siteUrl)) };
}
