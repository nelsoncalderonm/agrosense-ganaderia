'use client';

import { useState, useCallback, useRef } from 'react';
import { Animal, RFID_RECENT, ESTADO, CAT, gHexFor, gdpTxt } from '@/data/agrosense';
import AreteIcon from '@/components/ui/AreteIcon';
import { registrarCompraAnimal } from '@/lib/supabase';
import type { DbPotrero } from '@/lib/supabase';
import { useBluetooth } from '@/hooks/useBluetooth';

interface Props {
  onOpenDrawer: () => void;
  animals: Animal[];
  fincaId?: string;
  potreros?: DbPotrero[];
  onAnimalCreado?: () => void;
  onRegistrarPesaje?: (animal: Animal, pesoKg: number) => Promise<void>;
}

const RAZAS = ['Cebú', 'Brahman', 'Brangus', 'Gyr', 'Romosinuano', 'Angus', 'Simmental', 'Mestizo', 'Otra'];
const SEXOS = ['Novillo', 'Vaca', 'Toro', 'Ternero', 'Novilla'];
const CATS  = ['Levante', 'Ceba', 'Cría'] as const;

const BT_STATUS_UI = {
  disconnected: { bg: '#FEF3C7', border: '#FCD34D', dot: '#B45309', text: '#B45309', label: 'DESCONECTADO' },
  connecting:   { bg: '#DBEAFE', border: '#93C5FD', dot: '#1D4ED8', text: '#1D4ED8', label: 'CONECTANDO…'  },
  connected:    { bg: '#DCFCE7', border: '#86EFAC', dot: '#15803D', text: '#15803D', label: 'CONECTADO'    },
  unsupported:  { bg: '#F3F4F6', border: '#D1D5DB', dot: '#4B5563', text: '#374151', label: 'SIN BT'       },
};

// ── Manual tag input — always rendered ────────────────────────────────────────
function ManualInput({ onTag }: { onTag: (tag: string) => void }) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const submit = (raw: string) => {
    const tag = raw.trim();
    if (tag) { onTag(tag); setVal(''); }
  };

  return (
    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(val); } }}
        onPaste={e => { e.preventDefault(); const p = e.clipboardData.getData('text').trim(); if (p) submit(p); }}
        placeholder="Código del arete"
        autoComplete="off" autoCorrect="off" spellCheck={false}
        style={{
          flex: 1, minWidth: 0, height: 52, border: '2px solid #8FA38A', borderRadius: 4,
          padding: '0 12px', fontSize: 18, fontFamily: 'var(--font-jetbrains)',
          background: '#fff', outline: 'none', color: '#0F1A0F',
        }}
      />
      <button
        onClick={() => submit(val)}
        style={{
          height: 52, padding: '0 16px', border: 'none', borderRadius: 4, flexShrink: 0,
          background: '#0F1A0F', color: '#fff', fontWeight: 700, fontSize: 17,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Buscar
      </button>
    </div>
  );
}

