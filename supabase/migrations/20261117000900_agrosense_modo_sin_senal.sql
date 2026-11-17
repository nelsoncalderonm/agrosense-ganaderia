-- AgroSense: modo sin señal.
-- El celular guarda cada registro en una cola local y lo envía cuando hay internet.
-- Cada operación trae un id único generado en el celular: si llega dos veces, se aplica una sola vez.
-- Si no se puede aplicar (animal ya vendido, sin permisos, datos inválidos) queda como "conflicto"
-- para que una persona lo revise; nunca se pierde.

-- ---------- Registro de operaciones recibidas ----------

create table agrosense.sync_operaciones (
  id uuid primary key,                       -- generado en el celular
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  usuario_id uuid default auth.uid(),
  tipo text not null,
  payload jsonb not null,
  estado text not null check (estado in ('aplicada','conflicto','descartada')),
  resultado jsonb,
  error text,
  creada_en timestamptz not null,            -- hora del celular cuando se hizo el registro
  recibida_en timestamptz not null default now(),
  dispositivo text,
  resuelta_por uuid,
  resuelta_en timestamptz
);
create index sync_operaciones_finca_idx on agrosense.sync_operaciones (finca_id, recibida_en desc);
create index sync_operaciones_conflictos_idx on agrosense.sync_operaciones (finca_id) where estado = 'conflicto';
-- Para encontrar el animal real de un alta hecha sin señal (ver resolver_animal).
create index sync_operaciones_alta_idx on agrosense.sync_operaciones ((payload->>'id')) where tipo = 'animal_alta';

alter table agrosense.sync_operaciones enable row level security;
create policy sync_operaciones_select on agrosense.sync_operaciones for select to authenticated
  using (agrosense.tiene_acceso(finca_id));
create policy sync_operaciones_insert on agrosense.sync_operaciones for insert to authenticated
  with check (agrosense.tiene_acceso(finca_id) and usuario_id = auth.uid());
-- Marcar un conflicto como descartado: quien lo hizo, o el owner/admin de la finca.
create policy sync_operaciones_update on agrosense.sync_operaciones for update to authenticated
  using (usuario_id = auth.uid() or agrosense.rol_en_finca(finca_id) in ('owner','admin'))
  with check (agrosense.tiene_acceso(finca_id));
grant select, insert, update on agrosense.sync_operaciones to authenticated, service_role;

-- ---------- Eventos sanitarios (vacuna, desparasitación, tratamiento) ----------

