import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ConsultaChat from "@/components/whatsapp/ConsultaChat";
import { credencialesFaltantes, RETENCION_DIAS } from "@/lib/whatsapp/config";

export const dynamic = "force-dynamic";

function fecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Montevideo",
  });
}

function Kpi({ valor, etiqueta, alerta }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className={`text-2xl font-bold ${alerta ? "text-red-600" : "text-navy"}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-slate-500">{etiqueta}</p>
    </div>
  );
}

export default async function WhatsAppPage({ searchParams }) {
  const supabase = createClient();
  const q = searchParams?.q?.trim();
  const soloSinResponder = searchParams?.filtro === "sin_responder";
  const faltantes = credencialesFaltantes();

  const hace7dias = new Date(Date.now() - 7 * 86400000).toISOString();

  let listado = supabase
    .from("wa_conversaciones")
    .select("id, wa_id, telefono, nombre_perfil, contacto_id, sin_responder, mensajes_count, ultimo_mensaje_at, ultimo_entrante_at")
    .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (soloSinResponder) listado = listado.eq("sin_responder", true);
  if (q) {
    const t = q.replace(/[%,]/g, "");
    listado = listado.or(`nombre_perfil.ilike.%${t}%,telefono.ilike.%${t}%,wa_id.ilike.%${t}%`);
  }

  const [{ data: conversaciones, error }, totales, pendientes, recientes] = await Promise.all([
    listado,
    supabase.from("wa_conversaciones").select("*", { count: "exact", head: true }),
    supabase.from("wa_conversaciones").select("*", { count: "exact", head: true }).eq("sin_responder", true),
    supabase.from("wa_mensajes").select("*", { count: "exact", head: true }).gte("ts", hace7dias),
  ]);

  const vacio = (totales.count || 0) === 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">WhatsApp</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Conversaciones de los últimos {RETENCION_DIAS} días. Los mensajes más viejos se
          borran solos.
        </p>
      </div>

      {faltantes.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">Falta configurar la conexión con Meta</p>
          <p className="mt-1 text-amber-800">
            Variables pendientes: <code className="font-mono">{faltantes.join(", ")}</code>. El
            webhook rechaza todo hasta que estén cargadas. Ver{" "}
            <span className="font-mono">docs/whatsapp.md</span>.
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi valor={totales.count ?? "—"} etiqueta="Conversaciones" />
        <Kpi valor={pendientes.count ?? "—"} etiqueta="Sin responder" alerta={(pendientes.count || 0) > 0} />
        <Kpi valor={recientes.count ?? "—"} etiqueta="Mensajes (7 días)" />
      </div>

      <ConsultaChat hayDatos={!vacio} />

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy">Bandeja</h2>
          <div className="flex items-center gap-2">
            <form method="get" className="flex items-center gap-2">
              {soloSinResponder && <input type="hidden" name="filtro" value="sin_responder" />}
              <input
                name="q"
                defaultValue={q || ""}
                placeholder="Buscar nombre o teléfono"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </form>
            <Link
              href={soloSinResponder ? "/whatsapp" : "/whatsapp?filtro=sin_responder"}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                soloSinResponder
                  ? "bg-navy text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Sin responder
            </Link>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            No se pudo leer la bandeja: {error.message}
          </p>
        )}

        {!error && vacio && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-medium text-slate-700">Todavía no llegó ningún mensaje</p>
            <p className="mt-1 text-sm text-slate-500">
              En cuanto el webhook esté dado de alta en Meta, las conversaciones aparecen acá
              solas.
            </p>
          </div>
        )}

        {!error && !vacio && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {(conversaciones || []).length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">
                Ninguna conversación coincide con el filtro.
              </p>
            )}
            {(conversaciones || []).map((c) => (
              <Link
                key={c.id}
                href={`/whatsapp/${c.id}`}
                className="flex items-center justify-between gap-4 border-b border-slate-100 p-4 last:border-0 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-navy">
                    {c.nombre_perfil || c.telefono || `+${c.wa_id}`}
                    {!c.contacto_id && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        (no está en el CRM)
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    +{c.wa_id} · {c.mensajes_count} mensajes · último {fecha(c.ultimo_mensaje_at)}
                  </p>
                </div>
                {c.sin_responder && (
                  <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                    Sin responder
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
