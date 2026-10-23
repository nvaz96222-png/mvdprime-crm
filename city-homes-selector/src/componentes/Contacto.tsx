import { useState } from "react";
import type { Unidad } from "../tipos";
import { proyecto } from "../datos/proyecto";
import { ETIQUETA_ESTADO } from "../datos";
import { precioTexto } from "../utiles";

interface Props {
  unidad: Unidad | null;
  alCerrar: () => void;
}

export default function Contacto({ unidad, alCerrar }: Props) {
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviado, setEnviado] = useState(false);

  const asunto = unidad
    ? `Consulta por ${unidad.etiqueta} — City Homes`
    : "Consulta — City Homes";

  const cuerpo = [
    unidad &&
      `Unidad: ${unidad.etiqueta} (${unidad.nivel}, ${unidad.tipologia}) — ${ETIQUETA_ESTADO[unidad.estado]} — ${precioTexto(unidad)}`,
    `Nombre: ${nombre || "—"}`,
    `Contacto: ${contacto || "—"}`,
    "",
    mensaje || "Quisiera recibir más información sobre esta unidad.",
  ]
    .filter(Boolean)
    .join("\n");

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const { email, whatsapp } = proyecto.contacto;
    if (email) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    } else if (whatsapp) {
      window.open(
        `https://wa.me/${whatsapp}?text=${encodeURIComponent(`${asunto}\n\n${cuerpo}`)}`,
        "_blank",
        "noopener",
      );
    }
    setEnviado(true);
  };

  const hayCanal = Boolean(proyecto.contacto.email || proyecto.contacto.whatsapp);

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={asunto}
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
    >
      <div className="modal__panel">
        <div className="modal__cabecera">
          <div>
            <p className="ojo">{proyecto.contacto.equipo}</p>
            <h3 style={{ fontSize: 24, marginTop: 6 }}>
              {unidad ? `Consultar por ${unidad.etiqueta}` : "Consultar por el proyecto"}
            </h3>
            {unidad && (
              <p style={{ color: "var(--tinta-media)", marginTop: 6 }}>
                {unidad.nivel} · {unidad.tipologia} · {precioTexto(unidad)}
              </p>
            )}
          </div>
          <button className="cerrar" onClick={alCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>

        {enviado ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p>
              {hayCanal
                ? "Abrimos tu aplicación de mensajes con la consulta preparada."
                : "Esta demo todavía no tiene canal de envío configurado. Copiá la consulta y enviála por el medio que prefieras."}
            </p>
            <pre className="consulta-compuesta">{`${asunto}\n\n${cuerpo}`}</pre>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="boton"
                onClick={() => navigator.clipboard?.writeText(`${asunto}\n\n${cuerpo}`)}
              >
                Copiar consulta
              </button>
              <button className="boton boton--fantasma" onClick={alCerrar}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form className="formulario" onSubmit={enviar}>
            <label>
              <span className="campo__etiqueta">Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </label>
            <label>
              <span className="campo__etiqueta">Teléfono o correo</span>
              <input value={contacto} onChange={(e) => setContacto(e.target.value)} required />
            </label>
            <label>
              <span className="campo__etiqueta">Mensaje</span>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Quisiera coordinar una visita y conocer la forma de pago."
              />
            </label>
            <button className="boton boton--bloque" type="submit">
              Enviar consulta
            </button>
            <p className="detalle-fuentes">
              Los datos se usan sólo para responder esta consulta.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
