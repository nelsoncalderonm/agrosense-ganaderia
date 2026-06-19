'use client';

import { DbEvento } from '@/lib/supabase';

interface Props {
  onOpenDrawer: () => void;
  eventos: DbEvento[];
}

const TIPO_COLOR: Record<string, { hex: string; soft: string }> = {
  Vacunación: { hex: '#2563EB', soft: '#DBEAFE' },
  Desparasitación: { hex: '#D97706', soft: '#FEF3C7' },
  'Rotación potrero': { hex: '#15A34A', soft: '#DCFCE7' },
  Pesaje: { hex: '#7C3AED', soft: '#EDE9FE' },
  Venta: { hex: '#1A2B1A', soft: '#F3F4F6' },
  Veterinario: { hex: '#DC2626', soft: '#FEE2E2' },
};

const CAL_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function buildCalCells(year: number, month: number, eventos: DbEvento[]) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();
  const eventDays = new Set(
    eventos
      .filter(e => { const d = new Date(e.fecha); return d.getFullYear() === year && d.getMonth() === month; })
      .map(e => new Date(e.fecha).getDate())
  );

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push({ day: '', wt: '400', fg: 'transparent', bg: 'transparent', dot: 'transparent' });
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = isCurrentMonth && d === todayDate;
    const hasEvent = eventDays.has(d);
    cells.push({
      day: d.toString(),
      wt: isToday ? '700' : '400',
      fg: isToday ? '#fff' : '#1A2B1A',
      bg: isToday ? '#15A34A' : 'transparent',
      dot: hasEvent && !isToday ? '#15A34A' : 'transparent',
    });
  }
  return cells;
}

export default function AgendaScreen({ onOpenDrawer, eventos }: Props) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const cells = buildCalCells(year, month, eventos);
  const monthName = new Date(year, month, 1).toLocaleDateString('es-CO', { month: 'long' });
  const monthNameCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button onClick={onOpenDrawer} style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A2B1A" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div style={{ fontWeight: 800, fontSize: 22 }}>Calendario sanitario</div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: '14px 14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{monthNameCap}</span>
          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: '#9DB39D' }}>{year}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, textAlign: 'center' }}>
          {CAL_HEADERS.map(h => (
            <div key={h} style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9.5, color: '#9DB39D', paddingBottom: 4 }}>{h}</div>
          ))}
          {cells.map((d, i) => (
            <div key={i} style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: d.bg, position: 'relative' }}>
              <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, fontWeight: d.wt === '700' ? 700 : 400, color: d.fg }}>{d.day}</span>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: d.dot, marginTop: 2, display: 'block' }}/>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontWeight: 800, fontSize: 16, margin: '22px 2px 11px' }}>Próximos eventos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {eventos.map((ev) => {
          const d = new Date(ev.fecha);
          const colors = TIPO_COLOR[ev.tipo] || { hex: '#15A34A', soft: '#DCFCE7' };
          const diffMs = d.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / 86400000);
          const diasTxt = diffDays <= 0 ? 'Hoy' : diffDays === 1 ? 'Mañana' : `En ${diffDays}d`;
          const dayNum = d.getDate();
          const mesAbr = d.toLocaleDateString('es-CO', { month: 'short' }).replace('.','');
          return (
          <div key={ev.id} style={{ background: '#fff', border: '1px solid #E1E8DD', borderLeft: `3px solid ${colors.hex}`, borderRadius: 4, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 18, fontWeight: 700, lineHeight: 1, color: colors.hex }}>{dayNum}</div>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: '#9DB39D', textTransform: 'uppercase' }}>{mesAbr}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ background: colors.soft, color: colors.hex, fontSize: 9.5, fontWeight: 700, borderRadius: 3, padding: '2px 6px' }}>{ev.tipo}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{ev.titulo}</div>
                  {ev.descripcion && <div style={{ fontSize: 11.5, color: '#6E8A6E', marginTop: 2 }}>{ev.descripcion}</div>}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: colors.hex, flexShrink: 0, fontWeight: 600 }}>{diasTxt}</div>
            </div>
          </div>
          );
        })}
        {eventos.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9DB39D', padding: '32px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 12 }}>Sin eventos próximos</div>
        )}
      </div>

      <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 16, height: 52, border: '1px dashed #C5D2C0', borderRadius: 4, background: 'transparent', color: '#6E8A6E', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Agregar evento
      </button>
    </div>
  );
}
