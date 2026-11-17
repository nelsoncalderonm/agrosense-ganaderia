// Clima estimado de la finca a partir de sus coordenadas, sin aparatos.
// Fuente: Open-Meteo (modelos meteorológicos + reanálisis ERA5 por satélite).
// Son estimaciones para la zona (celdas de ~10 km), no la medida de un pluviómetro.
//
// Uso comercial: el API libre de Open-Meteo es solo para uso no comercial.
// Con OPEN_METEO_API_KEY se usan los servidores de pago (customer-*.open-meteo.com).

export type DiaClima = {
  fecha: string;              // YYYY-MM-DD (hora local de la finca)
  lluvia_mm: number | null;
  temp_max: number | null;
  temp_min: number | null;
  prob_lluvia: number | null; // % (solo pronóstico)
};

export type ResumenClima = {
  lat: number; lon: number;
  zona_horaria: string;
  actualizado: string;        // ISO, cuándo se descargó
  ahora: { temp: number | null; humedad: number | null };
  hoy: DiaClima | null;
  pronostico: DiaClima[];     // hoy + próximos 6 días
  historial: DiaClima[];      // últimos 30 días (sin hoy)
  lluvia: {
    proximos_7: number;
    ultimos_7: number;
    ultimos_30: number;
    semanas: { desde: string; hasta: string; mm: number }[]; // últimas 4 semanas, la más reciente al final
    mes_actual: number;       // del día 1 hasta ayer
    mes_nombre: string;
    normal_mes: number | null;     // promedio histórico del mes completo
    normal_30: number | null;      // promedio histórico de los mismos 30 días del año
    anios_normal: number;          // cuántos años se usaron para el promedio
  };
  temp: { max_prom_30: number | null; min_prom_30: number | null };
};

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const r1 = (v: number) => Math.round(v * 10) / 10;
const suma = (xs: (number | null)[]) => r1(xs.reduce<number>((a, b) => a + (b ?? 0), 0));
const prom = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

function hosts(apiKey?: string) {
  return apiKey
    ? { pron: 'https://customer-api.open-meteo.com', arch: 'https://customer-archive-api.open-meteo.com' }
    : { pron: 'https://api.open-meteo.com', arch: 'https://archive-api.open-meteo.com' };
}

type FetchOpts = RequestInit & { next?: { revalidate?: number } };
type Fetcher = (url: string, init?: FetchOpts) => Promise<Response>;

