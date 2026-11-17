'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  supabase, crearFinca, crearPotrero, getPotreros, getFincasDeOrganizacion, guardarPasoOnboarding, invitarMiembro,
  DbFinca, DbPotrero, DbOrgOnboarding, OnboardingPaso,
} from '@/lib/supabase';

const PASOS: { key: OnboardingPaso; titulo: string }[] = [
  { key: 'contrasena', titulo: 'Tu cuenta' },
  { key: 'finca',      titulo: 'Tu finca' },
  { key: 'potreros',   titulo: 'Potreros' },
  { key: 'animales',   titulo: 'Animales' },
  { key: 'equipo',     titulo: 'Tu equipo' },
  { key: 'lector',     titulo: 'Lector RFID' },
  { key: 'listo',      titulo: 'Listo' },
];

const CATEGORIAS = ['Ceba', 'Levante', 'Cría'] as const;
const SEXOS = ['Novillo', 'Toro', 'Vaca', 'Novilla', 'Ternero', 'Ternera'];

const inp: React.CSSProperties = {
  width: '100%', height: 46, border: '1.5px solid #8FA38A', borderRadius: 4,
  padding: '0 12px', fontSize: 19, background: '#fff', outline: 'none',
  fontFamily: 'inherit', color: '#0F1A0F', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: 15, color: '#3A4D3A', fontWeight: 700, letterSpacing: '.4px', marginBottom: 6, display: 'block',
};
const btnPrimario = (disabled = false): React.CSSProperties => ({
  height: 48, padding: '0 22px', border: 'none', borderRadius: 4,
  background: disabled ? '#4A5E4A' : '#15803D', color: '#fff', fontWeight: 800, fontSize: 18,
  cursor: disabled ? 'default' : 'pointer',
});
const btnSecundario: React.CSSProperties = {
  height: 48, padding: '0 18px', border: '1px solid #8FA38A', borderRadius: 4,
  background: '#fff', color: '#3A5A3A', fontWeight: 700, fontSize: 17, cursor: 'pointer',
};
const caja: React.CSSProperties = { background: '#fff', border: '1px solid #B9C6B4', borderRadius: 6, padding: 14 };

