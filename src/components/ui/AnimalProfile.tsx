'use client';

import { useEffect, useState } from 'react';
import { Animal, CAT, ESTADO, gHexFor, gdpTxt } from '@/data/agrosense';
import AreteIcon from '@/components/ui/AreteIcon';
import { getAnimalEventos, DbAnimalEvento, DbFinca } from '@/lib/supabase';
import { fechaCorta, type Retiro } from '@/lib/venta';
import { registrarBajaOffline, registrarVentaOffline, trasladarAnimalOffline, registrarEventoSanitarioOffline, TIPOS_SANITARIOS, type TipoSanitario } from '@/lib/offline/acciones';

interface Props {
  animal: Animal;
  fincaId?: string;
  fincas?: DbFinca[];
  onClose: () => void;
  onPesaje: () => void;
  onBajaRegistrada?: () => void;
  onVentaRegistrada?: () => void;
  onTrasladoRegistrado?: () => void;
  onSanidadRegistrada?: () => void;
  retiro?: Retiro | null;   // tratamiento con días de retiro que todavía no termina
}

function AvisoRetiro({ retiro }: { retiro: Retiro }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FEE2E2', border: '2px solid #B91C1C', borderRadius: 4, padding: '12px 14px', marginBottom: 14 }}>
      <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>⛔</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#991B1B' }}>No vender hasta el {fechaCorta(retiro.hasta)}</div>
        <div style={{ fontSize: 16, color: '#991B1B', marginTop: 2 }}>Está en retiro{retiro.producto ? ` por ${retiro.producto}` : ''}. En planta lo pueden rechazar.</div>
      </div>
    </div>
  );
}

const CAUSAS = ['Enfermedad', 'Accidente', 'Depredación', 'Parto', 'Vejez', 'Otra'];

const inp: React.CSSProperties = {
  width: '100%', height: 42, border: '1px solid #8FA38A', borderRadius: 4,
  padding: '0 12px', fontSize: 18, background: '#fff', outline: 'none',
  fontFamily: 'inherit', color: '#0F1A0F', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: 14, color: '#3A4D3A', fontWeight: 700, letterSpacing: '.5px',
  marginBottom: 4, display: 'block',
};

const EVENTO_LABEL: Record<DbAnimalEvento['tipo'], { label: string; hex: string; soft: string }> = {
  nacimiento: { label: 'Nació en la finca', hex: '#15803D', soft: '#DCFCE7' },
  compra: { label: 'Compra', hex: '#1D4ED8', soft: '#DBEAFE' },
  traslado: { label: 'Traslado', hex: '#7C3AED', soft: '#EDE9FE' },
  venta: { label: 'Venta', hex: '#B45309', soft: '#FEF3C7' },
  baja: { label: 'Baja', hex: '#B91C1C', soft: '#FEE2E2' },
};

