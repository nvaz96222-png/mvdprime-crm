import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPrecio, formatFecha } from "@/lib/format";
import { ESTADOS, OPERACIONES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const ESTADO_COLORS = {
  disponible: "bg-green-100 text-green-700",
  reservado: "bg-yellow-100 text-yellow-700",
  vendido: "bg-slate-100 text-slate-600",
  alquilado: "bg-blue-100 text-blue-700",
  retirado: "bg-red-100 text-red-600",
};

const ESTADO_MAP = Object.fromEntries(ESTADOS.map((e) => [e.value, e.label]));
const OP_MAP = Object.fromEntries(OPERACIONES.map((o) => [o.value, o.label]));

export default async function PropietarioDetallePage({ params }) {
  const supabase = createClient();

  const [{ data: propietario }, { data: propiedades }] = await Promise.all([
    supabase.from("propietarios").select("*").eq("id", params.id).single(),
    supabase
      .from("propiedades")
      .select("id, titulo, tipo, operacion, estado, precio, moneda, barrio, created_at, fotos(url, es_principal)")
      .eq("propietario_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!propietario) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy text-xl font-bold text-white">
            {propietario.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-navy">{propietario.nombre}</h1>
              {propietario.es_propio && (
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  Prop. propia
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Registrado el {formatFecha(propietario.created_at)}
            </p>
          </div>
        </div>
        <Link
          href={`/propietarios/${params.id}/editar`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Editar
        </Link>
      </div>

      {/* Datos de contacto */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Datos de contacto
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: "Teléfono", valor: propietario.telefono },
            { label: "Email", valor: propietario.email },
            { label: "Documento", valor: propietario.documento },
          ].map(({ label, valor }) => (
            <div key={label}>
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-700">
                {valor || <span className="font-normal text-slate-400">—</span>}
              </dd>
            </div>
          ))}
        </dl>

        {propietario.notas && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <dt className="mb-1 text-xs text-slate-400">Notas</dt>
            <dd className="text-sm text-slate-700 whitespace-pre-line">{propietario.notas}</dd>
          </div>
        )}
      </div>

      {/* Propiedades asociadas */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy">
            Propiedades ({propiedades?.length || 0})
          </h2>
          <Link
            href={`/propiedades/nueva?propietario_id=${params.id}`}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90"
          >
            + Agregar propiedad
          </Link>
        </div>

        {propiedades?.length ? (
          <div className="space-y-3">
            {propiedades.map((prop) => {
              const foto = prop.fotos?.find((f) => f.es_principal) || prop.fotos?.[0];
              return (
                <Link
                  key={prop.id}
                  href={`/propiedades/${prop.id}/editar`}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-accent/40 hover:shadow-sm"
                >
                  {foto ? (
                    <img
                      src={foto.url}
                      alt={prop.titulo}
                      className="h-14 w-20 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{prop.titulo}</p>
                    <p className="text-sm text-slate-500 capitalize">
                      {prop.tipo} · {OP_MAP[prop.operacion] || prop.operacion}
                      {prop.barrio ? ` · ${prop.barrio}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ESTADO_COLORS[prop.estado] || "bg-slate-100 text-slate-600"}`}>
                      {ESTADO_MAP[prop.estado] || prop.estado}
                    </span>
                    <span className="text-sm font-semibold text-navy">
                      {formatPrecio(prop.precio, prop.moneda)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">Este propietario no tiene propiedades asignadas.</p>
            <Link
              href={`/propiedades/nueva?propietario_id=${params.id}`}
              className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
            >
              Cargar primera propiedad
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
