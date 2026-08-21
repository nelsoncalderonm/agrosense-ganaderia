import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const VALID_ROLES = ['owner', 'admin', 'contable', 'vaquero'] as const;
type Rol = (typeof VALID_ROLES)[number];

export async function POST(request: Request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return Response.json({ error: 'Servidor mal configurado: falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
  if (callerErr || !callerData.user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const { data: superadminRow } = await supabaseAdmin
    .from('Agrosense_superadmins')
    .select('auth_user_id')
    .eq('auth_user_id', callerData.user.id)
    .maybeSingle();
  if (!superadminRow) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => null) as
    | { email?: string; password?: string; nombre?: string; rol?: string; finca_id?: string }
    | null;
  if (!body) return Response.json({ error: 'Body inválido' }, { status: 400 });

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const nombre = body.nombre?.trim();
  const rol = body.rol as Rol | undefined;
  const finca_id = body.finca_id;

  if (!email || !password || !nombre || !finca_id) {
    return Response.json({ error: 'Faltan campos: email, password, nombre, finca_id' }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }
  if (!rol || !VALID_ROLES.includes(rol)) {
    return Response.json({ error: `rol debe ser uno de: ${VALID_ROLES.join(', ')}` }, { status: 400 });
  }

  const { data: fincaRow } = await supabaseAdmin.from('Agrosense_fincas').select('id').eq('id', finca_id).maybeSingle();
  if (!fincaRow) return Response.json({ error: 'Finca no encontrada' }, { status: 404 });

  let userId: string;
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { nombre },
  });

  if (created?.user) {
    userId = created.user.id;
  } else if (createErr && /already been registered|already exists/i.test(createErr.message)) {
    let existing: { id: string } | undefined;
    let page = 1;
    while (!existing) {
      const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr || !listed.users.length) break;
      existing = listed.users.find(u => u.email?.toLowerCase() === email);
      if (existing || listed.users.length < 200) break;
      page += 1;
    }
    if (!existing) return Response.json({ error: 'El correo ya está registrado pero no se pudo ubicar la cuenta' }, { status: 409 });
    userId = existing.id;
  } else {
    return Response.json({ error: createErr?.message ?? 'No se pudo crear el usuario' }, { status: 500 });
  }

  const { error: membresiaErr } = await supabaseAdmin
    .from('Agrosense_membresias')
    .upsert({ auth_user_id: userId, finca_id, nombre, rol }, { onConflict: 'auth_user_id,finca_id' });

  if (membresiaErr) return Response.json({ error: membresiaErr.message }, { status: 500 });

  return Response.json({ id: userId, email, nombre, rol, finca_id });
}