create table agrosense.eventos_sanitarios (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  animal_id uuid references agrosense.animales(id) on delete set null,   -- null = aplicado a un grupo
  potrero_id uuid references agrosense.potreros(id) on delete set null,
  tipo text not null check (tipo in ('vacuna','desparasitacion','tratamiento','vitaminas','otro')),
  producto text,
  dosis text,
  animales_count integer check (animales_count is null or animales_count > 0),
  fecha date not null default current_date,
  notas text,
  usuario_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on agrosense.eventos_sanitarios (finca_id, fecha desc);
create index on agrosense.eventos_sanitarios (animal_id, fecha desc);
alter table agrosense.eventos_sanitarios enable row level security;
create policy eventos_sanitarios_miembros on agrosense.eventos_sanitarios for all to authenticated
  using (agrosense.tiene_acceso(finca_id)) with check (agrosense.tiene_acceso(finca_id));
grant select, insert, update, delete on agrosense.eventos_sanitarios to authenticated, service_role;

-- ---------- Alta de animal con id del celular ----------
-- Los pesajes de un animal creado sin señal apuntan al id que generó el celular.

drop function agrosense.registrar_animal(uuid, text, text, text, text, text, uuid, numeric, date, text, text, numeric, bigint);
create function agrosense.registrar_animal(
  p_finca_id uuid, p_arete text, p_nombre text, p_raza text, p_sexo text, p_categoria text,
  p_potrero_id uuid, p_peso_kg numeric, p_fecha date, p_origen text,
  p_contraparte text default null, p_precio_kg numeric default null, p_total_cop bigint default null,
  p_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = agrosense, pg_temp as $$
declare v_id uuid;
begin
  if p_origen not in ('compra','nacimiento') then raise exception 'Origen inválido'; end if;
  insert into agrosense.animales (id, finca_id, potrero_id, nombre, arete, rfid, raza, sexo, categoria,
    estado, estado_txt, peso_actual, fecha_ingreso, fecha_ultimo_pesaje)
  values (coalesce(p_id, gen_random_uuid()), p_finca_id, p_potrero_id, nullif(trim(p_nombre), ''), trim(p_arete), trim(p_arete), p_raza, p_sexo,
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

-- ---------- Pesaje que llega tarde ----------
-- Igual que antes, pero un pesaje más viejo que el último no pisa el peso actual del animal,
-- y se corrige la GDP del pesaje que sigue.

create or replace function agrosense.registrar_pesaje(
  p_animal_id uuid, p_peso_kg numeric, p_fecha timestamptz default now(), p_sesion_id uuid default null
) returns agrosense.pesajes
language plpgsql security invoker set search_path = agrosense, pg_temp as $$
declare
  a agrosense.animales;
  prev_peso numeric; prev_fecha timestamptz; dias integer; v_gdp numeric;
  sig agrosense.pesajes; sig_dias integer; sig_gdp numeric;
  r agrosense.pesajes;
begin
  if p_peso_kg is null or p_peso_kg <= 0 then raise exception 'Peso inválido'; end if;
  if p_fecha > now() + interval '1 day' then raise exception 'La fecha del celular está adelantada; revise la hora del equipo'; end if;
  select * into a from agrosense.animales where id = p_animal_id and activo for update;
  if not found then raise exception 'Animal no encontrado o inactivo'; end if;

  select peso_kg, fecha into prev_peso, prev_fecha from agrosense.pesajes
   where animal_id = p_animal_id and fecha < p_fecha order by fecha desc limit 1;
  if prev_peso is null then
    select peso_kg, fecha::timestamptz into prev_peso, prev_fecha from agrosense.animal_eventos
     where animal_id = p_animal_id and tipo in ('compra','nacimiento') and peso_kg is not null
     order by fecha limit 1;
  end if;

  -- Mismo día que el pesaje anterior (p. ej. registrar el animal y pesarlo en la manga): no hay GDP.
  dias := case when prev_fecha is null or p_fecha::date = prev_fecha::date then null
               else greatest(1, (p_fecha::date - prev_fecha::date)) end;
  v_gdp := case when prev_peso is null or dias is null then null
                else round((p_peso_kg - prev_peso) / dias, 3) end;

  insert into agrosense.pesajes (animal_id, finca_id, sesion_id, usuario_id, peso_kg, gdp_calculado, dias_periodo, fecha)
  values (a.id, a.finca_id, p_sesion_id, auth.uid(), p_peso_kg, v_gdp, dias, p_fecha)
  returning * into r;

  if a.fecha_ultimo_pesaje is null or p_fecha >= a.fecha_ultimo_pesaje then
    update agrosense.animales set
      peso_actual = p_peso_kg,
      gdp_delta = case when v_gdp is null then a.gdp_delta
                       when a.gdp is not null then round(v_gdp - a.gdp, 3) end,
      gdp = coalesce(v_gdp, a.gdp),
      fecha_ultimo_pesaje = p_fecha
    where id = a.id;
  else
    -- Llegó tarde: el pesaje siguiente ahora se mide contra este.
    select * into sig from agrosense.pesajes
     where animal_id = a.id and fecha > p_fecha order by fecha limit 1;
    if found then
      sig_dias := greatest(1, (sig.fecha::date - p_fecha::date));
      sig_gdp := round((sig.peso_kg - p_peso_kg) / sig_dias, 3);
      update agrosense.pesajes set gdp_calculado = sig_gdp, dias_periodo = sig_dias where id = sig.id;
      if sig.fecha = a.fecha_ultimo_pesaje then
        update agrosense.animales set gdp = sig_gdp where id = a.id;
      end if;
    end if;
  end if;

  if p_sesion_id is not null then
    update agrosense.sesiones_pesaje set animales_count = animales_count + 1 where id = p_sesion_id;
  end if;
  return r;
end $$;

-- ---------- Aplicar una operación de la cola ----------

-- Si el animal se creó sin señal y el arete ya existía, se usa el animal que ya estaba.
create or replace function agrosense.resolver_animal(p_id uuid)
returns uuid language sql stable security invoker set search_path = agrosense, pg_temp as $$
  select coalesce(
    (select (resultado->>'animal_id')::uuid from agrosense.sync_operaciones
      where tipo = 'animal_alta' and payload->>'id' = p_id::text and estado = 'aplicada' limit 1),
    p_id);
$$;

create or replace function agrosense.sync_ejecutar(p_finca_id uuid, p_tipo text, p jsonb)
returns jsonb language plpgsql security invoker set search_path = agrosense, pg_temp as $$
declare
  v_animal uuid; v_existente uuid; v_id uuid; r agrosense.pesajes;
begin
  case p_tipo
  when 'pesaje' then
    v_animal := agrosense.resolver_animal((p->>'animal_id')::uuid);
    r := agrosense.registrar_pesaje(v_animal, (p->>'peso_kg')::numeric,
           coalesce((p->>'fecha')::timestamptz, now()), nullif(p->>'sesion_id', '')::uuid);
    return jsonb_build_object('pesaje_id', r.id, 'animal_id', v_animal, 'gdp', r.gdp_calculado);

  when 'animal_alta' then
    -- Dos vaqueros pueden registrar el mismo arete sin señal: es el mismo animal.
    select id into v_existente from agrosense.animales
     where finca_id = p_finca_id and activo and upper(arete) = upper(trim(p->>'arete')) limit 1;
    if v_existente is not null then
      return jsonb_build_object('animal_id', v_existente, 'fusionado', true);
    end if;
    v_id := agrosense.registrar_animal(
      p_finca_id, p->>'arete', p->>'nombre', p->>'raza', p->>'sexo', p->>'categoria',
      nullif(p->>'potrero_id', '')::uuid, nullif(p->>'peso_kg', '')::numeric,
      coalesce((p->>'fecha')::date, current_date), coalesce(p->>'origen', 'compra'),
      p->>'contraparte', nullif(p->>'precio_kg', '')::numeric, nullif(p->>'total_cop', '')::bigint,
      (p->>'id')::uuid);
    return jsonb_build_object('animal_id', v_id);

  when 'venta' then
    v_animal := agrosense.resolver_animal((p->>'animal_id')::uuid);
    perform agrosense.registrar_venta(v_animal, (p->>'fecha')::date, nullif(p->>'peso_kg', '')::numeric,
      nullif(p->>'precio_kg', '')::numeric, p->>'comprador', p->>'notas');
    return jsonb_build_object('animal_id', v_animal);

  when 'baja' then
    v_animal := agrosense.resolver_animal((p->>'animal_id')::uuid);
    perform agrosense.registrar_baja(v_animal, (p->>'fecha')::date, p->>'causa');
    return jsonb_build_object('animal_id', v_animal);

  when 'traslado' then
    v_animal := agrosense.resolver_animal((p->>'animal_id')::uuid);
    perform agrosense.trasladar_animal(v_animal, (p->>'finca_destino_id')::uuid, (p->>'fecha')::date, p->>'notas');
    return jsonb_build_object('animal_id', v_animal);

  when 'evento_sanitario' then
    v_animal := case when p->>'animal_id' is not null then agrosense.resolver_animal((p->>'animal_id')::uuid) end;
    insert into agrosense.eventos_sanitarios (id, finca_id, animal_id, potrero_id, tipo, producto, dosis, animales_count, fecha, notas)
    values (coalesce((p->>'id')::uuid, gen_random_uuid()), p_finca_id, v_animal, nullif(p->>'potrero_id', '')::uuid,
            p->>'tipo', p->>'producto', p->>'dosis', nullif(p->>'animales_count', '')::integer,
            coalesce((p->>'fecha')::date, current_date), p->>'notas')
    returning id into v_id;
    return jsonb_build_object('evento_id', v_id);

  when 'gasto' then
    insert into agrosense.gastos (finca_id, proveedor_id, concepto, items_desc, monto, fecha, via, nit_proveedor, pendiente_sync)
    values (p_finca_id, nullif(p->>'proveedor_id', '')::uuid, p->>'concepto', p->>'items_desc',
            (p->>'monto')::numeric, (p->>'fecha')::date, coalesce(p->>'via', 'app'), null, false)
    returning id into v_id;
    return jsonb_build_object('gasto_id', v_id);

  else
    raise exception 'Tipo de operación desconocido: %', p_tipo;
  end case;
end $$;

-- Punto de entrada que llama el celular. Idempotente por p_id.
create or replace function agrosense.sync_aplicar(
  p_id uuid, p_finca_id uuid, p_tipo text, p_payload jsonb,
  p_creada_en timestamptz default now(), p_dispositivo text default null
) returns jsonb
language plpgsql security invoker set search_path = agrosense, pg_temp as $$
declare
  op agrosense.sync_operaciones;
  v_res jsonb; v_estado text; v_err text;
begin
  select * into op from agrosense.sync_operaciones where id = p_id;
  if found then
    return jsonb_build_object('estado', op.estado, 'resultado', op.resultado, 'error', op.error, 'repetida', true);
  end if;
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if not agrosense.tiene_acceso(p_finca_id) then
    -- No se puede anotar en la base (RLS); el celular lo deja como conflicto local.
    return jsonb_build_object('estado', 'conflicto', 'resultado', null, 'error', 'Sin acceso a la finca', 'repetida', false);
  end if;

  begin
    v_res := agrosense.sync_ejecutar(p_finca_id, p_tipo, p_payload);
    v_estado := 'aplicada';
  exception when others then
    -- Todo lo que hizo la operación se deshace, pero queda anotada para revisión.
    v_estado := 'conflicto'; v_err := sqlerrm; v_res := null;
  end;

  insert into agrosense.sync_operaciones (id, finca_id, usuario_id, tipo, payload, estado, resultado, error, creada_en, dispositivo)
  values (p_id, p_finca_id, auth.uid(), p_tipo, p_payload, v_estado, v_res, v_err, p_creada_en, p_dispositivo);

  return jsonb_build_object('estado', v_estado, 'resultado', v_res, 'error', v_err, 'repetida', false);
end $$;

-- Descartar un conflicto (queda el registro, no se aplica).
create or replace function agrosense.sync_descartar(p_id uuid)
returns void language plpgsql security invoker set search_path = agrosense, pg_temp as $$
begin
  update agrosense.sync_operaciones set estado = 'descartada', resuelta_por = auth.uid(), resuelta_en = now()
   where id = p_id and estado = 'conflicto';
end $$;

revoke execute on all functions in schema agrosense from public, anon;
grant execute on all functions in schema agrosense to authenticated, service_role;
