import { redirect } from "next/navigation";

export default function ProyectoPage({ params }) {
  redirect(`/proyectos/${params.id}/editar`);
}
