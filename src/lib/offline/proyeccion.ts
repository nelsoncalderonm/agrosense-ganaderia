// Muestra los registros hechos sin señal como si ya estuvieran en el servidor:
// animales nuevos aparecen, el peso se actualiza y los vendidos salen de la lista.
import type { DbAnimal } from '@/lib/supabase';
import type { Operacion } from './cola';

export function aplicarPendientes(animales: DbAnimal[], cola: Operacion[], finca_id: string): DbAnimal[] {
  const pendientes = cola.filter(o => o.estado === 'pendiente' && o.finca_id === finca_id);
  if (!pendientes.length) return animales;
  const lista = animales.map(a => ({ ...a }));
  const porId = new Map(lista.map(a => [a.id, a]));
  const fuera = new Set<string>();

  for (const op of pendientes) {
    const p = op.payload as Record<string, unknown>;
    if (op.tipo === 'animal_alta') {
      const id = String(p.id);
      if (porId.has(id)) continue;
      const nuevo: DbAnimal = {
        id, finca_id, potrero_id: (p.potrero_id as string) ?? null,
        nombre: (p.nombre as string) || null, arete: String(p.arete), rfid: String(p.arete),
        raza: (p.raza as string) ?? null, sexo: (p.sexo as string) ?? null,
        categoria: (p.categoria as string) ?? (p.origen === 'nacimiento' ? 'Cría' : 'Ceba'),
        estado: 'green', estado_txt: 'Pendiente de sincronizar',
        peso_actual: (p.peso_kg as number) ?? null, gdp: null, gdp_delta: null,
        dias_potrero: 0, activo: true,
      };
      lista.push(nuevo);
      porId.set(id, nuevo);
    } else if (op.tipo === 'pesaje') {
      const a = porId.get(String(p.animal_id));
      if (a) a.peso_actual = Number(p.peso_kg);
    } else if (op.tipo === 'venta' || op.tipo === 'baja' || op.tipo === 'traslado') {
      fuera.add(String(p.animal_id));
    }
  }
  return lista.filter(a => !fuera.has(a.id));
}
