// Vender a tiempo: meta de peso, animales listos, días de retiro y valor del ganado.
// Todo se calcula en el celular, así funciona sin señal.
import type { DbAnimal, DbRetiro } from '@/lib/supabase';
import type { Operacion } from '@/lib/offline/cola';

export const META_PESO_POR_DEFECTO = 480;
export const GDP_BAJA = 0.4; // kg/día: por debajo de esto el animal no está engordando bien

export type Retiro = { hasta: string; producto: string | null };

const hoyISO = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA');
}

// Tratamientos hechos sin señal que todavía no llegan al servidor.
export function retirosPendientes(cola: Operacion[], finca_id: string): DbRetiro[] {
  return cola
    .filter(o => o.estado === 'pendiente' && o.finca_id === finca_id && o.tipo === 'evento_sanitario')
    .map(o => o.payload as Record<string, unknown>)
    .filter(p => Number(p.dias_retiro) > 0 && typeof p.fecha === 'string')
    .map(p => ({
      id: String(p.id), animal_id: (p.animal_id as string) ?? null, potrero_id: (p.potrero_id as string) ?? null,
      producto: (p.producto as string) ?? null, retiro_hasta: sumarDias(p.fecha as string, Number(p.dias_retiro)),
    }));
}

// Retiro vigente de cada animal (el más largo si tiene varios).
// Un tratamiento sin animal aplica al potrero; sin animal ni potrero, a toda la finca.
export function retirosPorAnimal(animales: DbAnimal[], retiros: DbRetiro[]): Map<string, Retiro> {
  const hoy = hoyISO();
  const vigentes = retiros.filter(r => r.retiro_hasta >= hoy);
  const res = new Map<string, Retiro>();
  for (const a of animales) {
    for (const r of vigentes) {
      const aplica = r.animal_id ? r.animal_id === a.id : r.potrero_id ? r.potrero_id === a.potrero_id : true;
      if (!aplica) continue;
      const actual = res.get(a.id);
      if (!actual || r.retiro_hasta > actual.hasta) res.set(a.id, { hasta: r.retiro_hasta, producto: r.producto });
    }
  }
  return res;
}

export function fechaCorta(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export type ResumenVenta = {
  meta: number;
  listos: DbAnimal[];          // llegaron a la meta y se pueden vender
  enRetiro: DbAnimal[];        // llegaron a la meta pero están en retiro
  cerca: number;               // les faltan 30 kg o menos
  pesoPromListos: number;
  kgListos: number;
  kgTotales: number;
  noEngordan: DbAnimal[];      // GDP baja o bajaron de peso, de peor a mejor
};

export function resumenVenta(animales: DbAnimal[], meta: number | null | undefined, retiros: Map<string, Retiro>): ResumenVenta {
  const m = meta && meta > 0 ? meta : META_PESO_POR_DEFECTO;
  const conPeso = animales.filter(a => a.activo !== false && (a.peso_actual ?? 0) > 0);
  const alcanzaron = conPeso.filter(a => (a.peso_actual ?? 0) >= m).sort((a, b) => (b.peso_actual ?? 0) - (a.peso_actual ?? 0));
  const listos = alcanzaron.filter(a => !retiros.has(a.id));
  const enRetiro = alcanzaron.filter(a => retiros.has(a.id));
  const kgListos = listos.reduce((s, a) => s + (a.peso_actual ?? 0), 0);
  return {
    meta: m, listos, enRetiro,
    cerca: conPeso.filter(a => (a.peso_actual ?? 0) < m && (a.peso_actual ?? 0) >= m - 30).length,
    pesoPromListos: listos.length ? Math.round(kgListos / listos.length) : 0,
    kgListos: Math.round(kgListos),
    kgTotales: Math.round(conPeso.reduce((s, a) => s + (a.peso_actual ?? 0), 0)),
    noEngordan: conPeso.filter(a => a.gdp != null && a.gdp < GDP_BAJA).sort((a, b) => (a.gdp ?? 0) - (b.gdp ?? 0)),
  };
}

// Mensaje de WhatsApp para ofrecer el lote. Sin número configurado, WhatsApp deja escoger el contacto.
export function enlaceOfertaWhatsApp(p: {
  finca: string; ubicacion: string | null; animales: DbAnimal[]; pesoProm: number; kgTotal: number;
}): string {
  const cats = new Map<string, number>();
  p.animales.forEach(a => { const k = (a.sexo || a.categoria || 'animales').toLowerCase(); cats.set(k, (cats.get(k) ?? 0) + 1); });
  const detalle = [...cats.entries()].map(([k, n]) => `${n} ${n > 1 && !k.endsWith('s') ? `${k}s` : k}`).join(', ');
  const texto = [
    `Hola Frigorodeo, les ofrezco ganado gordo de la finca ${p.finca}${p.ubicacion ? ` (${p.ubicacion})` : ''}:`,
    `• ${p.animales.length} animales (${detalle})`,
    `• Peso promedio: ${p.pesoProm.toLocaleString('es-CO')} kg`,
    `• Peso total: ${p.kgTotal.toLocaleString('es-CO')} kg`,
    `• Ninguno está en retiro de medicamentos`,
    `¿Me dan precio? Enviado desde Ganado al Día.`,
  ].join('\n');
  const numero = (process.env.NEXT_PUBLIC_FRIGORODEO_WHATSAPP ?? '').replace(/\D/g, '');
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
