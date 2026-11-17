'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Animal, Tab, RoleKey, CAT, ESTADO } from '@/data/agrosense';
import {
  supabase, getFincas, getPotreros, getAnimales,
  getAlertas, getEventos, getProveedores, getClientes, getGastos, getMovimientos,
  getVacunaciones, getNacimientos, getBajas, getMembresiasFinca,
  getMisMembresias, getIsSuperadmin, getRetiros,
  DbRetiro, DbFinca, DbPotrero, DbAnimal, DbAlerta, DbEvento, DbProveedor, DbCliente, DbGasto, DbMovimiento, DbMembresia,
  DbVacunacion, DbNacimiento, DbBaja,
} from '@/lib/supabase';
import InicioScreen from './screens/InicioScreen';
import AnimalesScreen from './screens/AnimalesScreen';
import RfidScreen from './screens/RfidScreen';
import AgendaScreen from './screens/AgendaScreen';
import FinanzasScreen from './screens/FinanzasScreen';
import AdminScreen from './screens/AdminScreen';
import ReportesScreen from './screens/ReportesScreen';
import AjustesScreen from './screens/AjustesScreen';
import Drawer from './ui/Drawer';
import AnimalProfile from './ui/AnimalProfile';
import FincaPicker from './ui/FincaPicker';
import LoginScreen from './auth/LoginScreen';
import EstadoSenal from './ui/EstadoSenal';
import { useSincronizacion } from '@/hooks/useSincronizacion';
import { guardarCopia, leerCopia } from '@/lib/offline/copias';
import { aplicarPendientes } from '@/lib/offline/proyeccion';
import { sesionGuardada } from '@/lib/offline/sesion';
import { registrarPesajeOffline } from '@/lib/offline/acciones';
import { resumenVenta, retirosPendientes, retirosPorAnimal } from '@/lib/venta';
import { ListosParaVender, NoEngordan } from './ui/VentaGanado';

// Copia de una finca guardada en el celular para trabajar sin señal.
type CopiaFinca = {
  potreros: DbPotrero[]; animales: DbAnimal[]; alertas: DbAlerta[]; eventos: DbEvento[];
  proveedores: DbProveedor[]; clientes: DbCliente[]; gastos: DbGasto[]; movimientos: DbMovimiento[];
  vacunaciones: DbVacunacion[]; nacimientos: DbNacimiento[]; bajas: DbBaja[]; miembros: DbMembresia[];
  retiros?: DbRetiro[];   // las copias guardadas antes de esta versión no lo traen
};
type CopiaInicio = { fincas: DbFinca[]; membresias: DbMembresia[]; superadmin: boolean };
const sinRed = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'inicio',   label: 'Inicio',   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg> },
  { key: 'animales', label: 'Animales', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><ellipse cx="12" cy="14" rx="7" ry="5"/><path d="M8 9 Q7 6 5 5M16 9 Q17 6 19 5"/></svg> },
  { key: 'rfid',     label: 'RFID',     icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12.5a9 9 0 0114 0"/><path d="M8 15a5 5 0 018 0"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none"/></svg> },
  { key: 'agenda',   label: 'Agenda',   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> },
  { key: 'finanzas', label: 'Finanzas', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
];

// Convert DB types to app types
function dbAnimalToAnimal(a: DbAnimal, potreroNombre: string): Animal {
  return {
    nombre: a.nombre ?? a.arete,
    id: `CO·${a.arete.replace('·', '0')}`,
    dbId: a.id,
    arete: a.arete,
    raza: a.raza ?? 'Sin raza',
    sexo: a.sexo ?? 'Novillo',
    sx: ['Vaca','Novilla','Ternera'].includes(a.sexo ?? '') ? 'H' : 'M',
    cat: (a.categoria as 'Ceba'|'Levante'|'Cría') ?? 'Ceba',
    peso: a.peso_actual ?? 0,
    gdp: a.gdp ?? 0,
    gdpDelta: a.gdp_delta ?? 0,
    potrero: potreroNombre,
    estado: (a.estado as 'green'|'amber'|'red') ?? 'green',
    dias: a.dias_potrero ?? 0,
    pesoAnt: (a.peso_actual ?? 0) - ((a.gdp ?? 0) * 14),
    diasEnt: 14,
    estadoTxt: a.estado_txt ?? 'Sano',
    estadoCorto: a.estado === 'green' ? 'Sano' : a.estado === 'amber' ? 'Atención' : 'Crítico',
  };
}

