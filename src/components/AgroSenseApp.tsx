'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Animal, Tab, RoleKey, CAT, ESTADO } from '@/data/agrosense';
import {
  supabase, getFincas, getPotreros, getAnimales, getPesajesRecientes,
  getAlertas, getEventos, getProveedores, getClientes, getGastos, getMovimientos,
  registrarPesaje, getMisMembresias,
  DbFinca, DbPotrero, DbAnimal, DbAlerta, DbEvento, DbProveedor, DbCliente, DbGasto, DbMovimiento, DbPesaje, DbMembresia,
} from '@/lib/supabase';
import InicioScreen from './screens/InicioScreen';
import AnimalesScreen from './screens/AnimalesScreen';
import RfidScreen from './screens/RfidScreen';
import AgendaScreen from './screens/AgendaScreen';
import FinanzasScreen from './screens/FinanzasScreen';
import Drawer from './ui/Drawer';
import AnimalProfile from './ui/AnimalProfile';
import FincaPicker from './ui/FincaPicker';
import LoginScreen from './auth/LoginScreen';

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

function dbFincaToFinca(f: DbFinca, potreros: DbPotrero[], animales: DbAnimal[]) {
  const comp = { Levante: 0, Ceba: 0, Cría: 0 };
  const mov  = { nacimientos: 0, muertes: 0, compras: 0, ventas: 0 };
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

  // DB state
  const [loading,   setLoading]   = useState(true);
  const [fincas,    setFincas]    = useState<DbFinca[]>([]);
  const [fincaIdx,  setFincaIdx]  = useState(0);
  const [potreros,  setPotreros]  = useState<DbPotrero[]>([]);
  const [animales,  setAnimales]  = useState<DbAnimal[]>([]);
  const [alertas,   setAlertas]   = useState<DbAlerta[]>([]);
  const [eventos,   setEventos]   = useState<DbEvento[]>([]);
  const [proveedores, setProveedores] = useState<DbProveedor[]>([]);
  const [clientes,  setClientes]  = useState<DbCliente[]>([]);
  const [gastos,    setGastos]    = useState<DbGasto[]>([]);
  const [movimientos, setMovimientos] = useState<DbMovimiento[]>([]);
  const [pendingSync, setPendingSync] = useState(0);

  const currentFinca = fincas[fincaIdx];

  const loadFincaData = useCallback(async (finca_id: string) => {
    const [pot, anim, alt, ev, prov, cli, gas, mov] = await Promise.all([
      getPotreros(finca_id),
      getAnimales(finca_id),
      getAlertas(finca_id),
      getEventos(finca_id),
      getProveedores(finca_id),
      getClientes(finca_id),
      getGastos(finca_id),
      getMovimientos(finca_id),
    ]);
    setPotreros(pot);
    setAnimales(anim);
    setAlertas(alt);
    setEventos(ev);
    setProveedores(prov);
    setClientes(cli);
    setGastos(gas);
    setMovimientos(mov);
    setPendingSync(gas.filter(g => g.pendiente_sync).length);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthChecked(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    Promise.all([getFincas(), getMisMembresias()]).then(([f, m]) => {
      setMembresias(m);
      const allowed = new Set(m.map(x => x.finca_id));
      const mine = f.filter(x => allowed.has(x.id));
      setFincas(mine);
      if (mine.length) loadFincaData(mine[0].id).finally(() => setLoading(false));
      else setLoading(false);
    });
  }, [session, loadFincaData]);

  const handleSignOut = () => { supabase.auth.signOut(); };

  const handleSelectFinca = async (idx: number) => {
    setFincaIdx(idx);
    setLoading(true);
    await loadFincaData(fincas[idx].id);
    setLoading(false);
  };

  const handleRegistrarPesaje = async (animal: Animal, pesoKg: number) => {
    const dbAnimal = animales.find(a => a.arete === animal.arete);
    if (!dbAnimal || !currentFinca) return;
    const diasPeriodo = 14;
    const gdp = dbAnimal.peso_actual ? (pesoKg - dbAnimal.peso_actual) / diasPeriodo : 0;
    await registrarPesaje({
      animal_id: dbAnimal.id,
      finca_id: currentFinca.id,
      sesion_id: null as unknown as undefined,
      usuario_id: null as unknown as undefined,
      peso_kg: pesoKg,
      gdp_calculado: Math.round(gdp * 1000) / 1000,
      dias_periodo: diasPeriodo,
      pendiente_sync: false,
      fecha: new Date().toISOString(),
    } as Omit<DbPesaje, 'id'>);
    await loadFincaData(currentFinca.id);
  };

  // Map DB data to app-layer types
  const potreroMap = Object.fromEntries(potreros.map(p => [p.id, p.nombre]));
  const appAnimals: Animal[] = animales.map(a => dbAnimalToAnimal(a, potreroMap[a.potrero_id ?? ''] ?? 'Sin potrero'));
  const appFinca = currentFinca ? dbFincaToFinca(currentFinca, potreros, animales) : null;

  const myMembresia = membresias.find(m => m.finca_id === currentFinca?.id);
  const currentRole: RoleKey = myMembresia?.rol ?? 'vaquero';
  const displayName = myMembresia?.nombre ?? session?.user.email ?? '';

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
        onClose={() => {}}
        onNavigate={key => { if (['inicio','animales','rfid','agenda','finanzas'].includes(key)) setTab(key as Tab); }}
        onSignOut={handleSignOut}
      />

      {/* Screen content */}
      <div className="ag-main" style={{ flex:1, display:'flex', flexDirection:'column' }}>
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
            pendingSync={pendingSync}
          />
        )}
        {tab === 'animales' && (
          <AnimalesScreen
            animals={appAnimals}
            onOpenDrawer={() => setDrawerOpen(true)}
            onSelectAnimal={setSelectedAnimal}
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
            onOpenDrawer={() => setDrawerOpen(true)}
          />
        )}
        {tab === 'finanzas' && (
          <FinanzasScreen
            onOpenDrawer={() => setDrawerOpen(true)}
            role={currentRole}
            proveedores={proveedores}
            clientes={clientes}
            gastos={gastos}
            movimientos={movimientos}
            onRefresh={() => currentFinca && loadFincaData(currentFinca.id)}
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
            onClose={() => setDrawerOpen(false)}
            onNavigate={key => { if (['inicio','animales','rfid','agenda','finanzas'].includes(key)) setTab(key as Tab); }}
            onSignOut={handleSignOut}
          />
        </div>
      )}
      {selectedAnimal && (
        <div style={{ position:'fixed', inset:0, zIndex:40 }}>
          <AnimalProfile
            animal={selectedAnimal}
            onClose={() => setSelectedAnimal(null)}
            onPesaje={() => { setTab('rfid'); setSelectedAnimal(null); }}
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
