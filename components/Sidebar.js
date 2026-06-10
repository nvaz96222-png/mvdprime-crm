"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/propiedades", label: "Propiedades", icon: IconHome },
  { href: "/leads", label: "Leads", icon: IconPipeline },
  { href: "/contactos", label: "Contactos", icon: IconUsers },
];

export default function Sidebar({ usuario }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  async function handleLogout() {
    setSaliendo(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const iniciales = (usuario?.nombre || usuario?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <>
      {/* Barra superior mobile */}
      <div className="flex items-center justify-between bg-navy px-4 py-3 text-white md:hidden">
        <span className="font-bold">
          MVDPrime <span className="text-accent-light">RE</span>
        </span>
        <button
          onClick={() => setAbierto((v) => !v)}
          aria-label="Abrir menú"
          className="rounded-md p-2 hover:bg-navy-light"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Overlay mobile */}
      {abierto && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setAbierto(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-slate-200 transition-transform duration-200 md:static md:translate-x-0 ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Marca */}
        <div className="border-b border-white/10 px-6 py-5">
          <Link href="/dashboard" className="text-xl font-bold text-white">
            MVDPrime <span className="text-accent-light">RE</span>
          </Link>
          <p className="mt-0.5 text-xs text-slate-400">Real Estate CRM</p>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const activo =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAbierto(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  activo
                    ? "bg-accent text-white"
                    : "text-slate-300 hover:bg-navy-light hover:text-white"
                }`}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Usuario + logout */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-white">
              {iniciales}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {usuario?.nombre}
              </p>
              {usuario?.rol ? (
                <p className="truncate text-xs capitalize text-accent-light">
                  {usuario.rol}
                </p>
              ) : (
                <p className="truncate text-xs text-slate-400">
                  {usuario?.email}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={saliendo}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-navy-light hover:text-white disabled:opacity-60"
          >
            <IconLogout />
            {saliendo ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      </aside>
    </>
  );
}

/* --- Íconos (SVG inline, sin dependencias) --- */
function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IconPipeline() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="3" y2="20" />
      <line x1="10" y1="6" x2="10" y2="14" />
      <line x1="17" y1="6" x2="17" y2="18" />
      <rect x="1.5" y="4" width="3" height="2.5" rx="0.5" />
      <rect x="8.5" y="4" width="3" height="2.5" rx="0.5" />
      <rect x="15.5" y="4" width="3" height="2.5" rx="0.5" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
