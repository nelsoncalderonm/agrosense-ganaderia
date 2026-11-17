-- Ganado al Día: tablero para el televisor de la finca.
-- Cada televisor es una "pantalla". El televisor guarda un token secreto (aquí solo su hash)
-- y se vincula a una finca con un código de 6 letras que el dueño escribe en el celular,
-- o con un enlace de solo lectura. Cada pantalla tiene su propia lista de paneles.
-- Solo agrega una tabla; no cambia datos existentes.

create table if not exists agrosense.pantallas_tv (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid references agrosense.fincas(id) on delete cascade,      -- null mientras espera el código
  nombre text not null default 'Televisor',
  token_hash text not null unique,                                       -- sha256 del token del televisor
  codigo text unique,                                                    -- código de vinculación (6 letras)
  codigo_expira timestamptz,
  paneles jsonb not null default
    '["resumen","engorde","listos","no_engordan","ventas","clima","tareas"]'::jsonb,
  segundos_panel integer not null default 15 check (segundos_panel between 5 and 120),
  tema text not null default 'oscuro' check (tema in ('oscuro','claro')),
  vinculada_por uuid references auth.users(id) on delete set null,
  vinculada_en timestamptz,
  ultima_conexion timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(paneles) = 'array')
);
create index if not exists pantallas_tv_finca_idx on agrosense.pantallas_tv (finca_id);
create index if not exists pantallas_tv_pendientes_idx on agrosense.pantallas_tv (created_at) where finca_id is null;

drop trigger if exists pantallas_tv_updated_at on agrosense.pantallas_tv;
create trigger pantallas_tv_updated_at before update on agrosense.pantallas_tv
  for each row execute function agrosense.tocar_updated_at();

-- Solo el dueño o el administrador de la finca ven y configuran sus televisores.
-- Crear y vincular pasa por el servidor (/api/tv/*) con la llave de servicio.
alter table agrosense.pantallas_tv enable row level security;

drop policy if exists pantallas_tv_select on agrosense.pantallas_tv;
create policy pantallas_tv_select on agrosense.pantallas_tv for select to authenticated
  using (finca_id is not null and coalesce(agrosense.rol_en_finca(finca_id) in ('owner','admin'), false));

drop policy if exists pantallas_tv_update on agrosense.pantallas_tv;
create policy pantallas_tv_update on agrosense.pantallas_tv for update to authenticated
  using (finca_id is not null and coalesce(agrosense.rol_en_finca(finca_id) in ('owner','admin'), false))
  with check (finca_id is not null and coalesce(agrosense.rol_en_finca(finca_id) in ('owner','admin'), false));

drop policy if exists pantallas_tv_delete on agrosense.pantallas_tv;
create policy pantallas_tv_delete on agrosense.pantallas_tv for delete to authenticated
  using (finca_id is not null and coalesce(agrosense.rol_en_finca(finca_id) in ('owner','admin'), false));

-- Desde el celular solo se cambian nombre y configuración; nunca la finca, el token ni el código.
revoke all on agrosense.pantallas_tv from anon, authenticated;
grant select (id, finca_id, nombre, paneles, segundos_panel, tema, vinculada_en, ultima_conexion, created_at, updated_at)
  on agrosense.pantallas_tv to authenticated;
grant update (nombre, paneles, segundos_panel, tema) on agrosense.pantallas_tv to authenticated;
grant delete on agrosense.pantallas_tv to authenticated;
grant all on agrosense.pantallas_tv to service_role;
