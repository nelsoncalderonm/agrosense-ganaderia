import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;

export function appUrl(request?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (request) return new URL(request.url).origin;
  return 'http://localhost:3000';
}

async function buscarUsuarioPorEmail(admin: Admin, email: string): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) return null;
    const u = data.users.find(x => x.email?.toLowerCase() === email);
    if (u) return u.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

/**
 * Invita por correo a un usuario nuevo (Supabase le envía el enlace para entrar
 * y crear su contraseña). Si el correo ya tiene cuenta, devuelve esa cuenta sin
 * enviar nada: la persona entra con su contraseña de siempre.
 */
export async function invitarOEncontrarUsuario(
  admin: Admin, emailRaw: string, nombre: string, redirectTo: string,
): Promise<{ userId: string; invitado: boolean }> {
  const email = emailRaw.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre },
    redirectTo,
  });
  if (data?.user) return { userId: data.user.id, invitado: true };
  if (error && /already been registered|already exists|already registered/i.test(error.message)) {
    const id = await buscarUsuarioPorEmail(admin, email);
    if (id) return { userId: id, invitado: false };
  }
  throw new Error(error?.message ?? 'No se pudo invitar al usuario');
}

/** Crea la organización del cliente y deja al usuario como dueño. */
export async function crearOrganizacionCliente(
  admin: Admin,
  datos: { nombre: string; email: string; contactoNombre: string; telefono?: string | null; nit?: string | null; origen: 'manual' | 'hotmart' },
  userId: string,
): Promise<string> {
  const { data: org, error } = await admin.from('organizaciones').insert({
    nombre: datos.nombre,
    nit: datos.nit ?? null,
    contacto_nombre: datos.contactoNombre,
    contacto_email: datos.email.trim().toLowerCase(),
    contacto_telefono: datos.telefono ?? null,
    origen: datos.origen,
  }).select('id').single();
  if (error || !org) throw new Error(error?.message ?? 'No se pudo crear la organización');

  const { error: mErr } = await admin.from('organizacion_miembros')
    .upsert({ organizacion_id: org.id, auth_user_id: userId, rol: 'owner' }, { onConflict: 'organizacion_id,auth_user_id' });
  if (mErr) throw new Error(mErr.message);
  return org.id as string;
}

/** Valida el token del usuario que llama; devuelve su id o null. */
export async function usuarioDelRequest(admin: Admin, request: Request): Promise<string | null> {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function esSuperadmin(admin: Admin, userId: string): Promise<boolean> {
  const { data } = await admin.from('superadmins').select('auth_user_id').eq('auth_user_id', userId).maybeSingle();
  return !!data;
}
