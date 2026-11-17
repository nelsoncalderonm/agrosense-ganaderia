'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  crearPotrero, getAnalisisSuelo, crearAnalisisSuelo, eliminarAnalisisSuelo, getSueloPdfUrl,
  type DbPotrero, type DbAnalisisSuelo,
} from '@/lib/supabase';
import { PARAMETROS, TEXTURAS, COLOR_NIVEL, type Parametro } from '@/lib/suelo';
import EncabezadoPantalla from '../ui/EncabezadoPantalla';
import { C, inp, lbl, card, btnPrincipal, btnSecundario, aviso } from '../ui/estilosCampo';

const fechaLarga = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const num = (s: string) => { const v = Number(s.replace(',', '.')); return s.trim() === '' || !Number.isFinite(v) ? null : v; };
const sinSenal = () => typeof navigator !== 'undefined' && !navigator.onLine;
const claveCache = (fincaId: string) => `gad:suelos:${fincaId}`;

function Semaforo({ p, v }: { p: Parametro; v: number }) {
  const e = p.evaluar(v);
  const c = COLOR_NIVEL[e.nivel];
  return <span style={{ background: c.fondo, color: c.color, fontWeight: 800, fontSize: 15, borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap' }}>{e.txt}</span>;
}

/* ───────────── Formulario de análisis ───────────── */

function FormAnalisis({ potrero, onCancelar, onGuardado }: { potrero: DbPotrero; onCancelar: () => void; onGuardado: () => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [laboratorio, setLaboratorio] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [textura, setTextura] = useState('');
  const [notas, setNotas] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [mas, setMas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const guardar = async () => {
    if (sinSenal()) { setErr('Sin señal. El análisis de suelo se guarda cuando tengas internet.'); return; }
    const valores = Object.fromEntries(PARAMETROS.map(p => [p.campo, num(vals[p.campo] ?? '')]));
    if (Object.values(valores).every(v => v == null) && !textura && !pdf) { setErr('Escribe al menos un valor o adjunta el PDF del laboratorio.'); return; }
    if (valores.ph != null && (valores.ph < 0 || valores.ph > 14)) { setErr('El pH va de 0 a 14.'); return; }
    if (pdf && pdf.size > 10 * 1024 * 1024) { setErr('El PDF pesa más de 10 MB.'); return; }
    setGuardando(true); setErr(null);
    const { error } = await crearAnalisisSuelo({
      finca_id: potrero.finca_id, potrero_id: potrero.id, fecha,
      laboratorio: laboratorio.trim() || null, textura: textura || null, notas: notas.trim() || null,
      ph: valores.ph, materia_organica: valores.materia_organica, nitrogeno: valores.nitrogeno,
      fosforo: valores.fosforo, potasio: valores.potasio, calcio: valores.calcio,
      magnesio: valores.magnesio, aluminio: valores.aluminio,
    }, pdf);
    setGuardando(false);
    if (error) { setErr(error); return; }
    onGuardado();
  };

  const campo = (p: Parametro) => {
    const v = num(vals[p.campo] ?? '');
    return (
      <div key={p.campo}>
        <label style={lbl}>{p.nombre.toUpperCase()}{p.unidad ? ` (${p.unidad})` : ''}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input style={{ ...inp, flex: 1 }} inputMode="decimal" value={vals[p.campo] ?? ''} placeholder="—"
            onChange={e => setVals(s => ({ ...s, [p.campo]: e.target.value }))} />
          {v != null && <Semaforo p={p} v={v} />}
        </div>
        <div style={{ fontSize: 14, color: C.suave, marginTop: 3 }}>{p.ayuda}</div>
      </div>
    );
  };

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 19 }}>Nuevo análisis de suelo</div>
      <div style={{ fontSize: 16, color: C.suave }}>Copia los valores del informe del laboratorio. Los que no tengas, déjalos vacíos.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label style={lbl}>FECHA DE LA MUESTRA</label><input style={inp} type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
        <div><label style={lbl}>LABORATORIO</label><input style={inp} value={laboratorio} onChange={e => setLaboratorio(e.target.value)} placeholder="Ej. Agrosavia" /></div>
      </div>
      {PARAMETROS.filter(p => p.basico).map(campo)}
      <div>
        <label style={lbl}>TEXTURA</label>
        <select style={inp} value={textura} onChange={e => setTextura(e.target.value)}>
          <option value="">— Sin dato —</option>
          {TEXTURAS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {mas ? PARAMETROS.filter(p => !p.basico).map(campo) : (
        <button onClick={() => setMas(true)} style={btnSecundario}>+ Más valores (calcio, magnesio, aluminio)</button>
      )}
      <div><label style={lbl}>NOTAS</label>
        <textarea style={{ ...inp, height: 90, padding: 10, resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Recomendación del agrónomo, cal aplicada, etc." />
      </div>
      <div>
        <label style={lbl}>PDF DEL LABORATORIO (OPCIONAL)</label>
        <input type="file" accept="application/pdf" onChange={e => setPdf(e.target.files?.[0] ?? null)} style={{ fontSize: 16 }} />
      </div>
      {err && <div style={aviso('error')}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
        <button onClick={onCancelar} style={btnSecundario}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={btnPrincipal(guardando)}>{guardando ? 'Guardando…' : 'Guardar análisis'}</button>
      </div>
    </div>
  );
}

/* ───────────── Tarjeta de un análisis ───────────── */

function TarjetaAnalisis({ a, onEliminado }: { a: DbAnalisisSuelo; onEliminado: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const consejos = PARAMETROS.flatMap(p => { const v = a[p.campo]; if (v == null) return []; const e = p.evaluar(Number(v)); return e.consejo && e.nivel !== 'bien' ? [e.consejo] : []; });

  const abrirPdf = async () => {
    if (!a.pdf_path) return;
    const url = await getSueloPdfUrl(a.pdf_path);
    if (url) window.open(url, '_blank'); else setErr('No se pudo abrir el PDF. Revisa la señal.');
  };
  const eliminar = async () => {
    if (!confirmar) { setConfirmar(true); return; }
    const { error } = await eliminarAnalisisSuelo(a.id);
    if (error) { setErr(error); return; }
    onEliminado();
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <div style={{ fontWeight: 800, fontSize: 19 }}>{fechaLarga(a.fecha)}</div>
        {a.laboratorio && <div style={{ fontSize: 15, color: C.suave, fontWeight: 700, textAlign: 'right' }}>{a.laboratorio}</div>}
      </div>
      <div style={{ marginTop: 8 }}>
        {PARAMETROS.map(p => {
          const v = a[p.campo];
          if (v == null) return null;
          return (
            <div key={p.campo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.fondo}` }}>
              <div style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{p.nombre}</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{Number(v).toLocaleString('es-CO')}{p.unidad && <span style={{ fontSize: 14, color: C.suave, fontWeight: 600 }}> {p.unidad}</span>}</div>
              <Semaforo p={p} v={Number(v)} />
            </div>
          );
        })}
        {a.textura && (
          <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.fondo}` }}>
            <div style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>Textura</div><div style={{ fontSize: 18, fontWeight: 800 }}>{a.textura}</div>
          </div>
        )}
      </div>
      {consejos.length > 0 && (
        <div style={{ ...aviso('info'), color: C.texto, background: C.ambarSuave, marginTop: 8, lineHeight: 1.4 }}>
          {consejos.map((c, i) => <div key={i}>• {c}</div>)}
        </div>
      )}
      {a.notas && <div style={{ fontSize: 16, marginTop: 10, whiteSpace: 'pre-wrap' }}>{a.notas}</div>}
      {err && <div style={{ ...aviso('error'), marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {a.pdf_path && <button onClick={abrirPdf} style={btnSecundario}>Ver PDF</button>}
        <button onClick={eliminar} onBlur={() => setConfirmar(false)} style={{ ...btnSecundario, color: C.rojo, borderColor: confirmar ? C.rojo : C.bordeFuerte, background: confirmar ? C.rojoSuave : '#fff' }}>
          {confirmar ? '¿Borrar? Toca otra vez' : 'Borrar'}
        </button>
      </div>
    </div>
  );
}

/* ───────────── Resumen corto para la lista ───────────── */

function ResumenSuelo({ a }: { a?: DbAnalisisSuelo }) {
  if (!a) return <div style={{ fontSize: 15, color: C.suave, fontWeight: 600, marginTop: 6 }}>Sin análisis de suelo</div>;
  const chips = PARAMETROS.filter(p => p.basico && a[p.campo] != null).slice(0, 4);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 15, color: C.suave, fontWeight: 600 }}>Suelo: análisis del {fechaLarga(a.fecha)}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {chips.map(p => {
          const e = p.evaluar(Number(a[p.campo])); const c = COLOR_NIVEL[e.nivel];
          return <span key={p.campo} style={{ background: c.fondo, color: c.color, fontWeight: 800, fontSize: 14, borderRadius: 4, padding: '3px 8px' }}>{p.campo === 'ph' ? `pH ${Number(a.ph)}` : p.nombre}: {e.txt}</span>;
        })}
      </div>
    </div>
  );
}

/* ───────────── Pantalla ───────────── */

export default function PotrerosScreen({ fincaId, potreros, animalesPorPotrero, onOpenDrawer, onPotrerosCambiados }: {
  fincaId?: string; potreros: DbPotrero[]; animalesPorPotrero: Record<string, number>;
  onOpenDrawer: () => void; onPotrerosCambiados: () => void;
}) {
  const [analisis, setAnalisis] = useState<DbAnalisisSuelo[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [nuevoAnalisis, setNuevoAnalisis] = useState(false);
  const [nuevoPotrero, setNuevoPotrero] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ha, setHa] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!fincaId) return;
    try { const raw = localStorage.getItem(claveCache(fincaId)); if (raw) setAnalisis(JSON.parse(raw)); } catch { /* nada */ }
    if (sinSenal()) return;
    const data = await getAnalisisSuelo(fincaId);
    setAnalisis(data);
    try { localStorage.setItem(claveCache(fincaId), JSON.stringify(data)); } catch { /* nada */ }
  }, [fincaId]);
  useEffect(() => { const t = setTimeout(() => { cargar(); }, 0); return () => clearTimeout(t); }, [cargar]);

  const crear = async () => {
    if (!fincaId || !nombre.trim()) { setErr('Escribe el nombre del potrero.'); return; }
    if (sinSenal()) { setErr('Sin señal. Crea el potrero cuando tengas internet.'); return; }
    setGuardando(true); setErr(null);
    const { error } = await crearPotrero({ finca_id: fincaId, nombre: nombre.trim(), hectareas: num(ha) });
    setGuardando(false);
    if (error) { setErr(error); return; }
    setNombre(''); setHa(''); setNuevoPotrero(false);
    onPotrerosCambiados();
  };

  const sel = potreros.find(p => p.id === selId);
  const ultimo = (pid: string) => analisis.find(a => a.potrero_id === pid);

  if (sel) {
    const delPotrero = analisis.filter(a => a.potrero_id === sel.id);
    return (
      <div style={{ paddingBottom: 90 }}>
        <EncabezadoPantalla titulo={sel.nombre} onVolver={() => { setSelId(null); setNuevoAnalisis(false); }} />
        <div className="ag-list-grid" style={{ padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 17, color: C.suave, fontWeight: 600 }}>
            {sel.hectareas != null ? `${Number(sel.hectareas).toLocaleString('es-CO')} ha · ` : ''}{animalesPorPotrero[sel.id] ?? 0} animales · {sel.estado}
          </div>
          {nuevoAnalisis ? (
            <FormAnalisis potrero={sel} onCancelar={() => setNuevoAnalisis(false)} onGuardado={() => { setNuevoAnalisis(false); cargar(); }} />
          ) : (
            <button onClick={() => setNuevoAnalisis(true)} style={btnPrincipal()}>+ Agregar análisis de suelo</button>
          )}
          {delPotrero.length === 0 && !nuevoAnalisis && (
            <div style={{ ...card, fontSize: 17, color: C.suave, lineHeight: 1.4 }}>
              Este potrero no tiene análisis de suelo. Cuando te llegue el informe del laboratorio, copia aquí los valores para tener el historial del potrero.
            </div>
          )}
          {delPotrero.map(a => <TarjetaAnalisis key={a.id} a={a} onEliminado={cargar} />)}
          {delPotrero.length > 0 && (
            <div style={{ fontSize: 15, color: C.suave, lineHeight: 1.45 }}>
              Los colores son una guía general para pastos tropicales. La dosis de cal o abono la define tu agrónomo.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 90 }}>
      <EncabezadoPantalla titulo="Potreros" onOpenDrawer={onOpenDrawer} />
      <div className="ag-list-grid" style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {nuevoPotrero ? (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 19 }}>Nuevo potrero</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div><label style={lbl}>NOMBRE</label><input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. La Ceiba" /></div>
              <div><label style={lbl}>HECTÁREAS</label><input style={inp} inputMode="decimal" value={ha} onChange={e => setHa(e.target.value)} /></div>
            </div>
            {err && <div style={aviso('error')}>{err}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <button onClick={() => { setNuevoPotrero(false); setErr(null); }} style={btnSecundario}>Cancelar</button>
              <button onClick={crear} disabled={guardando} style={btnPrincipal(guardando)}>{guardando ? 'Guardando…' : 'Guardar potrero'}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setNuevoPotrero(true)} style={btnPrincipal()}>+ Agregar potrero</button>
        )}
        {potreros.length === 0 && (
          <div style={{ ...card, fontSize: 17, color: C.suave }}>Todavía no hay potreros. Agrega el primero.</div>
        )}
        {potreros.map(p => (
          <button key={p.id} onClick={() => setSelId(p.id)} style={{ ...card, textAlign: 'left', cursor: 'pointer', width: '100%', color: C.texto, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 20 }}>{p.nombre}</div>
              <div style={{ fontSize: 16, color: C.suave, fontWeight: 600, marginTop: 2 }}>
                {p.hectareas != null ? `${Number(p.hectareas).toLocaleString('es-CO')} ha · ` : ''}{animalesPorPotrero[p.id] ?? 0} animales
              </div>
              <ResumenSuelo a={ultimo(p.id)} />
            </div>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.texto} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
          </button>
        ))}
      </div>
    </div>
  );
}
