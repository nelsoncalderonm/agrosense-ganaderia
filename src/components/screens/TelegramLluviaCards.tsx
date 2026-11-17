'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DbLluvia, DbTelegramVinculo, actualizarVinculoTelegram, desconectarTelegram,
  generarLinkTelegram, getLluvia, getMiVinculoTelegram, registrarLluvia,
} from '@/lib/supabase';

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E1E8DD', borderRadius: 6, padding: 16 };
const inp: React.CSSProperties = {
  width: '100%', height: 42, border: '1px solid #C5D2C0', borderRadius: 4, padding: '0 12px', fontSize: 14,
  background: '#fff', outline: 'none', fontFamily: 'inherit', color: '#1A2B1A', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 10, color: '#6E8A6E', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4, display: 'block' };
const btn = (bg: string, disabled = false): React.CSSProperties => ({
  height: 42, border: 'none', borderRadius: 4, background: disabled ? '#6E8A6E' : bg, color: '#fff',
  fontWeight: 800, fontSize: 13, cursor: disabled ? 'default' : 'pointer', padding: '0 14px',
});
const errBox: React.CSSProperties = { fontSize: 12, color: '#DC2626', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 };
const okBox: React.CSSProperties = { fontSize: 12, color: '#15A34A', background: '#DCFCE7', padding: '6px 10px', borderRadius: 4 };

function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}
function menosDias(fecha: string, d: number): string {
  const x = new Date(`${fecha}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - d); return x.toISOString().slice(0, 10);
}

export function TelegramCard({ fincaId, miMembresiaId, puedeReportes }: { fincaId: string; miMembresiaId?: string; puedeReportes: boolean }) {
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
        {puedeReportes
          ? 'Reciba cada lunes a las 6 a.m. el reporte de producción, lluvia y trabajo de cada persona. También puede pedirlo con /resumen.'
          : 'Anote la lluvia desde Telegram con /lluvia 12 y reciba recordatorios cada mañana.'}
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

export function LluviaCard({ fincaId }: { fincaId: string }) {
  const [fecha, setFecha] = useState(hoy());
  const [mm, setMm] = useState('');
  const [registros, setRegistros] = useState<DbLluvia[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [version, setVersion] = useState(0);
  const cargar = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let vivo = true;
    getLluvia(fincaId, menosDias(hoy(), 83)).then(r => { if (vivo) setRegistros(r); });
    return () => { vivo = false; };
  }, [fincaId, version]);

  const guardar = async () => {
    const v = Number(mm.replace(',', '.'));
    if (mm === '' || !Number.isFinite(v) || v < 0 || v > 500) { setErr('Escriba los milímetros (0 a 500)'); return; }
    setSaving(true); setErr(null); setOk(false);
    const { error } = await registrarLluvia(fincaId, fecha, Math.round(v * 10) / 10);
    setSaving(false);
    if (error) { setErr(error); return; }
    setOk(true); setMm(''); cargar();
  };

  // Un valor por día: el del sensor si existe, si no el manual.
  const porDia = new Map<string, number>();
  for (const r of registros) {
    if (r.sensor_id || !porDia.has(r.fecha)) porDia.set(r.fecha, Number(r.mm));
  }
  const suma = (desde: string) => [...porDia].filter(([f]) => f >= desde).reduce((a, [, v]) => a + v, 0);
  const h = hoy();
  const semana = suma(menosDias(h, 6));
  const mes = suma(`${h.slice(0, 8)}01`);
  const promSemanal = suma(menosDias(h, 83)) / 12;
  const fmt = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 });

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Lluvia</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {[['7 DÍAS', semana], ['ESTE MES', mes], ['PROM. SEMANAL', promSemanal]].map(([t, v]) => (
          <div key={t as string} style={{ background: '#F3F7F1', borderRadius: 4, padding: '8px 10px' }}>
            <div style={lbl}>{t}</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{fmt(v as number)} <span style={{ fontSize: 11, color: '#6E8A6E' }}>mm</span></div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}><label style={lbl}>FECHA</label>
          <input style={inp} type="date" value={fecha} max={h} onChange={e => setFecha(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}><label style={lbl}>MILÍMETROS</label>
          <input style={inp} inputMode="decimal" value={mm} onChange={e => setMm(e.target.value)} placeholder="0" />
        </div>
        <button onClick={guardar} disabled={saving} style={btn('#15A34A', saving)}>{saving ? '…' : 'Anotar'}</button>
      </div>
      {err && <div style={{ ...errBox, marginTop: 10 }}>{err}</div>}
      {ok && <div style={{ ...okBox, marginTop: 10 }}>Anotado</div>}
    </div>
  );
}
