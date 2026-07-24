"use client";

export default function BtnTrackableLink({
  href,
  tipo,
  proyectoId,
  slug,
  children,
  className = "",
  target,
  rel,
}) {
  function track() {
    const payload = JSON.stringify({ proyecto_id: proyectoId, slug, tipo });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/proyecto-evento",
        new Blob([payload], { type: "application/json" })
      );
    } else {
      fetch("/api/proyecto-evento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).catch(() => {});
    }
  }

  return (
    <a href={href} target={target} rel={rel} onClick={track} className={className}>
      {children}
    </a>
  );
}
