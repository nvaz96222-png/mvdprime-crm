"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LEAD_ETAPA_MAP } from "@/lib/constants";
import { ventanaAbierta, restanteVentana } from "@/lib/chats/ventana";
import { IconAtras, IconTelefono, IconEnviar, IconCasa, IconFicha, IconCanal, IconExterno, Tildes } from "./iconos";
import { horaCorta, etiquetaDia, claveDia, iniciales, nombreConversacion, telefonoLegible, telefonoParaLlamar, CANAL_LABEL } from "./formato";

const TIPO_LABEL = {
  imagen: "Foto", audio: "Audio", video: "Video", documento: "Documento",
  ubicacion: "Ubicación", plantilla: "Plantilla", otro: "Mensaje no soportado",
};

// Panel derecho: encabezado, mensajes y caja de texto (estilo WhatsApp).
export default function VistaChat({
  conv, estado, perfil, usuariosMap, propiedadesMap,
  onVolver, onEnviar, onReintentar, onCargarAnteriores, onTogglePanel, onAbrirFicha,
  borrador, setBorrador,
}) {
  const scrollRef = useRef(null);
  const pegadoAbajo = useRef(true);
  const alturaAntes = useRef(null);
  const mensajes = estado?.mensajes || [];
  const ultimoId = mensajes[mensajes.length - 1]?.id;
  const ultimoEstado = mensajes[mensajes.length - 1]?.estado;
  const abierta = ventanaAbierta(conv);

  // Al abrir otra conversación, ir al final.
  useEffect(() => { pegadoAbajo.current = true; }, [conv.id]);

  // Mantener el scroll: al final si ya estaba abajo; fijo si se cargaron anteriores.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (alturaAntes.current != null) {
      el.scrollTop = el.scrollHeight - alturaAntes.current;
      alturaAntes.current = null;
    } else if (pegadoAbajo.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [mensajes.length, ultimoId, ultimoEstado, conv.id]);

  function onScroll() {
    const el = scrollRef.current;
    if (el) pegadoAbajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function cargarAnteriores() {
    alturaAntes.current = scrollRef.current?.scrollHeight ?? null;
    onCargarAnteriores();
  }

  const nombre = nombreConversacion(conv);
  const etapa = conv.lead?.etapa ? LEAD_ETAPA_MAP[conv.lead.etapa] : null;
  const propiedad = conv.lead?.propiedad_id ? propiedadesMap[conv.lead.propiedad_id] : null;
  const telefono = conv.contacto?.telefono || (conv.canal === "whatsapp" ? conv.wa_id : null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Encabezado */}
      <header className="flex items-center gap-2 border-b border-slate-200 bg-[#f0f2f5] px-2 py-2 sm:px-3">
        <button type="button" onClick={onVolver} aria-label="Volver a la lista"
          className="rounded-full p-1.5 text-slate-600 hover:bg-slate-200 md:hidden">
          <IconAtras size={22} />
        </button>
        <button type="button" onClick={onTogglePanel} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/10 text-sm font-semibold text-navy">
            {iniciales(nombre)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{nombre}</p>
            <p className="flex items-center gap-1 truncate text-xs text-slate-500">
              <IconCanal canal={conv.canal} size={12} />
              <span>{CANAL_LABEL[conv.canal]}</span>
              {etapa && <span>· {etapa.label}</span>}
              {propiedad && <span className="truncate">· {propiedad.titulo}</span>}
            </p>
          </div>
        </button>
        {telefono && (
          <a href={`tel:${telefonoParaLlamar(telefono)}`} aria-label={`Llamar a ${nombre}`}
            className="rounded-full p-2 text-slate-600 hover:bg-slate-200" title={`Llamar ${telefonoLegible(telefono)}`}>
            <IconTelefono size={20} />
          </a>
        )}
        <button type="button" onClick={onTogglePanel} aria-label="Ver ficha del lead" title="Ficha del lead"
          className="rounded-full p-2 text-slate-600 hover:bg-slate-200">
          <IconFicha size={20} />
        </button>
      </header>

      {/* Mensajes */}
      <div ref={scrollRef} onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto bg-[#efeae2] px-3 py-3 sm:px-[6%]">
        {estado?.hayMas && (
          <div className="mb-3 text-center">
            <button type="button" onClick={cargarAnteriores} disabled={estado.cargando}
              className="rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600 shadow-sm hover:bg-white">
              {estado.cargando ? "Cargando…" : "Ver mensajes anteriores"}
            </button>
          </div>
        )}
        {!estado || (estado.cargando && !mensajes.length) ? (
          <p className="py-10 text-center text-sm text-slate-500">Cargando mensajes…</p>
        ) : estado.error ? (
          <p className="py-10 text-center text-sm text-red-600">{estado.error}</p>
        ) : mensajes.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Todavía no hay mensajes en esta conversación.</p>
        ) : (
          mensajes.map((m, i) => {
            const nuevoDia = i === 0 || claveDia(m.created_at) !== claveDia(mensajes[i - 1].created_at);
            const mismoLado = i > 0 && !nuevoDia && mensajes[i - 1].direccion === m.direccion;
            return (
              <Fragment key={m.id}>
                {nuevoDia && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500 shadow-sm">
                      {etiquetaDia(m.created_at)}
                    </span>
                  </div>
                )}
                <Burbuja m={m} agrupada={mismoLado} perfil={perfil} usuariosMap={usuariosMap} onReintentar={onReintentar} />
              </Fragment>
            );
          })
        )}
      </div>

      {/* Caja de texto o aviso de ventana cerrada */}
      {abierta ? (
        <Composer conv={conv} borrador={borrador} setBorrador={setBorrador} onEnviar={onEnviar} onAbrirFicha={onAbrirFicha} />
      ) : (
        <VentanaCerrada conv={conv} />
      )}
    </div>
  );
}

