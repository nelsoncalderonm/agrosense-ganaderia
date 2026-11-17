-- AgroSense: soporte al cliente con IA (clientes y leads).
-- Las escribe solo el servidor (service_role) desde /api/soporte/chat.
-- Los superadmins las leen desde la app para hacer seguimiento.

create table agrosense.soporte_conversaciones (
  id uuid primary key default gen_random_uuid(),
  origen text not null default 'web' check (origen in ('app', 'landing', 'web', 'whatsapp', 'telegram')),
  auth_user_id uuid references auth.users(id) on delete set null,
  visitante_id text,
  escalada boolean not null default false,
  motivo_escalada text,
  mensajes_count integer not null default 0,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table agrosense.soporte_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references agrosense.soporte_conversaciones(id) on delete cascade,
  rol text not null check (rol in ('user', 'assistant')),
  contenido text not null,
  created_at timestamptz not null default now()
);
create index soporte_mensajes_conv_idx on agrosense.soporte_mensajes (conversacion_id, created_at);

create table agrosense.soporte_leads (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid references agrosense.soporte_conversaciones(id) on delete set null,
  nombre text,
  whatsapp text,
  email text,
  pais text,
  animales integer,
  plan_interes text,
  interes_kit_rfid boolean,
  notas text,
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'prueba', 'cliente', 'descartado')),
  created_at timestamptz not null default now()
);
create index soporte_leads_estado_idx on agrosense.soporte_leads (estado, created_at desc);

alter table agrosense.soporte_conversaciones enable row level security;
alter table agrosense.soporte_mensajes enable row level security;
alter table agrosense.soporte_leads enable row level security;

create policy soporte_conversaciones_superadmin on agrosense.soporte_conversaciones for select to authenticated
  using (agrosense.es_superadmin());
create policy soporte_mensajes_superadmin on agrosense.soporte_mensajes for select to authenticated
  using (agrosense.es_superadmin());
create policy soporte_leads_superadmin on agrosense.soporte_leads for all to authenticated
  using (agrosense.es_superadmin()) with check (agrosense.es_superadmin());

grant select on agrosense.soporte_conversaciones, agrosense.soporte_mensajes to authenticated;
grant select, insert, update, delete on agrosense.soporte_leads to authenticated;
grant select, insert, update, delete on agrosense.soporte_conversaciones, agrosense.soporte_mensajes, agrosense.soporte_leads to service_role;
