'use client';

import { DbFinca } from '@/lib/supabase';

interface Props {
  open: boolean;
  fincas: DbFinca[];
  currentIdx: number;
  onSelect: (idx: number) => void;
  onClose: () => void;
}

export default function FincaPicker({ open, fincas, currentIdx, onSelect, onClose }: Props) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 40 }} />
      <div className="animate-slide-up ag-sheet-desktop" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#EEF2EC', borderRadius: '16px 16px 0 0', zIndex: 50, paddingBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#8FA38A' }} />
        </div>
        <div style={{ padding: '4px 20px 14px', borderBottom: '1px solid #B9C6B4' }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Seleccionar finca</div>
        </div>
        <div style={{ padding: '8px 12px' }}>
          {fincas.map((f, idx) => {
            const ini = f.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const active = idx === currentIdx;
            return (
              <button key={f.id} onClick={() => onSelect(idx)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 12px', borderRadius: 8,
                background: active ? '#F0FDF4' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: active ? '#DCFCE7' : '#EDF1EA', border: active ? '1.5px solid #15803D' : '1px solid #B9C6B4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: active ? '#15803D' : '#3A4D3A', flexShrink: 0 }}>{ini}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 19 }}>{f.nombre}</div>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#3A4D3A', marginTop: 2 }}>{f.ubicacion ?? ''} · {f.hectareas ?? 0} ha</div>
                </div>
                {active && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
