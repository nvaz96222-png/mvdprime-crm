import { createAdminClient } from "@/lib/supabase/admin";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mvdprime.uy";
const ESTADOS_PUBLICOS = ["en_comercializacion", "proximamente", "en_obra", "entregado"];

export default async function sitemap() {
  const supabase = createAdminClient();

  const { data: proyectos } = await supabase
    .from("proyectos")
    .select("slug, updated_at")
    .eq("publicar_web", true)
    .in("estado", ESTADOS_PUBLICOS);

  const proyectoEntries = (proyectos || []).map((p) => ({
    url: `${SITE_URL}/desarrollos/${p.slug}`,
    lastModified: p.updated_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/desarrollos`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...proyectoEntries,
  ];
}
