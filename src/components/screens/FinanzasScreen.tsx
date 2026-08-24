'use client';

import { useState } from 'react';
import { money } from '@/data/agrosense';
import { DbProveedor, DbCliente, DbGasto, DbMovimiento, crearProveedor, desactivarProveedor, crearGasto } from '@/lib/supabase';

interface Props {
  onOpenDrawer: () => void;
  role: string;
  fincaId?: string;
  proveedores: DbProveedor[];
  clientes: DbCliente[];
  gastos: DbGasto[];
  movimientos: DbMovimiento[];
  onRefresh: () => void;
}

type SubTab = 'compras' | 'proveedores' | 'clientes' | 'movimientos';

const TIPO_HEX: Record<string, string> = {
  Insumos: '#15A34A', Ganado: '#D97706', Transporte: '#2563EB',
  'Frigorífico': '#1A2B1A', Subasta: '#2563EB', Distribuidor: '#D97706',
  Veterinario: '#DC2626', Sanidad: '#7C3AED',
};

const PROV_TIPOS = ['Insumos', 'Ganado', 'Transporte', 'Veterinario', 'Sanidad', 'Otro'];
const VIAS_GASTO = ['Manual', 'Electrónica'];

const inp: React.CSSProperties = {
  width: '100%', height: 42, border: '1px solid #C5D2C0', borderRadius: 4,
  padding: '0 12px', fontSize: 14, background: '#fff', outline: 'none',
  fontFamily: 'inherit', color: '#1A2B1A', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: 10, color: '#6E8A6E', fontWeight: 700, letterSpacing: '.5px',
  marginBottom: 4, display: 'block',
};