function Aviso({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', border: '1px solid #FCA5A5', padding: '8px 12px', borderRadius: 4 }}>{msg}</div>;
}

interface Props {
  org: DbOrgOnboarding;
  session: Session;
  onTerminar: () => void;
  onSalir: () => void;
}

export default function OnboardingWizard({ org, session, onTerminar, onSalir }: Props) {
  const [paso, setPaso] = useState<OnboardingPaso>(org.onboarding_paso);
  const [finca, setFinca] = useState<DbFinca | null>(null);
  const [potreros, setPotreros] = useState<DbPotrero[]>([]);
  const [resumen, setResumen] = useState({ potreros: 0, animales: 0, invitados: 0 });
  const nombreUsuario = (session.user.user_metadata?.nombre as string | undefined) ?? '';

  useEffect(() => {
    getFincasDeOrganizacion(org.id).then(f => { if (f[0]) setFinca(f[0]); });
  }, [org.id]);

  useEffect(() => {
    if (finca) getPotreros(finca.id).then(setPotreros);
  }, [finca, paso]);

  const ir = async (siguiente: OnboardingPaso) => {
    await guardarPasoOnboarding(org.id, siguiente);
    setPaso(siguiente);
    window.scrollTo({ top: 0 });
  };

  // Sin finca no se puede seguir más allá del paso de finca.
  const pasoVisible: OnboardingPaso = !finca && !['contrasena', 'finca'].includes(paso) ? 'finca' : paso;
  const idx = PASOS.findIndex(p => p.key === pasoVisible);

  return (
    <div style={{ minHeight: '100vh', background: '#EEF2EC', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 21 }}>Bienvenido a AgroSense</div>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#3A4D3A', marginTop: 3 }}>
              Paso {idx + 1} de {PASOS.length} · {PASOS[idx].titulo}
            </div>
          </div>
          <button onClick={onSalir} style={{ background: 'none', border: 'none', color: '#3A4D3A', fontSize: 16, cursor: 'pointer', textDecoration: 'underline' }}>
            Cerrar sesión
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 22 }} aria-hidden>
          {PASOS.map((p, i) => (
            <div key={p.key} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= idx ? '#15803D' : '#D5E0D0' }} />
          ))}
        </div>

        {pasoVisible === 'contrasena' && (
          <PasoContrasena nombreInicial={nombreUsuario} email={session.user.email ?? ''} onListo={() => ir('finca')} />
        )}
        {pasoVisible === 'finca' && (
          <PasoFinca org={org} finca={finca} onCreada={setFinca} onListo={() => ir('potreros')} />
        )}
        {pasoVisible === 'potreros' && finca && (
          <PasoPotreros finca={finca} potreros={potreros} onCambio={() => getPotreros(finca.id).then(p => { setPotreros(p); setResumen(r => ({ ...r, potreros: p.length })); })}
            onListo={() => ir('animales')} onAtras={() => ir('finca')} />
        )}
        {pasoVisible === 'animales' && finca && (
          <PasoAnimales finca={finca} potreros={potreros} onRegistrados={n => setResumen(r => ({ ...r, animales: r.animales + n }))}
            onListo={() => ir('equipo')} onAtras={() => ir('potreros')} />
        )}
        {pasoVisible === 'equipo' && finca && (
          <PasoEquipo finca={finca} onInvitado={() => setResumen(r => ({ ...r, invitados: r.invitados + 1 }))}
            onListo={() => ir('lector')} onAtras={() => ir('animales')} />
        )}
        {pasoVisible === 'lector' && (
          <PasoLector onListo={() => ir('listo')} onAtras={() => ir('equipo')} />
        )}
        {pasoVisible === 'listo' && (
          <PasoListo finca={finca} resumen={resumen} onEntrar={async () => { await guardarPasoOnboarding(org.id, 'listo'); onTerminar(); }} />
        )}
      </div>
    </div>
  );
}

// ---------- Paso 1: contraseña y nombre ----------

function PasoContrasena({ nombreInicial, email, onListo }: { nombreInicial: string; email: string; onListo: () => void }) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass.length < 8) { setErr('La contraseña debe tener al menos 8 caracteres'); return; }
    if (pass !== pass2) { setErr('Las contraseñas no coinciden'); return; }
    setSaving(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password: pass, data: { nombre: nombre.trim() || nombreInicial } });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onListo();
  };

  return (
    <form onSubmit={guardar} style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, color: '#3A5A3A', lineHeight: 1.5 }}>
        Vamos a dejar tu finca lista en unos minutos. Primero crea la contraseña con la que vas a entrar
        como <b>{email}</b>.
      </div>
      <div>
        <label style={lbl}>TU NOMBRE</label>
        <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" />
      </div>
      <div>
        <label style={lbl}>CONTRASEÑA (MÍNIMO 8 CARACTERES)</label>
        <input style={inp} type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="new-password" />
      </div>
      <div>
        <label style={lbl}>REPITE LA CONTRASEÑA</label>
        <input style={inp} type="password" value={pass2} onChange={e => setPass2(e.target.value)} autoComplete="new-password" />
      </div>
      <Aviso msg={err} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <button type="button" onClick={onListo} style={{ ...btnSecundario, border: 'none', background: 'none', textDecoration: 'underline' }}>
          Ya tengo contraseña
        </button>
        <button type="submit" disabled={saving} style={btnPrimario(saving)}>{saving ? 'Guardando…' : 'Continuar'}</button>
      </div>
    </form>
  );
}

// ---------- Paso 2: finca ----------

