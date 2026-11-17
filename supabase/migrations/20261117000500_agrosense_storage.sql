-- AgroSense: bucket privado para certificados ICA. Ruta: <finca_id>/<archivo>.pdf

-- Lee el finca_id de la ruta sin fallar si la carpeta no es un uuid.
create or replace function agrosense.finca_de_ruta(p_name text)
returns uuid language sql immutable set search_path = agrosense, pg_temp as $$
  select case when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;
grant execute on function agrosense.finca_de_ruta(text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agrosense-ica', 'agrosense-ica', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "agrosense_ica_select" on storage.objects for select to authenticated
  using (bucket_id = 'agrosense-ica' and coalesce(agrosense.tiene_acceso(agrosense.finca_de_ruta(name)), false));
create policy "agrosense_ica_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'agrosense-ica' and coalesce(agrosense.tiene_acceso(agrosense.finca_de_ruta(name)), false));
create policy "agrosense_ica_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'agrosense-ica' and agrosense.rol_en_finca(agrosense.finca_de_ruta(name)) = 'owner');
