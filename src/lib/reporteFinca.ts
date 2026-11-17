import 'server-only';
import { esc, fechaCorta } from '@/lib/telegram';

// Forma del JSON que devuelve agrosense.reporte_finca(finca, desde, hasta).
type AnimalRank = { arete: string; nombre: string | null; gdp: number; peso_kg: number };
type Trabajador = { nombre: string; rol: string; pesajes: number; sesiones: number; tareas: number; total: number };
export type ReporteFinca = {
  finca: { id: string; nombre: string };
  desde: string; hasta: string; dias: number;
  inventario: { total: number; por_categoria: Record<string, number>; peso_promedio: number | null };
  produccion: {
    pesajes: number; animales_pesados: number;
    gdp_promedio: number | null; gdp_promedio_anterior: number | null; kg_ganados: number | null;
    mejores: AnimalRank[]; peores: AnimalRank[]; gdp_bajo_umbral: number;
  };
  hato: { compras: number; nacimientos: number; traslados_entrada: number; traslados_salida: number; ventas: number; kg_vendidos: number; bajas: number };
  agenda: { completadas: number; vencidas: number; proxima_semana: number };
  mano_de_obra: Trabajador[];
};

const GDP_BAJA = 0.4; // kg/día, igual que gdp_bajo_umbral en agrosense.reporte_finca

const ROLES: Record<string, string> = { owner: 'Propietario', admin: 'Administrador', contable: 'Contable', vaquero: 'Vaquero' };

const n0 = (v: number | null | undefined) => (v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const n1 = (v: number | null | undefined) => (v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const kgDia = (v: number | null | undefined) => v == null ? 's/d' : `${(v * 1000).toLocaleString('es-CO', { maximumFractionDigits: 0 })} g/día`;
const animal = (a: AnimalRank) => `${esc(a.arete)}${a.nombre ? ` (${esc(a.nombre)})` : ''}`;

function flecha(actual: number | null, anterior: number | null): string {
  if (actual == null || anterior == null || anterior === 0) return '';
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  if (Math.abs(pct) < 1) return ' (igual que la semana anterior)';
  return ` (${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% vs. semana anterior)`;
}

export function formatearReporte(r: ReporteFinca, titulo = 'Reporte semanal'): string {
  const p = r.produccion, h = r.hato, a = r.agenda;
  const out: string[] = [];

  out.push(`🐂 <b>Ganado al Día · ${esc(titulo)}</b>`);
  out.push(`<b>${esc(r.finca.nombre)}</b>`);
  out.push(`${fechaCorta(r.desde)} al ${fechaCorta(r.hasta)}`);

  // Producción
  out.push('', '<b>📈 Producción</b>');
  if (p.pesajes === 0) {
    out.push('No se registraron pesajes en este periodo.');
  } else {
    out.push(`• ${n0(p.pesajes)} pesajes de ${n0(p.animales_pesados)} animales`);
    out.push(`• GDP promedio: <b>${kgDia(p.gdp_promedio)}</b>${flecha(p.gdp_promedio, p.gdp_promedio_anterior)}`);
    if (p.kg_ganados != null) out.push(`• Kilos ganados (desde el pesaje anterior): <b>${n1(p.kg_ganados)} kg</b>`);
    if (p.mejores.length) {
      out.push('', '<i>Mejores GDP</i>');
      p.mejores.forEach(x => out.push(`  ${animal(x)}: ${kgDia(x.gdp)}`));
    }
    // Los que no están engordando: menos de 400 g/día o bajando de peso. Es plata que se pierde callada.
    const mejoresIds = new Set(p.mejores.map(x => x.arete));
    const flojos = p.peores.filter(x => !mejoresIds.has(x.arete) && x.gdp < GDP_BAJA);
    if (flojos.length) {
      out.push('', `<b>🚨 No están engordando (${p.gdp_bajo_umbral})</b>`);
      out.push('Revíselos: parásitos, cojera o potrero.');
      flojos.forEach(x => out.push(`  ${animal(x)}: ${x.gdp < 0 ? `bajó ${n0(-x.gdp * 1000)} g/día ⚠️` : `gana ${n0(x.gdp * 1000)} g/día`}`));
      if (p.gdp_bajo_umbral > flojos.length) out.push(`  …y ${p.gdp_bajo_umbral - flojos.length} más. Véalos en la app.`);
    } else if (p.pesajes > 0) {
      out.push('', '✅ Todos los animales pesados están engordando bien.');
    }
  }

  // Hato
  out.push('', '<b>🐄 Inventario</b>');
  const cats = Object.entries(r.inventario.por_categoria).map(([k, v]) => `${esc(k)} ${v}`).join(' · ');
  out.push(`• ${n0(r.inventario.total)} animales activos${cats ? ` (${cats})` : ''}`);
  if (r.inventario.peso_promedio != null) out.push(`• Peso promedio: ${n1(r.inventario.peso_promedio)} kg`);
  const mov: string[] = [];
  if (h.compras) mov.push(`${h.compras} compra(s)`);
  if (h.nacimientos) mov.push(`${h.nacimientos} nacimiento(s)`);
  if (h.traslados_entrada) mov.push(`${h.traslados_entrada} llegaron por traslado`);
  if (h.traslados_salida) mov.push(`${h.traslados_salida} salieron por traslado`);
  if (h.ventas) mov.push(`${h.ventas} venta(s), ${n0(h.kg_vendidos)} kg`);
  if (h.bajas) mov.push(`${h.bajas} baja(s) ⚠️`);
  out.push(`• Movimientos: ${mov.length ? mov.join(', ') : 'ninguno'}`);

  // Mano de obra
  out.push('', '<b>👷 Mano de obra</b>');
  const equipo = r.mano_de_obra.filter(t => t.rol !== 'contable');
  if (!equipo.length) out.push('No hay trabajadores registrados en la finca.');
  equipo.forEach(t => {
    const partes: string[] = [];
    if (t.pesajes) partes.push(`${t.pesajes} pesajes${t.sesiones ? ` en ${t.sesiones} sesión(es)` : ''}`);
    if (t.tareas) partes.push(`${t.tareas} tarea(s)`);
    const sinNada = t.total === 0 && t.rol === 'vaquero';
    out.push(`• ${esc(t.nombre)} <i>(${ROLES[t.rol] ?? esc(t.rol)})</i>: ${partes.length ? partes.join(', ') : 'sin registros'}${sinNada ? ' ⚠️' : ''}`);
  });
  out.push(`• Agenda: ${a.completadas} tarea(s) completada(s), ${a.vencidas} vencida(s) sin hacer, ${a.proxima_semana} para la próxima semana`);

  return out.join('\n');
}
