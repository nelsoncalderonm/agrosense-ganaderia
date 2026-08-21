'use client';

import { useState } from 'react';
import { Animal, CAT, ESTADO, gHexFor, gdpTxt } from '@/data/agrosense';
import { registrarBaja } from '@/lib/supabase';

interface Props {
  animal: Animal;
  fincaId?: string;
  onClose: () => void;
  onPesaje: () => void;
  onBajaRegistrada?: () => void;
}

const CAUSAS = ['Enfermedad', 'Accidente', 'Depredación', 'Parto', 'Vejez', 'Otra'];

function BajaForm({ animal, fincaId, onCancelar, onRegistrada }: {
  animal: Animal; fincaId: string; onCancelar: () => void; onRegistrada: () => void;
}) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [causaCat, setCausaCat] = useState(CAUSAS[0]);
  const [detalle, setDetalle] = useState('');
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
    setSaving(true); setErr(null);
    const causa = detalle.trim() ? `${causaCat}: ${detalle.trim()}` : causaCat;
    const { error } = await registrarBaja({ finca_id: fincaId, animal_id: animal.dbId, fecha, causa });
    setSaving(false);
    if (error) { setErr(error); return; }
    onRegistrada();
  };

  return (
    <div className="animate-up" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '16px 14px' }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, color: '#DC2626' }}>Registrar baja de {animal.nombre}</div>
      <div style={{ fontSize: 11.5, color: '#991B1B', marginBottom: 12 }}>El animal se marcará como inactivo y saldrá de los listados.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>FECHA</label>
            <input style={inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div><label style={lbl}>CAUSA</label>
            <select style={inp} value={causaCat} onChange={e => setCausaCat(e.target.value)}>
              {CAUSAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div><label style={lbl}>DETALLE (OPCIONAL)</label>
          <input style={inp} value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Ej: fiebre aftosa confirmada" />
        </div>
        {err && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #C5D2C0', borderRadius: 4, background: '#fff', color: '#6E8A6E', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#6E8A6E' : '#DC2626', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Confirmar baja'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnimalProfile({ animal, fincaId, onClose, onPesaje, onBajaRegistrada }: Props) {
  const cat = CAT[animal.cat];
  const est = ESTADO[animal.estado];
  const gain = animal.peso - animal.pesoAnt;
  const [showBaja, setShowBaja] = useState(false);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 40 }} />
      <div className="animate-slide-up ag-sheet-desktop" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#EEF2EC', borderRadius: '16px 16px 0 0', zIndex: 50, maxHeight: '92%', overflowY: 'auto', paddingBottom: 32 }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#C5D2C0' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid #E1E8DD' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: cat.soft, border: `2px solid ${cat.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, color: cat.hex, flexShrink: 0 }}>
              {animal.nombre.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{animal.nombre}</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: '#6E8A6E', marginTop: 5 }}>{animal.id} · {animal.arete}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <span style={{ background: cat.soft, color: cat.hex, fontSize: 10, fontWeight: 700, borderRadius: 3, padding: '2px 8px' }}>{animal.cat}</span>
                <span style={{ background: est.soft, color: est.hex, fontSize: 10, fontWeight: 700, borderRadius: 3, padding: '2px 8px' }}>{animal.estadoCorto}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9DB39D', fontSize: 22 }}>×</button>
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: est.soft, border: `1px solid ${est.hex}`, borderRadius: 4, padding: '11px 14px', marginBottom: 14 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: est.hex, flexShrink: 0, display: 'block' }}/>
            <span style={{ fontSize: 13, fontWeight: 600, color: est.hex }}>{animal.estadoTxt}</span>
          </div>

          {/* Weight KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginBottom: 14 }}>
            <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: '12px 10px' }}>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', textTransform: 'uppercase', letterSpacing: '.5px' }}>Peso</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 22, marginTop: 4 }}>{animal.peso}<span style={{ fontSize: 10, color: '#9DB39D' }}> kg</span></div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: '12px 10px' }}>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', textTransform: 'uppercase', letterSpacing: '.5px' }}>GDP</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 22, marginTop: 4, color: gHexFor(animal.gdp) }}>{gdpTxt(animal.gdp)}<span style={{ fontSize: 10, color: '#9DB39D' }}> kg/d</span></div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: '12px 10px' }}>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', textTransform: 'uppercase', letterSpacing: '.5px' }}>Ganancia</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 22, marginTop: 4, color: gain >= 0 ? '#15A34A' : '#DC2626' }}>{gain >= 0 ? '+' : ''}{gain}<span style={{ fontSize: 10, color: '#9DB39D' }}> kg</span></div>
            </div>
          </div>

          {/* Details */}
          <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: '2px 0', marginBottom: 14 }}>
            {[
              { label: 'Raza', value: animal.raza },
              { label: 'Sexo', value: animal.sexo },
              { label: 'Potrero', value: animal.potrero },
              { label: 'Días en potrero', value: `${animal.dias} días` },
              { label: 'Peso anterior', value: `${animal.pesoAnt} kg` },
              { label: 'Período medición', value: `${animal.diasEnt} días` },
            ].map((row, i, arr) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #EDF1EA' : 'none' }}>
                <span style={{ fontSize: 13.5, color: '#6E8A6E' }}>{row.label}</span>
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12.5, fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {showBaja && fincaId ? (
            <BajaForm
              animal={animal} fincaId={fincaId}
              onCancelar={() => setShowBaja(false)}
              onRegistrada={() => { setShowBaja(false); onBajaRegistrada?.(); onClose(); }}
            />
          ) : (
            <>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 9 }}>
                <button onClick={onClose} style={{ flex: 1, height: 52, border: '1px solid #C5D2C0', borderRadius: 4, background: '#fff', color: '#3A5A3A', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cerrar</button>
                <button onClick={onPesaje} style={{ flex: 1.4, height: 52, border: 'none', borderRadius: 4, background: '#15A34A', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(21,163,74,.28)' }}>
                  Registrar pesaje
                </button>
              </div>
              {fincaId && (
                <button onClick={() => setShowBaja(true)} style={{ width: '100%', marginTop: 9, height: 44, border: '1px solid #FCA5A5', borderRadius: 4, background: '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Registrar baja
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
