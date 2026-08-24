'use client';

import { useEffect, useState } from 'react';
import { RoleKey } from '@/data/agrosense';
import { supabase, getFincas, getMembresiasFinca, crearFinca, DbFinca, DbMembresia, getOrganizaciones, crearOrganizacion, DbOrganizacion } from '@/lib/supabase';

interface Props {
  onOpenDrawer: () => void;
}

const ROLE_OPTIONS: { value: RoleKey; label: string }[] = [
  { value: 'owner', label: 'Propietario — acceso total' },
  { value: 'admin', label: 'Administrador — hato y operación, sin finanzas' },
  { value: 'contable', label: 'Contable — solo finanzas' },
];

const ROLE_LABEL: Record<RoleKey, string> = {
  owner: 'Propietario', admin: 'Administrador', vaquero: 'Vaquero', contable: 'Contable',
};

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const inp: React.CSSProperties = {
  width: '100%', height: 42, border: '1px solid #C5D2C0', borderRadius: 4,
  padding: '0 12px', fontSize: 14, background: '#fff', outline: 'none',
  fontFamily: 'inherit', color: '#1A2B1A', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: 10, color: '#6E8A6E', fontWeight: 700, letterSpacing: '.5px',
  marginBottom: 4, display: 'block',
};

function CrearOrganizacionForm({ onCreada }: { onCreada: () => void }) {
  const [nombre, setNombre] = useState('');
  const [nit, setNit] = useState('');
  const [contactoNombre, setContactoNombre] = useState('');
  const [contactoEmail, setContactoEmail] = useState('');
  const [contactoTelefono, setContactoTelefono] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true); setErr(null);
    const { error } = await crearOrganizacion({
      nombre: nombre.trim(),
      nit: nit.trim() || null,
      contacto_nombre: contactoNombre.trim() || null,
      contacto_email: contactoEmail.trim() || null,
      contacto_telefono: contactoTelefono.trim() || null,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    setNombre(''); setNit(''); setContactoNombre(''); setContactoEmail(''); setContactoTelefono('');
    onCreada();
  };

  return (
    <form onSubmit={handleCrear} style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={lbl}>NOMBRE DEL CLIENTE</label>
        <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Ganadería El Roble S.A.S." />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>NIT</label>
          <input style={inp} value={nit} onChange={e => setNit(e.target.value)} placeholder="900.123.456-7" />
        </div>
        <div>
          <label style={lbl}>CONTACTO</label>
          <input style={inp} value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} placeholder="Nombre del contacto" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>CORREO</label>
          <input style={inp} type="email" value={contactoEmail} onChange={e => setContactoEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        </div>
        <div>
          <label style={lbl}>TELÉFONO</label>
          <input style={inp} value={contactoTelefono} onChange={e => setContactoTelefono(e.target.value)} placeholder="300 000 0000" />
        </div>
      </div>
      {err && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEE2E2', padding: '8px 10px', borderRadius: 4 }}>{err}</div>}
      <button type="submit" disabled={saving} style={{ height: 46, border: 'none', borderRadius: 4, background: saving ? '#6E8A6E' : '#15A34A', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
        {saving ? 'Creando…' : 'Crear cliente'}
      </button>
    </form>
  );
}

function CrearFincaForm({ organizaciones, onCreada }: { organizaciones: DbOrganizacion[]; onCreada: () => void }) {
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [hectareas, setHectareas] = useState('');
  const [organizacionId, setOrganizacionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true); setErr(null);
    const { error } = await crearFinca({
      nombre: nombre.trim(),
      ubicacion: ubicacion.trim() || null,
      hectareas: hectareas ? parseFloat(hectareas) : null,
      organizacion_id: organizacionId || null,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    setNombre(''); setUbicacion(''); setHectareas(''); setOrganizacionId('');
    onCreada();
  };

  return (
    <form onSubmit={handleCrear} style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={lbl}>CLIENTE DUEÑO</label>
        <select style={inp} value={organizacionId} onChange={e => setOrganizacionId(e.target.value)}>
          <option value="">Sin cliente asignado</option>
          {organizaciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </div>
      <div>
        <label style={lbl}>NOMBRE DE LA FINCA</label>
        <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Finca Los Alpes" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>UBICACIÓN</label>
          <input style={inp} value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Ciudad, depto." />
        </div>
        <div>
          <label style={lbl}>HECTÁREAS</label>
          <input style={inp} type="number" min={0} value={hectareas} onChange={e => setHectareas(e.target.value)} placeholder="0" />
        </div>
      </div>
      {err && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEE2E2', padding: '8px 10px', borderRadius: 4 }}>{err}</div>}
      <button type="submit" disabled={saving} style={{ height: 46, border: 'none', borderRadius: 4, background: saving ? '#6E8A6E' : '#15A34A', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
        {saving ? 'Creando…' : 'Crear finca'}
      </button>
    </form>
  );
}

export default function AdminScreen({ onOpenDrawer }: Props) {
  const [fincas, setFincas] = useState<DbFinca[]>([]);
  const [fincaId, setFincaId] = useState('');
  const [miembros, setMiembros] = useState<DbMembresia[]>([]);
  const [loadingMiembros, setLoadingMiembros] = useState(false);
  const [organizaciones, setOrganizaciones] = useState<DbOrganizacion[]>([]);

  const reloadOrganizaciones = () => getOrganizaciones().then(setOrganizaciones);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(randomPassword());
  const [rol, setRol] = useState<RoleKey>('owner');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  const reloadFincas = () => getFincas().then(f => {
    setFincas(f);
    setFincaId(prev => (prev && f.some(x => x.id === prev)) ? prev : (f[0]?.id ?? ''));
  });

  useEffect(() => { reloadFincas(); reloadOrganizaciones(); }, []);

  useEffect(() => {
    if (!fincaId) return;
    setLoadingMiembros(true);
    getMembresiasFinca(fincaId).then(m => { setMiembros(m); setLoadingMiembros(false); });
  }, [fincaId, lastCreated]);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fincaId || !nombre.trim() || !email.trim() || password.length < 8) return;
    setSaving(true); setErr(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ email: email.trim(), password, nombre: nombre.trim(), rol, finca_id: fincaId }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(json.error ?? 'Error al crear el usuario'); return; }
    setLastCreated({ email: email.trim(), password });
    setNombre(''); setEmail(''); setPassword(randomPassword());
  };

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 16px 0' }}>
        <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A2B1A" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div style={{ fontWeight: 800, fontSize: 22 }}>Administración</div>
      </div>

      <div className="ag-dash-grid" style={{ padding: '16px 16px 24px' }}>
        <div className="ag-dash-left">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Crear cliente</div>
          <CrearOrganizacionForm onCreada={reloadOrganizaciones} />

          <div style={{ fontWeight: 700, fontSize: 14, margin: '22px 0 10px' }}>Crear finca</div>
          <CrearFincaForm organizaciones={organizaciones} onCreada={reloadFincas} />

          <div style={{ fontWeight: 700, fontSize: 14, margin: '22px 0 10px' }}>Crear cuenta</div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>FINCA</label>
            <select style={inp} value={fincaId} onChange={e => setFincaId(e.target.value)}>
              {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
          <form onSubmit={handleCrear} style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={lbl}>NOMBRE</label>
              <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div>
              <label style={lbl}>CORREO</label>
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label style={lbl}>ROL</label>
              <select style={inp} value={rol} onChange={e => setRol(e.target.value as RoleKey)}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>CONTRASEÑA TEMPORAL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inp} value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setPassword(randomPassword())} style={{ height: 42, padding: '0 12px', border: '1px solid #C5D2C0', borderRadius: 4, background: '#fff', color: '#3A5A3A', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Generar
                </button>
              </div>
            </div>

            {err && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEE2E2', padding: '8px 10px', borderRadius: 4 }}>{err}</div>}

            <button type="submit" disabled={saving} style={{ height: 46, border: 'none', borderRadius: 4, background: saving ? '#6E8A6E' : '#15A34A', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Creando…' : 'Crear cuenta'}
            </button>
          </form>

          {lastCreated && (
            <div style={{ marginTop: 12, background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 4, padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#15A34A', marginBottom: 4 }}>Cuenta creada</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: '#1A2B1A' }}>
                {lastCreated.email} · contraseña: <b>{lastCreated.password}</b>
              </div>
              <div style={{ fontSize: 11, color: '#3A5A3A', marginTop: 4 }}>Compártela por un canal seguro — no vuelve a mostrarse.</div>
            </div>
          )}
        </div>

        <div className="ag-dash-right">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Fincas</div>
          <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 6, overflow: 'hidden', marginBottom: 22 }}>
            {fincas.map((f, i) => (
              <button key={f.id} onClick={() => setFincaId(f.id)} style={{
                display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderTop: i > 0 ? '1px solid #EDF1EA' : 'none',
                background: fincaId === f.id ? '#F0FDF4' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: fincaId === f.id ? '#15A34A' : '#1A2B1A' }}>{f.nombre}</span>
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: '#9DB39D' }}>{organizaciones.find(o => o.id === f.organizacion_id)?.nombre ?? f.ubicacion ?? ''}</span>
              </button>
            ))}
            {fincas.length === 0 && <div style={{ padding: 14, fontSize: 12, color: '#9DB39D' }}>Sin fincas todavía</div>}
          </div>

          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Miembros de esta finca</div>
          <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 6, overflow: 'hidden' }}>
            {loadingMiembros && <div style={{ padding: 14, fontSize: 12, color: '#9DB39D' }}>Cargando…</div>}
            {!loadingMiembros && miembros.length === 0 && <div style={{ padding: 14, fontSize: 12, color: '#9DB39D' }}>Sin miembros todavía</div>}
            {!loadingMiembros && miembros.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderTop: i > 0 ? '1px solid #EDF1EA' : 'none' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.nombre}</span>
                <span style={{ background: '#F3F4F6', color: '#3A5A3A', fontSize: 10.5, fontWeight: 700, borderRadius: 3, padding: '3px 8px' }}>{ROLE_LABEL[m.rol]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
