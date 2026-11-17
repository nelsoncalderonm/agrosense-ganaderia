'use client';

import type { DbFinca } from '@/lib/supabase';
import { useClima } from '@/hooks/useClima';
import { C } from './estilosCampo';

const mm = (v: number | null | undefined) => v == null ? '—' : `${Math.round(v)} mm`;

/** Tarjeta corta del clima para Inicio. Toca para ver el detalle. */
export default function ClimaMini({ finca, onAbrir }: { finca: DbFinca; onAbrir: () => void }) {
  const coords = finca.latitud != null && finca.longitud != null ? `${Number(finca.latitud)},${Number(finca.longitud)}` : '';
  const { data, estado } = useClima(coords ? finca.id : undefined, coords);

  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
    background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 6, padding: '12px 14px', marginTop: 16, color: C.texto,
  };
  const flecha = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.texto} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>;
  const icono = (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.azul} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M20 16.6A5 5 0 0018 7h-1.3A8 8 0 104 15.3"/><path d="M8 19v2M8 13v2M16 19v2M16 13v2M12 21v2M12 15v2"/>
    </svg>
  );

  if (!coords || estado === 'sin_coordenadas') {
    return (
      <button onClick={onAbrir} style={base}>
        {icono}
        <div style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>Ver lluvia y temperatura de la finca<div style={{ fontSize: 15, color: C.suave, fontWeight: 600 }}>Solo falta guardar la ubicación</div></div>
        {flecha}
      </button>
    );
  }
  if (!data) {
    return <button onClick={onAbrir} style={base}>{icono}<div style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>{estado === 'cargando' ? 'Cargando clima…' : 'Clima no disponible'}</div>{flecha}</button>;
  }
  return (
    <button onClick={onAbrir} style={base}>
      {icono}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          {data.ahora.temp != null ? `${Math.round(data.ahora.temp)}° ahora` : 'Clima'}
          {data.hoy?.lluvia_mm != null && <span style={{ color: C.azul }}> · hoy {mm(data.hoy.lluvia_mm)}</span>}
        </div>
        <div style={{ fontSize: 15, color: C.suave, fontWeight: 700, marginTop: 2 }}>
          Lluvia: últimos 7 días {mm(data.lluvia.ultimos_7)} · próximos 7 días {mm(data.lluvia.proximos_7)}
        </div>
      </div>
      {flecha}
    </button>
  );
}
