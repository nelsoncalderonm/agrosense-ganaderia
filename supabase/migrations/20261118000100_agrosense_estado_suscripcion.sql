-- Estado de la suscripción de la organización dueña de una finca, para que la app
-- muestre un aviso (pago atrasado) o la pantalla de "renueva tu suscripción"
-- (cancelada o reembolsada). Devuelve null si la organización no tiene suscripción
-- (clientes de prueba o fincas sin organización): esas no se bloquean.

create or replace function agrosense.estado_suscripcion_finca(p_finca_id uuid)
returns text language sql stable security definer set search_path = agrosense, pg_temp as $$
  select case when agrosense.es_superadmin() then null else (
    select s.estado from agrosense.fincas f
    join agrosense.suscripciones s on s.organizacion_id = f.organizacion_id
    where f.id = p_finca_id and agrosense.tiene_acceso(p_finca_id)
    order by (s.estado in ('activa','atrasada')) desc, s.updated_at desc
    limit 1) end;
$$;
revoke execute on function agrosense.estado_suscripcion_finca(uuid) from public, anon;
grant execute on function agrosense.estado_suscripcion_finca(uuid) to authenticated, service_role;
