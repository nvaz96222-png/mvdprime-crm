"use client";

// =====================================================================
// Bandeja de chats estilo WhatsApp (Fase 2a).
//
// · Escritorio: lista a la izquierda, chat al centro, ficha del lead a la
//   derecha (opcional).
// · Celular: primero la lista; al tocar un chat se abre a pantalla completa.
//
// Estado local + Supabase Realtime (conversaciones y mensajes). Los envíos
// son optimistas: el mensaje aparece al instante con un reloj y se
// reemplaza por el guardado cuando la API confirma.
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrecio } from "@/lib/format";
import { crearApiChats } from "./api";
import ListaConversaciones from "./ListaConversaciones";
import VistaChat from "./VistaChat";
import PanelLead from "./PanelLead";
import ModalFicha from "./ModalFicha";
import { IconChat } from "./iconos";
import { nombreConversacion } from "./formato";

const FILTROS_VACIOS = { texto: "", rapido: "todos", canal: "", etapa: "", propiedad: "" };
const soloDigitos = (s) => String(s || "").replace(/\D/g, "");

function ordenar(lista) {
  return [...lista].sort((a, b) => (Date.parse(b.ultimo_mensaje_at || b.created_at) || 0) - (Date.parse(a.ultimo_mensaje_at || a.created_at) || 0));
}

function interesesDe(conv) {
  const ids = (conv.lead?.intereses || []).map((i) => i.propiedad_id);
  if (conv.lead?.propiedad_id) ids.push(conv.lead.propiedad_id);
  return ids;
}

