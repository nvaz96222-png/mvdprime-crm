import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadOpcionesProyecto } from "@/lib/data/proyectos";
import ProyectoForm from "@/components/proyectos/ProyectoForm";
import TipologiasEditor from "@/components/proyectos/TipologiasEditor";
import ProyectoLeadsPanel from "@/components/proyectos/ProyectoLeadsPanel";
import { PROYECTO_ESTADO_MAP, PROYECTO_TIPO_MAP } from "@/lib/constants";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "info",       label: "Información" },
  { id: "tipologias", label: "Tipologías" },
  { id: "documentos", label: "Documentos" },
  { id: "fotos",      label: "Fotos" },
  { id: "leads",      label: "Leads" },
];

export default async function EditarProyectoPage({ params, searchParams }) {
  const supabase = createClient();
  const tab = TABS.some((t) => t.id === searchParams.tab) ? searchParams.tab : "info";

  const { data: proyecto, error } = await supabase
    .from("proyectos")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">No se pudo cargar el proyecto.</p>
        <p className="mt-1">{error.message}</p>
      </div>
    );
  }
  if (!proyecto) notFound();

  // Queries por tab — carga lazy según pestaña activa
  const [
    fotosResult,
    documentosResult,
    tipologiasResult,
    agentesResult,
    leadsResult,
  ] = await Promise.all([
    tab === "fotos"
      ? supabase
          .from("proyecto_fotos")
          .select("id, url, storage_path, tipo, es_principal, orden, nombre")
          .eq("proyecto_id", params.id)
          .order("orden")
      : Promise.resolve({ data: null }),
    tab === "documentos"
      ? supabase
          .from("proyecto_documentos")
          .select("id, url, nombre, tipo, tamano_bytes")
          .eq("proyecto_id", params.id)
      : Promise.resolve({ data: null }),
    tab === "tipologias"
      ? supabase
          .from("proyecto_tipologias")
          .select(
            "id, nombre, dormitorios, superficie_desde, superficie_hasta, precio_desde, precio_hasta, moneda, unidades_total, unidades_disponibles, orden"
          )
          .eq("proyecto_id", params.id)
          .order("orden")
      : Promise.resolve({ data: null }),
    tab === "info"
      ? loadOpcionesProyecto(supabase)
      : Promise.resolve({ agentes: [] }),
    tab === "leads"
      ? supabase
          .from("leads")
          .select(
            "id, etapa, created_at, contacto:contactos(nombre, telefono), agente:usuarios(nombre)"
          )
          .eq("proyecto_id", params.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  // Contar leads para badge — siempre
  const { count: leadsCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("proyecto_id", params.id);

  const fotos = fotosResult.data;
  const documentos = documentosResult.data;
  const tipologias = tipologiasResult.data;
  const { agentes } = agentesResult;
  const leads = leadsResult.data;

  const estado = PROYECTO_ESTADO_MAP[proyecto.estado];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/proyectos" className="text-sm text-slate-500 hover:text-accent">
          ← Volver a proyectos
        </Link>
        <div className="mt-1 flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-navy">{proyecto.nombre}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {PROYECTO_TIPO_MAP[proyecto.tipo]}
              {proyecto.barrio ? ` · ${proyecto.barrio}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {estado && (
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${estado.badge}`}>
                {estado.label}
              </span>
            )}
            {proyecto.slug && (
              <Link
                href={`/desarrollos/${proyecto.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-500 hover:border-accent hover:text-accent"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Ver portal
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/proyectos/${params.id}/editar?tab=${t.id}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-navy shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.id === "leads" && (leadsCount ?? 0) > 0 && (
              <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">
                {leadsCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── Tab: Información ─────────────────────────────────── */}
      {tab === "info" && (
        <ProyectoForm proyecto={proyecto} agentes={agentes} />
      )}

      {/* ── Tab: Tipologías ──────────────────────────────────── */}
      {tab === "tipologias" && (
        <TipologiasEditor
          proyectoId={params.id}
          monedaProyecto={proyecto.moneda || "USD"}
          tipologiasIniciales={tipologias || []}
        />
      )}

      {/* ── Tab: Documentos ──────────────────────────────────── */}
      {tab === "documentos" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Documentos sincronizados desde Drive
          </h2>
          {documentos?.length > 0 ? (
            <ul className="space-y-2">
              {documentos.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="shrink-0 text-red-500"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="flex-1 text-sm text-slate-700">{d.nombre}</span>
                  {d.tamano_bytes && (
                    <span className="text-xs text-slate-400">
                      {(d.tamano_bytes / 1024 / 1024).toFixed(1)} MB
                    </span>
                  )}
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Ver
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              No hay documentos sincronizados.
            </p>
          )}
          <p className="mt-4 text-xs text-slate-400">
            Los documentos se gestionan desde Google Drive. Ejecutá{" "}
            <code className="rounded bg-slate-100 px-1">npm run sync-projects</code> para
            actualizar.
          </p>
        </div>
      )}

      {/* ── Tab: Fotos ───────────────────────────────────────── */}
      {tab === "fotos" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Fotos sincronizadas desde Drive ({fotos?.length ?? 0})
          </h2>
          {fotos?.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {fotos.map((f) => (
                <div
                  key={f.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-slate-100"
                >
                  <img
                    src={f.url}
                    alt={f.nombre || "Foto"}
                    className="h-full w-full object-cover"
                  />
                  {f.es_principal && (
                    <span className="absolute bottom-1 left-1 rounded bg-accent px-1 text-[9px] text-white">
                      Principal
                    </span>
                  )}
                  {f.tipo === "render" && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] text-white">
                      Render
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              No hay fotos sincronizadas.
            </p>
          )}
          <p className="mt-4 text-xs text-slate-400">
            Las fotos se gestionan desde Google Drive. Ejecutá{" "}
            <code className="rounded bg-slate-100 px-1">npm run sync-projects</code> para
            actualizar.
          </p>
        </div>
      )}

      {/* ── Tab: Leads ───────────────────────────────────────── */}
      {tab === "leads" && (
        <ProyectoLeadsPanel leads={leads || []} proyectoId={params.id} />
      )}
    </div>
  );
}
