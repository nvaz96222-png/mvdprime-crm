// =====================================================================
// Aviso por email cuando el agente IA deriva una conversación a una
// persona. Mismo mecanismo que lib/leads/notificar.js (Resend por fetch).
// Best-effort: nunca lanza. Push de la PWA llega en la Fase 2b.
// =====================================================================

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function destinatarios(admin, conv) {
  const id = conv.asignado_a || null;
  if (id) {
    const { data } = await admin.from("usuarios").select("email").eq("id", id).maybeSingle();
    if (data?.email) return [data.email];
  }
  if (conv.lead_id) {
    const { data: lead } = await admin.from("leads").select("agente_id").eq("id", conv.lead_id).maybeSingle();
    if (lead?.agente_id) {
      const { data } = await admin.from("usuarios").select("email").eq("id", lead.agente_id).maybeSingle();
      if (data?.email) return [data.email];
    }
  }
  const { data: admins } = await admin.from("usuarios").select("email").eq("rol", "admin");
  return (admins || []).map((u) => u.email).filter(Boolean);
}

export async function avisarDerivacion(admin, { conv, contacto, motivo }) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !conv) return { ok: false, motivo: "sin_api_key" };
    const to = await destinatarios(admin, conv);
    if (!to.length) return { ok: false, motivo: "sin_destinatarios" };
    const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://mvdprime.uy").replace(/\/$/, "");
    const link = `${base}/chats?c=${conv.id}`;
    const nombre = contacto?.nombre || "Cliente";
    const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto">
    <div style="background:#1A2B4A;padding:18px 24px;border-radius:8px 8px 0 0">
      <p style="margin:0;color:#fff;font-size:17px;font-weight:600">El agente IA te pasó una conversación</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:18px 24px;font-size:14px;color:#1e293b">
      <p style="margin:0 0 6px"><strong>${esc(nombre)}</strong></p>
      <p style="margin:0 0 14px;color:#475569">Motivo: ${esc(motivo)}</p>
      <a href="${link}" style="display:inline-block;background:#0D7377;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">Abrir el chat</a>
    </div>
  </div>`;
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "MVDPrime <onboarding@resend.dev>",
        to,
        subject: `Atender: ${nombre} — ${motivo}`.slice(0, 150),
        html,
        text: `El agente IA te pasó una conversación.\n${nombre}\nMotivo: ${motivo}\nAbrir: ${link}`,
      }),
    });
    return { ok: res.ok };
  } catch (e) {
    console.error("[ia:avisar]", e?.message || e);
    return { ok: false, motivo: "excepcion" };
  }
}
