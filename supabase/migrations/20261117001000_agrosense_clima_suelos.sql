-- Ganado al Día: coordenadas de la finca (clima estimado sin aparatos)
-- y análisis de suelo por potrero.

-- 1) Coordenadas de la finca. Se usan para pedir el clima a Open-Meteo.
alter table agrosense.fincas
  add column if not exists latitud  numeric(9,6) check (latitud  is null or latitud  between -90  and 90),
  add column if not exists longitud numeric(9,6) check (longitud is null or longitud between -180 and 180);

-- 2) Análisis de suelo. Un potrero puede tener varios (uno por fecha).
create table if not exists agrosense.analisis_suelo (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  potrero_id uuid not null references agrosense.potreros(id) on delete cascade,
  fecha date not null default current_date,
  laboratorio text,
  ph numeric(4,2) check (ph is null or ph between 0 and 14),
  materia_organica numeric(6,2) check (materia_organica is null or materia_organica between 0 and 100), -- %
  nitrogeno numeric(6,3) check (nitrogeno is null or nitrogeno >= 0),   -- N total, %
  fosforo   numeric(8,2) check (fosforo   is null or fosforo   >= 0),   -- P disponible, ppm (mg/kg)
  potasio   numeric(6,3) check (potasio   is null or potasio   >= 0),   -- K, cmol(+)/kg
  calcio    numeric(6,2) check (calcio    is null or calcio    >= 0),   -- Ca, cmol(+)/kg
  magnesio  numeric(6,2) check (magnesio  is null or magnesio  >= 0),   -- Mg, cmol(+)/kg
  aluminio  numeric(6,2) check (aluminio  is null or aluminio  >= 0),   -- Al intercambiable, cmol(+)/kg
  textura text check (textura is null or textura in
    ('Arenoso','Franco arenoso','Franco','Franco limoso','Limoso','Franco arcilloso','Arcilloso')),
  notas text,
  pdf_path text,
  creado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists analisis_suelo_potrero_idx on agrosense.analisis_suelo (potrero_id, fecha desc);
create index if not exists analisis_suelo_finca_idx on agrosense.analisis_suelo (finca_id);

-- La finca del análisis siempre es la del potrero (no se puede colar otra finca).
create or replace function agrosense.analisis_suelo_finca()
returns trigger language plpgsql set search_path = agrosense, pg_temp as $$
begin
  select p.finca_id into new.finca_id from agrosense.potreros p where p.id = new.potrero_id;
  if new.finca_id is null then raise exception 'Potrero no existe'; end if;
  return new;
end $$;
drop trigger if exists analisis_suelo_finca on agrosense.analisis_suelo;
create trigger analisis_suelo_finca before insert or update of potrero_id on agrosense.analisis_suelo
  for each row execute function agrosense.analisis_suelo_finca();
drop trigger if exists analisis_suelo_updated on agrosense.analisis_suelo;
create trigger analisis_suelo_updated before update on agrosense.analisis_suelo
  for each row execute function agrosense.tocar_updated_at();

alter table agrosense.analisis_suelo enable row level security;
drop policy if exists analisis_suelo_miembros on agrosense.analisis_suelo;
create policy analisis_suelo_miembros on agrosense.analisis_suelo for all to authenticated
  using (agrosense.tiene_acceso(finca_id)) with check (agrosense.tiene_acceso(finca_id));

grant select, insert, update, delete on agrosense.analisis_suelo to authenticated, service_role;
grant execute on function agrosense.analisis_suelo_finca() to authenticated, service_role;

-- Los PDF del laboratorio van al bucket privado existente 'agrosense-ica',
-- en la ruta <finca_id>/suelos/<archivo>.pdf (mismas políticas por finca).

-- 3) Mapa de la finca: lindero, dibujo de cada potrero y puntos (corral, báscula…).
-- Las figuras se guardan como lista de vértices [[lat, lon], ...].
alter table agrosense.fincas
  add column if not exists lindero jsonb check (lindero is null or jsonb_typeof(lindero) = 'array');
alter table agrosense.potreros
  add column if not exists poligono jsonb check (poligono is null or jsonb_typeof(poligono) = 'array');

create table if not exists agrosense.puntos_finca (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references agrosense.fincas(id) on delete cascade,
  tipo text not null check (tipo in ('corral','bascula','casa','bebedero','otro')),
  nombre text,
  latitud  numeric(9,6) not null check (latitud  between -90  and 90),
  longitud numeric(9,6) not null check (longitud between -180 and 180),
  created_at timestamptz not null default now()
);
create index if not exists puntos_finca_finca_idx on agrosense.puntos_finca (finca_id);
alter table agrosense.puntos_finca enable row level security;
drop policy if exists puntos_finca_miembros on agrosense.puntos_finca;
create policy puntos_finca_miembros on agrosense.puntos_finca for all to authenticated
  using (agrosense.tiene_acceso(finca_id)) with check (agrosense.tiene_acceso(finca_id));
grant select, insert, update, delete on agrosense.puntos_finca to authenticated, service_role;
