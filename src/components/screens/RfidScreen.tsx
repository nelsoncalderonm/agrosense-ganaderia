'use client';

import { useState, useCallback } from 'react';
import { Animal, RFID_RECENT, ESTADO, CAT, gHexFor, gdpTxt } from '@/data/agrosense';
import { useBluetooth } from '@/hooks/useBluetooth';

interface Props {
  onOpenDrawer: () => void;
  animals: Animal[];
  onRegistrarPesaje?: (animal: Animal, pesoKg: number) => Promise<void>;
}

const BT_STATUS_UI = {
  disconnected: { bg: '#FEF3C7', border: '#FCD34D', dot: '#D97706', text: '#D97706', label: 'DESCONECTADO' },
  connecting:   { bg: '#DBEAFE', border: '#93C5FD', dot: '#2563EB', text: '#2563EB', label: 'CONECTANDO…'  },
  connected:    { bg: '#DCFCE7', border: '#86EFAC', dot: '#15A34A', text: '#15A34A', label: 'CONECTADO'    },
  unsupported:  { bg: '#FEE2E2', border: '#FCA5A5', dot: '#DC2626', text: '#DC2626', label: 'NO SOPORTADO' },
};

export default function RfidScreen({ onOpenDrawer, animals, onRegistrarPesaje }: Props) {
  const [foundAnimal, setFoundAnimal] = useState<Animal | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [recent, setRecent] = useState(RFID_RECENT);

  const handleTag = useCallback((rawTag: string) => {
    setNotFound(null);
    // Match tag against animal.id (full) or animal.arete (suffix)
    const tag = rawTag.trim().toUpperCase();
    const match = animals.find(a =>
      a.id.replace(/[\s·]/g, '').toUpperCase().includes(tag.replace(/[\s·]/g, '')) ||
      tag.includes(a.id.replace(/[\s·]/g, '').toUpperCase()) ||
      a.arete.replace(/[\s·]/g, '').toUpperCase() === tag.replace(/[\s·]/g, '').toUpperCase()
    );
    if (match) {
      setFoundAnimal(match);
    } else {
      setNotFound(rawTag);
    }
  }, [animals]);

  const { status, deviceName, error, connect, disconnect } = useBluetooth(handleTag);
  const btUi = BT_STATUS_UI[status];

  const handleReset = () => {
    setFoundAnimal(null);
    setNotFound(null);
  };

  const handleRegister = () => {
    if (!foundAnimal) return;
    const newEntry = {
      nombre: foundAnimal.nombre,
      id: foundAnimal.arete,
      peso: foundAnimal.peso,
      estado: foundAnimal.estado,
    };
    setRecent(prev => [newEntry, ...prev.slice(0, 4)]);
    onRegistrarPesaje?.(foundAnimal, foundAnimal.peso);
    setFoundAnimal(null);
    setNotFound(null);
  };

  const cat = foundAnimal ? CAT[foundAnimal.cat] : CAT.Ceba;

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 84 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '56px 16px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={onOpenDrawer} style={{ width: 38, height: 38, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#1A2B1A" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '.4px' }}>Lector RFID</div>
        </div>

        {/* BT status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: btUi.bg, border: `1px solid ${btUi.border}`, padding: '6px 9px', borderRadius: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: btUi.dot, display: 'block', flexShrink: 0 }}
            className={status === 'connecting' ? 'animate-blink' : undefined}
          />
          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: btUi.text, fontWeight: 600 }}>
            {deviceName ?? btUi.label}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 18px 12px' }}>

        {/* ── Animal found ── */}
        {foundAnimal ? (
          <div className="animate-up" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, justifyContent: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: cat.soft, border: `1.5px solid ${cat.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 21, color: cat.hex }}>
                {foundAnimal.nombre.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 21, lineHeight: 1 }}>{foundAnimal.nombre}</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11.5, color: '#6E8A6E', marginTop: 5 }}>{foundAnimal.arete} · {foundAnimal.raza}</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '18px 0 2px' }}>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: '#9DB39D', letterSpacing: '1.5px' }}>PESO EN BÁSCULA</div>
              <div className="animate-pop" style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 76, lineHeight: .95, letterSpacing: -2 }}>
                {foundAnimal.peso}<span style={{ fontSize: 24, color: '#9DB39D', fontWeight: 600 }}> kg</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 12 }}>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 12 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9.5, color: '#9DB39D', letterSpacing: '.5px' }}>GDP · KG/DÍA</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 5 }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 21, color: gHexFor(foundAnimal.gdp) }}>{gdpTxt(foundAnimal.gdp)}</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11.5, color: foundAnimal.gdpDelta >= 0 ? '#15A34A' : '#DC2626' }}>
                    {foundAnimal.gdpDelta >= 0 ? '▲' : '▼'}{Math.abs(foundAnimal.gdpDelta).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 9.5, color: '#9DB39D', marginTop: 3 }}>vs. semana anterior</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 12 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9.5, color: '#9DB39D', letterSpacing: '.5px' }}>EN POTRERO</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 21, marginTop: 5 }}>{foundAnimal.dias}<span style={{ fontSize: 11, color: '#9DB39D' }}> días</span></div>
                <div style={{ fontSize: 9.5, color: '#9DB39D', marginTop: 3 }}>{foundAnimal.potrero}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 9, background: ESTADO[foundAnimal.estado].soft, border: `1px solid ${ESTADO[foundAnimal.estado].hex}`, borderRadius: 4, padding: '11px 13px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: ESTADO[foundAnimal.estado].hex, flexShrink: 0, display: 'block' }}/>
              <span style={{ fontSize: 13, fontWeight: 600, color: ESTADO[foundAnimal.estado].hex }}>{foundAnimal.estadoTxt}</span>
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

        ) : (
          /* ── Connect / waiting UI ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', width: '100%' }}>

            {/* Radar animation */}
            <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {status === 'connected' && (
                <>
                  <span className="animate-ring"   style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', border: '1.5px solid #15A34A', display: 'block' }}/>
                  <span className="animate-ring-2" style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', border: '1.5px solid #15A34A', display: 'block' }}/>
                  <span className="animate-ring-3" style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', border: '1.5px solid #15A34A', display: 'block' }}/>
                  <span className="animate-sweep"  style={{ position: 'absolute', width: 152, height: 152, borderRadius: '50%', borderTop: '2px solid rgba(21,163,74,.6)', borderRight: '2px solid transparent', borderBottom: '2px solid transparent', borderLeft: '2px solid transparent', display: 'block' }}/>
                </>
              )}
              {status === 'connecting' && (
                <span className="animate-sweep" style={{ position: 'absolute', width: 152, height: 152, borderRadius: '50%', borderTop: '2px solid rgba(37,99,235,.5)', borderRight: '2px solid transparent', borderBottom: '2px solid transparent', borderLeft: '2px solid transparent', display: 'block' }}/>
              )}
              <span style={{ position: 'absolute', width: 152, height: 152, borderRadius: '50%', border: `1px solid ${status === 'connected' ? 'rgba(21,163,74,.2)' : 'rgba(0,0,0,.08)'}`, display: 'block' }}/>
              <span style={{ position: 'absolute', width: 104, height: 104, borderRadius: '50%', border: `1px solid ${status === 'connected' ? 'rgba(21,163,74,.16)' : 'rgba(0,0,0,.06)'}`, display: 'block' }}/>
              {/* BT icon center */}
              <div style={{ width: 76, height: 76, borderRadius: '50%', background: status === 'connected' ? '#DCFCE7' : '#F0F4EF', border: `1.5px solid ${status === 'connected' ? '#15A34A' : '#C5D2C0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {status === 'connected' ? (
                  /* RFID waves icon */
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#15A34A" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12.5a9 9 0 0114 0"/>
                    <path d="M8 15a5 5 0 018 0"/>
                    <circle cx="12" cy="18.5" r="1.4" fill="#15A34A" stroke="none"/>
                  </svg>
                ) : (
                  /* Bluetooth icon */
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={status === 'connecting' ? '#2563EB' : '#9DB39D'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
                  </svg>
                )}
              </div>
            </div>

            {/* Status text */}
            <div style={{ marginTop: 22, fontFamily: 'var(--font-jetbrains)', fontSize: 13, letterSpacing: '.4px', textAlign: 'center', minHeight: 18,
              color: status === 'connected' ? '#15A34A' : status === 'connecting' ? '#2563EB' : '#9DB39D' }}>
              {status === 'connected'    ? 'Esperando arete…'          :
               status === 'connecting'   ? 'Buscando lector…'          :
               status === 'unsupported'  ? 'Bluetooth no disponible'   :
               'Conecta el lector para escanear'}
            </div>

            {/* Tag not found warning */}
            {notFound && (
              <div style={{ marginTop: 10, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 4, padding: '8px 14px', fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: '#D97706', textAlign: 'center' }}>
                Arete <b>{notFound}</b> no encontrado en base de datos
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ marginTop: 10, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 4, padding: '8px 14px', fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: '#DC2626', textAlign: 'center', maxWidth: 280 }}>
                {error}
              </div>
            )}

            {/* Action button */}
            {status === 'unsupported' ? (
              <div style={{ marginTop: 24, fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: '#DC2626', textAlign: 'center', maxWidth: 260 }}>
                Usa Chrome o Edge en Android para conectar el lector vía Bluetooth
              </div>
            ) : status === 'connected' ? (
              <button onClick={disconnect} style={{
                marginTop: 24, height: 50, padding: '0 32px', border: '1px solid #FCA5A5', borderRadius: 4,
                background: '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                Desconectar lector
              </button>
            ) : (
              <button onClick={connect} disabled={status === 'connecting'} style={{
                marginTop: 24, height: 58, padding: '0 38px', border: 'none', borderRadius: 4,
                background: status === 'connecting' ? '#6E8A6E' : '#2563EB',
                color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '.2px',
                cursor: status === 'connecting' ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 4px 14px rgba(37,99,235,.28)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
                </svg>
                {status === 'connecting' ? 'Conectando…' : 'Conectar lector BT'}
              </button>
            )}

            {/* Recent list — always visible when connected and idle */}
            {status === 'connected' && recent.length > 0 && (
              <>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: '#9DB39D', letterSpacing: '.5px', margin: '24px 0 8px', alignSelf: 'flex-start' }}>ÚLTIMOS 5 LEÍDOS</div>
                <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, overflow: 'hidden', width: '100%' }}>
                  {recent.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderTop: i > 0 ? '1px solid #EDF1EA' : 'none' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO[r.estado].hex, flexShrink: 0, display: 'block' }}/>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{r.nombre} <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: '#9DB39D', fontWeight: 500 }}>{r.id}</span></span>
                      <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, fontWeight: 700 }}>{r.peso} kg</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
