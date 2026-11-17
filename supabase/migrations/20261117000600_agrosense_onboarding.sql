-- AgroSense: onboarding de clientes nuevos.
-- Un cliente (organización) tiene dueños que pueden crear sus propias fincas
-- dentro del límite de su plan, y un avance de onboarding que se puede retomar.

create table agrosense.organizacion_miembros (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references agrosense.organizaciones(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null default 'owner' check (rol in ('owner')),
  created_at timestamptz not null default now(),
  unique (organizacion_id, auth_user_id)
);
create index on agrosense.organizacion_miembros (auth_user_id);

alter table agrosense.organizaciones
  add column onboarding_paso text not null default 'contrasena'
    check (onboarding_paso in ('contrasena','finca','potreros','animales','equipo','lector','listo')),
  add column onboarding_completado_at timestamptz,
  add column origen text not null default 'manual' check (origen in ('manual','hotmart'));

create or replace function agrosense.es_dueno_org(p_org_id uuid)
returns boolean language sql stable security definer set search_path = agrosense, pg_temp as $$
  select agrosense.es_superadmin() or exists (
    select 1 from agrosense.organizacion_miembros
    where organizacion_id = p_org_id and auth_user_id = auth.uid() and rol = 'owner');
$$;

-- ¿Puede la organización crear otra finca según su plan? (sin plan o sin límite = sí)
create or replace function agrosense.puede_crear_finca(p_org_id uuid)
returns boolean language sql stable security definer set search_path = agrosense, pg_temp as $$
  select agrosense.es_superadmin() or (
    agrosense.es_dueno_org(p_org_id) and coalesce((
      select (select count(*) from agrosense.fincas f where f.organizacion_id = p_org_id and f.activa) < p.max_fincas
      from agrosense.suscripciones s join agrosense.planes p on p.id = s.plan_id
      where s.organizacion_id = p_org_id and s.estado in ('activa','atrasada') and p.max_fincas is not null
      order by s.updated_at desc limit 1
    ), true));
$$;

revoke execute on function agrosense.es_dueno_org(uuid), agrosense.puede_crear_finca(uuid) from public, anon;
grant execute on function agrosense.es_dueno_org(uuid), agrosense.puede_crear_finca(uuid) to authenticated, service_role;

-- Quien crea una finca queda como owner de esa finca.
create or replace function agrosense.fincas_owner_al_crear()
returns trigger language plpgsql security definer set search_path = agrosense, pg_temp as $$
declare v_nombre text;
begin
  if auth.uid() is not null and not exists (
       select 1 from agrosense.membresias where finca_id = new.id and auth_user_id = auth.uid()) then
    select coalesce(raw_user_meta_data->>'nombre', split_part(email, '@', 1)) into v_nombre
      from auth.users where id = auth.uid();
    insert into agrosense.membresias (auth_user_id, finca_id, nombre, rol)
    values (auth.uid(), new.id, coalesce(v_nombre, 'Propietario'), 'owner');
  end if;
  return new;
end $$;
create trigger fincas_owner_al_crear after insert on agrosense.fincas
  for each row execute function agrosense.fincas_owner_al_crear();

-- Solo un superadmin cambia "activa" u "origen" de una organización.
create or replace function agrosense.organizaciones_proteger_campos()
returns trigger language plpgsql security definer set search_path = agrosense, pg_temp as $$
begin
  if (new.activa is distinct from old.activa or new.origen is distinct from old.origen)
     and not agrosense.es_superadmin() and auth.uid() is not null then
    raise exception 'No autorizado para cambiar el estado de la organización';
  end if;
  return new;
end $$;
create trigger organizaciones_proteger_campos before update on agrosense.organizaciones
  for each row execute function agrosense.organizaciones_proteger_campos();

alter table agrosense.organizacion_miembros enable row level security;
grant select, insert, update, delete on agrosense.organizacion_miembros to authenticated, service_role;

create policy org_miembros_select on agrosense.organizacion_miembros for select to authenticated
  using (auth_user_id = auth.uid() or agrosense.es_dueno_org(organizacion_id));
create policy org_miembros_superadmin on agrosense.organizacion_miembros for all to authenticated
  using (agrosense.es_superadmin()) with check (agrosense.es_superadmin());

-- Organizaciones: los dueños la ven y la editan (datos y avance de onboarding).
drop policy org_select on agrosense.organizaciones;
create policy org_select on agrosense.organizaciones for select to authenticated
  using (agrosense.es_dueno_org(id) or exists (
    select 1 from agrosense.fincas f join agrosense.membresias m on m.finca_id = f.id
    where f.organizacion_id = organizaciones.id and m.auth_user_id = auth.uid()));
create policy org_update_dueno on agrosense.organizaciones for update to authenticated
  using (agrosense.es_dueno_org(id)) with check (agrosense.es_dueno_org(id));

-- Fincas: el dueño de la organización también las crea, dentro de su plan.
drop policy fincas_insert on agrosense.fincas;
create policy fincas_insert on agrosense.fincas for insert to authenticated
  with check (agrosense.es_superadmin() or (organizacion_id is not null and agrosense.puede_crear_finca(organizacion_id)));

-- Suscripción visible también para los dueños de la organización.
drop policy suscripciones_select on agrosense.suscripciones;
create policy suscripciones_select on agrosense.suscripciones for select to authenticated
  using (agrosense.es_dueno_org(organizacion_id) or exists (
    select 1 from agrosense.fincas f join agrosense.membresias m on m.finca_id = f.id
    where f.organizacion_id = suscripciones.organizacion_id and m.auth_user_id = auth.uid()));

-- El dueño de la organización ve todas sus fincas (necesario también para insert ... returning).
drop policy fincas_select on agrosense.fincas;
create policy fincas_select on agrosense.fincas for select to authenticated
  using (agrosense.tiene_acceso(id) or (organizacion_id is not null and agrosense.es_dueno_org(organizacion_id)));

-- El servidor (service role, sin usuario) también puede cambiar el rol de una membresía:
-- lo necesitan las invitaciones de equipo y el alta de usuarios desde Admin.
create or replace function agrosense.membresias_proteger_campos()
returns trigger language plpgsql security definer set search_path = agrosense, pg_temp as $$
begin
  if (new.rol is distinct from old.rol
      or new.finca_id is distinct from old.finca_id
      or new.auth_user_id is distinct from old.auth_user_id)
     and auth.uid() is not null
     and not (agrosense.rol_en_finca(old.finca_id) = 'owner' or agrosense.es_superadmin()) then
    raise exception 'No autorizado para cambiar rol, finca o usuario de la membresía';
  end if;
  return new;
end $$;
