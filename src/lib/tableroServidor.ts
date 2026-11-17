import 'server-only';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ALFABETO_CODIGO, AnimalCorto, ConfigPantalla, DatosTablero, ES_PANEL, GDP_BAJA,
  META_PESO_POR_DEFECTO, PANELES_POR_DEFECTO,
} from '@/lib/tablero';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>;

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const nuevoToken = () => randomBytes(32).toString('base64url');
export const nuevoCodigo = () => Array.from({ length: 6 }, () => ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)]).join('');
export const MINUTOS_CODIGO = 15;

export function tokenDeRequest(req: Request): string | null {
  const t = req.headers.get('x-tv-token')?.trim();
  return t && t.length >= 20 && t.length <= 100 ? t : null;
}

export type FilaPantalla = {
  id: string; finca_id: string | null; nombre: string; codigo: string | null; codigo_expira: string | null;
  paneles: unknown; segundos_panel: number; tema: 'oscuro' | 'claro';
};

export function configDe(p: FilaPantalla): ConfigPantalla {
  const paneles = Array.isArray(p.paneles) ? p.paneles.filter(ES_PANEL) : [];
  return {
    id: p.id, nombre: p.nombre,
    paneles: paneles.length ? [...new Set(paneles)] : PANELES_POR_DEFECTO,
    segundos_panel: p.segundos_panel, tema: p.tema,
  };
}

/** Quién llama desde el celular y si es dueño o administrador de la finca. */
export async function puedeAdministrarTv(sb: SB, authHeader: string | null, fincaId: string): Promise<{ userId: string } | { error: string; status: number }> {
  const token = (authHeader ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'No autenticado', status: 401 };
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return { error: 'No autenticado', status: 401 };
  const uid = data.user.id;
  const [{ data: m }, { data: s }] = await Promise.all([
    sb.from('membresias').select('rol').eq('auth_user_id', uid).eq('finca_id', fincaId).maybeSingle(),
    sb.from('superadmins').select('auth_user_id').eq('auth_user_id', uid).maybeSingle(),
  ]);
  if (s || (m && ['owner', 'admin'].includes(m.rol))) return { userId: uid };
  return { error: 'Solo el dueño o el administrador pueden conectar televisores', status: 403 };
}

// ---------- Fechas en la zona del televisor ----------

function zonaValida(tz: string | null): string {
  if (!tz) return 'America/Bogota';
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return tz; } catch { return 'America/Bogota'; }
}
const fechaEn = (d: Date, tz: string) => d.toLocaleDateString('en-CA', { timeZone: tz }); // AAAA-MM-DD
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const prom = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const r3 = (v: number | null) => v == null ? null : Math.round(v * 1000) / 1000;
// Un GDP fuera de esto es un error de digitación del pesaje, no un animal.
const gdpCreible = (g: unknown): g is number => typeof g === 'number' && Number.isFinite(g) && g > -3 && g < 4;

type Animal = { id: string; arete: string; nombre: string | null; categoria: string | null; peso_actual: number | null; gdp: number | null; potrero_id: string | null };

// ---------- Datos del tablero ----------

