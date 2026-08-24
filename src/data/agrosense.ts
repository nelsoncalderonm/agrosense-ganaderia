export type EstadoKey = 'green' | 'amber' | 'red' | 'blue';
export type RoleKey = 'owner' | 'admin' | 'vaquero' | 'contable';
export type Tab = 'inicio' | 'animales' | 'rfid' | 'agenda' | 'finanzas' | 'admin' | 'reportes' | 'ajustes';
export type CatKey = 'Levante' | 'Ceba' | 'Cría';

export const ESTADO: Record<EstadoKey, { hex: string; soft: string }> = {
  green: { hex: '#15A34A', soft: '#DCFCE7' },
  amber: { hex: '#D97706', soft: '#FEF3C7' },
  red:   { hex: '#DC2626', soft: '#FEE2E2' },
  blue:  { hex: '#2563EB', soft: '#DBEAFE' },
};

export const CAT: Record<CatKey, { hex: string; soft: string }> = {
  Levante: { hex: '#2563EB', soft: '#DBEAFE' },
  Ceba:    { hex: '#15A34A', soft: '#DCFCE7' },
  Cría:    { hex: '#D97706', soft: '#FEF3C7' },
};

export interface Animal {
  nombre: string; id: string; dbId: string; arete: string; raza: string;
  sexo: string; sx: string; cat: CatKey; peso: number;
  gdp: number; gdpDelta: number; potrero: string; estado: EstadoKey;
  dias: number; pesoAnt: number; diasEnt: number;
  estadoTxt: string; estadoCorto: string;
}

export interface Potrero {
  nombre: string; animales: number; cap: number;
  ha: number; aforo: number; estado: string; dias: number;
}

export interface Finca {
  key: string; nombre: string; ubic: string; ini: string;
  animales: number; kgProm: number; alertas: number; ha: number;
  valorCop: number; gananciaPct: number; gdpProm: number; gananciaMesKg: number;
  comp: Record<CatKey, number>;
  mov: { nacimientos: number; muertes: number; compras: number; ventas: number };
  potreros: Potrero[];
}

export interface Proveedor {
  id: string; nombre: string; nit: string; ciudad: string;
  tipo: string; tel: string; facturas: number; totalMes: number; viaEmail: boolean;
}

export interface Cliente {
  id: string; nombre: string; nit: string; ciudad: string;
  tipo: string; tel: string; ventas: number; totalMes: number; ultimaVenta: string;
}

export interface Factura {
  prov: string; nit: string; monto: number; fecha: string; items: string;
}

export interface MovGanado {
  id: string; tipo: 'venta' | 'compra'; fecha: string; contraparte: string;
  animales: number; categoria: string; raza: string; pesoPromKg: number;
  precioKg?: number; totalCop?: number; costoCop?: number; utilidadCop?: number;
  totalGanadoCop?: number; transporte?: number; totalAdqCop?: number;
  gdpEst?: number; diasDesde?: number; precioMercadoKg?: number;
}

export const FINCAS: Finca[] = [
  { key:'esperanza', nombre:'Hacienda La Esperanza', ubic:'Montería, Córdoba',     ini:'HE', animales:248, kgProm:462, alertas:3, ha:340, valorCop:1184000000, gananciaPct:4.2, gdpProm:0.78, gananciaMesKg:7440,
    comp:{ Levante:78, Ceba:96, Cría:74 }, mov:{ nacimientos:12, muertes:2, compras:0, ventas:18 },
    potreros:[ {nombre:'El Guayabo', animales:92, cap:100, ha:88, aforo:2.6, estado:'Pastoreo', dias:9}, {nombre:'La Ceiba', animales:68, cap:80, ha:74, aforo:2.1, estado:'Pastoreo', dias:14}, {nombre:'La Palma', animales:54, cap:70, ha:66, aforo:1.8, estado:'Descanso', dias:22}, {nombre:'El Naranjo', animales:34, cap:60, ha:58, aforo:3.0, estado:'Descanso', dias:31}, {nombre:'Reserva', animales:0, cap:54, ha:54, aforo:3.4, estado:'Descanso', dias:45} ] },
  { key:'palmar', nombre:'Finca El Palmar', ubic:'Planeta Rica, Córdoba', ini:'EP', animales:163, kgProm:438, alertas:1, ha:215, valorCop:712000000, gananciaPct:3.1, gdpProm:0.71, gananciaMesKg:4180,
    comp:{ Levante:52, Ceba:61, Cría:50 }, mov:{ nacimientos:7, muertes:1, compras:14, ventas:9 },
    potreros:[ {nombre:'La Cumbre', animales:61, cap:70, ha:62, aforo:2.4, estado:'Pastoreo', dias:7}, {nombre:'El Limón', animales:48, cap:60, ha:58, aforo:2.0, estado:'Pastoreo', dias:12}, {nombre:'Bajo Grande', animales:34, cap:50, ha:48, aforo:1.7, estado:'Descanso', dias:25}, {nombre:'La Sombra', animales:20, cap:47, ha:47, aforo:2.9, estado:'Descanso', dias:38} ] },
  { key:'brisas', nombre:'Las Brisas', ubic:'Sahagún, Córdoba', ini:'LB', animales:97, kgProm:495, alertas:2, ha:158, valorCop:498000000, gananciaPct:5.0, gdpProm:0.86, gananciaMesKg:2610,
    comp:{ Levante:28, Ceba:40, Cría:29 }, mov:{ nacimientos:5, muertes:0, compras:0, ventas:4 },
    potreros:[ {nombre:'El Mirador', animales:44, cap:55, ha:52, aforo:2.7, estado:'Pastoreo', dias:6}, {nombre:'Los Mangos', animales:33, cap:45, ha:44, aforo:2.2, estado:'Pastoreo', dias:11}, {nombre:'La Loma', animales:20, cap:40, ha:38, aforo:1.9, estado:'Descanso', dias:24}, {nombre:'El Edén', animales:0, cap:24, ha:24, aforo:3.2, estado:'Descanso', dias:40} ] },
];

