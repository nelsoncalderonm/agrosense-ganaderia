'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { RoleKey } from '@/data/agrosense';
import {
  DbAnimal, DbFinca, DbGuia, GuiaMotivo,
  getGuias, crearGuiaBorrador, marcarGuiaEmitida, anularGuia,
  actualizarPredioSinigan, actualizarAnimalSinigan,
} from '@/lib/supabase';
import { useBluetooth } from '@/hooks/useBluetooth';

interface Props {
  onOpenDrawer: () => void;
  finca?: DbFinca;
  role: RoleKey;
  animales: DbAnimal[];
  onRefresh: () => void;
}

const MOTIVOS: { key: GuiaMotivo; label: string }[] = [
  { key: 'venta', label: 'Venta' },
  { key: 'traslado', label: 'Traslado a otro predio' },
  { key: 'feria', label: 'Feria o subasta' },
  { key: 'sacrificio', label: 'Planta de beneficio' },
  { key: 'otro', label: 'Otro' },
];
const TIPOS_DOC = ['CC', 'CE', 'NIT', 'PPT', 'PAS'];

// Quita espacios, puntos y guiones para comparar lo que lee el lector con lo guardado.
export function normalizarChapeta(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s.·\-_]/g, '');
}

// Un DIN ISO 11784 oficial de Colombia tiene 15 dígitos y empieza por 170.
export function pareceDinColombia(tag: string): boolean {
  return /^170\d{12}$/.test(normalizarChapeta(tag));
}

function buscarAnimal(animales: DbAnimal[], tag: string): DbAnimal | undefined {
  const t = normalizarChapeta(tag);
  const exacto = animales.find(a =>
    [a.din, a.rfid, a.arete].some(v => v && normalizarChapeta(v) === t));
  if (exacto) return exacto;
  // Algunos lectores agregan o quitan ceros o el prefijo del país: comparar por el final.
  if (t.length < 8) return undefined;
  return animales.find(a =>
    [a.din, a.rfid].some(v => {
      const n = v ? normalizarChapeta(v) : '';
      return n.length >= 8 && (n.endsWith(t) || t.endsWith(n));
    }));
}

type Lectura = { chapeta: string; animalId: string | null };

const card: React.CSSProperties = { background: '#fff', border: '1px solid #B9C6B4', borderRadius: 6, padding: 18 };
const inp: React.CSSProperties = {
  height: 46, border: '1px solid #8FA38A', borderRadius: 4, padding: '0 12px', fontSize: 18,
  background: '#fff', outline: 'none', fontFamily: 'inherit', color: '#0F1A0F', boxSizing: 'border-box', width: '100%',
};
const lbl: React.CSSProperties = { fontSize: 14, color: '#3A4D3A', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4, display: 'block' };
const btn = (bg: string, disabled = false): React.CSSProperties => ({
  height: 48, padding: '0 16px', border: 'none', borderRadius: 4, background: disabled ? '#8FA38A' : bg,
  color: '#fff', fontWeight: 800, fontSize: 17, cursor: disabled ? 'default' : 'pointer',
});
const btnSec: React.CSSProperties = {
  height: 48, padding: '0 16px', border: '1px solid #8FA38A', borderRadius: 4, background: '#fff',
  color: '#0F1A0F', fontWeight: 700, fontSize: 17, cursor: 'pointer',
};

function Chip({ color, children }: { color: 'green' | 'amber' | 'red' | 'gray'; children: React.ReactNode }) {
  const c = {
    green: ['#DCFCE7', '#15803D'], amber: ['#FEF3C7', '#B45309'], red: ['#FEE2E2', '#B91C1C'], gray: ['#F3F4F6', '#374151'],
  }[color];
  return <span style={{ background: c[0], color: c[1], fontSize: 14, fontWeight: 800, borderRadius: 3, padding: '3px 8px', whiteSpace: 'nowrap' }}>{children}</span>;
}

