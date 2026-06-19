import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AnalisisMarket from "@/components/market/AnalisisMarket";

export const dynamic = "force-dynamic";

export default async function AnalisisPage({ params }) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: propiedad } = await supabase
    .from("propiedades")
    .select("id, titulo, tipo, operacion, precio, moneda, barrio, departamento, superficie_total, dormitorios, banos")
    .eq("id", params.id)
    .maybeSingle();

  if (!propiedad) notFound();

  // Buscar comparables en market_listings
  let query = admin
    .from("market_listings")
    .select("id, portal, external_id, url, title, operation_type, property_type, price, currency, expenses, area_total, area_built, bedrooms, bathrooms, neighborhood, city, department, lat, lng, thumbnail_url, last_seen_at")
    .eq("property_type", propiedad.tipo)
    .eq("operation_type", propiedad.operacion)
    .eq("is_active", true)
    .not("price", "is", null)
    .order("price", { ascending: true })
    .limit(300);

  // Filtrar por zona si el propiedad tiene barrio/departamento
  if (propiedad.barrio) {
    query = query.or(
      `neighborhood.ilike.%${propiedad.barrio}%,city.ilike.%${propiedad.barrio}%`
    );
  } else if (propiedad.departamento) {
    query = query.ilike("department", `%${propiedad.departamento}%`);
  }

  const { data: comparables = [] } = await query;

  return (
    <div>
      <div className="mb-6">
        <Link href="/propiedades" className="text-sm text-slate-500 hover:text-accent">
          ← Propiedades
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">Análisis de mercado</h1>
            <p className="mt-0.5 text-sm text-slate-500">{propiedad.titulo}</p>
          </div>
          <Link
            href={`/propiedades/${params.id}/editar`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-navy hover:text-navy"
          >
            Editar propiedad
          </Link>
        </div>
      </div>

      <AnalisisMarket propiedad={propiedad} comparables={comparables} />
    </div>
  );
}
