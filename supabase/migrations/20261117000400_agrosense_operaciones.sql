-- AgroSense: operaciones de varios pasos como funciones de todo-o-nada.
-- Corren con los permisos del usuario (security invoker), así que RLS aplica igual.

-- Pesaje con GDP real: días desde el pesaje anterior (o desde el ingreso del animal).
create or replace function agrosense.registrar_pesaje(
  p_animal_id uuid, p_peso_kg numeric, p_fecha timestamptz default now(), p_sesion_id uuid default null
) returns agrosense.pesajes
language plpgsql security invoker set search_path = agrosense, pg_temp as $$
declare
  a agrosense.animales;
  prev_peso numeric; prev_fecha timestamptz; dias integer; v_gdp numeric;
  r agrosense.pesajes;
begin
  if p_peso_kg is null or p_peso_kg <= 0 then raise exception 'Peso inválido'; end if;
  select * into a from agrosense.animales where id = p_animal_id and activo for update;
  if not found then raise exception 'Animal no encontrado o inactivo'; end if;

  select peso_kg, fecha into prev_peso, prev_fecha from agrosense.pesajes
   where animal_id = p_animal_id and fecha < p_fecha order by fecha desc limit 1;
  if prev_peso is null then
    select peso_kg, fecha::timestamptz into prev_peso, prev_fecha from agrosense.animal_eventos
     where animal_id = p_animal_id and tipo in ('compra','nacimiento') and peso_kg is not null
     order by fecha limit 1;
  end if;

  dias := case when prev_fecha is null then null
               else greatest(1, (p_fecha::date - prev_fecha::date)) end;
  v_gdp := case when prev_peso is null or dias is null then null
                else round((p_peso_kg - prev_peso) / dias, 3) end;

  insert into agrosense.pesajes (animal_id, finca_id, sesion_id, usuario_id, peso_kg, gdp_calculado, dias_periodo, fecha)
  values (a.id, a.finca_id, p_sesion_id, auth.uid(), p_peso_kg, v_gdp, dias, p_fecha)
  returning * into r;

  update agrosense.animales set
    peso_actual = p_peso_kg,
    gdp_delta = case when v_gdp is not null and a.gdp is not null then round(v_gdp - a.gdp, 3) end,
    gdp = v_gdp,
    fecha_ultimo_pesaje = p_fecha
  where id = a.id;

  if p_sesion_id is not null then
    update agrosense.sesiones_pesaje set animales_count = animales_count + 1 where id = p_sesion_id;
  end if;
  return r;
end $$;

-- Alta de animal comprado o nacido en la finca (animal + evento de origen).
create or replace function agrosense.registrar_animal(
  p_finca_id uuid, p_arete text, p_nombre text, p_raza text, p_sexo text, p_categoria text,
  p_potrero_id uuid, p_peso_kg numeric, p_fecha date, p_origen text,
  p_contraparte text default null, p_precio_kg numeric default null, p_total_cop bigint default null
) returns uuid
language plpgsql security invoker set search_path = agrosense, pg_temp as $$
declare v_id uuid;
begin
  if p_origen not in ('compra','nacimiento') then raise exception 'Origen inválido'; end if;
  insert into agrosense.animales (finca_id, potrero_id, nombre, arete, rfid, raza, sexo, categoria,
    estado, estado_txt, peso_actual, fecha_ingreso, fecha_ultimo_pesaje)
  values (p_finca_id, p_potrero_id, nullif(trim(p_nombre), ''), trim(p_arete), trim(p_arete), p_raza, p_sexo,
    coalesce(p_categoria, case when p_origen = 'nacimiento' then 'Cría' else 'Ceba' end),
    'green', case when p_origen = 'nacimiento' then 'Sano · recién nacido' else 'Sano · recién registrado' end,
    p_peso_kg, p_fecha, case when p_peso_kg is not null then p_fecha::timestamptz end)
  returning id into v_id;

  insert into agrosense.animal_eventos (animal_id, finca_id, tipo, fecha, peso_kg, precio_kg, total_cop, contraparte, notas)
  values (v_id, p_finca_id, p_origen, p_fecha, p_peso_kg, p_precio_kg, p_total_cop,
          case when p_origen = 'compra' then p_contraparte end,
          case when p_origen = 'nacimiento' then 'Nació en la finca' end);

  if p_origen = 'nacimiento' then
    insert into agrosense.nacimientos (finca_id, animal_id, potrero_id, fecha, sexo)
    values (p_finca_id, v_id, p_potrero_id, p_fecha, coalesce(p_sexo, 'Sin dato'));
  end if;
  return v_id;
end $$;

-- Venta individual: evento con precio + animal fuera del inventario.
create or replace function agrosense.registrar_venta(
  p_animal_id uuid, p_fecha date, p_peso_kg numeric, p_precio_kg numeric default null,
  p_comprador text default null, p_notas text default null
) returns void
language plpgsql security invoker set search_path = agrosense, pg_temp as $$
declare a agrosense.animales;
begin
  select * into a from agrosense.animales where id = p_animal_id and activo for update;
  if not found then raise exception 'Animal no encontrado o inactivo'; end if;
  insert into agrosense.animal_eventos (animal_id, finca_id, tipo, fecha, peso_kg, precio_kg, total_cop, contraparte, notas)
  values (a.id, a.finca_id, 'venta', p_fecha, p_peso_kg, p_precio_kg,
          case when p_peso_kg is not null and p_precio_kg is not null then round(p_peso_kg * p_precio_kg)::bigint end,
          p_comprador, p_notas);
  update agrosense.animales set activo = false where id = a.id;
end $$;

-- Baja (muerte o pérdida).
create or replace function agrosense.registrar_baja(p_animal_id uuid, p_fecha date, p_causa text)
returns void
language plpgsql security invoker set search_path = agrosense, pg_temp as $$
declare a agrosense.animales;
begin
  select * into a from agrosense.animales where id = p_animal_id and activo for update;
  if not found then raise exception 'Animal no encontrado o inactivo'; end if;
  insert into agrosense.bajas (finca_id, animal_id, fecha, causa) values (a.finca_id, a.id, p_fecha, p_causa);
  insert into agrosense.animal_eventos (animal_id, finca_id, tipo, fecha, contraparte)
  values (a.id, a.finca_id, 'baja', p_fecha, p_causa);
  update agrosense.animales set activo = false where id = a.id;
end $$;

-- Traslado entre fincas (el usuario debe tener acceso a ambas por RLS).
create or replace function agrosense.trasladar_animal(
  p_animal_id uuid, p_finca_destino_id uuid, p_fecha date, p_notas text default null
) returns void
language plpgsql security invoker set search_path = agrosense, pg_temp as $$
declare a agrosense.animales;
begin
  select * into a from agrosense.animales where id = p_animal_id and activo for update;
  if not found then raise exception 'Animal no encontrado o inactivo'; end if;
  if a.finca_id = p_finca_destino_id then raise exception 'La finca destino es la misma'; end if;
  insert into agrosense.animal_eventos (animal_id, finca_id, tipo, fecha, finca_origen_id, notas)
  values (a.id, p_finca_destino_id, 'traslado', p_fecha, a.finca_id, p_notas);
  update agrosense.animales set finca_id = p_finca_destino_id, potrero_id = null where id = a.id;
end $$;

revoke execute on all functions in schema agrosense from public, anon;
grant execute on all functions in schema agrosense to authenticated, service_role;