export default function BandejaChats({
  conversacionesIniciales = [], propiedades = [], usuarios = [], perfil,
  siteUrl, inicial = {}, api: apiInyectada, ia = { disponible: false, activaGlobal: false },
}) {
  const api = useMemo(() => apiInyectada || crearApiChats(createClient()), [apiInyectada]);
  const [convs, setConvs] = useState(() => ordenar(conversacionesIniciales));
  const [seleccionId, setSeleccionId] = useState(inicial.c || null);
  const [filtros, setFiltros] = useState({ ...FILTROS_VACIOS, propiedad: inicial.propiedad || "" });
  const [hilos, setHilos] = useState({}); // conversacion_id → { mensajes, hayMas, cargando, error }
  const [borradores, setBorradores] = useState({});
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [modalFicha, setModalFicha] = useState(false);
  const [aviso, setAviso] = useState(null);
  const seleccionRef = useRef(seleccionId);
  const tmpSeq = useRef(0);
  seleccionRef.current = seleccionId;

  const propiedadesMap = useMemo(() => Object.fromEntries(propiedades.map((p) => [p.id, p])), [propiedades]);
  const usuariosMap = useMemo(() => Object.fromEntries(usuarios.map((u) => [u.id, u])), [usuarios]);
  const conv = convs.find((c) => c.id === seleccionId) || null;

  // ── Filtros ───────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const q = filtros.texto.trim().toLowerCase();
    const qDig = soloDigitos(q);
    return convs.filter((c) => {
      if (filtros.rapido === "sin_leer" && !(c.no_leidos > 0)) return false;
      if (filtros.rapido === "mios" && c.asignado_a !== perfil?.id && c.lead?.agente_id !== perfil?.id) return false;
      if (filtros.rapido === "atender" && !c.ia_derivada) return false;
      if (filtros.canal && c.canal !== filtros.canal) return false;
      if (filtros.etapa && c.lead?.etapa !== filtros.etapa) return false;
      if (filtros.propiedad && !interesesDe(c).includes(filtros.propiedad)) return false;
      if (q) {
        const nombre = nombreConversacion(c).toLowerCase();
        const tels = soloDigitos(`${c.contacto?.telefono || ""} ${c.wa_id || ""}`);
        if (!nombre.includes(q) && !(qDig.length >= 3 && tels.includes(qDig.replace(/^0/, "")))) return false;
      }
      return true;
    });
  }, [convs, filtros, perfil?.id]);

  // ── Mensajes ──────────────────────────────────────────────────────
  const setHilo = useCallback((id, fn) => {
    setHilos((h) => ({ ...h, [id]: fn(h[id] || { mensajes: [], hayMas: false, cargando: false }) }));
  }, []);

  const cargarHilo = useCallback(async (id, antesDe = null) => {
    setHilo(id, (h) => ({ ...h, cargando: true, error: null }));
    try {
      const { mensajes, hayMas } = await api.cargarMensajes(id, antesDe);
      setHilo(id, (h) => {
        // Combinar (nunca reemplazar): si la carga corre dos veces o llegó algo
        // por Realtime mientras tanto, no se pierde nada ni se duplica.
        const porId = new Map(h.mensajes.map((m) => [m.id, m]));
        for (const m of mensajes) porId.set(m.id, { ...porId.get(m.id), ...m });
        const todos = [...porId.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
        return { mensajes: todos, hayMas: antesDe ? hayMas : (h.hayMas && h.mensajes.length > 0 ? h.hayMas : hayMas), cargando: false };
      });
    } catch (e) {
      setHilo(id, (h) => ({ ...h, cargando: false, error: "No se pudieron cargar los mensajes." }));
    }
  }, [api, setHilo]);

  const marcarLeida = useCallback((id) => {
    setConvs((cs) => cs.map((c) => (c.id === id && c.no_leidos ? { ...c, no_leidos: 0 } : c)));
    api.marcarLeida(id);
  }, [api]);

  function seleccionar(id) {
    setSeleccionId(id);
    setPanelAbierto(false);
    if (!hilos[id]) cargarHilo(id);
    const c = convs.find((x) => x.id === id);
    if (c?.no_leidos) marcarLeida(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("c", id);
      window.history.replaceState(null, "", url);
    } catch (_) { /* nada */ }
  }

  function volverALista() {
    setSeleccionId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("c");
      window.history.replaceState(null, "", url);
    } catch (_) { /* nada */ }
  }

  // Conversación inicial por URL (?c=).
  useEffect(() => {
    if (inicial.c && convs.some((c) => c.id === inicial.c)) seleccionar(inicial.c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tiempo real ───────────────────────────────────────────────────
  useEffect(() => {
    const cancelar = api.suscribir({
      onConversacion: async (evento, fila) => {
        if (!fila?.id) return;
        if (evento === "DELETE") { setConvs((cs) => cs.filter((c) => c.id !== fila.id)); return; }
        let conocida = false;
        setConvs((cs) => {
          conocida = cs.some((c) => c.id === fila.id);
          if (!conocida) return cs;
          // Conserva contacto/lead (Realtime no trae los joins).
          return ordenar(cs.map((c) => (c.id === fila.id ? { ...c, ...fila, contacto: c.contacto, lead: c.lead } : c)));
        });
        if (!conocida) {
          const completa = await api.cargarConversacion(fila.id);
          if (completa) setConvs((cs) => (cs.some((c) => c.id === completa.id) ? cs : ordenar([completa, ...cs])));
        }
        // Si la estoy mirando, lo nuevo ya está leído.
        if (fila.id === seleccionRef.current && fila.no_leidos > 0 && document.visibilityState === "visible") {
          marcarLeida(fila.id);
        }
      },
      onMensaje: (evento, fila) => {
        if (!fila?.conversacion_id) return;
        setHilos((hs) => {
          const h = hs[fila.conversacion_id];
          if (!h) return hs; // hilo no abierto: se cargará al abrirlo
          let mensajes = h.mensajes;
          if (evento === "DELETE") mensajes = mensajes.filter((m) => m.id !== fila.id);
          else if (mensajes.some((m) => m.id === fila.id)) mensajes = mensajes.map((m) => (m.id === fila.id ? { ...m, ...fila } : m));
          else {
            // ¿Es la confirmación de un envío optimista mío?
            const tmp = mensajes.find((m) => m.id.startsWith?.("tmp-") && m.estado === "enviando" &&
              fila.autor === "agente" && fila.usuario_id === perfil?.id && m.texto === fila.texto);
            mensajes = tmp ? mensajes.map((m) => (m === tmp ? fila : m)) : [...mensajes, fila];
          }
          return { ...hs, [fila.conversacion_id]: { ...h, mensajes } };
        });
      },
    });
    return cancelar;
  }, [api, marcarLeida, perfil?.id]);

  // ── Envío ─────────────────────────────────────────────────────────
  async function enviar(texto, reintentoDe = null) {
    const id = seleccionId;
    if (!id) return;
    const tmpId = reintentoDe?.id || `tmp-${++tmpSeq.current}`;
    const optimista = {
      id: tmpId, conversacion_id: id, direccion: "saliente", autor: "agente", usuario_id: perfil?.id,
      tipo: "texto", texto, estado: "enviando", created_at: new Date().toISOString(),
    };
    setHilo(id, (h) => ({
      ...h,
      mensajes: reintentoDe ? h.mensajes.map((m) => (m.id === tmpId ? optimista : m)) : [...h.mensajes, optimista],
    }));
    setConvs((cs) => ordenar(cs.map((c) => (c.id === id ? { ...c, ultimo_mensaje_texto: texto, ultimo_mensaje_at: optimista.created_at } : c))));

    try {
      const { mensaje } = await api.enviar(id, texto);
      setHilo(id, (h) => {
        const yaEsta = h.mensajes.some((m) => m.id === mensaje.id);
        return {
          ...h,
          mensajes: yaEsta ? h.mensajes.filter((m) => m.id !== tmpId) : h.mensajes.map((m) => (m.id === tmpId ? mensaje : m)),
        };
      });
      // Quien responde queda asignado (lo hace el server; se refleja acá).
      setConvs((cs) => cs.map((c) => (c.id === id && !c.asignado_a ? { ...c, asignado_a: perfil?.id } : c)));
    } catch (e) {
      const ventana = e?.codigo === "ventana_cerrada";
      setHilo(id, (h) => ({
        ...h,
        mensajes: h.mensajes.map((m) => (m.id === tmpId
          ? { ...m, estado: "fallido", error: e?.message || "No se pudo enviar.", reintentable: !ventana && e?.codigo !== "guardar" }
          : m)),
      }));
      if (ventana) {
        // El server dice que la ventana está cerrada: reflejarlo en la UI.
        setConvs((cs) => cs.map((c) => (c.id === id ? { ...c, ultimo_entrante_at: new Date(0).toISOString() } : c)));
      }
    }
  }

  // ── Lead ──────────────────────────────────────────────────────────
  function parchearLead(convId, fn) {
    setConvs((cs) => cs.map((c) => (c.id === convId && c.lead ? { ...c, lead: fn(c.lead) } : c)));
  }

  async function cambiarLead(cambios) {
    if (!conv?.lead) return;
    const antes = conv.lead;
    parchearLead(conv.id, (l) => ({ ...l, ...cambios }));
    try {
      await api.actualizarLead(conv.lead.id, cambios);
    } catch (e) {
      parchearLead(conv.id, () => antes);
      throw new Error("No se pudo actualizar el lead (¿tenés permiso sobre este lead?).");
    }
  }

  async function cambiarInteres(propiedadId, quitar) {
    if (!conv?.lead) return;
    const convId = conv.id;
    const antes = conv.lead;
    parchearLead(convId, (l) => {
      const ids = new Set((l.intereses || []).map((i) => i.propiedad_id));
      if (quitar) ids.delete(propiedadId); else ids.add(propiedadId);
      let principal = l.propiedad_id;
      if (quitar && principal === propiedadId) principal = [...ids][0] || null;
      if (!quitar && !principal) principal = propiedadId;
      return { ...l, propiedad_id: principal, intereses: [...ids].map((id) => ({ propiedad_id: id })) };
    });
    try {
      await api.cambiarInteres(antes.id, propiedadId, quitar);
    } catch (e) {
      parchearLead(convId, () => antes);
      throw e;
    }
  }

  async function asignar(usuarioId) {
    if (!conv) return;
    const convId = conv.id;
    const antes = { asignado_a: conv.asignado_a, lead: conv.lead };
    setConvs((cs) => cs.map((c) => (c.id === convId
      ? { ...c, asignado_a: usuarioId, lead: c.lead && usuarioId ? { ...c.lead, agente_id: usuarioId } : c.lead }
      : c)));
    try {
      await api.asignar(convId, usuarioId);
    } catch (e) {
      setConvs((cs) => cs.map((c) => (c.id === convId ? { ...c, ...antes } : c)));
      throw e;
    }
  }

  // ── Agente IA ─────────────────────────────────────────────────────
  async function cambiarIA(activa) {
    if (!conv) return;
    const convId = conv.id;
    const antes = { ia_activa: conv.ia_activa, ia_derivada: conv.ia_derivada, ia_pausada_hasta: conv.ia_pausada_hasta };
    const optimista = activa ? { ia_activa: true, ia_derivada: false, ia_pausada_hasta: null } : { ia_activa: false };
    setConvs((cs) => cs.map((c) => (c.id === convId ? { ...c, ...optimista } : c)));
    try {
      await api.cambiarIA(convId, activa);
    } catch (e) {
      setConvs((cs) => cs.map((c) => (c.id === convId ? { ...c, ...antes } : c)));
      setAviso(e?.message || "No se pudo cambiar la IA.");
    }
  }

  // ── Ficha ─────────────────────────────────────────────────────────
  function elegirFicha(p) {
    setModalFicha(false);
    if (!conv) return;
    const base = siteUrl || window.location.origin;
    const lineas = [
      `Te comparto la ficha de ${p.titulo || "la propiedad"}${p.precio ? ` (${formatPrecio(p.precio, p.moneda)})` : ""}:`,
      `${base}/p/${p.id}`,
    ];
    setBorradores((b) => ({ ...b, [conv.id]: [b[conv.id], lineas.join("\n")].filter(Boolean).join("\n") }));
    if (conv.lead && !interesesDe(conv).includes(p.id)) {
      cambiarInteres(p.id, false).catch(() => setAviso("No se pudo agregar la propiedad al lead."));
    }
  }

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="-m-4 flex h-[calc(100dvh-4rem)] overflow-hidden border-slate-200 bg-white sm:-m-6 md:h-dvh md:border-x lg:-m-8">
      <div className={`${conv ? "hidden md:flex" : "flex"} h-full w-full min-w-0 flex-col border-r border-slate-200 md:w-[340px] md:shrink-0 lg:w-[380px]`}>
        <ListaConversaciones
          conversaciones={filtradas}
          totalSinFiltro={convs.length}
          seleccionId={seleccionId}
          onSeleccionar={seleccionar}
          filtros={filtros}
          setFiltros={setFiltros}
          propiedades={propiedades}
          propiedadesMap={propiedadesMap}
          ia={ia}
        />
      </div>

      <div className={`${conv ? "flex" : "hidden md:flex"} h-full min-w-0 flex-1 flex-col`}>
        {conv ? (
          <VistaChat
            conv={conv}
            estado={hilos[conv.id]}
            perfil={perfil}
            usuariosMap={usuariosMap}
            propiedadesMap={propiedadesMap}
            onVolver={volverALista}
            onEnviar={(t) => enviar(t)}
            onReintentar={(m) => enviar(m.texto, m)}
            onCargarAnteriores={() => cargarHilo(conv.id, hilos[conv.id]?.mensajes.find((m) => !m.id.startsWith?.("tmp-"))?.created_at)}
            onTogglePanel={() => setPanelAbierto((v) => !v)}
            onAbrirFicha={() => setModalFicha(true)}
            ia={ia}
            onCambiarIA={cambiarIA}
            borrador={borradores[conv.id] || ""}
            setBorrador={(v) => setBorradores((b) => ({ ...b, [conv.id]: v }))}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f0f2f5] px-8 text-center text-slate-500">
            <IconChat size={48} className="text-slate-300" />
            <p className="text-lg font-semibold text-slate-600">Chats de MVDPrime</p>
            <p className="max-w-sm text-sm">WhatsApp, Instagram y Messenger en un solo lugar. Elegí una conversación para leerla y responder.</p>
          </div>
        )}
      </div>

      {conv && panelAbierto && (
        <div className="fixed inset-0 z-40 md:static md:z-auto md:w-[320px] md:shrink-0 md:border-l md:border-slate-200">
          <PanelLead
            conv={conv}
            perfil={perfil}
            usuarios={usuarios}
            propiedades={propiedades}
            propiedadesMap={propiedadesMap}
            onCerrar={() => setPanelAbierto(false)}
            onCambiarLead={cambiarLead}
            onCambiarInteres={cambiarInteres}
            onAsignar={asignar}
          />
        </div>
      )}

      {modalFicha && <ModalFicha propiedades={propiedades} onElegir={elegirFicha} onCerrar={() => setModalFicha(false)} />}

      {aviso && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{aviso}</div>
      )}
    </div>
  );
}