export async function calcularTablero(sb: SB, fincaId: string, tzPedida: string | null): Promise<DatosTablero> {
  const tz = zonaValida(tzPedida);
  const ahora = new Date();
  const hoy = fechaEn(ahora, tz);
  const hace56 = new Date(ahora.getTime() - 56 * 864e5).toISOString();
  const hace30 = sumarDias(hoy, -30);

  const [fincaR, animalesR, potrerosR, pesajesR, ventasR, bajasR, tareasR, retirosR] = await Promise.all([
    // select('*'): meta_peso_kg / precio_kg (PR #12) y latitud / longitud (PR #14) pueden no existir todavía.
    sb.from('fincas').select('*').eq('id', fincaId).single(),
    sb.from('animales').select('id, arete, nombre, categoria, peso_actual, gdp, potrero_id').eq('finca_id', fincaId).eq('activo', true),
    sb.from('potreros').select('id, nombre').eq('finca_id', fincaId),
    sb.from('pesajes').select('fecha, gdp_calculado').eq('finca_id', fincaId).gte('fecha', hace56).limit(20000),
    sb.from('animal_eventos').select('fecha, peso_kg, total_cop').eq('finca_id', fincaId).eq('tipo', 'venta').gte('fecha', hace30),
    sb.from('bajas').select('fecha, causa').eq('finca_id', fincaId).gte('fecha', hace30),
    sb.from('eventos').select('titulo, tipo, fecha').eq('finca_id', fincaId).eq('completado', false)
      .lte('fecha', sumarDias(hoy, 7)).order('fecha').limit(50),
    // Días de retiro (PR #12). Si la columna no existe, se ignora.
    sb.from('eventos_sanitarios').select('animal_id, potrero_id, retiro_hasta').eq('finca_id', fincaId).gte('retiro_hasta', hoy),
  ]);
  if (fincaR.error) throw new Error(fincaR.error.message);
  if (animalesR.error) throw new Error(animalesR.error.message);
  const finca = fincaR.data as Record<string, unknown>;
  const animales = (animalesR.data ?? []) as Animal[];
  const nombrePotrero = new Map<string, string>((potrerosR.data ?? []).map((p: { id: string; nombre: string }) => [p.id, p.nombre]));
  const corto = (a: Animal): AnimalCorto => ({
    arete: a.arete, nombre: a.nombre, peso: a.peso_actual != null ? Number(a.peso_actual) : null,
    gdp: a.gdp != null ? Number(a.gdp) : null, potrero: a.potrero_id ? nombrePotrero.get(a.potrero_id) ?? null : null,
  });

  // Resumen
  const conPeso = animales.filter(a => Number(a.peso_actual) > 0);
  const kg = conPeso.reduce((s, a) => s + Number(a.peso_actual), 0);
  const precio = Number(finca.precio_kg) > 0 ? Number(finca.precio_kg) : null;
  const cats = new Map<string, number>();
  animales.forEach(a => { const k = a.categoria || 'Sin categoría'; cats.set(k, (cats.get(k) ?? 0) + 1); });

  // Engorde: GDP de los animales y de los pesajes por semana
  const gdps = animales.map(a => (a.gdp == null ? null : Number(a.gdp))).filter(gdpCreible);
  const semanas: DatosTablero['engorde']['semanas'] = [];
  const pesajes = (pesajesR.data ?? []) as { fecha: string; gdp_calculado: number | null }[];
  for (let w = 7; w >= 0; w--) {
    const fin = ahora.getTime() - w * 7 * 864e5, ini = fin - 7 * 864e5;
    const en = pesajes.filter(p => { const t = Date.parse(p.fecha); return t > ini && t <= fin; });
    const g = en.map(p => (p.gdp_calculado == null ? null : Number(p.gdp_calculado))).filter(gdpCreible);
    semanas.push({ desde: fechaEn(new Date(ini + 864e5), tz), gdp: r3(prom(g)), pesajes: en.length });
  }
  const gdpTramo = (desde: number, hasta: number) => {
    const g = pesajes.filter(p => { const t = Date.parse(p.fecha); return t > ahora.getTime() - desde * 864e5 && t <= ahora.getTime() - hasta * 864e5; })
      .map(p => (p.gdp_calculado == null ? null : Number(p.gdp_calculado))).filter(gdpCreible);
    return r3(prom(g));
  };

  // Listos para vender (misma regla que PR #12: llegaron a la meta y no están en retiro)
  const meta = Number(finca.meta_peso_kg) > 0 ? Number(finca.meta_peso_kg) : META_PESO_POR_DEFECTO;
  const retiros = retirosR.error ? [] : (retirosR.data ?? []) as { animal_id: string | null; potrero_id: string | null }[];
  const enRetiro = (a: Animal) => retiros.some(r => r.animal_id ? r.animal_id === a.id : r.potrero_id ? r.potrero_id === a.potrero_id : true);
  const alcanzaron = conPeso.filter(a => Number(a.peso_actual) >= meta).sort((a, b) => Number(b.peso_actual) - Number(a.peso_actual));
  const listos = alcanzaron.filter(a => !enRetiro(a));
  const kgListos = listos.reduce((s, a) => s + Number(a.peso_actual), 0);

  // No están engordando
  const flojos = animales.filter(a => a.gdp != null && gdpCreible(Number(a.gdp)) && Number(a.gdp) < GDP_BAJA)
    .sort((a, b) => Number(a.gdp) - Number(b.gdp));

  // Ventas y bajas
  const ventas = (ventasR.data ?? []) as { peso_kg: number | null; total_cop: number | null }[];
  const bajas = (bajasR.data ?? []) as { causa: string }[];
  const causas = new Map<string, number>();
  bajas.forEach(b => { const k = (b.causa || 'Sin causa').trim(); causas.set(k, (causas.get(k) ?? 0) + 1); });

  // Tareas
  const tareas = ((tareasR.data ?? []) as { titulo: string; tipo: string; fecha: string }[]).map(t => ({
    ...t, cuando: (t.fecha < hoy ? 'vencida' : t.fecha === hoy ? 'hoy' : 'semana') as 'vencida' | 'hoy' | 'semana',
  }));

  const lat = finca.latitud != null ? Number(finca.latitud) : null;
  const lon = finca.longitud != null ? Number(finca.longitud) : null;

  return {
    finca: { nombre: String(finca.nombre ?? ''), ubicacion: (finca.ubicacion as string) ?? null },
    generado: ahora.toISOString(),
    hoy,
    resumen: {
      animales: animales.length,
      por_categoria: [...cats.entries()].map(([categoria, n]) => ({ categoria, n })).sort((a, b) => b.n - a.n),
      kg_totales: Math.round(kg),
      peso_promedio: conPeso.length ? Math.round(kg / conPeso.length) : null,
      precio_kg: precio,
      valor: precio ? Math.round(kg * precio) : null,
    },
    engorde: {
      gdp_promedio: r3(prom(gdps)),
      gdp_4sem: gdpTramo(28, 0),
      gdp_4sem_anterior: gdpTramo(56, 28),
      semanas,
      animales_con_gdp: gdps.length,
    },
    listos: {
      meta,
      listos: listos.length,
      en_retiro: alcanzaron.length - listos.length,
      cerca: conPeso.filter(a => Number(a.peso_actual) < meta && Number(a.peso_actual) >= meta - 30).length,
      con_peso: conPeso.length,
      kg_listos: Math.round(kgListos),
      valor_listos: precio ? Math.round(kgListos * precio) : null,
      mas_pesados: listos.slice(0, 8).map(corto),
    },
    no_engordan: {
      total: flojos.length,
      bajando: flojos.filter(a => Number(a.gdp) < 0).length,
      animales: flojos.slice(0, 8).map(corto),
    },
    ventas: {
      dias: 30,
      ventas: ventas.length,
      kg_vendidos: Math.round(ventas.reduce((s, v) => s + (Number(v.peso_kg) || 0), 0)),
      total_ventas: Math.round(ventas.reduce((s, v) => s + (Number(v.total_cop) || 0), 0)),
      bajas: bajas.length,
      causas: [...causas.entries()].map(([causa, n]) => ({ causa, n })).sort((a, b) => b.n - a.n).slice(0, 4),
    },
    clima: lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) ? await climaSemana(lat, lon) : null,
    tareas: {
      vencidas: tareas.filter(t => t.cuando === 'vencida').length,
      hoy: tareas.filter(t => t.cuando === 'hoy').length,
      semana: tareas.filter(t => t.cuando === 'semana').length,
      lista: tareas.slice(0, 8),
    },
  };
}

