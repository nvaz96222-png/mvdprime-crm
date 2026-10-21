"use client";
import { useState } from "react";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const LABEL = "mb-1 block text-xs font-medium text-slate-600";

const INICIAL = {
  nombre: "", telefono: "", email: "",
  operacion: "", tipo: "apartamento",
  direccion: "", barrio: "", departamento: "Montevideo", piso: "",
  dormitorios: "", banos: "", detalle_banos: "", cocheras: "",
  m2_interiores: "", m2_exteriores: "",
  amueblado: "", mascotas: "",
  precio_venta: "", moneda_venta: "USD",
  precio_alquiler: "", moneda_alquiler: "UYU",
  gastos_comunes: "",
  disponibilidad: "", garantias: "",
  diferenciales: "", link_material: "",
  exclusividad: "", autoriza: false,
};

function Seccion({ titulo, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-navy">{titulo}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function SiNo({ label, value, onChange }) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <div className="flex gap-2">
        {[["si", "Sí"], ["no", "No"]].map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(value === v ? "" : v)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              value === v
                ? "border-accent bg-accent text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-accent"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FormCaptacion() {
  const [f, setF] = useState(INICIAL);
  const [hp, setHp] = useState("");
  const [estado, setEstado] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const conVenta = f.operacion === "venta" || f.operacion === "ambas";
  const conAlquiler = f.operacion === "alquiler" || f.operacion === "ambas";
  const listo = f.nombre.trim() && f.telefono.trim() && f.operacion && (f.direccion.trim() || f.barrio.trim()) && f.autoriza;

  async function enviar(e) {
    e.preventDefault();
    if (!listo) return;
    setEstado("loading");
    try {
      const res = await fetch("/api/captacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, _hp: hp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar");
      setEstado("ok");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrorMsg(err.message);
      setEstado("error");
    }
  }

  if (estado === "ok") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-green-800">¡Gracias! Recibimos la ficha.</p>
        <p className="mt-2 text-sm text-green-700">
          Ya la tenemos cargada. Te escribimos en breve para coordinar fotos y video.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      <input
        type="text" value={hp} onChange={(e) => setHp(e.target.value)}
        tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
      />

      <Seccion titulo="1. Tus datos">
        <div>
          <label className={LABEL}>Nombre y apellido <span className="text-red-500">*</span></label>
          <input className={INPUT} required value={f.nombre} onChange={set("nombre")} />
        </div>
        <div>
          <label className={LABEL}>Teléfono / WhatsApp <span className="text-red-500">*</span></label>
          <input className={INPUT} type="tel" required placeholder="09X XXX XXX" value={f.telefono} onChange={set("telefono")} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Email</label>
          <input className={INPUT} type="email" value={f.email} onChange={set("email")} />
        </div>
      </Seccion>

      <Seccion titulo="2. La propiedad">
        <div>
          <label className={LABEL}>¿Qué querés hacer? <span className="text-red-500">*</span></label>
          <select className={INPUT} required value={f.operacion} onChange={set("operacion")}>
            <option value="">Elegir…</option>
            <option value="venta">Vender</option>
            <option value="alquiler">Alquilar</option>
            <option value="ambas">Vender o alquilar</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Tipo</label>
          <select className={INPUT} value={f.tipo} onChange={set("tipo")}>
            <option value="apartamento">Apartamento</option>
            <option value="casa">Casa</option>
            <option value="local">Local</option>
            <option value="terreno">Terreno</option>
            <option value="garage">Garage</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Dirección (calle, número y entre calles) <span className="text-red-500">*</span></label>
          <input className={INPUT} placeholder="Ej: Maggiolo 477, entre B. Nardone y J. M. Sosa" value={f.direccion} onChange={set("direccion")} />
          <p className="mt-1 text-xs text-slate-400">No se publica exacta: en los avisos mostramos solo la zona.</p>
        </div>
        <div>
          <label className={LABEL}>Barrio</label>
          <input className={INPUT} placeholder="Ej: Punta Carretas" value={f.barrio} onChange={set("barrio")} />
        </div>
        <div>
          <label className={LABEL}>Departamento</label>
          <input className={INPUT} value={f.departamento} onChange={set("departamento")} />
        </div>
        <div>
          <label className={LABEL}>Piso</label>
          <input className={INPUT} placeholder="Ej: 6" value={f.piso} onChange={set("piso")} />
        </div>
        <div>
          <label className={LABEL}>Dormitorios</label>
          <input className={INPUT} inputMode="numeric" value={f.dormitorios} onChange={set("dormitorios")} />
        </div>
        <div>
          <label className={LABEL}>Baños</label>
          <input className={INPUT} inputMode="numeric" value={f.banos} onChange={set("banos")} />
        </div>
        <div>
          <label className={LABEL}>Detalle de baños</label>
          <input className={INPUT} placeholder="Ej: 1 en suite + 1 social" value={f.detalle_banos} onChange={set("detalle_banos")} />
        </div>
        <div>
          <label className={LABEL}>Cocheras</label>
          <input className={INPUT} inputMode="numeric" value={f.cocheras} onChange={set("cocheras")} />
        </div>
        <div>
          <label className={LABEL}>m² interiores</label>
          <input className={INPUT} inputMode="decimal" value={f.m2_interiores} onChange={set("m2_interiores")} />
        </div>
        <div>
          <label className={LABEL}>m² terraza / balcón / patio</label>
          <input className={INPUT} inputMode="decimal" value={f.m2_exteriores} onChange={set("m2_exteriores")} />
        </div>
        <SiNo label="¿Amueblado?" value={f.amueblado} onChange={set("amueblado")} />
        <SiNo label="¿Acepta mascotas?" value={f.mascotas} onChange={set("mascotas")} />
      </Seccion>

      <Seccion titulo="3. Precio y condiciones">
        {conVenta && (
          <div className="sm:col-span-2">
            <label className={LABEL}>Precio de venta</label>
            <div className="flex gap-2">
              <select className={`${INPUT} w-24`} value={f.moneda_venta} onChange={set("moneda_venta")}>
                <option>USD</option><option>UYU</option>
              </select>
              <input className={INPUT} inputMode="numeric" value={f.precio_venta} onChange={set("precio_venta")} />
            </div>
          </div>
        )}
        {conAlquiler && (
          <div className="sm:col-span-2">
            <label className={LABEL}>Precio de alquiler (por mes)</label>
            <div className="flex gap-2">
              <select className={`${INPUT} w-24`} value={f.moneda_alquiler} onChange={set("moneda_alquiler")}>
                <option>UYU</option><option>USD</option>
              </select>
              <input className={INPUT} inputMode="numeric" value={f.precio_alquiler} onChange={set("precio_alquiler")} />
            </div>
          </div>
        )}
        <div>
          <label className={LABEL}>Gastos comunes ($ por mes)</label>
          <input className={INPUT} inputMode="numeric" value={f.gastos_comunes} onChange={set("gastos_comunes")} />
        </div>
        <div>
          <label className={LABEL}>Disponible desde</label>
          <input className={INPUT} placeholder="Ej: ya / 1 de diciembre" value={f.disponibilidad} onChange={set("disponibilidad")} />
        </div>
        {conAlquiler && (
          <div className="sm:col-span-2">
            <label className={LABEL}>Garantías que aceptás</label>
            <input className={INPUT} placeholder="Ej: ANDA, CGN, Porto, depósito / a consultar" value={f.garantias} onChange={set("garantias")} />
          </div>
        )}
      </Seccion>

      <Seccion titulo="4. Lo que hace especial a tu propiedad">
        <div className="sm:col-span-2">
          <label className={LABEL}>¿Qué destacarías? (vista, luz, amenities, reformas, cercanías…)</label>
          <textarea className={`${INPUT} resize-none`} rows={4} value={f.diferenciales} onChange={set("diferenciales")} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Link a fotos o video (Google Drive, iCloud, WeTransfer)</label>
          <input className={INPUT} placeholder="https://drive.google.com/…" value={f.link_material} onChange={set("link_material")} />
          <p className="mt-1 text-xs text-slate-400">Mandá los archivos originales, no por WhatsApp (pierden calidad).</p>
        </div>
      </Seccion>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-navy">5. Autorización</h2>
        <SiNo label="¿Nos das la exclusividad de la comercialización?" value={f.exclusividad} onChange={set("exclusividad")} />
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0D7377]"
            checked={f.autoriza} onChange={(e) => setF((x) => ({ ...x, autoriza: e.target.checked }))}
          />
          <span>
            Soy el propietario (o estoy autorizado) y autorizo a MVDPrime Real Estate a comercializar y
            publicar esta propiedad. <span className="text-red-500">*</span>
          </span>
        </label>
      </section>

      {estado === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={!listo || estado === "loading"}
        className="w-full rounded-xl bg-accent py-3.5 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50"
      >
        {estado === "loading" ? "Enviando…" : "Enviar ficha"}
      </button>
    </form>
  );
}
