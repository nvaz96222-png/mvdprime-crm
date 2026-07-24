/**
 * TipologiaCard — componente visual puro.
 * Sin acciones (edit/delete). Diseñado para reutilizar en la web pública.
 *
 * Props:
 *   tipologia  — registro de proyecto_tipologias
 *   className  — clases adicionales opcionales (para variantes en web pública)
 */

function formatDormitorios(d) {
  if (d === null || d === undefined) return null;
  if (d === 0) return "Mono";
  if (d === 1) return "1 dorm.";
  return `${d} dorm.`;
}

function formatSuperficie(desde, hasta) {
  if (!desde && !hasta) return null;
  if (desde && hasta) return `${desde}–${hasta} m²`;
  return `${desde || hasta} m²`;
}

function formatPrecio(desde, hasta, moneda) {
  if (!desde && !hasta) return null;
  const pref = moneda === "USD" ? "USD " : "$U ";
  const fmt = (n) => Number(n).toLocaleString("es-UY");
  if (desde && hasta) return `${pref}${fmt(desde)} – ${fmt(hasta)}`;
  return `${pref}${fmt(desde || hasta)}`;
}

export default function TipologiaCard({ tipologia: t, className = "" }) {
  const dorm = formatDormitorios(t.dormitorios);
  const sup = formatSuperficie(t.superficie_desde, t.superficie_hasta);
  const precio = formatPrecio(t.precio_desde, t.precio_hasta, t.moneda);

  const disp = t.unidades_disponibles ?? null;
  const total = t.unidades_total ?? null;
  const agotado = disp !== null && disp === 0;
  const porcentajeDisp = total > 0 && disp !== null ? (disp / total) * 100 : null;

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        agotado
          ? "border-slate-200 bg-slate-50 opacity-70"
          : "border-slate-200 bg-white hover:border-accent/30 hover:shadow-sm"
      } ${className}`}
    >
      {/* Encabezado: nombre + disponibilidad */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-navy">{t.nombre}</h3>
          {dorm && (
            <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-medium text-navy">
              {dorm}
            </span>
          )}
          {agotado && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600">
              Agotado
            </span>
          )}
        </div>

        {(disp !== null || total !== null) && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-navy">
              {disp ?? "—"}{total !== null ? ` / ${total}` : ""}
            </p>
            <p className="text-[11px] text-slate-400">disponibles</p>
          </div>
        )}
      </div>

      {/* Detalles: superficie + precio */}
      {(sup || precio) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {sup && (
            <span className="text-xs text-slate-500">
              <span className="font-medium text-slate-600">Sup.</span> {sup}
            </span>
          )}
          {precio && (
            <span className="text-xs font-semibold text-accent">{precio}</span>
          )}
        </div>
      )}

      {/* Barra de disponibilidad */}
      {(porcentajeDisp !== null || agotado) && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${
              agotado ? "bg-red-400" : porcentajeDisp < 25 ? "bg-amber-400" : "bg-accent"
            }`}
            style={{ width: agotado ? "100%" : `${porcentajeDisp}%` }}
          />
        </div>
      )}
    </div>
  );
}
