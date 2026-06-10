"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LEAD_ETAPAS, LEAD_PRIORIDADES } from "@/lib/constants";

const selectClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function LeadControles({ lead, agentes = [] }) {
  const router = useRouter();
  const supabase = createClient();
  const [valores, setValores] = useState({
    etapa: lead.etapa || "nuevo",
    prioridad: lead.prioridad || "media",
    agente_id: lead.agente_id || "",
  });
  const [guardando, setGuardando] = useState(null);
  const [error, setError] = useState("");

  async function actualizar(campo, valor) {
    const previo = valores[campo];
    setValores((v) => ({ ...v, [campo]: valor }));
    setGuardando(campo);
    setError("");
    const { error } = await supabase
      .from("leads")
      .update({ [campo]: valor || null })
      .eq("id", lead.id);
    setGuardando(null);
    if (error) {
      setValores((v) => ({ ...v, [campo]: previo }));
      setError("No se pudo actualizar.");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <Control label="Etapa" guardando={guardando === "etapa"}>
        <select
          className={selectClass}
          value={valores.etapa}
          onChange={(e) => actualizar("etapa", e.target.value)}
        >
          {LEAD_ETAPAS.map((et) => (
            <option key={et.value} value={et.value}>
              {et.label}
            </option>
          ))}
        </select>
      </Control>

      <Control label="Prioridad" guardando={guardando === "prioridad"}>
        <select
          className={selectClass}
          value={valores.prioridad}
          onChange={(e) => actualizar("prioridad", e.target.value)}
        >
          {LEAD_PRIORIDADES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Control>

      <Control label="Agente asignado" guardando={guardando === "agente_id"}>
        <select
          className={selectClass}
          value={valores.agente_id}
          onChange={(e) => actualizar("agente_id", e.target.value)}
        >
          <option value="">— Sin asignar —</option>
          {agentes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </Control>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Control({ label, guardando, children }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
        {label}
        {guardando && <span className="text-xs text-slate-400">guardando…</span>}
      </label>
      {children}
    </div>
  );
}