function dbFincaToFinca(
  f: DbFinca, potreros: DbPotrero[], animales: DbAnimal[],
  nacimientos: DbNacimiento[], bajas: DbBaja[], movimientos: DbMovimiento[],
) {
  const comp = { Levante: 0, Ceba: 0, Cría: 0 };
  const now = new Date();
  const esteMes = (fecha: string) => { const d = new Date(fecha); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); };
  const mov = {
    nacimientos: nacimientos.filter(n => esteMes(n.fecha)).length,
    muertes:     bajas.filter(b => esteMes(b.fecha)).length,
    compras:     movimientos.filter(m => m.tipo === 'compra' && esteMes(m.fecha)).length,
    ventas:      movimientos.filter(m => m.tipo === 'venta' && esteMes(m.fecha)).length,
  };
  animales.forEach(a => { if (a.categoria && a.categoria in comp) (comp as Record<string,number>)[a.categoria]++; });
  const gdpProm = animales.length ? animales.reduce((s,a) => s + (a.gdp ?? 0), 0) / animales.length : 0;
  const kgProm  = animales.length ? Math.round(animales.reduce((s,a) => s + (a.peso_actual ?? 0), 0) / animales.length) : 0;
  return {
    key:            f.id,
    nombre:         f.nombre,
    ubic:           f.ubicacion ?? '',
    ini:            f.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),
    animales:       animales.length,
    kgProm,
    alertas:        animales.filter(a => a.estado !== 'green').length,
    ha:             f.hectareas ?? 0,
    valorCop:       f.valor_cop ?? 0,
    gananciaPct:    4.2,
    gdpProm:        Math.round(gdpProm * 100) / 100,
    gananciaMesKg:  Math.round(gdpProm * animales.length * 30),
    comp,
    mov,
    potreros: potreros.map(p => ({
      nombre:   p.nombre,
      animales: animales.filter(a => a.potrero_id === p.id).length,
      cap:      p.capacidad,
      ha:       p.hectareas ?? 0,
      aforo:    p.aforo ?? 0,
      estado:   p.estado,
      dias:     p.dias_estado,
    })),
  };
}

async function descargarFinca(finca_id: string): Promise<CopiaFinca> {
  const [potreros, animales, alertas, eventos, proveedores, clientes, gastos, movimientos, vacunaciones, nacimientos, bajas, miembros, retiros] = await Promise.all([
    getPotreros(finca_id),
    getAnimales(finca_id),
    getAlertas(finca_id),
    getEventos(finca_id),
    getProveedores(finca_id),
    getClientes(finca_id),
    getGastos(finca_id),
    getMovimientos(finca_id),
    getVacunaciones(finca_id),
    getNacimientos(finca_id),
    getBajas(finca_id),
    getMembresiasFinca(finca_id),
    getRetiros(finca_id),
  ]);
  return { potreros, animales, alertas, eventos, proveedores, clientes, gastos, movimientos, vacunaciones, nacimientos, bajas, miembros, retiros };
}

