-- =====================================================================
-- MVDPrime CRM — Bucket de Storage para fotos de propiedades
-- Ejecutar en el SQL Editor de Supabase (o crear el bucket desde el panel).
-- =====================================================================

-- 1) Bucket público "propiedades".
insert into storage.buckets (id, name, public)
values ('propiedades', 'propiedades', true)
on conflict (id) do nothing;

-- 2) Políticas sobre storage.objects para ese bucket.
--    Lectura pública (las fotos se muestran por URL pública);
--    escritura/borrado solo para usuarios autenticados.
drop policy if exists "propiedades_fotos_select" on storage.objects;
create policy "propiedades_fotos_select" on storage.objects
  for select using (bucket_id = 'propiedades');

drop policy if exists "propiedades_fotos_insert" on storage.objects;
create policy "propiedades_fotos_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'propiedades');

drop policy if exists "propiedades_fotos_update" on storage.objects;
create policy "propiedades_fotos_update" on storage.objects
  for update to authenticated using (bucket_id = 'propiedades');

drop policy if exists "propiedades_fotos_delete" on storage.objects;
create policy "propiedades_fotos_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'propiedades');
