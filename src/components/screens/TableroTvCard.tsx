'use client';

// Ajustes → Tablero en el televisor.
// El dueño conecta televisores con el código que sale en la pantalla, o crea un enlace de solo lectura,
// y escoge para cada televisor qué paneles salen, en qué orden y cuánto dura cada uno.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PANELES, PanelId, ES_PANEL, PANELES_POR_DEFECTO, codigoBonito, normalizarCodigo } from '@/lib/tablero';

type Pantalla = {
  id: string; nombre: string; paneles: PanelId[]; segundos_panel: number; tema: 'oscuro' | 'claro';
  vinculada_en: string | null; ultima_conexion: string | null;
};

const card: React.CSSProperties = { background: '#fff', border: '1px solid #B9C6B4', borderRadius: 6, padding: 16 };
const inp: React.CSSProperties = {
  width: '100%', height: 48, border: '1px solid #8FA38A', borderRadius: 4, padding: '0 12px', fontSize: 18,
  background: '#fff', outline: 'none', fontFamily: 'inherit', color: '#0F1A0F', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 14, color: '#3A4D3A', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4, display: 'block' };
const btn = (fondo: string, color = '#fff'): React.CSSProperties => ({
  minHeight: 48, border: fondo === '#fff' ? '1px solid #8FA38A' : 'none', borderRadius: 4, background: fondo, color,
  fontWeight: 800, fontSize: 17, cursor: 'pointer', padding: '8px 14px', fontFamily: 'inherit', lineHeight: 1.25,
});
const aviso = (ok: boolean): React.CSSProperties => ({
  fontSize: 16, color: ok ? '#15803D' : '#B91C1C', background: ok ? '#DCFCE7' : '#FEE2E2', padding: '8px 10px', borderRadius: 4,
});

async function llamar(ruta: string, body: object): Promise<{ ok: boolean; json: Record<string, string> }> {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, json: await r.json().catch(() => ({})) };
}

function haceCuanto(iso: string | null): string {
  if (!iso) return 'Nunca se ha conectado';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60e3);
  if (min < 10) return 'Encendido ahora';
  if (min < 60) return `Visto hace ${min} min`;
  if (min < 48 * 60) return `Visto hace ${Math.round(min / 60)} h`;
  return `Visto hace ${Math.round(min / 1440)} días`;
}