// ── Create animal form ─────────────────────────────────────────────────────────
function CrearAnimalForm({
  arete, fincaId, potreros, onCreado, onCancelar,
}: {
  arete: string; fincaId: string; potreros: DbPotrero[];
  onCreado: () => void; onCancelar: () => void;
}) {
  const [raza,      setRaza]      = useState(RAZAS[0]);
  const [sexo,      setSexo]      = useState(SEXOS[0]);
  const [cat,       setCat]       = useState<'Levante'|'Ceba'|'Cría'>('Ceba');
  const [pesoKg,    setPesoKg]    = useState('');
  const [potreroId, setPotreroId] = useState(potreros[0]?.id ?? '');
  const [origen,    setOrigen]    = useState<'nacio'|'comprado'>('comprado');
  const [proveedor, setProveedor] = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState<string|null>(null);

  const handleGuardar = async () => {
    setSaving(true); setErr(null);
    const { error } = await registrarCompraAnimal({
      finca_id: fincaId, potrero_id: potreroId || null,
      nombre: '', arete, raza, sexo, categoria: cat,
      peso_kg: pesoKg ? parseFloat(pesoKg) : null,
      origen, proveedor: origen === 'comprado' ? (proveedor.trim() || null) : null,
      fecha: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onCreado();
  };

  const inp: React.CSSProperties = {
    width: '100%', height: 42, border: '1px solid #8FA38A', borderRadius: 4,
    padding: '0 12px', fontSize: 18, background: '#fff', outline: 'none',
    fontFamily: 'inherit', color: '#0F1A0F', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: 14, color: '#3A4D3A', fontWeight: 700, letterSpacing: '.5px',
    marginBottom: 4, display: 'block',
  };

  return (
    <div className="animate-up" style={{
      width: '100%', background: '#fff', border: '1px solid #86EFAC',
      borderRadius: 6, padding: '16px 14px', marginTop: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Registrar nuevo animal</div>
        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, background: '#DCFCE7', color: '#15803D', padding: '3px 8px', borderRadius: 3, fontWeight: 700 }}>
          {arete}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>RAZA</label>
            <select style={inp} value={raza} onChange={e => setRaza(e.target.value)}>
              {RAZAS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div><label style={lbl}>SEXO</label>
            <select style={inp} value={sexo} onChange={e => setSexo(e.target.value)}>
              {SEXOS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>CATEGORÍA</label>
            <select style={inp} value={cat} onChange={e => setCat(e.target.value as typeof cat)}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={lbl}>PESO INICIAL (kg)</label>
            <input style={inp} type="number" value={pesoKg} onChange={e => setPesoKg(e.target.value)} placeholder="0" min={0} />
          </div>
        </div>
        <div>
          <label style={lbl}>ORIGEN</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['comprado', 'nacio'] as const).map(o => (
              <button key={o} type="button" onClick={() => setOrigen(o)} style={{
                flex: 1, height: 40, borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 16,
                border: `1px solid ${origen === o ? '#15803D' : '#8FA38A'}`,
                background: origen === o ? '#DCFCE7' : '#fff',
                color: origen === o ? '#15803D' : '#3A4D3A',
              }}>{o === 'comprado' ? 'Comprado' : 'Nació en la finca'}</button>
            ))}
          </div>
        </div>
        {origen === 'comprado' && (
          <div><label style={lbl}>PROVEEDOR / VENDEDOR</label>
            <input style={inp} value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre de quién se compró" />
          </div>
        )}
        {potreros.length > 0 && (
          <div><label style={lbl}>POTRERO</label>
            <select style={inp} value={potreroId} onChange={e => setPotreroId(e.target.value)}>
              <option value="">Sin asignar</option>
              {potreros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        )}
        {err && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A4D3A', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#3A4D3A' : '#15803D', color: '#fff', fontWeight: 800, fontSize: 17, cursor: saving ? 'default' : 'pointer', boxShadow: '0 3px 10px rgba(21,163,74,.22)' }}>
            {saving ? 'Guardando…' : 'Guardar animal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Animal card ────────────────────────────────────────────────────────────────
function AnimalCard({ animal, onReset, onRegister }: {
  animal: Animal; onReset: () => void; onRegister: () => void;
}) {
  const cat = CAT[animal.cat];
  return (
    <div className="animate-up" style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: cat.soft, border: `1.5px solid ${cat.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 23, color: cat.hex, flexShrink: 0 }}>
          <AreteIcon color={cat.hex} size={28} />
        </div>
        <div>
          <div style={{ fontSize: 14, color: '#3A4D3A', fontWeight: 700, letterSpacing: '.5px' }}>ARETE</div>
          <div style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.05 }}>{animal.arete}</div>
          <div style={{ fontSize: 15, color: '#3A4D3A', marginTop: 4 }}>{animal.raza} · {animal.cat}</div>
        </div>
      </div>

      <div style={{ margin: '16px 0 4px' }}>
        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', letterSpacing: '1.5px' }}>PESO EN BÁSCULA</div>
        <div className="animate-pop" style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 68, lineHeight: .95, letterSpacing: -2 }}>
          {animal.peso}<span style={{ fontSize: 25, color: '#4A5E4A', fontWeight: 600 }}> kg</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <div style={{ background: '#F7FAF6', border: '1px solid #B9C6B4', borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', letterSpacing: '.5px' }}>GDP · KG/DÍA</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 22, color: gHexFor(animal.gdp) }}>{gdpTxt(animal.gdp)}</span>
            <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: animal.gdpDelta >= 0 ? '#15803D' : '#B91C1C' }}>
              {animal.gdpDelta >= 0 ? '▲' : '▼'}{Math.abs(animal.gdpDelta).toFixed(2)}
            </span>
          </div>
        </div>
        <div style={{ background: '#F7FAF6', border: '1px solid #B9C6B4', borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', letterSpacing: '.5px' }}>EN POTRERO</div>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 22, marginTop: 4 }}>{animal.dias}<span style={{ fontSize: 14, color: '#4A5E4A' }}> días</span></div>
          <div style={{ fontSize: 13, color: '#4A5E4A', marginTop: 1 }}>{animal.potrero}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, background: ESTADO[animal.estado].soft, border: `1px solid ${ESTADO[animal.estado].hex}`, borderRadius: 4, padding: '10px 12px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO[animal.estado].hex, flexShrink: 0, display: 'block' }}/>
        <span style={{ fontSize: 17, fontWeight: 600, color: ESTADO[animal.estado].hex }}>{animal.estadoTxt}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onReset} style={{ flex: 1, height: 50, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A5A3A', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>
          Escanear otro
        </button>
        <button onClick={onRegister} style={{ flex: 1.5, height: 50, border: 'none', borderRadius: 4, background: '#15803D', color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer', boxShadow: '0 4px 14px rgba(21,163,74,.28)' }}>
          Registrar pesaje
        </button>
      </div>
    </div>
  );
}

// ── Recent list ────────────────────────────────────────────────────────────────
function RecentList({ recent }: { recent: typeof RFID_RECENT }) {
  if (!recent.length) return null;
  return (
    <>
      <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', letterSpacing: '.5px', margin: '20px 0 8px' }}>ÚLTIMOS LEÍDOS</div>
      <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, overflow: 'hidden' }}>
        {recent.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderTop: i > 0 ? '1px solid #EDF1EA' : 'none' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: ESTADO[r.estado].hex, flexShrink: 0, display: 'block' }}/>
            <span style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>Arete {r.id}</span>
            <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 17, fontWeight: 700 }}>{r.peso} kg</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function RfidScreen({ onOpenDrawer, animals, fincaId, potreros = [], onAnimalCreado, onRegistrarPesaje }: Props) {
  const [foundAnimal, setFoundAnimal] = useState<Animal | null>(null);
  const [notFound,    setNotFound]    = useState<string | null>(null);
  const [recent,      setRecent]      = useState(RFID_RECENT);

  const handleTag = useCallback((rawTag: string) => {
    setNotFound(null);
    setFoundAnimal(null);
    const tag = rawTag.trim().toUpperCase();
    const match = animals.find(a =>
      a.id.replace(/[\s·]/g, '').toUpperCase().includes(tag.replace(/[\s·]/g, '')) ||
      tag.includes(a.id.replace(/[\s·]/g, '').toUpperCase()) ||
      a.arete.replace(/[\s·]/g, '').toUpperCase() === tag.replace(/[\s·]/g, '').toUpperCase()
    );
    if (match) setFoundAnimal(match);
    else setNotFound(rawTag);
  }, [animals]);

  const { status, deviceName, error, connect, disconnect } = useBluetooth(handleTag);
  const btUi = BT_STATUS_UI[status];

  const handleReset = () => { setFoundAnimal(null); setNotFound(null); };

  const handleRegister = () => {
    if (!foundAnimal) return;
    setRecent(prev => [{ id: foundAnimal.arete, peso: foundAnimal.peso, estado: foundAnimal.estado }, ...prev.slice(0, 4)]);
    onRegistrarPesaje?.(foundAnimal, foundAnimal.peso);
    setFoundAnimal(null);
    setNotFound(null);
  };

  // ── Left panel: BT controls + manual input ──────────────────────────────────
  const leftPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Radar */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
        <div style={{ position: 'relative', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {status === 'connected' && (
            <>
              <span className="animate-ring"   style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', border: '1.5px solid #15803D' }}/>
              <span className="animate-ring-2" style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', border: '1.5px solid #15803D' }}/>
              <span className="animate-ring-3" style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', border: '1.5px solid #15803D' }}/>
              <span className="animate-sweep"  style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', borderTop: '2px solid rgba(21,163,74,.6)', borderRight: '2px solid transparent', borderBottom: '2px solid transparent', borderLeft: '2px solid transparent' }}/>
            </>
          )}
          {status === 'connecting' && (
            <span className="animate-sweep" style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', borderTop: '2px solid rgba(37,99,235,.5)', borderRight: '2px solid transparent', borderBottom: '2px solid transparent', borderLeft: '2px solid transparent' }}/>
          )}
          <span style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: `1px solid ${status === 'connected' ? 'rgba(21,163,74,.2)' : 'rgba(0,0,0,.07)'}` }}/>
          <span style={{ position: 'absolute', width: 84,  height: 84,  borderRadius: '50%', border: `1px solid ${status === 'connected' ? 'rgba(21,163,74,.14)' : 'rgba(0,0,0,.05)'}` }}/>
          <div style={{ width: 62, height: 62, borderRadius: '50%', background: status === 'connected' ? '#DCFCE7' : '#F0F4EF', border: `1.5px solid ${status === 'connected' ? '#15803D' : '#8FA38A'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {status === 'connected' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12.5a9 9 0 0114 0"/><path d="M8 15a5 5 0 018 0"/>
                <circle cx="12" cy="18.5" r="1.4" fill="#15803D" stroke="none"/>
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={status === 'connecting' ? '#1D4ED8' : '#4A5E4A'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Status text */}
      <div style={{ textAlign: 'center', marginTop: 14, fontFamily: 'var(--font-jetbrains)', fontSize: 16, letterSpacing: '.3px',
        color: status === 'connected' ? '#15803D' : status === 'connecting' ? '#1D4ED8' : '#4A5E4A' }}>
        {status === 'connected'   ? `Esperando arete… · ${deviceName ?? ''}` :
         status === 'connecting'  ? 'Buscando lector…' :
         status === 'unsupported' ? 'Web Bluetooth no disponible en este navegador' :
         'Lector desconectado'}
      </div>

      {/* iOS notice */}
      {status === 'unsupported' && (
        <div style={{ marginTop: 10, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 4, padding: '8px 12px', fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#92400E', textAlign: 'center' }}>
          En iPhone: empareja el lector como <b>teclado Bluetooth</b> en Ajustes → Bluetooth y usa el campo de texto.
        </div>
      )}

      {/* BT action button */}
      {status !== 'unsupported' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          {status === 'connected' ? (
            <button onClick={disconnect} style={{ height: 44, padding: '0 24px', border: '1px solid #FCA5A5', borderRadius: 4, background: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>
              Desconectar lector
            </button>
          ) : (
            <button onClick={connect} disabled={status === 'connecting'} style={{ height: 48, padding: '0 28px', border: 'none', borderRadius: 4, background: status === 'connecting' ? '#3A4D3A' : '#1D4ED8', color: '#fff', fontWeight: 800, fontSize: 18, cursor: status === 'connecting' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(37,99,235,.25)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
              </svg>
              {status === 'connecting' ? 'Conectando…' : 'Conectar lector BT'}
            </button>
          )}
        </div>
      )}

      {/* BT error */}
      {error && (
        <div style={{ marginTop: 10, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 4, padding: '7px 12px', fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px' }}>
        <div style={{ flex: 1, height: 1, background: '#B9C6B4' }}/>
        <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', letterSpacing: '.5px' }}>O ESCRIBE EL CÓDIGO</span>
        <div style={{ flex: 1, height: 1, background: '#B9C6B4' }}/>
      </div>

      {/* Manual input — always visible */}
      <ManualInput onTag={handleTag} />

      {/* Not found + create form */}
      {notFound && fincaId && (
        <CrearAnimalForm
          arete={notFound} fincaId={fincaId} potreros={potreros}
          onCancelar={() => setNotFound(null)}
          onCreado={() => { setNotFound(null); onAnimalCreado?.(); }}
        />
      )}
      {notFound && !fincaId && (
        <div style={{ marginTop: 10, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 4, padding: '8px 12px', fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#B45309' }}>
          Arete <b>{notFound}</b> no registrado en esta finca
        </div>
      )}
    </div>
  );

  // ── Right panel: animal card or recent ──────────────────────────────────────
  const rightPanel = (
    <div>
      {foundAnimal ? (
        <AnimalCard animal={foundAnimal} onReset={handleReset} onRegister={handleRegister} />
      ) : (
        <RecentList recent={recent} />
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 84 }}>
      {/* Header */}
      <div className="rfid-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '56px 20px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 38, height: 38, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#0F1A0F" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: '.4px' }}>Lector RFID</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: btUi.bg, border: `1px solid ${btUi.border}`, padding: '5px 9px', borderRadius: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: btUi.dot, display: 'block', flexShrink: 0 }} className={status === 'connecting' ? 'animate-blink' : undefined}/>
          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: btUi.text, fontWeight: 600 }}>
            {deviceName ?? btUi.label}
          </span>
        </div>
      </div>

      {/* Body — responsive: 1 col mobile, 2 col desktop */}
      <div style={{ flex: 1, padding: '8px 20px 12px' }}>
        {/* Desktop: 2-column grid via CSS class */}
        <style>{`
          @media (min-width: 768px) {
            .rfid-grid { display: grid !important; grid-template-columns: 340px 1fr; gap: 32px; align-items: start; }
            .rfid-right { border-left: 1px solid #B9C6B4; padding-left: 28px; }
          }
        `}</style>
        <div className="rfid-grid">
          <div>{leftPanel}</div>
          <div className="rfid-right">{rightPanel}</div>
        </div>

        {/* Mobile: show right panel below left only when animal found */}
        <style>{`
          @media (max-width: 767px) {
            .rfid-right { display: none !important; }
          }
        `}</style>
        {/* Mobile animal found / recent — shown below left panel on mobile */}
        <div style={{ marginTop: 8 }} className="rfid-mobile-right">
          <style>{`
            .rfid-mobile-right { display: none; }
            @media (max-width: 767px) { .rfid-mobile-right { display: block !important; } }
          `}</style>
          {foundAnimal ? (
            <AnimalCard animal={foundAnimal} onReset={handleReset} onRegister={handleRegister} />
          ) : (
            <RecentList recent={recent} />
          )}
        </div>
      </div>
    </div>
  );
}
