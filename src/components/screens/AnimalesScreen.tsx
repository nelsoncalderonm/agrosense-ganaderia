'use client';

import { useState } from 'react';
import { Animal, CAT, ESTADO, gHexFor, gdpTxt } from '@/data/agrosense';

interface Props {
  onOpenDrawer: () => void;
  onSelectAnimal: (a: Animal) => void;
  animals: Animal[];
}

const CHIPS = ['Todos', 'Ceba', 'Levante', 'Cría', 'Alertas'];

export default function AnimalesScreen({ onOpenDrawer, onSelectAnimal, animals }: Props) {
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState('Todos');

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
          <div style={{ fontWeight: 800, fontSize: 22 }}>Animales <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#9DB39D', fontWeight: 500 }}>{filtered.length} cab</span></div>
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

      <div style={{ padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
