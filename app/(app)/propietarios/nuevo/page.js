import Link from "next/link";
import PropietarioForm from "@/components/propietarios/PropietarioForm";

export default function NuevoPropietarioPage({ searchParams }) {
  const contactoId = searchParams.contacto_id || null;
  const nombreDefault = searchParams.nombre ? decodeURIComponent(searchParams.nombre) : "";

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        {contactoId && (
          <Link href={`/contactos/${contactoId}`} className="text-sm text-slate-500 hover:text-accent">
            ← Volver al contacto
          </Link>
        )}
        <h1 className="mt-1 text-2xl font-bold text-navy">Nueva ficha de propietario</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registrá al dueño para asignarle propiedades.
        </p>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <PropietarioForm contactoId={contactoId} nombreDefault={nombreDefault} />
      </div>
    </div>
  );
}