function Titulo({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 20 }}>{children}</div>
      {sub && <div style={{ fontSize: 16, color: '#3A4D3A', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Datos del predio ────────────────────────────────────────────────────────
function PredioForm({ finca, puedeEditar, onGuardado }: { finca: DbFinca; puedeEditar: boolean; onGuardado: () => void }) {
  const [ruv, setRuv] = useState(finca.ruv ?? '');
  const [depto, setDepto] = useState(finca.departamento ?? '');
  const [muni, setMuni] = useState(finca.municipio ?? '');
  const [tipoDoc, setTipoDoc] = useState(finca.responsable_tipo_doc ?? 'CC');
  const [doc, setDoc] = useState(finca.responsable_documento ?? '');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const guardar = async () => {
    setGuardando(true); setMsg(null);
    const { error } = await actualizarPredioSinigan(finca.id, { ruv, departamento: depto, municipio: muni, tipo_doc: tipoDoc, documento: doc });
    setGuardando(false);
    if (error) { setMsg(`No se pudo guardar: ${error}`); return; }
    setMsg('Guardado');
    onGuardado();
  };

  return (
    <div style={card}>
      <Titulo sub="Los mismos datos con los que el predio está en Sinigán.">Datos del predio</Titulo>
      <div style={{ display: 'grid', gap: 10 }}>
        <div><label style={lbl}>RUV DEL PREDIO</label>
          <input style={inp} value={ruv} onChange={e => setRuv(e.target.value)} disabled={!puedeEditar} placeholder="Registro Único de Vacunación" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>DEPARTAMENTO</label>
            <input style={inp} value={depto} onChange={e => setDepto(e.target.value)} disabled={!puedeEditar} /></div>
          <div><label style={lbl}>MUNICIPIO</label>
            <input style={inp} value={muni} onChange={e => setMuni(e.target.value)} disabled={!puedeEditar} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10 }}>
          <div><label style={lbl}>TIPO DOC.</label>
            <select style={inp} value={tipoDoc} onChange={e => setTipoDoc(e.target.value)} disabled={!puedeEditar}>
              {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div><label style={lbl}>DOCUMENTO DEL RESPONSABLE</label>
            <input style={inp} value={doc} onChange={e => setDoc(e.target.value)} disabled={!puedeEditar} inputMode="numeric" /></div>
        </div>
        {puedeEditar ? (
          <button onClick={guardar} disabled={guardando} style={btn('#15803D', guardando)}>{guardando ? 'Guardando…' : 'Guardar datos del predio'}</button>
        ) : (
          <div style={{ fontSize: 16, color: '#4A5E4A' }}>Solo el propietario o el administrador pueden cambiar estos datos.</div>
        )}
        {msg && <div style={{ fontSize: 16, fontWeight: 700, color: msg === 'Guardado' ? '#15803D' : '#B91C1C' }}>{msg}</div>}
      </div>
    </div>
  );
}

// ── Completar DIN de un animal ─────────────────────────────────────────────
function FilaAnimalSinDin({ animal, onGuardado }: { animal: DbAnimal; onGuardado: () => void }) {
  const [din, setDin] = useState(animal.din ?? '');
  const [nac, setNac] = useState(animal.fecha_nacimiento ?? '');
  const [especie, setEspecie] = useState<'bovino' | 'bufalino'>(animal.especie ?? 'bovino');
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const guardar = async () => {
    setGuardando(true); setErr(null);
    const { error } = await actualizarAnimalSinigan(animal.id, { din, fecha_nacimiento: nac, especie });
    setGuardando(false);
    if (error) { setErr(error); return; }
    onGuardado();
  };

  return (
    <div style={{ borderTop: '1px solid #EDF1EA', padding: '12px 0', display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{animal.nombre ?? animal.arete} <span style={{ fontWeight: 500, color: '#4A5E4A', fontFamily: 'var(--font-jetbrains)', fontSize: 15 }}>· chapeta {animal.arete}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        <input style={inp} value={din} onChange={e => setDin(e.target.value)} placeholder="DIN oficial (15 dígitos, 170…)" inputMode="numeric" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input style={inp} type="date" value={nac} onChange={e => setNac(e.target.value)} aria-label="Fecha de nacimiento" />
          <select style={inp} value={especie} onChange={e => setEspecie(e.target.value as 'bovino' | 'bufalino')}>
            <option value="bovino">Bovino</option>
            <option value="bufalino">Bufalino</option>
          </select>
        </div>
        <button onClick={guardar} disabled={guardando} style={btn('#15803D', guardando)}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        {err && <div style={{ color: '#B91C1C', fontWeight: 700, fontSize: 16 }}>{err}</div>}
      </div>
    </div>
  );
}

// ── Pantalla ────────────────────────────────────────────────────────────────
export default function SiniganScreen({ onOpenDrawer, finca, role, animales, onRefresh }: Props) {
  const fincaId = finca?.id;
  const puedeEditarPredio = role === 'owner' || role === 'admin';
  const claveLista = fincaId ? `agrosense-sinigan-lista-${fincaId}` : null;

  // La pantalla se monta con key = finca, así que la lista guardada se lee una sola vez.
  const [lecturas, setLecturas] = useState<Lectura[]>(() => {
    if (!claveLista || typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(claveLista);
      return raw ? (JSON.parse(raw) as Lectura[]) : [];
    } catch { return []; }
  });
  const [manual, setManual] = useState('');
  const [motivo, setMotivo] = useState<GuiaMotivo>('venta');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [ruvDestino, setRuvDestino] = useState('');
  const [destino, setDestino] = useState('');
  const [transportador, setTransportador] = useState('');
  const [placa, setPlaca] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; txt: string } | null>(null);
  const [guias, setGuias] = useState<DbGuia[]>([]);
  const [verTodosSinDin, setVerTodosSinDin] = useState(false);

  const porId = useMemo(() => Object.fromEntries(animales.map(a => [a.id, a])), [animales]);
  const sinDin = animales.filter(a => !a.din);
  const conNacimiento = animales.filter(a => a.fecha_nacimiento).length;
  const predioListo = !!(finca?.ruv && finca?.responsable_documento);

  const [versionGuias, setVersionGuias] = useState(0);
  const cargarGuias = useCallback(() => setVersionGuias(v => v + 1), []);

  useEffect(() => {
    if (!fincaId) return;
    let vigente = true;
    getGuias(fincaId).then(g => { if (vigente) setGuias(g); });
    return () => { vigente = false; };
  }, [fincaId, versionGuias]);

  // La lista en curso se guarda en el teléfono: si se va la señal en la manga, no se pierde.
  useEffect(() => {
    if (!claveLista) return;
    try {
      if (lecturas.length) localStorage.setItem(claveLista, JSON.stringify(lecturas));
      else localStorage.removeItem(claveLista);
    } catch { /* sin almacenamiento local */ }
  }, [claveLista, lecturas]);

  const agregarChapeta = useCallback((raw: string) => {
    const chapeta = normalizarChapeta(raw);
    if (!chapeta) return;
    setLecturas(prev => {
      if (prev.some(l => l.chapeta === chapeta)) return prev;
      const animal = buscarAnimal(animales, chapeta);
      return [{ chapeta, animalId: animal?.id ?? null }, ...prev];
    });
  }, [animales]);

  const { status, deviceName, error: btError, connect, disconnect } = useBluetooth(agregarChapeta);

  const filas = lecturas.map(l => {
    const animal = l.animalId ? porId[l.animalId] : undefined;
    const estado: 'ok' | 'sin-din' | 'no-inventario' = !animal ? 'no-inventario' : animal.din ? 'ok' : 'sin-din';
    return { ...l, animal, estado };
  });
  const listos = filas.filter(f => f.estado === 'ok');
  const problemas = filas.length - listos.length;

  const textoLista = () => {
    const encabezado = [
      `Lista para guía Sinigán · ${finca?.nombre ?? ''}`,
      `Motivo: ${MOTIVOS.find(m => m.key === motivo)?.label} · Fecha: ${fecha}`,
      finca?.ruv ? `RUV origen: ${finca.ruv}` : 'RUV origen: (falta)',
      ruvDestino || destino ? `Destino: ${destino}${ruvDestino ? ` · RUV ${ruvDestino}` : ''}` : '',
      transportador || placa ? `Transportador: ${transportador}${placa ? ` · placa ${placa}` : ''}` : '',
      `Animales: ${filas.length}`,
    ].filter(Boolean);
    const detalle = filas.map((f, i) => `${i + 1}. ${f.animal?.din ?? 'SIN DIN'} · ${f.animal ? (f.animal.nombre ?? f.animal.arete) : `no está en inventario (${f.chapeta})`}${f.animal?.sexo ? ` · ${f.animal.sexo}` : ''}`);
    return [...encabezado, '', ...detalle].join('\n');
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoLista());
      setAviso({ ok: true, txt: 'Lista copiada. Pégala en Sinigán o en WhatsApp.' });
    } catch {
      setAviso({ ok: false, txt: 'No se pudo copiar en este teléfono.' });
    }
  };

  const compartir = async () => {
    const texto = textoLista();
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: 'Lista para guía', text: texto }); } catch { /* cancelado */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    }
  };

  const guardarLista = async () => {
    if (!fincaId || !filas.length) return;
    setGuardando(true); setAviso(null);
    const { error } = await crearGuiaBorrador({
      finca_id: fincaId, motivo, fecha,
      ruv_destino: ruvDestino.trim() || null, destino_nombre: destino.trim() || null,
      transportador: transportador.trim() || null, placa: placa.trim().toUpperCase() || null, notas: null,
      animales: filas.map(f => ({ animal_id: f.animal?.id ?? null, din: f.animal?.din ?? null, chapeta_leida: f.chapeta })),
    });
    setGuardando(false);
    if (error) { setAviso({ ok: false, txt: `No se pudo guardar (¿sin señal?). La lista sigue en el teléfono. ${error}` }); return; }
    setLecturas([]); setRuvDestino(''); setDestino(''); setTransportador(''); setPlaca('');
    setAviso({ ok: true, txt: 'Lista guardada. Cuando emitas la guía en Sinigán, anota aquí el número.' });
    cargarGuias();
  };

  const usarComoDin = async (animal: DbAnimal, chapeta: string) => {
    const { error } = await actualizarAnimalSinigan(animal.id, { din: chapeta });
    if (error) { setAviso({ ok: false, txt: error }); return; }
    onRefresh();
  };

  if (!finca) return null;
  const btConectado = status === 'connected';

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 16px 0' }}>
        <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F1A0F" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div style={{ fontWeight: 800, fontSize: 25 }}>Sinigán</div>
        <Chip color="amber">PRÓXIMAMENTE</Chip>
      </div>

      <div className="ag-list-grid" style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Próximamente */}
        <div style={{ ...card, background: '#FFFBEB', borderColor: '#FCD34D' }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Conexión directa con Sinigán: próximamente</div>
          <div style={{ fontSize: 17, lineHeight: 1.45, color: '#3A2E0A' }}>
            Estamos gestionando con el ICA para sacar guías y bonos desde AgroSense. Mientras tanto, aquí dejas todo listo:
            los datos del predio, el DIN de cada animal y la lista de animales de cada guía, leyendo las chapetas.
          </div>
          <a href="https://sinigan.co" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 12, fontWeight: 800, fontSize: 17, color: '#B45309' }}>Abrir Sinigán →</a>
        </div>

        {/* Preparación */}
        <div style={card}>
          <Titulo sub="Lo que Sinigán revisa antes de dejarte sacar una guía.">Tu finca frente a Sinigán</Titulo>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 18 }}>
              <span>Predio con RUV y responsable</span>
              {predioListo ? <Chip color="green">LISTO</Chip> : <Chip color="red">FALTA</Chip>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 18 }}>
              <span>Animales con DIN oficial</span>
              <Chip color={sinDin.length === 0 && animales.length ? 'green' : 'amber'}>{animales.length - sinDin.length} de {animales.length}</Chip>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 18 }}>
              <span>Con fecha de nacimiento</span>
              <Chip color={conNacimiento === animales.length && animales.length ? 'green' : 'amber'}>{conNacimiento} de {animales.length}</Chip>
            </div>
          </div>
        </div>

        {/* Lista para guía */}
        <div style={card}>
          <Titulo sub="Pasa el lector por cada animal que va a salir. Sin DIN, Sinigán no expide la guía.">Armar lista para guía</Titulo>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {status === 'unsupported' ? (
              <div style={{ fontSize: 16, color: '#4A5E4A' }}>Este navegador no conecta lectores Bluetooth. Escribe la chapeta abajo.</div>
            ) : btConectado ? (
              <>
                <Chip color="green">LECTOR CONECTADO{deviceName ? ` · ${deviceName}` : ''}</Chip>
                <button onClick={disconnect} style={{ ...btnSec, height: 40 }}>Desconectar</button>
              </>
            ) : (
              <button onClick={connect} disabled={status === 'connecting'} style={btn('#0F1A0F', status === 'connecting')}>
                {status === 'connecting' ? 'Buscando lector…' : 'Conectar lector RFID'}
              </button>
            )}
          </div>
          {btError && <div style={{ color: '#B91C1C', fontSize: 16, marginBottom: 8 }}>{btError}</div>}

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              style={{ ...inp, flex: 1, fontFamily: 'var(--font-jetbrains)' }}
              value={manual}
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarChapeta(manual); setManual(''); } }}
              placeholder="Chapeta o DIN"
              autoComplete="off" autoCorrect="off" spellCheck={false}
            />
            <button onClick={() => { agregarChapeta(manual); setManual(''); }} style={btn('#0F1A0F')}>Agregar</button>
          </div>

          {filas.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <Chip color="green">{listos.length} LISTOS</Chip>
              {problemas > 0 && <Chip color="red">{problemas} CON PROBLEMA</Chip>}
            </div>
          )}

          <div>
            {filas.map(f => (
              <div key={f.chapeta} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #EDF1EA', padding: '10px 0' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.animal ? (f.animal.nombre ?? f.animal.arete) : 'No está en el inventario'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#4A5E4A', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.animal?.din ? `DIN ${f.animal.din}` : `Leído: ${f.chapeta}`}
                  </div>
                  {f.estado === 'sin-din' && f.animal && pareceDinColombia(f.chapeta) && (
                    <button onClick={() => usarComoDin(f.animal!, f.chapeta)} style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, color: '#15803D', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
                      Usar esta chapeta como DIN
                    </button>
                  )}
                </div>
                {f.estado === 'ok' && <Chip color="green">OK</Chip>}
                {f.estado === 'sin-din' && <Chip color="amber">SIN DIN</Chip>}
                {f.estado === 'no-inventario' && <Chip color="red">NO REGISTRADO</Chip>}
                <button onClick={() => setLecturas(prev => prev.filter(l => l.chapeta !== f.chapeta))} aria-label="Quitar" style={{ width: 40, height: 40, border: '1px solid #B9C6B4', borderRadius: 4, background: '#fff', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>

          {filas.length > 0 && (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>MOTIVO</label>
                  <select style={inp} value={motivo} onChange={e => setMotivo(e.target.value as GuiaMotivo)}>
                    {MOTIVOS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select></div>
                <div><label style={lbl}>FECHA</label>
                  <input style={inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>DESTINO</label>
                  <input style={inp} value={destino} onChange={e => setDestino(e.target.value)} placeholder="Finca, feria o planta" /></div>
                <div><label style={lbl}>RUV DESTINO</label>
                  <input style={inp} value={ruvDestino} onChange={e => setRuvDestino(e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>TRANSPORTADOR</label>
                  <input style={inp} value={transportador} onChange={e => setTransportador(e.target.value)} /></div>
                <div><label style={lbl}>PLACA</label>
                  <input style={inp} value={placa} onChange={e => setPlaca(e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={copiar} style={btnSec}>Copiar lista</button>
                <button onClick={compartir} style={btnSec}>Compartir</button>
              </div>
              <button onClick={guardarLista} disabled={guardando} style={btn('#15803D', guardando)}>
                {guardando ? 'Guardando…' : `Guardar lista (${filas.length} animales)`}
              </button>
              <button onClick={() => setLecturas([])} style={{ background: 'none', border: 'none', color: '#B91C1C', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Borrar lista</button>
            </div>
          )}
          {aviso && <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: aviso.ok ? '#15803D' : '#B91C1C' }}>{aviso.txt}</div>}
        </div>

        {/* Animales sin DIN */}
        {sinDin.length > 0 && (
          <div style={card}>
            <Titulo sub="Escribe el número de la chapeta oficial del ICA (DIN) y la fecha de nacimiento.">{`Animales sin DIN (${sinDin.length})`}</Titulo>
            {(verTodosSinDin ? sinDin : sinDin.slice(0, 5)).map(a => (
              <FilaAnimalSinDin key={a.id} animal={a} onGuardado={onRefresh} />
            ))}
            {sinDin.length > 5 && !verTodosSinDin && (
              <button onClick={() => setVerTodosSinDin(true)} style={{ ...btnSec, width: '100%', marginTop: 8 }}>Ver los {sinDin.length}</button>
            )}
          </div>
        )}

        {/* Predio */}
        <PredioForm key={finca.id} finca={finca} puedeEditar={puedeEditarPredio} onGuardado={onRefresh} />

        {/* Listas guardadas */}
        <div style={card}>
          <Titulo sub="Cuando emitas la guía en Sinigán, anota el número para tener la trazabilidad completa.">Listas y guías</Titulo>
          {guias.length === 0 && <div style={{ fontSize: 17, color: '#4A5E4A' }}>Todavía no hay listas guardadas.</div>}
          {guias.map(g => <FilaGuia key={g.id} guia={g} onCambio={cargarGuias} />)}
        </div>
      </div>
    </div>
  );
}

function FilaGuia({ guia, onCambio }: { guia: DbGuia; onCambio: () => void }) {
  const [numero, setNumero] = useState('');
  const [bono, setBono] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const n = guia.guia_animales?.length ?? 0;
  const sinDin = guia.guia_animales?.filter(a => !a.din).length ?? 0;
  const motivo = MOTIVOS.find(m => m.key === guia.motivo)?.label ?? guia.motivo;

  const emitir = async () => {
    if (!numero.trim()) { setErr('Escribe el número de guía'); return; }
    const { error } = await marcarGuiaEmitida(guia.id, numero, bono || null);
    if (error) { setErr(error); return; }
    onCambio();
  };
  const anular = async () => {
    const { error } = await anularGuia(guia.id);
    if (error) { setErr(error); return; }
    onCambio();
  };

  return (
    <div style={{ borderTop: '1px solid #EDF1EA', padding: '12px 0', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{motivo} · {n} animales</div>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#4A5E4A' }}>
            {guia.fecha}{guia.destino_nombre ? ` · ${guia.destino_nombre}` : ''}{guia.numero_guia ? ` · Guía ${guia.numero_guia}` : ''}
          </div>
        </div>
        {guia.estado === 'borrador' && <Chip color="amber">POR EMITIR</Chip>}
        {guia.estado === 'emitida' && <Chip color="green">EMITIDA</Chip>}
        {guia.estado === 'cerrada' && <Chip color="green">CERRADA</Chip>}
        {guia.estado === 'anulada' && <Chip color="gray">ANULADA</Chip>}
      </div>
      {guia.estado === 'borrador' && (
        <>
          {sinDin > 0 && <div style={{ fontSize: 16, color: '#B45309', fontWeight: 700 }}>{sinDin} animales sin DIN: complétalos antes de ir a Sinigán.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input style={inp} value={numero} onChange={e => setNumero(e.target.value)} placeholder="N.º de guía" />
            <input style={inp} value={bono} onChange={e => setBono(e.target.value)} placeholder="N.º bono (si hay)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <button onClick={emitir} style={btn('#15803D')}>Marcar emitida</button>
            <button onClick={anular} style={btnSec}>Anular</button>
          </div>
        </>
      )}
      {err && <div style={{ color: '#B91C1C', fontWeight: 700, fontSize: 16 }}>{err}</div>}
    </div>
  );
}
