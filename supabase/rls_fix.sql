-- =====================================================================
-- MVDPrime CRM — Fix de recursión infinita en RLS de `usuarios` (42P17)
-- Ejecutar en el SQL Editor de Supabase.
--
-- Causa: las políticas de `usuarios` se sub-consultan a sí mismas para
-- verificar el rol -> recursión. Como `propiedades`, `leads`, etc. también
-- consultan `usuarios`, heredan el error.
--
-- Solución: funciones SECURITY DEFINER que leen el rol / id interno SIN
-- disparar RLS, y políticas de `usuarios` no recursivas. Arreglando solo
-- `usuarios` (la raíz), el resto de las tablas vuelve a leerse.
-- =====================================================================

-- 1) Rol del usuario actual (sin pasar por RLS).
create or replace function public.mi_rol()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select rol from public.usuarios where auth_id = auth.uid();
$$;

-- 2) ID interno (usuarios.id) del usuario actual. Útil para "el agente ve
--    solo lo suyo": leads.agente_id / propiedades.agente_id apuntan a este id.
create or replace function public.mi_usuario_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.usuarios where auth_id = auth.uid();
$$;

-- 3) Reemplazar TODAS las políticas existentes de `usuarios` por unas no
--    recursivas (se eliminan por nombre dinámico, sin importar cómo se llamen).
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'usuarios'
  loop
    execute format('drop policy if exists %I on public.usuarios', pol.policyname);
  end loop;
end $$;

alter table public.usuarios enable row level security;

-- Cada usuario ve su propia fila; el admin ve todo.
create policy "usuarios_select" on public.usuarios
  for select using (auth_id = auth.uid() or public.mi_rol() = 'admin');

-- Self-provisioning + alta por admin.
create policy "usuarios_insert" on public.usuarios
  for insert with check (auth_id = auth.uid() or public.mi_rol() = 'admin');

-- Cada usuario edita su fila; el admin edita cualquiera.
create policy "usuarios_update" on public.usuarios
  for update using (auth_id = auth.uid() or public.mi_rol() = 'admin')
  with check (auth_id = auth.uid() or public.mi_rol() = 'admin');

-- Solo el admin elimina.
create policy "usuarios_delete" on public.usuarios
  for delete using (public.mi_rol() = 'admin');

-- =====================================================================
-- OPCIONAL — Plantillas para las tablas de datos (ajustar a gusto).
-- Reemplazan políticas que hoy subconsultan `usuarios`. Patrón:
--   admin ve/edita todo; el agente solo lo asignado a él.
-- Descomentar y adaptar por tabla.
-- =====================================================================

-- PROPIEDADES (agente ve solo las suyas)
-- drop policy if exists "propiedades_select" on public.propiedades;
-- create policy "propiedades_select" on public.propiedades
--   for select using (public.mi_rol() = 'admin' or agente_id = public.mi_usuario_id());

-- LEADS (agente ve solo los asignados)
-- drop policy if exists "leads_select" on public.leads;
-- create policy "leads_select" on public.leads
--   for select using (public.mi_rol() = 'admin' or agente_id = public.mi_usuario_id());

-- INTERACCIONES (a través del lead / del propio usuario)
-- drop policy if exists "interacciones_select" on public.interacciones;
-- create policy "interacciones_select" on public.interacciones
--   for select using (
--     public.mi_rol() = 'admin' or usuario_id = public.mi_usuario_id()
--   );
