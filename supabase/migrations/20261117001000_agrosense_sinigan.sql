-- AgroSense: preparación para Sinigán (fase 1, "datos espejo").
-- Sinigán V6 (ICA) no tiene API pública todavía. Guardamos los mismos datos que pide
-- Sinigán para que el ganadero arme sus guías rápido y, cuando haya conexión directa,
-- todo esté listo. Solo agrega columnas y tablas nuevas: no cambia datos existentes.

-- Predio: datos con los que se asocia en Sinigán.
alter table agrosense.fincas
  add column if not exists ruv text,
  add column if not exists departamento text,
  add column if not exists municipio text,
  add column if not exists responsable_tipo_doc text,
  add column if not exists responsable_documento text;

alter table agrosense.fincas drop constraint if exists fincas_responsable_tipo_doc_check;
alter table agrosense.fincas add constraint fincas_responsable_tipo_doc_check
  check (responsable_tipo_doc is null or responsable_tipo_doc in ('CC','CE','NIT','PPT','PAS'));

-- Animal: identificación oficial (DIN) separada de la chapeta de manejo (rfid / arete).
alter table agrosense.animales
  add column if not exists din text,
  add column if not exists especie text not null default 'bovino',
  add column if not exists fecha_nacimiento date;

alter table agrosense.animales drop constraint if exists animales_especie_check;
alter table agrosense.animales add constraint animales_especie_check
  check (especie in ('bovino','bufalino'));

-- Un DIN no puede estar en dos animales activos a la vez.
create unique index if not exists animales_din_activo_uq
  on agrosense.animales (din) where din is not null and activo;
create index if not exists animales_rfid_idx on agrosense.animales (finca_id, rfid);

-- Listas para guía de movilización (GSMI). Hoy la guía se emite en Sinigán;
-- aquí se arma la lista leyendo chapetas y luego se anota el número de guía.
create table if not exists agrosense.guias_movilizacion (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id),
  estado text not null default 'borrador' check (estado in ('borrador','emitida','cerrada','anulada')),
  motivo text not null default 'venta' check (motivo in ('venta','traslado','feria','sacrificio','otro')),
  fecha date not null default current_date,
  numero_guia text,
  numero_bono text,
  ruv_destino text,
  destino_nombre text,
  transportador text,
  placa text,
  notas text,
  creado_por uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guias_finca_idx on agrosense.guias_movilizacion (finca_id, created_at desc);

create table if not exists agrosense.guia_animales (
  id uuid primary key default gen_random_uuid(),
  guia_id uuid not null references agrosense.guias_movilizacion(id) on delete cascade,
  finca_id uuid not null references agrosense.fincas(id),
  animal_id uuid references agrosense.animales(id),
  din text,
  chapeta_leida text not null,
  created_at timestamptz not null default now(),
  unique (guia_id, chapeta_leida)
);
create index if not exists guia_animales_guia_idx on agrosense.guia_animales (guia_id);

drop trigger if exists guias_movilizacion_updated on agrosense.guias_movilizacion;
create trigger guias_movilizacion_updated before update on agrosense.guias_movilizacion
  for each row execute function agrosense.tocar_updated_at();

-- RLS: cualquier miembro de la finca, igual que los demás datos operativos.
alter table agrosense.guias_movilizacion enable row level security;
alter table agrosense.guia_animales enable row level security;

drop policy if exists guias_movilizacion_miembros on agrosense.guias_movilizacion;
drop policy if exists guia_animales_miembros on agrosense.guia_animales;
create policy guias_movilizacion_miembros on agrosense.guias_movilizacion for all to authenticated
  using (agrosense.tiene_acceso(finca_id)) with check (agrosense.tiene_acceso(finca_id));
create policy guia_animales_miembros on agrosense.guia_animales for all to authenticated
  using (agrosense.tiene_acceso(finca_id)) with check (agrosense.tiene_acceso(finca_id));

grant select, insert, update, delete on agrosense.guias_movilizacion, agrosense.guia_animales to authenticated;
grant all on agrosense.guias_movilizacion, agrosense.guia_animales to service_role;

-- Datos del predio para Sinigán: owner o admin (la regla de fincas solo deja editar al owner).
create or replace function agrosense.actualizar_predio_sinigan(
  p_finca_id uuid, p_ruv text, p_departamento text, p_municipio text,
  p_tipo_doc text, p_documento text
) returns void
language plpgsql security definer set search_path = agrosense, pg_temp as $$
begin
  if coalesce(agrosense.rol_en_finca(p_finca_id), '') not in ('owner','admin') then
    raise exception 'Solo el propietario o el administrador pueden cambiar los datos del predio';
  end if;
  update agrosense.fincas set
    ruv = nullif(trim(p_ruv), ''),
    departamento = nullif(trim(p_departamento), ''),
    municipio = nullif(trim(p_municipio), ''),
    responsable_tipo_doc = nullif(trim(p_tipo_doc), ''),
    responsable_documento = nullif(trim(p_documento), '')
  where id = p_finca_id;
end $$;

revoke execute on function agrosense.actualizar_predio_sinigan(uuid, text, text, text, text, text) from public, anon;
grant execute on function agrosense.actualizar_predio_sinigan(uuid, text, text, text, text, text) to authenticated, service_role;
