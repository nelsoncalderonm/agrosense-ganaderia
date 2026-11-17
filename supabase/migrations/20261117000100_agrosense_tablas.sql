-- AgroSense: esquema propio "agrosense" (reemplaza las tablas public."Agrosense_*").
-- Mismos nombres de columnas que usa la app, sin prefijo en las tablas,
-- con llaves foráneas, restricciones e índices.

create schema if not exists agrosense;

grant usage on schema agrosense to anon, authenticated, service_role;
alter default privileges in schema agrosense grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema agrosense grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema agrosense grant execute on functions to authenticated, service_role;

-- ---------- Tenencia: organizaciones (cliente que paga), fincas, membresías ----------

create table agrosense.organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text,
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table agrosense.fincas (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid references agrosense.organizaciones(id) on delete restrict,
  nombre text not null,
  ubicacion text,
  hectareas numeric check (hectareas is null or hectareas >= 0),
  valor_cop bigint not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on agrosense.fincas (organizacion_id);

create table agrosense.superadmins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table agrosense.membresias (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('owner','admin','contable','vaquero')),
  created_at timestamptz not null default now(),
  unique (auth_user_id, finca_id)
);
create index on agrosense.membresias (finca_id);

-- ---------- Operación de la finca ----------

create table agrosense.potreros (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  nombre text not null,
  capacidad integer not null default 0,
  hectareas numeric,
  aforo numeric,
  estado text not null default 'Descanso',
  dias_estado integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on agrosense.potreros (finca_id);

create table agrosense.animales (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  potrero_id uuid references agrosense.potreros(id) on delete set null,
  nombre text,
  arete text not null,
  rfid text,
  raza text,
  sexo text,
  categoria text check (categoria is null or categoria in ('Cría','Levante','Ceba')),
  estado text not null default 'green' check (estado in ('green','amber','red','blue')),
  estado_txt text,
  peso_actual numeric check (peso_actual is null or peso_actual > 0),
  gdp numeric,
  gdp_delta numeric,
  fecha_ingreso date,
  fecha_ultimo_pesaje timestamptz,
  dias_potrero integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on agrosense.animales (finca_id) where activo;
create index on agrosense.animales (potrero_id);
-- Un arete (y un código RFID) no puede repetirse entre animales activos de la misma finca.
create unique index animales_arete_activo_uq on agrosense.animales (finca_id, upper(arete)) where activo;
create unique index animales_rfid_activo_uq on agrosense.animales (finca_id, upper(rfid)) where activo and rfid is not null;

create table agrosense.sesiones_pesaje (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  inicio timestamptz not null default now(),
  fin timestamptz,
  animales_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index on agrosense.sesiones_pesaje (finca_id);

create table agrosense.pesajes (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references agrosense.animales(id) on delete cascade,
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  sesion_id uuid references agrosense.sesiones_pesaje(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  peso_kg numeric not null check (peso_kg > 0),
  gdp_calculado numeric,
  dias_periodo integer,
  pendiente_sync boolean not null default false,
  fecha timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on agrosense.pesajes (animal_id, fecha desc);
create index on agrosense.pesajes (finca_id, fecha desc);

create table agrosense.animal_eventos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references agrosense.animales(id) on delete cascade,
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  tipo text not null check (tipo in ('nacimiento','compra','traslado','venta','baja')),
  fecha date not null default current_date,
  peso_kg numeric,
  precio_kg numeric,
  total_cop bigint,
  finca_origen_id uuid references agrosense.fincas(id) on delete set null,
  contraparte text,
  notas text,
  created_at timestamptz not null default now()
);
create index on agrosense.animal_eventos (animal_id, fecha);
create index on agrosense.animal_eventos (finca_id);

create table agrosense.nacimientos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  animal_id uuid references agrosense.animales(id) on delete set null,
  potrero_id uuid references agrosense.potreros(id) on delete set null,
  fecha date not null,
  sexo text not null,
  created_at timestamptz not null default now()
);
create index on agrosense.nacimientos (finca_id, fecha desc);

create table agrosense.bajas (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  animal_id uuid references agrosense.animales(id) on delete set null,
  fecha date not null,
  causa text not null,
  created_at timestamptz not null default now()
);
create index on agrosense.bajas (finca_id, fecha desc);

create table agrosense.alertas (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  animal_id uuid references agrosense.animales(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  descripcion text,
  severidad text not null default 'amber',
  meta text,
  resuelta boolean not null default false,
  fecha_vence date,
  created_at timestamptz not null default now()
);
create index on agrosense.alertas (finca_id) where not resuelta;

create table agrosense.eventos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  descripcion text,
  fecha date not null,
  animales_count integer,
  potrero_ref text,
  completado boolean not null default false,
  created_at timestamptz not null default now()
);
create index on agrosense.eventos (finca_id, fecha);

create table agrosense.vacunaciones (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  ciclo smallint not null check (ciclo in (1,2)),
  anio integer not null,
  fecha date not null,
  titulo text not null,
  notas text,
  animales_count integer,
  pdf_path text,
  created_at timestamptz not null default now()
);
create index on agrosense.vacunaciones (finca_id, fecha desc);

-- ---------- Finanzas ----------

create table agrosense.proveedores (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  nombre text not null,
  nit text, ciudad text, tipo text, telefono text, email text,
  via_email boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index on agrosense.proveedores (finca_id);

create table agrosense.clientes (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  nombre text not null,
  nit text, ciudad text, tipo text, telefono text, email text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index on agrosense.clientes (finca_id);

create table agrosense.gastos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  proveedor_id uuid references agrosense.proveedores(id) on delete set null,
  concepto text not null,
  items_desc text,
  monto bigint not null check (monto >= 0),
  fecha date not null,
  via text not null default 'Manual',
  nit_proveedor text,
  pendiente_sync boolean not null default false,
  created_at timestamptz not null default now()
);
create index on agrosense.gastos (finca_id, fecha desc);

create table agrosense.movimientos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  tipo text not null check (tipo in ('venta','compra')),
  fecha date not null,
  contraparte text,
  animales_count integer not null default 1,
  categoria text, raza text,
  peso_prom_kg numeric, precio_kg numeric,
  total_cop bigint, costo_cop bigint, utilidad_cop bigint,
  transporte_cop bigint not null default 0,
  gdp_estimado numeric,
  notas text,
  created_at timestamptz not null default now()
);
create index on agrosense.movimientos (finca_id, fecha desc);

create table agrosense.ingresos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  cliente_id uuid references agrosense.clientes(id) on delete set null,
  movimiento_id uuid references agrosense.movimientos(id) on delete set null,
  concepto text not null,
  monto bigint not null,
  fecha date not null,
  created_at timestamptz not null default now()
);
create index on agrosense.ingresos (finca_id, fecha desc);

-- Permisos de tabla (RLS decide qué filas).
grant select, insert, update, delete on all tables in schema agrosense to authenticated, service_role;
