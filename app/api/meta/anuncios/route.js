import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// =====================================================================
// ABM de anuncios de Meta vinculados a una propiedad/proyecto.
//
// GET    ?propiedad_id=uuid | ?proyecto_id=uuid  → lista los anuncios.
// POST   { ad_id, propiedad_id?, proyecto_id?, nombre? }  → alta/actualiza.
// DELETE { ad_id }  → baja.
//
// Solo usuarios autenticados del CRM. Escrituras con service_role.
// Usado por components/propiedades/MetaAnunciosAdmin.js para atribuir
// leads y mensajes Click-to-WhatsApp a la propiedad correcta.
// =====================================================================

async function requireUser() {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  return user;
}

export async function GET(request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const propiedad_id = searchParams.get("propiedad_id");
  const proyecto_id = searchParams.get("proyecto_id");

  const admin = createAdminClient();
  let q = admin.from("meta_anuncios").select("*").order("created_at", { ascending: false });
  if (propiedad_id) q = q.eq("propiedad_id", propiedad_id);
  if (proyecto_id) q = q.eq("proyecto_id", proyecto_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ anuncios: data || [] });
}

export async function POST(request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { ad_id, propiedad_id, proyecto_id, nombre } = await request.json();
  if (!ad_id?.trim()) {
    return NextResponse.json({ error: "Falta ad_id" }, { status: 400 });
  }
  if (!propiedad_id && !proyecto_id) {
    return NextResponse.json({ error: "Falta propiedad_id o proyecto_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("meta_anuncios")
    .upsert(
      {
        ad_id: ad_id.trim(),
        propiedad_id: propiedad_id || null,
        proyecto_id: proyecto_id || null,
        nombre: nombre?.trim() || null,
      },
      { onConflict: "ad_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ anuncio: data });
}

export async function DELETE(request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { ad_id } = await request.json();
  if (!ad_id?.trim()) {
    return NextResponse.json({ error: "Falta ad_id" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.from("meta_anuncios").delete().eq("ad_id", ad_id.trim());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
