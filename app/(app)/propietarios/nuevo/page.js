import PropietarioForm from "@/components/propietarios/PropietarioForm";

export default function NuevoPropietarioPage() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Nuevo propietario</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registrá al dueño o representante de la propiedad.
        </p>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <PropietarioForm />
      </div>
    </div>
  );
}
