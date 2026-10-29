"use client";

import { useState } from "react";
import Link from "next/link";
import { LEAD_ETAPAS, LEAD_PRIORIDADES, ORIGENES } from "@/lib/constants";
import { formatPrecio } from "@/lib/format";
import { IconCerrar, IconCanal, IconExterno } from "./iconos";
import { iniciales, nombreConversacion, telefonoLegible, CANAL_LABEL } from "./formato";

const ORIGEN_LABEL = Object.fromEntries(ORIGENES.map((o) => [o.value, o.label]));

// Ficha del lead al costado del chat (en el celular, a pantalla completa).
export default function PanelLead({
  conv, perfil, usuarios, propiedades, propiedadesMap,
  onCerrar, onCambiarLead, onCambiarInteres, onAsignar,
}) {
  const [agregando, setAgregando] = useState("");
  const [error, setError] = useState(null);
  const lead = conv.lead;
  const nombre = nombreConversacion(conv);
  const esAdmin = perfil?.rol === "admin";
  const intereses = [...new Set([
    ...(lead?.intereses || []).map((i) => i.propiedad_id),
    ...(lead?.propiedad_id ? [lead.propiedad_id] : []),
  ])];

  async function ejecutar(fn) {
    setError(null);
    try { await fn(); } catch (e) { setError(e?.message || "No se pudo guardar."); }
  }

  return (
    <aside className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-[#f0f2f5] px-3 py-3">
        <button type="button" onClick={onCerrar} aria-label="Cerrar ficha" className="rounded-full p-1.5 text-slate-600 hover:bg-slate-200">
          <IconCerrar size={20} />
        </button>
        <span className="font-semibold text-slate-800">Ficha del lead</span>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy/10 text-xl font-semibold text-navy">{iniciales(nombre)}</div>
          <p className="mt-2 text-base font-semibold text-slate-900">{nombre}</p>
          {conv.contacto?.telefono && <p className="text-slate-500">{telefonoLegible(conv.contacto.telefono)}</p>}
          {conv.contacto?.email && <p className="text-slate-500">{conv.contacto.email}</p>}
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><IconCanal canal={conv.canal} size={12} /> {CANAL_LABEL[conv.canal]}</p>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <Campo titulo="Asignado a">
          {esAdmin ? (
            <select
              value={conv.asignado_a || ""}
              onChange={(e) => ejecutar(() => onAsignar(e.target.value || null))}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5"
            >
              <option value="">Sin asignar</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          ) : conv.asignado_a === perfil?.id ? (
            <p className="text-slate-700">Vos</p>
          ) : (
            <button type="button" onClick={() => ejecutar(() => onAsignar(perfil.id))}
              className="rounded-md border border-accent px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/5">
              Asignarme esta conversación
            </button>
          )}
        </Campo>

        {!lead ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Esta conversación todavía no tiene un lead asociado.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Campo titulo="Etapa">
                <select value={lead.etapa || "nuevo"} onChange={(e) => ejecutar(() => onCambiarLead({ etapa: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5">
                  {LEAD_ETAPAS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </Campo>
              <Campo titulo="Prioridad">
                <select value={lead.prioridad || "media"} onChange={(e) => ejecutar(() => onCambiarLead({ prioridad: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5">
                  {LEAD_PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Campo>
            </div>

            <Campo titulo="Propiedades de interés">
              <div className="space-y-1.5">
                {intereses.length === 0 && <p className="text-xs text-slate-400">Ninguna todavía.</p>}
                {intereses.map((id) => {
                  const p = propiedadesMap[id];
                  return (
                    <div key={id} className="flex items-center gap-2 rounded-md bg-accent/5 px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <Link href={`/propiedades/${id}`} className="block truncate text-[13px] font-medium text-accent-dark hover:underline">
                          {p?.titulo || "Propiedad"}
                        </Link>
                        {p && <p className="text-[11px] text-slate-500">{formatPrecio(p.precio, p.moneda)}{p.barrio ? ` · ${p.barrio}` : ""}</p>}
                      </div>
                      <button type="button" aria-label="Quitar" onClick={() => ejecutar(() => onCambiarInteres(id, true))}
                        className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600">
                        <IconCerrar size={14} />
                      </button>
                    </div>
                  );
                })}
                <select
                  value={agregando}
                  onChange={(e) => {
                    const id = e.target.value;
                    setAgregando("");
                    if (id) ejecutar(() => onCambiarInteres(id, false));
                  }}
                  className="w-full rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-500"
                >
                  <option value="">+ Agregar propiedad</option>
                  {propiedades.filter((p) => !intereses.includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.titulo || "Sin título"}</option>
                  ))}
                </select>
              </div>
            </Campo>

            <Campo titulo="Origen">
              <p className="text-slate-700">{ORIGEN_LABEL[lead.origen] || lead.origen || "—"}</p>
              {(lead.meta_campaign || lead.meta_ad_id) && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Anuncio: {lead.meta_campaign || lead.meta_ad_id}
                </p>
              )}
            </Campo>

            <Link href={`/leads/${lead.id}`}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-navy hover:bg-slate-50">
              Ver lead completo <IconExterno size={14} />
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}

function Campo({ titulo, children }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      {children}
    </div>
  );
}
