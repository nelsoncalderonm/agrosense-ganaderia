import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { hashToken, nuevoToken, puedeAdministrarTv } from '@/lib/tableroServidor';

// POST /api/tv/enlace  { finca_id, nombre }  (Authorization: Bearer <sesión del dueño>)
// Crea un enlace de solo lectura para abrir el tablero sin código (Chromecast, Fire TV, otro computador).
export async function POST(request: Request) {
  let sb;
  try { sb = getSupabaseAdmin(); } catch { return Response.json({ error: 'Servidor mal configurado' }, { status: 500 }); }
  const body = await request.json().catch(() => null) as { finca_id?: string; nombre?: string } | null;
  if (!body?.finca_id) return Response.json({ error: 'Falta la finca' }, { status: 400 });

  const quien = await puedeAdministrarTv(sb, request.headers.get('authorization'), body.finca_id);
  if ('error' in quien) return Response.json({ error: quien.error }, { status: quien.status });

  const token = nuevoToken();
  const { data, error } = await sb.from('pantallas_tv').insert({
    finca_id: body.finca_id, nombre: (body.nombre ?? '').trim().slice(0, 40) || 'Enlace de solo lectura',
    token_hash: hashToken(token), vinculada_por: quien.userId, vinculada_en: new Date().toISOString(),
  }).select('id').single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: data.id, token });
}
