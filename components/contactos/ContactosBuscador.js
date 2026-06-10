"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function ContactosBuscador() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [valor, setValor] = useState(searchParams.get("q") || "");

  // Debounce: actualiza la URL 350ms después de dejar de tipear.
  useEffect(() => {
    const actual = searchParams.get("q") || "";
    if (valor === actual) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (valor.trim()) params.set("q", valor.trim());
      else params.delete("q");
      router.push(`${pathname}?${params.toString()}`);
    }, 350);
    return () => clearTimeout(t);
  }, [valor, searchParams, pathname, router]);

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Buscar por nombre, teléfono o email…"
        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:max-w-md"
      />
    </div>
  );
}