function BajaForm({ animal, fincaId, onCancelar, onRegistrada }: {
  animal: Animal; fincaId: string; onCancelar: () => void; onRegistrada: () => void;
}) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [causaCat, setCausaCat] = useState(CAUSAS[0]);
  const [detalle, setDetalle] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleGuardar = async () => {
    setSaving(true); setErr(null);
    const causa = detalle.trim() ? `${causaCat}: ${detalle.trim()}` : causaCat;
    const { error } = await registrarBajaOffline({ finca_id: fincaId, animal: { dbId: animal.dbId, nombre: animal.nombre, arete: animal.arete }, fecha, causa });
    setSaving(false);
    if (error) { setErr(error); return; }
    onRegistrada();
  };

  return (
    <div className="animate-up" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '16px 14px' }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4, color: '#B91C1C' }}>Registrar baja del arete {animal.arete}</div>
      <div style={{ fontSize: 15, color: '#991B1B', marginBottom: 12 }}>El animal se marcará como inactivo y saldrá de los listados.</div>
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
        {err && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A4D3A', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#3A4D3A' : '#B91C1C', color: '#fff', fontWeight: 800, fontSize: 17, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Confirmar baja'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VentaForm({ animal, fincaId, retiro, onCancelar, onRegistrada }: {
  animal: Animal; fincaId: string; retiro?: Retiro | null; onCancelar: () => void; onRegistrada: () => void;
}) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [pesoKg, setPesoKg] = useState(animal.peso ? String(animal.peso) : '');
  const [comprador, setComprador] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleGuardar = async () => {
    if (!pesoKg) { setErr('Peso de salida requerido'); return; }
    setSaving(true); setErr(null);
    const { error } = await registrarVentaOffline({
      animal: { dbId: animal.dbId, nombre: animal.nombre, arete: animal.arete }, finca_id: fincaId, fecha,
      peso_kg: parseFloat(pesoKg), comprador: comprador.trim() || null, notas: notas.trim() || null,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onRegistrada();
  };

  return (
    <div className="animate-up" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '16px 14px' }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4, color: '#B45309' }}>Vender el arete {animal.arete}</div>
      <div style={{ fontSize: 15, color: '#92400E', marginBottom: 12 }}>El animal se marcará como inactivo y saldrá de los listados.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>FECHA</label>
            <input style={inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div><label style={lbl}>PESO DE SALIDA (KG)</label>
            <input style={inp} type="number" min={0} value={pesoKg} onChange={e => setPesoKg(e.target.value)} placeholder="0" />
          </div>
        </div>
        {retiro && <AvisoRetiro retiro={retiro} />}
        <div><label style={lbl}>COMPRADOR</label>
          <input style={inp} value={comprador} onChange={e => setComprador(e.target.value)} placeholder="Frigorífico, subasta, particular…" autoFocus />
        </div>
        <div><label style={lbl}>NOTAS (OPCIONAL)</label>
          <input style={inp} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Precio, observaciones…" />
        </div>
        {err && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A4D3A', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#3A4D3A' : '#B45309', color: '#fff', fontWeight: 800, fontSize: 17, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Confirmar venta'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrasladoForm({ animal, fincaId, fincas, onCancelar, onRegistrada }: {
  animal: Animal; fincaId: string; fincas: DbFinca[]; onCancelar: () => void; onRegistrada: () => void;
}) {
  const destinos = fincas.filter(f => f.id !== fincaId);
  const [fincaDestinoId, setFincaDestinoId] = useState(destinos[0]?.id ?? '');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleGuardar = async () => {
    if (!fincaDestinoId) { setErr('Selecciona la finca destino'); return; }
    setSaving(true); setErr(null);
    const { error } = await trasladarAnimalOffline({
      animal: { dbId: animal.dbId, nombre: animal.nombre, arete: animal.arete }, finca_id: fincaId,
      finca_destino_id: fincaDestinoId, finca_destino_nombre: destinos.find(f => f.id === fincaDestinoId)?.nombre ?? '',
      fecha, notas: notas.trim() || null,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onRegistrada();
  };

  return (
    <div className="animate-up" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 6, padding: '16px 14px' }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12, color: '#7C3AED' }}>Trasladar el arete {animal.arete}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label style={lbl}>FINCA DESTINO</label>
          <select style={inp} value={fincaDestinoId} onChange={e => setFincaDestinoId(e.target.value)}>
            {destinos.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        </div>
        <div><label style={lbl}>FECHA</label>
          <input style={inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div><label style={lbl}>NOTAS (OPCIONAL)</label>
          <input style={inp} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Motivo del traslado" />
        </div>
        {err && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A4D3A', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#3A4D3A' : '#7C3AED', color: '#fff', fontWeight: 800, fontSize: 17, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Confirmar traslado'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SanidadForm({ animal, fincaId, onCancelar, onRegistrada }: {
  animal: Animal; fincaId: string; onCancelar: () => void; onRegistrada: () => void;
}) {
  const [tipo, setTipo] = useState<TipoSanitario>('vacuna');
  const [producto, setProducto] = useState('');
  const [dosis, setDosis] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');
  const [diasRetiro, setDiasRetiro] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleGuardar = async () => {
    const dias = diasRetiro ? parseInt(diasRetiro, 10) : null;
    if (dias != null && (isNaN(dias) || dias < 0 || dias > 365)) { setErr('Días de retiro: entre 0 y 365'); return; }
    setSaving(true); setErr(null);
    const { error } = await registrarEventoSanitarioOffline({
      finca_id: fincaId, animal: { dbId: animal.dbId, nombre: animal.nombre, arete: animal.arete },
      tipo, producto: producto.trim() || null, dosis: dosis.trim() || null, fecha, notas: notas.trim() || null,
      dias_retiro: dias || null,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onRegistrada();
  };

  return (
    <div className="animate-up" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '16px 14px' }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12, color: '#1D4ED8' }}>Sanidad · {animal.nombre}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>TIPO</label>
            <select style={inp} value={tipo} onChange={e => setTipo(e.target.value as TipoSanitario)}>
              {TIPOS_SANITARIOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div><label style={lbl}>FECHA</label>
            <input style={inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
          <div><label style={lbl}>PRODUCTO</label>
            <input style={inp} value={producto} onChange={e => setProducto(e.target.value)} placeholder="Ej: Ivermectina" />
          </div>
          <div><label style={lbl}>DOSIS</label>
            <input style={inp} value={dosis} onChange={e => setDosis(e.target.value)} placeholder="Ej: 10 ml" />
          </div>
        </div>
        <div><label style={lbl}>DÍAS DE RETIRO (LO DICE LA ETIQUETA DEL PRODUCTO)</label>
          <input style={{ ...inp, fontSize: 18, fontWeight: 700 }} type="number" inputMode="numeric" min={0} max={365} value={diasRetiro} onChange={e => setDiasRetiro(e.target.value)} placeholder="0 si no tiene" />
          {Number(diasRetiro) > 0 && (
            <div style={{ fontSize: 16, color: '#991B1B', marginTop: 5, fontWeight: 600 }}>
              No se podrá vender hasta el {fechaCorta(new Date(new Date(`${fecha}T12:00:00`).getTime() + Number(diasRetiro) * 86400000).toLocaleDateString('en-CA'))}
            </div>
          )}
        </div>
        <div><label style={lbl}>NOTAS (OPCIONAL)</label>
          <input style={inp} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones" />
        </div>
        {err && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A4D3A', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#3A4D3A' : '#1D4ED8', color: '#fff', fontWeight: 800, fontSize: 17, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Trazabilidad({ fincas, eventos, loading }: { fincas: DbFinca[]; eventos: DbAnimalEvento[]; loading: boolean }) {
  const fincaNombre = (id: string | null) => fincas.find(f => f.id === id)?.nombre ?? '—';
  const entrada = eventos.find(e => e.tipo === 'nacimiento' || e.tipo === 'compra');
  const salida = eventos.find(e => e.tipo === 'venta');

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#4A5E4A', padding: '20px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 16 }}>Cargando trazabilidad…</div>;
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Trazabilidad</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
        <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: '11px 12px' }}>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', textTransform: 'uppercase', letterSpacing: '.5px' }}>Peso de ingreso</div>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 21, marginTop: 4 }}>
            {entrada?.peso_kg != null ? `${entrada.peso_kg} kg` : 'Sin dato'}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: '11px 12px' }}>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', textTransform: 'uppercase', letterSpacing: '.5px' }}>Peso de salida</div>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 21, marginTop: 4 }}>
            {salida?.peso_kg != null ? `${salida.peso_kg} kg` : '—'}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, overflow: 'hidden' }}>
        {eventos.length === 0 && (
          <div style={{ padding: 14, fontSize: 16, color: '#4A5E4A', fontFamily: 'var(--font-jetbrains)' }}>Sin eventos registrados</div>
        )}
        {eventos.map((e, i) => {
          const c = EVENTO_LABEL[e.tipo];
          return (
            <div key={e.id} style={{ padding: '10px 14px', borderTop: i > 0 ? '1px solid #EDF1EA' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ background: c.soft, color: c.hex, fontSize: 13, fontWeight: 700, borderRadius: 3, padding: '2px 7px' }}>{c.label}</span>
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A' }}>{e.fecha}</span>
              </div>
              <div style={{ fontSize: 16, color: '#3A5A3A', marginTop: 5 }}>
                {e.tipo === 'traslado' && <>De <b>{fincaNombre(e.finca_origen_id)}</b> a <b>{fincaNombre(e.finca_id)}</b></>}
                {e.tipo === 'compra' && <>Comprado {e.contraparte ? <>a <b>{e.contraparte}</b></> : ''}</>}
                {e.tipo === 'venta' && <>Vendido {e.contraparte ? <>a <b>{e.contraparte}</b></> : ''}</>}
                {e.tipo === 'baja' && <>Causa: <b>{e.contraparte}</b></>}
                {e.tipo === 'nacimiento' && <>Finca <b>{fincaNombre(e.finca_id)}</b></>}
                {e.peso_kg != null && <> · {e.peso_kg} kg</>}
              </div>
              {e.notas && <div style={{ fontSize: 15, color: '#3A4D3A', marginTop: 3 }}>{e.notas}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnimalProfile({ animal, fincaId, fincas = [], onClose, onPesaje, onBajaRegistrada, onVentaRegistrada, onTrasladoRegistrado, onSanidadRegistrada, retiro }: Props) {
  const cat = CAT[animal.cat];
  const est = ESTADO[animal.estado];
  const gain = animal.peso - animal.pesoAnt;
  const [showBaja, setShowBaja] = useState(false);
  const [showVenta, setShowVenta] = useState(false);
  const [showTraslado, setShowTraslado] = useState(false);
  const [showSanidad, setShowSanidad] = useState(false);
  const [eventos, setEventos] = useState<DbAnimalEvento[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(true);

  useEffect(() => {
    getAnimalEventos(animal.dbId).then(ev => { setEventos(ev); setLoadingEventos(false); });
  }, [animal.dbId]);

  const showingForm = showBaja || showVenta || showTraslado || showSanidad;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 40 }} />
      <div className="animate-slide-up ag-sheet-desktop" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#EEF2EC', borderRadius: '16px 16px 0 0', zIndex: 50, maxHeight: '92%', overflowY: 'auto', paddingBottom: 32 }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#8FA38A' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid #B9C6B4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: cat.soft, border: `2px solid ${cat.hex}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, color: cat.hex, flexShrink: 0 }}>
              <AreteIcon color={cat.hex} size={30} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: '#3A4D3A', fontWeight: 700, letterSpacing: '.5px' }}>ARETE</div>
              <div style={{ fontWeight: 800, fontSize: 28, lineHeight: 1.05 }}>{animal.arete}</div>
              <div style={{ fontSize: 15, color: '#3A4D3A', marginTop: 4 }}>{animal.raza} · {animal.sexo}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <span style={{ background: cat.soft, color: cat.hex, fontSize: 14, fontWeight: 700, borderRadius: 3, padding: '2px 8px' }}>{animal.cat}</span>
                <span style={{ background: est.soft, color: est.hex, fontSize: 14, fontWeight: 700, borderRadius: 3, padding: '2px 8px' }}>{animal.estadoCorto}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A5E4A', fontSize: 25 }}>×</button>
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: est.soft, border: `1px solid ${est.hex}`, borderRadius: 4, padding: '11px 14px', marginBottom: 14 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: est.hex, flexShrink: 0, display: 'block' }}/>
            <span style={{ fontSize: 17, fontWeight: 600, color: est.hex }}>{animal.estadoTxt}</span>
          </div>

          {retiro && <AvisoRetiro retiro={retiro} />}

          {/* Weight KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginBottom: 14 }}>
            <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: '12px 10px' }}>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', textTransform: 'uppercase', letterSpacing: '.5px' }}>Peso</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 25, marginTop: 4 }}>{animal.peso}<span style={{ fontSize: 14, color: '#4A5E4A' }}> kg</span></div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: '12px 10px' }}>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', textTransform: 'uppercase', letterSpacing: '.5px' }}>GDP</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 25, marginTop: 4, color: gHexFor(animal.gdp) }}>{gdpTxt(animal.gdp)}<span style={{ fontSize: 14, color: '#4A5E4A' }}> kg/d</span></div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: '12px 10px' }}>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', textTransform: 'uppercase', letterSpacing: '.5px' }}>Ganancia</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 25, marginTop: 4, color: gain >= 0 ? '#15803D' : '#B91C1C' }}>{gain >= 0 ? '+' : ''}{Math.round(gain)}<span style={{ fontSize: 14, color: '#4A5E4A' }}> kg</span></div>
            </div>
          </div>

          {/* Details */}
          <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: '2px 0', marginBottom: 14 }}>
            {[
              { label: 'Raza', value: animal.raza },
              { label: 'Sexo', value: animal.sexo },
              { label: 'Potrero', value: animal.potrero },
              { label: 'Días en potrero', value: `${animal.dias} días` },
              { label: 'Peso anterior', value: `${animal.pesoAnt} kg` },
              { label: 'Período medición', value: `${animal.diasEnt} días` },
            ].map((row, i, arr) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #EDF1EA' : 'none' }}>
                <span style={{ fontSize: 17, color: '#3A4D3A' }}>{row.label}</span>
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 16, fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>

          <Trazabilidad fincas={fincas} eventos={eventos} loading={loadingEventos} />

          {showBaja && fincaId && (
            <BajaForm
              animal={animal} fincaId={fincaId}
              onCancelar={() => setShowBaja(false)}
              onRegistrada={() => { setShowBaja(false); onBajaRegistrada?.(); onClose(); }}
            />
          )}
          {showVenta && fincaId && (
            <VentaForm
              animal={animal} fincaId={fincaId} retiro={retiro}
              onCancelar={() => setShowVenta(false)}
              onRegistrada={() => { setShowVenta(false); onVentaRegistrada?.(); onClose(); }}
            />
          )}
          {showSanidad && fincaId && (
            <SanidadForm
              animal={animal} fincaId={fincaId}
              onCancelar={() => setShowSanidad(false)}
              onRegistrada={() => { setShowSanidad(false); onSanidadRegistrada?.(); }}
            />
          )}
          {showTraslado && fincaId && (
            <TrasladoForm
              animal={animal} fincaId={fincaId} fincas={fincas}
              onCancelar={() => setShowTraslado(false)}
              onRegistrada={() => { setShowTraslado(false); onTrasladoRegistrado?.(); onClose(); }}
            />
          )}

          {!showingForm && (
            <>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 9 }}>
                <button onClick={onClose} style={{ flex: 1, height: 52, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A5A3A', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>Cerrar</button>
                <button onClick={onPesaje} style={{ flex: 1.4, height: 52, border: 'none', borderRadius: 4, background: '#15803D', color: '#fff', fontWeight: 800, fontSize: 18, cursor: 'pointer', boxShadow: '0 4px 14px rgba(21,163,74,.28)' }}>
                  Registrar pesaje
                </button>
              </div>
              {fincaId && (
                <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                  <button onClick={() => setShowSanidad(true)} style={{ flex: 1, height: 44, border: '1px solid #BFDBFE', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                    Sanidad
                  </button>
                  {fincas.length > 1 && (
                    <button onClick={() => setShowTraslado(true)} style={{ flex: 1, height: 44, border: '1px solid #DDD6FE', borderRadius: 4, background: '#F5F3FF', color: '#7C3AED', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                      Trasladar
                    </button>
                  )}
                  <button onClick={() => setShowVenta(true)} style={{ flex: 1, height: 44, border: '1px solid #FDE68A', borderRadius: 4, background: '#FFFBEB', color: '#B45309', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                    Vender
                  </button>
                  <button onClick={() => setShowBaja(true)} style={{ flex: 1, height: 44, border: '1px solid #FCA5A5', borderRadius: 4, background: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                    Baja
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
