'use client';

import { useState } from 'react';
import { Animal, CAT, ESTADO, gHexFor, gdpTxt } from '@/data/agrosense';
import { registrarNacimiento } from '@/lib/supabase';
import type { DbPotrero } from '@/lib/supabase';

interface Props {
  onOpenDrawer: () => void;
  onSelectAnimal: (a: Animal) => void;
  animals: Animal[];
  fincaId?: string;
  potreros?: DbPotrero[];
  onNacimientoRegistrado?: () => void;
}

const CHIPS = ['Todos', 'Ceba', 'Levante', 'Cría', 'Alertas'];
const SEXOS = ['Ternero', 'Ternera'];
const RAZAS = ['Cebú', 'Brahman', 'Brangus', 'Gyr', 'Romosinuano', 'Angus', 'Simmental', 'Mestizo', 'Otra'];

function NacimientoForm({
  fincaId, potreros, onCancelar, onRegistrado,
}: { fincaId: string; potreros: DbPotrero[]; onCancelar: () => void; onRegistrado: () => void }) {
  const [arete, setArete] = useState('');
  const [nombre, setNombre] = useState('');
  const [sexo, setSexo] = useState(SEXOS[0]);
  const [raza, setRaza] = useState(RAZAS[0]);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [potreroId, setPotreroId] = useState(potreros[0]?.id ?? '');
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
    if (!arete.trim()) { setErr('Arete requerido'); return; }
    setSaving(true); setErr(null);
    const { error } = await registrarNacimiento({
      finca_id: fincaId, potrero_id: potreroId || null, fecha, sexo,
      arete: arete.trim(), nombre: nombre.trim(), raza,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onRegistrado();
  };

  return (
    <div className="animate-up" style={{ background: '#fff', border: '1px solid #86EFAC', borderRadius: 6, padding: '16px 14px', margin: '0 16px 14px' }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Registrar nacimiento</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>ARETE</label>
            <input style={inp} value={arete} onChange={e => setArete(e.target.value)} placeholder="Ej: ·512" autoFocus />
          </div>
          <div><label style={lbl}>NOMBRE (OPCIONAL)</label>
            <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Lucero" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>SEXO</label>
            <select style={inp} value={sexo} onChange={e => setSexo(e.target.value)}>
              {SEXOS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label style={lbl}>RAZA</label>
            <select style={inp} value={raza} onChange={e => setRaza(e.target.value)}>
              {RAZAS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>FECHA</label>
            <input style={inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          {potreros.length > 0 && (
            <div><label style={lbl}>POTRERO</label>
              <select style={inp} value={potreroId} onChange={e => setPotreroId(e.target.value)}>
                <option value="">Sin asignar</option>
                {potreros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
        {err && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #C5D2C0', borderRadius: 4, background: '#fff', color: '#6E8A6E', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#6E8A6E' : '#15A34A', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Guardar nacimiento'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnimalesScreen({ onOpenDrawer, onSelectAnimal, animals, fincaId, potreros = [], onNacimientoRegistrado }: Props) {
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState('Todos');
  const [showNacimiento, setShowNacimiento] = useState(false);

  const filtered = animals.filter(a => {
    const matchSearch = !search || a.nombre.toLowerCase().includes(search.toLowerCase()) || a.arete.includes(search) || a.id.includes(search);
    const matchChip = chip === 'Todos' || (chip === 'Alertas' ? a.estado !== 'green' : a.cat === chip);
    return matchSearch && matchChip;
  });

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#EEF2EC', padding: '16px 16px 12px', borderBottom: '1px solid #E1E8DD' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A2B1A" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <div style={{ fontWeight: 800, fontSize: 22, flex: 1 }}>Animales <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#9DB39D', fontWeight: 500 }}>{filtered.length} cab</span></div>
          {fincaId && (
            <button onClick={() => setShowNacimiento(v => !v)} style={{ width: 38, height: 38, borderRadius: 4, border: '1px solid #86EFAC', background: '#DCFCE7', color: '#15A34A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title="Registrar nacimiento">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15A34A" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: '0 12px', height: 46 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9DB39D" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar arete, nombre o RFID"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#1A2B1A', fontFamily: 'var(--font-montserrat)', fontSize: 15 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9DB39D', fontSize: 18 }}>×</button>
          )}
        </div>
        <div className="scrollbar-none" style={{ display: 'flex', gap: 8, marginTop: 11, overflowX: 'auto', paddingBottom: 2 }}>
          {CHIPS.map(c => (
            <button key={c} onClick={() => setChip(c)} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 13px', borderRadius: 4, cursor: 'pointer',
              background: chip === c ? '#1A2B1A' : '#fff',
              border: `1px solid ${chip === c ? '#1A2B1A' : '#E1E8DD'}`,
              color: chip === c ? '#fff' : '#1A2B1A',
              fontSize: 12.5, fontWeight: 600,
            }}>{c}</button>
          ))}
        </div>
      </div>

      {showNacimiento && fincaId && (
        <div style={{ paddingTop: 14 }}>
          <NacimientoForm
            fincaId={fincaId} potreros={potreros}
            onCancelar={() => setShowNacimiento(false)}
            onRegistrado={() => { setShowNacimiento(false); onNacimientoRegistrado?.(); }}
          />
        </div>
      )}

      <div className="ag-animales-grid" style={{ padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#9DB39D', fontFamily: 'var(--font-jetbrains)', fontSize: 13 }}>Sin resultados</div>
        )}
        {filtered.map(a => {
          const cat = CAT[a.cat];
          const est = ESTADO[a.estado];
          return (
            <button key={a.id} onClick={() => onSelectAnimal(a)} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              background: '#fff', border: '1px solid #E1E8DD',
              borderLeft: `3px solid ${cat.hex}`,
              borderRadius: 4, padding: '11px 12px', cursor: 'pointer',
              textAlign: 'left', width: '100%',
            }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: cat.soft, border: `1px solid ${cat.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: cat.hex, flexShrink: 0 }}>
                {a.nombre.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{a.nombre}</span>
                  <span style={{ background: cat.soft, color: cat.hex, fontSize: 9.5, fontWeight: 700, borderRadius: 3, padding: '2px 6px', flexShrink: 0 }}>{a.cat}</span>
                  {a.estado !== 'green' && (
                    <span style={{ background: est.soft, color: est.hex, fontSize: 9.5, fontWeight: 700, borderRadius: 3, padding: '2px 6px', flexShrink: 0 }}>{a.estadoCorto}</span>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: '#6E8A6E', marginTop: 3 }}>{a.arete} · {a.raza} · {a.potrero}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 18 }}>{a.peso}<span style={{ fontSize: 10, color: '#9DB39D' }}> kg</span></div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: gHexFor(a.gdp), marginTop: 1 }}>{gdpTxt(a.gdp)} kg/d</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
