'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Animal, RoleKey, money } from '@/data/agrosense';
import { DbGasto, DbMovimiento } from '@/lib/supabase';

interface Props {
  onOpenDrawer: () => void;
  role: RoleKey;
  fincaNombre: string;
  animals: Animal[];
  gastos: DbGasto[];
  movimientos: DbMovimiento[];
}

const CAT_LABEL: Record<Animal['cat'], string> = { Levante: 'Levante', Ceba: 'Ceba', Cría: 'Cría' };

function pdfHeader(doc: jsPDF, titulo: string, fincaNombre: string, subtitulo?: string) {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AgroSense — ' + titulo, 40, 44);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(fincaNombre, 40, 62);
  if (subtitulo) doc.text(subtitulo, 40, 78);
  doc.text('Generado ' + new Date().toLocaleString('es-CO'), 40, subtitulo ? 94 : 78);
  doc.setTextColor(0);
}

function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

function generarInventarioPdf(fincaNombre: string, animals: Animal[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  pdfHeader(doc, 'Inventario de animales', fincaNombre, `${animals.length} animales · corte al ${new Date().toLocaleDateString('es-CO')}`);
  autoTable(doc, {
    startY: 105,
    head: [['Arete', 'Nombre', 'Raza', 'Sexo', 'Categoría', 'Peso (kg)', 'GDP (kg/d)', 'Potrero', 'Días', 'Estado']],
    body: animals.map(a => [
      a.arete, a.nombre, a.raza, a.sexo, CAT_LABEL[a.cat],
      a.peso.toString(), a.gdp.toFixed(2), a.potrero, a.dias.toString(), a.estadoCorto,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [21, 163, 74] },
  });
  downloadPdf(doc, `inventario-${fincaNombre.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function generarMovimientosPdf(fincaNombre: string, gastos: DbGasto[], movimientos: DbMovimiento[], desde: string, hasta: string) {
  const inRange = (fecha: string) => fecha.slice(0, 10) >= desde && fecha.slice(0, 10) <= hasta;
  const gastosF = gastos.filter(g => inRange(g.fecha));
  const movsF = movimientos.filter(m => inRange(m.fecha));
  const totalGastos = gastosF.reduce((s, g) => s + g.monto, 0);
  const totalVentas = movsF.filter(m => m.tipo === 'venta').reduce((s, m) => s + (m.total_cop ?? 0), 0);
  const totalCompras = movsF.filter(m => m.tipo === 'compra').reduce((s, m) => s + (m.costo_cop ?? 0), 0);

  const doc = new jsPDF();
  pdfHeader(doc, 'Movimientos financieros', fincaNombre, `Del ${desde} al ${hasta}`);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Gastos: ${money(totalGastos)}   Ventas: ${money(totalVentas)}   Compras: ${money(totalCompras)}`, 40, 100);

  autoTable(doc, {
    startY: 115,
    head: [['Fecha', 'Concepto', 'Vía', 'Monto']],
    body: gastosF.map(g => [g.fecha.slice(0, 10), g.concepto, g.via, money(g.monto)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [220, 38, 38] },
    didDrawPage: () => { doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text('Gastos', 40, 108); },
  });

  const afterGastos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Movimientos de ganado (compras/ventas)', 40, afterGastos);
  autoTable(doc, {
    startY: afterGastos + 8,
    head: [['Fecha', 'Tipo', 'Contraparte', 'Animales', 'Total']],
    body: movsF.map(m => [
      m.fecha.slice(0, 10), m.tipo, m.contraparte ?? '—', m.animales_count.toString(),
      money(m.tipo === 'venta' ? (m.total_cop ?? 0) : (m.costo_cop ?? 0)),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  downloadPdf(doc, `movimientos-${fincaNombre.replace(/\s+/g, '_')}-${desde}_a_${hasta}.pdf`);
}

export default function ReportesScreen({ onOpenDrawer, role, fincaNombre, animals, gastos, movimientos }: Props) {
  const canFinanzas = role === 'owner' || role === 'contable';
  const hoy = new Date().toISOString().slice(0, 10);
  const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy);

  const inp: React.CSSProperties = {
    height: 42, border: '1px solid #C5D2C0', borderRadius: 4,
    padding: '0 12px', fontSize: 14, background: '#fff', outline: 'none',
    fontFamily: 'inherit', color: '#1A2B1A', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, color: '#6E8A6E', fontWeight: 700, letterSpacing: '.5px',
    marginBottom: 4, display: 'block',
  };
  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #E1E8DD', borderRadius: 6, padding: 18,
  };

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 16px 0' }}>
        <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A2B1A" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div style={{ fontWeight: 800, fontSize: 22 }}>Reportes</div>
      </div>

      <div className="ag-list-grid" style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15A34A" strokeWidth="1.8" strokeLinecap="round"><ellipse cx="12" cy="14" rx="7" ry="5"/><path d="M8 9 Q7 6 5 5M16 9 Q17 6 19 5"/></svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Inventario de animales</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: '#9DB39D' }}>{animals.length} animales activos · foto actual del hato</div>
            </div>
          </div>
          <button
            onClick={() => generarInventarioPdf(fincaNombre, animals)}
            disabled={animals.length === 0}
            style={{ width: '100%', height: 44, border: 'none', borderRadius: 4, background: animals.length === 0 ? '#6E8A6E' : '#15A34A', color: '#fff', fontWeight: 800, fontSize: 13, cursor: animals.length === 0 ? 'default' : 'pointer' }}
          >
            Generar PDF
          </button>
        </div>

        {canFinanzas ? (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Movimientos financieros</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: '#9DB39D' }}>Gastos, compras y ventas del período</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div><label style={lbl}>DESDE</label>
              <input style={{ ...inp, width: '100%' }} type="date" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div><label style={lbl}>HASTA</label>
              <input style={{ ...inp, width: '100%' }} type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde} />
            </div>
          </div>
          <button
            onClick={() => generarMovimientosPdf(fincaNombre, gastos, movimientos, desde, hasta)}
            style={{ width: '100%', height: 44, border: 'none', borderRadius: 4, background: '#2563EB', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            Generar PDF
          </button>
        </div>
        ) : (
        <div style={{ ...card, textAlign: 'center', color: '#9DB39D' }}>
          <div style={{ fontSize: 12.5, fontFamily: 'var(--font-jetbrains)' }}>Tu rol no tiene acceso al reporte financiero.</div>
        </div>
        )}
      </div>
    </div>
  );
}
