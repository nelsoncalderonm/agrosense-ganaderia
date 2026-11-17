import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizarCodigo } from '@/lib/tablero';
import { puedeAdministrarTv } from '@/lib/tableroServidor';

// POST /api/tv/vincular  { codigo, finca_id, nombre }  (Authorization: Bearer <sesión del dueño>)
// El dueño escribe en el celular el código que sale en el televisor.
export async function POST(request: Request) {
  let sb;
  try { sb = getSupabaseAdmin(); } catch { return Response.json({ error: 'Servidor mal configurado' }, { status: 500 }); }
  const body = await request.json().catch(() => null) as { codigo?: string; finca_id?: string; nombre?: string } | null;
  const codigo = normalizarCodigo(body?.codigo ?? '');
  if (!body?.finca_id || codigo.length !== 6) return Response.json({ error: 'Escriba las 6 letras que salen en el televisor' }, { status: 400 });

  const quien = await puedeAdministrarTv(sb, request.headers.get('authorization'), body.finca_id);
  if ('error' in quien) return Response.json({ error: quien.error }, { status: quien.status });

  const { data, error } = await sb.from('pantallas_tv')
    .update({
      finca_id: body.finca_id, nombre: (body.nombre ?? '').trim().slice(0, 40) || 'Televisor',
      codigo: null, codigo_expira: null, vinculada_por: quien.userId, vinculada_en: new Date().toISOString(),
    })
    .eq('codigo', codigo).is('finca_id', null).gt('codigo_expira', new Date().toISOString())
    .select('id').maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'Ese código no existe o ya venció. Mire el código que sale ahora en el televisor.' }, { status: 404 });
  return Response.json({ id: data.id });
}
