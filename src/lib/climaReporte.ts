import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Línea de clima para el reporte de Telegram: lluvia del periodo y pronóstico.
// Usa las coordenadas de la finca (fincas.latitud/longitud). Si la finca no tiene
// coordenadas, o Open-Meteo no responde, el reporte sale igual sin esta línea.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lineasClima(admin: SupabaseClient<any, any, any>, fincaId: string, desde: string, hasta: string): Promise<string[]> {
  try {
    const { data: f } = await admin.from('fincas').select('*').eq('id', fincaId).maybeSingle();
    const lat = f?.latitud, lon = f?.longitud;
    if (lat == null || lon == null) return [];
    const key = process.env.OPEN_METEO_API_KEY;
    const q = new URLSearchParams({
      latitude: String(lat), longitude: String(lon), timezone: 'auto',
      past_days: '14', forecast_days: '7', daily: 'precipitation_sum',
    });
    if (key) q.set('apikey', key);
    const host = key ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
    const res = await fetch(`${host}/v1/forecast?${q}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const j = await res.json() as { daily: { time: string[]; precipitation_sum: (number | null)[] } };
    const hoy = j.daily.time[14];
    let periodo = 0, proximos = 0;
    j.daily.time.forEach((t, i) => {
      const mm = j.daily.precipitation_sum[i] ?? 0;
      if (t >= desde && t <= hasta) periodo += mm;
      if (hoy && t >= hoy) proximos += mm;
    });
    const r = (v: number) => Math.round(v).toLocaleString('es-CO');
    return ['', '<b>🌦️ Lluvia (estimada)</b>', `• En el periodo: <b>${r(periodo)} mm</b>`, `• Próximos 7 días: ${r(proximos)} mm`];
  } catch {
    return [];
  }
}
