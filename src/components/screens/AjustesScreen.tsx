'use client';

import { useEffect, useState } from 'react';
import { RoleKey } from '@/data/agrosense';
import UbicacionFinca from '../ui/UbicacionFinca';
import { DbFinca, DbMembresia, actualizarFinca, actualizarVentaFinca, actualizarMembresia, eliminarMembresia, cambiarPassword, getConectadosTelegram } from '@/lib/supabase';
import { TelegramCard, EnlaceTelegramMiembro } from './TelegramCard';

interface Props {
  onOpenDrawer: () => void;
  finca?: DbFinca;
  role: RoleKey;
  miembros: DbMembresia[];
  miMembresiaId?: string;
  displayName: string;
  onFincaActualizada: () => void;
  onMiembrosActualizados: () => void;
}

const ROLE_OPTIONS: { value: RoleKey; label: string }[] = [
  { value: 'owner', label: 'Propietario' },
  { value: 'admin', label: 'Administrador' },
  { value: 'contable', label: 'Contable' },
  { value: 'vaquero', label: 'Vaquero' },
];

const inp: React.CSSProperties = {
  width: '100%', height: 42, border: '1px solid #8FA38A', borderRadius: 4,
  padding: '0 12px', fontSize: 18, background: '#fff', outline: 'none',
  fontFamily: 'inherit', color: '#0F1A0F', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: 14, color: '#3A4D3A', fontWeight: 700, letterSpacing: '.5px',
  marginBottom: 4, display: 'block',
};
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #B9C6B4', borderRadius: 6, padding: 16,
};

