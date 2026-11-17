-- AgroSense: bot de Telegram y reportes semanales.
-- Solo agrega tablas, columnas y funciones nuevas en el esquema agrosense.

-- ---------- Telegram ----------

-- Un chat de Telegram vinculado a una membresía (persona + finca).
create table agrosense.telegram_vinculos (
  id uuid primary key default gen_random_uuid(),
  membresia_id uuid not null references agrosense.membresias(id) on delete cascade,
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  auth_user_id uuid not null,
  chat_id bigint not null,
  telegram_username text,
  recibir_reportes boolean not null default true,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (membresia_id)
);
create index telegram_vinculos_chat_idx on agrosense.telegram_vinculos (chat_id) where activo;
create index telegram_vinculos_finca_idx on agrosense.telegram_vinculos (finca_id);

-- Códigos de un solo uso para vincular (t.me/<bot>?start=<codigo>). Solo los usa el servidor.
create table agrosense.telegram_codigos (
  codigo text primary key,
  membresia_id uuid not null references agrosense.membresias(id) on delete cascade,
  expira_at timestamptz not null,
  usado_at timestamptz,
  created_at timestamptz not null default now()
);

-- Log de reportes enviados; evita enviar dos veces el mismo reporte.
create table agrosense.reportes_enviados (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references agrosense.telegram_vinculos(id) on delete cascade,
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  tipo text not null default 'semanal',
  periodo_inicio date not null,
  periodo_fin date not null,
  ok boolean not null default true,
  error text,
  enviado_at timestamptz not null default now(),
  unique (vinculo_id, tipo, periodo_inicio)
);

-- ---------- Agenda: quién completó cada tarea ----------

alter table agrosense.eventos
  add column completado_por uuid,
  add column completado_at timestamptz;

create or replace function agrosense.eventos_marcar_completado()
returns trigger language plpgsql set search_path = agrosense, pg_temp as $$
begin
  if new.completado and not coalesce(old.completado, false) then
    new.completado_por := coalesce(new.completado_por, auth.uid());
    new.completado_at := coalesce(new.completado_at, now());
  elsif not new.completado then
    new.completado_por := null;
    new.completado_at := null;
  end if;
  return new;
end $$;
create trigger eventos_marcar_completado before insert or update of completado on agrosense.eventos
  for each row execute function agrosense.eventos_marcar_completado();

-- ---------- RLS ----------

alter table agrosense.telegram_vinculos enable row level security;
alter table agrosense.telegram_codigos enable row level security;   -- sin políticas: solo service role
alter table agrosense.reportes_enviados enable row level security;

-- Cada quien ve su vínculo; owner/admin ven los de su finca. Altas solo por el servidor.
create policy telegram_vinculos_select on agrosense.telegram_vinculos for select to authenticated
  using (auth_user_id = auth.uid() or agrosense.rol_en_finca(finca_id) in ('owner','admin'));
create policy telegram_vinculos_update on agrosense.telegram_vinculos for update to authenticated
  using (auth_user_id = auth.uid() or agrosense.rol_en_finca(finca_id) = 'owner')
  with check (auth_user_id = auth.uid() or agrosense.rol_en_finca(finca_id) = 'owner');
create policy telegram_vinculos_delete on agrosense.telegram_vinculos for delete to authenticated
  using (auth_user_id = auth.uid() or agrosense.rol_en_finca(finca_id) = 'owner');

create policy reportes_enviados_select on agrosense.reportes_enviados for select to authenticated
  using (agrosense.rol_en_finca(finca_id) in ('owner','admin'));

grant select, insert, update, delete on agrosense.telegram_vinculos, agrosense.reportes_enviados to authenticated;
grant all on agrosense.telegram_vinculos, agrosense.telegram_codigos, agrosense.reportes_enviados to service_role;

-- ---------- Reporte semanal ----------
-- Devuelve todo el reporte de una finca entre p_desde y p_hasta (fechas en hora de Colombia, ambos incluidos).
create or replace function agrosense.reporte_finca(p_finca_id uuid, p_desde date, p_hasta date)
returns jsonb language plpgsql stable security invoker set search_path = agrosense, pg_temp as $$
declare
  dias integer := (p_hasta - p_desde) + 1;
  prev_desde date := p_desde - ((p_hasta - p_desde) + 1);
  prev_hasta date := p_desde - 1;
  res jsonb;
