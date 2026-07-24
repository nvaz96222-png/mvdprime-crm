import Link from "next/link";
import { PROYECTO_TIPO_MAP, PROYECTO_ESTADO_MAP } from "@/lib/constants";

export default function ProyectoCard({ proyecto }) {
  const portada = proyecto.fotos?.find((f) => f.es_principal) || proyecto.fotos?.[0];
  const estado = PROYECTO_ESTADO_MAP[proyecto.estado];

  const precioLabel = proyecto.precio_desde
    ? `${proyecto.moneda} ${Number(proyecto.precio_desde).toLocaleString("es-UY")}`
    : null;

  return (
    <Link
      href={`/proyectos/${proyecto.id}/editar`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      {/* Imagen */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-100">
        {portada ? (
          <img
            src={portada.url}
            alt={proyecto.nombre}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </div>
        )}
        {proyecto.destacado && (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
            Destacado
          </span>
        )}
        {!proyecto.publicar_web && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            No publicado
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-navy leading-snug">
            {proyecto.nombre}
          </h3>
          {estado && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${estado.badge}`}>
              {estado.label}
            </span>
          )}
        </div>

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
      </div>
    </Link>
  );
}
