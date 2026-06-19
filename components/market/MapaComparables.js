"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatPrecio } from "@/lib/format";

// Fix default marker icon (webpack issue with Leaflet)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const iconComparable = new L.DivIcon({
  className: "",
  html: `<div style="background:#2563eb;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const iconDestacado = new L.DivIcon({
  className: "",
  html: `<div style="background:#f59e0b;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, coords]);
  return null;
}

export default function MapaComparables({ propiedad, comparables }) {
  const coords = useMemo(
    () => comparables.map((c) => [c.lat, c.lng]),
    [comparables]
  );

  const center = useMemo(() => {
    if (coords.length === 0) return [-34.9011, -56.1645]; // Montevideo default
    const avgLat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const avgLng = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    return [avgLat, avgLng];
  }, [coords]);

  if (comparables.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
        Ningún comparable tiene coordenadas aún
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      {/* Leyenda */}
      <div className="flex items-center gap-4 border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-600"></span>
          Comparable ({comparables.length})
        </span>
        <span className="ml-auto">
          Fuente: MercadoLibre Uruguay · Click para ver detalle
        </span>
      </div>

      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "520px", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds coords={coords} />

        {comparables.map((c) => (
          <Marker key={c.id} position={[c.lat, c.lng]} icon={iconComparable}>
            <Popup maxWidth={280}>
              <div className="text-sm">
                {c.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.thumbnail_url}
                    alt=""
                    className="mb-2 h-28 w-full rounded object-cover"
                  />
                )}
                <p className="font-semibold leading-snug text-slate-800">
                  {c.title || "Sin título"}
                </p>
                <p className="mt-1 text-base font-bold text-blue-700">
                  {formatPrecio(c.price, c.currency)}
                </p>
                {c.expenses > 0 && (
                  <p className="text-xs text-slate-500">
                    + gastos {formatPrecio(c.expenses, c.currency)}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  {c.area_total && <span>{c.area_total} m²</span>}
                  {c.bedrooms != null && <span>{c.bedrooms} dorm.</span>}
                  {c.bathrooms != null && <span>{c.bathrooms} baños</span>}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {[c.neighborhood, c.city].filter(Boolean).join(", ")}
                </p>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
                  >
                    Ver en {c.portal} →
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