function CrearProveedorForm({ fincaId, onCancelar, onCreado }: { fincaId: string; onCancelar: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState('');
  const [nit, setNit] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [tipo, setTipo] = useState(PROV_TIPOS[0]);
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleGuardar = async () => {
    if (!nombre.trim()) { setErr('Nombre requerido'); return; }
    setSaving(true); setErr(null);
    const { error } = await crearProveedor({
      finca_id: fincaId, nombre: nombre.trim(), nit: nit.trim() || null,
      ciudad: ciudad.trim() || null, tipo, telefono: telefono.trim() || null, email: email.trim() || null,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onCreado();
  };

  return (
    <div className="animate-up" style={{ background: '#fff', border: '1px solid #86EFAC', borderRadius: 6, padding: '16px 14px', marginBottom: 13 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Nuevo proveedor</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label style={lbl}>NOMBRE</label>
          <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Agroinsumos del Sinú" autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>NIT</label>
            <input style={inp} value={nit} onChange={e => setNit(e.target.value)} placeholder="NIT" />
          </div>
          <div><label style={lbl}>CIUDAD</label>
            <input style={inp} value={ciudad} onChange={e => setCiudad(e.target.value)} placeholder="Ciudad" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>TIPO</label>
            <select style={inp} value={tipo} onChange={e => setTipo(e.target.value)}>
              {PROV_TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label style={lbl}>TELÉFONO</label>
            <input style={inp} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="300 000 0000" />
          </div>
        </div>
        <div><label style={lbl}>CORREO</label>
          <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        </div>
        {err && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #C5D2C0', borderRadius: 4, background: '#fff', color: '#6E8A6E', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#6E8A6E' : '#15A34A', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Guardar proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CrearGastoForm({ fincaId, proveedores, onCancelar, onCreado }: { fincaId: string; proveedores: DbProveedor[]; onCancelar: () => void; onCreado: () => void }) {
  const [concepto, setConcepto] = useState('');
  const [itemsDesc, setItemsDesc] = useState('');
  const [monto, setMonto] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [via, setVia] = useState(VIAS_GASTO[0]);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleGuardar = async () => {
    if (!concepto.trim() || !monto) { setErr('Concepto y monto requeridos'); return; }
    setSaving(true); setErr(null);
    const { error } = await crearGasto({
      finca_id: fincaId, proveedor_id: proveedorId || null, concepto: concepto.trim(),
      items_desc: itemsDesc.trim() || null, monto: parseFloat(monto), fecha, via,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onCreado();
  };

  return (
    <div className="animate-up" style={{ background: '#fff', border: '1px solid #86EFAC', borderRadius: 6, padding: '16px 14px', marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Registrar gasto</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label style={lbl}>CONCEPTO</label>
          <input style={inp} value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Concentrado levante" autoFocus />
        </div>
        <div><label style={lbl}>DETALLE (OPCIONAL)</label>
          <input style={inp} value={itemsDesc} onChange={e => setItemsDesc(e.target.value)} placeholder="Ítems, cantidades…" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>MONTO</label>
            <input style={inp} type="number" min={0} value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" />
          </div>
          <div><label style={lbl}>FECHA</label>
            <input style={inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>PROVEEDOR (OPCIONAL)</label>
            <select style={inp} value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
              <option value="">Sin proveedor</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div><label style={lbl}>VÍA</label>
            <select style={inp} value={via} onChange={e => setVia(e.target.value)}>
              {VIAS_GASTO.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>
        {err && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #C5D2C0', borderRadius: 4, background: '#fff', color: '#6E8A6E', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#6E8A6E' : '#15A34A', color: '#fff', fontWeight: 800, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Guardar gasto'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinanzasScreen({ onOpenDrawer, role, fincaId, proveedores, clientes, gastos, movimientos, onRefresh }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('compras');
  const [provFilter, setProvFilter] = useState('Todos');
  const [showGastoForm, setShowGastoForm] = useState(false);
  const [showProvForm, setShowProvForm] = useState(false);
  const [desactivando, setDesactivando] = useState<string | null>(null);

  const handleDesactivarProveedor = async (id: string) => {
    setDesactivando(id);
    await desactivarProveedor(id);
    setDesactivando(null);
    onRefresh();
  };

  const canFinanzas = role === 'owner' || role === 'contable';
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosSync  = gastos.filter(g => g.pendiente_sync).length;

  const provTipos = ['Todos', ...Array.from(new Set(proveedores.map(p => p.tipo ?? 'Otro').filter(Boolean)))];
  const filteredProvs = provFilter === 'Todos' ? proveedores : proveedores.filter(p => p.tipo === provFilter);

  const totalVentas  = movimientos.filter(m => m.tipo === 'venta').reduce((s, m) => s + (m.total_cop ?? 0), 0);
  const totalCompras = movimientos.filter(m => m.tipo === 'compra').reduce((s, m) => s + (m.costo_cop ?? 0), 0);

  const SUB_TABS: { key: SubTab; label: string }[] = [
    { key: 'compras', label: 'Compras' },
    { key: 'proveedores', label: 'Proveedores' },
    { key: 'clientes', label: 'Clientes' },
    { key: 'movimientos', label: 'Movimientos' },
  ];

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#EEF2EC', padding: '16px 16px 0', borderBottom: '1px solid #E1E8DD' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A2B1A" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <div style={{ fontWeight: 800, fontSize: 22 }}>Finanzas</div>
        </div>
        <div className="scrollbar-none" style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 0 }}>
          {SUB_TABS.map(t => (
            <button key={t.key} onClick={() => setSubTab(t.key)} style={{
              flexShrink: 0, padding: '10px 14px', background: 'none', border: 'none',
              borderBottom: subTab === t.key ? '2px solid #15A34A' : '2px solid transparent',
              color: subTab === t.key ? '#15A34A' : '#6E8A6E',
              fontWeight: subTab === t.key ? 700 : 600, fontSize: 13.5, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {!canFinanzas && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F3F4F6', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6E8A6E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>Sin acceso a finanzas</div>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: '#9DB39D', maxWidth: 280, margin: '0 auto' }}>Tu rol no tiene permiso para ver información financiera de esta finca. Pide acceso al propietario.</div>
        </div>
      )}

      {canFinanzas && (
      <div style={{ padding: '16px 16px 24px' }}>
        {/* COMPRAS */}
        {subTab === 'compras' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', letterSpacing: '.3px', textTransform: 'uppercase' }}>Total mes</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 20, marginTop: 4, color: '#DC2626' }}>{money(totalGastos)}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', letterSpacing: '.3px', textTransform: 'uppercase' }}>Pendiente sync</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 26, marginTop: 4, color: gastosSync > 0 ? '#D97706' : '#15A34A' }}>{gastosSync}</div>
              </div>
            </div>

            {fincaId && !showGastoForm && (
              <button onClick={() => setShowGastoForm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 16, height: 46, border: 'none', borderRadius: 4, background: '#15A34A', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Registrar gasto
              </button>
            )}
            {fincaId && showGastoForm && (
              <CrearGastoForm
                fincaId={fincaId} proveedores={proveedores}
                onCancelar={() => setShowGastoForm(false)}
                onCreado={() => { setShowGastoForm(false); onRefresh(); }}
              />
            )}

            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Gastos registrados</div>
            <div className="ag-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gastos.map(g => (
                <div key={g.id} style={{ background: g.pendiente_sync ? '#FFFBEB' : '#fff', border: `1px solid ${g.pendiente_sync ? '#FDE68A' : '#E1E8DD'}`, borderRadius: 4, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{g.concepto}</div>
                    {g.items_desc && <div style={{ fontSize: 11.5, color: '#6E8A6E', marginTop: 2 }}>{g.items_desc}</div>}
                    <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: '#9DB39D', marginTop: 3 }}>{g.fecha.slice(0,10)} · {g.via}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 16 }}>{money(g.monto)}</div>
                    {g.pendiente_sync && <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#D97706', marginTop: 2 }}>↑ sync</div>}
                  </div>
                </div>
              ))}
              {gastos.length === 0 && <div style={{ textAlign: 'center', color: '#9DB39D', padding: '32px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 12 }}>Sin gastos registrados</div>}
            </div>
          </div>
        )}

        {/* PROVEEDORES */}
        {subTab === 'proveedores' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', letterSpacing: '.3px', textTransform: 'uppercase' }}>Proveedores</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 26, marginTop: 4 }}>{proveedores.length}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', letterSpacing: '.3px', textTransform: 'uppercase' }}>Con IMAP</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 26, marginTop: 4, color: '#15A34A' }}>{proveedores.filter(p => p.via_email).length}</div>
              </div>
            </div>
            {fincaId && !showProvForm && (
              <button onClick={() => setShowProvForm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 13, height: 46, border: 'none', borderRadius: 4, background: '#15A34A', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Agregar proveedor
              </button>
            )}
            {fincaId && showProvForm && (
              <CrearProveedorForm
                fincaId={fincaId}
                onCancelar={() => setShowProvForm(false)}
                onCreado={() => { setShowProvForm(false); onRefresh(); }}
              />
            )}

            <div className="scrollbar-none" style={{ display: 'flex', gap: 7, marginBottom: 13, overflowX: 'auto', paddingBottom: 2 }}>
              {provTipos.map(t => (
                <button key={t} onClick={() => setProvFilter(t)} style={{
                  flexShrink: 0, padding: '7px 13px', borderRadius: 4, cursor: 'pointer',
                  background: provFilter === t ? '#1A2B1A' : '#fff',
                  border: `1px solid ${provFilter === t ? '#1A2B1A' : '#E1E8DD'}`,
                  color: provFilter === t ? '#fff' : '#1A2B1A',
                  fontSize: 12, fontWeight: 600,
                }}>{t}</button>
              ))}
            </div>
            <div className="ag-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {filteredProvs.map(p => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #E1E8DD', borderLeft: `3px solid ${TIPO_HEX[p.tipo ?? ''] || '#15A34A'}`, borderRadius: 4, padding: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.15 }}>{p.nombre}</div>
                      <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: '#9DB39D', marginTop: 3 }}>{p.nit ?? '—'} · {p.ciudad ?? '—'}</div>
                    </div>
                    <span style={{ background: p.via_email ? '#DCFCE7' : '#F3F4F6', color: p.via_email ? '#15A34A' : '#6E8A6E', fontSize: 9.5, fontWeight: 700, borderRadius: 3, padding: '3px 7px', flexShrink: 0 }}>
                      {p.via_email ? 'IMAP' : 'Manual'}
                    </span>
                  </div>
                  {p.email && (
                    <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: '#6E8A6E', marginTop: 8 }}>{p.email}</div>
                  )}
                  <button
                    onClick={() => handleDesactivarProveedor(p.id)}
                    disabled={desactivando === p.id}
                    style={{ marginTop: 9, height: 32, padding: '0 12px', border: '1px solid #FCA5A5', borderRadius: 4, background: '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: 11.5, cursor: desactivando === p.id ? 'default' : 'pointer' }}
                  >
                    {desactivando === p.id ? 'Desactivando…' : 'Desactivar'}
                  </button>
                </div>
              ))}
              {filteredProvs.length === 0 && <div style={{ textAlign: 'center', color: '#9DB39D', padding: '32px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 12 }}>Sin proveedores</div>}
            </div>
          </div>
        )}

        {/* CLIENTES */}
        {subTab === 'clientes' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', letterSpacing: '.3px', textTransform: 'uppercase' }}>Clientes</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 26, marginTop: 4 }}>{clientes.length}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', letterSpacing: '.3px', textTransform: 'uppercase' }}>Ingresos mes</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 20, marginTop: 4, color: '#15A34A' }}>{money(totalVentas)}</div>
              </div>
            </div>
            <div className="ag-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {clientes.map(c => (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #E1E8DD', borderLeft: `3px solid ${TIPO_HEX[c.tipo ?? ''] || '#15A34A'}`, borderRadius: 4, padding: 13 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{c.nombre}</div>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: '#9DB39D', marginTop: 3 }}>{c.nit ?? '—'} · {c.ciudad ?? '—'}</div>
                  {c.tipo && <div style={{ fontSize: 11.5, color: '#6E8A6E', marginTop: 4 }}>{c.tipo}</div>}
                </div>
              ))}
              {clientes.length === 0 && <div style={{ textAlign: 'center', color: '#9DB39D', padding: '32px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 12 }}>Sin clientes</div>}
            </div>
          </div>
        )}

        {/* MOVIMIENTOS */}
        {subTab === 'movimientos' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', textTransform: 'uppercase' }}>Ventas mes</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 20, marginTop: 4, color: '#15A34A' }}>{money(totalVentas)}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E1E8DD', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#9DB39D', textTransform: 'uppercase' }}>Compras mes</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 20, marginTop: 4, color: '#DC2626' }}>{money(totalCompras)}</div>
              </div>
            </div>
            <div className="ag-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {movimientos.map(m => {
                const isVenta = m.tipo === 'venta';
                const hex = isVenta ? '#15A34A' : '#2563EB';
                const soft = isVenta ? '#DCFCE7' : '#DBEAFE';
                return (
                  <div key={m.id} style={{ background: '#fff', border: '1px solid #E1E8DD', borderLeft: `3px solid ${hex}`, borderRadius: 4, padding: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ background: soft, color: hex, fontSize: 9.5, fontWeight: 700, borderRadius: 3, padding: '2px 7px', textTransform: 'uppercase' }}>{m.tipo}</span>
                          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: '#9DB39D' }}>{m.fecha.slice(0,10)}</span>
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{m.contraparte ?? '—'}</div>
                        <div style={{ fontSize: 11.5, color: '#6E8A6E', marginTop: 3 }}>{m.animales_count} animales · {m.categoria ?? ''} · {m.raza ?? ''}</div>
                        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: '#6E8A6E', marginTop: 2 }}>
                          {m.peso_prom_kg} kg prom · ${(m.precio_kg ?? 0).toLocaleString('es-CO')}/kg
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 16, color: hex }}>
                          {money(isVenta ? (m.total_cop ?? 0) : (m.costo_cop ?? 0))}
                        </div>
                        {isVenta && m.utilidad_cop && (
                          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: '#15A34A', marginTop: 2 }}>+{money(m.utilidad_cop)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {movimientos.length === 0 && <div style={{ textAlign: 'center', color: '#9DB39D', padding: '32px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 12 }}>Sin movimientos</div>}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
