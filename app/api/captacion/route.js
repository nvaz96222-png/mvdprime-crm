import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { contextoDeRequest } from "@/lib/leads/ingesta";
import { notificarNuevoLead } from "@/lib/leads/notificar";
import { TIPO_MAP } from "@/lib/constants";

// POST /api/captacion — ficha pública de captación que completa el propietario.
// Ruta pública (ver APIS_PUBLICAS en lib/supabase/middleware.js).
//
// Crea (o reutiliza por teléfono) el PROPIETARIO y una PROPIEDAD en borrador
// por cada operación pedida (venta y/o alquiler), con estado "retirado" y
// publicar_web=false: no se ve en ningún lado hasta que el agente la revisa,
// completa fotos y la pasa a "disponible". Todo queda en lead_ingesta_log
// (canal "captacion") para trazabilidad.

const TIPOS_VALIDOS = new Set(Object.keys(TIPO_MAP));
const DEPARTAMENTOS_OK = 40;

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function txt(v, max = 500) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function siNo(v) {
  if (v === true || v === "si") return "Sí";
  if (v === false || v === "no") return "No";
  return null;
}

export async function POST(request) {
  const supabase = createAdminClient();
  let logId = null;

  try {
    const body = await request.json();
    if (body._hp) return NextResponse.json({ ok: true }); // honeypot

    const d = {
      nombre: txt(body.nombre, 120),
      telefono: txt(body.telefono, 30),
      email: txt(body.email, 200)?.toLowerCase() || null,
      operacion: ["venta", "alquiler", "ambas"].includes(body.operacion) ? body.operacion : null,
      tipo: TIPOS_VALIDOS.has(body.tipo) ? body.tipo : "apartamento",
      direccion: txt(body.direccion, 200),
      barrio: txt(body.barrio, 80),
      departamento: txt(body.departamento, DEPARTAMENTOS_OK) || "Montevideo",
      piso: txt(body.piso, 20),
      dormitorios: num(body.dormitorios),
      banos: num(body.banos),
      detalle_banos: txt(body.detalle_banos, 200),
      cocheras: num(body.cocheras),
      m2_interiores: num(body.m2_interiores),
      m2_exteriores: num(body.m2_exteriores),
      amueblado: body.amueblado,
      mascotas: body.mascotas,
      precio_venta: num(body.precio_venta),
      moneda_venta: body.moneda_venta === "UYU" ? "UYU" : "USD",
      precio_alquiler: num(body.precio_alquiler),
      moneda_alquiler: body.moneda_alquiler === "USD" ? "USD" : "UYU",
      gastos_comunes: num(body.gastos_comunes),
      disponibilidad: txt(body.disponibilidad, 120),
      garantias: txt(body.garantias, 200),
      diferenciales: txt(body.diferenciales, 2000),
      link_material: txt(body.link_material, 500),
      exclusividad: body.exclusividad,
      autoriza: body.autoriza === true,
    };

    // 0) Log ANTES de validar — nada se pierde.
    const ctx = contextoDeRequest(request);
    const { data: logRow } = await supabase
      .from("lead_ingesta_log")
      .insert({
        canal: "captacion",
        estado: "recibido",
        payload: d,
        ip: ctx?.ip || null,
        user_agent: ctx?.user_agent || null,
        referer: ctx?.referer || null,
      })
      .select("id")
      .single();
    logId = logRow?.id || null;

    // 1) Validación
    const faltan = [];
    if (!d.nombre) faltan.push("nombre");
    if (!d.telefono) faltan.push("teléfono");
    if (!d.operacion) faltan.push("operación");
    if (!d.direccion && !d.barrio) faltan.push("dirección o barrio");
    if (!d.autoriza) faltan.push("autorización");
    if (faltan.length) {
      if (logId)
        await supabase.from("lead_ingesta_log").update({
          estado: "invalido", paso_fallido: "validacion", error: `Faltan: ${faltan.join(", ")}`,
        }).eq("id", logId);
      return NextResponse.json({ error: `Faltan datos: ${faltan.join(", ")}` }, { status: 400 });
    }

    // 2) Propietario — dedupe por teléfono (sin espacios).
    const telNorm = d.telefono.replace(/\s+/g, "");
    let propietarioId = null;
    const { data: existentes } = await supabase
      .from("propietarios")
      .select("id, telefono")
      .not("telefono", "is", null);
    const match = (existentes || []).find(
      (p) => (p.telefono || "").replace(/\s+/g, "") === telNorm
    );
    if (match) {
      propietarioId = match.id;
    } else {
      const { data: nuevo, error: errProp } = await supabase
        .from("propietarios")
        .insert({
          nombre: d.nombre,
          telefono: d.telefono,
          email: d.email,
          notas: `Alta desde ficha de captación web (${new Date().toLocaleDateString("es-UY")})`,
        })
        .select("id")
        .single();
      if (errProp) throw Object.assign(new Error(errProp.message), { paso: "contacto" });
      propietarioId = nuevo.id;
    }

    // 3) Propiedad(es) en borrador.
    const m2Int = d.m2_interiores;
    const m2Tot = m2Int !== null || d.m2_exteriores !== null
      ? (m2Int || 0) + (d.m2_exteriores || 0)
      : null;

    const ficha = [
      "📋 FICHA DE CAPTACIÓN (completada por el propietario)",
      `Propietario: ${d.nombre} · ${d.telefono}${d.email ? ` · ${d.email}` : ""}`,
      d.direccion && `Dirección: ${d.direccion}`,
      d.piso && `Piso: ${d.piso}`,
      d.detalle_banos && `Baños: ${d.detalle_banos}`,
      d.cocheras !== null && `Cocheras: ${d.cocheras}`,
      m2Int !== null && `Interiores: ${m2Int} m²`,
      d.m2_exteriores !== null && `Terraza/balcón/patio: ${d.m2_exteriores} m²`,
      siNo(d.amueblado) && `Amueblado: ${siNo(d.amueblado)}`,
      siNo(d.mascotas) && `Acepta mascotas: ${siNo(d.mascotas)}`,
      d.gastos_comunes !== null && `Gastos comunes: $ ${d.gastos_comunes.toLocaleString("es-UY")}`,
      d.precio_venta !== null && `Precio venta: ${d.moneda_venta} ${d.precio_venta.toLocaleString("es-UY")}`,
      d.precio_alquiler !== null && `Precio alquiler: ${d.moneda_alquiler} ${d.precio_alquiler.toLocaleString("es-UY")}/mes`,
      d.disponibilidad && `Disponibilidad: ${d.disponibilidad}`,
      d.garantias && `Garantías: ${d.garantias}`,
      siNo(d.exclusividad) && `Exclusividad con MVD Prime: ${siNo(d.exclusividad)}`,
      d.link_material && `Fotos/video: ${d.link_material}`,
      d.diferenciales && `\nLo que destaca el propietario:\n${d.diferenciales}`,
      "\n⚠️ Borrador: revisar, cargar fotos y pasar a Disponible para publicar.",
    ].filter(Boolean).join("\n");

    const operaciones = d.operacion === "ambas" ? ["venta", "alquiler"] : [d.operacion];
    const tipoLabel = TIPO_MAP[d.tipo] || "Propiedad";
    const dormLabel = d.dormitorios ? ` ${d.dormitorios} dorm.` : "";
    const ubic = d.barrio || d.direccion;

    const creadas = [];
    for (const op of operaciones) {
      const esVenta = op === "venta";
      const { data: prop, error: errP } = await supabase
        .from("propiedades")
        .insert({
          titulo: `[Captación] ${tipoLabel}${dormLabel} en ${esVenta ? "venta" : "alquiler"} – ${ubic}`.slice(0, 200),
          tipo: d.tipo,
          operacion: op,
          estado: "retirado",
          precio: esVenta ? d.precio_venta : d.precio_alquiler,
          moneda: esVenta ? d.moneda_venta : d.moneda_alquiler,
          descripcion: ficha,
          propietario_id: propietarioId,
          direccion: d.direccion,
          barrio: d.barrio,
          departamento: d.departamento,
          dormitorios: d.dormitorios,
          banos: d.banos,
          superficie_total: m2Tot,
          superficie_cubierta: m2Int,
          amueblado: d.amueblado === true || d.amueblado === "si",
          acepta_mascotas: d.mascotas === true || d.mascotas === "si",
          parking: (d.cocheras || 0) > 0,
          publicar_web: false,
          publicar_ml: false,
          publicar_infocasas: false,
        })
        .select("id, titulo")
        .single();
      if (errP) throw Object.assign(new Error(errP.message), { paso: "lead" });
      creadas.push(prop);
    }

    // 4) Log OK
    if (logId)
      await supabase.from("lead_ingesta_log").update({
        estado: "ok",
        procesado_at: new Date().toISOString(),
        payload: { ...d, propietario_id: propietarioId, propiedades: creadas.map((p) => p.id) },
      }).eq("id", logId);

    // 5) Aviso por email (best-effort, no bloquea).
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mvdprime-crm.vercel.app";
    await notificarNuevoLead(supabase, {
      nombre: d.nombre,
      telefono: d.telefono,
      email: d.email,
      mensaje: ficha,
      propiedad_titulo: creadas.map((p) => p.titulo).join(" / "),
      origen: "captación",
      canal: "ficha de captación",
      link: `${siteUrl}/propiedades/${creadas[0].id}`,
      titulo: "🏠 Nueva captación",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[captacion]", err);
    if (logId)
      await supabase.from("lead_ingesta_log").update({
        estado: "error", paso_fallido: err.paso || "desconocido", error: String(err.message || err),
      }).eq("id", logId);
    return NextResponse.json({ error: "Error interno. Probá de nuevo o escribinos por WhatsApp." }, { status: 500 });
  }
}
