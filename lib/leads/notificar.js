// =====================================================================
// Notificación instantánea de lead nuevo — avisa al agente por email.
//
// En inmobiliaria, contactar en los primeros minutos multiplica la
// conversión. Cada lead que entra por cualquier canal dispara un aviso.
//
// Envío vía Resend (API REST, sin dependencia npm — solo fetch).
// Requiere env RESEND_API_KEY. Sin la clave, hace no-op y loguea:
// nunca rompe la ingesta (el lead ya quedó guardado antes de llamar acá).
// =====================================================================

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Resolvemos a quién avisar: el agente asignado, o los admins si no hay.
async function destinatarios(supabase, agente_id) {
  if (agente_id) {
    const { data } = await supabase
      .from("usuarios")
      .select("email")
      .eq("id", agente_id)
      .maybeSingle();
    if (data?.email) return [data.email];
  }
  // Sin agente asignado → avisar a los admins.
  const { data: admins } = await supabase
    .from("usuarios")
    .select("email")
    .eq("rol", "admin");
  return (admins || []).map((u) => u.email).filter(Boolean);
}

function armarEmail({ nombre, telefono, email, mensaje, propiedad_titulo, origen, canal, lead_id }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mvdprime.uy";
  const linkLead = `${siteUrl}/leads/${lead_id}`;

  const filas = [
    ["Nombre", nombre],
    ["Teléfono", telefono],
    ["Email", email],
    ["Propiedad", propiedad_titulo],
    ["Origen", origen],
    ["Canal", canal],
    ["Mensaje", mensaje],
  ]
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px;vertical-align:top">${k}</td><td style="padding:4px 0;color:#1e293b;font-size:13px">${String(v).replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto">
    <div style="background:#0D7377;padding:20px 24px;border-radius:8px 8px 0 0">
      <p style="margin:0;color:#fff;font-size:18px;font-weight:600">🔔 Nuevo lead</p>
      <p style="margin:4px 0 0;color:#b8e0e2;font-size:13px">Contactá cuanto antes — los primeros minutos son clave.</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px 24px">
      <table style="width:100%;border-collapse:collapse">${filas}</table>
      <a href="${linkLead}" style="display:inline-block;margin-top:18px;background:#1A2B4A;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600">Ver lead en el CRM</a>
    </div>
  </div>`;

  const texto = [
    "Nuevo lead",
    nombre && `Nombre: ${nombre}`,
    telefono && `Teléfono: ${telefono}`,
    email && `Email: ${email}`,
    propiedad_titulo && `Propiedad: ${propiedad_titulo}`,
    origen && `Origen: ${origen}`,
    mensaje && `Mensaje: ${mensaje}`,
    `Ver en el CRM: ${linkLead}`,
  ]
    .filter(Boolean)
    .join("\n");

  const asunto = `🔔 Nuevo lead: ${nombre || "sin nombre"}${propiedad_titulo ? ` — ${propiedad_titulo}` : ""}`;

  return { html, texto, asunto };
}

/**
 * Envía el aviso de lead nuevo. No lanza: cualquier error se loguea y
 * se traga, porque el lead ya está persistido y la notificación es best-effort.
 *
 * @returns {Promise<{ ok: boolean, motivo?: string }>}
 */
export async function notificarNuevoLead(supabase, datos) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[notificar] RESEND_API_KEY ausente — se omite el aviso por email");
      return { ok: false, motivo: "sin_api_key" };
    }

    const to = await destinatarios(supabase, datos.agente_id);
    if (to.length === 0) {
      console.warn("[notificar] sin destinatarios (ni agente ni admins con email)");
      return { ok: false, motivo: "sin_destinatarios" };
    }

    const { html, texto, asunto } = armarEmail(datos);
    const from = process.env.RESEND_FROM || "MVDPrime <onboarding@resend.dev>";

    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject: asunto, html, text: texto }),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error(`[notificar] Resend ${res.status}:`, detalle);
      return { ok: false, motivo: `resend_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[notificar]", err?.message || err);
    return { ok: false, motivo: "excepcion" };
  }
}
