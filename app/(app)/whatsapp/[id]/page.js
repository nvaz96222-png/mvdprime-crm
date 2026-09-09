import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function fechaHora(iso) {
  return new Date(iso).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Montevideo",
  });
}

// Los mensajes multimedia guardan solo metadatos: el archivo nunca se descarga.
function cuerpo(m) {
  if (m.texto) return m.texto;
  if (m.media_mime) return `[${m.tipo} · ${m.media_mime}]`;
  return `[${m.tipo}]`;
}

const ORIGEN_ETIQUETA = {
  api: "enviado por el sistema",
  app_echo: "enviado desde el celular",
  historial: "importado del historial",
};

export default async function ConversacionPage({ params }) {
  const supabase = createClient();

  const { data: conversacion } = await supabase
    .from("wa_conversaciones")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!conversacion) notFound();

  const [{ data: mensajes }, { data: contacto }] = await Promise.all([
    supabase
      .from("wa_mensajes")
      .select("id, wa_message_id, ts, direccion, origen, tipo, texto, media_mime, respondiendo_a")
      .eq("conversacion_id", params.id)
      .order("ts", { ascending: true })
      .limit(500),
    conversacion.contacto_id
      ? supabase
          .from("contactos")
          .select("id, nombre, telefono, email")
          .eq("id", conversacion.contacto_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const titulo = conversacion.nombre_perfil || conversacion.telefono || `+${conversacion.wa_id}`;

  return (
    <div>
      <Link href="/whatsapp" className="text-sm text-slate-500 hover:text-accent">
        ← Volver a WhatsApp
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">{titulo}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            +{conversacion.wa_id} · {conversacion.mensajes_count} mensajes guardados
          </p>
        </div>
        <div className="flex items-center gap-2">
          {conversacion.sin_responder && (
            <span className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
              Sin responder
            </span>
          )}
          {contacto ? (
            <Link
              href={`/contactos/${contacto.id}`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ver contacto: {contacto.nombre}
            </Link>
          ) : (
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">
              No vinculado a ningún contacto
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        {(mensajes || []).length === 0 && (
          <p className="text-center text-sm text-slate-500">
            No quedan mensajes guardados de esta conversación.
          </p>
        )}

        {(mensajes || []).map((m) => {
          const esCliente = m.direccion === "entrante";
          return (
            <div key={m.id} className={`flex ${esCliente ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  esCliente ? "bg-slate-100 text-slate-800" : "bg-accent/10 text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{cuerpo(m)}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {esCliente ? "Cliente" : "Empresa"} · {fechaHora(m.ts)}
                  {!esCliente && m.origen !== "api" && ` · ${ORIGEN_ETIQUETA[m.origen] || m.origen}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
