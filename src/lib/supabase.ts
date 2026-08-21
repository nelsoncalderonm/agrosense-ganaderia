import { createClient } from '@supabase/supabase-js';
import type { RoleKey } from '@/data/agrosense';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------- typed helpers ----------

export type DbFinca = {
  id: string; nombre: string; ubicacion: string | null;
  hectareas: number | null; valor_cop: number | null; activa: boolean;
};

export type DbPotrero = {
  id: string; finca_id: string; nombre: string; capacidad: number;
  hectareas: number | null; aforo: number | null;
  estado: string; dias_estado: number;
};

export type DbAnimal = {
  id: string; finca_id: string; potrero_id: string | null;
  nombre: string | null; arete: string; rfid: string | null;
  raza: string | null; sexo: string | null; categoria: string | null;
  estado: string; estado_txt: string | null;
  peso_actual: number | null; gdp: number | null; gdp_delta: number | null;
  dias_potrero: number | null; activo: boolean;
};

export type DbPesaje = {
  id: string; animal_id: string; finca_id: string;
  peso_kg: number; gdp_calculado: number | null; dias_periodo: number | null;
  pendiente_sync: boolean; fecha: string;
};

export type DbMovimiento = {
  id: string; finca_id: string; tipo: string; fecha: string;
  contraparte: string | null; animales_count: number;
  categoria: string | null; raza: string | null;
  peso_prom_kg: number | null; precio_kg: number | null;
  total_cop: number | null; costo_cop: number | null; utilidad_cop: number | null;
  transporte_cop: number | null; notas: string | null;
};

export type DbAlerta = {
  id: string; finca_id: string; animal_id: string | null;
  tipo: string; titulo: string; descripcion: string | null;
  severidad: string; meta: string | null; resuelta: boolean; fecha_vence: string | null;
};

export type DbEvento = {
  id: string; finca_id: string; tipo: string; titulo: string;
  descripcion: string | null; fecha: string;
  animales_count: number | null; potrero_ref: string | null; completado: boolean;
};

export type DbProveedor = {
  id: string; finca_id: string; nombre: string; nit: string | null;
  ciudad: string | null; tipo: string | null; telefono: string | null;
  email: string | null; via_email: boolean; activo: boolean;
};

export type DbCliente = {
  id: string; finca_id: string; nombre: string; nit: string | null;
  ciudad: string | null; tipo: string | null; telefono: string | null;
  email: string | null; activo: boolean;
};

export type DbGasto = {
  id: string; finca_id: string; proveedor_id: string | null;
  concepto: string; items_desc: string | null; monto: number;
  fecha: string; via: string; nit_proveedor: string | null;
  pendiente_sync: boolean;
};

export type DbIngreso = {
  id: string; finca_id: string; cliente_id: string | null;
  movimiento_id: string | null; concepto: string; monto: number; fecha: string;
};

export type DbMembresia = {
  id: string; auth_user_id: string; finca_id: string; nombre: string; rol: RoleKey;
};

export async function getMisMembresias(): Promise<DbMembresia[]> {
  const { data } = await supabase.from('Agrosense_membresias').select('*');
  return (data ?? []) as DbMembresia[];
}

// ---------- fetch helpers ----------

export async function getFincas(): Promise<DbFinca[]> {
  // Orden custom: Hacienda La Esperanza primero (sede principal con datos completos)
  const { data } = await supabase.from('Agrosense_fincas').select('*').eq('activa', true);
  const sorted = (data ?? []).sort((a, b) => {
    if (a.nombre === 'Hacienda La Esperanza') return -1;
    if (b.nombre === 'Hacienda La Esperanza') return 1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
  return sorted;
}

export async function getPotreros(finca_id: string): Promise<DbPotrero[]> {
  const { data } = await supabase.from('Agrosense_potreros').select('*').eq('finca_id', finca_id).order('nombre');
  return data ?? [];
}

export async function getAnimales(finca_id: string): Promise<DbAnimal[]> {
  const { data } = await supabase.from('Agrosense_animales').select('*').eq('finca_id', finca_id).eq('activo', true).order('nombre');
  return data ?? [];
}

export async function getPesajesRecientes(finca_id: string, limit = 10): Promise<DbPesaje[]> {
  const { data } = await supabase.from('Agrosense_pesajes').select('*').eq('finca_id', finca_id).order('fecha', { ascending: false }).limit(limit);
  return data ?? [];
}

export async function getAlertas(finca_id: string): Promise<DbAlerta[]> {
  const { data } = await supabase.from('Agrosense_alertas').select('*').eq('finca_id', finca_id).eq('resuelta', false).order('fecha_vence');
  return data ?? [];
}

export async function getEventos(finca_id: string): Promise<DbEvento[]> {
  const { data } = await supabase.from('Agrosense_eventos').select('*').eq('finca_id', finca_id).gte('fecha', new Date().toISOString().split('T')[0]).order('fecha');
  return data ?? [];
}

export async function getProveedores(finca_id: string): Promise<DbProveedor[]> {
  const { data } = await supabase.from('Agrosense_proveedores').select('*').eq('finca_id', finca_id).eq('activo', true).order('nombre');
  return data ?? [];
}

export async function getClientes(finca_id: string): Promise<DbCliente[]> {
  const { data } = await supabase.from('Agrosense_clientes').select('*').eq('finca_id', finca_id).eq('activo', true).order('nombre');
  return data ?? [];
}

export async function getGastos(finca_id: string): Promise<DbGasto[]> {
  const { data } = await supabase.from('Agrosense_gastos').select('*').eq('finca_id', finca_id).order('fecha', { ascending: false }).limit(50);
  return data ?? [];
}

export async function getMovimientos(finca_id: string): Promise<DbMovimiento[]> {
  const { data } = await supabase.from('Agrosense_movimientos').select('*').eq('finca_id', finca_id).order('fecha', { ascending: false }).limit(30);
  return data ?? [];
}

export async function registrarPesaje(payload: Omit<DbPesaje, 'id'>): Promise<DbPesaje | null> {
  const { data } = await supabase.from('Agrosense_pesajes').insert(payload).select().single();
  if (data) {
    // Update animal's current weight
    await supabase.from('Agrosense_animales').update({
      peso_actual: payload.peso_kg,
      gdp: payload.gdp_calculado,
      updated_at: new Date().toISOString(),
    }).eq('id', payload.animal_id);
  }
  return data;
}
