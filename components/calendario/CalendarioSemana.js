"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const HORAS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 - 20:00
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const ESTADO_COLOR = {
  pendiente: "bg-amber-100 border-amber-400 text-amber-800",
  realizada: "bg-green-100 border-green-400 text-green-800",
  cancelada: "bg-slate-100 border-slate-400 text-slate-500 line-through",
};

function formatHora(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function minutosDesde8(iso) {
  const d = new Date(iso);
  return (d.getHours() - 8) * 60 + d.getMinutes();
}

function duracionMinutos(inicio, fin) {
  return (new Date(fin) - new Date(inicio)) / 60000;
}

export default function CalendarioSemana({ visitas, agentes, lunesISO, domingoISO, offsetSemana }) {
  const router = useRouter();
  const [filtroAgente, setFiltroAgente] = useState("");

  const lunes = new Date(lunesISO);
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d;
  });

  const visitasFiltradas = useMemo(
    () => filtroAgente ? visitas.filter((v) => v.agente_id === filtroAgente) : visitas,
    [visitas, filtroAgente]
  );

  // Agrupar visitas por día (0=lunes … 6=domingo)
  const visitasPorDia = useMemo(() => {
    const map = Array.from({ length: 7 }, () => []);
    for (const v of visitasFiltradas) {
      const d = new Date(v.fecha_inicio);
      const diff = Math.round((d - lunes) / 86400000);
      if (diff >= 0 && diff < 7) map[diff].push(v);
    }
    return map;
  }, [visitasFiltradas, lunes]);

  const hoy = new Date();
  const totalMinutos = 12 * 60; // 8:00-20:00

  function navSemana(delta) {
    const params = new URLSearchParams();
    params.set("semana", String(offsetSemana + delta));
    router.push(`/calendario?${params.toString()}`);
  }

  const mesLabel = lunes.toLocaleDateString("es-UY", { month: "long", year: "numeric" });

  return (
    <div>
      {/* Controles */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white shadow-sm">
          <button
            onClick={() => navSemana(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-l-lg text-slate-500 hover:bg-slate-50 hover:text-navy"
          >
            ‹
          </button>
          <button
            onClick={() => router.push("/calendario")}
            className="border-x border-slate-200 px-3 text-sm font-medium capitalize text-slate-700 hover:bg-slate-50"
            style={{ height: "36px" }}
          >
            {mesLabel}
          </button>
          <button
            onClick={() => navSemana(1)}
            className="flex h-9 w-9 items-center justify-center rounded-r-lg text-slate-500 hover:bg-slate-50 hover:text-navy"
          >
            ›
          </button>
        </div>

        {agentes.length > 1 && (
          <select
            value={filtroAgente}
            onChange={(e) => setFiltroAgente(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-accent"
          >
            <option value="">Todos los agentes</option>
            {agentes.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        )}

        <span className="ml-auto text-sm text-slate-400">
          {visitasFiltradas.length} visita{visitasFiltradas.length !== 1 ? "s" : ""} esta semana
        </span>
      </div>

      {/* Grid calendario */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Cabecera días */}
        <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          <div className="border-r border-slate-100" />
          {diasSemana.map((d, i) => {
            const esHoy = d.toDateString() === hoy.toDateString();
            return (
              <div
                key={i}
                className={`border-r border-slate-100 py-2 text-center last:border-r-0 ${esHoy ? "bg-accent/5" : ""}`}
              >
                <p className="text-xs font-medium text-slate-400">{DIAS[i]}</p>
                <p className={`text-lg font-bold ${esHoy ? "text-accent" : "text-slate-700"}`}>
                  {d.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Grilla horaria */}
        <div className="relative" style={{ minHeight: "600px" }}>
          <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            {/* Columna horas */}
            <div>
              {HORAS.map((h) => (
                <div key={h} className="flex items-start border-b border-slate-100 pr-2 text-right" style={{ height: "60px" }}>
                  <span className="mt-[-8px] w-full text-[11px] text-slate-400">{h}:00</span>
                </div>
              ))}
            </div>

            {/* Columnas días */}
            {diasSemana.map((d, dIdx) => {
              const esHoy = d.toDateString() === hoy.toDateString();
              return (
                <div
                  key={dIdx}
                  className={`relative border-l border-slate-100 ${esHoy ? "bg-accent/[0.02]" : ""}`}
                >
                  {/* Líneas horarias */}
                  {HORAS.map((h) => (
                    <div key={h} className="border-b border-slate-100" style={{ height: "60px" }} />
                  ))}

                  {/* Visitas del día */}
                  {visitasPorDia[dIdx].map((v) => {
                    const top = (minutosDesde8(v.fecha_inicio) / totalMinutos) * 100;
                    const height = Math.max((duracionMinutos(v.fecha_inicio, v.fecha_fin) / totalMinutos) * 100, 3);
                    const colorClass = ESTADO_COLOR[v.estado] || ESTADO_COLOR.pendiente;

                    return (
                      <Link
                        key={v.id}
                        href={`/calendario/${v.id}/editar`}
                        className={`absolute left-1 right-1 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-[11px] leading-tight shadow-sm hover:opacity-90 transition ${colorClass}`}
                        style={{ top: `${top}%`, height: `${height}%`, minHeight: "24px" }}
                      >
                        <p className="font-semibold truncate">
                          {formatHora(v.fecha_inicio)} {v.lead?.contacto?.nombre || "Visita"}
                        </p>
                        {v.propiedad?.titulo && (
                          <p className="truncate opacity-75">{v.propiedad.titulo}</p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lista compacta si hay muchas visitas */}
      {visitasFiltradas.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-700">Visitas de la semana</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {visitasFiltradas.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/calendario/${v.id}/editar`}
                  className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <div className="w-20 shrink-0">
                    <p className="font-medium text-navy">
                      {new Date(v.fecha_inicio).toLocaleDateString("es-UY", { weekday: "short", day: "numeric" })}
                    </p>
                    <p className="text-xs text-slate-400">{formatHora(v.fecha_inicio)} – {formatHora(v.fecha_fin)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">
                      {v.lead?.contacto?.nombre || "Sin contacto"}
                    </p>
                    {v.propiedad?.titulo && (
                      <p className="text-xs text-slate-400 truncate">{v.propiedad.titulo}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {v.agente?.nombre && (
                      <p className="text-xs text-slate-400">{v.agente.nombre}</p>
                    )}
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      v.estado === "realizada" ? "bg-green-100 text-green-700" :
                      v.estado === "cancelada" ? "bg-slate-100 text-slate-500" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {v.estado.charAt(0).toUpperCase() + v.estado.slice(1)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
