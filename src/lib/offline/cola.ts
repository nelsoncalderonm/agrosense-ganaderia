// Cola de registros hechos en el celular que todavía no llegan al servidor.
import { STORE_COLA, poner, borrar, todos, nuevoId } from './almacen';

export type TipoOperacion = 'pesaje' | 'animal_alta' | 'venta' | 'baja' | 'traslado' | 'evento_sanitario' | 'gasto';

export type Operacion = {
  id: string;                 // id único: si llega dos veces al servidor, se aplica una vez
  finca_id: string;
  tipo: TipoOperacion;
  payload: Record<string, unknown>;
  descripcion: string;        // texto para mostrar: "Pesaje · Capitán · 330 kg"
  creada_en: string;          // hora del celular
  orden: number;              // para enviar en el mismo orden en que se hicieron
  estado: 'pendiente' | 'conflicto';
  error?: string | null;
  intentos: number;
};

type Oyente = () => void;
const oyentes = new Set<Oyente>();
const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('agrosense-cola') : null;
canal?.addEventListener('message', () => oyentes.forEach(f => f()));

export function suscribirCola(f: Oyente): () => void {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}

export function avisarCambio() {
  oyentes.forEach(f => f());
  canal?.postMessage('cambio');
}

let ultimoOrden = 0;
function siguienteOrden() {
  const t = Date.now() * 1000;
  ultimoOrden = Math.max(t, ultimoOrden + 1);
  return ultimoOrden;
}

export async function encolar(op: Pick<Operacion, 'finca_id' | 'tipo' | 'payload' | 'descripcion'>): Promise<Operacion> {
  const completa: Operacion = {
    ...op,
    id: nuevoId(),
    creada_en: new Date().toISOString(),
    orden: siguienteOrden(),
    estado: 'pendiente',
    error: null,
    intentos: 0,
  };
  await poner(STORE_COLA, completa);
  avisarCambio();
  return completa;
}

export async function listarCola(): Promise<Operacion[]> {
  try { return await todos<Operacion>(STORE_COLA, 'orden'); } catch { return []; }
}

export async function guardarOperacion(op: Operacion) {
  await poner(STORE_COLA, op);
  avisarCambio();
}

export async function quitarOperacion(id: string) {
  await borrar(STORE_COLA, id);
  avisarCambio();
}
