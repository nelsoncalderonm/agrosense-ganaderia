import 'server-only';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReporteFinca } from '@/lib/reporteFinca';

// PDF del reporte semanal (carta, una o dos páginas). Se adjunta al mensaje de Telegram.

const VERDE: [number, number, number] = [21, 163, 74];
const OSCURO: [number, number, number] = [26, 43, 26];
const GRIS: [number, number, number] = [110, 138, 110];
const ROJO: [number, number, number] = [220, 38, 38];
const ROLES: Record<string, string> = { owner: 'Propietario', admin: 'Administrador', contable: 'Contable', vaquero: 'Vaquero' };

const n0 = (v: number | null | undefined) => (v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const n1 = (v: number | null | undefined) => (v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const gdia = (v: number | null | undefined) => v == null ? 's/d' : `${Math.round(v * 1000).toLocaleString('es-CO')} g/día`;
const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (f: string) => { const [y, m, d] = f.split('-').map(Number); return `${d} de ${meses[m - 1]} de ${y}`; };

type DocConTabla = jsPDF & { lastAutoTable?: { finalY: number } };

export function nombreArchivoReporte(r: ReporteFinca): string {
  const finca = r.finca.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `Reporte-${finca}-${r.desde}.pdf`;
}

export function generarPdfReporte(r: ReporteFinca, titulo = 'Reporte semanal'): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }) as DocConTabla;
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 0;

  // Encabezado
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, W, 78, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('Ganado al Día', M, 34);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(`${titulo} · ${fechaLarga(r.desde)} al ${fechaLarga(r.hasta)}`, M, 56);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(r.finca.nombre, W - M, 34, { align: 'right' });
  y = 104;

  // Indicadores principales
  const p = r.produccion;
  const cambio = p.gdp_promedio != null && p.gdp_promedio_anterior
    ? ((p.gdp_promedio - p.gdp_promedio_anterior) / Math.abs(p.gdp_promedio_anterior)) * 100 : null;
  const kpis: { t: string; v: string; s?: string; color?: [number, number, number] }[] = [
    { t: 'GDP PROMEDIO', v: gdia(p.gdp_promedio),
      s: cambio == null ? 'sin semana anterior' : `${cambio >= 0 ? '+' : ''}${cambio.toFixed(0)}% vs. semana anterior`,
      color: cambio == null ? GRIS : cambio >= 0 ? VERDE : ROJO },
    { t: 'KILOS GANADOS', v: p.kg_ganados == null ? 's/d' : `${n1(p.kg_ganados)} kg`, s: `${n0(p.animales_pesados)} animales pesados` },
    { t: 'ANIMALES ACTIVOS', v: n0(r.inventario.total), s: r.inventario.peso_promedio != null ? `peso prom. ${n1(r.inventario.peso_promedio)} kg` : '' },
    { t: 'BAJO 400 g/DÍA', v: n0(p.gdp_bajo_umbral), s: 'animales para revisar', color: p.gdp_bajo_umbral > 0 ? ROJO : GRIS },
  ];
  const cw = (W - 2 * M - 3 * 10) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (cw + 10);
    doc.setFillColor(243, 247, 241); doc.roundedRect(x, y, cw, 66, 4, 4, 'F');
    doc.setTextColor(...GRIS); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(k.t, x + 10, y + 16);
    doc.setTextColor(...OSCURO); doc.setFontSize(16); doc.text(k.v, x + 10, y + 38);
    if (k.s) { doc.setTextColor(...(k.color ?? GRIS)); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(k.s, x + 10, y + 54); }
  });
  y += 90;

  const seccion = (t: string) => {
    if (y > 700) { doc.addPage(); y = 50; }
    doc.setTextColor(...OSCURO); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(t, M, y); y += 8;
  };
  const tabla = (head: string[], body: (string | number)[][], opts: { rojoCol?: number } = {}) => {
    autoTable(doc, {
      startY: y, head: [head], body: body.map(f => f.map(String)),
      margin: { left: M, right: M }, styles: { fontSize: 9, cellPadding: 5, textColor: OSCURO },
      headStyles: { fillColor: OSCURO, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 247] },
      didParseCell: d => {
        if (opts.rojoCol != null && d.section === 'body' && d.column.index === opts.rojoCol && String(d.cell.raw).includes('⚠')) {
          d.cell.styles.textColor = ROJO; d.cell.text = [String(d.cell.raw).replace(' ⚠', '')];
        }
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 22;
  };

  // Producción
  seccion('Producción');
  if (p.pesajes === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GRIS);
    doc.text('No se registraron pesajes en este periodo.', M, y + 10); y += 32;
  } else {
    const aretesMejores = new Set(p.mejores.map(a => a.arete));
    const peores = p.peores.filter(a => !aretesMejores.has(a.arete));
    const filas = Math.max(p.mejores.length, peores.length);
    const body: string[][] = [];
    for (let i = 0; i < filas; i++) {
      const m = p.mejores[i], w = peores[i];
      body.push([
        m ? `${m.arete}${m.nombre ? ` (${m.nombre})` : ''}` : '', m ? gdia(m.gdp) : '',
        w ? `${w.arete}${w.nombre ? ` (${w.nombre})` : ''}` : '', w ? `${gdia(w.gdp)}${w.gdp < 0.4 ? ' ⚠' : ''}` : '',
      ]);
    }
    tabla(['Mejores animales', 'GDP', 'Para revisar', 'GDP'], body, { rojoCol: 3 });
  }

  // Inventario y movimientos
  seccion('Inventario y movimientos');
  const h = r.hato;
  const cats = Object.entries(r.inventario.por_categoria).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—';
  tabla(['Concepto', 'Cantidad'], [
    ['Animales activos', `${n0(r.inventario.total)} (${cats})`],
    ['Compras', n0(h.compras)],
    ['Nacimientos', n0(h.nacimientos)],
    ['Llegaron por traslado', n0(h.traslados_entrada)],
    ['Salieron por traslado', n0(h.traslados_salida)],
    ['Ventas', h.ventas ? `${n0(h.ventas)} (${n0(h.kg_vendidos)} kg)` : '0'],
    ['Bajas (muertes)', h.bajas ? `${n0(h.bajas)} ⚠` : '0'],
  ], { rojoCol: 1 });

  // Mano de obra
  seccion('Mano de obra');
  const equipo = r.mano_de_obra.filter(t => t.rol !== 'contable');
  tabla(['Persona', 'Rol', 'Pesajes', 'Sesiones', 'Tareas', 'Estado'], equipo.map(t => [
    t.nombre, ROLES[t.rol] ?? t.rol, n0(t.pesajes), n0(t.sesiones), n0(t.tareas),
    t.total === 0 && t.rol === 'vaquero' ? 'Sin registros ⚠' : t.total === 0 ? '—' : 'Activo',
  ]), { rojoCol: 5 });
  const a = r.agenda;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...OSCURO);
  doc.text(`Agenda: ${a.completadas} tareas completadas · ${a.vencidas} vencidas sin hacer · ${a.proxima_semana} para la próxima semana`, M, y - 6);

  // Pie
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setFontSize(8); doc.setTextColor(...GRIS); doc.setFont('helvetica', 'normal');
    doc.text('Ganado al Día · reporte generado automáticamente con los registros de la finca', M, H - 24);
    doc.text(`${i} / ${pages}`, W - M, H - 24, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
