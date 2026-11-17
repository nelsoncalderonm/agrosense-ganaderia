// Motor de sincronización: envía la cola al servidor en orden, cuando hay señal.
// - Cada operación lleva su id: si se corta la señal a mitad de envío, reenviarla no duplica nada.
// - Si el servidor no puede aplicarla (animal ya vendido, sin permiso…) queda como "conflicto"
//   para revisión, y la cola sigue con las demás.
import { supabase } from '@/lib/supabase';
import { listarCola, guardarOperacion, quitarOperacion, encolar, avisarCambio, type Operacion } from './cola';
import { mensajeAmigable } from './mensajes';

type Resultado = { estado: 'aplicada' | 'conflicto'; resultado?: Record<string, unknown> | null; error?: string | null };
type RespuestaServidor = { estado: 'aplicada' | 'conflicto' | 'descartada'; resultado: Record<string, unknown> | null; error: string | null };

const resultados = new Map<string, Resultado>();
let enCurso: Promise<void> | null = null;
let ultimaSync: string | null = null;
let ultimoError: string | null = null;

export function estadoMotor() { return { sincronizando: enCurso !== null, ultimaSync, ultimoError }; }

function hayRed() { return typeof navigator === 'undefined' || navigator.onLine !== false; }

async function enviar(op: Operacion): Promise<RespuestaServidor | null> {
  const { data, error } = await supabase.rpc('sync_aplicar', {
    p_id: op.id, p_finca_id: op.finca_id, p_tipo: op.tipo, p_payload: op.payload,
    p_creada_en: op.creada_en, p_dispositivo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : null,
  });
  // Un error aquí es de red, sesión vencida o servidor caído: se reintenta después.
  if (error) { ultimoError = error.message; return null; }
  return data as RespuestaServidor;
}

async function vaciarCola() {
  if (!hayRed()) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return; // sin sesión válida (se renueva sola cuando vuelve la señal)

  const ops = (await listarCola()).filter(o => o.estado === 'pendiente');
  for (const op of ops) {
    const r = await enviar(op);
    if (!r) {
      await guardarOperacion({ ...op, intentos: op.intentos + 1 });
      return; // sin conexión: se mantiene el orden y se reintenta luego
    }
    if (r.estado === 'conflicto') {
      resultados.set(op.id, { estado: 'conflicto', error: r.error });
      await guardarOperacion({ ...op, estado: 'conflicto', error: r.error, intentos: op.intentos + 1 });
    } else {
      resultados.set(op.id, { estado: 'aplicada', resultado: r.resultado });
      await quitarOperacion(op.id);
    }
  }
  ultimaSync = new Date().toISOString();
  ultimoError = null;
}

// Envía todo lo pendiente. Si ya hay un envío en curso, espera ese mismo.
export function sincronizar(): Promise<void> {
  if (!enCurso) {
    enCurso = vaciarCola()
      .catch(e => { ultimoError = e instanceof Error ? e.message : String(e); })
      .finally(() => { enCurso = null; avisarCambio(); });
    avisarCambio();
  }
  return enCurso;
}

function conTiempo<T>(p: Promise<T>, ms: number): Promise<T | 'tiempo'> {
  return Promise.race([p, new Promise<'tiempo'>(r => setTimeout(() => r('tiempo'), ms))]);
}

export type ResultadoRegistro = {
  error: string | null;
  pendiente: boolean;          // true = quedó guardado en el celular, se envía cuando haya señal
  resultado?: Record<string, unknown> | null;
  op: Operacion;
};

// Guarda un registro: primero en el celular, luego intenta enviarlo.
// Con señal, responde como antes (incluyendo errores al instante).
// Sin señal, responde enseguida con pendiente = true.
export async function registrar(op: Pick<Operacion, 'finca_id' | 'tipo' | 'payload' | 'descripcion'>): Promise<ResultadoRegistro> {
  const guardada = await encolar(op);
  if (!hayRed()) return { error: null, pendiente: true, op: guardada };

  const fin = await conTiempo(sincronizar(), 10000);
  // Si la primera pasada encontró la cola ocupada, otra pasada puede incluir este registro.
  if (fin !== 'tiempo' && !resultados.has(guardada.id)) await conTiempo(sincronizar(), 8000);

  const r = resultados.get(guardada.id);
  if (!r) return { error: null, pendiente: true, op: guardada };
  resultados.delete(guardada.id);
  if (r.estado === 'conflicto') {
    // La persona ve el error en el formulario: no lo dejamos también en la lista de revisión.
    await descartarConflicto(guardada.id);
    return { error: mensajeAmigable(r.error), pendiente: false, op: guardada };
  }
  return { error: null, pendiente: false, resultado: r.resultado, op: guardada };
}

// ---------- Conflictos ----------

export async function descartarConflicto(id: string) {
  await quitarOperacion(id);
  if (hayRed()) await supabase.rpc('sync_descartar', { p_id: id });
}

// Vuelve a intentar con un id nuevo (por ejemplo, después de corregir el animal).
export async function reintentarConflicto(op: Operacion) {
  await encolar({ finca_id: op.finca_id, tipo: op.tipo, payload: op.payload, descripcion: op.descripcion });
  await descartarConflicto(op.id);
  void sincronizar();
}

// Conflictos de otros celulares de la finca que el servidor tiene anotados.
export type ConflictoServidor = { id: string; tipo: string; payload: Record<string, unknown>; error: string | null; creada_en: string; usuario_id: string | null };
export async function conflictosDelServidor(finca_id: string): Promise<ConflictoServidor[]> {
  const { data, error } = await supabase.from('sync_operaciones')
    .select('id, tipo, payload, error, creada_en, usuario_id')
    .eq('finca_id', finca_id).eq('estado', 'conflicto').order('creada_en', { ascending: false }).limit(50);
  if (error) return [];
  return (data ?? []) as ConflictoServidor[];
}

// ---------- Arranque ----------

let iniciado = false;
export function iniciarSincronizacion() {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;
  window.addEventListener('online', () => { void sincronizar(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sincronizar(); });
  setInterval(() => { void sincronizar(); }, 60_000);
  void sincronizar();
}
