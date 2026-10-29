"use client";

import { useState } from "react";
import SimuladorIA from "./SimuladorIA";

const DIAS = [
  { v: 1, l: "Lun" }, { v: 2, l: "Mar" }, { v: 3, l: "Mié" }, { v: 4, l: "Jue" },
  { v: 5, l: "Vie" }, { v: 6, l: "Sáb" }, { v: 7, l: "Dom" },
];

// Precio aproximado por millón de tokens del modelo por defecto (Claude Haiku 4.5).
const USD_POR_MTOK = { entrada: 1, salida: 5 };

export default function ConfigAgente({ configInicial, sinMigracion, uso, propiedades, modeloDefault, tieneApiKey }) {
  const [cfg, setCfg] = useState(() => ({
    ...configInicial,
    horario_desde: configInicial.horario_desde?.slice(0, 5) || "",
    horario_hasta: configInicial.horario_hasta?.slice(0, 5) || "",
  }));
  const [guardando, setGuardando] = useState(false);
  const [estado, setEstado] = useState(null); // {tipo:'ok'|'error', texto}
  const set = (campo, valor) => setCfg((c) => ({ ...c, [campo]: valor }));

  async function guardar() {
    setGuardando(true);
    setEstado(null);
    try {
      const res = await fetch("/api/ia/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setCfg({ ...data.config, horario_desde: data.config.horario_desde?.slice(0, 5) || "", horario_hasta: data.config.horario_hasta?.slice(0, 5) || "" });
      setEstado({ tipo: "ok", texto: "Configuración guardada." });
    } catch (e) {
      setEstado({ tipo: "error", texto: e.message });
    } finally {
      setGuardando(false);
    }
  }

  const costo = (uso.input_tokens / 1e6) * USD_POR_MTOK.entrada + (uso.output_tokens / 1e6) * USD_POR_MTOK.salida;
  const preguntas = cfg.preguntas || [];

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Agente IA</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Responde a los clientes con los datos reales de cada propiedad, hace las preguntas de filtrado y te pasa el chat cuando hace falta.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cfg.activo ? "bg-violet-100 text-violet-800" : "bg-slate-200 text-slate-600"}`}>
          {cfg.activo ? "Encendido" : "Apagado"}
        </span>
      </div>

      {sinMigracion && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Falta correr la migración <code className="rounded bg-white px-1">supabase/migrations/20261029_agente_ia.sql</code> en Supabase.
          Hasta entonces no se puede guardar la configuración y el agente no responde.
        </div>
      )}
      {!tieneApiKey && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Falta la variable <code className="rounded bg-white px-1">ANTHROPIC_API_KEY</code> en Vercel.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Tarjeta titulo="Encendido">
            <Interruptor
              valor={cfg.activo}
              onChange={(v) => set("activo", v)}
              titulo="Agente IA encendido"
              detalle="Interruptor general. Apagado, no responde en ningún chat (aunque el chat tenga la IA activa)."
            />
            <Interruptor
              valor={cfg.activar_en_nuevas}
              onChange={(v) => set("activar_en_nuevas", v)}
              titulo="Atender sola las conversaciones nuevas"
              detalle="Prende la IA automáticamente cuando un cliente escribe por primera vez. Si no, la prendés vos chat por chat con el botón “IA” de la bandeja."
            />
          </Tarjeta>

          <Tarjeta titulo="Cómo se presenta y cómo habla">
            <Campo titulo="Nombre del asistente">
              <input value={cfg.nombre_asistente || ""} onChange={(e) => set("nombre_asistente", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="el asistente de MVD Prime" />
            </Campo>
            <Campo titulo="Tono" ayuda="Ej.: cercano y profesional, frases cortas, sin emojis.">
              <textarea rows={2} value={cfg.tono || ""} onChange={(e) => set("tono", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </Campo>
            <Campo titulo="Mensaje de bienvenida (opcional)" ayuda="El agente lo adapta en su primer mensaje.">
              <textarea rows={2} value={cfg.mensaje_bienvenida || ""} onChange={(e) => set("mensaje_bienvenida", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="¡Hola! Soy el asistente virtual de MVD Prime. Te ayudo con la consulta y después te contacta un asesor." />
            </Campo>
          </Tarjeta>

          <Tarjeta titulo="Preguntas de filtrado" ayuda="Las hace de a una o dos, de forma natural, y no repite lo que el cliente ya contestó.">
            <div className="space-y-2">
              {preguntas.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right text-xs text-slate-400">{i + 1}.</span>
                  <textarea rows={1} value={p}
                    onChange={(e) => set("preguntas", preguntas.map((x, j) => (j === i ? e.target.value : x)))}
                    className="min-h-[38px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <div className="flex shrink-0 flex-col">
                    <button type="button" aria-label="Subir" disabled={i === 0} className="px-1 text-slate-400 hover:text-navy disabled:opacity-30"
                      onClick={() => { const a = [...preguntas]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set("preguntas", a); }}>▲</button>
                    <button type="button" aria-label="Bajar" disabled={i === preguntas.length - 1} className="px-1 text-slate-400 hover:text-navy disabled:opacity-30"
                      onClick={() => { const a = [...preguntas]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; set("preguntas", a); }}>▼</button>
                  </div>
                  <button type="button" aria-label="Quitar pregunta" className="mt-1.5 px-1 text-slate-400 hover:text-red-600"
                    onClick={() => set("preguntas", preguntas.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              {preguntas.length < 15 && (
                <button type="button" onClick={() => set("preguntas", [...preguntas, ""])}
                  className="text-sm font-semibold text-accent hover:underline">+ Agregar pregunta</button>
              )}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Horario y límites">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo titulo="Responde desde" ayuda="Vacío = todo el día.">
                <input type="time" value={cfg.horario_desde} onChange={(e) => set("horario_desde", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </Campo>
              <Campo titulo="Hasta">
                <input type="time" value={cfg.horario_hasta} onChange={(e) => set("horario_hasta", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </Campo>
            </div>
            <Campo titulo="Días">
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map((d) => {
                  const on = (cfg.dias_activos || []).includes(d.v);
                  return (
                    <button key={d.v} type="button"
                      onClick={() => set("dias_activos", on ? cfg.dias_activos.filter((x) => x !== d.v) : [...(cfg.dias_activos || []), d.v])}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-accent text-white" : "bg-slate-100 text-slate-500"}`}>
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo titulo="Máx. mensajes de la IA por chat" ayuda="Al llegar al tope, te pasa el chat.">
                <input type="number" min={1} max={50} value={cfg.max_mensajes_conversacion}
                  onChange={(e) => set("max_mensajes_conversacion", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </Campo>
              <Campo titulo="Máx. mensajes de la IA por día" ayuda="Tope de costo diario.">
                <input type="number" min={1} max={2000} value={cfg.max_mensajes_dia}
                  onChange={(e) => set("max_mensajes_dia", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Instrucciones extra (opcional)" ayuda="Reglas propias de MVD Prime: qué decir de la comisión, horarios de visita, etc.">
            <textarea rows={4} value={cfg.instrucciones_extra || ""} onChange={(e) => set("instrucciones_extra", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Ej.: Las visitas son de lunes a sábado de 10 a 18 h. No informes la comisión: derivá a un asesor." />
          </Tarjeta>

          <Tarjeta titulo="Uso en los últimos 30 días">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Dato titulo="Respuestas" valor={uso.respuestas} />
              <Dato titulo="Chats derivados" valor={uso.derivaciones} />
              <Dato titulo="Errores" valor={uso.errores} />
              <Dato titulo="Costo aprox." valor={`US$ ${costo.toFixed(2)}`} />
            </div>
            <p className="text-xs text-slate-400">
              Modelo: {cfg.modelo || modeloDefault}. {Math.round(uso.input_tokens / 1000)} mil tokens de entrada y {Math.round(uso.output_tokens / 1000)} mil de salida
              (incluye {uso.simulaciones} pruebas del simulador). El costo es una estimación; el valor exacto está en la consola de Anthropic.
            </p>
          </Tarjeta>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <SimuladorIA propiedades={propiedades} config={cfg} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-3">
          {estado && (
            <p className={`text-sm ${estado.tipo === "ok" ? "text-green-700" : "text-red-700"}`}>{estado.texto}</p>
          )}
          <button type="button" onClick={guardar} disabled={guardando || sinMigracion}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:bg-slate-300">
            {guardando ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tarjeta({ titulo, ayuda, children }) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="font-semibold text-navy">{titulo}</h2>
        {ayuda && <p className="mt-0.5 text-xs text-slate-500">{ayuda}</p>}
      </div>
      {children}
    </section>
  );
}

function Campo({ titulo, ayuda, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{titulo}</span>
      {children}
      {ayuda && <span className="mt-1 block text-[11px] text-slate-400">{ayuda}</span>}
    </label>
  );
}

function Interruptor({ valor, onChange, titulo, detalle }) {
  return (
    <button type="button" role="switch" aria-checked={!!valor} onClick={() => onChange(!valor)}
      className="flex w-full items-start gap-3 text-left">
      <span className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${valor ? "bg-accent" : "bg-slate-300"}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition ${valor ? "translate-x-5" : ""}`} />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-800">{titulo}</span>
        <span className="block text-xs text-slate-500">{detalle}</span>
      </span>
    </button>
  );
}

function Dato({ titulo, valor }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] text-slate-500">{titulo}</p>
      <p className="mt-0.5 text-lg font-semibold text-navy">{valor}</p>
    </div>
  );
}
