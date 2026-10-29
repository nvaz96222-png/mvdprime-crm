// Íconos SVG de la bandeja (sin dependencias, heredan currentColor).

function Svg({ size = 20, children, className = "", ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...rest}>
      {children}
    </svg>
  );
}

export function IconBuscar(p) { return <Svg {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Svg>; }
export function IconAtras(p) { return <Svg {...p}><polyline points="15 18 9 12 15 6" /></Svg>; }
export function IconTelefono(p) { return <Svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>; }
export function IconEnviar(p) { return <Svg {...p}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></Svg>; }
export function IconCasa(p) { return <Svg {...p}><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></Svg>; }
export function IconFicha(p) { return <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><line x1="14" y1="9" x2="18" y2="9" /><line x1="14" y1="13" x2="18" y2="13" /><path d="M6 16c.6-1.2 1.7-2 3-2s2.4.8 3 2" /></Svg>; }
export function IconCerrar(p) { return <Svg {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>; }
export function IconReloj(p) { return <Svg {...p}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></Svg>; }
export function IconChat(p) { return <Svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 20l1.1-4.2A8.2 8.2 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" /></Svg>; }
export function IconExterno(p) { return <Svg {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></Svg>; }

// Tildes de estado (WhatsApp): una = enviado, dos = entregado, dos azules = leído.
export function Tildes({ estado }) {
  if (estado === "enviando") return <IconReloj size={13} className="text-slate-400" />;
  if (estado === "fallido") return <span className="text-[11px] font-bold text-red-600" title="No se pudo enviar">!</span>;
  const doble = estado === "entregado" || estado === "leido";
  const color = estado === "leido" ? "#53bdeb" : "#8696a0";
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" aria-label={estado || "enviado"} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={doble ? "1 5.5 4 8.5 10.5 1.5" : "2.5 5.5 5.5 8.5 12 1.5"} />
      {doble && <polyline points="5.3 7.5 6.3 8.5 14.8 1.5" />}
    </svg>
  );
}

// Logos simplificados de cada canal.
export function IconCanal({ canal, size = 14 }) {
  if (canal === "instagram") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Instagram" fill="none" stroke="#d6249f" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="#d6249f" stroke="none" />
      </svg>
    );
  }
  if (canal === "messenger") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Messenger">
        <path fill="#0866ff" d="M12 2C6.4 2 2 6.1 2 11.6c0 2.9 1.2 5.4 3.1 7.1V22l2.9-1.6c1.2.3 2.6.5 4 .5 5.6 0 10-4.1 10-9.6S17.6 2 12 2zm1 12.9-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 5-2.7z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="WhatsApp">
      <path fill="#25d366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" />
      <path fill="#fff" d="M17.1 14.2c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1a6.7 6.7 0 0 1-3.4-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2c.2-.6.2-1 .1-1.2l-.8-.4z" />
    </svg>
  );
}