export const PROVEEDORES: Proveedor[] = [
  { id:'p1', nombre:'Agroinsumos del Sinú',      nit:'NIT 900.123.456', ciudad:'Montería, Cba.',     tipo:'Insumos',    tel:'320 456 7890', facturas:5, totalMes:2150000,  viaEmail:true },
  { id:'p2', nombre:'Almacén El Ganadero',        nit:'NIT 811.045.221', ciudad:'Montería, Cba.',     tipo:'Insumos',    tel:'310 234 5678', facturas:3, totalMes:1380000,  viaEmail:true },
  { id:'p3', nombre:'Distribuidora La 14',         nit:'NIT 901.778.003', ciudad:'Montería, Cba.',     tipo:'Insumos',    tel:'304 567 8901', facturas:2, totalMes:960000,   viaEmail:true },
  { id:'p4', nombre:'Comercializadora Montería',   nit:'NIT 900.445.887', ciudad:'Montería, Cba.',     tipo:'Insumos',    tel:'300 112 3344', facturas:4, totalMes:3680000,  viaEmail:false },
  { id:'p5', nombre:'Ganadería Los Alpes',          nit:'NIT 800.234.567', ciudad:'San Pelayo, Cba.',   tipo:'Ganado',     tel:'312 678 9001', facturas:1, totalMes:12400000, viaEmail:false },
  { id:'p6', nombre:'Transporte Córdoba',           nit:'NIT 812.334.100', ciudad:'Montería, Cba.',     tipo:'Transporte', tel:'315 890 1234', facturas:2, totalMes:1350000,  viaEmail:false },
];

export const CLIENTES: Cliente[] = [
  { id:'c1', nombre:'Frigorífico Vijagual',         nit:'NIT 900.001.234', ciudad:'Bucaramanga, San.',  tipo:'Frigorífico', tel:'607 680 0000', ventas:18, totalMes:54000000, ultimaVenta:'12 jun' },
  { id:'c2', nombre:'Subasta Ganadera del Sinú',    nit:'NIT 820.003.456', ciudad:'Montería, Cba.',     tipo:'Subasta',     tel:'604 782 3344', ventas:6,  totalMes:16800000, ultimaVenta:'5 jun' },
  { id:'c3', nombre:'Carnes Finas del Caribe',      nit:'NIT 901.445.002', ciudad:'Barranquilla, Atl.', tipo:'Distribuidor',tel:'605 358 9900', ventas:2,  totalMes:7400000,  ultimaVenta:'28 may' },
];

export const FACTURAS: Factura[] = [
  { prov:'Agroinsumos del Sinú',           nit:'NIT 900.123.456', monto:2150000, fecha:'17 jun', items:'Vacuna aftosa x120 · jeringas' },
  { prov:'Almacén El Ganadero',             nit:'NIT 811.045.221', monto:1380000, fecha:'15 jun', items:'Sal mineralizada x40 bultos' },
  { prov:'Distribuidora La 14',              nit:'NIT 901.778.003', monto:960000,  fecha:'14 jun', items:'Concentrado levante x25' },
  { prov:'Inversiones Agropecuarias S.A.',  nit:'NIT 901.990.112', monto:4200000, fecha:'18 jun', items:'20 novillos cebados · Planeta Rica' },
];

export const COMPRAS_BASE = [
  { prov:'Comercializadora Montería', monto:3680000, fecha:'10 jun', items:'Concentrado y suplemento', via:'Manual' },
  { prov:'Veterinaria San Jorge',      monto:540000,  fecha:'6 jun',  items:'Antibióticos, desparasitante', via:'Electrónica' },
  { prov:'Transporte Córdoba',         monto:1350000, fecha:'4 jun',  items:'Flete de ganado', via:'Manual' },
];