export default function AgroSenseApp() {
  const [tab, setTab]           = useState<Tab>('inicio');
  const [moneda, setMoneda]     = useState<'COP'|'USD'>('COP');
  const [wPeriod, setWPeriod]   = useState<'1M'|'3M'|'6M'>('6M');
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [fincaPickerOpen, setFincaPickerOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal|null>(null);

  // Auth state
  const [session, setSession]     = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [membresias, setMembresias] = useState<DbMembresia[]>([]);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  // DB state
  const [loading,   setLoading]   = useState(true);
  const [fincas,    setFincas]    = useState<DbFinca[]>([]);
  const [fincaIdx,  setFincaIdx]  = useState(0);
  const [potreros,  setPotreros]  = useState<DbPotrero[]>([]);
  const [animalesServidor, setAnimales] = useState<DbAnimal[]>([]);
  const [alertas,   setAlertas]   = useState<DbAlerta[]>([]);
  const [eventos,   setEventos]   = useState<DbEvento[]>([]);
  const [proveedores, setProveedores] = useState<DbProveedor[]>([]);
  const [clientes,  setClientes]  = useState<DbCliente[]>([]);
  const [gastos,    setGastos]    = useState<DbGasto[]>([]);
  const [movimientos, setMovimientos] = useState<DbMovimiento[]>([]);
  const [vacunaciones, setVacunaciones] = useState<DbVacunacion[]>([]);
  const [nacimientos, setNacimientos] = useState<DbNacimiento[]>([]);
  const [bajas,     setBajas]     = useState<DbBaja[]>([]);
  const [copiaDel, setCopiaDel] = useState<string | null>(null); // fecha de la copia local en uso
  const [miembrosFinca, setMiembrosFinca] = useState<DbMembresia[]>([]);
  const [retirosServidor, setRetiros] = useState<DbRetiro[]>([]);

  const currentFinca = fincas[fincaIdx];
  const sync = useSincronizacion();
  // Lo registrado sin señal se ve de inmediato (animales nuevos, pesos, vendidos fuera).
  const animales = currentFinca ? aplicarPendientes(animalesServidor, sync.pendientes, currentFinca.id) : animalesServidor;

  const aplicarCopia = useCallback((c: CopiaFinca) => {
    setPotreros(c.potreros);
    setAnimales(c.animales);
    setAlertas(c.alertas);
    setEventos(c.eventos);
    setProveedores(c.proveedores);
    setClientes(c.clientes);
    setGastos(c.gastos);
    setMovimientos(c.movimientos);
    setVacunaciones(c.vacunaciones);
    setNacimientos(c.nacimientos);
    setBajas(c.bajas);
    setMiembrosFinca(c.miembros);
    setRetiros(c.retiros ?? []);
  }, []);

  const loadFincaData = useCallback(async (finca_id: string) => {
    try {
      if (sinRed()) throw new Error('sin señal');
      const c = await descargarFinca(finca_id);
      aplicarCopia(c);
      setCopiaDel(null);
      void guardarCopia(`finca:${finca_id}`, c);
    } catch {
      const copia = await leerCopia<CopiaFinca>(`finca:${finca_id}`);
      if (copia) { aplicarCopia(copia.datos); setCopiaDel(copia.guardado_en); }
    }
  }, [aplicarCopia]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      // Sin señal no se puede renovar la sesión: seguimos con la guardada para ver los datos locales.
      setSession(data.session ?? (error || sinRed() ? sesionGuardada() : null));
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? (sinRed() ? sesionGuardada() : null)));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const usar = ({ fincas: f, membresias: m, superadmin }: CopiaInicio) => {
      setMembresias(m);
      setIsSuperadmin(superadmin);
      const allowed = new Set(m.map(x => x.finca_id));
      const mine = superadmin ? f : f.filter(x => allowed.has(x.id));
      setFincas(mine);
      if (mine.length) loadFincaData(mine[0].id).finally(() => setLoading(false));
      else setLoading(false);
    };
    const clave = `inicio:${session.user.id}`;
    (async () => {
      try {
        if (sinRed()) throw new Error('sin señal');
        const [f, m, superadmin] = await Promise.all([getFincas(), getMisMembresias(), getIsSuperadmin()]);
        void guardarCopia<CopiaInicio>(clave, { fincas: f, membresias: m, superadmin });
        usar({ fincas: f, membresias: m, superadmin });
      } catch {
        const copia = await leerCopia<CopiaInicio>(clave);
        if (copia) usar(copia.datos);
        else setLoading(false);
      }
    })();
  }, [session, loadFincaData]);

  // Cuando termina de enviar lo pendiente, traemos los datos del servidor (GDP calculada, etc.).
  const pendientesCount = sync.pendientes.length;
  const [pendientesAntes, setPendientesAntes] = useState(0);
  if (pendientesCount !== pendientesAntes) {
    setPendientesAntes(pendientesCount);
    if (pendientesCount === 0 && pendientesAntes > 0 && currentFinca && sync.enLinea) void loadFincaData(currentFinca.id);
  }

  // Vender a tiempo: retiros (incluye tratamientos hechos sin señal), listos para vender y valor del ganado.
  const retiros = currentFinca
    ? retirosPorAnimal(animales, [...retirosServidor, ...retirosPendientes(sync.pendientes, currentFinca.id)])
    : new Map();
  const venta = resumenVenta(animales, currentFinca?.meta_peso_kg, retiros);

  // Cambios de la finca (meta de peso, precio): se vuelve a leer la finca además de sus datos.
  const recargarFinca = async () => {
    if (!currentFinca) return;
    try {
      const f = await getFincas();
      setFincas(prev => prev.map(x => f.find(y => y.id === x.id) ?? x));
    } catch { /* sin señal: se queda la que hay */ }
    await loadFincaData(currentFinca.id);
  };

  const handleSignOut = () => {
    if (sync.pendientes.length && !window.confirm(`Hay ${sync.pendientes.length} registros sin enviar. Si cierras sesión se quedan en este celular hasta que vuelvas a entrar. ¿Cerrar sesión?`)) return;
    supabase.auth.signOut();
  };

  const handleSelectFinca = async (idx: number) => {
    setFincaIdx(idx);
    setLoading(true);
    await loadFincaData(fincas[idx].id);
    setLoading(false);
  };

  const handleRegistrarPesaje = async (animal: Animal, pesoKg: number) => {
    if (!currentFinca) return;
    const { error, pendiente } = await registrarPesajeOffline({
      finca_id: currentFinca.id, animal: { dbId: animal.dbId, nombre: animal.nombre, arete: animal.arete }, peso_kg: pesoKg,
    });
    if (error) { window.alert(`No se pudo guardar el pesaje: ${error}`); return; }
    if (!pendiente) await loadFincaData(currentFinca.id);
  };

  // Map DB data to app-layer types
  const potreroMap = Object.fromEntries(potreros.map(p => [p.id, p.nombre]));
  const appAnimals: Animal[] = animales.map(a => dbAnimalToAnimal(a, potreroMap[a.potrero_id ?? ''] ?? 'Sin potrero'));
  const appFinca = currentFinca ? dbFincaToFinca(currentFinca, potreros, animales, nacimientos, bajas, movimientos) : null;

  const myMembresia = membresias.find(m => m.finca_id === currentFinca?.id);
  const currentRole: RoleKey = myMembresia?.rol ?? (isSuperadmin ? 'owner' : 'vaquero');
  const displayName = myMembresia?.nombre ?? session?.user.email ?? '';
  const abrirAnimal = (dbId: string) => { const a = appAnimals.find(x => x.dbId === dbId); if (a) setSelectedAnimal(a); };

  const Spinner = (msg: string) => (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#EEF2EC' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:48, height:48, borderRadius:'50%', border:'3px solid #15A34A', borderTopColor:'transparent', animation:'agSweep 0.8s linear infinite', margin:'0 auto' }}/>
        <div style={{ fontFamily:'var(--font-jetbrains)', fontSize:12, color:'#6E8A6E', marginTop:14, letterSpacing:'.5px' }}>{msg}</div>
      </div>
    </div>
  );

  if (!authChecked) return Spinner('Verificando sesión...');
  if (!session) return <LoginScreen />;
  if (loading) return Spinner('Cargando datos...');

  if (!fincas.length) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#EEF2EC', padding:20 }}>
        <div style={{ textAlign:'center', maxWidth:340 }}>
          <div style={{ fontWeight:800, fontSize:17, marginBottom:8 }}>Sin fincas asignadas</div>
          <div style={{ fontFamily:'var(--font-jetbrains)', fontSize:12.5, color:'#6E8A6E', marginBottom:18 }}>Tu cuenta ({session.user.email}) no tiene acceso a ninguna finca todavía. Pide a un administrador que te agregue.</div>
          <button onClick={handleSignOut} style={{ height:44, padding:'0 20px', border:'1px solid #C5D2C0', borderRadius:4, background:'#fff', color:'#3A5A3A', fontWeight:700, fontSize:13, cursor:'pointer' }}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ag-shell" style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'#EEF2EC', position:'relative' }}>
      {/* Desktop sidebar (≥1024px) — bottom tab bar + hamburger hide at that breakpoint */}
      <Drawer
        variant="sidebar"
        open
        finca={appFinca ?? { key:'', nombre:'', ubic:'', ini:'', animales:0, kgProm:0, alertas:0, ha:0, valorCop:0, gananciaPct:0, gdpProm:0, gananciaMesKg:0, comp:{Levante:0,Ceba:0,Cría:0}, mov:{nacimientos:0,muertes:0,compras:0,ventas:0}, potreros:[] }}
        displayName={displayName}
        role={currentRole}
        activeTab={tab}
        showAdmin={isSuperadmin}
        onClose={() => {}}
        onNavigate={key => { if (['inicio','animales','rfid','agenda','finanzas','admin','reportes','ajustes'].includes(key)) setTab(key as Tab); }}
        onSignOut={handleSignOut}
        onOpenFincaPicker={fincas.length > 1 ? () => setFincaPickerOpen(true) : undefined}
      />

      {/* Screen content */}
      <div className="ag-main" style={{ flex:1, display:'flex', flexDirection:'column' }}>
      <EstadoSenal sync={sync} fincaId={currentFinca?.id} />
      {copiaDel && !sync.enLinea && (
        <div style={{ fontFamily:'var(--font-jetbrains)', fontSize:10.5, color:'#6E8A6E', padding:'4px 16px', background:'#F7FAF6', borderBottom:'1px solid #E1E8DD' }}>
          Mostrando datos guardados el {new Date(copiaDel).toLocaleString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
        </div>
      )}
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', paddingBottom:64 }} className="scrollbar-none ag-content-inner">
        {tab === 'inicio' && appFinca && (
          <InicioScreen
            finca={appFinca}
            role={currentRole}
            moneda={moneda}
            setMoneda={setMoneda}
            onOpenDrawer={() => setDrawerOpen(true)}
            onOpenFincaPicker={() => setFincaPickerOpen(true)}
            onGoAnimales={() => setTab('animales')}
            onGoPotreros={() => setDrawerOpen(true)}
            wPeriod={wPeriod}
            setWPeriod={setWPeriod}
            alertas={alertas}
            pendingSync={sync.pendientes.length}
            precioKg={currentFinca?.precio_kg ?? null}
            kgTotales={venta.kgTotales}
            onPonerPrecio={currentRole === 'owner' ? () => setTab('ajustes') : undefined}
            venta={
              <>
                <ListosParaVender
                  r={venta}
                  retiros={retiros}
                  fincaNombre={currentFinca?.nombre ?? ''}
                  ubicacion={currentFinca?.ubicacion ?? null}
                  puedeOfrecer={currentRole === 'owner' || currentRole === 'admin'}
                  onCambiarMeta={currentRole === 'owner' ? () => setTab('ajustes') : undefined}
                  onAbrirAnimal={abrirAnimal}
                />
                <NoEngordan animales={venta.noEngordan} onAbrirAnimal={abrirAnimal} />
              </>
            }
          />
        )}
        {tab === 'animales' && (
          <AnimalesScreen
            animals={appAnimals}
            fincaId={currentFinca?.id}
            potreros={potreros}
            onOpenDrawer={() => setDrawerOpen(true)}
            onSelectAnimal={setSelectedAnimal}
            onNacimientoRegistrado={() => currentFinca && loadFincaData(currentFinca.id)}
          />
        )}
        {tab === 'rfid' && (
          <RfidScreen
            animals={appAnimals}
            fincaId={currentFinca?.id}
            potreros={potreros}
            onOpenDrawer={() => setDrawerOpen(true)}
            onRegistrarPesaje={handleRegistrarPesaje}
            onAnimalCreado={() => currentFinca && loadFincaData(currentFinca.id)}
          />
        )}
        {tab === 'agenda' && (
          <AgendaScreen
            eventos={eventos}
            fincaId={currentFinca?.id}
            vacunaciones={vacunaciones}
            onOpenDrawer={() => setDrawerOpen(true)}
            onVacunacionRegistrada={() => currentFinca && loadFincaData(currentFinca.id)}
          />
        )}
        {tab === 'finanzas' && (
          <FinanzasScreen
            onOpenDrawer={() => setDrawerOpen(true)}
            role={currentRole}
            fincaId={currentFinca?.id}
            proveedores={proveedores}
            clientes={clientes}
            gastos={gastos}
            movimientos={movimientos}
            onRefresh={() => currentFinca && loadFincaData(currentFinca.id)}
          />
        )}
        {tab === 'admin' && isSuperadmin && (
          <AdminScreen onOpenDrawer={() => setDrawerOpen(true)} />
        )}
        {tab === 'reportes' && (
          <ReportesScreen
            onOpenDrawer={() => setDrawerOpen(true)}
            role={currentRole}
            fincaNombre={currentFinca?.nombre ?? ''}
            animals={appAnimals}
            gastos={gastos}
            movimientos={movimientos}
          />
        )}
        {tab === 'ajustes' && (
          <AjustesScreen
            onOpenDrawer={() => setDrawerOpen(true)}
            finca={currentFinca}
            role={currentRole}
            miembros={miembrosFinca}
            miMembresiaId={myMembresia?.id}
            displayName={displayName}
            onFincaActualizada={() => void recargarFinca()}
            onMiembrosActualizados={() => currentFinca && loadFincaData(currentFinca.id)}
          />
        )}
      </div>
      </div>

      {/* Tab bar — fixed at bottom (mobile only; desktop uses the sidebar) */}
      <div className="ag-tabbar-mobile" style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(238,242,236,.95)', backdropFilter:'blur(12px)', borderTop:'1px solid #E1E8DD', padding:'8px 8px 12px', display:'flex', zIndex:30 }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', color: active ? '#15A34A' : '#9DB39D', padding:'6px 2px' }}>
              {t.icon}
              <span style={{ fontFamily:'var(--font-jetbrains)', fontSize:10, fontWeight: active ? 700 : 500, letterSpacing:'.3px' }}>{t.label}</span>
              {active && <span style={{ width:4, height:4, borderRadius:'50%', background:'#15A34A', display:'block', marginTop:-2 }}/>}
            </button>
          );
        })}
      </div>

      {/* Overlays */}
      {drawerOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:40 }}>
          <Drawer
            open={drawerOpen}
            finca={appFinca ?? { key:'', nombre:'', ubic:'', ini:'', animales:0, kgProm:0, alertas:0, ha:0, valorCop:0, gananciaPct:0, gdpProm:0, gananciaMesKg:0, comp:{Levante:0,Ceba:0,Cría:0}, mov:{nacimientos:0,muertes:0,compras:0,ventas:0}, potreros:[] }}
            displayName={displayName}
            role={currentRole}
            showAdmin={isSuperadmin}
            onClose={() => setDrawerOpen(false)}
            onNavigate={key => { if (['inicio','animales','rfid','agenda','finanzas','admin','reportes','ajustes'].includes(key)) setTab(key as Tab); }}
            onSignOut={handleSignOut}
          />
        </div>
      )}
      {selectedAnimal && (
        <div style={{ position:'fixed', inset:0, zIndex:40 }}>
          <AnimalProfile
            animal={selectedAnimal}
            fincaId={currentFinca?.id}
            fincas={fincas}
            onClose={() => setSelectedAnimal(null)}
            onPesaje={() => { setTab('rfid'); setSelectedAnimal(null); }}
            onBajaRegistrada={() => currentFinca && loadFincaData(currentFinca.id)}
            onVentaRegistrada={() => currentFinca && loadFincaData(currentFinca.id)}
            onTrasladoRegistrado={() => currentFinca && loadFincaData(currentFinca.id)}
            onSanidadRegistrada={() => currentFinca && loadFincaData(currentFinca.id)}
            retiro={retiros.get(selectedAnimal.dbId) ?? null}
          />
        </div>
      )}
      {fincaPickerOpen && fincas.length > 0 && (
        <div style={{ position:'fixed', inset:0, zIndex:40 }}>
          <FincaPicker
            open={fincaPickerOpen}
            fincas={fincas}
            currentIdx={fincaIdx}
            onSelect={idx => { handleSelectFinca(idx); setFincaPickerOpen(false); }}
            onClose={() => setFincaPickerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