function Burbuja({ m, agrupada, perfil, usuariosMap, onReintentar }) {
  const saliente = m.direccion === "saliente";
  let firma = null;
  if (saliente) {
    if (m.autor === "ia") firma = "Agente IA";
    else if (m.autor === "app") firma = "Desde el celular";
    else if (m.usuario_id && m.usuario_id !== perfil?.id) firma = usuariosMap[m.usuario_id]?.nombre || "Equipo";
  }
  const etiquetaTipo = m.tipo && m.tipo !== "texto" ? TIPO_LABEL[m.tipo] || "Adjunto" : null;

  return (
    <div className={`flex ${saliente ? "justify-end" : "justify-start"} ${agrupada ? "mt-0.5" : "mt-2"}`}>
      <div
        className={`relative max-w-[85%] rounded-lg px-2.5 pb-1 pt-1.5 text-[14.5px] leading-snug text-slate-900 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] sm:max-w-[65%] ${
          saliente ? "bg-[#d9fdd3]" : "bg-white"
        } ${m.estado === "fallido" ? "ring-1 ring-red-300" : ""}`}
      >
        {firma && <p className={`mb-0.5 text-[11px] font-semibold ${m.autor === "ia" ? "text-violet-700" : "text-accent-dark"}`}>{firma}</p>}
        {etiquetaTipo && (
          <p className="mb-0.5 inline-flex items-center gap-1 rounded bg-black/5 px-1.5 py-0.5 text-xs text-slate-600">{etiquetaTipo}</p>
        )}
        {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
        <div className="-mb-0.5 mt-0.5 flex items-center justify-end gap-1 text-[11px] text-slate-500">
          <span>{horaCorta(m.created_at)}</span>
          {saliente && <Tildes estado={m.estado} />}
        </div>
        {m.estado === "fallido" && (
          <div className="mt-1 border-t border-red-200 pt-1 text-[11px] text-red-700">
            <p>{m.error || "No se pudo enviar."}</p>
            {m.reintentable && (
              <button type="button" onClick={() => onReintentar(m)} className="mt-0.5 font-semibold underline">Reintentar</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({ conv, borrador, setBorrador, onEnviar, onAbrirFicha }) {
  const ref = useRef(null);
  const [tactil, setTactil] = useState(false);
  const restanteH = Math.ceil(restanteVentana(conv) / 3600000);

  useEffect(() => {
    setTactil(window.matchMedia?.("(pointer: coarse)").matches || false);
  }, []);

  // Altura automática (hasta ~6 líneas).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [borrador]);

  function enviar() {
    const t = borrador.trim();
    if (!t) return;
    onEnviar(t);
    setBorrador("");
    ref.current?.focus();
  }

  function onKeyDown(e) {
    // En computadora Enter envía y Shift+Enter hace salto de línea.
    // En el celular Enter es salto de línea (como en WhatsApp) y se envía con el botón.
    if (e.key === "Enter" && !e.shiftKey && !tactil && !e.nativeEvent.isComposing) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <div className="border-t border-slate-200 bg-[#f0f2f5] px-2 py-2 sm:px-3">
      {restanteH <= 3 && (
        <p className="mb-1.5 px-1 text-[11px] text-amber-700">
          La ventana de 24 h se cierra en menos de {restanteH} h: después vas a necesitar una plantilla o la app del celular.
        </p>
      )}
      <div className="flex items-end gap-2">
        <button type="button" onClick={onAbrirFicha} aria-label="Enviar ficha de una propiedad" title="Enviar ficha de una propiedad"
          className="mb-0.5 shrink-0 rounded-full p-2 text-slate-600 hover:bg-slate-200">
          <IconCasa size={22} />
        </button>
        <textarea
          ref={ref}
          rows={1}
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribí un mensaje"
          className="max-h-36 min-h-[42px] flex-1 resize-none rounded-lg border-0 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none ring-accent/40 placeholder:text-slate-400 focus:ring-2"
        />
        <button type="button" onClick={enviar} disabled={!borrador.trim()} aria-label="Enviar"
          className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-dark disabled:bg-slate-300">
          <IconEnviar size={18} />
        </button>
      </div>
    </div>
  );
}

function VentanaCerrada({ conv }) {
  const waLink = conv.canal === "whatsapp" && conv.wa_id ? `https://wa.me/${conv.wa_id}` : null;
  return (
    <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Pasaron más de 24 h desde el último mensaje del cliente</p>
      <p className="mt-0.5 text-[13px] text-amber-800">
        Meta no permite mandar texto libre desde el CRM hasta que el cliente vuelva a escribir.
        {waLink
          ? " Podés retomar el contacto desde la app de WhatsApp Business del celular (es gratis y queda en este historial)."
          : " Las plantillas para retomar el contacto llegan en la próxima actualización."}
      </p>
      {waLink && (
        <a href={waLink} target="_blank" rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1fa855]">
          Escribir desde WhatsApp <IconExterno size={14} />
        </a>
      )}
    </div>
  );
}
