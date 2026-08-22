'use client';

interface Props {
  onOpenDrawer: () => void;
}

export default function ReportesScreen({ onOpenDrawer }: Props) {
  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 16px 0' }}>
        <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A2B1A" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div style={{ fontWeight: 800, fontSize: 22 }}>Reportes</div>
      </div>

      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F3F4F6', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6E8A6E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Reportes — próximamente</div>
        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12.5, color: '#9DB39D', maxWidth: 320, margin: '0 auto' }}>
          Todavía no hay reportes exportables. Cuéntame qué reporte necesitas primero (inventario, GDP por potrero, movimientos financieros, vacunación) y lo priorizo.
        </div>
      </div>
    </div>
  );
}
