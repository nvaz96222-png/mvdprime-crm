import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/supabase/getPerfil";
import BandejaChats from "@/components/chats/BandejaChats";
import { SELECT_CONVERSACION, SELECT_CONVERSACION_IA } from "@/components/chats/api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chats · MVDPrime CRM" };

// =====================================================================
// /chats — bandeja de WhatsApp, Instagram y Messenger (Fase 2a).
// Query params: ?c=<conversacion_id> abre un chat · ?propiedad=<id> filtra.
// El RLS decide qué conversaciones ve cada usuario (admin: todas).
// =====================================================================

export default async function ChatsPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const perfil = await getPerfil(supabase, user);

  const cargarConversaciones = (select) =>
    supabase
      .from("conversaciones")
      .select(select)
      .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false })
      .limit(300);

  const [convIA, propRes, usuRes, cfgRes] = await Promise.all([
    cargarConversaciones(SELECT_CONVERSACION_IA),
    supabase
      .from("propiedades")
      .select("id, titulo, precio, moneda, barrio, estado")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("agente_ia_config").select("activo").eq("id", 1).maybeSingle(),
  ]);
  // Sin la migración de la Fase 3, los campos ia_* no existen: SELECT base.
  const convRes = convIA.error ? await cargarConversaciones(SELECT_CONVERSACION) : convIA;
  const iaDisponible = !convIA.error && !cfgRes.error;

  if (convRes.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        No se pudieron cargar los chats: {convRes.error.message}. Si es la primera vez, verificá que las
        migraciones de Meta (20261027_meta_ingesta.sql) estén aplicadas.
      </div>
    );
  }

  return (
    <BandejaChats
      conversacionesIniciales={convRes.data || []}
      propiedades={propRes.data || []}
      usuarios={usuRes.data || []}
      perfil={perfil ? { id: perfil.id, rol: perfil.rol, nombre: perfil.nombre } : null}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL || null}
      inicial={{ c: searchParams?.c || null, propiedad: searchParams?.propiedad || null }}
      ia={{ disponible: iaDisponible, activaGlobal: !!cfgRes.data?.activo }}
    />
  );
}
