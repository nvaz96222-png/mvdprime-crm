import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PROYECTO_TIPO_MAP,
  PROYECTO_ESTADO_MAP,
  PROYECTO_AMENITIES,
} from "@/lib/constants";
import { formatFecha } from "@/lib/format";
import GaleriaFotos from "@/components/public/GaleriaFotos";
import TipologiaCard from "@/components/proyectos/TipologiaCard";
import FormContactoProyecto from "@/components/public/FormContactoProyecto";
import BtnCompartir from "@/components/public/BtnCompartir";
import DesarrolloCard from "@/components/public/DesarrolloCard";
import BeaconVista from "@/components/public/BeaconVista";
import BtnTrackableLink from "@/components/public/BtnTrackableLink";

export const revalidate = 300; // 5 minutos — contenido del proyecto cambia poco

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mvdprime.uy";
const WHATSAPP_AGENCIA = process.env.NEXT_PUBLIC_WHATSAPP_AGENCIA || "59899000000";
const ESTADOS_PUBLICOS = ["en_comercializacion", "proximamente", "en_obra", "entregado"];

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("proyectos")
    .select("nombre, descripcion, tipo, barrio, departamento, precio_desde, moneda, slug, fotos:proyecto_fotos(url, es_principal, orden)")
    .eq("slug", params.slug)
    .eq("publicar_web", true)
    .maybeSingle();

  if (!data) return { title: "Desarrollo | MVDPrime Real Estate" };

  const ubicacion = [data.barrio, data.departamento].filter(Boolean).join(", ");
  const tipoLabel = PROYECTO_TIPO_MAP[data.tipo] || data.tipo;
  const precioStr = data.precio_desde
    ? ` · Desde ${data.moneda === "UYU" ? "$U" : "US$"} ${Number(data.precio_desde).toLocaleString("es-UY")}`
    : "";

  // Truncar limpiamente sin añadir … si el texto ya termina
  const rawDesc = data.descripcion
    ? (data.descripcion.length > 140 ? `${data.descripcion.slice(0, 137).trimEnd()}…` : data.descripcion)
    : `${tipoLabel} en ${ubicacion}${precioStr}. Consultanos sin compromiso.`;

  const title = `${data.nombre} | MVDPrime Real Estate`;
  const url = `${SITE_URL}/desarrollos/${data.slug}`;

  // Portada para Open Graph / Twitter Card
  const portadaUrl =
    data.fotos?.find((f) => f.es_principal)?.url ||
    data.fotos?.[0]?.url ||
    null;

  return {
    title,
    description: rawDesc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: rawDesc,
      url,
      siteName: "MVDPrime Real Estate",
      type: "website",
      ...(portadaUrl ? { images: [{ url: portadaUrl, width: 1200, height: 630, alt: data.nombre }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: rawDesc,
      ...(portadaUrl ? { images: [portadaUrl] } : {}),
    },
  };
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function DesarrolloDetallePage({ params }) {
  const supabase = createAdminClient();

  // 1. Carga proyecto principal (secuencial — necesitamos el id para el resto)
  const { data: proyecto } = await supabase
    .from("proyectos")
    .select("*, agente:usuarios(id, nombre, email)")
    .eq("slug", params.slug)
    .eq("publicar_web", true)
    .maybeSingle();

  if (!proyecto) notFound();

  // 2. Carga paralela con el id real
  const [
    { data: fotos },
    { data: tipologias },
    { data: documentos },
    { data: relacionados },
  ] = await Promise.all([
    supabase
      .from("proyecto_fotos")
      .select("id, url, es_principal, orden, tipo, nombre")
      .eq("proyecto_id", proyecto.id)
      .order("orden"),
    supabase
      .from("proyecto_tipologias")
      .select("*")
      .eq("proyecto_id", proyecto.id)
      .order("orden"),
    supabase
      .from("proyecto_documentos")
      .select("id, nombre, url, tipo, tamano_bytes")
      .eq("proyecto_id", proyecto.id),
    proyecto.barrio
      ? supabase
          .from("proyectos")
          .select(
            "id, nombre, slug, tipo, estado, barrio, departamento, precio_desde, moneda, destacado, fotos:proyecto_fotos(url, es_principal, orden)"
          )
          .eq("publicar_web", true)
          .in("estado", ESTADOS_PUBLICOS)
          .eq("barrio", proyecto.barrio)
          .neq("id", proyecto.id)
          .limit(3)
      : Promise.resolve({ data: [] }),
  ]);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const portada = fotos?.find((f) => f.es_principal) || fotos?.[0] || null;
  const estado = PROYECTO_ESTADO_MAP[proyecto.estado];
  const tipoLabel = PROYECTO_TIPO_MAP[proyecto.tipo] || proyecto.tipo;
  const ubicacion = [proyecto.barrio, proyecto.departamento].filter(Boolean).join(", ");

  const amenitiesLabels = (proyecto.amenities || [])
    .map((v) => PROYECTO_AMENITIES.find((a) => a.value === v)?.label)
    .filter(Boolean);

  const whatsappMsg = encodeURIComponent(
    `Hola, me interesa el desarrollo *${proyecto.nombre}*. ¿Pueden darme más información?`
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP_AGENCIA}?text=${whatsappMsg}`;

  const pageUrl = `${SITE_URL}/desarrollos/${proyecto.slug}`;

  // ── Schema.org JSON-LD ────────────────────────────────────────────────────
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: proyecto.nombre,
      ...(proyecto.descripcion ? { description: proyecto.descripcion } : {}),
      url: pageUrl,
      ...(portada ? { image: portada.url } : {}),
      ...(proyecto.lat && proyecto.lng
        ? { geo: { "@type": "GeoCoordinates", latitude: proyecto.lat, longitude: proyecto.lng } }
        : {}),
      ...(ubicacion
        ? {
            address: {
              "@type": "PostalAddress",
              addressLocality: proyecto.barrio || proyecto.departamento,
              addressRegion: proyecto.departamento,
              addressCountry: "UY",
            },
          }
        : {}),
      ...(proyecto.precio_desde
        ? {
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: proyecto.moneda || "USD",
              lowPrice: proyecto.precio_desde,
              ...(proyecto.precio_hasta ? { highPrice: proyecto.precio_hasta } : {}),
            },
          }
        : {}),
      seller: {
        "@type": "RealEstateAgent",
        name: "MVDPrime Real Estate",
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Desarrollos", item: `${SITE_URL}/desarrollos` },
        { "@type": "ListItem", position: 3, name: proyecto.nombre, item: pageUrl },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* JSON-LD */}
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-navy shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/desarrollos"
              className="text-sm text-slate-300 transition hover:text-white"
            >
              ← Desarrollos
            </Link>
            <span className="text-slate-600">|</span>
            <span className="text-lg font-bold text-white">
              MVDPrime <span className="text-accent-light">RE</span>
            </span>
          </div>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600"
          >
            <IconWhatsApp />
            Consultar
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Beacon de vista — cliente, silencioso */}
        <BeaconVista proyectoId={proyecto.id} slug={proyecto.slug} />

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm text-slate-400">
          <Link href="/" className="transition hover:text-accent">Inicio</Link>
          <span className="text-slate-300">/</span>
          <Link href="/desarrollos" className="transition hover:text-accent">Desarrollos</Link>
          <span className="text-slate-300">/</span>
          <span className="font-medium text-slate-600">{proyecto.nombre}</span>
        </nav>

        {/* Galería */}
        <GaleriaFotos fotos={fotos || []} titulo={proyecto.nombre} />

        {/* Encabezado */}
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-navy/10 px-3 py-0.5 text-sm font-medium text-navy">
                {tipoLabel}
              </span>
              {proyecto.destacado && (
                <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-semibold text-white">
                  Destacado
                </span>
              )}
              {estado && (
                <span className={`rounded-full px-3 py-0.5 text-sm font-medium ${estado.badge}`}>
                  {estado.label}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-navy sm:text-3xl">
              {proyecto.nombre}
            </h1>
            {ubicacion && (
              <p className="mt-1 flex items-center gap-1.5 text-slate-500">
                <IconPin />
                {ubicacion}
                {proyecto.direccion ? ` · ${proyecto.direccion}` : ""}
              </p>
            )}
          </div>
          {proyecto.precio_desde && (
            <div className="shrink-0 text-right">
              <p className="text-sm text-slate-400">Desde</p>
              <p className="text-2xl font-bold text-accent">
                {proyecto.moneda === "UYU" ? "$U" : "US$"}{" "}
                {Number(proyecto.precio_desde).toLocaleString("es-UY")}
              </p>
              {proyecto.precio_hasta && (
                <p className="text-xs text-slate-400">
                  hasta {proyecto.moneda === "UYU" ? "$U" : "US$"}{" "}
                  {Number(proyecto.precio_hasta).toLocaleString("es-UY")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Métricas */}
        {(proyecto.dormitorios_desde != null ||
          proyecto.superficie_desde != null ||
          proyecto.unidades_total != null ||
          proyecto.desarrollador) && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {proyecto.dormitorios_desde != null && (
              <MetricCard
                icon={<IconBed />}
                value={
                  proyecto.dormitorios_hasta != null &&
                  proyecto.dormitorios_hasta !== proyecto.dormitorios_desde
                    ? `${proyecto.dormitorios_desde}–${proyecto.dormitorios_hasta}`
                    : proyecto.dormitorios_desde
                }
                label="Dormitorios"
              />
            )}
            {proyecto.superficie_desde != null && (
              <MetricCard
                icon={<IconArea />}
                value={
                  proyecto.superficie_hasta != null &&
                  proyecto.superficie_hasta !== proyecto.superficie_desde
                    ? `${proyecto.superficie_desde}–${proyecto.superficie_hasta} m²`
                    : `${proyecto.superficie_desde} m²`
                }
                label="Superficie"
              />
            )}
            {proyecto.unidades_total != null && (
              <MetricCard
                icon={<IconBuilding />}
                value={proyecto.unidades_total}
                label="Unidades totales"
              />
            )}
            {proyecto.desarrollador && (
              <MetricCard
                icon={<IconCompany />}
                value={proyecto.desarrollador}
                label="Desarrolladora"
              />
            )}
          </div>
        )}

        {/* Grid principal */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Columna izquierda */}
          <div className="space-y-6 lg:col-span-2">
            {/* Descripción */}
            {proyecto.descripcion && (
              <Seccion titulo="Descripción">
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {proyecto.descripcion}
                </p>
              </Seccion>
            )}

            {/* Tipologías */}
            {tipologias?.length > 0 && (
              <Seccion titulo={`Tipologías (${tipologias.length})`}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {tipologias.map((t) => (
                    <TipologiaCard key={t.id} tipologia={t} />
                  ))}
                </div>
              </Seccion>
            )}

            {/* Amenities */}
            {amenitiesLabels.length > 0 && (
              <Seccion titulo="Amenities">
                <div className="flex flex-wrap gap-2">
                  {amenitiesLabels.map((a) => (
                    <span
                      key={a}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {a}
                    </span>
                  ))}
                </div>
              </Seccion>
            )}

            {/* Cronograma */}
            {(proyecto.fecha_inicio_obras || proyecto.fecha_entrega_estimada) && (
              <Seccion titulo="Cronograma">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  {proyecto.fecha_inicio_obras && (
                    <div>
                      <dt className="text-xs text-slate-400">Inicio de obras</dt>
                      <dd className="mt-0.5 font-medium text-slate-700">
                        {formatFecha(proyecto.fecha_inicio_obras)}
                      </dd>
                    </div>
                  )}
                  {proyecto.fecha_entrega_estimada && (
                    <div>
                      <dt className="text-xs text-slate-400">Entrega estimada</dt>
                      <dd className="mt-0.5 font-medium text-slate-700">
                        {formatFecha(proyecto.fecha_entrega_estimada)}
                      </dd>
                    </div>
                  )}
                </dl>
              </Seccion>
            )}

            {/* Brochure / documentos */}
            {documentos?.length > 0 && (
              <Seccion titulo="Documentos">
                <ul className="space-y-2">
                  {documentos.map((d) => (
                    <li key={d.id}>
                      <BtnTrackableLink
                        href={d.url}
                        tipo="brochure_click"
                        proyectoId={proyecto.id}
                        slug={proyecto.slug}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-accent/50 hover:shadow-sm"
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
                        <span className="flex-1 font-medium text-slate-700">{d.nombre}</span>
                        {d.tamano_bytes && (
                          <span className="text-xs text-slate-400">
                            {(d.tamano_bytes / 1024 / 1024).toFixed(1)} MB
                          </span>
                        )}
                        <span className="text-xs font-semibold text-accent">Descargar</span>
                      </BtnTrackableLink>
                    </li>
                  ))}
                </ul>
              </Seccion>
            )}

            {/* Ubicación */}
            {(ubicacion || proyecto.lat) && (
              <Seccion titulo="Ubicación">
                {proyecto.direccion && (
                  <p className="mb-3 text-sm text-slate-600">
                    <span className="font-medium">Dirección:</span> {proyecto.direccion}
                    {ubicacion ? `, ${ubicacion}` : ""}
                  </p>
                )}
                {!proyecto.direccion && ubicacion && (
                  <p className="mb-3 text-sm text-slate-600">{ubicacion}</p>
                )}
                {proyecto.lat && proyecto.lng ? (
                  <a
                    href={`https://www.google.com/maps?q=${proyecto.lat},${proyecto.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
                  >
                    <IconPin />
                    Ver en Google Maps
                  </a>
                ) : null}
              </Seccion>
            )}

            {/* Fallback: columna izquierda sin contenido */}
            {!proyecto.descripcion &&
              !tipologias?.length &&
              !amenitiesLabels.length &&
              !proyecto.fecha_inicio_obras &&
              !proyecto.fecha_entrega_estimada &&
              !documentos?.length &&
              !ubicacion &&
              !proyecto.lat && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <p className="text-sm text-slate-400">
                    Próximamente más información sobre este desarrollo.
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Consultanos por WhatsApp para más detalles.
                  </p>
                </div>
              )}
          </div>

          {/* Columna derecha — sticky */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {/* WhatsApp + agente + compartir */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <BtnTrackableLink
                  href={whatsappUrl}
                  tipo="whatsapp_click"
                  proyectoId={proyecto.id}
                  slug={proyecto.slug}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-3 text-sm font-semibold text-white transition hover:bg-green-600"
                >
                  <IconWhatsApp />
                  Consultar por WhatsApp
                </BtnTrackableLink>

                {proyecto.agente?.nombre && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-400">Agente responsable</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-700">
                      {proyecto.agente.nombre}
                    </p>
                  </div>
                )}

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <BtnCompartir
                    titulo={proyecto.nombre}
                    proyectoId={proyecto.id}
                    slug={proyecto.slug}
                  />
                </div>
              </div>

              {/* Formulario de contacto */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <FormContactoProyecto
                  proyectoId={proyecto.id}
                  proyectoNombre={proyecto.nombre}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Relacionados por barrio */}
        {relacionados?.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-5 text-lg font-bold text-navy">
              Otros desarrollos en {proyecto.barrio}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relacionados.map((p) => (
                <DesarrolloCard key={p.id} proyecto={p} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-center">
        <p className="text-lg font-bold text-navy">
          MVDPrime <span className="text-accent">RE</span>
        </p>
        <p className="mt-1 text-sm text-slate-400">Real Estate · Uruguay</p>
        <p className="mt-2 text-xs text-slate-300">
          <Link href="/desarrollos" className="hover:text-accent">
            Ver todos los desarrollos
          </Link>
        </p>
      </footer>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Seccion({ titulo, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-navy">{titulo}</h2>
      {children}
    </div>
  );
}

function MetricCard({ icon, value, label }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-navy">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function IconWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.122 1.528 5.862L0 24l6.336-1.508A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.817 9.817 0 0 1-5.006-1.371l-.359-.213-3.761.896.924-3.659-.235-.378A9.818 9.818 0 0 1 2.182 12c0-5.419 4.399-9.818 9.818-9.818 5.419 0 9.818 4.399 9.818 9.818 0 5.419-4.399 9.818-9.818 9.818z" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconBed() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 4v16M2 8h20a2 2 0 0 1 2 2v10M2 16h20" />
    </svg>
  );
}

function IconArea() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3h4v4H3zM17 3h4v4h-4zM3 17h4v4H3zM17 17h4v4h-4z" />
      <line x1="7" y1="5" x2="17" y2="5" />
      <line x1="7" y1="19" x2="17" y2="19" />
      <line x1="5" y1="7" x2="5" y2="17" />
      <line x1="19" y1="7" x2="19" y2="17" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function IconCompany() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12.01" y2="12" />
    </svg>
  );
}
