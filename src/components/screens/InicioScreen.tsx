'use client';

import { Finca, WEIGHT_DATA, ESTADO, CAT, money, gHexFor, gdpTxt } from '@/data/agrosense';
import { DbAlerta } from '@/lib/supabase';

const SEV_HEX: Record<string, { hex: string; soft: string }> = {
  alta: { hex: '#B91C1C', soft: '#FEE2E2' },
  media: { hex: '#B45309', soft: '#FEF3C7' },
  baja: { hex: '#1D4ED8', soft: '#DBEAFE' },
  info: { hex: '#15803D', soft: '#DCFCE7' },
};

interface Props {
  finca: Finca;
  role: string;
  moneda: 'COP' | 'USD';
  setMoneda: (m: 'COP' | 'USD') => void;
  onOpenDrawer: () => void;
  onOpenFincaPicker: () => void;
  onGoAnimales: () => void;
  onGoPotreros: () => void;
  wPeriod: '1M' | '3M' | '6M';
  setWPeriod: (p: '1M' | '3M' | '6M') => void;
  alertas: DbAlerta[];
  pendingSync: number;
  climaCard?: React.ReactNode;
}

function WeightChart({ period }: { period: '1M' | '3M' | '6M' }) {
  const data = WEIGHT_DATA[period];
  const min = Math.min(...data) - 10;
  const max = Math.max(...data) + 10;
  const w = 280, h = 80;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x},${y}`;
  });
  const path = 'M ' + pts.join(' L ');
  const area = `M 0,${h} L ${pts.join(' L ')} L ${w},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 80 }}>
      <defs>
        <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#15803D" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#15803D" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#wGrad)" />
      <path d={path} fill="none" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / (max - min)) * h;
        return <circle key={i} cx={x} cy={y} r={i === data.length - 1 ? 4 : 3} fill={i === data.length - 1 ? '#15803D' : '#fff'} stroke="#15803D" strokeWidth="1.5" />;
      })}
    </svg>
  );
}

