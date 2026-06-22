import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrecio } from "@/lib/format";
import { TIPO_MAP, OPERACION_MAP } from "@/lib/constants";
import GaleriaFotos from "@/components/public/GaleriaFotos";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("propiedades")
    .select("titulo, barrio, departamento, precio, moneda, tipo, operacion")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) return { title: "Propiedad | MVDPrime" };

  const ubicacion = [data.barrio, data.departamento].filter(Boolean).join(", ");
  return {
    title: `${data.titulo} | MVDPrime Real Estate`,
    description: `${TIPO_MAP[data.tipo] || data.tipo} en ${ubicacion} — ${formatPrecio(data.precio, data.moneda)}`,
    openGraph: {
      title: `${data.titulo} | MVDPrime`,
      description: `${TIPO_MAP[data.tipo] || data.tipo} en ${OPERACION_MAP[data.operacion] || data.operacion} · ${ubicacion}`,
    },
  };
}

const WHATSAPP_AGENCIA = process.env.NEXT_PUBLIC_WHATSAPP_AGENCIA || "59899000000";

export default async function FichaPublicaPage({ params }) {
  const supabase = createAdminClient();

  const [{ data: propiedad }, { data: fotos }] = await Promise.all([
    supabase
      .from("propiedades")
      .select("*, agente:usuarios(id, nombre, email)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("fotos")
      .select("id, url, es_principal, orden")
      .eq("propiedad_id", params.id)
      .order("orden"),
  ]);

  if (!propiedad) notFound();

  const amenidades = [
    propiedad.es_obra_nueva && "Obra nueva",
    propiedad.amueblado && "Amueblado",
    propiedad.acepta_mascotas && "Acepta mascotas",
    propiedad.parking && "Estacionamiento",
    propiedad.parrillero && "Parrillero",
    propiedad.piscina && "Piscina",
  ].filter(Boolean);

  const detalles = [
    propiedad.ano_construccion && `Año ${propiedad.ano_construccion}`,
    propiedad.departamento && propiedad.departamento,
  ].filter(Boolean);

  const whatsappMsg = encodeURIComponent(
    `Hola! Me interesa la propiedad: *${propiedad.titulo}*. ¿Pueden darme más información?`
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP_AGENCIA}?text=${whatsappMsg}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-navy shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
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
        {/* Galería */}
        <GaleriaFotos fotos={fotos || []} titulo={propiedad.titulo} />

        {/* Título + Precio */}
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent/10 px-3 py-0.5 text-sm font-semibold capitalize text-accent">
                {OPERACION_MAP[propiedad.operacion] || propiedad.operacion}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-0.5 text-sm capitalize text-slate-600">
                {TIPO_MAP[propiedad.tipo] || propiedad.tipo}
              </span>
              {propiedad.estado === "disponible" && (
                <span className="rounded-full bg-green-100 px-3 py-0.5 text-sm font-medium text-green-700">
                  Disponible
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-navy">{propiedad.titulo}</h1>
            {(propiedad.barrio || propiedad.departamento || propiedad.direccion) && (
              <p className="mt-1 flex items-center gap-1 text-slate-500">
                <IconPin />
                {[propiedad.barrio, propiedad.departamento].filter(Boolean).join(", ")}
                {propiedad.direccion && ` · ${propiedad.direccion}`}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-bold text-accent">
              {formatPrecio(propiedad.precio, propiedad.moneda)}
            </p>
            {propiedad.operacion === "alquiler" && (
              <p className="text-xs text-slate-400">por mes</p>
            )}
          </div>
        </div>

        {/* Métricas principales */}
        {(propiedad.dormitorios != null ||
          propiedad.banos != null ||
          propiedad.superficie_total != null ||
          propiedad.superficie_cubierta != null) && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {propiedad.dormitorios != null && (
              <MetricCard icon={<IconBed />} value={propiedad.dormitorios} label="Dormitorios" />
            )}
            {propiedad.banos != null && (
              <MetricCard icon={<IconBath />} value={propiedad.banos} label="Baños" />
            )}
            {propiedad.superficie_total != null && (
              <MetricCard
                icon={<IconArea />}
                value={`${propiedad.superficie_total} m²`}
                label="Sup. total"
              />
            )}
            {propiedad.superficie_cubierta != null && (
              <MetricCard
                icon={<IconHome />}
                value={`${propiedad.superficie_cubierta} m²`}
                label="Sup. cubierta"
              />
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Descripción */}
            {propiedad.descripcion && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-navy">Descripción</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {propiedad.descripcion}
                </p>
              </div>
            )}

            {/* Características */}
            {amenidades.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-navy">Características</h2>
                <div className="flex flex-wrap gap-2">
                  {amenidades.map((a) => (
                    <span
                      key={a}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detalles adicionales */}
            {detalles.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-navy">Información adicional</h2>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {propiedad.ano_construccion && (
                    <div>
                      <dt className="text-xs text-slate-400">Año de construcción</dt>
                      <dd className="mt-0.5 font-medium text-slate-700">{propiedad.ano_construccion}</dd>
                    </div>
                  )}
                  {propiedad.departamento && (
                    <div>
                      <dt className="text-xs text-slate-400">Departamento</dt>
                      <dd className="mt-0.5 font-medium text-slate-700">{propiedad.departamento}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>

          {/* Sidebar: CTA contacto */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-navy">¿Te interesa esta propiedad?</p>
              <p className="mt-1 text-sm text-slate-500">
                Contactanos y te respondemos a la brevedad.
              </p>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-3 text-sm font-semibold text-white transition hover:bg-green-600"
              >
                <IconWhatsApp />
                Consultar por WhatsApp
              </a>

              {propiedad.agente?.nombre && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400">Agente responsable</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-700">
                    {propiedad.agente.nombre}
                  </p>
                </div>
              )}

              <div className="mt-4 border-t border-slate-100 pt-4 text-center">
                <BtnCompartir titulo={propiedad.titulo} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-center">
        <p className="text-lg font-bold text-navy">
          MVDPrime <span className="text-accent">RE</span>
        </p>
        <p className="mt-1 text-sm text-slate-400">Real Estate · Uruguay</p>
      </footer>
    </div>
  );
}

function MetricCard({ icon, value, label }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-navy">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

// Botón client que copia la URL
import BtnCompartir from "@/components/public/BtnCompartir";

function IconWhatsApp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 4v16M2 8h20a2 2 0 0 1 2 2v10M2 16h20" />
    </svg>
  );
}

function IconBath() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6L9 2" />
      <path d="M3 18v3" />
      <path d="M21 18v3" />
      <path d="M3 18a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3" />
      <path d="M3 13h18a3 3 0 0 1 0 5H3a3 3 0 0 1 0-5z" />
      <path d="M7 6a2 2 0 0 1 2-2h.5" />
    </svg>
  );
}

function IconArea() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3h4v4H3zM17 3h4v4h-4zM3 17h4v4H3zM17 17h4v4h-4z" />
      <line x1="7" y1="5" x2="17" y2="5" />
      <line x1="7" y1="19" x2="17" y2="19" />
      <line x1="5" y1="7" x2="5" y2="17" />
      <line x1="19" y1="7" x2="19" y2="17" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
