'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DbTelegramVinculo, actualizarVinculoTelegram, desconectarTelegram,
  generarLinkTelegram, getMiVinculoTelegram,
} from '@/lib/supabase';

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E1E8DD', borderRadius: 6, padding: 16 };
const btn = (bg: string, disabled = false): React.CSSProperties => ({
  height: 42, border: 'none', borderRadius: 4, background: disabled ? '#6E8A6E' : bg, color: '#fff',
  fontWeight: 800, fontSize: 13, cursor: disabled ? 'default' : 'pointer', padding: '0 14px',
});
const errBox: React.CSSProperties = { fontSize: 12, color: '#DC2626', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 };
const okBox: React.CSSProperties = { fontSize: 12, color: '#15A34A', background: '#DCFCE7', padding: '6px 10px', borderRadius: 4 };

export function TelegramCard({ fincaId, miMembresiaId }: { fincaId: string; miMembresiaId?: string }) {
  const [vinculo, setVinculo] = useState<DbTelegramVinculo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [link, setLink] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const cargar = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let vivo = true;
    const p = miMembresiaId ? getMiVinculoTelegram(miMembresiaId) : Promise.resolve(null);
    p.then(v => { if (vivo) { setVinculo(v); setCargando(false); } });
    return () => { vivo = false; };
  }, [miMembresiaId, version]);

  const conectar = async () => {
    setTrabajando(true); setErr(null);
    const { url, error } = await generarLinkTelegram(fincaId);
    setTrabajando(false);
    if (error || !url) { setErr(error ?? 'No se pudo generar el enlace'); return; }
    setLink(url);
    window.open(url, '_blank', 'noopener');
  };

  const toggleReportes = async () => {
    if (!vinculo) return;
    setTrabajando(true); setErr(null);
    const { error } = await actualizarVinculoTelegram(vinculo.id, { recibir_reportes: !vinculo.recibir_reportes });
    setTrabajando(false);
    if (error) { setErr(error); return; }
    cargar();
  };

  const desconectar = async () => {
    if (!vinculo) return;
    setTrabajando(true); setErr(null);
    const { error } = await desconectarTelegram(vinculo.id);
    setTrabajando(false);
    if (error) { setErr(error); return; }
    setVinculo(null); setLink(null);
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Telegram</div>
      <div style={{ fontSize: 12.5, color: '#4B634B', marginBottom: 12, lineHeight: 1.45 }}>
        Reciba cada lunes a las 6 a.m. el reporte de producción, inventario y trabajo de cada persona. También puede pedirlo con /resumen.
      </div>
      {cargando ? (
        <div style={{ fontSize: 12, color: '#9DB39D' }}>Cargando…</div>
      ) : vinculo && vinculo.activo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={okBox}>Conectado{vinculo.telegram_username ? ` como @${vinculo.telegram_username}` : ''}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={vinculo.recibir_reportes} onChange={toggleReportes} disabled={trabajando} />
            Recibir el reporte semanal
          </label>
          <button onClick={desconectar} disabled={trabajando} style={btn('#DC2626', trabajando)}>Desconectar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {vinculo && !vinculo.activo && <div style={errBox}>El bot no pudo escribirle (¿lo bloqueó?). Conéctelo de nuevo.</div>}
          <button onClick={conectar} disabled={trabajando || !miMembresiaId} style={btn('#229ED9', trabajando)}>
            {trabajando ? 'Generando…' : 'Conectar Telegram'}
          </button>
          {link && (
            <div style={{ fontSize: 12, color: '#4B634B' }}>
              Si no se abrió Telegram, <a href={link} target="_blank" rel="noopener noreferrer">toque aquí</a> y presione <b>Iniciar</b>. Luego vuelva y recargue. El enlace vence en 30 minutos.
            </div>
          )}
        </div>
      )}
      {err && <div style={{ ...errBox, marginTop: 10 }}>{err}</div>}
    </div>
  );
}
