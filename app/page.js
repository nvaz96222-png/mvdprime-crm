import { redirect } from "next/navigation";

// La raíz redirige al dashboard. El middleware se encarga de mandar al login
// si no hay sesión activa.
export default function Home() {
  redirect("/dashboard");
}