function PasoFinca({ org, finca, onCreada, onListo }: { org: DbOrgOnboarding; finca: DbFinca | null; onCreada: (f: DbFinca) => void; onListo: () => void }) {
  const [orgNombre, setOrgNombre] = useState(org.nombre);
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [hectareas, setHectareas] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (finca) {
    return (
      <div style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 18, color: '#3A5A3A' }}>Tu finca ya está registrada:</div>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{finca.nombre}</div>
        <div style={{ fontSize: 16, color: '#3A4D3A' }}>{[finca.ubicacion, finca.hectareas ? `${finca.hectareas} ha` : null].filter(Boolean).join(' · ')}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onListo} style={btnPrimario()}>Continuar</button>
        </div>
      </div>
    );
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setErr('Escribe el nombre de la finca'); return; }
    setSaving(true); setErr(null);
    if (orgNombre.trim() && orgNombre.trim() !== org.nombre) {
      await guardarPasoOnboarding(org.id, 'finca', { nombre: orgNombre.trim() });
    }
    const ha = hectareas ? parseFloat(hectareas.replace(',', '.')) : null;
    const { error, id } = await crearFinca({ nombre: nombre.trim(), ubicacion: ubicacion.trim() || null, hectareas: ha, organizacion_id: org.id });
    setSaving(false);
    if (error || !id) {
      setErr(/row-level security/i.test(error ?? '') ? 'Tu plan no permite crear más fincas. Escríbenos para ampliarlo.' : (error ?? 'No se pudo crear la finca'));
      return;
    }
    onCreada({ id, nombre: nombre.trim(), ubicacion: ubicacion.trim() || null, hectareas: ha, valor_cop: 0, activa: true, organizacion_id: org.id });
    onListo();
  };

  return (
    <form onSubmit={guardar} style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, color: '#3A5A3A', lineHeight: 1.5 }}>Cuéntanos de tu finca. Si tienes varias, empieza por una; las demás las agregas después.</div>
      <div>
        <label style={lbl}>NOMBRE DE TU GANADERÍA O EMPRESA</label>
        <input style={inp} value={orgNombre} onChange={e => setOrgNombre(e.target.value)} />
      </div>
      <div>
        <label style={lbl}>NOMBRE DE LA FINCA</label>
        <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Hacienda El Roble" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>MUNICIPIO Y DEPARTAMENTO</label>
          <input style={inp} value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Ej: Montería, Córdoba" />
        </div>
        <div>
          <label style={lbl}>HECTÁREAS</label>
          <input style={inp} inputMode="decimal" value={hectareas} onChange={e => setHectareas(e.target.value)} placeholder="0" />
        </div>
      </div>
      <Aviso msg={err} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={saving} style={btnPrimario(saving)}>{saving ? 'Creando…' : 'Crear finca y continuar'}</button>
      </div>
    </form>
  );
}

// ---------- Paso 3: potreros ----------

function PasoPotreros({ finca, potreros, onCambio, onListo, onAtras }: {
  finca: DbFinca; potreros: DbPotrero[]; onCambio: () => void; onListo: () => void; onAtras: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [hectareas, setHectareas] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const agregar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true); setErr(null);
    const { error } = await crearPotrero({
      finca_id: finca.id, nombre: nombre.trim(),
      hectareas: hectareas ? parseFloat(hectareas.replace(',', '.')) : null,
      capacidad: capacidad ? parseInt(capacidad, 10) : 0,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    setNombre(''); setHectareas(''); setCapacidad('');
    onCambio();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, color: '#3A5A3A', lineHeight: 1.5 }}>
        Agrega los potreros de <b>{finca.nombre}</b> para saber dónde está cada animal y controlar la rotación. Puedes saltar este paso.
      </div>
      {potreros.length > 0 && (
        <div style={{ ...caja, padding: 0 }}>
          {potreros.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: i ? '1px solid #EDF1EA' : 'none', fontSize: 17 }}>
              <span style={{ fontWeight: 600 }}>{p.nombre}</span>
              <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 15, color: '#3A4D3A' }}>{p.capacidad ? `${p.capacidad} animales` : ''}</span>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={agregar} style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={lbl}>NOMBRE DEL POTRERO</label>
          <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: La Loma" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={lbl}>HECTÁREAS</label>
            <input style={inp} inputMode="decimal" value={hectareas} onChange={e => setHectareas(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>CAPACIDAD (ANIMALES)</label>
            <input style={inp} inputMode="numeric" value={capacidad} onChange={e => setCapacidad(e.target.value.replace(/\D/g, ''))} placeholder="0" />
          </div>
        </div>
        <Aviso msg={err} />
        <button type="submit" disabled={saving || !nombre.trim()} style={{ ...btnSecundario, color: '#15803D', borderColor: '#15803D' }}>
          {saving ? 'Agregando…' : '+ Agregar potrero'}
        </button>
      </form>
      <Navegacion onAtras={onAtras} onListo={onListo} textoListo={potreros.length ? 'Continuar' : 'Saltar por ahora'} />
    </div>
  );
}

