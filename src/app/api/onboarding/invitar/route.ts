import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { appUrl, esSuperadmin, invitarOEncontrarUsuario, usuarioDelRequest } from '@/lib/server/clientes';

// El dueño de una finca invita por correo a su equipo (admin, contable o vaquero).
const ROLES = ['admin', 'contable', 'vaquero'] as const;
type Rol = (typeof ROLES)[number];

export async function POST(request: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return Response.json({ error: 'Servidor mal configurado' }, { status: 500 }); }

  const callerId = await usuarioDelRequest(admin, request);
  if (!callerId) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => null) as { email?: string; nombre?: string; rol?: string; finca_id?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const nombre = body?.nombre?.trim();
  const rol = body?.rol as Rol | undefined;
  const finca_id = body?.finca_id;
  if (!email || !nombre || !finca_id || !/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ error: 'Faltan datos: nombre, correo válido y finca' }, { status: 400 });
  }
  if (!rol || !ROLES.includes(rol)) return Response.json({ error: 'Rol inválido' }, { status: 400 });

  const { data: m } = await admin.from('membresias').select('rol')
    .eq('finca_id', finca_id).eq('auth_user_id', callerId).maybeSingle();
  if (m?.rol !== 'owner' && !(await esSuperadmin(admin, callerId))) {
    return Response.json({ error: 'Solo el dueño de la finca puede invitar' }, { status: 403 });
  }

  try {
    const { userId, invitado } = await invitarOEncontrarUsuario(admin, email, nombre, `${appUrl(request)}/`);
    if (userId === callerId) return Response.json({ error: 'Ya eres miembro de esta finca' }, { status: 400 });
    const { data: actual } = await admin.from('membresias').select('rol')
      .eq('finca_id', finca_id).eq('auth_user_id', userId).maybeSingle();
    if (actual?.rol === 'owner') return Response.json({ error: 'Esa persona ya es dueña de la finca' }, { status: 400 });
    const { error } = await admin.from('membresias')
      .upsert({ auth_user_id: userId, finca_id, nombre, rol }, { onConflict: 'auth_user_id,finca_id' });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ id: userId, email, nombre, rol, invitado });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo invitar' }, { status: 500 });
  }
}
