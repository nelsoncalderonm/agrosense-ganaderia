-- AgroSense: funciones de acceso y reglas RLS.
-- Igual a las reglas actuales (por finca y por rol), con search_path fijo.

create or replace function agrosense.es_superadmin()
returns boolean language sql stable security definer set search_path = agrosense, pg_temp as $$
  select exists (select 1 from agrosense.superadmins where auth_user_id = auth.uid());
$$;

create or replace function agrosense.rol_en_finca(p_finca_id uuid)
returns text language sql stable security definer set search_path = agrosense, pg_temp as $$
  select coalesce(
    (select rol from agrosense.membresias where auth_user_id = auth.uid() and finca_id = p_finca_id limit 1),
    case when agrosense.es_superadmin() then 'owner' end
  );
$$;

create or replace function agrosense.tiene_acceso(p_finca_id uuid)
returns boolean language sql stable security definer set search_path = agrosense, pg_temp as $$
  select agrosense.rol_en_finca(p_finca_id) is not null;
$$;

create or replace function agrosense.puede_finanzas(p_finca_id uuid)
returns boolean language sql stable security definer set search_path = agrosense, pg_temp as $$
  select coalesce(agrosense.rol_en_finca(p_finca_id) in ('owner','contable'), false);
$$;

revoke execute on all functions in schema agrosense from public, anon;
grant execute on all functions in schema agrosense to authenticated, service_role;

-- Nadie puede cambiarse el rol, la finca o el usuario de una membresía salvo el owner o un superadmin.
create or replace function agrosense.membresias_proteger_campos()
returns trigger language plpgsql security definer set search_path = agrosense, pg_temp as $$
begin
  if (new.rol is distinct from old.rol
      or new.finca_id is distinct from old.finca_id
      or new.auth_user_id is distinct from old.auth_user_id)
     and not (agrosense.rol_en_finca(old.finca_id) = 'owner' or agrosense.es_superadmin()) then
    raise exception 'No autorizado para cambiar rol, finca o usuario de la membresía';
  end if;
  return new;
end $$;
create trigger membresias_proteger_campos before update on agrosense.membresias
  for each row execute function agrosense.membresias_proteger_campos();

-- updated_at automático
create or replace function agrosense.tocar_updated_at()
returns trigger language plpgsql set search_path = agrosense, pg_temp as $$
begin new.updated_at := now(); return new; end $$;
create trigger fincas_updated before update on agrosense.fincas for each row execute function agrosense.tocar_updated_at();
create trigger potreros_updated before update on agrosense.potreros for each row execute function agrosense.tocar_updated_at();
create trigger animales_updated before update on agrosense.animales for each row execute function agrosense.tocar_updated_at();

-- RLS en todas las tablas
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'agrosense' loop
    execute format('alter table agrosense.%I enable row level security', t);
  end loop;
end $$;

-- Organizaciones: solo superadmin administra; los miembros ven la suya.
create policy org_select on agrosense.organizaciones for select to authenticated
  using (agrosense.es_superadmin() or exists (
    select 1 from agrosense.fincas f join agrosense.membresias m on m.finca_id = f.id
    where f.organizacion_id = organizaciones.id and m.auth_user_id = auth.uid()));
create policy org_write on agrosense.organizaciones for all to authenticated
  using (agrosense.es_superadmin()) with check (agrosense.es_superadmin());

-- Fincas
create policy fincas_select on agrosense.fincas for select to authenticated using (agrosense.tiene_acceso(id));
create policy fincas_insert on agrosense.fincas for insert to authenticated with check (agrosense.es_superadmin());
create policy fincas_update on agrosense.fincas for update to authenticated
  using (agrosense.rol_en_finca(id) = 'owner') with check (agrosense.rol_en_finca(id) = 'owner');
create policy fincas_delete on agrosense.fincas for delete to authenticated using (agrosense.es_superadmin());

-- Superadmins: cada uno ve su propia fila; altas solo por service role.
create policy superadmins_self on agrosense.superadmins for select to authenticated using (auth_user_id = auth.uid());

-- Membresías
create policy membresias_select on agrosense.membresias for select to authenticated
  using (auth_user_id = auth.uid() or agrosense.rol_en_finca(finca_id) in ('owner','admin'));
create policy membresias_owner_write on agrosense.membresias for all to authenticated
  using (agrosense.rol_en_finca(finca_id) = 'owner') with check (agrosense.rol_en_finca(finca_id) = 'owner');
create policy membresias_self_update on agrosense.membresias for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Datos operativos: cualquier miembro de la finca.
do $$ declare t text; begin
  foreach t in array array['potreros','animales','sesiones_pesaje','pesajes','animal_eventos','nacimientos','bajas','alertas','eventos','vacunaciones'] loop
    execute format('create policy %I on agrosense.%I for all to authenticated using (agrosense.tiene_acceso(finca_id)) with check (agrosense.tiene_acceso(finca_id))', t || '_miembros', t);
  end loop;
end $$;

-- Datos financieros: owner y contable (igual que hoy).
do $$ declare t text; begin
  foreach t in array array['proveedores','clientes','gastos','movimientos','ingresos'] loop
    execute format('create policy %I on agrosense.%I for all to authenticated using (agrosense.puede_finanzas(finca_id)) with check (agrosense.puede_finanzas(finca_id))', t || '_finanzas', t);
  end loop;
end $$;
