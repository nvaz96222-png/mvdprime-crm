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
-- TABLAS DE DATOS — políticas concretas (listas para correr).
--
-- Modelo elegido (recomendado para una inmobiliaria chica):
--   • CATÁLOGO COMPARTIDO: propietarios, propiedades, fotos, contactos,
--     publicaciones → cualquier usuario autenticado LEE todo (los agentes
--     colaboran sobre el mismo pool; evita romper joins lead→propiedad/contacto).
--   • PRIVADO POR AGENTE: leads e interacciones → el admin ve todo; el
--     agente ve solo lo asignado a él (agente_id / usuario_id).
--   • Escritura: cualquier autenticado inserta/edita; el borrado lo hace
--     el admin (o el dueño del registro, donde aplica).
--
-- ¿Querés que el agente vea SOLO sus propiedades? Mirá la NOTA al final
-- de la sección de PROPIEDADES para cambiar el SELECT.
--
-- Helper de borrado limpio: elimina todas las políticas previas de una tabla
-- antes de recrearlas, sin importar cómo se llamaban.
-- =====================================================================

create or replace function public._drop_policies(p_table text)
returns void
language plpgsql
as $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = p_table
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, p_table);
  end loop;
end $$;

-- Atajo: ¿está autenticado?  (auth.uid() no es null)
-- Se usa inline como `auth.uid() is not null`.

-- ---------------------------------------------------------------------
-- PROPIETARIOS (catálogo compartido)
-- ---------------------------------------------------------------------
select public._drop_policies('propietarios');
alter table public.propietarios enable row level security;
create policy "propietarios_select" on public.propietarios
  for select using (auth.uid() is not null);
create policy "propietarios_insert" on public.propietarios
  for insert with check (auth.uid() is not null);
create policy "propietarios_update" on public.propietarios
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "propietarios_delete" on public.propietarios
  for delete using (public.mi_rol() = 'admin');

-- ---------------------------------------------------------------------
-- PROPIEDADES (catálogo compartido)
-- ---------------------------------------------------------------------
select public._drop_policies('propiedades');
alter table public.propiedades enable row level security;
create policy "propiedades_select" on public.propiedades
  for select using (auth.uid() is not null);
create policy "propiedades_insert" on public.propiedades
  for insert with check (auth.uid() is not null);
create policy "propiedades_update" on public.propiedades
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "propiedades_delete" on public.propiedades
  for delete using (public.mi_rol() = 'admin' or agente_id = public.mi_usuario_id());
-- NOTA: para que el agente vea SOLO sus propiedades, reemplazá el SELECT por:
--   using (public.mi_rol() = 'admin' or agente_id = public.mi_usuario_id())
--   ...y ajustá update con el mismo criterio.

-- ---------------------------------------------------------------------
-- FOTOS (siguen la visibilidad de su propiedad → catálogo compartido)
-- ---------------------------------------------------------------------
select public._drop_policies('fotos');
alter table public.fotos enable row level security;
create policy "fotos_select" on public.fotos
  for select using (auth.uid() is not null);
create policy "fotos_insert" on public.fotos
  for insert with check (auth.uid() is not null);
create policy "fotos_update" on public.fotos
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "fotos_delete" on public.fotos
  for delete using (auth.uid() is not null);

-- ---------------------------------------------------------------------
-- CONTACTOS (catálogo compartido)
-- ---------------------------------------------------------------------
select public._drop_policies('contactos');
alter table public.contactos enable row level security;
create policy "contactos_select" on public.contactos
  for select using (auth.uid() is not null);
create policy "contactos_insert" on public.contactos
  for insert with check (auth.uid() is not null);
create policy "contactos_update" on public.contactos
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "contactos_delete" on public.contactos
  for delete using (public.mi_rol() = 'admin');

-- ---------------------------------------------------------------------
-- PUBLICACIONES (catálogo compartido)
-- ---------------------------------------------------------------------
select public._drop_policies('publicaciones');
alter table public.publicaciones enable row level security;
create policy "publicaciones_select" on public.publicaciones
  for select using (auth.uid() is not null);
create policy "publicaciones_insert" on public.publicaciones
  for insert with check (auth.uid() is not null);
create policy "publicaciones_update" on public.publicaciones
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "publicaciones_delete" on public.publicaciones
  for delete using (auth.uid() is not null);

-- ---------------------------------------------------------------------
-- LEADS (privado por agente: admin ve todo; el agente solo los suyos)
-- ---------------------------------------------------------------------
select public._drop_policies('leads');
alter table public.leads enable row level security;
create policy "leads_select" on public.leads
  for select using (public.mi_rol() = 'admin' or agente_id = public.mi_usuario_id());
-- Inserta cualquiera; si no asigna agente, debería quedar a su nombre (lo setea la app).
create policy "leads_insert" on public.leads
  for insert with check (auth.uid() is not null);
create policy "leads_update" on public.leads
  for update using (public.mi_rol() = 'admin' or agente_id = public.mi_usuario_id())
  with check (public.mi_rol() = 'admin' or agente_id = public.mi_usuario_id());
create policy "leads_delete" on public.leads
  for delete using (public.mi_rol() = 'admin' or agente_id = public.mi_usuario_id());

-- ---------------------------------------------------------------------
-- INTERACCIONES (visibles si pertenecen a un lead que el usuario puede ver)
-- ---------------------------------------------------------------------
select public._drop_policies('interacciones');
alter table public.interacciones enable row level security;
create policy "interacciones_select" on public.interacciones
  for select using (
    public.mi_rol() = 'admin'
    or usuario_id = public.mi_usuario_id()
    or exists (
      select 1 from public.leads l
      where l.id = interacciones.lead_id
        and (public.mi_rol() = 'admin' or l.agente_id = public.mi_usuario_id())
    )
  );
create policy "interacciones_insert" on public.interacciones
  for insert with check (auth.uid() is not null);
create policy "interacciones_update" on public.interacciones
  for update using (public.mi_rol() = 'admin' or usuario_id = public.mi_usuario_id())
  with check (public.mi_rol() = 'admin' or usuario_id = public.mi_usuario_id());
create policy "interacciones_delete" on public.interacciones
  for delete using (public.mi_rol() = 'admin' or usuario_id = public.mi_usuario_id());

-- =====================================================================
-- VERIFICACIÓN — corré esto después para confirmar que no quedó recursión
-- y que cada tabla tiene políticas:
--   select tablename, count(*) as policies
--   from pg_policies where schemaname='public'
--   group by tablename order by tablename;
-- Y como sanity check de lectura (debería devolver filas, no 42P17):
--   select id, titulo from public.propiedades limit 1;
-- =====================================================================
