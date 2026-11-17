-- AgroSense: planes y suscripciones cobradas por Hotmart.
-- El webhook de Hotmart (ruta /api/hotmart/webhook, con service role) escribe aquí;
-- los usuarios solo leen la suscripción de su organización.

create table agrosense.planes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  hotmart_product_id text,
  hotmart_plan_codigo text,
  max_animales integer,
  max_fincas integer,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table agrosense.suscripciones (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid references agrosense.organizaciones(id) on delete set null,
  plan_id uuid references agrosense.planes(id) on delete set null,
  comprador_email text not null,
  comprador_nombre text,
  hotmart_subscriber_code text unique,
  hotmart_product_id text,
  hotmart_transaccion text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','activa','atrasada','cancelada','reembolsada')),
  fecha_inicio timestamptz,
  proximo_cobro timestamptz,
  cancelada_en timestamptz,
  ultimo_evento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on agrosense.suscripciones (organizacion_id);
create index on agrosense.suscripciones (lower(comprador_email));
create trigger suscripciones_updated before update on agrosense.suscripciones
  for each row execute function agrosense.tocar_updated_at();

-- Bitácora de webhooks: el id del evento de Hotmart evita procesar dos veces el mismo aviso.
create table agrosense.hotmart_eventos (
  id text primary key,
  evento text not null,
  payload jsonb not null,
  recibido_en timestamptz not null default now(),
  procesado boolean not null default false,
  error text
);

alter table agrosense.planes enable row level security;
alter table agrosense.suscripciones enable row level security;
alter table agrosense.hotmart_eventos enable row level security;

create policy planes_select on agrosense.planes for select to authenticated using (true);
create policy planes_superadmin on agrosense.planes for all to authenticated
  using (agrosense.es_superadmin()) with check (agrosense.es_superadmin());

create policy suscripciones_select on agrosense.suscripciones for select to authenticated
  using (agrosense.es_superadmin() or exists (
    select 1 from agrosense.fincas f join agrosense.membresias m on m.finca_id = f.id
    where f.organizacion_id = suscripciones.organizacion_id and m.auth_user_id = auth.uid()));
create policy suscripciones_superadmin on agrosense.suscripciones for all to authenticated
  using (agrosense.es_superadmin()) with check (agrosense.es_superadmin());

create policy hotmart_eventos_superadmin on agrosense.hotmart_eventos for select to authenticated
  using (agrosense.es_superadmin());

grant select, insert, update, delete on agrosense.planes, agrosense.suscripciones, agrosense.hotmart_eventos to authenticated, service_role;

-- ¿La finca pertenece a una organización con suscripción al día? (para bloqueo suave en la app)
create or replace function agrosense.suscripcion_activa(p_finca_id uuid)
returns boolean language sql stable security definer set search_path = agrosense, pg_temp as $$
  select agrosense.es_superadmin() or exists (
    select 1 from agrosense.fincas f
    join agrosense.suscripciones s on s.organizacion_id = f.organizacion_id
    where f.id = p_finca_id and s.estado in ('activa','atrasada')
  ) and agrosense.tiene_acceso(p_finca_id);
$$;
revoke execute on function agrosense.suscripcion_activa(uuid) from public, anon;
grant execute on function agrosense.suscripcion_activa(uuid) to authenticated, service_role;
