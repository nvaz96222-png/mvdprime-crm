import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROYECTO_TIPOS, PROYECTO_ESTADOS, DEPARTAMENTOS } from "@/lib/constants";
import DesarrolloCard from "@/components/public/DesarrolloCard";
import FiltrosDesarrollos from "@/components/public/FiltrosDesarrollos";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mvdprime.uy";
const WHATSAPP_AGENCIA = process.env.NEXT_PUBLIC_WHATSAPP_AGENCIA || "59899000000";

export async function generateMetadata() {
  return {
    title: "Desarrollos inmobiliarios en Uruguay | MVDPrime Real Estate",
    description:
      "Explorá nuestros emprendimientos y proyectos inmobiliarios en Uruguay: edificios en pozo, casas, urbanizaciones y más. Consultanos sin compromiso.",
    alternates: { canonical: `${SITE_URL}/desarrollos` },
    openGraph: {
      title: "Desarrollos inmobiliarios | MVDPrime Real Estate",
      description:
        "Edificios, casas en pozo, urbanizaciones y complejos comerciales en Uruguay. Nuevos proyectos en comercialización.",
      url: `${SITE_URL}/desarrollos`,
      siteName: "MVDPrime Real Estate",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Desarrollos inmobiliarios | MVDPrime Real Estate",
      description: "Nuevos proyectos inmobiliarios en Uruguay. Consultanos.",
    },
  };
}

// Estados visibles públicamente (sin pausado/cancelado)
const ESTADOS_PUBLICOS = ["en_comercializacion", "proximamente", "en_obra", "entregado"];

export default async function DesarrollosPage({ searchParams }) {
  const supabase = createAdminClient();
  const { barrio, departamento, tipo, estado, destacado } = searchParams;

  let query = supabase
    .from("proyectos")
    .select("id, nombre, slug, tipo, estado, barrio, departamento, precio_desde, moneda, destacado, fotos:proyecto_fotos(url, es_principal, orden)")
    .eq("publicar_web", true)
    .in("estado", ESTADOS_PUBLICOS)
    .order("destacado", { ascending: false })
    .order("created_at", { ascending: false });

  if (barrio)      query = query.eq("barrio", barrio);
  if (departamento) query = query.eq("departamento", departamento);
  if (tipo)        query = query.eq("tipo", tipo);
  if (estado && ESTADOS_PUBLICOS.includes(estado)) query = query.eq("estado", estado);
  if (destacado === "1") query = query.eq("destacado", true);

  // Query paralela: barrios únicos para los filtros
  const [{ data: proyectos, error }, { data: todosPublicados }] = await Promise.all([
    query,
    supabase
      .from("proyectos")
      .select("barrio")
      .eq("publicar_web", true)
      .in("estado", ESTADOS_PUBLICOS)
      .not("barrio", "is", null),
  ]);

  const barrios = [...new Set((todosPublicados || []).map((p) => p.barrio))].sort();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-navy shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/desarrollos" className="text-lg font-bold text-white">
            MVDPrime <span className="text-accent-light">RE</span>
          </Link>
          <a
            href={`https://wa.me/${WHATSAPP_AGENCIA}?text=${encodeURIComponent("Hola, quiero información sobre sus desarrollos inmobiliarios.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600"
          >
            <IconWhatsApp />
            Consultar
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Encabezado */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-navy">Desarrollos inmobiliarios</h1>
          <p className="mt-1 text-slate-500">
            Proyectos en comercialización, preventa y entrega en Uruguay
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-6">
          <FiltrosDesarrollos barrios={barrios} />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            No se pudieron cargar los desarrollos. Por favor, intentá más tarde.
          </div>
        )}

        {/* Grid */}
        {!error && proyectos?.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-slate-400">
              {proyectos.length} desarrollo{proyectos.length !== 1 ? "s" : ""} encontrado{proyectos.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {proyectos.map((p) => (
                <DesarrolloCard key={p.id} proyecto={p} />
              ))}
            </div>
          </>
        ) : !error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 text-slate-300">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
            <p className="text-base font-medium text-slate-500">
              No hay desarrollos con los filtros seleccionados
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Intentá con otros criterios o{" "}
              <a href="/desarrollos" className="text-accent hover:underline">
                limpiá los filtros
              </a>
            </p>
          </div>
        ) : null}
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

function IconWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.122 1.528 5.862L0 24l6.336-1.508A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.817 9.817 0 0 1-5.006-1.371l-.359-.213-3.761.896.924-3.659-.235-.378A9.818 9.818 0 0 1 2.182 12c0-5.419 4.399-9.818 9.818-9.818 5.419 0 9.818 4.399 9.818 9.818 0 5.419-4.399 9.818-9.818 9.818z" />
    </svg>
  );
}