// Clima de la semana con Open-Meteo, igual que PR #14 (con OPEN_METEO_API_KEY usa los servidores de pago).
async function climaSemana(lat: number, lon: number): Promise<DatosTablero['clima']> {
  const key = process.env.OPEN_METEO_API_KEY || '';
  const q = new URLSearchParams({
    latitude: String(lat), longitude: String(lon), timezone: 'auto', forecast_days: '7',
    daily: 'precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min',
    current: 'temperature_2m,relative_humidity_2m',
  });
  if (key) q.set('apikey', key);
  const host = key ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
  try {
    const res = await fetch(`${host}/v1/forecast?${q}`, { next: { revalidate: 1800 } } as RequestInit);
    if (!res.ok) return null;
    const j = await res.json() as {
      current?: { temperature_2m?: number; relative_humidity_2m?: number };
      daily: { time: string[]; precipitation_sum: (number | null)[]; precipitation_probability_max?: (number | null)[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[] };
    };
    const d = j.daily;
    const dias = d.time.map((fecha, i) => ({
      fecha, lluvia_mm: d.precipitation_sum[i] ?? null, prob: d.precipitation_probability_max?.[i] ?? null,
      max: d.temperature_2m_max[i] ?? null, min: d.temperature_2m_min[i] ?? null,
    }));
    return {
      temp_ahora: j.current?.temperature_2m ?? null,
      humedad: j.current?.relative_humidity_2m ?? null,
      dias,
      lluvia_7: Math.round(dias.reduce((s, x) => s + (x.lluvia_mm ?? 0), 0) * 10) / 10,
    };
  } catch {
    return null;
  }
}
