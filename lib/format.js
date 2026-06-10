// Helpers de formato.

export function formatPrecio(precio, moneda = "USD") {
  if (precio === null || precio === undefined || precio === "") return "Consultar";
  const n = Number(precio);
  if (Number.isNaN(n)) return "Consultar";
  const formato = new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 0,
  }).format(n);
  return `${moneda === "UYU" ? "$U" : "US$"} ${formato}`;
}

export function formatFecha(fecha) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatFechaHora(fecha) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
