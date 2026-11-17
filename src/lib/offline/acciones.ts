// Registros que funcionan con o sin señal. Las pantallas usan estas funciones en vez de llamar
// directo a la base: cada una guarda en el celular y sincroniza cuando hay internet.
import { registrar, type ResultadoRegistro } from './sincronizar';
import { nuevoId } from './almacen';

export type Respuesta = { error: string | null; pendiente: boolean };
type AnimalRef = { dbId: string; nombre?: string | null; arete: string };

const r = (x: ResultadoRegistro): Respuesta => ({ error: x.error, pendiente: x.pendiente });
const nombreDe = (a: { nombre?: string | null; arete: string }) => (a.nombre ? `${a.nombre} (${a.arete})` : a.arete);

export async function registrarPesajeOffline(p: {
  finca_id: string; animal: AnimalRef; peso_kg: number; fecha?: string;
}): Promise<Respuesta> {
  return r(await registrar({
    finca_id: p.finca_id, tipo: 'pesaje',
    payload: { animal_id: p.animal.dbId, peso_kg: p.peso_kg, fecha: p.fecha ?? new Date().toISOString() },
    descripcion: `Pesaje · ${nombreDe(p.animal)} · ${p.peso_kg} kg`,
  }));
}

// Alta de animal (compra o nacimiento). El id se genera en el celular para poder pesarlo sin señal.
export async function registrarAnimalOffline(p: {
  finca_id: string; potrero_id: string | null; nombre: string; arete: string;
  raza: string; sexo: string; categoria: string; peso_kg: number | null;
  origen: 'compra' | 'nacimiento'; contraparte?: string | null; fecha: string;
}): Promise<Respuesta & { animal_id: string }> {
  const id = nuevoId();
  const res = await registrar({
    finca_id: p.finca_id, tipo: 'animal_alta',
    payload: { id, ...p, arete: p.arete.trim(), contraparte: p.contraparte ?? null },
    descripcion: `${p.origen === 'nacimiento' ? 'Nacimiento' : 'Animal nuevo'} · ${nombreDe(p)}`,
  });
  const animal_id = (res.resultado?.animal_id as string | undefined) ?? id;
  if (res.resultado?.fusionado) {
    return { error: `El arete ${p.arete} ya está registrado en esta finca.`, pendiente: false, animal_id };
  }
  return { ...r(res), animal_id };
}

export async function registrarVentaOffline(p: {
  finca_id: string; animal: AnimalRef;
  fecha: string; peso_kg: number | null; precio_kg?: number | null; comprador: string | null; notas: string | null;
}): Promise<Respuesta> {
  return r(await registrar({
    finca_id: p.finca_id, tipo: 'venta',
    payload: { animal_id: p.animal.dbId, fecha: p.fecha, peso_kg: p.peso_kg, precio_kg: p.precio_kg ?? null, comprador: p.comprador, notas: p.notas },
    descripcion: `Venta · ${nombreDe(p.animal)}${p.peso_kg ? ` · ${p.peso_kg} kg` : ''}`,
  }));
}

export async function registrarBajaOffline(p: {
  finca_id: string; animal: AnimalRef; fecha: string; causa: string;
}): Promise<Respuesta> {
  return r(await registrar({
    finca_id: p.finca_id, tipo: 'baja',
    payload: { animal_id: p.animal.dbId, fecha: p.fecha, causa: p.causa },
    descripcion: `Baja · ${nombreDe(p.animal)} · ${p.causa}`,
  }));
}

export async function trasladarAnimalOffline(p: {
  finca_id: string; animal: AnimalRef;
  finca_destino_id: string; finca_destino_nombre: string; fecha: string; notas: string | null;
}): Promise<Respuesta> {
  return r(await registrar({
    finca_id: p.finca_id, tipo: 'traslado',
    payload: { animal_id: p.animal.dbId, finca_destino_id: p.finca_destino_id, fecha: p.fecha, notas: p.notas },
    descripcion: `Traslado · ${nombreDe(p.animal)} → ${p.finca_destino_nombre}`,
  }));
}

export const TIPOS_SANITARIOS = [
  { key: 'vacuna', label: 'Vacuna' },
  { key: 'desparasitacion', label: 'Desparasitación' },
  { key: 'tratamiento', label: 'Tratamiento' },
  { key: 'vitaminas', label: 'Vitaminas' },
  { key: 'otro', label: 'Otro' },
] as const;
export type TipoSanitario = typeof TIPOS_SANITARIOS[number]['key'];

export async function registrarEventoSanitarioOffline(p: {
  finca_id: string; animal?: AnimalRef | null;
  tipo: TipoSanitario; producto: string | null; dosis: string | null; fecha: string; notas: string | null;
}): Promise<Respuesta> {
  const etiqueta = TIPOS_SANITARIOS.find(t => t.key === p.tipo)?.label ?? p.tipo;
  return r(await registrar({
    finca_id: p.finca_id, tipo: 'evento_sanitario',
    payload: { id: nuevoId(), animal_id: p.animal?.dbId ?? null, tipo: p.tipo, producto: p.producto, dosis: p.dosis, fecha: p.fecha, notas: p.notas },
    descripcion: `${etiqueta}${p.producto ? ` (${p.producto})` : ''}${p.animal ? ` · ${nombreDe(p.animal)}` : ''}`,
  }));
}

export async function crearGastoOffline(p: {
  finca_id: string; proveedor_id: string | null; concepto: string;
  items_desc: string | null; monto: number; fecha: string; via: string;
}): Promise<Respuesta> {
  return r(await registrar({
    finca_id: p.finca_id, tipo: 'gasto', payload: { ...p },
    descripcion: `Gasto · ${p.concepto} · $${Math.round(p.monto).toLocaleString('es-CO')}`,
  }));
}
