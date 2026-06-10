"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LEAD_ETAPAS } from "@/lib/constants";
import LeadCard from "./LeadCard";

function agrupar(leads) {
  const cols = {};
  for (const e of LEAD_ETAPAS) cols[e.value] = [];
  for (const l of leads) {
    if (cols[l.etapa]) cols[l.etapa].push(l);
    else cols[l.etapa] = [l];
  }
  return cols;
}

export default function KanbanBoard({ leads }) {
  const router = useRouter();
  const supabase = createClient();
  const [columnas, setColumnas] = useState(() => agrupar(leads));
  const [arrastrando, setArrastrando] = useState(null); // etapa destino resaltada
  const [error, setError] = useState("");

  function onDragStart(e, lead) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: lead.id, etapa: lead.etapa }));
    e.dataTransfer.effectAllowed = "move";
  }

  async function onDrop(e, destino) {
    e.preventDefault();
    setArrastrando(null);
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    const { id, etapa: origen } = payload;
    if (!id || origen === destino) return;

    // Mover de forma optimista.
    const previo = columnas;
    const lead = columnas[origen]?.find((l) => l.id === id);
    if (!lead) return;
    const nuevo = { ...columnas };
    nuevo[origen] = columnas[origen].filter((l) => l.id !== id);
    nuevo[destino] = [{ ...lead, etapa: destino }, ...(columnas[destino] || [])];
    setColumnas(nuevo);
    setError("");

    const { error } = await supabase
      .from("leads")
      .update({ etapa: destino })
      .eq("id", id);

    if (error) {
      setColumnas(previo); // revertir
      setError("No se pudo mover el lead.");
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_ETAPAS.map((etapa) => {
          const items = columnas[etapa.value] || [];
          const resaltado = arrastrando === etapa.value;
          return (
            <div
              key={etapa.value}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(etapa.value);
              }}
              onDragLeave={() => setArrastrando((v) => (v === etapa.value ? null : v))}
              onDrop={(e) => onDrop(e, etapa.value)}
              className={`flex w-72 shrink-0 flex-col rounded-xl border bg-slate-50 transition ${
                resaltado ? "border-accent ring-2 ring-accent/30" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${etapa.color}`} />
                  <span className="text-sm font-semibold text-slate-700">
                    {etapa.label}
                  </span>
                </div>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-400">
                    Sin leads
                  </p>
                ) : (
                  items.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onDragStart={onDragStart} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
