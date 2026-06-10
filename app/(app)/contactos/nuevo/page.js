import Link from "next/link";
import ContactoForm from "@/components/contactos/ContactoForm";

export const dynamic = "force-dynamic";

export default function NuevoContactoPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/contactos" className="text-sm text-slate-500 hover:text-accent">
          ← Volver a contactos
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Nuevo contacto</h1>
      </div>
      <ContactoForm />
    </div>
  );
}