/** Pronóstico + últimos 31 días. */
async function pedirPronostico(lat: number, lon: number, apiKey: string | undefined, f: Fetcher) {
  const q = new URLSearchParams({
    latitude: String(lat), longitude: String(lon), timezone: 'auto',
    past_days: '31', forecast_days: '7',
    daily: 'precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    current: 'temperature_2m,relative_humidity_2m',
  });
  if (apiKey) q.set('apikey', apiKey);
  const res = await f(`${hosts(apiKey).pron}/v1/forecast?${q}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Open-Meteo pronóstico: ${res.status}`);
  return res.json() as Promise<{
    timezone: string;
    current?: { temperature_2m?: number; relative_humidity_2m?: number };
    daily: { time: string[]; precipitation_sum: (number | null)[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[]; precipitation_probability_max?: (number | null)[] };
  }>;
}

/** Lluvia diaria de los últimos 10 años completos, para sacar el "normal". */
async function pedirHistorico(lat: number, lon: number, anioFin: number, apiKey: string | undefined, f: Fetcher) {
  const q = new URLSearchParams({
    latitude: String(lat), longitude: String(lon), timezone: 'auto',
    start_date: `${anioFin - 9}-01-01`, end_date: `${anioFin}-12-31`,
    daily: 'precipitation_sum',
  });
  if (apiKey) q.set('apikey', apiKey);
  // El histórico casi no cambia: se guarda un mes en la caché del servidor.
  const res = await f(`${hosts(apiKey).arch}/v1/archive?${q}`, { next: { revalidate: 60 * 60 * 24 * 30 } });
  if (!res.ok) throw new Error(`Open-Meteo histórico: ${res.status}`);
  return res.json() as Promise<{ daily: { time: string[]; precipitation_sum: (number | null)[] } }>;
}

/** mm-dd de una fecha YYYY-MM-DD */
const md = (s: string) => s.slice(5);

export async function obtenerClima(
  lat: number, lon: number,
  opts: { apiKey?: string; fetcher?: Fetcher } = {},
): Promise<ResumenClima> {
  const f = opts.fetcher ?? (fetch as Fetcher);
  const p = await pedirPronostico(lat, lon, opts.apiKey, f);
  const d = p.daily;
  const dias: DiaClima[] = d.time.map((fecha, i) => ({
    fecha,
    lluvia_mm: d.precipitation_sum[i] ?? null,
    temp_max: d.temperature_2m_max[i] ?? null,
    temp_min: d.temperature_2m_min[i] ?? null,
    prob_lluvia: d.precipitation_probability_max?.[i] ?? null,
  }));
  // past_days=31 → índice 31 es hoy en la zona horaria de la finca.
  const iHoy = Math.min(31, dias.length - 1);
  const hoy = dias[iHoy] ?? null;
  const pronostico = dias.slice(iHoy, iHoy + 7);
  const historial = dias.slice(Math.max(0, iHoy - 30), iHoy).map(x => ({ ...x, prob_lluvia: null }));

  const semanas: ResumenClima['lluvia']['semanas'] = [];
  for (let w = 3; w >= 0; w--) {
    const tramo = historial.slice(historial.length - 7 * (w + 1), historial.length - 7 * w);
    if (tramo.length) semanas.push({ desde: tramo[0].fecha, hasta: tramo[tramo.length - 1].fecha, mm: suma(tramo.map(x => x.lluvia_mm)) });
  }

  const hoyStr = hoy?.fecha ?? new Date().toISOString().slice(0, 10);
  const mesStr = hoyStr.slice(0, 7);
  const mesIdx = Number(hoyStr.slice(5, 7)) - 1;
  const mesActual = dias.slice(0, iHoy).filter(x => x.fecha.startsWith(mesStr));

  // "Normal": promedio de los últimos 10 años. Si falla, la pantalla sigue sin él.
  let normal_mes: number | null = null, normal_30: number | null = null, anios = 0;
  try {
    const anioFin = Number(hoyStr.slice(0, 4)) - 1;
    const h = await pedirHistorico(lat, lon, anioFin, opts.apiKey, f);
    const porAnioMes = new Map<number, number>();
    const porAnio30 = new Map<number, number>();
    const desde30 = historial[0] ? md(historial[0].fecha) : null;
    const hasta30 = historial.length ? md(historial[historial.length - 1].fecha) : null;
    const cruzaAnio = desde30 != null && hasta30 != null && desde30 > hasta30;
    h.daily.time.forEach((t, i) => {
      const mm = h.daily.precipitation_sum[i];
      if (mm == null) return;
      const anio = Number(t.slice(0, 4));
      if (Number(t.slice(5, 7)) - 1 === mesIdx) porAnioMes.set(anio, (porAnioMes.get(anio) ?? 0) + mm);
      if (desde30 && hasta30) {
        const m = md(t);
        const dentro = cruzaAnio ? (m >= desde30 || m <= hasta30) : (m >= desde30 && m <= hasta30);
        // Si la ventana cruza el año, los días de enero cuentan para el año anterior.
        if (dentro) { const a = cruzaAnio && m <= hasta30 ? anio - 1 : anio; porAnio30.set(a, (porAnio30.get(a) ?? 0) + mm); }
      }
    });
    if (porAnioMes.size) { normal_mes = r1([...porAnioMes.values()].reduce((a, b) => a + b, 0) / porAnioMes.size); anios = porAnioMes.size; }
    // Con ventana que cruza el año, el primer y último año quedan incompletos: se descartan.
    const vals30 = [...porAnio30.entries()].filter(([a]) => !cruzaAnio || (a >= anioFin - 9 && a < anioFin)).map(([, v]) => v);
    if (vals30.length) normal_30 = r1(vals30.reduce((a, b) => a + b, 0) / vals30.length);
  } catch { /* sin normal histórico */ }

  return {
    lat, lon,
    zona_horaria: p.timezone,
    actualizado: new Date().toISOString(),
    ahora: { temp: p.current?.temperature_2m ?? null, humedad: p.current?.relative_humidity_2m ?? null },
    hoy,
    pronostico,
    historial,
    lluvia: {
      proximos_7: suma(pronostico.map(x => x.lluvia_mm)),
      ultimos_7: suma(historial.slice(-7).map(x => x.lluvia_mm)),
      ultimos_30: suma(historial.map(x => x.lluvia_mm)),
      semanas,
      mes_actual: suma(mesActual.map(x => x.lluvia_mm)),
      mes_nombre: MESES[mesIdx] ?? '',
      normal_mes, normal_30, anios_normal: anios,
    },
    temp: { max_prom_30: prom(historial.map(x => x.temp_max)), min_prom_30: prom(historial.map(x => x.temp_min)) },
  };
}

/** Compara lluvia real contra la normal: "seco", "normal" o "lluvioso". */
export function comparaNormal(real: number, normal: number | null): { txt: string; nivel: 'seco' | 'normal' | 'lluvioso' } | null {
  if (normal == null || normal < 5) return null;
  const pct = Math.round((real / normal) * 100);
  if (pct < 70) return { txt: `${pct}% de lo normal: más seco de lo normal`, nivel: 'seco' };
  if (pct > 130) return { txt: `${pct}% de lo normal: más lluvioso de lo normal`, nivel: 'lluvioso' };
  return { txt: `${pct}% de lo normal: dentro de lo normal`, nivel: 'normal' };
}

/** Coordenadas escritas a mano o pegadas de Google Maps: "4.15, -73.63". */
export function leerCoordenadas(texto: string): { lat: number; lon: number } | null {
  // Grados-minutos-segundos (4°09'N) no: en Google Maps toca el punto y copia los decimales.
  if (/[°'"′″]/.test(texto)) return null;
  const nums = texto.match(/-?\d+(?:[.,]\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const [lat, lon] = nums.slice(0, 2).map(n => Number(n.replace(',', '.')));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
}