begin
  if auth.uid() is not null and not agrosense.tiene_acceso(p_finca_id) then
    raise exception 'No autorizado';
  end if;

  with
  pes as (
    select p.*, (p.fecha at time zone 'America/Bogota')::date as dia
    from pesajes p where p.finca_id = p_finca_id
      and (p.fecha at time zone 'America/Bogota')::date between prev_desde and p_hasta
  ),
  pes_act as (select * from pes where dia between p_desde and p_hasta),
  pes_prev as (select * from pes where dia between prev_desde and prev_hasta),
  ult as (  -- último pesaje de cada animal en el periodo
    select distinct on (animal_id) animal_id, gdp_calculado, peso_kg
    from pes_act where gdp_calculado is not null
    order by animal_id, fecha desc
  ),
  ranking as (
    select a.arete, a.nombre, u.gdp_calculado as gdp, u.peso_kg
    from ult u join animales a on a.id = u.animal_id
  ),
  equipo as (
    select m.auth_user_id, m.nombre, m.rol from membresias m where m.finca_id = p_finca_id
  )
  select jsonb_build_object(
    'finca', (select jsonb_build_object('id', f.id, 'nombre', f.nombre) from fincas f where f.id = p_finca_id),
    'desde', p_desde, 'hasta', p_hasta, 'dias', dias,
    'inventario', jsonb_build_object(
      'total', (select count(*) from animales where finca_id = p_finca_id and activo),
      'por_categoria', coalesce((select jsonb_object_agg(coalesce(categoria,'Sin categoría'), n)
        from (select categoria, count(*) n from animales where finca_id = p_finca_id and activo group by categoria) c), '{}'::jsonb),
      'peso_promedio', (select round(avg(peso_actual),1) from animales where finca_id = p_finca_id and activo and peso_actual is not null)
    ),
    'produccion', jsonb_build_object(
      'pesajes', (select count(*) from pes_act),
      'animales_pesados', (select count(distinct animal_id) from pes_act),
      'gdp_promedio', (select round(avg(gdp_calculado),3) from pes_act where gdp_calculado is not null),
      'gdp_promedio_anterior', (select round(avg(gdp_calculado),3) from pes_prev where gdp_calculado is not null),
      'kg_ganados', (select round(sum(gdp_calculado * dias_periodo),1) from pes_act where gdp_calculado is not null),
      'mejores', coalesce((select jsonb_agg(r) from (select * from ranking order by gdp desc limit 5) r), '[]'::jsonb),
      'peores', coalesce((select jsonb_agg(r) from (select * from ranking order by gdp asc limit 5) r), '[]'::jsonb),
      'gdp_bajo_umbral', (select count(*) from ranking where gdp < 0.4)
    ),
    'hato', jsonb_build_object(
      'compras', (select count(*) from animal_eventos where finca_id = p_finca_id and tipo = 'compra' and fecha between p_desde and p_hasta),
      'nacimientos', (select count(*) from animal_eventos where finca_id = p_finca_id and tipo = 'nacimiento' and fecha between p_desde and p_hasta),
      'traslados_entrada', (select count(*) from animal_eventos where finca_id = p_finca_id and tipo = 'traslado' and fecha between p_desde and p_hasta),
      'traslados_salida', (select count(*) from animal_eventos where finca_origen_id = p_finca_id and tipo = 'traslado' and fecha between p_desde and p_hasta),
      'ventas', (select count(*) from animal_eventos where finca_id = p_finca_id and tipo = 'venta' and fecha between p_desde and p_hasta),
      'kg_vendidos', (select coalesce(sum(peso_kg),0) from animal_eventos where finca_id = p_finca_id and tipo = 'venta' and fecha between p_desde and p_hasta),
      'bajas', (select count(*) from animal_eventos where finca_id = p_finca_id and tipo = 'baja' and fecha between p_desde and p_hasta)
    ),
    'agenda', jsonb_build_object(
      'completadas', (select count(*) from eventos where finca_id = p_finca_id and completado
                       and coalesce((completado_at at time zone 'America/Bogota')::date, fecha) between p_desde and p_hasta),
      'vencidas', (select count(*) from eventos where finca_id = p_finca_id and not completado and fecha <= p_hasta),
      'proxima_semana', (select count(*) from eventos where finca_id = p_finca_id and not completado and fecha between p_hasta + 1 and p_hasta + 7)
    ),
    'mano_de_obra', coalesce((select jsonb_agg(t order by t.total desc, t.nombre) from (
      select e.nombre, e.rol,
        (select count(*) from pes_act p where p.usuario_id = e.auth_user_id) as pesajes,
        (select count(*) from sesiones_pesaje s where s.finca_id = p_finca_id and s.usuario_id = e.auth_user_id
           and (s.inicio at time zone 'America/Bogota')::date between p_desde and p_hasta) as sesiones,
        (select count(*) from eventos ev where ev.finca_id = p_finca_id and ev.completado_por = e.auth_user_id
           and (ev.completado_at at time zone 'America/Bogota')::date between p_desde and p_hasta) as tareas,
        (select count(*) from pes_act p where p.usuario_id = e.auth_user_id)
          + (select count(*) from eventos ev where ev.finca_id = p_finca_id and ev.completado_por = e.auth_user_id
           and (ev.completado_at at time zone 'America/Bogota')::date between p_desde and p_hasta) as total
      from equipo e
    ) t), '[]'::jsonb)
  ) into res;
  return res;
end $$;

revoke execute on function agrosense.reporte_finca(uuid, date, date) from public, anon;
grant execute on function agrosense.reporte_finca(uuid, date, date) to authenticated, service_role;
revoke execute on function agrosense.eventos_marcar_completado() from public, anon;
