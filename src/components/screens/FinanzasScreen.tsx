'use client';

import { useState } from 'react';
import { money } from '@/data/agrosense';
import { crearGastoOffline } from '@/lib/offline/acciones';
import { DbProveedor, DbCliente, DbGasto, DbMovimiento, crearProveedor, desactivarProveedor, crearCliente, desactivarCliente, crearMovimiento } from '@/lib/supabase';

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
  Insumos: '#15803D', Ganado: '#B45309', Transporte: '#1D4ED8',
  'Frigorífico': '#0F1A0F', Subasta: '#1D4ED8', Distribuidor: '#B45309',
  Veterinario: '#B91C1C', Sanidad: '#7C3AED',
};

const PROV_TIPOS = ['Insumos', 'Ganado', 'Transporte', 'Veterinario', 'Sanidad', 'Otro'];
const VIAS_GASTO = ['Manual', 'Electrónica'];
const CLIENTE_TIPOS = ['Frigorífico', 'Subasta', 'Distribuidor', 'Otro'];
const MOV_CATEGORIAS = ['Levante', 'Ceba', 'Cría'];

const inp: React.CSSProperties = {
  width: '100%', height: 42, border: '1px solid #8FA38A', borderRadius: 4,
  padding: '0 12px', fontSize: 18, background: '#fff', outline: 'none',
  fontFamily: 'inherit', color: '#0F1A0F', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: 14, color: '#3A4D3A', fontWeight: 700, letterSpacing: '.5px',
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
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 14 }}>Nuevo proveedor</div>
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
        {err && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A4D3A', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#3A4D3A' : '#15803D', color: '#fff', fontWeight: 800, fontSize: 17, cursor: saving ? 'default' : 'pointer' }}>
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
    const { error } = await crearGastoOffline({
      finca_id: fincaId, proveedor_id: proveedorId || null, concepto: concepto.trim(),
      items_desc: itemsDesc.trim() || null, monto: parseFloat(monto), fecha, via,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onCreado();
  };

  return (
    <div className="animate-up" style={{ background: '#fff', border: '1px solid #86EFAC', borderRadius: 6, padding: '16px 14px', marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 14 }}>Registrar gasto</div>
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
        {err && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A4D3A', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#3A4D3A' : '#15803D', color: '#fff', fontWeight: 800, fontSize: 17, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Guardar gasto'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CrearClienteForm({ fincaId, onCancelar, onCreado }: { fincaId: string; onCancelar: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState('');
  const [nit, setNit] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [tipo, setTipo] = useState(CLIENTE_TIPOS[0]);
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleGuardar = async () => {
    if (!nombre.trim()) { setErr('Nombre requerido'); return; }
    setSaving(true); setErr(null);
    const { error } = await crearCliente({
      finca_id: fincaId, nombre: nombre.trim(), nit: nit.trim() || null,
      ciudad: ciudad.trim() || null, tipo, telefono: telefono.trim() || null, email: email.trim() || null,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onCreado();
  };

  return (
    <div className="animate-up" style={{ background: '#fff', border: '1px solid #86EFAC', borderRadius: 6, padding: '16px 14px', marginBottom: 13 }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 14 }}>Nuevo cliente</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label style={lbl}>NOMBRE</label>
          <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Frigorífico Vijagual" autoFocus />
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
              {CLIENTE_TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label style={lbl}>TELÉFONO</label>
            <input style={inp} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="300 000 0000" />
          </div>
        </div>
        <div><label style={lbl}>CORREO</label>
          <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        </div>
        {err && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A4D3A', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#3A4D3A' : '#15803D', color: '#fff', fontWeight: 800, fontSize: 17, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Guardar cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CrearMovimientoForm({ fincaId, onCancelar, onCreado }: { fincaId: string; onCancelar: () => void; onCreado: () => void }) {
  const [tipo, setTipo] = useState<'venta' | 'compra'>('venta');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [contraparte, setContraparte] = useState('');
  const [animalesCount, setAnimalesCount] = useState('');
  const [categoria, setCategoria] = useState(MOV_CATEGORIAS[1]);
  const [raza, setRaza] = useState('');
  const [pesoPromKg, setPesoPromKg] = useState('');
  const [precioKg, setPrecioKg] = useState('');
  const [costoCop, setCostoCop] = useState('');
  const [transporteCop, setTransporteCop] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nAnimales = parseInt(animalesCount, 10) || 0;
  const nPeso = parseFloat(pesoPromKg) || 0;
  const nPrecio = parseFloat(precioKg) || 0;
  const totalVentaCalc = nAnimales * nPeso * nPrecio;

  const handleGuardar = async () => {
    if (!animalesCount || !pesoPromKg) { setErr('Cantidad de animales y peso promedio requeridos'); return; }
    setSaving(true); setErr(null);
    const { error } = await crearMovimiento({
      finca_id: fincaId, tipo, fecha, contraparte: contraparte.trim() || null,
      animales_count: nAnimales, categoria, raza: raza.trim() || null,
      peso_prom_kg: nPeso || null,
      precio_kg: tipo === 'venta' ? (nPrecio || null) : null,
      total_cop: tipo === 'venta' ? (totalVentaCalc || null) : null,
      costo_cop: tipo === 'compra' ? (parseFloat(costoCop) || null) : null,
      utilidad_cop: null,
      transporte_cop: transporteCop ? parseFloat(transporteCop) : null,
      notas: notas.trim() || null,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    onCreado();
  };

  return (
    <div className="animate-up" style={{ background: '#fff', border: '1px solid #86EFAC', borderRadius: 6, padding: '16px 14px', marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 14 }}>Registrar movimiento de ganado</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['venta', 'compra'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTipo(t)} style={{
              flex: 1, height: 42, borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 17, textTransform: 'capitalize',
              border: `1px solid ${tipo === t ? (t === 'venta' ? '#15803D' : '#1D4ED8') : '#8FA38A'}`,
              background: tipo === t ? (t === 'venta' ? '#DCFCE7' : '#DBEAFE') : '#fff',
              color: tipo === t ? (t === 'venta' ? '#15803D' : '#1D4ED8') : '#3A4D3A',
            }}>{t}</button>
          ))}
        </div>
        <div><label style={lbl}>{tipo === 'venta' ? 'COMPRADOR' : 'VENDEDOR'}</label>
          <input style={inp} value={contraparte} onChange={e => setContraparte(e.target.value)} placeholder="Nombre o razón social" autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>FECHA</label>
            <input style={inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div><label style={lbl}># ANIMALES</label>
            <input style={inp} type="number" min={0} value={animalesCount} onChange={e => setAnimalesCount(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>CATEGORÍA</label>
            <select style={inp} value={categoria} onChange={e => setCategoria(e.target.value)}>
              {MOV_CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={lbl}>RAZA</label>
            <input style={inp} value={raza} onChange={e => setRaza(e.target.value)} placeholder="Ej: Brahman" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>PESO PROM (KG)</label>
            <input style={inp} type="number" min={0} value={pesoPromKg} onChange={e => setPesoPromKg(e.target.value)} placeholder="0" />
          </div>
          {tipo === 'venta' ? (
            <div><label style={lbl}>PRECIO/KG</label>
              <input style={inp} type="number" min={0} value={precioKg} onChange={e => setPrecioKg(e.target.value)} placeholder="0" />
            </div>
          ) : (
            <div><label style={lbl}>COSTO TOTAL</label>
              <input style={inp} type="number" min={0} value={costoCop} onChange={e => setCostoCop(e.target.value)} placeholder="0" />
            </div>
          )}
        </div>
        {tipo === 'venta' && nAnimales > 0 && nPeso > 0 && nPrecio > 0 && (
          <div style={{ fontSize: 16, color: '#15803D', fontWeight: 700 }}>Total estimado: {money(totalVentaCalc)}</div>
        )}
        <div><label style={lbl}>TRANSPORTE (OPCIONAL)</label>
          <input style={inp} type="number" min={0} value={transporteCop} onChange={e => setTransporteCop(e.target.value)} placeholder="0" />
        </div>
        <div><label style={lbl}>NOTAS (OPCIONAL)</label>
          <input style={inp} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones" />
        </div>
        {err && <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', padding: '6px 10px', borderRadius: 4 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancelar} style={{ flex: 1, height: 46, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A4D3A', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} style={{ flex: 1.6, height: 46, border: 'none', borderRadius: 4, background: saving ? '#3A4D3A' : '#15803D', color: '#fff', fontWeight: 800, fontSize: 17, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Guardar movimiento'}
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
  const [showClienteForm, setShowClienteForm] = useState(false);
  const [showMovForm, setShowMovForm] = useState(false);
  const [desactivando, setDesactivando] = useState<string | null>(null);

  const handleDesactivarProveedor = async (id: string) => {
    setDesactivando(id);
    await desactivarProveedor(id);
    setDesactivando(null);
    onRefresh();
  };

  const handleDesactivarCliente = async (id: string) => {
    setDesactivando(id);
    await desactivarCliente(id);
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
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#EEF2EC', padding: '16px 16px 0', borderBottom: '1px solid #B9C6B4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button onClick={onOpenDrawer} className="ag-hamburger" style={{ width: 40, height: 40, marginLeft: -7, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F1A0F" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <div style={{ fontWeight: 800, fontSize: 25 }}>Finanzas</div>
        </div>
        <div className="scrollbar-none" style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 0 }}>
          {SUB_TABS.map(t => (
            <button key={t.key} onClick={() => setSubTab(t.key)} style={{
              flexShrink: 0, padding: '10px 14px', background: 'none', border: 'none',
              borderBottom: subTab === t.key ? '2px solid #15803D' : '2px solid transparent',
              color: subTab === t.key ? '#15803D' : '#3A4D3A',
              fontWeight: subTab === t.key ? 700 : 600, fontSize: 17, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {!canFinanzas && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F3F4F6', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3A4D3A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Sin acceso a finanzas</div>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 16, color: '#4A5E4A', maxWidth: 280, margin: '0 auto' }}>Tu rol no tiene permiso para ver información financiera de esta finca. Pide acceso al propietario.</div>
        </div>
      )}

      {canFinanzas && (
      <div style={{ padding: '16px 16px 24px' }}>
        {/* COMPRAS */}
        {subTab === 'compras' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
              <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', letterSpacing: '.3px', textTransform: 'uppercase' }}>Total mes</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 23, marginTop: 4, color: '#B91C1C' }}>{money(totalGastos)}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', letterSpacing: '.3px', textTransform: 'uppercase' }}>Pendiente sync</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 28, marginTop: 4, color: gastosSync > 0 ? '#B45309' : '#15803D' }}>{gastosSync}</div>
              </div>
            </div>

            {fincaId && !showGastoForm && (
              <button onClick={() => setShowGastoForm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 16, height: 46, border: 'none', borderRadius: 4, background: '#15803D', color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
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

            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>Gastos registrados</div>
            <div className="ag-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gastos.map(g => (
                <div key={g.id} style={{ background: g.pendiente_sync ? '#FFFBEB' : '#fff', border: `1px solid ${g.pendiente_sync ? '#FDE68A' : '#B9C6B4'}`, borderRadius: 4, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{g.concepto}</div>
                    {g.items_desc && <div style={{ fontSize: 15, color: '#3A4D3A', marginTop: 2 }}>{g.items_desc}</div>}
                    <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', marginTop: 3 }}>{g.fecha.slice(0,10)} · {g.via}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 20 }}>{money(g.monto)}</div>
                    {g.pendiente_sync && <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#B45309', marginTop: 2 }}>↑ sync</div>}
                  </div>
                </div>
              ))}
              {gastos.length === 0 && <div style={{ textAlign: 'center', color: '#4A5E4A', padding: '32px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 16 }}>Sin gastos registrados</div>}
            </div>
          </div>
        )}

        {/* PROVEEDORES */}
        {subTab === 'proveedores' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
              <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', letterSpacing: '.3px', textTransform: 'uppercase' }}>Proveedores</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 28, marginTop: 4 }}>{proveedores.length}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', letterSpacing: '.3px', textTransform: 'uppercase' }}>Con IMAP</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 28, marginTop: 4, color: '#15803D' }}>{proveedores.filter(p => p.via_email).length}</div>
              </div>
            </div>
            {fincaId && !showProvForm && (
              <button onClick={() => setShowProvForm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 13, height: 46, border: 'none', borderRadius: 4, background: '#15803D', color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
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
                  background: provFilter === t ? '#0F1A0F' : '#fff',
                  border: `1px solid ${provFilter === t ? '#0F1A0F' : '#B9C6B4'}`,
                  color: provFilter === t ? '#fff' : '#0F1A0F',
                  fontSize: 16, fontWeight: 600,
                }}>{t}</button>
              ))}
            </div>
            <div className="ag-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {filteredProvs.map(p => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #B9C6B4', borderLeft: `3px solid ${TIPO_HEX[p.tipo ?? ''] || '#15803D'}`, borderRadius: 4, padding: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15 }}>{p.nombre}</div>
                      <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', marginTop: 3 }}>{p.nit ?? '—'} · {p.ciudad ?? '—'}</div>
                    </div>
                    <span style={{ background: p.via_email ? '#DCFCE7' : '#F3F4F6', color: p.via_email ? '#15803D' : '#3A4D3A', fontSize: 13, fontWeight: 700, borderRadius: 3, padding: '3px 7px', flexShrink: 0 }}>
                      {p.via_email ? 'IMAP' : 'Manual'}
                    </span>
                  </div>
                  {p.email && (
                    <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#3A4D3A', marginTop: 8 }}>{p.email}</div>
                  )}
                  <button
                    onClick={() => handleDesactivarProveedor(p.id)}
                    disabled={desactivando === p.id}
                    style={{ marginTop: 9, height: 32, padding: '0 12px', border: '1px solid #FCA5A5', borderRadius: 4, background: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: 15, cursor: desactivando === p.id ? 'default' : 'pointer' }}
                  >
                    {desactivando === p.id ? 'Desactivando…' : 'Desactivar'}
                  </button>
                </div>
              ))}
              {filteredProvs.length === 0 && <div style={{ textAlign: 'center', color: '#4A5E4A', padding: '32px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 16 }}>Sin proveedores</div>}
            </div>
          </div>
        )}

        {/* CLIENTES */}
        {subTab === 'clientes' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
              <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', letterSpacing: '.3px', textTransform: 'uppercase' }}>Clientes</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 28, marginTop: 4 }}>{clientes.length}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', letterSpacing: '.3px', textTransform: 'uppercase' }}>Ingresos mes</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 23, marginTop: 4, color: '#15803D' }}>{money(totalVentas)}</div>
              </div>
            </div>
            {fincaId && !showClienteForm && (
              <button onClick={() => setShowClienteForm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 13, height: 46, border: 'none', borderRadius: 4, background: '#15803D', color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Agregar cliente
              </button>
            )}
            {fincaId && showClienteForm && (
              <CrearClienteForm
                fincaId={fincaId}
                onCancelar={() => setShowClienteForm(false)}
                onCreado={() => { setShowClienteForm(false); onRefresh(); }}
              />
            )}

            <div className="ag-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {clientes.map(c => (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #B9C6B4', borderLeft: `3px solid ${TIPO_HEX[c.tipo ?? ''] || '#15803D'}`, borderRadius: 4, padding: 13 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{c.nombre}</div>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A', marginTop: 3 }}>{c.nit ?? '—'} · {c.ciudad ?? '—'}</div>
                  {c.tipo && <div style={{ fontSize: 15, color: '#3A4D3A', marginTop: 4 }}>{c.tipo}</div>}
                  <button
                    onClick={() => handleDesactivarCliente(c.id)}
                    disabled={desactivando === c.id}
                    style={{ marginTop: 9, height: 32, padding: '0 12px', border: '1px solid #FCA5A5', borderRadius: 4, background: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: 15, cursor: desactivando === c.id ? 'default' : 'pointer' }}
                  >
                    {desactivando === c.id ? 'Desactivando…' : 'Desactivar'}
                  </button>
                </div>
              ))}
              {clientes.length === 0 && <div style={{ textAlign: 'center', color: '#4A5E4A', padding: '32px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 16 }}>Sin clientes</div>}
            </div>
          </div>
        )}

        {/* MOVIMIENTOS */}
        {subTab === 'movimientos' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
              <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', textTransform: 'uppercase' }}>Ventas mes</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 23, marginTop: 4, color: '#15803D' }}>{money(totalVentas)}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 13 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: '#4A5E4A', textTransform: 'uppercase' }}>Compras mes</div>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 23, marginTop: 4, color: '#B91C1C' }}>{money(totalCompras)}</div>
              </div>
            </div>

            {fincaId && !showMovForm && (
              <button onClick={() => setShowMovForm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 16, height: 46, border: 'none', borderRadius: 4, background: '#15803D', color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Registrar movimiento
              </button>
            )}
            {fincaId && showMovForm && (
              <CrearMovimientoForm
                fincaId={fincaId}
                onCancelar={() => setShowMovForm(false)}
                onCreado={() => { setShowMovForm(false); onRefresh(); }}
              />
            )}

            <div className="ag-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {movimientos.map(m => {
                const isVenta = m.tipo === 'venta';
                const hex = isVenta ? '#15803D' : '#1D4ED8';
                const soft = isVenta ? '#DCFCE7' : '#DBEAFE';
                return (
                  <div key={m.id} style={{ background: '#fff', border: '1px solid #B9C6B4', borderLeft: `3px solid ${hex}`, borderRadius: 4, padding: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ background: soft, color: hex, fontSize: 13, fontWeight: 700, borderRadius: 3, padding: '2px 7px', textTransform: 'uppercase' }}>{m.tipo}</span>
                          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#4A5E4A' }}>{m.fecha.slice(0,10)}</span>
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 700 }}>{m.contraparte ?? '—'}</div>
                        <div style={{ fontSize: 15, color: '#3A4D3A', marginTop: 3 }}>{m.animales_count} animales · {m.categoria ?? ''} · {m.raza ?? ''}</div>
                        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#3A4D3A', marginTop: 2 }}>
                          {m.peso_prom_kg} kg prom · ${(m.precio_kg ?? 0).toLocaleString('es-CO')}/kg
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, fontSize: 20, color: hex }}>
                          {money(isVenta ? (m.total_cop ?? 0) : (m.costo_cop ?? 0))}
                        </div>
                        {isVenta && m.utilidad_cop && (
                          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#15803D', marginTop: 2 }}>+{money(m.utilidad_cop)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {movimientos.length === 0 && <div style={{ textAlign: 'center', color: '#4A5E4A', padding: '32px 0', fontFamily: 'var(--font-jetbrains)', fontSize: 16 }}>Sin movimientos</div>}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
