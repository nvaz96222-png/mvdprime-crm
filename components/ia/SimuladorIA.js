"use client";

import { useEffect, useRef, useState } from "react";

// Nombres legibles de lo que haría el agente en el CRM.
const ACCION_LABEL = {
  actualizar_calificacion: "Guardaría datos del cliente",
  buscar_propiedades: "Buscó propiedades",
  asignar_propiedad: "Sumaría una propiedad de interés",
  proponer_visita: "Agendaría una visita tentativa",
  derivar_a_humano: "Te pasaría el chat",
};

function detalleAccion(a) {
  if (a.herramienta === "actualizar_calificacion") {
    const c = { ...(a.input || {}) };
    return Object.entries(c).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ");
  }
  if (a.herramienta === "buscar_propiedades") return (a.encontradas || []).join(", ") || "ninguna";
  if (a.herramienta === "proponer_visita") return a.input?.fecha_hora?.replace("T", " ") || "";
  if (a.herramienta === "derivar_a_humano") return a.motivo || "";
  return "";
}

// Simulador: escribís como cliente y ves cómo respondería el agente, con la
// configuración que está en pantalla (aunque no esté guardada). No manda
// mensajes ni escribe en la base.
export default function SimuladorIA({ propiedades, config }) {
  const [propiedadId, setPropiedadId] = useState(propiedades.find((p) => p.estado === "disponible")?.id || "");
  const [mensajes, setMensajes] = useState([]); // {rol, texto, acciones?}
  const [lead, setLead] = useState({ etapa: "nuevo", prioridad: "media", calificacion: {} });
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState(null);
  const [derivada, setDerivada] = useState(null);
  const finRef = useRef(null);

  useEffect(() => { finRef.current?.scrollIntoView({ block: "end" }); }, [mensajes.length, pensando]);

  function reiniciar() {
    setMensajes([]);
    setLead({ etapa: "nuevo", prioridad: "media", calificacion: {} });
    setDerivada(null);
    setError(null);
  }

  async function enviar(e) {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || pensando) return;
    const historial = [...mensajes, { rol: "cliente", texto: t }];
    setMensajes(historial);
    setTexto("");
    setPensando(true);
    setError(null);
    try {
      const res = await fetch("/api/ia/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propiedad_id: propiedadId || null,
          historial: historial.map(({ rol, texto }) => ({ rol, texto })),
          lead,
          config,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "El agente no pudo responder.");
      setMensajes((m) => [...m, { rol: "ia", texto: data.texto || "(sin respuesta)", acciones: data.acciones || [] }]);
      setLead((l) => ({ ...l, ...data.lead, calificacion: { ...(l.calificacion || {}), ...(data.lead?.calificacion || {}) } }));
      if (data.derivada) setDerivada(data.derivada);
    } catch (err) {
      setError(err.message);
    } finally {
      setPensando(false);
    }
  }

  const calif = Object.entries(lead.calificacion || {}).filter(([k]) => !["actualizado_por", "actualizado_at"].includes(k));

  return (
    <section className="flex max-h-[calc(100dvh-8rem)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="space-y-2 border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-navy">Simulador</h2>
          <button type="button" onClick={reiniciar} className="text-xs font-semibold text-slate-500 hover:text-navy">Reiniciar</button>
        </div>
        <p className="text-xs text-slate-500">Escribí como si fueras un cliente. No se manda nada ni se guarda en el CRM.</p>
        <select value={propiedadId} onChange={(e) => { setPropiedadId(e.target.value); reiniciar(); }} aria-label="Propiedad consultada"
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="">Sin propiedad (el cliente escribe sin anuncio)</option>
          {propiedades.map((p) => <option key={p.id} value={p.id}>{p.titulo || "Sin título"}{p.barrio ? ` · ${p.barrio}` : ""}</option>)}
        </select>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-3">
        {mensajes.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-500">Probá con: “Hola, me interesa este apartamento, ¿tiene garage?”</p>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.rol === "cliente" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[88%] rounded-lg px-2.5 py-1.5 text-[13.5px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${m.rol === "cliente" ? "bg-white" : "bg-[#d9fdd3]"}`}>
              {m.rol === "ia" && <p className="mb-0.5 text-[11px] font-semibold text-violet-700">Agente IA</p>}
              <p className="whitespace-pre-wrap break-words text-slate-900">{m.texto}</p>
              {m.acciones?.length > 0 && (
                <div className="mt-1.5 space-y-1 border-t border-black/5 pt-1.5">
                  {m.acciones.map((a, j) => (
                    <p key={j} className="text-[11px] leading-snug text-slate-600">
                      <span className="font-semibold text-violet-700">{ACCION_LABEL[a.herramienta] || a.herramienta}</span>
                      {detalleAccion(a) && <span>: {detalleAccion(a)}</span>}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {pensando && <p className="text-right text-xs text-slate-500">El agente está escribiendo…</p>}
        {error && <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>}
        <div ref={finRef} />
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
        <span className="font-semibold">Lead simulado:</span> etapa {lead.etapa} · prioridad {lead.prioridad}
        {derivada && <span className="font-semibold text-red-700"> · derivado: {derivada}</span>}
        {calif.length > 0 && <p className="mt-0.5 truncate" title={calif.map(([k, v]) => `${k}: ${v}`).join(" · ")}>{calif.map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
      </div>

      <form onSubmit={enviar} className="flex gap-2 border-t border-slate-200 p-3">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí como cliente"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <button type="submit" disabled={!texto.trim() || pensando}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:bg-slate-300">
          Enviar
        </button>
      </form>
    </section>
  );
}