// ---------- Paso 4: animales ----------

type FilaAnimal = { arete: string; nombre: string; raza: string; sexo: string; categoria: string; peso: number | null };

function parsearPegado(texto: string): { filas: FilaAnimal[]; errores: string[] } {
  const filas: FilaAnimal[] = [];
  const errores: string[] = [];
  texto.split(/\r?\n/).forEach((linea, i) => {
    if (!linea.trim()) return;
    const c = (linea.includes('\t') ? linea.split('\t') : linea.split(/[;,]/)).map(x => x.trim());
    if (i === 0 && /arete|chapeta|id/i.test(c[0] ?? '')) return; // encabezado
    const arete = c[0] ?? '';
    if (!arete) { errores.push(`Línea ${i + 1}: falta el arete`); return; }
    const pesoTxt = (c[5] ?? '').replace(/[^\d.,]/g, '').replace(',', '.');
    const peso = pesoTxt ? parseFloat(pesoTxt) : null;
    const catRaw = (c[4] ?? '').toLowerCase();
    const categoria = CATEGORIAS.find(k => k.toLowerCase().startsWith(catRaw.slice(0, 3)) && catRaw) ?? 'Ceba';
    filas.push({ arete, nombre: c[1] ?? '', raza: c[2] ?? '', sexo: c[3] || 'Novillo', categoria, peso: peso && peso > 0 ? peso : null });
  });
  return { filas, errores };
}

async function registrarFila(finca_id: string, potrero_id: string | null, f: FilaAnimal) {
  const { error } = await supabase.rpc('registrar_animal', {
    p_finca_id: finca_id, p_arete: f.arete, p_nombre: f.nombre, p_raza: f.raza || null, p_sexo: f.sexo,
    p_categoria: f.categoria, p_potrero_id: potrero_id, p_peso_kg: f.peso,
    p_fecha: new Date().toISOString().slice(0, 10), p_origen: 'compra',
  });
  if (!error) return null;
  return /animales_arete_activo_uq|duplicate/i.test(error.message) ? `El arete ${f.arete} ya existe` : `${f.arete}: ${error.message}`;
}

