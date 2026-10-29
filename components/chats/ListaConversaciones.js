"use client";

import { LEAD_ETAPAS, LEAD_ETAPA_MAP } from "@/lib/constants";
import { IconBuscar, IconCanal, IconChat } from "./iconos";
import { fechaLista, iniciales, nombreConversacion, CANAL_LABEL } from "./formato";
import { ventanaAbierta } from "@/lib/chats/ventana";

const RAPIDOS = [
  { value: "todos", label: "Todos" },
  { value: "sin_leer", label: "Sin leer" },
  { value: "mios", label: "Míos" },
];

// Columna izquierda: búsqueda, filtros y lista de conversaciones (estilo WhatsApp).
export default function ListaConversaciones({
  conversaciones, totalSinFiltro, seleccionId, onSeleccionar,
  filtros, setFiltros, propiedades, propiedadesMap, ia = {},
}) {
  const hayFiltrosAvanzados = filtros.canal || filtros.etapa || filtros.propiedad;
  const set = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="space-y-2 border-b border-slate-200 px-3 pb-2 pt-3">
        <div className="flex items-center justify-between px-1">
          <h1 className="text-lg font-bold text-navy">Chats</h1>
          <span className="text-xs text-slate-400">{totalSinFiltro} conversación(es)</span>
        </div>

        <label className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-slate-500 focus-within:ring-2 focus-within:ring-accent/40">
          <IconBuscar size={16} />
          <input
            type="search"
            value={filtros.texto}
            onChange={set("texto")}
            placeholder="Buscar por nombre o teléfono"
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {[...RAPIDOS, ...(ia.disponible ? [{ value: "atender", label: "Para atender" }] : [])].map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setFiltros((f) => ({ ...f, rapido: r.value }))}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filtros.rapido === r.value ? "bg-[#d9fdd3] text-[#0a5a3c]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <select value={filtros.canal} onChange={set("canal")} aria-label="Canal"
            className="min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600">
            <option value="">Canal</option>
            {Object.entries(CANAL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filtros.etapa} onChange={set("etapa")} aria-label="Etapa"
            className="min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600">
            <option value="">Etapa</option>
            {LEAD_ETAPAS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <select value={filtros.propiedad} onChange={set("propiedad")} aria-label="Propiedad"
            className="min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600">
            <option value="">Propiedad</option>
            {propiedades.map((p) => <option key={p.id} value={p.id}>{p.titulo || "Sin título"}</option>)}
          </select>
        </div>

        {hayFiltrosAvanzados && (
          <div className="flex items-center justify-between rounded-md bg-accent/5 px-2 py-1 text-[11px] text-accent-dark">
            <span className="truncate">
              {filtros.propiedad ? `Propiedad: ${propiedadesMap[filtros.propiedad]?.titulo || "—"}` : "Filtros activos"}
            </span>
            <button type="button" className="shrink-0 font-semibold hover:underline"
              onClick={() => setFiltros((f) => ({ ...f, canal: "", etapa: "", propiedad: "" }))}>
              Limpiar
            </button>
          </div>
        )}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {conversaciones.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-slate-400">
            <IconChat size={32} />
            {totalSinFiltro === 0
              ? "Todavía no hay conversaciones. Cuando un cliente escriba por WhatsApp, Instagram o Messenger, aparece acá."
              : "Ninguna conversación coincide con los filtros."}
          </li>
        )}
        {conversaciones.map((c) => (
          <Fila key={c.id} conv={c} activa={c.id === seleccionId} onClick={() => onSeleccionar(c.id)} propiedadesMap={propiedadesMap} />
        ))}
      </ul>
    </div>
  );
}

function Fila({ conv, activa, onClick, propiedadesMap }) {
  const nombre = nombreConversacion(conv);
  const etapa = conv.lead?.etapa ? LEAD_ETAPA_MAP[conv.lead.etapa] : null;
  const propiedad = conv.lead?.propiedad_id ? propiedadesMap[conv.lead.propiedad_id] : null;
  const sinLeer = conv.no_leidos > 0;
  const cerrada = !ventanaAbierta(conv);
  const atender = !!conv.ia_derivada;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition ${
          activa ? "bg-slate-100" : "hover:bg-slate-50"
        }`}
      >
        <div className="relative shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy/10 text-sm font-semibold text-navy">
            {iniciales(nombre)}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5">
            <IconCanal canal={conv.canal} size={14} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`truncate text-[15px] ${sinLeer ? "font-semibold text-slate-900" : "text-slate-800"}`}>{nombre}</span>
            <span className={`ml-auto shrink-0 text-[11px] ${sinLeer ? "font-semibold text-[#1fa855]" : "text-slate-400"}`}>
              {fechaLista(conv.ultimo_mensaje_at)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={`truncate text-[13px] ${sinLeer ? "text-slate-700" : "text-slate-500"}`}>
              {conv.ultimo_mensaje_texto || "—"}
            </span>
            {sinLeer && (
              <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-semibold text-white">
                {conv.no_leidos > 99 ? "99+" : conv.no_leidos}
              </span>
            )}
          </div>
          {(etapa || propiedad || cerrada || atender || conv.ia_activa) && (
            <div className="mt-1 flex items-center gap-1.5 overflow-hidden text-[10px]">
              {atender && <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 font-semibold text-red-700" title={conv.ia_motivo_derivacion || ""}>Atender</span>}
              {conv.ia_activa && !atender && <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">IA</span>}
              {etapa && (
                <span className="flex shrink-0 items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                  <span className={`h-1.5 w-1.5 rounded-full ${etapa.color}`} />{etapa.label}
                </span>
              )}
              {propiedad && <span className="truncate rounded bg-accent/10 px-1.5 py-0.5 text-accent-dark">{propiedad.titulo}</span>}
              {cerrada && <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">Ventana cerrada</span>}
            </div>
          )}
        </div>
      </button>
    </li>
  );
}
