"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TIPO_MAP = { apartamento: "Apto", casa: "Casa", local: "Local", terreno: "Terreno", garage: "Garage" };
const OP_MAP = { venta: "Venta", alquiler: "Alquiler" };

export default function BuscadorGlobal() {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState({ propiedades: [], contactos: [], leads: [] });
  const [buscando, setBuscando] = useState(false);
  const [selIdx, setSelIdx] = useState(0);
  const inputRef = useRef(null);
  const router = useRouter();
  const supabase = createClient();
  const debounceRef = useRef(null);

  // Ctrl+K / Cmd+K para abrir
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setAbierto((v) => !v);
      }
      if (e.key === "Escape") setAbierto(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Foco al abrir
  useEffect(() => {
    if (abierto) {
      setQuery("");
      setResultados({ propiedades: [], contactos: [], leads: [] });
      setSelIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [abierto]);

  const buscar = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) {
      setResultados({ propiedades: [], contactos: [], leads: [] });
      return;
    }
    setBuscando(true);
    const like = `%${q}%`;

    const [{ data: props }, { data: conts }, { data: lds }] = await Promise.all([
      supabase
        .from("propiedades")
        .select("id, titulo, tipo, operacion, barrio, precio, moneda, estado")
        .or(`titulo.ilike.${like},barrio.ilike.${like}`)
        .limit(4),
      supabase
        .from("contactos")
        .select("id, nombre, telefono, email")
        .or(`nombre.ilike.${like},email.ilike.${like},telefono.ilike.${like}`)
        .limit(4),
      supabase
        .from("leads")
        .select("id, etapa, contacto:contactos(nombre), propiedad:propiedades(titulo)")
        .ilike("contactos.nombre", like)
        .limit(4),
    ]);

    setResultados({
      propiedades: props || [],
      contactos: conts || [],
      leads: lds?.filter((l) => l.contacto?.nombre) || [],
    });
    setBuscando(false);
    setSelIdx(0);
  }, [supabase]);

  function onChange(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(q), 280);
  }

  // Aplanar resultados para navegación con flechas
  const items = [
    ...resultados.propiedades.map((p) => ({ tipo: "prop", data: p, href: `/propiedades/${p.id}/editar`, label: p.titulo, sub: [TIPO_MAP[p.tipo], OP_MAP[p.operacion], p.barrio].filter(Boolean).join(" · ") })),
    ...resultados.contactos.map((c) => ({ tipo: "cont", data: c, href: `/contactos/${c.id}`, label: c.nombre, sub: [c.telefono, c.email].filter(Boolean).join(" · ") })),
    ...resultados.leads.map((l) => ({ tipo: "lead", data: l, href: `/leads/${l.id}`, label: l.contacto?.nombre, sub: l.propiedad?.titulo || "Sin propiedad" })),
  ];

  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx((i) => Math.min(i + 1, items.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && items[selIdx]) {
      router.push(items[selIdx].href);
      setAbierto(false);
    }
  }

  const tieneResultados = items.length > 0;

  return (
    <>
      {/* Trigger en sidebar */}
      <button
        onClick={() => setAbierto(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
      </button>

      {/* Modal */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAbierto(false)} />

          {/* Panel */}
          <div className="relative w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder="Buscar propiedades, contactos, leads…"
                className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              {buscando && (
                <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">Esc</kbd>
            </div>

            {/* Resultados */}
            <div className="max-h-96 overflow-y-auto p-2">
              {!tieneResultados && query.length >= 2 && !buscando && (
                <p className="py-8 text-center text-sm text-slate-400">Sin resultados para &quot;{query}&quot;</p>
              )}
              {!tieneResultados && query.length < 2 && (
                <p className="py-8 text-center text-sm text-slate-400">Escribí al menos 2 caracteres</p>
              )}

              {resultados.propiedades.length > 0 && (
                <Seccion titulo="Propiedades" icono="🏠"
                  items={resultados.propiedades.map((p) => ({
                    tipo: "prop", href: `/propiedades/${p.id}/editar`,
                    label: p.titulo,
                    sub: [TIPO_MAP[p.tipo], OP_MAP[p.operacion], p.barrio].filter(Boolean).join(" · "),
                    badge: p.estado,
                  }))}
                  globalItems={items} selIdx={selIdx}
                  onSelect={() => setAbierto(false)} router={router}
                />
              )}

              {resultados.contactos.length > 0 && (
                <Seccion titulo="Contactos" icono="👤"
                  items={resultados.contactos.map((c) => ({
                    tipo: "cont", href: `/contactos/${c.id}`,
                    label: c.nombre,
                    sub: [c.telefono, c.email].filter(Boolean).join(" · "),
                  }))}
                  globalItems={items} selIdx={selIdx}
                  onSelect={() => setAbierto(false)} router={router}
                />
              )}

              {resultados.leads.length > 0 && (
                <Seccion titulo="Leads" icono="📋"
                  items={resultados.leads.map((l) => ({
                    tipo: "lead", href: `/leads/${l.id}`,
                    label: l.contacto?.nombre,
                    sub: l.propiedad?.titulo || "Sin propiedad",
                  }))}
                  globalItems={items} selIdx={selIdx}
                  onSelect={() => setAbierto(false)} router={router}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              <span><kbd className="rounded border border-slate-200 px-1">↑↓</kbd> navegar</span>
              <span><kbd className="rounded border border-slate-200 px-1">↵</kbd> abrir</span>
              <span><kbd className="rounded border border-slate-200 px-1">Esc</kbd> cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Seccion({ titulo, icono, items, globalItems, selIdx, onSelect, router }) {
  return (
    <div className="mb-1">
      <p className="mb-1 px-2 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {icono} {titulo}
      </p>
      {items.map((item) => {
        const gIdx = globalItems.findIndex((g) => g.href === item.href);
        const activo = gIdx === selIdx;
        return (
          <button
            key={item.href}
            onClick={() => { router.push(item.href); onSelect(); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${activo ? "bg-accent/10 text-accent" : "hover:bg-slate-50 text-slate-700"}`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.label}</p>
              {item.sub && <p className="truncate text-xs text-slate-400">{item.sub}</p>}
            </div>
            {item.badge && (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] capitalize text-slate-500">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
