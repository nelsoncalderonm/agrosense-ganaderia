'use client';

import { useEffect, useState } from 'react';
import type { EstadoSync } from '@/hooks/useSincronizacion';
import type { Operacion } from '@/lib/offline/cola';
import { descartarConflicto, reintentarConflicto, conflictosDelServidor, type ConflictoServidor } from '@/lib/offline/sincronizar';
import { mensajeAmigable } from '@/lib/offline/mensajes';

const TIPO_LABEL: Record<string, string> = {
  pesaje: 'Pesaje', animal_alta: 'Animal nuevo', venta: 'Venta', baja: 'Baja',
  traslado: 'Traslado', evento_sanitario: 'Evento sanitario', gasto: 'Gasto',
};

function hora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Barra delgada arriba de cada pantalla: solo aparece si no hay señal, hay registros por enviar
// o hay algo por revisar. Al tocarla se abre la lista.
export default function EstadoSenal({ sync, fincaId }: { sync: EstadoSync; fincaId?: string }) {
  const [abierto, setAbierto] = useState(false);
  const { enLinea, sincronizando, pendientes, conflictos } = sync;

  if (enLinea && !pendientes.length && !conflictos.length && !abierto) return null;

  let fondo = '#FEF3C7', borde = '#FCD34D', color = '#92400E', texto = '';
  if (conflictos.length) {
    fondo = '#FEE2E2'; borde = '#FCA5A5'; color = '#991B1B';
    texto = `${conflictos.length} registro${conflictos.length > 1 ? 's' : ''} por revisar`;
  } else if (!enLinea) {
    texto = pendientes.length
      ? `Sin señal · ${pendientes.length} registro${pendientes.length > 1 ? 's' : ''} guardado${pendientes.length > 1 ? 's' : ''} en el celular`
      : 'Sin señal · puedes seguir trabajando, todo se guarda en el celular';
  } else {
    fondo = '#DBEAFE'; borde = '#93C5FD'; color = '#1E40AF';
    texto = sincronizando ? `Enviando ${pendientes.length} registro${pendientes.length > 1 ? 's' : ''}…` : `${pendientes.length} por enviar`;
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', borderBottom: `1px solid ${borde}`, background: fondo, color, padding: '10px 16px', fontSize: 18, fontWeight: 700, cursor: 'pointer', textAlign: 'left', position: 'sticky', top: 0, zIndex: 20 }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: enLinea ? (conflictos.length ? '#B91C1C' : '#1D4ED8') : '#B45309', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{texto}</span>
        <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15 }}>Ver</span>
      </button>
      {abierto && <PanelSync sync={sync} fincaId={fincaId} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

function PanelSync({ sync, fincaId, onCerrar }: { sync: EstadoSync; fincaId?: string; onCerrar: () => void }) {
  const { enLinea, sincronizando, pendientes, conflictos, ultimaSync, sincronizarAhora } = sync;
  const [delServidor, setDelServidor] = useState<ConflictoServidor[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    if (enLinea && fincaId) conflictosDelServidor(fincaId).then(setDelServidor);
  }, [enLinea, fincaId, conflictos.length]);

  const locales = new Set(conflictos.map(c => c.id));
  const otros = delServidor.filter(c => !locales.has(c.id));

  const accion = async (id: string, fn: () => Promise<void>) => {
    setOcupado(id);
    try { await fn(); } finally { setOcupado(null); }
    if (fincaId && enLinea) conflictosDelServidor(fincaId).then(setDelServidor);
  };

  const fila: React.CSSProperties = { padding: '10px 14px', borderTop: '1px solid #EDF1EA' };
  const btn: React.CSSProperties = { height: 34, padding: '0 12px', borderRadius: 4, fontWeight: 700, fontSize: 16, cursor: 'pointer' };

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60 }} />
      <div className="animate-slide-up ag-sheet-desktop" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#EEF2EC', borderRadius: '16px 16px 0 0', zIndex: 70, maxHeight: '85%', overflowY: 'auto', padding: '16px 16px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Registros del celular</div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', fontSize: 25, color: '#4A5E4A', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 16, color: '#3A4D3A', marginBottom: 14 }}>
          {enLinea ? 'Hay señal.' : 'Sin señal. Puedes seguir registrando: todo queda guardado aquí y se envía solo cuando vuelva el internet.'}
          {ultimaSync && <> Último envío: {hora(ultimaSync)}.</>}
        </div>

        {(conflictos.length > 0 || otros.length > 0) && (
          <>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#991B1B', marginBottom: 6 }}>Por revisar</div>
            <div style={{ fontSize: 15, color: '#3A4D3A', marginBottom: 8 }}>
              El servidor no pudo aplicar estos registros. No se perdieron: decide si los descartas o los vuelves a intentar.
            </div>
            <div style={{ background: '#fff', border: '1px solid #FCA5A5', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
              {conflictos.map((c: Operacion, i) => (
                <div key={c.id} style={{ ...fila, borderTop: i ? fila.borderTop : 'none' }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{c.descripcion}</div>
                  <div style={{ fontSize: 17, color: '#B91C1C', marginTop: 3 }}>{mensajeAmigable(c.error)}</div>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', marginTop: 3 }}>Hecho el {hora(c.creada_en)}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button disabled={ocupado === c.id} onClick={() => accion(c.id, () => descartarConflicto(c.id))} style={{ ...btn, border: '1px solid #8FA38A', background: '#fff', color: '#3A4D3A' }}>Descartar</button>
                    <button disabled={ocupado === c.id} onClick={() => accion(c.id, () => reintentarConflicto(c))} style={{ ...btn, border: 'none', background: '#15803D', color: '#fff' }}>Intentar de nuevo</button>
                  </div>
                </div>
              ))}
              {otros.map((c, i) => (
                <div key={c.id} style={{ ...fila, borderTop: i || conflictos.length ? fila.borderTop : 'none' }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{TIPO_LABEL[c.tipo] ?? c.tipo} <span style={{ fontWeight: 500, color: '#4A5E4A', fontSize: 15 }}>· otro celular</span></div>
                  <div style={{ fontSize: 17, color: '#B91C1C', marginTop: 3 }}>{mensajeAmigable(c.error)}</div>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', marginTop: 3 }}>Hecho el {hora(c.creada_en)}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button disabled={ocupado === c.id} onClick={() => accion(c.id, () => descartarConflicto(c.id))} style={{ ...btn, border: '1px solid #8FA38A', background: '#fff', color: '#3A4D3A' }}>Marcar revisado</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Por enviar ({pendientes.length})</div>
        <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
          {pendientes.length === 0 && <div style={{ padding: 14, fontSize: 16, color: '#4A5E4A' }}>Todo está enviado.</div>}
          {pendientes.map((p, i) => (
            <div key={p.id} style={{ ...fila, borderTop: i ? fila.borderTop : 'none', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{p.descripcion}</span>
              <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', whiteSpace: 'nowrap' }}>{hora(p.creada_en)}</span>
            </div>
          ))}
        </div>

        {enLinea && pendientes.length > 0 && (
          <button onClick={sincronizarAhora} disabled={sincronizando} style={{ width: '100%', height: 46, border: 'none', borderRadius: 4, background: sincronizando ? '#3A4D3A' : '#15803D', color: '#fff', fontWeight: 800, fontSize: 18, cursor: 'pointer' }}>
            {sincronizando ? 'Enviando…' : 'Enviar ahora'}
          </button>
        )}
      </div>
    </>
  );
}
