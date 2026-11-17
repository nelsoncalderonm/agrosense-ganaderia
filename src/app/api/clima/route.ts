import { createClient } from '@supabase/supabase-js';
import { obtenerClima } from '@/lib/clima';

// GET /api/clima?finca_id=…  (Authorization: Bearer <token de sesión>)
// Lee las coordenadas con el token del usuario (RLS decide si puede ver la finca)
// y pide el clima a Open-Meteo desde el servidor, con caché de 1 hora.
export async function GET(request: Request) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const fincaId = new URL(request.url).searchParams.get('finca_id');
  if (!fincaId) return Response.json({ error: 'Falta finca_id' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return Response.json({ error: 'Servidor mal configurado' }, { status: 500 });
  const sb = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'agrosense' },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: finca, error } = await sb.from('fincas').select('id, latitud, longitud').eq('id', fincaId).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!finca) return Response.json({ error: 'Finca no encontrada' }, { status: 404 });
  if (finca.latitud == null || finca.longitud == null) return Response.json({ error: 'sin_coordenadas' }, { status: 409 });

  try {
    const clima = await obtenerClima(Number(finca.latitud), Number(finca.longitud), { apiKey: process.env.OPEN_METEO_API_KEY || undefined });
    return Response.json(clima, { headers: { 'Cache-Control': 'private, max-age=600' } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error de clima' }, { status: 502 });
  }
}
