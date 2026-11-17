import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { appUrl, crearOrganizacionCliente, esSuperadmin, invitarOEncontrarUsuario, usuarioDelRequest } from '@/lib/server/clientes';

// Alta de un cliente vendido por fuera de Hotmart: crea la organización, invita al
// dueño por correo y (opcional) registra la suscripción manual con su plan.
export async function POST(request: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return Response.json({ error: 'Servidor mal configurado' }, { status: 500 }); }

  const callerId = await usuarioDelRequest(admin, request);
  if (!callerId) return Response.json({ error: 'No autenticado' }, { status: 401 });
  if (!(await esSuperadmin(admin, callerId))) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    organizacion?: string; nombre?: string; email?: string; telefono?: string; nit?: string; plan_id?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase();
  const nombre = body?.nombre?.trim();
  const organizacion = body?.organizacion?.trim();
  if (!email || !nombre || !organizacion || !/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ error: 'Faltan datos: organización, nombre del dueño y correo válido' }, { status: 400 });
  }

  try {
    const { userId, invitado } = await invitarOEncontrarUsuario(admin, email, nombre, `${appUrl(request)}/`);
    const orgId = await crearOrganizacionCliente(admin, {
      nombre: organizacion, email, contactoNombre: nombre,
      telefono: body?.telefono?.trim() || null, nit: body?.nit?.trim() || null, origen: 'manual',
    }, userId);
    if (body?.plan_id) {
      const { error } = await admin.from('suscripciones').insert({
        organizacion_id: orgId, plan_id: body.plan_id, comprador_email: email, comprador_nombre: nombre,
        estado: 'activa', fecha_inicio: new Date().toISOString(), ultimo_evento: 'ALTA_MANUAL',
      });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ organizacion_id: orgId, usuario_id: userId, invitado });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo crear el cliente' }, { status: 500 });
  }
}
