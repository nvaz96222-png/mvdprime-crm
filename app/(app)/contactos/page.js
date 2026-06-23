import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ContactosBuscador from "@/components/contactos/ContactosBuscador";
import BtnExportar from "@/components/ui/BtnExportar";
import { CONTACTO_INTERESES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const INTERES_MAP = Object.fromEntries(
  CONTACTO_INTERESES.map((i) => [i.value, i.label])
);

export default async function ContactosPage({ searchParams }) {
  const supabase = createClient();
  const q = searchParams.q?.trim();

  let query = supabase
    .from("contactos")
    .select("*, leads(count)")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(
      `nombre.ilike.*${q}*,email.ilike.*${q}*,telefono.ilike.*${q}*`
    );
  }

  const { data: contactos, error } = await query;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Contactos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {error ? "—" : `${contactos?.length || 0} contacto(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BtnExportar
            datos={contactos || []}
            nombre="contactos"
            columnas={[
              { key: "nombre", label: "Nombre" },
              { key: "telefono", label: "Teléfono" },
              { key: "email", label: "Email" },
              { key: "interes", label: "Interés" },
              { key: "presupuesto_min", label: "Presupuesto mín" },
              { key: "presupuesto_max", label: "Presupuesto máx" },
              { key: "barrios_interes", label: "Barrios de interés" },
              { key: "es_propietario", label: "Es propietario" },
              { key: "notas", label: "Notas" },
            ]}
          />
          <Link
            href="/contactos/nuevo"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo contacto
          </Link>
        </div>
      </div>

      <div className="mb-5">
        <ContactosBuscador />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold">No se pudieron cargar los contactos.</p>
          <p className="mt-1">{error.message}</p>
        </div>
      ) : contactos?.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {contactos.map((c) => {
              const nLeads = c.leads?.[0]?.count ?? 0;
              return (
                <li key={c.id}>
                  <Link
                    href={`/contactos/${c.id}`}
                    className="flex items-center gap-4 px-4 py-3 transition hover:bg-slate-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                      {(c.nombre || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-slate-800">{c.nombre}</p>
                        {c.es_propietario && (
                          <span className="hidden shrink-0 rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold text-white sm:inline">
                            Propietario
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-slate-500">
                        {[c.telefono, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                      </p>
                    </div>
                    {c.interes && (
                      <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline">
                        {INTERES_MAP[c.interes] || c.interes}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-slate-400">
                      {nLeads} lead{nLeads === 1 ? "" : "s"}
                    </span>
                    <svg className="shrink-0 text-slate-300" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">
            {q ? `No hay contactos que coincidan con “${q}”.` : "Todavía no hay contactos."}
          </p>
          {!q && (
            <Link href="/contactos/nuevo" className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
              Cargar el primer contacto
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