function PasoAnimales({ finca, potreros, onRegistrados, onListo, onAtras }: {
  finca: DbFinca; potreros: DbPotrero[]; onRegistrados: (n: number) => void; onListo: () => void; onAtras: () => void;
}) {
  const [modo, setModo] = useState<'pegar' | 'uno'>('pegar');
  const [potreroId, setPotreroId] = useState('');
  const [texto, setTexto] = useState('');
  const [uno, setUno] = useState<FilaAnimal>({ arete: '', nombre: '', raza: '', sexo: 'Novillo', categoria: 'Ceba', peso: null });
  const [saving, setSaving] = useState(false);
  const [progreso, setProgreso] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [total, setTotal] = useState(0);

  const vista = modo === 'pegar' && texto.trim() ? parsearPegado(texto) : null;

  const importar = async () => {
    if (!vista?.filas.length) return;
    setSaving(true); setErrores([]);
    const errs: string[] = [...vista.errores];
    let ok = 0;
    for (let i = 0; i < vista.filas.length; i++) {
      setProgreso(`Registrando ${i + 1} de ${vista.filas.length}…`);
      const e = await registrarFila(finca.id, potreroId || null, vista.filas[i]);
      if (e) errs.push(e); else ok++;
    }
    setSaving(false); setProgreso('');
    setErrores(errs); setTotal(t => t + ok); onRegistrados(ok);
    if (!errs.length) setTexto('');
  };

  const agregarUno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uno.arete.trim()) return;
    setSaving(true); setErrores([]);
    const err = await registrarFila(finca.id, potreroId || null, { ...uno, arete: uno.arete.trim() });
    setSaving(false);
    if (err) { setErrores([err]); return; }
    setTotal(t => t + 1); onRegistrados(1);
    setUno({ ...uno, arete: '', nombre: '', peso: null });
  };

  const tab = (k: 'pegar' | 'uno', t: string) => (
    <button type="button" onClick={() => setModo(k)} style={{
      flex: 1, height: 40, border: 'none', borderBottom: `3px solid ${modo === k ? '#15803D' : 'transparent'}`,
      background: 'none', fontWeight: 700, fontSize: 17, color: modo === k ? '#15803D' : '#3A4D3A', cursor: 'pointer',
    }}>{t}</button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, color: '#3A5A3A', lineHeight: 1.5 }}>
        Registra tu hato. Si ya lo tienes en Excel, copia las columnas y pégalas aquí. El número de arete es el que leerá el lector RFID.
      </div>
      {total > 0 && (
        <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 4, padding: '10px 12px', fontSize: 13, color: '#15803D', fontWeight: 700 }}>
          {total} {total === 1 ? 'animal registrado' : 'animales registrados'}
        </div>
      )}
      {potreros.length > 0 && (
        <div>
          <label style={lbl}>POTRERO DONDE ESTÁN (OPCIONAL)</label>
          <select style={inp} value={potreroId} onChange={e => setPotreroId(e.target.value)}>
            <option value="">Sin potrero</option>
            {potreros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      )}
      <div style={{ ...caja, padding: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #EDF1EA' }}>{tab('pegar', 'Pegar desde Excel')}{tab('uno', 'Uno por uno')}</div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {modo === 'pegar' ? (
            <>
              <div style={{ fontSize: 16, color: '#3A4D3A', lineHeight: 1.5 }}>
                Columnas en este orden: <b>arete, nombre, raza, sexo, categoría, peso (kg)</b>. Solo el arete es obligatorio.
              </div>
              <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={7}
                placeholder={'arete\tnombre\traza\tsexo\tcategoría\tpeso\n1023\tPinto\tBrahman\tNovillo\tCeba\t320\n1024\t\tCebú\tNovillo\tLevante\t245'}
                style={{ ...inp, height: 'auto', padding: 10, fontFamily: 'var(--font-jetbrains)', fontSize: 16, resize: 'vertical' }} />
              {vista && (
                <div style={{ fontSize: 16, color: '#3A5A3A' }}>
                  {vista.filas.length} {vista.filas.length === 1 ? 'animal listo' : 'animales listos'} para registrar
                  {vista.errores.length > 0 && <span style={{ color: '#B45309' }}> · {vista.errores.length} líneas con problemas</span>}
                </div>
              )}
              <button type="button" onClick={importar} disabled={saving || !vista?.filas.length} style={btnPrimario(saving || !vista?.filas.length)}>
                {saving ? progreso : 'Registrar animales'}
              </button>
            </>
          ) : (
            <form onSubmit={agregarUno} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>ARETE *</label><input style={inp} value={uno.arete} onChange={e => setUno({ ...uno, arete: e.target.value })} /></div>
                <div><label style={lbl}>NOMBRE</label><input style={inp} value={uno.nombre} onChange={e => setUno({ ...uno, nombre: e.target.value })} /></div>
                <div><label style={lbl}>RAZA</label><input style={inp} value={uno.raza} onChange={e => setUno({ ...uno, raza: e.target.value })} placeholder="Brahman" /></div>
                <div><label style={lbl}>PESO (KG)</label><input style={inp} inputMode="decimal" value={uno.peso ?? ''} onChange={e => setUno({ ...uno, peso: e.target.value ? parseFloat(e.target.value.replace(',', '.')) || null : null })} /></div>
                <div>
                  <label style={lbl}>SEXO</label>
                  <select style={inp} value={uno.sexo} onChange={e => setUno({ ...uno, sexo: e.target.value })}>{SEXOS.map(s => <option key={s}>{s}</option>)}</select>
                </div>
                <div>
                  <label style={lbl}>CATEGORÍA</label>
                  <select style={inp} value={uno.categoria} onChange={e => setUno({ ...uno, categoria: e.target.value })}>{CATEGORIAS.map(s => <option key={s}>{s}</option>)}</select>
                </div>
              </div>
              <button type="submit" disabled={saving || !uno.arete.trim()} style={btnPrimario(saving || !uno.arete.trim())}>{saving ? 'Guardando…' : '+ Agregar animal'}</button>
            </form>
          )}
          {errores.length > 0 && (
            <div style={{ fontSize: 16, color: '#B45309', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 4, padding: '8px 12px', maxHeight: 140, overflowY: 'auto' }}>
              {errores.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      </div>
      <Navegacion onAtras={onAtras} onListo={onListo} textoListo={total ? 'Continuar' : 'Saltar por ahora'} />
    </div>
  );
}

// ---------- Paso 5: equipo ----------

function PasoEquipo({ finca, onInvitado, onListo, onAtras }: { finca: DbFinca; onInvitado: () => void; onListo: () => void; onAtras: () => void }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<'admin' | 'contable' | 'vaquero'>('vaquero');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [invitados, setInvitados] = useState<{ nombre: string; email: string; rol: string }[]>([]);

  const invitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) return;
    setSaving(true); setErr(null);
    const { error } = await invitarMiembro({ finca_id: finca.id, email: email.trim(), nombre: nombre.trim(), rol });
    setSaving(false);
    if (error) { setErr(error); return; }
    setInvitados(l => [...l, { nombre: nombre.trim(), email: email.trim(), rol }]);
    onInvitado();
    setNombre(''); setEmail('');
  };

  const ROL_TXT = { vaquero: 'Vaquero: registra pesajes y animales', admin: 'Administrador: maneja hato y operación, sin finanzas', contable: 'Contable: solo finanzas' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, color: '#3A5A3A', lineHeight: 1.5 }}>
        Invita a tu mayordomo, vaqueros o contador. Cada uno recibe un correo para entrar y solo ve lo que le corresponde.
      </div>
      {invitados.length > 0 && (
        <div style={{ ...caja, padding: 0 }}>
          {invitados.map((m, i) => (
            <div key={i} style={{ padding: '10px 14px', borderTop: i ? '1px solid #EDF1EA' : 'none', fontSize: 17 }}>
              <b>{m.nombre}</b> · {m.email} <span style={{ color: '#15803D', fontWeight: 700 }}>· invitación enviada</span>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={invitar} style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label style={lbl}>NOMBRE</label><input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} /></div>
        <div><label style={lbl}>CORREO</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" /></div>
        <div>
          <label style={lbl}>ROL</label>
          <select style={inp} value={rol} onChange={e => setRol(e.target.value as typeof rol)}>
            {(Object.keys(ROL_TXT) as (keyof typeof ROL_TXT)[]).map(k => <option key={k} value={k}>{ROL_TXT[k]}</option>)}
          </select>
        </div>
        <Aviso msg={err} />
        <button type="submit" disabled={saving || !nombre.trim() || !email.trim()} style={{ ...btnSecundario, color: '#15803D', borderColor: '#15803D' }}>
          {saving ? 'Enviando…' : 'Enviar invitación'}
        </button>
      </form>
      <Navegacion onAtras={onAtras} onListo={onListo} textoListo={invitados.length ? 'Continuar' : 'Saltar por ahora'} />
    </div>
  );
}

// ---------- Paso 6: lector RFID ----------

function PasoLector({ onListo, onAtras }: { onListo: () => void; onAtras: () => void }) {
  const tienda = process.env.NEXT_PUBLIC_TIENDA_URL;
  const items = [
    ['Enciende el lector', 'Cárgalo por completo antes de la primera jornada.'],
    ['Usa Chrome', 'En Android o computador, abre AgroSense en Chrome. El lector se conecta por Bluetooth desde la pestaña RFID.'],
    ['Conecta', 'En la pestaña RFID toca "Conectar lector" y elige tu equipo de la lista.'],
    ['Lee un arete', 'Acerca el lector a la oreja del animal. Si el arete está registrado, se abre su ficha para anotar el peso.'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, color: '#3A5A3A', lineHeight: 1.5 }}>Con el lector RFID pesas y registras animales sin escribir el arete a mano.</div>
      <div style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(([t, d], i) => (
          <div key={t} style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
            <div><div style={{ fontWeight: 700, fontSize: 17 }}>{t}</div><div style={{ fontSize: 16, color: '#3A4D3A', lineHeight: 1.45 }}>{d}</div></div>
          </div>
        ))}
        <div style={{ fontSize: 16, color: '#3A4D3A', background: '#F5F8F3', borderRadius: 4, padding: '8px 10px' }}>
          En iPhone el navegador aún no permite Bluetooth. Puedes escribir el arete a mano mientras tanto.
        </div>
      </div>
      {tienda && (
        <a href={tienda} target="_blank" rel="noreferrer" style={{ ...caja, display: 'block', textDecoration: 'none', color: '#0F1A0F' }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>¿Aún no tienes lector o aretes?</div>
          <div style={{ fontSize: 16, color: '#15803D', fontWeight: 700, marginTop: 2 }}>Pídelos a Frigorodeo →</div>
        </a>
      )}
      <Navegacion onAtras={onAtras} onListo={onListo} textoListo="Continuar" />
    </div>
  );
}

// ---------- Paso 7: listo ----------

function PasoListo({ finca, resumen, onEntrar }: { finca: DbFinca | null; resumen: { potreros: number; animales: number; invitados: number }; onEntrar: () => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <div style={{ ...caja, textAlign: 'center', padding: '28px 18px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
      </div>
      <div style={{ fontWeight: 800, fontSize: 22 }}>{finca ? `${finca.nombre} está lista` : 'Todo listo'}</div>
      {(resumen.potreros + resumen.animales + resumen.invitados) > 0 && (
        <div style={{ fontSize: 17, color: '#3A4D3A' }}>
          {[resumen.potreros && `${resumen.potreros} potreros`, resumen.animales && `${resumen.animales} animales`, resumen.invitados && `${resumen.invitados} invitados`].filter(Boolean).join(' · ')}
        </div>
      )}
      <div style={{ fontSize: 17, color: '#3A5A3A', lineHeight: 1.5, maxWidth: 380 }}>
        Lo siguiente: haz tu primera jornada de pesaje desde la pestaña RFID para empezar a ver la ganancia diaria de peso de cada animal.
      </div>
      <button disabled={saving} onClick={() => { setSaving(true); onEntrar(); }} style={{ ...btnPrimario(saving), marginTop: 6 }}>
        {saving ? 'Abriendo…' : 'Entrar a mi finca'}
      </button>
    </div>
  );
}

function Navegacion({ onAtras, onListo, textoListo }: { onAtras: () => void; onListo: () => void; textoListo: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <button type="button" onClick={onAtras} style={btnSecundario}>Atrás</button>
      <button type="button" onClick={onListo} style={btnPrimario()}>{textoListo}</button>
    </div>
  );
}