export default function TableroTvCard({ fincaId, codigoInicial }: { fincaId: string; codigoInicial?: string | null }) {
  const [pantallas, setPantallas] = useState<Pantalla[]>([]);
  const [codigo, setCodigo] = useState(codigoInicial ? normalizarCodigo(codigoInicial) : '');
  const [nombre, setNombre] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const cargar = () => setVersion(v => v + 1);
  useEffect(() => {
    let vivo = true;
    supabase.from('pantallas_tv')
      .select('id, nombre, paneles, segundos_panel, tema, vinculada_en, ultima_conexion')
      .eq('finca_id', fincaId).order('created_at')
      .then(({ data }) => {
        if (!vivo) return;
        setPantallas((data ?? []).map(p => ({ ...p, paneles: Array.isArray(p.paneles) ? p.paneles.filter(ES_PANEL) : PANELES_POR_DEFECTO })) as Pantalla[]);
      });
    return () => { vivo = false; };
  }, [fincaId, version]);

  const vincular = async () => {
    const c = normalizarCodigo(codigo);
    if (c.length !== 6) { setMsg({ ok: false, texto: 'Escriba las 6 letras que salen en el televisor' }); return; }
    setOcupado(true); setMsg(null);
    const { ok, json } = await llamar('/api/tv/vincular', { codigo: c, finca_id: fincaId, nombre: nombre || 'Televisor' });
    setOcupado(false);
    if (!ok) { setMsg({ ok: false, texto: json.error ?? 'No se pudo conectar' }); return; }
    setMsg({ ok: true, texto: '¡Listo! En unos segundos el televisor muestra el tablero.' });
    setCodigo(''); setNombre(''); setAbierta(json.id ?? null);
    cargar();
  };

  const crearEnlace = async () => {
    setOcupado(true); setMsg(null);
    const { ok, json } = await llamar('/api/tv/enlace', { finca_id: fincaId, nombre: nombre || 'Enlace de solo lectura' });
    setOcupado(false);
    if (!ok) { setMsg({ ok: false, texto: json.error ?? 'No se pudo crear el enlace' }); return; }
    setEnlace(`${window.location.origin}/tv?t=${json.token}`);
    setNombre('');
    cargar();
  };

  const guardar = async (p: Pantalla, cambios: Partial<Pantalla>) => {
    const nueva = { ...p, ...cambios };
    setPantallas(ps => ps.map(x => (x.id === p.id ? nueva : x)));
    const { error } = await supabase.from('pantallas_tv').update({
      nombre: nueva.nombre, paneles: nueva.paneles, segundos_panel: nueva.segundos_panel, tema: nueva.tema,
    }).eq('id', p.id);
    if (error) { setMsg({ ok: false, texto: error.message }); cargar(); }
  };

  const desconectar = async (p: Pantalla) => {
    if (!window.confirm(`¿Desconectar "${p.nombre}"? Ese televisor dejará de mostrar los datos.`)) return;
    await supabase.from('pantallas_tv').delete().eq('id', p.id);
    cargar();
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 6 }}>Tablero en el televisor</div>
      <div style={{ fontSize: 16, color: '#3A4D3A', marginBottom: 14, lineHeight: 1.4 }}>
        Abra <b>{typeof window !== 'undefined' ? window.location.host : ''}/tv</b> en el navegador del televisor y escriba aquí el código que aparece.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label style={lbl}>CÓDIGO DEL TELEVISOR</label>
          <input style={{ ...inp, fontSize: 26, letterSpacing: 6, fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}
            value={codigo.length > 3 ? codigoBonito(codigo) : codigo} onChange={e => setCodigo(normalizarCodigo(e.target.value))}
            placeholder="ABC 123" autoCapitalize="characters" autoComplete="off" inputMode="text" />
        </div>
        <div><label style={lbl}>¿DÓNDE ESTÁ? (OPCIONAL)</label>
          <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Casa, oficina, manga…" maxLength={40} />
        </div>
        {msg && <div style={aviso(msg.ok)}>{msg.texto}</div>}
        <button onClick={vincular} disabled={ocupado} style={btn(ocupado ? '#3A4D3A' : '#15803D')}>
          {ocupado ? 'Conectando…' : 'Conectar televisor'}
        </button>
        <button onClick={crearEnlace} disabled={ocupado} style={btn('#fff', '#0F1A0F')}>
          Crear enlace para Chromecast o Fire TV
        </button>
        {enlace && (
          <div style={{ border: '2px dashed #8FA38A', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Abra este enlace en el televisor. Quien lo tenga puede ver el tablero, así que no lo publique.</div>
            <div style={{ fontSize: 14, wordBreak: 'break-all', color: '#3A4D3A' }}>{enlace}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button style={btn('#fff', '#0F1A0F')} onClick={() => { void navigator.clipboard?.writeText(enlace); setMsg({ ok: true, texto: 'Enlace copiado' }); }}>Copiar</button>
              <a style={{ ...btn('#15803D'), display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                href={`https://wa.me/?text=${encodeURIComponent(`Tablero de la finca para el televisor: ${enlace}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>
        )}
      </div>

      {pantallas.length > 0 && (
        <div style={{ marginTop: 18, borderTop: '1px solid #B9C6B4', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Televisores conectados</div>
          {pantallas.map(p => (
            <div key={p.id} style={{ border: '1px solid #B9C6B4', borderRadius: 6 }}>
              <button onClick={() => setAbierta(abierta === p.id ? null : p.id)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span>
                  <span style={{ display: 'block', fontSize: 17, fontWeight: 800, color: '#0F1A0F' }}>📺 {p.nombre}</span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#3A4D3A' }}>{haceCuanto(p.ultima_conexion)} · {p.paneles.length} paneles</span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#15803D' }}>{abierta === p.id ? 'Cerrar' : 'Personalizar'}</span>
              </button>
              {abierta === p.id && <EditorPantalla p={p} onCambio={c => guardar(p, c)} onDesconectar={() => desconectar(p)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditorPantalla({ p, onCambio, onDesconectar }: { p: Pantalla; onCambio: (c: Partial<Pantalla>) => void; onDesconectar: () => void }) {
  const [nombre, setNombre] = useState(p.nombre);
  // Primero los que están encendidos (en su orden), después los apagados.
  const orden: PanelId[] = [...p.paneles, ...PANELES.map(x => x.id).filter(id => !p.paneles.includes(id))];
  const mover = (id: PanelId, paso: -1 | 1) => {
    const lista = [...p.paneles]; const i = lista.indexOf(id); const j = i + paso;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    onCambio({ paneles: lista });
  };
  const alternar = (id: PanelId) =>
    onCambio({ paneles: p.paneles.includes(id) ? p.paneles.filter(x => x !== id) : [...p.paneles, id] });
  const flecha: React.CSSProperties = { width: 44, height: 44, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', fontSize: 20, fontWeight: 800, cursor: 'pointer', color: '#0F1A0F' };

  return (
    <div style={{ borderTop: '1px solid #B9C6B4', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label style={lbl}>NOMBRE</label>
        <input style={inp} value={nombre} maxLength={40} onChange={e => setNombre(e.target.value)} onBlur={() => nombre.trim() && nombre !== p.nombre && onCambio({ nombre: nombre.trim() })} />
      </div>

      <div>
        <label style={lbl}>PANELES (MARQUE LOS QUE QUIERE VER Y ORDÉNELOS)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {orden.map(id => {
            const info = PANELES.find(x => x.id === id)!;
            const on = p.paneles.includes(id);
            const i = p.paneles.indexOf(id);
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, background: on ? '#F0FDF4' : '#F4F6F3', border: `1px solid ${on ? '#86EFAC' : '#D5DDD2'}` }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44 }}>
                  <input type="checkbox" checked={on} onChange={() => alternar(id)} style={{ width: 26, height: 26, minHeight: 26, accentColor: '#15803D' }} />
                  <span>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: on ? '#0F1A0F' : '#4A5E4A' }}>{on ? `${i + 1}. ` : ''}{info.titulo}</span>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#4A5E4A' }}>{info.descripcion}</span>
                  </span>
                </label>
                {on && <>
                  <button aria-label="Subir" style={{ ...flecha, opacity: i === 0 ? .35 : 1 }} disabled={i === 0} onClick={() => mover(id, -1)}>↑</button>
                  <button aria-label="Bajar" style={{ ...flecha, opacity: i === p.paneles.length - 1 ? .35 : 1 }} disabled={i === p.paneles.length - 1} onClick={() => mover(id, 1)}>↓</button>
                </>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label style={lbl}>SEGUNDOS POR PANEL</label>
          <select style={inp} value={p.segundos_panel} onChange={e => onCambio({ segundos_panel: Number(e.target.value) })}>
            {[10, 15, 20, 30, 45, 60].map(s => <option key={s} value={s}>{s} segundos</option>)}
          </select>
        </div>
        <div><label style={lbl}>FONDO</label>
          <select style={inp} value={p.tema} onChange={e => onCambio({ tema: e.target.value as 'oscuro' | 'claro' })}>
            <option value="oscuro">Oscuro (recomendado)</option>
            <option value="claro">Claro</option>
          </select>
        </div>
      </div>
      <div style={{ fontSize: 14, color: '#3A4D3A', fontWeight: 600 }}>Los cambios llegan al televisor en máximo 5 minutos.</div>
      <button onClick={onDesconectar} style={btn('#fff', '#B91C1C')}>Desconectar este televisor</button>
    </div>
  );
}
