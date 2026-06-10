import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ContactoForm from "@/components/contactos/ContactoForm";

export const dynamic = "force-dynamic";

export default async function EditarContactoPage({ params }) {
  const supabase = createClient();

  const { data: contacto, error } = await supabase
    .from("contactos")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        No se pudo cargar el contacto: {error.message}
      </div>
    );
  }
  if (!contacto) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href={`/contactos/${contacto.id}`} className="text-sm text-slate-500 hover:text-accent">
          ← Volver al perfil
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Editar contacto</h1>
        <p className="mt-0.5 text-sm text-slate-500">{contacto.nombre}</p>
      </div>
      <ContactoForm contacto={contacto} />
    </div>
  );
}
