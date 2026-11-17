// Estilos compartidos de las pantallas nuevas (clima, potreros, suelos),
// con la misma línea del rediseño de campo: letra grande y alto contraste.
import type { CSSProperties } from 'react';

export const C = {
  texto: '#0F1A0F', suave: '#3A4D3A', borde: '#B9C6B4', bordeFuerte: '#8FA38A',
  fondo: '#EEF2EC', verde: '#15803D', verdeSuave: '#DCFCE7',
  ambar: '#B45309', ambarSuave: '#FEF3C7', rojo: '#B91C1C', rojoSuave: '#FEE2E2',
  azul: '#1D4ED8', azulSuave: '#DBEAFE',
};

export const inp: CSSProperties = {
  width: '100%', height: 48, border: `1px solid ${C.bordeFuerte}`, borderRadius: 4,
  padding: '0 12px', fontSize: 18, background: '#fff', outline: 'none',
  fontFamily: 'inherit', color: C.texto, boxSizing: 'border-box',
};
export const lbl: CSSProperties = {
  fontSize: 14, color: C.suave, fontWeight: 700, letterSpacing: '.5px', marginBottom: 4, display: 'block',
};
export const card: CSSProperties = {
  background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 6, padding: 16,
};
export const btnPrincipal = (ocupado = false): CSSProperties => ({
  height: 52, border: 'none', borderRadius: 6, background: ocupado ? C.suave : C.verde, color: '#fff',
  fontWeight: 800, fontSize: 18, cursor: ocupado ? 'default' : 'pointer', width: '100%',
});
export const btnSecundario: CSSProperties = {
  height: 48, border: `1.5px solid ${C.bordeFuerte}`, borderRadius: 6, background: '#fff', color: C.texto,
  fontWeight: 700, fontSize: 17, cursor: 'pointer', padding: '0 14px',
};
export const aviso = (tipo: 'ok' | 'error' | 'info'): CSSProperties => ({
  fontSize: 16, padding: '8px 12px', borderRadius: 4, fontWeight: 600,
  color: tipo === 'ok' ? C.verde : tipo === 'error' ? C.rojo : C.azul,
  background: tipo === 'ok' ? C.verdeSuave : tipo === 'error' ? C.rojoSuave : C.azulSuave,
});
