'use client';

import { useState, useEffect, useRef } from 'react';
import { Animal, RFID_RECENT, ESTADO, CAT, gHexFor, gdpTxt } from '@/data/agrosense';

interface Props {
  onOpenDrawer: () => void;
  animals: Animal[];
  onRegistrarPesaje?: (animal: Animal, pesoKg: number) => Promise<void>;
}

export default function RfidScreen({ onOpenDrawer, animals, onRegistrarPesaje }: Props) {
  const [state, setState] = useState<'idle' | 'scanning' | 'found'>('idle');
  const [animalIdx, setAnimalIdx] = useState(0);
  const [recent, setRecent] = useState(RFID_RECENT);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleScan = () => {
    if (state === 'scanning') return;
    setState('scanning');
    timerRef.current = setTimeout(() => {
      setState('found');
      setAnimalIdx(idx => (idx + 1) % Math.max(animals.length, 1));
    }, 2200);
  };

  const handleReset = () => {
    setState('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleRegister = () => {
    const a = (animals.length > 0 ? animals : [])[animalIdx % Math.max(animals.length, 1)];
    const newEntry = { nombre: a.nombre, id: a.arete, peso: a.peso, estado: a.estado };
    setRecent(prev => [newEntry, ...prev.slice(0, 4)]);
    setState('idle');
  };

  const animal = (animals.length > 0 ? animals : [])[animalIdx % Math.max(animals.length, 1)];
  const cat = animal ? CAT[animal.cat] : CAT.Ceba;

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 84 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '56px 16px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={onOpenDrawer} style={{ width: 38, height: 38, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#1A2B1A" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '.4px' }}>Lector RFID</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#DBEAFE', border: '1px solid #93C5FD', padding: '6px 9px', borderRadius: 4 }}>
          <span className="animate-blink" style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563EB', display: 'block' }}/>
          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: '#2563EB', fontWeight: 600 }}>OFFLINE</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 18px 12px' }}>
        {state !== 'found' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
            <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {state === 'scanning' && (
                <>
                  <span className="animate-ring" style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', border: '1.5px solid #15A34A', display: 'block' }}/>
                  <span className="animate-ring-2" style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', border: '1.5px solid #15A34A', display: 'block' }}/>
                  <span className="animate-ring-3" style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', border: '1.5px solid #15A34A', display: 'block' }}/>
                  <span className="animate-sweep" style={{ position: 'absolute', width: 152, height: 152, borderRadius: '50%', borderTop: '2px solid rgba(21,163,74,.6)', borderRight: '2px solid transparent', borderBottom: '2px solid transparent', borderLeft: '2px solid transparent', display: 'block' }}/>
                </>
              )}
              <span style={{ position: 'absolute', width: 152, height: 152, borderRadius: '50%', border: '1px solid rgba(21,163,74,.2)', display: 'block' }}/>
              <span style={{ position: 'absolute', width: 104, height: 104, borderRadius: '50%', border: '1px solid rgba(21,163,74,.16)', display: 'block' }}/>
              <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#DCFCE7', border: '1.5px solid #15A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#15A34A" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12.5a9 9 0 0114 0"/>
                  <path d="M8 15a5 5 0 018 0"/>
                  <circle cx="12" cy="18.5" r="1.4" fill="#15A34A" stroke="none"/>
                </svg>
              </div>
            </div>
            <div style={{ marginTop: 22, fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: state === 'scanning' ? '#15A34A' : '#9DB39D', letterSpacing: '.4px', textAlign: 'center', minHeight: 18 }}>
              {state === 'scanning' ? 'Escaneando...' : 'Acerca el lector al arete'}
            </div>
            <button onClick={handleScan} disabled={state === 'scanning'} style={{
              marginTop: 24, height: 58, padding: '0 38px', border: 'none', borderRadius: 4,
              background: state === 'scanning' ? '#6E8A6E' : '#15A34A',
              color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '.2px',
              cursor: state === 'scanning' ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 4px 14px rgba(21,163,74,.28)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
                <path d="M5 12.5a9 9 0 0114 0"/>
                <path d="M8 15a5 5 0 018 0"/>
                <circle cx="12" cy="18.5" r="1.4" fill="#fff" stroke="none"/>
              </svg>
              {state === 'scanning' ? 'Escaneando...' : 'Escanear arete'}
            </button>
          </div>
        ) : (
          <div className="animate-up" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, justifyContent: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: cat.soft, border: `1.5px solid ${cat.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 21, color: cat.hex }}>
                {animal.nombre.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 21, lineHeight: 1 }}>{animal.nombre}</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11.5, color: '#6E8A6E', marginTop: 5 }}>{animal.arete} · {animal.raza}</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '18px 0 2px' }}>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: '#9DB39D', letterSpacing: '1.5px' }}>PESO EN BÁSCULA</div>
              <div className="animate-pop" style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 76, lineHeight: .95, letterSpacing: -2 }}>
                {animal.peso}<span style={{ fontSize: 24, color: '#9DB39D', fontWeight: 600 }}> kg</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 12 }}>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 12 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9.5, color: '#9DB39D', letterSpacing: '.5px' }}>GDP · KG/DÍA</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 5 }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 21, color: gHexFor(animal.gdp) }}>{gdpTxt(animal.gdp)}</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11.5, color: animal.gdpDelta >= 0 ? '#15A34A' : '#DC2626' }}>
                    {animal.gdpDelta >= 0 ? '▲' : '▼'}{Math.abs(animal.gdpDelta).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 9.5, color: '#9DB39D', marginTop: 3 }}>vs. semana anterior</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 12 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9.5, color: '#9DB39D', letterSpacing: '.5px' }}>EN POTRERO</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 21, marginTop: 5 }}>{animal.dias}<span style={{ fontSize: 11, color: '#9DB39D' }}> días</span></div>
                <div style={{ fontSize: 9.5, color: '#9DB39D', marginTop: 3 }}>{animal.potrero}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 9, background: ESTADO[animal.estado].soft, border: `1px solid ${ESTADO[animal.estado].hex}`, borderRadius: 4, padding: '11px 13px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: ESTADO[animal.estado].hex, flexShrink: 0, display: 'block' }}/>
              <span style={{ fontSize: 13, fontWeight: 600, color: ESTADO[animal.estado].hex }}>{animal.estadoTxt}</span>
            </div>

            <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
              <button onClick={handleReset} style={{ flex: 1, height: 54, border: '1px solid #C5D2C0', borderRadius: 4, background: '#fff', color: '#3A5A3A', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Escanear otro</button>
              <button onClick={handleRegister} style={{ flex: 1.4, height: 54, border: 'none', borderRadius: 4, background: '#15A34A', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(21,163,74,.28)' }}>Registrar pesaje</button>
            </div>

            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: '#9DB39D', letterSpacing: '.5px', margin: '16px 2px 8px' }}>ÚLTIMOS 5 LEÍDOS</div>
            <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, overflow: 'hidden' }}>
              {recent.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderTop: i > 0 ? '1px solid #EDF1EA' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO[r.estado].hex, flexShrink: 0, display: 'block' }}/>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{r.nombre} <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: '#9DB39D', fontWeight: 500 }}>{r.id}</span></span>
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, fontWeight: 700 }}>{r.peso} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