// Meta de peso para sacar al matadero y precio del kilo en pie.
function VentaFincaForm({ finca, onGuardado }: { finca: DbFinca; onGuardado: () => void }) {
  const [meta, setMeta] = useState(String(finca.meta_peso_kg ?? 480));
  const [precio, setPrecio] = useState(finca.precio_kg != null ? String(finca.precio_kg) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const grande: React.CSSProperties = { ...inp, height: 50, fontSize: 20, fontWeight: 800 };

  const handleGuardar = async () => {
    const m = parseFloat(meta);
    const p = precio ? parseFloat(precio.replace(/\./g, '').replace(',', '.')) : null;
    if (!m || m < 100 || m > 1500) { setErr('La meta debe estar entre 100 y 1.500 kg'); return; }
    if (p != null && (isNaN(p) || p <= 0)) { setErr('Precio del kilo inválido'); return; }
    setSaving(true); setErr(null); setOk(false);
    const { error } = await actualizarVentaFinca(finca.id, { meta_peso_kg: m, precio_kg: p });
    setSaving(false);
    if (error) { setErr(navigator.onLine ? error : 'Sin señal: guárdelo cuando tenga internet'); return; }
    setOk(true);
    onGuardado();
  };

  return (
    <div id="ajustes-venta" style={{ ...card, borderLeft: '4px solid #15A34A' }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Venta al matadero</div>
      <div style={{ fontSize: 13, color: '#6E8A6E', marginBottom: 14 }}>Con esto la app le dice cuáles animales ya están listos y cuánto vale su ganado hoy.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label style={{ ...lbl, fontSize: 11.5 }}>META DE PESO PARA VENDER (KG)</label>
          <input style={grande} type="number" inputMode="numeric" min={100} max={1500} value={meta} onChange={e => setMeta(e.target.value)} />
        </div>
        <div><label style={{ ...lbl, fontSize: 11.5 }}>PRECIO DEL KILO EN PIE HOY ($)</label>
          <input style={grande} type="number" inputMode="numeric" min={0} value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Ej: 9000" />
          {finca.precio_kg_actualizado && (
            <div style={{ fontSize: 11.5, color: '#9DB39D', marginTop: 4 }}>
              Actualizado el {new Date(finca.precio_kg_actualizado).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>
        {err && <div style={{ fontSize: 12.5, color: '#DC2626', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        {ok && <div style={{ fontSize: 12.5, color: '#15A34A', background: '#DCFCE7', padding: '6px 10px', borderRadius: 4 }}>Guardado</div>}
        <button onClick={handleGuardar} disabled={saving} style={{ height: 50, border: 'none', borderRadius: 4, background: saving ? '#6E8A6E' : '#15A34A', color: '#fff', fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer' }}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function FincaForm({ finca, onGuardado }: { finca: DbFinca; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(finca.nombre);
  const [ubicacion, setUbicacion] = useState(finca.ubicacion ?? '');
  const [hectareas, setHectareas] = useState(finca.hectareas != null ? String(finca.hectareas) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const handleGuardar = async () => {
    if (!nombre.trim()) { setErr('Nombre requerido'); return; }
    setSaving(true); setErr(null); setOk(false);
    const { error } = await actualizarFinca(finca.id, {
      nombre: nombre.trim(), ubicacion: ubicacion.trim() || null,
      hectareas: hectareas ? parseFloat(hectareas) : null,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    setOk(true);
    onGuardado();
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 14 }}>Finca</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label style={lbl}>NOMBRE</label>
          <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>UBICACIÓN</label>
            <input style={inp} value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Ciudad, depto." />
          </div>
          <div><label style={lbl}>HECTÁREAS</label>
            <input style={inp} type="number" min={0} value={hectareas} onChange={e => setHectareas(e.target.value)} />
          </div>
        </div>
        {err && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        {ok && <div style={{ fontSize: 16, color: '#15803D', background: '#DCFCE7', padding: '6px 10px', borderRadius: 4 }}>Guardado</div>}
        <button onClick={handleGuardar} disabled={saving} style={{ height: 44, border: 'none', borderRadius: 4, background: saving ? '#3A4D3A' : '#15803D', color: '#fff', fontWeight: 800, fontSize: 17, cursor: saving ? 'default' : 'pointer' }}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

function MiembroRow({ m, esUnoMismo, onActualizado, fincaId, conectado }: { m: DbMembresia; esUnoMismo: boolean; onActualizado: () => void; fincaId?: string; conectado: boolean }) {
  const [rol, setRol] = useState<RoleKey>(m.rol);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleRolChange = async (nuevoRol: RoleKey) => {
    setRol(nuevoRol);
    setSaving(true); setErr(null);
    const { error } = await actualizarMembresia(m.id, { rol: nuevoRol });
    setSaving(false);
    if (error) { setErr(error); setRol(m.rol); return; }
    onActualizado();
  };

  const handleEliminar = async () => {
    setSaving(true); setErr(null);
    const { error } = await eliminarMembresia(m.id);
    setSaving(false);
    if (error) { setErr(error); return; }
    onActualizado();
  };

  return (
    <div style={{ padding: '11px 14px', borderTop: '1px solid #EDF1EA' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>{m.nombre}{esUnoMismo ? ' (tú)' : ''}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select value={rol} onChange={e => handleRolChange(e.target.value as RoleKey)} disabled={saving} style={{ height: 32, border: '1px solid #8FA38A', borderRadius: 4, fontSize: 16, background: '#fff', color: '#0F1A0F', padding: '0 6px' }}>
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {!esUnoMismo && (
            <button onClick={handleEliminar} disabled={saving} style={{ height: 32, padding: '0 10px', border: '1px solid #FCA5A5', borderRadius: 4, background: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: 15, cursor: saving ? 'default' : 'pointer' }}>
              Quitar
            </button>
          )}
        </div>
      </div>
      {fincaId && !esUnoMismo && (m.rol === 'owner' || m.rol === 'admin') && (
        <EnlaceTelegramMiembro fincaId={fincaId} membresiaId={m.id} nombre={m.nombre} conectado={conectado} />
      )}
      {err && <div style={{ fontSize: 19, color: '#B91C1C', marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function CuentaForm({ displayName, miMembresiaId, onNombreActualizado }: { displayName: string; miMembresiaId?: string; onNombreActualizado: () => void }) {
  const [nombre, setNombre] = useState(displayName);
  const [savingNombre, setSavingNombre] = useState(false);
  const [errNombre, setErrNombre] = useState<string | null>(null);
  const [okNombre, setOkNombre] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [errPass, setErrPass] = useState<string | null>(null);
  const [okPass, setOkPass] = useState(false);

  const handleNombre = async () => {
    if (!miMembresiaId || !nombre.trim()) return;
    setSavingNombre(true); setErrNombre(null); setOkNombre(false);
    const { error } = await actualizarMembresia(miMembresiaId, { nombre: nombre.trim() });
    setSavingNombre(false);
    if (error) { setErrNombre(error); return; }
    setOkNombre(true);
    onNombreActualizado();
  };

  const handlePassword = async () => {
    if (password.length < 8) { setErrPass('Mínimo 8 caracteres'); return; }
    if (password !== confirmar) { setErrPass('Las contraseñas no coinciden'); return; }
    setSavingPass(true); setErrPass(null); setOkPass(false);
    const { error } = await cambiarPassword(password);
    setSavingPass(false);
    if (error) { setErrPass(error); return; }
    setOkPass(true);
    setPassword(''); setConfirmar('');
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 14 }}>Cuenta</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <div><label style={lbl}>NOMBRE MOSTRADO</label>
          <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} disabled={!miMembresiaId} />
        </div>
        {errNombre && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{errNombre}</div>}
        {okNombre && <div style={{ fontSize: 16, color: '#15803D', background: '#DCFCE7', padding: '6px 10px', borderRadius: 4 }}>Guardado</div>}
        <button onClick={handleNombre} disabled={savingNombre || !miMembresiaId} style={{ height: 42, border: 'none', borderRadius: 4, background: savingNombre ? '#3A4D3A' : '#15803D', color: '#fff', fontWeight: 800, fontSize: 17, cursor: savingNombre ? 'default' : 'pointer' }}>
          {savingNombre ? 'Guardando…' : 'Guardar nombre'}
        </button>
      </div>

      <div style={{ borderTop: '1px solid #B9C6B4', paddingTop: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Cambiar contraseña</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={lbl}>NUEVA CONTRASEÑA</label>
            <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          <div><label style={lbl}>CONFIRMAR</label>
            <input style={inp} type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} />
          </div>
          {errPass && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{errPass}</div>}
          {okPass && <div style={{ fontSize: 16, color: '#15803D', background: '#DCFCE7', padding: '6px 10px', borderRadius: 4 }}>Contraseña actualizada</div>}
          <button onClick={handlePassword} disabled={savingPass} style={{ height: 42, border: 'none', borderRadius: 4, background: savingPass ? '#3A4D3A' : '#0F1A0F', color: '#fff', fontWeight: 800, fontSize: 17, cursor: savingPass ? 'default' : 'pointer' }}>
            {savingPass ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AjustesScreen({ onOpenDrawer, finca, role, miembros, miMembresiaId, displayName, onFincaActualizada, onMiembrosActualizados }: Props) {
  const isOwner = role === 'owner';
  const [conectados, setConectados] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!finca || !isOwner) return;
    let vivo = true;
    getConectadosTelegram(finca.id).then(s => { if (vivo) setConectados(s); });
    return () => { vivo = false; };
  }, [finca, isOwner, miembros]);

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 16px 0' }}>
        <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F1A0F" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div style={{ fontWeight: 800, fontSize: 25 }}>Ajustes</div>
      </div>

      <div className="ag-list-grid" style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isOwner && finca && (
          <VentaFincaForm key={finca.id} finca={finca} onGuardado={onFincaActualizada} />
        )}

        <CuentaForm displayName={displayName} miMembresiaId={miMembresiaId} onNombreActualizado={onMiembrosActualizados} />

        {finca && (role === 'owner' || role === 'admin') && (
          <TelegramCard fincaId={finca.id} miMembresiaId={miMembresiaId} />
        )}

        {isOwner && finca && (
          <FincaForm finca={finca} onGuardado={onFincaActualizada} />
        )}
        {isOwner && finca && (
          <UbicacionFinca key={finca.id} finca={finca} puedeEditar onGuardado={onFincaActualizada} />
        )}

        {isOwner && (
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 14 }}>Miembros de esta finca</div>
            <div style={{ border: '1px solid #B9C6B4', borderRadius: 6, overflow: 'hidden', margin: '0 -1px' }}>
              {miembros.length === 0 && <div style={{ padding: 14, fontSize: 16, color: '#4A5E4A' }}>Sin miembros</div>}
              {miembros.map((m, i) => (
                <div key={m.id} style={{ borderTop: i === 0 ? 'none' : undefined }}>
                  <MiembroRow m={m} esUnoMismo={m.id === miMembresiaId} onActualizado={onMiembrosActualizados} fincaId={finca?.id} conectado={conectados.has(m.id)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!isOwner && (
          <div style={{ ...card, textAlign: 'center', color: '#4A5E4A' }}>
            <div style={{ fontSize: 16, fontFamily: 'var(--font-jetbrains)' }}>Solo el propietario puede editar la finca y gestionar miembros.</div>
          </div>
        )}
      </div>
    </div>
  );
}
