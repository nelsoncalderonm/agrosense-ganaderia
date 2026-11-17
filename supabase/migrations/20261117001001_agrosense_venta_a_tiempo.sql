-- Ganado al Día: vender a tiempo.
-- 1) Cada finca tiene una meta de peso para sacar al matadero y el precio del kilo en pie.
-- 2) Los tratamientos guardan los días de retiro: el animal no se debe vender antes de esa fecha.
-- Solo agrega columnas; no borra ni cambia datos existentes.

-- ---------- Meta de peso y precio del kilo ----------

alter table agrosense.fincas
  add column meta_peso_kg numeric not null default 480 check (meta_peso_kg > 0 and meta_peso_kg < 2000),
  add column precio_kg numeric check (precio_kg is null or precio_kg > 0),
  add column precio_kg_actualizado timestamptz;

-- ---------- Días de retiro ----------

alter table agrosense.eventos_sanitarios
  add column dias_retiro integer check (dias_retiro is null or (dias_retiro >= 0 and dias_retiro <= 365)),
  add column retiro_hasta date generated always as (fecha + coalesce(dias_retiro, 0)) stored;
create index eventos_sanitarios_retiro_idx on agrosense.eventos_sanitarios (finca_id, retiro_hasta)
  where dias_retiro > 0;

-- La cola sin señal ahora también guarda los días de retiro.
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
    insert into agrosense.eventos_sanitarios (id, finca_id, animal_id, potrero_id, tipo, producto, dosis, animales_count, fecha, notas, dias_retiro)
    values (coalesce((p->>'id')::uuid, gen_random_uuid()), p_finca_id, v_animal, nullif(p->>'potrero_id', '')::uuid,
            p->>'tipo', p->>'producto', p->>'dosis', nullif(p->>'animales_count', '')::integer,
            coalesce((p->>'fecha')::date, current_date), p->>'notas', nullif(p->>'dias_retiro', '')::integer)
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

revoke execute on all functions in schema agrosense from public, anon;
grant execute on all functions in schema agrosense to authenticated, service_role;
