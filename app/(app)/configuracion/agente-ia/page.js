import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/supabase/getPerfil";
import { cargarConfig, MODELO_DEFAULT } from "@/lib/ia/config";
import ConfigAgente from "@/components/ia/ConfigAgente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agente IA · MVDPrime CRM" };

// =====================================================================
// /configuracion/agente-ia — configuración, uso y simulador del agente
// IA (Fase 3). Solo admin.
// =====================================================================

export default async function AgenteIAPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const perfil = await getPerfil(supabase, user);
  if (perfil?.rol !== "admin") redirect("/dashboard");

  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const [config, eventosRes, propRes] = await Promise.all([
    cargarConfig(supabase),
    supabase.from("ia_eventos").select("tipo, input_tokens, output_tokens").gte("created_at", desde).limit(10000),
    supabase.from("propiedades").select("id, titulo, barrio, estado").order("created_at", { ascending: false }).limit(500),
  ]);

  const uso = { respuestas: 0, derivaciones: 0, errores: 0, simulaciones: 0, input_tokens: 0, output_tokens: 0 };
  for (const e of eventosRes.data || []) {
    if (e.tipo === "respuesta") uso.respuestas++;
    if (e.tipo === "derivacion") uso.derivaciones++;
    if (e.tipo === "error") uso.errores++;
    if (e.tipo === "simulacion") uso.simulaciones++;
    uso.input_tokens += e.input_tokens || 0;
    uso.output_tokens += e.output_tokens || 0;
  }

  return (
    <ConfigAgente
      configInicial={config}
      sinMigracion={!!config._sinTabla}
      uso={uso}
      propiedades={propRes.data || []}
      modeloDefault={MODELO_DEFAULT}
      tieneApiKey={!!process.env.ANTHROPIC_API_KEY}
    />
  );
}
