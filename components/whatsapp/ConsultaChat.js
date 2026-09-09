"use client";

import { useState } from "react";

// =====================================================================
// Chat de consultas en lenguaje natural sobre las conversaciones.
//
// No manda mensajes a Claude por su cuenta: solo cuando el usuario
// pregunta. Muestra el costo real de cada consulta para que se vea que
// el diseño es barato, en vez de tener que confiar en que lo es.
// =====================================================================

const EJEMPLOS = [
  "¿Qué clientes preguntaron por financiación en los últimos 30 días?",
  "Mostrame los clientes que escribieron y todavía no recibieron respuesta",
  "¿Cuáles fueron las consultas más frecuentes esta semana?",
  "¿Qué clientes necesitan seguimiento?",
];

export default function ConsultaChat({ hayDatos }) {
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  async function preguntar(texto) {
    const p = (texto ?? pregunta).trim();
    if (!p || cargando) return;

    setPregunta(p);
    setCargando(true);
    setError(null);
    setResultado(null);

    try {
      const res = await fetch("/api/whatsapp/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: p }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error || "No se pudo consultar");
      setResultado(datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3">
        <h2 className="font-semibold text-navy">Preguntale a Claude</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Busca primero en la base y le manda a Claude solo las conversaciones relevantes.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          preguntar();
        }}
        className="flex gap-2"
      >
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="¿Qué clientes preguntaron por financiación?"
          disabled={cargando}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-accent focus:outline-none disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={cargando || !pregunta.trim()}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cargando ? "Buscando…" : "Preguntar"}
        </button>
      </form>

      {!resultado && !cargando && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EJEMPLOS.map((e) => (
            <button
              key={e}
              onClick={() => preguntar(e)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-accent hover:text-accent"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {!hayDatos && (
        <p className="mt-3 text-xs text-slate-400">
          Todavía no hay mensajes guardados, así que las respuestas van a venir vacías.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {resultado && (
        <div className="mt-4">
          <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-800">
            {resultado.respuesta}
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
              Cómo se resolvió · US${resultado.diagnostico?.costoUSD?.toFixed(4)} ·{" "}
              {resultado.diagnostico?.ms} ms
            </summary>
            <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p>
                <strong>Modo:</strong> {resultado.diagnostico?.modo} · ventana{" "}
                {resultado.diagnostico?.dias} días
              </p>
              {resultado.plan?.terminos?.length > 0 && (
                <p>
                  <strong>Términos buscados:</strong> {resultado.plan.terminos.join(", ")}
                </p>
              )}
              <p>
                <strong>Conversaciones enviadas a Claude:</strong>{" "}
                {resultado.diagnostico?.incluidas ?? resultado.diagnostico?.conversaciones ?? 0}
                {resultado.diagnostico?.omitidas > 0 &&
                  ` (${resultado.diagnostico.omitidas} omitidas por presupuesto)`}
              </p>
              <p>
                <strong>Tokens:</strong> {resultado.diagnostico?.tokensEntrada} entrada /{" "}
                {resultado.diagnostico?.tokensSalida} salida
              </p>
              <p>
                <strong>Modelos:</strong> {resultado.diagnostico?.modeloPlanner} (plan) +{" "}
                {resultado.diagnostico?.modeloRespuesta} (respuesta)
              </p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
