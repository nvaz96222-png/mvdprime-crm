import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  LEAD_ETAPAS,
  LEAD_ETAPA_MAP,
  ESTADOS,
  ESTADO_MAP,
  INTERACCION_TIPOS,
} from "@/lib/constants";
import { formatFecha, formatFechaHora } from "@/lib/format";

export const dynamic = "force-dynamic";

const TIPO_INT_MAP = Object.fromEntries(
  INTERACCION_TIPOS.map((t) => [t.value, t.label])
);
const TIPO_ICON = {
  llamada: "📞",
  whatsapp: "💬",
  email: "✉️",
  visita: "🏠",
  nota: "📝",
  otro: "•",
};
const ETAPAS_ACTIVAS = LEAD_ETAPAS.map((e) => e.value).filter(
  (v) => v !== "perdido" && v !== "cierre"
);

export default async function DashboardPage() {
  const supabase = createClient();

  const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: propiedades },
    { data: leads },
    { data: interaccionesRecientes },
    { count: contactosCount },
    { count: proyectosCount },
    { count: proyectosPublicados },
    { count: proyectosDestacados },
    { data: leadsDesarrollosRaw },
    { data: proyectosNombres },
  ] = await Promise.all([
    supabase.from("propiedades").select("estado"),
    supabase
      .from("leads")
      .select(
        "id, etapa, created_at, contacto:contactos(nombre), agente:usuarios(nombre), interacciones(fecha)"
      ),
    supabase
      .from("interacciones")
      .select(
        "id, tipo, descripcion, fecha, usuario:usuarios(nombre), lead:leads(id, contacto:contactos(nombre))"
      )
      .order("fecha", { ascending: false })
      .limit(8),
    supabase.from("contactos").select("*", { count: "exact", head: true }),
    supabase
      .from("proyectos")
      .select("*", { count: "exact", head: true })
      .eq("estado", "en_comercializacion"),
    supabase
      .from("proyectos")
      .select("*", { count: "exact", head: true })
      .eq("publicar_web", true),
    supabase
      .from("proyectos")
      .select("*", { count: "exact", head: true })
      .eq("publicar_web", true)
      .eq("destacado", true),
    // Leads provenientes de desarrollos (últimos 30 días)
    supabase
      .from("leads")
      .select("proyecto_id")
      .not("proyecto_id", "is", null)
      .gte("created_at", hace30dias),
    // Nombres de proyectos para el ranking
    supabase
      .from("proyectos")
      .select("id, nombre, slug")
      .eq("publicar_web", true),
  ]);

  // --- Métricas de propiedades ---
  const propsPorEstado = {};
  for (const p of propiedades || []) {
    propsPorEstado[p.estado] = (propsPorEstado[p.estado] || 0) + 1;
  }
  const disponibles = propsPorEstado["disponible"] || 0;
  const totalPropiedades = (propiedades || []).length;

  // --- Métricas de leads ---
  const leadsPorEtapa = {};
  for (const e of LEAD_ETAPAS) leadsPorEtapa[e.value] = 0;
  for (const l of leads || []) {
    leadsPorEtapa[l.etapa] = (leadsPorEtapa[l.etapa] || 0) + 1;
  }
  const maxEtapa = Math.max(1, ...Object.values(leadsPorEtapa));

  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  const leadsNuevosHoy = (leads || []).filter(
    (l) => new Date(l.created_at) >= inicioHoy
  ).length;
  const leadsActivos = (leads || []).filter((l) =>
    ETAPAS_ACTIVAS.includes(l.etapa)
  ).length;

  // --- Alerta: leads sin contactar hace +3 días ---
  const hace3dias = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const sinContactar = (leads || [])
    .filter((l) => ETAPAS_ACTIVAS.includes(l.etapa))
    .map((l) => {
      const fechas = (l.interacciones || []).map((i) => new Date(i.fecha).getTime());
      const ultima = fechas.length
        ? Math.max(...fechas)
        : new Date(l.created_at).getTime();
      return { ...l, ultimaActividad: ultima };
    })
    .filter((l) => l.ultimaActividad < hace3dias)
    .sort((a, b) => a.ultimaActividad - b.ultimaActividad)
    .map((l) => ({
      ...l,
      dias: Math.floor((Date.now() - l.ultimaActividad) / (24 * 60 * 60 * 1000)),
    }));

  // --- Ranking proyectos por leads (todos los tiempos) ---
  const proyectoMap = Object.fromEntries(
    (proyectosNombres || []).map((p) => [p.id, p])
  );
  const leadsDesarrollos30 = leadsDesarrollosRaw || [];
  const rankingMap = {};
  for (const l of leadsDesarrollos30) {
    rankingMap[l.proyecto_id] = (rankingMap[l.proyecto_id] || 0) + 1;
  }
  const ranking = Object.entries(rankingMap)
    .map(([id, count]) => ({ ...proyectoMap[id], count }))
    .filter((p) => p.nombre)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const leadsDesarrollosTotal = leadsDesarrollos30.length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
      <p className="mt-0.5 text-sm text-slate-500">Resumen de la operación</p>

      {/* KPIs — Operación */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Propiedades disponibles"
          valor={disponibles}
          sub={`de ${totalPropiedades} en total`}
          color="text-green-600"
          href="/propiedades?estado=disponible"
        />
        <StatCard
          label="Leads nuevos hoy"
          valor={leadsNuevosHoy}
          sub="creados hoy"
          color="text-accent"
          href="/leads"
        />
        <StatCard
          label="Leads activos"
          valor={leadsActivos}
          sub="en el pipeline"
          color="text-navy"
          href="/leads"
        />
        <StatCard
          label="Contactos"
          valor={contactosCount ?? 0}
          sub="en la base"
          color="text-navy"
          href="/contactos"
        />
        <StatCard
          label="Proyectos activos"
          valor={proyectosCount ?? 0}
          sub="en comercialización"
          color="text-accent"
          href="/proyectos?estado=en_comercializacion"
        />
      </div>

      {/* KPIs — Desarrollos */}
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Desarrollos
      </p>
      <div className="mt-2 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Publicados en web"
          valor={proyectosPublicados ?? 0}
          sub="visibles en portal"
          color="text-accent"
          href="/proyectos"
        />
        <StatCard
          label="Destacados"
          valor={proyectosDestacados ?? 0}
          sub="con badge destacado"
          color="text-amber-600"
          href="/proyectos"
        />
        <StatCard
          label="Leads web (30 días)"
          valor={leadsDesarrollosTotal}
          sub="desde formulario web"
          color="text-green-600"
          href="/leads"
        />
      </div>

      {/* Alerta sin contactar */}
      {sinContactar.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <h2 className="font-semibold text-amber-800">
              {sinContactar.length} lead{sinContactar.length === 1 ? "" : "s"} sin
              contactar hace más de 3 días
            </h2>
          </div>
          <ul className="mt-3 divide-y divide-amber-200">
            {sinContactar.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/leads/${l.id}`}
                  className="flex items-center justify-between gap-3 py-2 text-sm transition hover:opacity-80"
                >
                  <span className="font-medium text-amber-900">
                    {l.contacto?.nombre || "Contacto sin nombre"}
                  </span>
                  <span className="flex items-center gap-3 text-amber-700">
                    {l.agente?.nombre && (
                      <span className="hidden sm:inline">{l.agente.nombre}</span>
                    )}
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium">
                      {l.dias} días
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Leads por etapa */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Leads por etapa
          </h2>
          <div className="space-y-3">
            {LEAD_ETAPAS.map((e) => {
              const n = leadsPorEtapa[e.value] || 0;
              return (
                <div key={e.value} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm text-slate-600">
                    {e.label}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className={`h-full ${e.color} transition-all`}
                      style={{ width: `${(n / maxEtapa) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-sm font-medium text-slate-700">
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Propiedades por estado */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Propiedades por estado
          </h2>
          {totalPropiedades === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Todavía no hay propiedades.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {ESTADOS.map((e) => {
                const n = propsPorEstado[e.value] || 0;
                return (
                  <div
                    key={e.value}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${e.dot}`} />
                      {e.label}
                    </span>
                    <span className="text-lg font-bold text-navy">{n}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ranking de desarrollos */}
      {ranking.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Desarrollos con más leads (últimos 30 días)
            </h2>
            <Link
              href="/proyectos"
              className="text-xs font-medium text-accent hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          <div className="space-y-3">
            {ranking.map((p, i) => {
              const pct = Math.round((p.count / ranking[0].count) * 100);
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-sm font-bold text-slate-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/proyectos/${p.id}/editar?tab=leads`}
                      className="block truncate text-sm font-medium text-slate-700 hover:text-accent"
                    >
                      {p.nombre}
                    </Link>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-accent">
                    {p.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actividad reciente */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Actividad reciente
        </h2>
        {interaccionesRecientes?.length ? (
          <ul className="space-y-3">
            {interaccionesRecientes.map((it) => (
              <li key={it.id} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm">
                  {TIPO_ICON[it.tipo] || "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">
                      {TIPO_INT_MAP[it.tipo] || it.tipo}
                    </span>
                    {it.lead?.contacto?.nombre && (
                      <>
                        {" · "}
                        <Link
                          href={`/leads/${it.lead.id}`}
                          className="text-accent hover:underline"
                        >
                          {it.lead.contacto.nombre}
                        </Link>
                      </>
                    )}
                  </p>
                  {it.descripcion && (
                    <p className="truncate text-sm text-slate-500">{it.descripcion}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatFechaHora(it.fecha)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">
            No hay interacciones registradas todavía.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, valor, sub, color, href }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </Link>
  );
}
