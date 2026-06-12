import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PropietarioForm from "@/components/propietarios/PropietarioForm";

export const dynamic = "force-dynamic";

export default async function EditarPropietarioPage({ params }) {
  const supabase = createClient();
  const { data: propietario } = await supabase
    .from("propietarios")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!propietario) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Editar propietario</h1>
          <p className="mt-1 text-sm text-slate-500">{propietario.nombre}</p>
        </div>
        <Link
          href={`/propietarios/${params.id}`}
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          ← Volver
        </Link>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <PropietarioForm propietario={propietario} />
      </div>
    </div>
  );
}
