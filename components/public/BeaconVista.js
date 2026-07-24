"use client";
import { useEffect } from "react";

export default function BeaconVista({ proyectoId, slug }) {
  useEffect(() => {
    const payload = JSON.stringify({ proyecto_id: proyectoId, slug, tipo: "vista" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/proyecto-evento", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/proyecto-evento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).catch(() => {});
    }
  }, []);
  return null;
}