export const MOVIMIENTOS_GANADO: MovGanado[] = [
  { id:'v1', tipo:'venta',  fecha:'12 jun', contraparte:'Frigorífico Vijagual',       animales:18, categoria:'Ceba',    raza:'Brahman · Brangus', pesoPromKg:518, precioKg:8400, totalCop:78573600, costoCop:52800000, utilidadCop:25773600 },
  { id:'v2', tipo:'venta',  fecha:'5 jun',  contraparte:'Subasta Ganadera del Sinú', animales:6,  categoria:'Ceba',    raza:'Cebú',           pesoPromKg:492, precioKg:8100, totalCop:23911200, costoCop:17200000, utilidadCop:6711200 },
  { id:'v3', tipo:'venta',  fecha:'28 may', contraparte:'Carnes Finas del Caribe',    animales:2,  categoria:'Ceba',    raza:'Gyr',             pesoPromKg:502, precioKg:8000, totalCop:8032000,  costoCop:5600000,  utilidadCop:2432000 },
  { id:'c1', tipo:'compra', fecha:'2 jun',  contraparte:'Ganadería Los Alpes',       animales:20, categoria:'Levante', raza:'Brahman',         pesoPromKg:278, precioKg:6800, totalGanadoCop:37768000, transporte:380000, totalAdqCop:38148000, gdpEst:0.82, diasDesde:16, precioMercadoKg:7200 },
  { id:'c2', tipo:'compra', fecha:'28 may', contraparte:'Finca El Progreso',          animales:14, categoria:'Levante', raza:'Cebú',          pesoPromKg:265, precioKg:6500, totalGanadoCop:24115000, transporte:290000, totalAdqCop:24405000, gdpEst:0.76, diasDesde:21, precioMercadoKg:7200 },
];

export const RFID_RECENT = [
  { nombre:'Tormenta', id:'·190', peso:467, estado:'green' as EstadoKey },
  { nombre:'Manchas',  id:'·012', peso:389, estado:'amber' as EstadoKey },
  { nombre:'Rayo',     id:'·233', peso:502, estado:'green' as EstadoKey },
  { nombre:'Perla',    id:'·690', peso:421, estado:'amber' as EstadoKey },
  { nombre:'Bravo',    id:'·301', peso:612, estado:'green' as EstadoKey },
];

export const AGENDA_EVENTS = [
  { fecha: 19, mes: 'jun', tipo: 'Vacunación', titulo: 'Vacuna aftosa – Lote Ceba', sub: '96 animales · El Guayabo y La Ceiba', hex: '#15A34A', soft: '#DCFCE7', dias: 'Hoy' },
  { fecha: 22, mes: 'jun', tipo: 'Pesaje', titulo: 'Pesaje programado – Levante', sub: '78 animales · La Palma', hex: '#2563EB', soft: '#DBEAFE', dias: '3 días' },
  { fecha: 25, mes: 'jun', tipo: 'Sanidad', titulo: 'Desparasitación preventiva', sub: 'Todos los terneros · La Palma', hex: '#D97706', soft: '#FEF3C7', dias: '6 días' },
  { fecha: 28, mes: 'jun', tipo: 'Pesaje', titulo: 'Pesaje Cría – La Ceiba', sub: '74 animales · peso al destete', hex: '#2563EB', soft: '#DBEAFE', dias: '9 días' },
  { fecha: 5,  mes: 'jul', tipo: 'Rotación', titulo: 'Rotación de potreros', sub: 'El Guayabo → La Palma', hex: '#15A34A', soft: '#DCFCE7', dias: '16 días' },
];

export const ALERTAS = [
  { title: 'Vacuna aftosa próxima', sub: 'Perla · ·690 · vence en 5 días', hex: '#D97706', soft: '#FEF3C7', meta: '5 días' },
  { title: 'GDP bajo · revisar', sub: 'Manchas · ·012 · 0.42 kg/d', hex: '#DC2626', soft: '#FEE2E2', meta: 'Crítico' },
  { title: 'Período de retiro activo', sub: 'Canela · ·744 · 19 días restantes', hex: '#DC2626', soft: '#FEE2E2', meta: '19 días' },
];

export const WEIGHT_DATA = {
  '1M': [420, 428, 433, 440, 447, 453, 459, 462],
  '3M': [398, 408, 416, 425, 435, 442, 450, 455, 460, 462],
  '6M': [362, 374, 386, 398, 408, 416, 425, 435, 442, 450, 455, 460, 462],
};

export function money(n: number): string {
  return '$' + n.toLocaleString('es-CO');
}

export function gHexFor(g: number): string {
  if (g <= 0) return '#DC2626';
  if (g < 0.5) return '#D97706';
  return '#15A34A';
}

export function gdpTxt(g: number): string {
  return g.toFixed(2);
}

export function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}
