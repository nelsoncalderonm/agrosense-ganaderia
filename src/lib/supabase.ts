import { createClient } from '@supabase/supabase-js';
import type { RoleKey } from '@/data/agrosense';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Todas las tablas viven en el esquema "agrosense" (proyecto Supabase frigopuntos).
// El esquema debe estar en Settings → API → Exposed schemas.
export const AGROSENSE_SCHEMA = 'agrosense';

// Con señal débil en el campo una consulta puede quedarse colgada: la cortamos a los 20 s
// para que la app pase a usar la copia del celular.
const fetchConTiempo: typeof fetch = (input, init) => {
  if (init?.signal) return fetch(input, init);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: AGROSENSE_SCHEMA },
  global: { fetch: fetchConTiempo },
});

// ---------- typed helpers ----------

export type DbFinca = {
  id: string; nombre: string; ubicacion: string | null;
  hectareas: number | null; valor_cop: number | null; activa: boolean;
  organizacion_id: string | null;
};

export type DbOrganizacion = {
  id: string; nombre: string; nit: string | null;
  contacto_nombre: string | null; contacto_email: string | null; contacto_telefono: string | null;
  activa: boolean;
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

export type DbVacunacion = {
  id: string; finca_id: string; ciclo: 1 | 2; anio: number; fecha: string;
  titulo: string; notas: string | null; animales_count: number | null; pdf_path: string | null;
};

export type DbNacimiento = {
  id: string; finca_id: string; animal_id: string | null; potrero_id: string | null;
  fecha: string; sexo: string;
};

export type DbBaja = {
  id: string; finca_id: string; animal_id: string | null; fecha: string; causa: string;
};

export type AnimalEventoTipo = 'nacimiento' | 'compra' | 'traslado' | 'venta' | 'baja';

export type DbAnimalEvento = {
  id: string; animal_id: string; finca_id: string; tipo: AnimalEventoTipo;
  fecha: string; peso_kg: number | null; finca_origen_id: string | null;
  contraparte: string | null; notas: string | null;
};

export type DbMembresia = {
  id: string; auth_user_id: string; finca_id: string; nombre: string; rol: RoleKey;
};

export async function getMisMembresias(): Promise<DbMembresia[]> {
  // getSession lee la sesión del celular (getUser necesita internet).
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];
  // Explicit filter: superadmins can SELECT every row per RLS, but this
  // helper must only ever return the caller's own memberships.
  const { data } = await supabase.from('membresias').select('*').eq('auth_user_id', user.id);
  return (data ?? []) as DbMembresia[];
}

export async function getIsSuperadmin(): Promise<boolean> {
  const { data } = await supabase.rpc('es_superadmin');
  return data === true;
}

export async function getMembresiasFinca(finca_id: string): Promise<DbMembresia[]> {
  const { data } = await supabase.from('membresias').select('*').eq('finca_id', finca_id).order('nombre');
  return (data ?? []) as DbMembresia[];
}

// ---------- fetch helpers ----------

