import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  FilaPantalla, MINUTOS_CODIGO, calcularTablero, configDe, hashToken, nuevoCodigo, tokenDeRequest,
} from '@/lib/tableroServidor';

// GET /api/tv/datos?tz=America/Bogota  (header x-tv-token)
// Si el televisor todavía no está vinculado devuelve su código; si ya lo está, los datos del tablero.
// Solo lectura: el token del televisor no sirve para nada más.
export async function GET(request: Request) {
  const token = tokenDeRequest(request);
  if (!token) return Response.json({ error: 'sin_token' }, { status: 401 });
  let sb;
  try { sb = getSupabaseAdmin(); } catch { return Response.json({ error: 'Servidor mal configurado' }, { status: 500 }); }

  const { data, error } = await sb.from('pantallas_tv')
    .select('id, finca_id, nombre, codigo, codigo_expira, paneles, segundos_panel, tema')
    .eq('token_hash', hashToken(token)).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'desconectado' }, { status: 401 }); // lo borraron desde el celular
  const p = data as FilaPantalla;
  const sinCache = { 'Cache-Control': 'no-store' };

  if (!p.finca_id) {
    // El código vence a los 15 minutos; se cambia por uno nuevo sin que nadie toque el televisor.
    if (!p.codigo || !p.codigo_expira || Date.parse(p.codigo_expira) < Date.now() + 60e3) {
      const expira = new Date(Date.now() + MINUTOS_CODIGO * 60e3).toISOString();
      for (let i = 0; i < 5; i++) {
        const codigo = nuevoCodigo();
        const { error: e } = await sb.from('pantallas_tv').update({ codigo, codigo_expira: expira }).eq('id', p.id);
        if (!e) { p.codigo = codigo; p.codigo_expira = expira; break; }
      }
    }
    return Response.json({ estado: 'pendiente', codigo: p.codigo, expira: p.codigo_expira }, { headers: sinCache });
  }

  await sb.from('pantallas_tv').update({ ultima_conexion: new Date().toISOString() }).eq('id', p.id);
  try {
    const datos = await calcularTablero(sb, p.finca_id, new URL(request.url).searchParams.get('tz'));
    return Response.json({ estado: 'ok', config: configDe(p), datos }, { headers: sinCache });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
