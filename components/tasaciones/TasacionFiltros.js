"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TASACION_ESTADOS } from "@/lib/constants";

export default function TasacionFiltros() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const estadoActivo = searchParams.get("estado") || "";

  function setEstado(valor) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set("estado", valor);
    else params.delete("estado");
    router.push(`${pathname}?${params.toString()}`);
  }

  const opciones = [{ value: "", label: "Todas" }, ...TASACION_ESTADOS];

  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const activo = estadoActivo === o.value;
        return (
          <button
            key={o.value || "todas"}
            onClick={() => setEstado(o.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activo
                ? "bg-accent text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-accent hover:text-accent"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
