import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { MINUTOS_CODIGO, hashToken, nuevoCodigo, nuevoToken } from '@/lib/tableroServidor';

// POST /api/tv/pantalla — el televisor pide un token y un código para vincularse.
// No necesita sesión: el televisor todavía no sabe de qué finca es.
export async function POST() {
  let sb;
  try { sb = getSupabaseAdmin(); } catch { return Response.json({ error: 'Servidor mal configurado' }, { status: 500 }); }

  // Limpieza: televisores que nunca se vincularon en un día.
  await sb.from('pantallas_tv').delete().is('finca_id', null).lt('created_at', new Date(Date.now() - 864e5).toISOString());

  const token = nuevoToken();
  const expira = new Date(Date.now() + MINUTOS_CODIGO * 60e3).toISOString();
  for (let intento = 0; intento < 5; intento++) {
    const codigo = nuevoCodigo();
    const { error } = await sb.from('pantallas_tv').insert({ token_hash: hashToken(token), codigo, codigo_expira: expira });
    if (!error) return Response.json({ token, codigo, expira }, { headers: { 'Cache-Control': 'no-store' } });
    if (error.code !== '23505') return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ error: 'No se pudo crear el código' }, { status: 500 });
}
