'use client';

import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import {
  actualizarFinca, actualizarPotrero, crearPotrero, getPuntosFinca, crearPuntoFinca, eliminarPuntoFinca,
  type DbFinca, type DbPotrero, type DbPuntoFinca, type TipoPunto,
} from '@/lib/supabase';
import { areaHa, perimetroM, leerFigura, haTxt, type LatLon } from '@/lib/geo';
import { C, inp, lbl, card, btnPrincipal, btnSecundario, aviso } from './estilosCampo';

// Imagen satelital de Esri (World Imagery). Con NEXT_PUBLIC_ESRI_API_KEY se usa el
// servicio con clave (ArcGIS Location Platform: plan gratis con uso comercial permitido).
const ESRI_KEY = process.env.NEXT_PUBLIC_ESRI_API_KEY;
const URL_SATELITE = ESRI_KEY
  ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${ESRI_KEY}`
  : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATRIBUCION = 'Imagen: Esri, Maxar, Earthstar Geographics';

export const PUNTOS: Record<TipoPunto, { emoji: string; nombre: string }> = {
  corral:   { emoji: '🐄', nombre: 'Corral' },
  bascula:  { emoji: '⚖️', nombre: 'Báscula' },
  casa:     { emoji: '🏠', nombre: 'Casa' },
  bebedero: { emoji: '💧', nombre: 'Bebedero' },
  otro:     { emoji: '📍', nombre: 'Otro' },
};

type Modo =
  | { tipo: 'ver' }
  | { tipo: 'dibujar'; objetivo: 'lindero' | 'nuevo' | string } // string = id de potrero
  | { tipo: 'punto'; clase: TipoPunto };

const sinSenal = () => typeof navigator !== 'undefined' && !navigator.onLine;
const claveCache = (fincaId: string) => `gad:puntos:${fincaId}`;
const escHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function leerGps(): Promise<{ p: LatLon; precision: number }> {
  return new Promise((ok, mal) => {
    if (!('geolocation' in navigator)) { mal(new Error('Este celular no permite leer la ubicación.')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => ok({ p: [pos.coords.latitude, pos.coords.longitude], precision: pos.coords.accuracy }),
      err => mal(new Error(err.code === 1 ? 'No diste permiso de ubicación.' : 'No se pudo leer el GPS. Intenta al aire libre.')),
      { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 },
    );
  });
}

export default function MapaFinca({ finca, potreros, esPropietario, onFincaCambiada, onPotrerosCambiados }: {
  finca: DbFinca; potreros: DbPotrero[]; esPropietario: boolean;
  onFincaCambiada: () => void; onPotrerosCambiados: () => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const capaFiguras = useRef<Leaflet.LayerGroup | null>(null);
  const capaDibujo = useRef<Leaflet.LayerGroup | null>(null);
  const capaYo = useRef<Leaflet.LayerGroup | null>(null);
  const encuadrado = useRef(false);

  const [listo, setListo] = useState(false);
  const [modo, setModo] = useState<Modo>({ tipo: 'ver' });
  const modoRef = useRef<Modo>(modo);
  const [pts, setPts] = useState<LatLon[]>([]);
  const [puntoNuevo, setPuntoNuevo] = useState<LatLon | null>(null);
  const [nombrePunto, setNombrePunto] = useState('');
  const [nombrePotrero, setNombrePotrero] = useState('');
  const [puntos, setPuntos] = useState<DbPuntoFinca[]>([]);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error' | 'info'; txt: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);

  useEffect(() => { modoRef.current = modo; }, [modo]);

  const lindero = useMemo(() => leerFigura(finca.lindero), [finca.lindero]);

  const cargarPuntos = useCallback(async () => {
    try { const raw = localStorage.getItem(claveCache(finca.id)); if (raw) setPuntos(JSON.parse(raw)); } catch { /* nada */ }
    if (sinSenal()) return;
    const data = await getPuntosFinca(finca.id);
    setPuntos(data);
    try { localStorage.setItem(claveCache(finca.id), JSON.stringify(data)); } catch { /* nada */ }
  }, [finca.id]);
  useEffect(() => { const t = setTimeout(() => { cargarPuntos(); }, 0); return () => clearTimeout(t); }, [cargarPuntos]);

  // Crear el mapa una vez (Leaflet solo funciona en el navegador).
  useEffect(() => {
    let vivo = true;
    import('leaflet').then(mod => {
      if (!vivo || !divRef.current || mapa.current) return;
      const Lf = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      L.current = Lf;
      const m = Lf.map(divRef.current, { zoomControl: true, attributionControl: true })
        .setView([Number(finca.latitud), Number(finca.longitud)], 16);
      Lf.tileLayer(URL_SATELITE, { maxNativeZoom: 18, maxZoom: 20, attribution: ATRIBUCION }).addTo(m);
      capaFiguras.current = Lf.layerGroup().addTo(m);
      capaDibujo.current = Lf.layerGroup().addTo(m);
      capaYo.current = Lf.layerGroup().addTo(m);
      m.on('click', (e: Leaflet.LeafletMouseEvent) => {
        const md = modoRef.current;
        const p: LatLon = [Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6];
        if (md.tipo === 'dibujar') setPts(prev => [...prev, p]);
        if (md.tipo === 'punto') setPuntoNuevo(p);
      });
      mapa.current = m;
      setListo(true);
    });
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dibujar lindero, potreros y puntos guardados.
  useEffect(() => {
    const Lf = L.current, m = mapa.current, capa = capaFiguras.current;
    if (!listo || !Lf || !m || !capa) return;
    capa.clearLayers();
    const todos: LatLon[] = [];
    if (lindero) {
      Lf.polygon(lindero, { color: '#FACC15', weight: 4, fillOpacity: 0.04, interactive: false }).addTo(capa);
      todos.push(...lindero);
    }
    potreros.forEach(p => {
      const fig = leerFigura(p.poligono);
      if (!fig) return;
      const pol = Lf.polygon(fig, { color: '#4ADE80', weight: 3, fillColor: '#22C55E', fillOpacity: 0.22 }).addTo(capa);
      pol.bindTooltip(`${escHtml(p.nombre)}<br>${haTxt(areaHa(fig))} ha`, { permanent: true, direction: 'center', className: 'ag-mapa-etiqueta' });
      todos.push(...fig);
    });
    puntos.forEach(pt => {
      const info = PUNTOS[pt.tipo] ?? PUNTOS.otro;
      Lf.marker([Number(pt.latitud), Number(pt.longitud)], {
        icon: Lf.divIcon({ className: '', html: `<div class="ag-mapa-punto">${info.emoji}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
        keyboard: false,
      }).bindTooltip(escHtml(pt.nombre || info.nombre), { direction: 'top', offset: [0, -20], className: 'ag-mapa-etiqueta' }).addTo(capa);
      todos.push([Number(pt.latitud), Number(pt.longitud)]);
    });
    if (!encuadrado.current && todos.length >= 2) {
      m.fitBounds(Lf.latLngBounds(todos), { padding: [24, 24], maxZoom: 18 });
      encuadrado.current = true;
    }
  }, [listo, lindero, potreros, puntos]);

  // Dibujo en curso.
  useEffect(() => {
    const Lf = L.current, capa = capaDibujo.current;
    if (!listo || !Lf || !capa) return;
    capa.clearLayers();
    if (modo.tipo === 'dibujar' && pts.length) {
      const color = modo.objetivo === 'lindero' ? '#FACC15' : '#FFFFFF';
      if (pts.length >= 3) Lf.polygon(pts, { color, weight: 3, dashArray: '8 6', fillOpacity: 0.15, interactive: false }).addTo(capa);
      else Lf.polyline(pts, { color, weight: 3, dashArray: '8 6', interactive: false }).addTo(capa);
      pts.forEach((p, i) => Lf.circleMarker(p, { radius: 8, color: '#0F1A0F', weight: 2, fillColor: i === 0 ? '#FACC15' : '#fff', fillOpacity: 1, interactive: false }).addTo(capa));
    }
    if (modo.tipo === 'punto' && puntoNuevo) {
      Lf.marker(puntoNuevo, { icon: Lf.divIcon({ className: '', html: `<div class="ag-mapa-punto" style="border-color:#FACC15">${PUNTOS[modo.clase].emoji}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] }), interactive: false }).addTo(capa);
    }
  }, [listo, modo, pts, puntoNuevo]);

  const salir = () => { setModo({ tipo: 'ver' }); setPts([]); setPuntoNuevo(null); setNombrePunto(''); setNombrePotrero(''); };

  const mostrarYo = (p: LatLon, precision: number) => {
    const Lf = L.current, capa = capaYo.current;
    if (!Lf || !capa) return;
    capa.clearLayers();
    Lf.circle(p, { radius: Math.min(precision, 200), color: '#3B82F6', weight: 1, fillOpacity: 0.15, interactive: false }).addTo(capa);
    Lf.circleMarker(p, { radius: 9, color: '#fff', weight: 3, fillColor: '#2563EB', fillOpacity: 1, interactive: false }).addTo(capa);
  };

  const dondeEstoy = async () => {
    setMsg({ tipo: 'info', txt: 'Buscando tu ubicación…' });
    try {
      const { p, precision } = await leerGps();
      mostrarYo(p, precision);
      mapa.current?.setView(p, Math.max(mapa.current.getZoom(), 17));
      setMsg(null);
      return { p, precision };
    } catch (e) { setMsg({ tipo: 'error', txt: (e as Error).message }); return null; }
  };

  const marcarGps = async () => {
    const r = await dondeEstoy();
    if (!r) return;
    if (modo.tipo === 'dibujar') setPts(prev => [...prev, [Math.round(r.p[0] * 1e6) / 1e6, Math.round(r.p[1] * 1e6) / 1e6]]);
    if (modo.tipo === 'punto') setPuntoNuevo(r.p);
    if (r.precision > 25) setMsg({ tipo: 'info', txt: `Punto marcado con precisión de ±${Math.round(r.precision)} m. Si puedes, espera un momento al aire libre.` });
  };

  const terminarFigura = async () => {
    if (modo.tipo !== 'dibujar' || pts.length < 3) return;
    if (sinSenal()) { setMsg({ tipo: 'error', txt: 'Sin señal. Guarda el dibujo cuando tengas internet (no cierres esta pantalla).' }); return; }
    const ha = Math.round(areaHa(pts) * 100) / 100;
    setOcupado(true); setMsg(null);
    let error: string | null = null;
    if (modo.objetivo === 'lindero') {
      ({ error } = await actualizarFinca(finca.id, { lindero: pts, hectareas: ha }));
      if (!error) onFincaCambiada();
    } else if (modo.objetivo === 'nuevo') {
      if (!nombrePotrero.trim()) { setOcupado(false); setMsg({ tipo: 'error', txt: 'Escribe el nombre del potrero.' }); return; }
      ({ error } = await crearPotrero({ finca_id: finca.id, nombre: nombrePotrero.trim(), hectareas: ha, poligono: pts }));
      if (!error) onPotrerosCambiados();
    } else {
      ({ error } = await actualizarPotrero(modo.objetivo, { poligono: pts, hectareas: ha }));
      if (!error) onPotrerosCambiados();
    }
    setOcupado(false);
    if (error) { setMsg({ tipo: 'error', txt: error }); return; }
    setMsg({ tipo: 'ok', txt: `Guardado: ${haTxt(ha)} ha` });
    salir();
  };

  const guardarPunto = async () => {
    if (modo.tipo !== 'punto' || !puntoNuevo) return;
    if (sinSenal()) { setMsg({ tipo: 'error', txt: 'Sin señal. Guarda el punto cuando tengas internet.' }); return; }
    setOcupado(true);
    const { error } = await crearPuntoFinca({ finca_id: finca.id, tipo: modo.clase, nombre: nombrePunto.trim() || null, latitud: puntoNuevo[0], longitud: puntoNuevo[1] });
    setOcupado(false);
    if (error) { setMsg({ tipo: 'error', txt: error }); return; }
    setMsg({ tipo: 'ok', txt: `${PUNTOS[modo.clase].nombre} guardado` });
    salir(); cargarPuntos();
  };

  const borrarPunto = async (id: string) => {
    if (confirmarBorrar !== id) { setConfirmarBorrar(id); return; }
    const { error } = await eliminarPuntoFinca(id);
    setConfirmarBorrar(null);
    if (error) { setMsg({ tipo: 'error', txt: error }); return; }
    cargarPuntos();
  };

  const irA = (fig: LatLon[] | null, p?: LatLon) => {
    const Lf = L.current, m = mapa.current;
    if (!Lf || !m) return;
    if (fig) m.fitBounds(Lf.latLngBounds(fig), { padding: [24, 24], maxZoom: 18 });
    else if (p) m.setView(p, 18);
    divRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const empezarDibujo = (objetivo: string) => { setMsg(null); setPts([]); setModo({ tipo: 'dibujar', objetivo }); divRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const nombreObjetivo = modo.tipo === 'dibujar'
    ? modo.objetivo === 'lindero' ? 'el lindero de la finca' : modo.objetivo === 'nuevo' ? 'el potrero nuevo' : `el potrero ${potreros.find(p => p.id === modo.objetivo)?.nombre ?? ''}`
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: `2px solid ${C.texto}` }}>
        <div ref={divRef} className="ag-mapa" style={{ height: '58vh', minHeight: 320, width: '100%' }} />
        <button onClick={dondeEstoy} aria-label="Dónde estoy" style={{ position: 'absolute', right: 10, bottom: 28, zIndex: 500, width: 52, height: 52, borderRadius: '50%', border: `2px solid ${C.texto}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.4)', cursor: 'pointer' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        </button>
        {sinSenal() && (
          <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 500, ...aviso('info') }}>Sin señal: se ven tus dibujos, sin la foto satelital</div>
        )}
      </div>

      {msg && <div style={aviso(msg.tipo)}>{msg.txt}</div>}

      {/* Barra de acciones según el modo */}
      {modo.tipo === 'dibujar' ? (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10, borderColor: C.texto, borderWidth: 2 }}>
          <div style={{ fontWeight: 800, fontSize: 19 }}>Dibujando {nombreObjetivo}</div>
          <div style={{ fontSize: 16, color: C.suave, lineHeight: 1.4 }}>
            Toca las esquinas en el mapa, en orden. O camina el lindero y toca <b>Marcar mi punto</b> en cada esquina.
          </div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {pts.length} {pts.length === 1 ? 'punto' : 'puntos'}
            {pts.length >= 3 && <span style={{ color: C.verde }}> · {haTxt(areaHa(pts))} ha · {Math.round(perimetroM(pts)).toLocaleString('es-CO')} m de cerca</span>}
          </div>
          {modo.objetivo === 'nuevo' && (
            <div><label style={lbl}>NOMBRE DEL POTRERO</label><input style={inp} value={nombrePotrero} onChange={e => setNombrePotrero(e.target.value)} placeholder="Ej. La Ceiba" /></div>
          )}
          <button onClick={marcarGps} style={{ ...btnSecundario, height: 52 }}>📍 Marcar mi punto (GPS)</button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={() => setPts(p => p.slice(0, -1))} disabled={!pts.length} style={btnSecundario}>Deshacer</button>
            <button onClick={salir} style={btnSecundario}>Cancelar</button>
          </div>
          <button onClick={terminarFigura} disabled={pts.length < 3 || ocupado} style={{ ...btnPrincipal(ocupado), opacity: pts.length < 3 ? 0.5 : 1 }}>
            {ocupado ? 'Guardando…' : pts.length < 3 ? 'Marca al menos 3 puntos' : 'Terminar y guardar'}
          </button>
        </div>
      ) : modo.tipo === 'punto' ? (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10, borderColor: C.texto, borderWidth: 2 }}>
          <div style={{ fontWeight: 800, fontSize: 19 }}>Ubicar {PUNTOS[modo.clase].nombre.toLowerCase()}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(PUNTOS) as TipoPunto[]).map(t => (
              <button key={t} onClick={() => setModo({ tipo: 'punto', clase: t })} style={{ ...btnSecundario, height: 44, padding: '0 10px', fontSize: 16, background: modo.clase === t ? C.verdeSuave : '#fff', borderColor: modo.clase === t ? C.verde : C.bordeFuerte }}>
                {PUNTOS[t].emoji} {PUNTOS[t].nombre}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 16, color: C.suave }}>{puntoNuevo ? 'Listo. Puedes tocar otro lugar para moverlo.' : 'Toca el mapa donde está, o párate ahí y usa tu ubicación.'}</div>
          <button onClick={marcarGps} style={{ ...btnSecundario, height: 52 }}>📍 Estoy aquí (GPS)</button>
          <div><label style={lbl}>NOMBRE (OPCIONAL)</label><input style={inp} value={nombrePunto} onChange={e => setNombrePunto(e.target.value)} placeholder={modo.clase === 'bascula' ? 'Ej. Báscula del corral' : ''} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <button onClick={salir} style={btnSecundario}>Cancelar</button>
            <button onClick={guardarPunto} disabled={!puntoNuevo || ocupado} style={{ ...btnPrincipal(ocupado), opacity: puntoNuevo ? 1 : 0.5 }}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={() => empezarDibujo('nuevo')} style={{ ...btnPrincipal(), fontSize: 17 }}>+ Dibujar potrero</button>
            <button onClick={() => { setMsg(null); setModo({ tipo: 'punto', clase: 'corral' }); }} style={{ ...btnPrincipal(), fontSize: 17, background: C.texto }}>+ Corral, báscula…</button>
          </div>
          {esPropietario && (
            <button onClick={() => empezarDibujo('lindero')} style={btnSecundario}>
              {lindero ? `Redibujar lindero de la finca (${haTxt(areaHa(lindero))} ha)` : 'Dibujar lindero de la finca'}
            </button>
          )}

          {potreros.length > 0 && (
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 6 }}>Potreros en el mapa</div>
              {potreros.map((p, i) => {
                const fig = leerFigura(p.poligono);
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderTop: i ? `1px solid ${C.fondo}` : 'none' }}>
                    <button onClick={() => fig && irA(fig)} disabled={!fig} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: fig ? 'pointer' : 'default', color: C.texto }}>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{p.nombre}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: fig ? C.verde : C.suave }}>{fig ? `${haTxt(areaHa(fig))} ha en el mapa` : 'Sin dibujar'}</div>
                    </button>
                    <button onClick={() => empezarDibujo(p.id)} style={{ ...btnSecundario, height: 44, fontSize: 16 }}>{fig ? 'Redibujar' : 'Dibujar'}</button>
                  </div>
                );
              })}
            </div>
          )}

          {puntos.length > 0 && (
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 6 }}>Corrales y puntos</div>
              {puntos.map((pt, i) => (
                <div key={pt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderTop: i ? `1px solid ${C.fondo}` : 'none' }}>
                  <button onClick={() => irA(null, [Number(pt.latitud), Number(pt.longitud)])} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.texto, fontSize: 18, fontWeight: 700 }}>
                    {PUNTOS[pt.tipo]?.emoji} {pt.nombre || PUNTOS[pt.tipo]?.nombre}
                  </button>
                  <button onClick={() => borrarPunto(pt.id)} onBlur={() => setConfirmarBorrar(null)} style={{ ...btnSecundario, height: 44, fontSize: 16, color: C.rojo, background: confirmarBorrar === pt.id ? C.rojoSuave : '#fff' }}>
                    {confirmarBorrar === pt.id ? '¿Borrar?' : 'Borrar'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {!lindero && !potreros.some(p => leerFigura(p.poligono)) && !puntos.length && (
            <div style={{ fontSize: 16, color: C.suave, lineHeight: 1.45 }}>
              Empieza dibujando el lindero o un potrero. Si la foto satelital no deja ver bien la cerca, camina por el borde con el celular y marca cada esquina.
            </div>
          )}
        </>
      )}
    </div>
  );
}
