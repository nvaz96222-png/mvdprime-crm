import Link from "next/link";
import { PROYECTO_TIPO_MAP, PROYECTO_ESTADO_MAP } from "@/lib/constants";

export default function DesarrolloCard({ proyecto }) {
  const portada = proyecto.fotos?.find((f) => f.es_principal) || proyecto.fotos?.[0];
  const estado = PROYECTO_ESTADO_MAP[proyecto.estado];

  const precioLabel = proyecto.precio_desde
    ? `${proyecto.moneda === "UYU" ? "$U" : "US$"} ${Number(proyecto.precio_desde).toLocaleString("es-UY")}`
    : null;

  return (
    <Link
      href={`/desarrollos/${proyecto.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Imagen */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
        {portada ? (
          <img
            src={portada.url}
            alt={proyecto.nombre}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
          </div>
        )}

        {/* Badges sobre imagen */}
        <div className="absolute left-2 top-2 flex gap-1.5">
          {proyecto.destacado && (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              Destacado
            </span>
          )}
        </div>

        {estado && (
          <span className={`absolute right-2 top-2 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${estado.badge}`}>
            {estado.label}
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-navy group-hover:text-accent transition-colors">
          {proyecto.nombre}
        </h3>

        <p className="text-xs text-slate-500">
          {PROYECTO_TIPO_MAP[proyecto.tipo] || proyecto.tipo}
          {proyecto.barrio ? ` · ${proyecto.barrio}` : ""}
          {proyecto.departamento ? `, ${proyecto.departamento}` : ""}
        </p>

        {precioLabel && (
          <p className="mt-auto pt-1 text-sm font-semibold text-accent">
            Desde {precioLabel}
          </p>
        )}

        {/* CTA footer */}
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="text-xs text-slate-400">Ver más</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-accent transition group-hover:translate-x-0.5"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
