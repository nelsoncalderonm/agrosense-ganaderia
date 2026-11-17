'use client';

import type { ReactNode } from 'react';

export default function EncabezadoPantalla({ titulo, onOpenDrawer, onVolver, derecha }: {
  titulo: string; onOpenDrawer?: () => void; onVolver?: () => void; derecha?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 16px 0' }}>
      {onVolver ? (
        <button onClick={onVolver} aria-label="Volver" style={{ width: 44, height: 44, marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F1A0F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      ) : onOpenDrawer ? (
        <button onClick={onOpenDrawer} aria-label="Menú" className="ag-hamburger" style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F1A0F" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      ) : null}
      <div style={{ fontWeight: 800, fontSize: 25, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</div>
      {derecha}
    </div>
  );
}
