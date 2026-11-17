import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cronAutorizado } from '@/lib/cronAuth';
import { enviarMensaje, hoyBogota, telegramConfigurado } from '@/lib/telegram';

// Diario 8 a.m. Colombia: si la finca no tiene sensor y nadie anotó la lluvia de hoy,
// se le recuerda a vaqueros y administradores conectados.
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return new Response('unauthorized', { status: 401 });
  if (!telegramConfigurado()) return Response.json({ skipped: 'sin TELEGRAM_BOT_TOKEN' });

  const admin = getSupabaseAdmin();
  const hoy = hoyBogota();

  const { data: vincs } = await admin.from('telegram_vinculos')
    .select('id, finca_id, chat_id, membresias(rol)').eq('activo', true);
  const candidatos = ((vincs ?? []) as unknown as { id: string; finca_id: string; chat_id: number; membresias: { rol: string } | null }[])
    .filter(v => v.membresias?.rol === 'vaquero' || v.membresias?.rol === 'admin');
  if (!candidatos.length) return Response.json({ enviados: 0 });

  const fincas = [...new Set(candidatos.map(v => v.finca_id))];
  const [{ data: sensores }, { data: registros }] = await Promise.all([
    admin.from('sensores_lluvia').select('finca_id').in('finca_id', fincas).eq('activo', true),
    admin.from('lluvia_registros').select('finca_id').in('finca_id', fincas).eq('fecha', hoy),
  ]);
  const omitir = new Set([...(sensores ?? []), ...(registros ?? [])].map(r => r.finca_id));

  let enviados = 0;
  for (const v of candidatos) {
    if (omitir.has(v.finca_id)) continue;
    const r = await enviarMensaje(v.chat_id, '🌧 Buenos días. ¿Cuánto marcó el pluviómetro? Responda por ejemplo <code>/lluvia 12</code>, o <code>/lluvia 0</code> si no llovió. Después de anotarlo, vacíe el pluviómetro.');
    if (r.ok) enviados++;
  }
  return Response.json({ enviados });
}
