import { randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { asegurarWebhook, botUsername, telegramConfigurado } from '@/lib/telegram';

// POST { finca_id } con el token de sesión → link de un solo uso para vincular Telegram.
export async function POST(request: Request) {
  if (!telegramConfigurado()) {
    return Response.json({ error: 'El bot de Telegram aún no está configurado (falta TELEGRAM_BOT_TOKEN).' }, { status: 503 });
  }
  let admin;
  try { admin = getSupabaseAdmin(); } catch {
    return Response.json({ error: 'Servidor mal configurado: falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u.user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => null) as { finca_id?: string; membresia_id?: string } | null;
  if (!body?.finca_id) return Response.json({ error: 'Falta finca_id' }, { status: 400 });

  const { data: propia } = await admin.from('membresias').select('id, rol')
    .eq('auth_user_id', u.user.id).eq('finca_id', body.finca_id).maybeSingle();
  const { data: sa } = await admin.from('superadmins').select('auth_user_id').eq('auth_user_id', u.user.id).maybeSingle();

  // Enlace para otra persona (el propietario o un superadmin se lo envía por WhatsApp).
  const paraOtro = !!body.membresia_id && body.membresia_id !== propia?.id;
  let m: { id: string } | null = propia;
  if (paraOtro) {
    if (propia?.rol !== 'owner' && !sa) return Response.json({ error: 'Solo el propietario puede generar enlaces para otros' }, { status: 403 });
    const { data: otra } = await admin.from('membresias').select('id')
      .eq('id', body.membresia_id).eq('finca_id', body.finca_id).maybeSingle();
    if (!otra) return Response.json({ error: 'Miembro no encontrado en esta finca' }, { status: 404 });
    m = otra;
  }
  if (!m) return Response.json({ error: 'No pertenece a esta finca' }, { status: 403 });

  const username = await botUsername();
  if (!username) return Response.json({ error: 'No se pudo contactar el bot de Telegram. Revise el token.' }, { status: 502 });
  await asegurarWebhook().catch(() => {});

  const codigo = randomBytes(12).toString('base64url');
  const { error } = await admin.from('telegram_codigos').insert({
    codigo, membresia_id: m.id, // Propio: 30 min. Para enviar a otra persona: 7 días.
    expira_at: new Date(Date.now() + (paraOtro ? 7 * 24 * 60 : 30) * 60 * 1000).toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ url: `https://t.me/${username}?start=${codigo}`, bot: username });
}
