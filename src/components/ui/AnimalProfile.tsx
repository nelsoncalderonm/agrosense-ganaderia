'use client';

import { Animal, CAT, ESTADO, gHexFor, gdpTxt, money } from '@/data/agrosense';

interface Props {
  animal: Animal;
  onClose: () => void;
  onPesaje: () => void;
}

export default function AnimalProfile({ animal, onClose, onPesaje }: Props) {
  const cat = CAT[animal.cat];
  const est = ESTADO[animal.estado];
  const gain = animal.peso - animal.pesoAnt;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 40 }} />
      <div className="animate-slide-up" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#EEF2EC', borderRadius: '16px 16px 0 0', zIndex: 50, maxHeight: '92%', overflowY: 'auto', paddingBottom: 32 }}>
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

          {/* Actions */}
          <div style={{ display: 'flex', gap: 9 }}>
            <button onClick={onClose} style={{ flex: 1, height: 52, border: '1px solid #C5D2C0', borderRadius: 4, background: '#fff', color: '#3A5A3A', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cerrar</button>
            <button onClick={onPesaje} style={{ flex: 1.4, height: 52, border: 'none', borderRadius: 4, background: '#15A34A', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(21,163,74,.28)' }}>
              Registrar pesaje
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
