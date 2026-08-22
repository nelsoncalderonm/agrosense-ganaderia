'use client';

import { useState } from 'react';
import { DbEvento, DbVacunacion, registrarVacunacion, getVacunacionPdfUrl } from '@/lib/supabase';

interface Props {
  onOpenDrawer: () => void;
  eventos: DbEvento[];
  fincaId?: string;
  vacunaciones: DbVacunacion[];
  onVacunacionRegistrada: () => void;
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

function VacunacionForm({ fincaId, onCancelar, onRegistrada }: { fincaId: string; onCancelar: () => void; onRegistrada: () => void }) {
  const now = new Date();
  const [ciclo, setCiclo] = useState<1 | 2>(now.getMonth() < 6 ? 1 : 2);
  const [anio, setAnio] = useState(now.getFullYear());
  const [fecha, setFecha] = useState(now.toISOString().slice(0, 10));
  const [titulo, setTitulo] = useState('');
  const [notas, setNotas] = useState('');
  const [animalesCount, setAnimalesCount] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const inp: React.CSSProperties = {
    width: '100%', height: 42, border: '1px solid #C5D2C0', borderRadius: 4,
    padding: '0 12px', fontSize: 14, background: '#fff', outline: 'none',
    fontFamily: 'inherit', color: '#1A2B1A', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, color: '#6E8A6E', fontWeight: 700, letterSpacing: '.5px',
    marginBottom: 4, display: 'block',
  };

  const handleGuardar = async () => {
    if (!titulo.trim()) { setErr('Título requerido'); return; }
    if (pdf && pdf.type !== 'application/pdf') { setErr('El adjunto debe ser un PDF'); return; }
    setSaving(true); setErr(null);
    const { error } = await registrarVacunacion({
      finca_id: fincaId, ciclo, anio, fecha, titulo: titulo.trim(),
      notas: notas.trim() || null,
      animales_count: animalesCount ? parseInt(animalesCount, 10) : null,
    }, pdf);
    setSaving(false);
    if (error) { setErr(error); return; }
    onRegistrada();
  };

  return (
    <div className="animate-up" style={{ background: '#fff', border: '1px solid #86EFAC', borderRadius: 6, padding: '16px 14px', marginTop: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Registrar vacunación</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>CICLO</label>
            <select style={inp} value={ciclo} onChange={e => setCiclo(Number(e.target.value) as 1 | 2)}>
              <option value={1}>1º ciclo (ene–jun)</option>
              <option value={2}>2º ciclo (jul–dic)</option>
            </select>
          </div>
          <div><label style={lbl}>AÑO</label>
            <input style={inp} type="number" value={anio} onChange={e => setAnio(parseInt(e.target.value, 10) || anio)} />
          </div>
        </div>
        <div><label style={lbl}>TÍTULO</label>
          <input style={inp} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Vacunación aftosa + brucelosis" autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>FECHA</label>
            <input style={inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div><label style={lbl}>ANIMALES VACUNADOS</label>
            <input style={inp} type="number" min={0} value={animalesCount} onChange={e => setAnimalesCount(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div><label style={lbl}>NOTAS</label>
          <textarea style={{ ...inp, height: 64, padding: '8px 12px', resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Opcional" />
        </div>
        <div><label style={lbl}>CERTIFICADO ICA (PDF)</label>
          <input style={inp} type="file" accept="application/pdf" onChange={e => setPdf(e.target.files?.[0] ?? null)} />
        </div>
        {err && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #C5D2C0', borderRadius: 4, background: '#fff', color: '#6E8A6E', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#6E8A6E' : '#15A34A', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Guardar vacunación'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VacunacionRow({ v }: { v: DbVacunacion }) {
  const [loading, setLoading] = useState(false);
  const handleVerPdf = async () => {
    if (!v.pdf_path) return;
    setLoading(true);
    const url = await getVacunacionPdfUrl(v.pdf_path);
    setLoading(false);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderLeft: '3px solid #2563EB', borderRadius: 4, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ background: '#DBEAFE', color: '#2563EB', fontSize: 9.5, fontWeight: 700, borderRadius: 3, padding: '2px 6px' }}>{v.ciclo}º ciclo {v.anio}</span>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{v.titulo}</div>
        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: '#6E8A6E', marginTop: 3 }}>
          {v.fecha} {v.animales_count != null && `· ${v.animales_count} animales`}
        </div>
      </div>
      {v.pdf_path && (
        <button onClick={handleVerPdf} disabled={loading} style={{ flexShrink: 0, height: 34, padding: '0 12px', border: '1px solid #93C5FD', borderRadius: 4, background: '#DBEAFE', color: '#2563EB', fontWeight: 700, fontSize: 12, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? '…' : 'Ver PDF'}
        </button>
      )}
    </div>
  );
}

export default function AgendaScreen({ onOpenDrawer, eventos, fincaId, vacunaciones, onVacunacionRegistrada }: Props) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const cells = buildCalCells(year, month, eventos);
  const monthName = new Date(year, month, 1).toLocaleDateString('es-CO', { month: 'long' });
  const monthNameCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const [showForm, setShowForm] = useState(false);

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A2B1A" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div style={{ fontWeight: 800, fontSize: 22 }}>Calendario sanitario</div>
      </div>

      <div className="ag-dash-grid">
      <div className="ag-dash-left">
      <div className="ag-calendar-card" style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: '14px 14px 16px' }}>
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

      <div className="ag-dash-right">

      {/* Vacunación por ciclo */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '28px 2px 11px' }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Vacunación · 2 ciclos al año</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {vacunaciones.map(v => <VacunacionRow key={v.id} v={v} />)}
        {vacunaciones.length === 0 && !showForm && (
          <div style={{ textAlign: 'center', color: '#9DB39D', padding: '20px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 12 }}>Sin vacunaciones registradas</div>
        )}
      </div>

      {fincaId && !showForm && (
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 10, height: 48, border: 'none', borderRadius: 4, background: '#15A34A', color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Registrar vacunación
        </button>
      )}
      {fincaId && showForm && (
        <VacunacionForm
          fincaId={fincaId}
          onCancelar={() => setShowForm(false)}
          onRegistrada={() => { setShowForm(false); onVacunacionRegistrada(); }}
        />
      )}
      </div>
      </div>
    </div>
  );
}
