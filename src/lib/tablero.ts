// Tablero para el televisor: lista de paneles y forma de los datos.
// Este archivo lo usan el televisor, el celular (configuración) y el servidor.

export type PanelId = 'resumen' | 'engorde' | 'listos' | 'no_engordan' | 'ventas' | 'clima' | 'tareas';

export const PANELES: { id: PanelId; titulo: string; descripcion: string }[] = [
  { id: 'resumen',     titulo: 'Resumen del ganado',     descripcion: 'Animales, kilos y valor del ganado hoy' },
  { id: 'engorde',     titulo: 'Engorde (GDP)',          descripcion: 'Ganancia diaria promedio y cómo va' },
  { id: 'listos',      titulo: 'Listos para vender',     descripcion: 'Cuántos llegaron a la meta de peso' },
  { id: 'no_engordan', titulo: 'No están engordando',    descripcion: 'Animales que ganan poco o bajan de peso' },
  { id: 'ventas',      titulo: 'Ventas y bajas',         descripcion: 'Últimos 30 días' },
  { id: 'clima',       titulo: 'Clima',                  descripcion: 'Temperatura y lluvia de la semana' },
  { id: 'tareas',      titulo: 'Tareas pendientes',      descripcion: 'Vencidas, de hoy y de la semana' },
];

export const PANELES_POR_DEFECTO: PanelId[] = PANELES.map(p => p.id);
export const ES_PANEL = (x: unknown): x is PanelId => PANELES.some(p => p.id === x);

export const META_PESO_POR_DEFECTO = 480; // igual que en vender a tiempo (PR #12)
export const GDP_BAJA = 0.4;              // kg/día: por debajo no está engordando bien

export type ConfigPantalla = {
  id: string;
  nombre: string;
  paneles: PanelId[];
  segundos_panel: number;
  tema: 'oscuro' | 'claro';
};

export type AnimalCorto = { arete: string; nombre: string | null; peso: number | null; gdp: number | null; potrero: string | null };

export type DatosTablero = {
  finca: { nombre: string; ubicacion: string | null };
  generado: string; // ISO
  hoy: string;      // AAAA-MM-DD en la zona del televisor
  resumen: {
    animales: number;
    por_categoria: { categoria: string; n: number }[];
    kg_totales: number;
    peso_promedio: number | null;
    precio_kg: number | null;
    valor: number | null;
  };
  engorde: {
    gdp_promedio: number | null;          // kg/día, animales activos
    gdp_4sem: number | null;              // pesajes de las últimas 4 semanas
    gdp_4sem_anterior: number | null;     // las 4 semanas antes de esas
    semanas: { desde: string; gdp: number | null; pesajes: number }[]; // 8 semanas, la más reciente al final
    animales_con_gdp: number;
  };
  listos: {
    meta: number;
    listos: number;
    en_retiro: number;
    cerca: number;           // les faltan 30 kg o menos
    con_peso: number;
    kg_listos: number;
    valor_listos: number | null;
    mas_pesados: AnimalCorto[];
  };
  no_engordan: { total: number; bajando: number; animales: AnimalCorto[] };
  ventas: {
    dias: number;
    ventas: number; kg_vendidos: number; total_ventas: number;
    bajas: number; causas: { causa: string; n: number }[];
  };
  clima: null | {
    temp_ahora: number | null;
    humedad: number | null;
    dias: { fecha: string; lluvia_mm: number | null; prob: number | null; max: number | null; min: number | null }[];
    lluvia_7: number;
  };
  tareas: {
    vencidas: number; hoy: number; semana: number;
    lista: { titulo: string; fecha: string; tipo: string; cuando: 'vencida' | 'hoy' | 'semana' }[];
  };
};

// ---------- Formato (televisor y celular) ----------

export const n0 = (v: number | null | undefined) =>
  v == null ? '—' : Math.round(v).toLocaleString('es-CO');

/** Plata en corto: $ 1.250 millones, $ 850 mil. */
export function plataCorta(v: number | null | undefined): string {
  if (v == null) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `$ ${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 0 })} millones`;
  if (a >= 1e6) return `$ ${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} millones`;
  if (a >= 1e3) return `$ ${(v / 1e3).toLocaleString('es-CO', { maximumFractionDigits: 0 })} mil`;
  return `$ ${Math.round(v).toLocaleString('es-CO')}`;
}

/** GDP en gramos por día, que es como lo dicen en la finca. */
export const gramosDia = (kg: number | null | undefined) =>
  kg == null ? '—' : `${Math.round(kg * 1000).toLocaleString('es-CO')} g/día`;

// Código de vinculación: sin letras que se confundan (0/O, 1/I/L, 2/Z, 5/S, 8/B).
export const ALFABETO_CODIGO = 'ACDEFGHJKMNPQRTUVWXY34679';
export const normalizarCodigo = (s: string) =>
  s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const codigoBonito = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;