export default function InicioScreen({ finca, role, moneda, setMoneda, onOpenDrawer, onOpenFincaPicker, onGoAnimales, onGoPotreros, wPeriod, setWPeriod, alertas, pendingSync, climaCard }: Props) {
  const canFinanzas = role === 'owner' || role === 'contable';
  const fecha = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });

  const usdRate = 4100;
  const valorCop = finca.valorCop;
  const valorUsd = Math.round(valorCop / usdRate);
  const gananciaMesCop = finca.gananciaMesKg * 8400;
  const valorBig = moneda === 'COP' ? money(valorCop) : '$' + valorUsd.toLocaleString('en-US');
  const valorSub = moneda === 'COP' ? `${finca.animales} animales · $${Math.round(valorCop / finca.animales / 1000)}k promedio` : `${finca.animales} animales · USD ${Math.round(valorUsd / finca.animales).toLocaleString('en-US')} avg`;
  const gananciaMesTxt = moneda === 'COP' ? money(gananciaMesCop) : '$' + Math.round(gananciaMesCop / usdRate).toLocaleString('en-US');

  const comp = finca.comp;
  const compTotal = comp.Levante + comp.Ceba + comp.Cría;
  const compItems = [
    { label: 'Levante', n: comp.Levante, pct: Math.round(comp.Levante / compTotal * 100), ...CAT.Levante },
    { label: 'Ceba',    n: comp.Ceba,    pct: Math.round(comp.Ceba / compTotal * 100),    ...CAT.Ceba },
    { label: 'Cría',    n: comp.Cría,    pct: Math.round(comp.Cría / compTotal * 100),    ...CAT.Cría },
  ];

  const mov = finca.mov;
  const movItems = [
    { label: 'Nacimientos', n: mov.nacimientos, ...ESTADO.green },
    { label: 'Ventas',      n: mov.ventas,      ...ESTADO.blue },
    { label: 'Compras',     n: mov.compras,     ...ESTADO.amber },
    { label: 'Muertes',     n: mov.muertes,     ...ESTADO.red },
  ];

  const wData = WEIGHT_DATA[wPeriod];
  const first = wData[0], last = wData[wData.length - 1];
  const wGain = last - first;
  const wGainTxt = `+${wGain} kg`;
  const periods: ('1M' | '3M' | '6M')[] = ['1M', '3M', '6M'];

  const recentPesajes = [
    { nombre: 'Capitán', arete: '·903', ini: 'C', t: 'hace 2 horas', peso: 538, gdpV: 1.12, soft: CAT.Ceba.soft, hex: CAT.Ceba.hex },
    { nombre: 'Rayo',    arete: '·233', ini: 'R', t: 'hace 5 horas', peso: 502, gdpV: 1.05, soft: CAT.Ceba.soft, hex: CAT.Ceba.hex },
    { nombre: 'Manchas', arete: '·012', ini: 'M', t: 'ayer',         peso: 389, gdpV: 0.42, soft: CAT.Cría.soft, hex: CAT.Cría.hex },
    { nombre: 'Perla',   arete: '·690', ini: 'P', t: 'ayer',         peso: 421, gdpV: 0.55, soft: CAT.Cría.soft, hex: CAT.Cría.hex },
  ];

  return (
    <div style={{ padding: '16px 16px 96px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, minWidth: 0, flex: 1 }}>
          <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 40, height: 40, margin: '-6px 0 0 -7px', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F1A0F" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <button onClick={onOpenFincaPicker} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.15, letterSpacing: '-.4px', color: '#0F1A0F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{finca.nombre}</div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div style={{ fontSize: 15, color: '#3A4D3A', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{finca.ubic} · {fecha}</div>
          </button>
        </div>
        {pendingSync > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#DBEAFE', border: '1px solid #93C5FD', padding: '7px 10px', borderRadius: 4, flexShrink: 0 }}>
            <span className="animate-blink" style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D4ED8', display: 'block' }}/>
            <span style={{ fontSize: 15, color: '#1D4ED8', fontWeight: 700 }}>{pendingSync} sin sync</span>
          </div>
        )}
      </div>

      {climaCard}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginTop: 20 }}>
        {[
          { value: finca.animales.toString(), label: 'ANIMALES', hex: '#0F1A0F' },
          { value: finca.kgProm.toString(), label: 'KG PROM', hex: '#15803D' },
          { value: finca.alertas.toString(), label: 'ALERTAS', hex: '#B45309' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: '13px 11px' }}>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 28, lineHeight: 1, color: k.hex }}>{k.value}</div>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#3A4D3A', marginTop: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Desktop: hero+composición+chart on the left, activity feeds on the right */}
      <div className="ag-dash-grid">
      <div className="ag-dash-left">
      {/* Hero: Valor del hato */}
      {canFinanzas ? (
        <div style={{ background: 'linear-gradient(135deg,#137A39 0%,#15803D 100%)', borderRadius: 4, padding: 16, marginTop: 14, color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, letterSpacing: '1.2px', opacity: .85 }}>VALOR DEL HATO</span>
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,.18)', borderRadius: 4, padding: 2 }}>
              {(['COP', 'USD'] as const).map(m => (
                <button key={m} onClick={() => setMoneda(m)} style={{
                  padding: '4px 11px', borderRadius: 3, fontFamily: 'var(--font-jetbrains)', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', border: 'none',
                  background: moneda === m ? '#fff' : 'transparent',
                  color: moneda === m ? '#137A39' : 'rgba(255,255,255,.8)',
                }}>{m}</button>
              ))}
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 32, marginTop: 9, lineHeight: 1, letterSpacing: '-.5px' }}>{valorBig}</div>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, opacity: .8, marginTop: 6 }}>{valorSub}</div>
          <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.14)', borderRadius: 4, padding: '9px 11px' }}>
              <div style={{ fontSize: 14, opacity: .85 }}>Ganancia del mes</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 20, marginTop: 3 }}>{gananciaMesTxt} <span style={{ fontSize: 15, opacity: .85 }}>▲{finca.gananciaPct}%</span></div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.14)', borderRadius: 4, padding: '9px 11px' }}>
              <div style={{ fontSize: 14, opacity: .85 }}>GDP promedio</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 20, marginTop: 3 }}>{finca.gdpProm} <span style={{ fontSize: 15, opacity: .85 }}>kg/d</span></div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: 'linear-gradient(135deg,#137A39 0%,#15803D 100%)', borderRadius: 4, padding: 16, marginTop: 14, color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, letterSpacing: '1.2px', opacity: .85 }}>RENDIMIENTO DEL HATO</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.18)', borderRadius: 4, padding: '5px 9px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Sin finanzas</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.14)', borderRadius: 4, padding: 11 }}>
              <div style={{ fontSize: 14, opacity: .85 }}>Ganancia del mes</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 23, marginTop: 4 }}>{finca.gdpProm} <span style={{ fontSize: 15, opacity: .85 }}>kg/d</span></div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.14)', borderRadius: 4, padding: 11 }}>
              <div style={{ fontSize: 14, opacity: .85 }}>GDP promedio</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 23, marginTop: 4 }}>{finca.gdpProm} <span style={{ fontSize: 15, opacity: .85 }}>kg/d</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Composición del hato */}
      <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 15, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 19 }}>Composición del hato</span>
          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#4A5E4A' }}>{compTotal} animales</span>
        </div>
        <div style={{ display: 'flex', height: 14, borderRadius: 3, overflow: 'hidden', gap: 2 }}>
          {compItems.map(c => (
            <div key={c.label} style={{ width: `${c.pct}%`, background: c.hex }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 13 }}>
          {compItems.map(c => (
            <div key={c.label} style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: c.hex, flexShrink: 0, display: 'block' }}/>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{c.label}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 22, marginTop: 5 }}>{c.n}</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A' }}>{c.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ganancia de peso */}
      <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 15, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 19 }}>Así engorda tu ganado</div>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#15803D', fontWeight: 700, marginTop: 3 }}>{wGainTxt} en {wPeriod} ▲</div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {periods.map(p => (
              <button key={p} onClick={() => setWPeriod(p)} style={{
                padding: '5px 10px', borderRadius: 4, fontFamily: 'var(--font-jetbrains)', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', border: `1px solid ${wPeriod === p ? '#15803D' : '#B9C6B4'}`,
                background: wPeriod === p ? '#15803D' : '#fff',
                color: wPeriod === p ? '#fff' : '#4A5E4A',
              }}>{p}</button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 10 }}><WeightChart period={wPeriod} /></div>
        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', textAlign: 'center', marginTop: 2 }}>Peso promedio por animal</div>
      </div>
      </div>

      <div className="ag-dash-right">
      {/* Movimientos del mes */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '24px 2px 11px' }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Movimientos del mes</div>
        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#3A4D3A' }}>junio</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
        {movItems.map(m => (
          <div key={m.label} style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: '11px 6px', textAlign: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.soft, margin: '0 auto 7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.hex, display: 'block' }}/>
            </div>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 21, color: m.hex, lineHeight: 1 }}>{m.n}</div>
            <div style={{ fontSize: 13, color: '#3A4D3A', marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Ocupación de potreros */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '24px 2px 11px' }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Ocupación de potreros</div>
        <button onClick={onGoPotreros} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#15803D', cursor: 'pointer', fontWeight: 600 }}>DETALLE</button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: '6px 14px 14px' }}>
        {finca.potreros.map(o => {
          const pct = Math.round(o.animales / o.cap * 100);
          const hex = pct > 90 ? '#B91C1C' : pct > 75 ? '#B45309' : '#15803D';
          return (
            <div key={o.nombre} style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{o.nombre}</span>
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#3A4D3A' }}>{o.animales}/{o.cap}</span>
              </div>
              <div style={{ height: 9, borderRadius: 3, background: '#EDF1EA', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: hex }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Alertas */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '24px 2px 11px' }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Alertas del día</div>
        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#3A4D3A' }}>{alertas.length} activas</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alertas.map((a) => {
          const c = SEV_HEX[a.severidad] ?? SEV_HEX.info;
          return (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#fff', border: '1px solid #B9C6B4', borderLeft: `3px solid ${c.hex}`, borderRadius: 4, padding: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.hex, flexShrink: 0, boxShadow: `0 0 0 4px ${c.soft}`, display: 'block' }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>{a.titulo}</div>
              <div style={{ fontSize: 15, color: '#3A4D3A', marginTop: 3, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.descripcion}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: c.hex, flexShrink: 0, textAlign: 'right', fontWeight: 600 }}>{a.meta ?? ''}</div>
          </div>
          );
        })}
        {alertas.length === 0 && <div style={{ textAlign: 'center', color: '#4A5E4A', padding: '16px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 16 }}>Sin alertas activas</div>}
      </div>

      {/* Últimos pesajes */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '24px 2px 11px' }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Últimos pesajes</div>
        <button onClick={onGoAnimales} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#15803D', cursor: 'pointer', fontWeight: 600 }}>VER TODOS</button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, overflow: 'hidden' }}>
        {recentPesajes.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderTop: i > 0 ? '1px solid #EDF1EA' : 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: p.soft, border: `1px solid ${p.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: p.hex, flexShrink: 0 }}>{p.ini}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{p.nombre} <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', fontWeight: 500 }}>{p.arete}</span></div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#3A4D3A', marginTop: 2 }}>{p.t}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 20 }}>{p.peso}<span style={{ fontSize: 14, color: '#4A5E4A' }}> kg</span></div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: gHexFor(p.gdpV), marginTop: 1 }}>{gdpTxt(p.gdpV)} kg/d</div>
            </div>
          </div>
        ))}
      </div>
      </div>
      </div>
    </div>
  );
}
