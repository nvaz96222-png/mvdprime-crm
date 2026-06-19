import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CalendarioSemana from "@/components/calendario/CalendarioSemana";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({ searchParams }) {
  const supabase = createClient();

  // Semana activa (por defecto: esta semana)
  const hoy = new Date();
  const offsetSemana = parseInt(searchParams.semana || "0");

  const lunesBase = new Date(hoy);
  lunesBase.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) + offsetSemana * 7);
  lunesBase.setHours(0, 0, 0, 0);

  const domingoBase = new Date(lunesBase);
  domingoBase.setDate(lunesBase.getDate() + 6);
  domingoBase.setHours(23, 59, 59, 999);

  const [{ data: visitas }, { data: agentes }] = await Promise.all([
    supabase
      .from("visitas")
      .select("*, lead:leads(id, contacto:contactos(nombre)), propiedad:propiedades(id, titulo, barrio), agente:usuarios(nombre)")
      .gte("fecha_inicio", lunesBase.toISOString())
      .lte("fecha_inicio", domingoBase.toISOString())
      .order("fecha_inicio"),
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Calendario</h1>
          <p className="mt-0.5 text-sm text-slate-500">Visitas y citas agendadas</p>
        </div>
        <Link
          href="/calendario/nueva"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva visita
        </Link>
      </div>

      <CalendarioSemana
        visitas={visitas || []}
        agentes={agentes || []}
        lunesISO={lunesBase.toISOString()}
        domingoISO={domingoBase.toISOString()}
        offsetSemana={offsetSemana}
      />
    </div>
  );
}
