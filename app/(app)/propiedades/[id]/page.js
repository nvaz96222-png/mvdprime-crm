import { redirect } from "next/navigation";

export default function PropiedadPage({ params }) {
  redirect(`/propiedades/${params.id}/editar`);
}