export async function getFincas(): Promise<DbFinca[]> {
  // Orden custom: Hacienda La Esperanza primero (sede principal con datos completos)
  const { data, error } = await supabase.from('fincas').select('*').eq('activa', true);
  if (error) throw error; // sin señal: quien llama usa la copia del celular
  const sorted = (data ?? []).sort((a, b) => {
    if (a.nombre === 'Hacienda La Esperanza') return -1;
    if (b.nombre === 'Hacienda La Esperanza') return 1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
  return sorted;
}

export async function crearFinca(payload: { nombre: string; ubicacion: string | null; hectareas: number | null; organizacion_id: string | null }): Promise<{ error: string | null; id: string | null }> {
  const { data, error } = await supabase.from('fincas').insert({ ...payload, activa: true }).select('id').single();
  return { error: error?.message ?? null, id: data?.id ?? null };
}

export async function actualizarFinca(finca_id: string, payload: { nombre: string; ubicacion: string | null; hectareas: number | null }): Promise<{ error: string | null }> {
  const { error } = await supabase.from('fincas').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', finca_id);
  return { error: error?.message ?? null };
}

export async function actualizarMembresia(id: string, payload: { nombre?: string; rol?: RoleKey }): Promise<{ error: string | null }> {
  const { error } = await supabase.from('membresias').update(payload).eq('id', id);
  return { error: error?.message ?? null };
}

export async function eliminarMembresia(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('membresias').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function cambiarPassword(password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error?.message ?? null };
}

export async function getOrganizaciones(): Promise<DbOrganizacion[]> {
  const { data } = await supabase.from('organizaciones').select('*').eq('activa', true).order('nombre');
  return (data ?? []) as DbOrganizacion[];
}

export async function crearOrganizacion(payload: { nombre: string; nit: string | null; contacto_nombre: string | null; contacto_email: string | null; contacto_telefono: string | null }): Promise<{ error: string | null; id: string | null }> {
  const { data, error } = await supabase.from('organizaciones').insert({ ...payload, activa: true }).select('id').single();
  return { error: error?.message ?? null, id: data?.id ?? null };
}

export async function getPotreros(finca_id: string): Promise<DbPotrero[]> {
  const { data, error } = await supabase.from('potreros').select('*').eq('finca_id', finca_id).order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function getAnimales(finca_id: string): Promise<DbAnimal[]> {
  const { data, error } = await supabase.from('animales').select('*').eq('finca_id', finca_id).eq('activo', true).order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function getPesajesRecientes(finca_id: string, limit = 10): Promise<DbPesaje[]> {
  const { data } = await supabase.from('pesajes').select('*').eq('finca_id', finca_id).order('fecha', { ascending: false }).limit(limit);
  return data ?? [];
}

export async function getAlertas(finca_id: string): Promise<DbAlerta[]> {
  const { data } = await supabase.from('alertas').select('*').eq('finca_id', finca_id).eq('resuelta', false).order('fecha_vence');
  return data ?? [];
}

export async function getEventos(finca_id: string): Promise<DbEvento[]> {
  const { data } = await supabase.from('eventos').select('*').eq('finca_id', finca_id).gte('fecha', new Date().toISOString().split('T')[0]).order('fecha');
  return data ?? [];
}

export async function getProveedores(finca_id: string): Promise<DbProveedor[]> {
  const { data } = await supabase.from('proveedores').select('*').eq('finca_id', finca_id).eq('activo', true).order('nombre');
  return data ?? [];
}

export async function crearProveedor(payload: {
  finca_id: string; nombre: string; nit: string | null; ciudad: string | null;
  tipo: string | null; telefono: string | null; email: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('proveedores').insert({ ...payload, via_email: false, activo: true });
  return { error: error?.message ?? null };
}

export async function desactivarProveedor(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('proveedores').update({ activo: false }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function getClientes(finca_id: string): Promise<DbCliente[]> {
  const { data } = await supabase.from('clientes').select('*').eq('finca_id', finca_id).eq('activo', true).order('nombre');
  return data ?? [];
}

export async function crearCliente(payload: {
  finca_id: string; nombre: string; nit: string | null; ciudad: string | null;
  tipo: string | null; telefono: string | null; email: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('clientes').insert({ ...payload, activo: true });
  return { error: error?.message ?? null };
}

export async function desactivarCliente(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('clientes').update({ activo: false }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function getGastos(finca_id: string): Promise<DbGasto[]> {
  const { data } = await supabase.from('gastos').select('*').eq('finca_id', finca_id).order('fecha', { ascending: false }).limit(50);
  return data ?? [];
}

export async function crearGasto(payload: {
  finca_id: string; proveedor_id: string | null; concepto: string;
  items_desc: string | null; monto: number; fecha: string; via: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('gastos').insert({ ...payload, nit_proveedor: null, pendiente_sync: false });
  return { error: error?.message ?? null };
}

export async function getMovimientos(finca_id: string): Promise<DbMovimiento[]> {
  const { data } = await supabase.from('movimientos').select('*').eq('finca_id', finca_id).order('fecha', { ascending: false }).limit(30);
  return data ?? [];
}

export async function crearMovimiento(payload: {
  finca_id: string; tipo: 'venta' | 'compra'; fecha: string; contraparte: string | null;
  animales_count: number; categoria: string | null; raza: string | null;
  peso_prom_kg: number | null; precio_kg: number | null; total_cop: number | null;
  costo_cop: number | null; utilidad_cop: number | null; transporte_cop: number | null;
  notas: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('movimientos').insert(payload);
  return { error: error?.message ?? null };
}

export async function getVacunaciones(finca_id: string): Promise<DbVacunacion[]> {
  const { data } = await supabase.from('vacunaciones').select('*').eq('finca_id', finca_id).order('fecha', { ascending: false });
  return (data ?? []) as DbVacunacion[];
}

export async function registrarVacunacion(
  payload: Omit<DbVacunacion, 'id' | 'pdf_path'>,
  pdfFile: File | null,
): Promise<{ error: string | null }> {
  let pdf_path: string | null = null;
  if (pdfFile) {
    const path = `${payload.finca_id}/${Date.now()}-${pdfFile.name}`;
    const { error: uploadErr } = await supabase.storage.from('agrosense-ica').upload(path, pdfFile, { contentType: 'application/pdf' });
    if (uploadErr) return { error: uploadErr.message };
    pdf_path = path;
  }
  const { error } = await supabase.from('vacunaciones').insert({ ...payload, pdf_path });
  return { error: error?.message ?? null };
}

export async function getVacunacionPdfUrl(pdf_path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('agrosense-ica').createSignedUrl(pdf_path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

export async function getNacimientos(finca_id: string): Promise<DbNacimiento[]> {
  const { data } = await supabase.from('nacimientos').select('*').eq('finca_id', finca_id).order('fecha', { ascending: false });
  return (data ?? []) as DbNacimiento[];
}

export async function registrarNacimiento(payload: {
  finca_id: string; potrero_id: string | null; fecha: string; sexo: string;
  arete: string; nombre: string; raza: string; peso_kg: number | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('registrar_animal', {
    p_finca_id: payload.finca_id, p_arete: payload.arete, p_nombre: payload.nombre,
    p_raza: payload.raza, p_sexo: payload.sexo, p_categoria: 'Cría',
    p_potrero_id: payload.potrero_id, p_peso_kg: payload.peso_kg, p_fecha: payload.fecha,
    p_origen: 'nacimiento',
  });
  return { error: error?.message ?? null };
}

export async function getAnimalEventos(animal_id: string): Promise<DbAnimalEvento[]> {
  const { data } = await supabase.from('animal_eventos').select('*').eq('animal_id', animal_id).order('fecha', { ascending: true });
  return (data ?? []) as DbAnimalEvento[];
}

export async function registrarCompraAnimal(payload: {
  finca_id: string; potrero_id: string | null; nombre: string; arete: string;
  raza: string; sexo: string; categoria: string; peso_kg: number | null;
  origen: 'nacio' | 'comprado'; proveedor: string | null; fecha: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('registrar_animal', {
    p_finca_id: payload.finca_id, p_arete: payload.arete, p_nombre: payload.nombre,
    p_raza: payload.raza, p_sexo: payload.sexo, p_categoria: payload.categoria,
    p_potrero_id: payload.potrero_id, p_peso_kg: payload.peso_kg, p_fecha: payload.fecha,
    p_origen: payload.origen === 'nacio' ? 'nacimiento' : 'compra',
    p_contraparte: payload.origen === 'comprado' ? payload.proveedor : null,
  });
  return { error: error?.message ?? null };
}

export async function registrarVenta(payload: {
  animal_id: string; finca_id: string; fecha: string; peso_kg: number | null;
  comprador: string | null; notas: string | null; precio_kg?: number | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('registrar_venta', {
    p_animal_id: payload.animal_id, p_fecha: payload.fecha, p_peso_kg: payload.peso_kg,
    p_precio_kg: payload.precio_kg ?? null, p_comprador: payload.comprador, p_notas: payload.notas,
  });
  return { error: error?.message ?? null };
}

export async function trasladarAnimal(payload: {
  animal_id: string; finca_origen_id: string; finca_destino_id: string; fecha: string; notas: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('trasladar_animal', {
    p_animal_id: payload.animal_id, p_finca_destino_id: payload.finca_destino_id,
    p_fecha: payload.fecha, p_notas: payload.notas,
  });
  return { error: error?.message ?? null };
}

export async function getBajas(finca_id: string): Promise<DbBaja[]> {
  const { data } = await supabase.from('bajas').select('*').eq('finca_id', finca_id).order('fecha', { ascending: false });
  return (data ?? []) as DbBaja[];
}

export async function registrarBaja(payload: { finca_id: string; animal_id: string; fecha: string; causa: string }): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('registrar_baja', {
    p_animal_id: payload.animal_id, p_fecha: payload.fecha, p_causa: payload.causa,
  });
  return { error: error?.message ?? null };
}

// Guarda el pesaje y calcula la GDP en la base con los días reales desde el pesaje anterior.
export async function registrarPesaje(payload: {
  animal_id: string; peso_kg: number; fecha?: string; sesion_id?: string | null;
}): Promise<{ data: DbPesaje | null; error: string | null }> {
  const { data, error } = await supabase.rpc('registrar_pesaje', {
    p_animal_id: payload.animal_id, p_peso_kg: payload.peso_kg,
    p_fecha: payload.fecha ?? new Date().toISOString(), p_sesion_id: payload.sesion_id ?? null,
  });
  return { data: (data as DbPesaje | null) ?? null, error: error?.message ?? null };
}
