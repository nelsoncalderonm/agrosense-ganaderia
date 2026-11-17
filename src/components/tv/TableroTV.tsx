'use client';

// Tablero para el televisor de la finca. Pantalla completa, sin teclado ni contraseñas:
// el televisor muestra un código, el dueño lo escribe en el celular y listo.
// Todas las medidas van en rem y 1rem = 1/100 del ancho de una pantalla 16:9,
// así se ve igual en un televisor de 32" o de 65" y en navegadores viejos de Smart TV.

import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import {
  ConfigPantalla, DatosTablero, GDP_BAJA, PANELES, PanelId, codigoBonito, gramosDia, n0, plataCorta,
} from '@/lib/tablero';

const CLAVE_TOKEN = 'gad_tv_token';
const CLAVE_CACHE = 'gad_tv_cache';
const CADA_DATOS_MS = 5 * 60e3;   // datos nuevos cada 5 minutos
const CADA_CODIGO_MS = 4e3;       // mientras espera el código, pregunta cada 4 s

type Tema = { fondo: string; tarjeta: string; borde: string; texto: string; sec: string; verde: string; ambar: string; rojo: string; azul: string; barra: string; suave: string };
const TEMAS: Record<'oscuro' | 'claro', Tema> = {
  oscuro: { fondo: '#0B140B', tarjeta: '#132213', borde: '#2E4A2E', texto: '#FFFFFF', sec: '#C9D6C6', verde: '#4ADE80', ambar: '#FBBF24', rojo: '#F87171', azul: '#93C5FD', barra: '#22C55E', suave: '#1C301C' },
  claro:  { fondo: '#EEF2EC', tarjeta: '#FFFFFF', borde: '#B9C6B4', texto: '#0F1A0F', sec: '#3A4D3A', verde: '#15803D', ambar: '#B45309', rojo: '#B91C1C', azul: '#1D4ED8', barra: '#15803D', suave: '#DCE5D8' },
};

type Respuesta =
  | { estado: 'pendiente'; codigo: string; expira: string }
  | { estado: 'ok'; config: ConfigPantalla; datos: DatosTablero };

function tokenInicial(): string | null {
  const t = new URL(window.location.href).searchParams.get('t');
  if (t) { guardar(CLAVE_TOKEN, t); guardar(CLAVE_CACHE, null); return t; }
  return leer(CLAVE_TOKEN);
}
function cacheInicial(): { r: Respuesta; t: number } | null {
  try { const c = leer(CLAVE_CACHE); return c ? JSON.parse(c) as { r: Respuesta; t: number } : null; } catch { return null; }
}

const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export default function TableroTV() {
  const [token, setToken] = useState<string | null>(tokenInicial);
  const [resp, setResp] = useState<Respuesta | null>(() => cacheInicial()?.r ?? null);
  const [sinInternet, setSinInternet] = useState(false);
  const [ultimaOk, setUltimaOk] = useState<number | null>(() => cacheInicial()?.t ?? null);
  const [indice, setIndice] = useState(0);
  const [ahora, setAhora] = useState(() => new Date());
  const [cursor, setCursor] = useState(true);

  // 1rem = ancho útil / 100 (manteniendo 16:9).
  useEffect(() => {
    const html = document.documentElement;
    const antes = html.style.fontSize;
    const ajustar = () => { html.style.fontSize = `${Math.min(window.innerWidth / 100, window.innerHeight / 56.25)}px`; };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => { window.removeEventListener('resize', ajustar); html.style.fontSize = antes; };
  }, []);

  // El token del enlace ya quedó guardado: se quita de la barra de direcciones.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('t')) return;
    url.searchParams.delete('t');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, []);

  // Un solo ciclo: sin token pide uno (y su código); con token pide los datos.
  // Esperando el código pregunta cada 4 s; con datos, cada 5 min; sin internet reintenta cada 15 s.
  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let espera = CADA_DATOS_MS;
      try {
        if (!token) {
          const r = await fetch('/api/tv/pantalla', { method: 'POST' });
          if (!r.ok) throw new Error(String(r.status));
          const j = await r.json() as { token: string; codigo: string; expira: string };
          guardar(CLAVE_TOKEN, j.token);
          guardar(CLAVE_CACHE, null);
          if (!vivo) return;
          setResp({ estado: 'pendiente', codigo: j.codigo, expira: j.expira });
          setSinInternet(false);
          setToken(j.token); // reinicia este ciclo con el token nuevo
          return;
        }
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const r = await fetch(`/api/tv/datos?tz=${encodeURIComponent(tz)}`, { headers: { 'x-tv-token': token }, cache: 'no-store' });
        if (r.status === 401) {
          // Lo desconectaron desde el celular: vuelve a mostrar un código.
          guardar(CLAVE_TOKEN, null); guardar(CLAVE_CACHE, null);
          if (vivo) { setResp(null); setToken(null); }
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json() as Respuesta;
        if (!vivo) return;
        setResp(j);
        setSinInternet(false);
        if (j.estado === 'ok') {
          const t = Date.now();
          setUltimaOk(t);
          guardar(CLAVE_CACHE, JSON.stringify({ r: j, t }));
        } else espera = CADA_CODIGO_MS;
      } catch {
        if (vivo) setSinInternet(true);
        espera = 15e3;
      }
      if (vivo) timer = setTimeout(tick, espera);
    };
    timer = setTimeout(tick, 0);
    return () => { vivo = false; clearTimeout(timer); };
  }, [token]);

  // Reloj
  useEffect(() => { const id = setInterval(() => setAhora(new Date()), 15e3); return () => clearInterval(id); }, []);

  // Pantalla siempre encendida (donde el navegador lo permite).
  useEffect(() => {
    type WL = { release: () => Promise<void> };
    let lock: WL | null = null;
    const pedir = async () => {
      try { lock = await (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WL> } }).wakeLock?.request('screen') ?? null; } catch { /* no soportado */ }
    };
    void pedir();
    const vis = () => { if (document.visibilityState === 'visible') void pedir(); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); void lock?.release().catch(() => {}); };
  }, []);

  // Esconder el puntero del mouse cuando no se mueve.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const mover = () => { setCursor(true); clearTimeout(t); t = setTimeout(() => setCursor(false), 3000); };
    mover();
    window.addEventListener('mousemove', mover);
    return () => { window.removeEventListener('mousemove', mover); clearTimeout(t); };
  }, []);

  const config = resp?.estado === 'ok' ? resp.config : null;
  const datos = resp?.estado === 'ok' ? resp.datos : null;
  const paneles = useMemo<PanelId[]>(() => config?.paneles ?? [], [config]);
  const segundos = config?.segundos_panel ?? 15;
  const actual = paneles.length ? paneles[indice % paneles.length] : null;

  // Rotación de paneles
  useEffect(() => {
    if (paneles.length < 2) return;
    const id = setTimeout(() => setIndice(i => (i + 1) % paneles.length), segundos * 1000);
    return () => clearTimeout(id);
  }, [indice, paneles.length, segundos]);

  // Control remoto: ← → cambian de panel, OK pone pantalla completa.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndice(i => (i + 1) % Math.max(1, paneles.length));
      else if (e.key === 'ArrowLeft') setIndice(i => (i - 1 + Math.max(1, paneles.length)) % Math.max(1, paneles.length));
      else if (e.key === 'Enter') void document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [paneles.length]);

  const T = TEMAS[config?.tema ?? 'oscuro'];

  const raiz: React.CSSProperties = {
    position: 'fixed', inset: 0, background: T.fondo, color: T.texto, overflow: 'hidden',
    fontFamily: 'var(--font-montserrat), system-ui, sans-serif', fontVariantNumeric: 'tabular-nums',
    cursor: cursor ? 'default' : 'none', display: 'flex', flexDirection: 'column',
  };

  if (!resp) {
    return (
      <div style={{ ...raiz, alignItems: 'center', justifyContent: 'center' }}>
        <Marca T={T} grande />
        <div style={{ fontSize: '2rem', color: T.sec, marginTop: '2rem', fontWeight: 600 }}>
          {sinInternet ? 'Sin internet. Reintentando…' : 'Cargando…'}
        </div>
      </div>
    );
  }

  if (resp.estado === 'pendiente') return <PantallaCodigo T={T} codigo={resp.codigo} expira={resp.expira} raiz={raiz} sinInternet={sinInternet} ahora={ahora} />;

  const d = datos!;
  const minutos = ultimaOk ? Math.max(0, Math.round((ahora.getTime() - ultimaOk) / 60e3)) : null;
  const info = PANELES.find(p => p.id === actual);

  return (
    <div style={raiz}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.6rem 3rem 0', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem', minWidth: 0 }}>
          <Marca T={T} />
          <div style={{ width: 2, alignSelf: 'stretch', background: T.borde }} />
          <div style={{ fontSize: '2.4rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.finca.nombre}</div>
        </div>
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: '3.4rem', fontWeight: 800, lineHeight: 1 }}>
            {ahora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: '1.6rem', color: T.sec, fontWeight: 600, marginTop: '.3rem' }}>
            {primeraMayuscula(ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }))}
          </div>
        </div>
      </div>

      {/* Título del panel */}
      <div style={{ padding: '1.2rem 3rem 0' }}>
        <div style={{ fontSize: '3.6rem', fontWeight: 800, lineHeight: 1.1 }}>{info?.titulo ?? 'Sin paneles'}</div>
      </div>

      {/* Panel */}
      <div key={actual ?? 'nada'} style={{ flex: 1, padding: '1.6rem 3rem', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'tvEntra .6s ease-out' }}>
        {actual ? <Panel id={actual} d={d} T={T} /> : (
          <div style={{ fontSize: '2.4rem', color: T.sec }}>Escoja los paneles desde el celular: Ajustes → Tablero en el televisor.</div>
        )}
      </div>

      {/* Pie: avance y estado */}
      <div style={{ padding: '0 3rem 1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
        <div style={{ display: 'flex', gap: '.8rem', alignItems: 'center' }}>
          {paneles.map((p, i) => (
            <div key={p} style={{ width: i === indice % paneles.length ? '3.2rem' : '1.1rem', height: '1.1rem', borderRadius: '.6rem', background: i === indice % paneles.length ? T.verde : T.borde, transition: 'width .3s' }} />
          ))}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: sinInternet ? T.ambar : T.sec }}>
          {sinInternet
            ? `⚠ Sin internet · datos de hace ${minutos ?? '?'} min`
            : `Actualizado ${minutos != null && minutos > 0 ? `hace ${minutos} min` : 'ahora'}`}
        </div>
      </div>
      {paneles.length > 1 && (
        <div style={{ height: '.5rem', background: T.suave }}>
          <div key={`${indice}-${segundos}`} style={{ height: '100%', background: T.verde, animation: `tvAvance ${segundos}s linear forwards` }} />
        </div>
      )}
      <style>{`
        @keyframes tvAvance { from { width: 0 } to { width: 100% } }
        @keyframes tvEntra { from { opacity: 0; transform: translateY(1rem) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}

// ---------- Piezas ----------

function Marca({ T, grande }: { T: Tema; grande?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: grande ? '1.4rem' : '.8rem' }}>
      <div style={{ width: grande ? '6rem' : '3.6rem', height: grande ? '6rem' : '3.6rem', borderRadius: '1rem', background: T.barra, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: grande ? '3rem' : '1.8rem' }}>G</div>
      <div style={{ fontSize: grande ? '3.4rem' : '1.9rem', fontWeight: 800, color: T.verde, whiteSpace: 'nowrap' }}>Ganado al Día</div>
    </div>
  );
}

function Tarjeta({ T, children, style }: { T: Tema; children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: T.tarjeta, border: `2px solid ${T.borde}`, borderRadius: '1.4rem', padding: '2rem 2.4rem', minWidth: 0, minHeight: 0, overflow: 'hidden', ...style }}>{children}</div>;
}

function Cifra({ T, etiqueta, valor, unidad, nota, color }: { T: Tema; etiqueta: string; valor: string; unidad?: string; nota?: string; color?: string }) {
  return (
    <Tarjeta T={T} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, color: T.sec }}>{etiqueta}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '1rem', lineHeight: 1.05 }}>
        <span style={{ fontSize: valor.length > 7 ? '5.6rem' : '7rem', fontWeight: 800, color: color ?? T.texto, whiteSpace: 'nowrap' }}>{valor}</span>
        {unidad && <span style={{ fontSize: '2.8rem', fontWeight: 800, color: T.sec }}>{unidad}</span>}
      </div>
      {nota && <div style={{ fontSize: '1.9rem', fontWeight: 600, color: T.sec, marginTop: '.6rem' }}>{nota}</div>}
    </Tarjeta>
  );
}

function FilaAnimal({ T, a, derecha, color }: { T: Tema; a: { arete: string; nombre: string | null; potrero: string | null }; derecha: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1.6rem', padding: '.7rem 0', borderBottom: `2px solid ${T.suave}` }}>
      <div style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span style={{ fontSize: '2.2rem', fontWeight: 800 }}>{a.arete}</span>
        {a.nombre && <span style={{ fontSize: '2rem', fontWeight: 600, color: T.sec }}> · {a.nombre}</span>}
        {a.potrero && <span style={{ fontSize: '1.8rem', fontWeight: 600, color: T.sec }}> · {a.potrero}</span>}
      </div>
      <div style={{ fontSize: '2.3rem', fontWeight: 800, color: color ?? T.texto, whiteSpace: 'nowrap' }}>{derecha}</div>
    </div>
  );
}

function Vacio({ T, icono, texto, color }: { T: Tema; icono: string; texto: string; color?: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.6rem', textAlign: 'center' }}>
      <div style={{ fontSize: '9rem', lineHeight: 1 }}>{icono}</div>
      <div style={{ fontSize: '3.2rem', fontWeight: 800, color: color ?? T.texto, maxWidth: '70rem' }}>{texto}</div>
    </div>
  );
}

const grid = (cols: string): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: cols, gridTemplateRows: 'minmax(0, 1fr)', gap: '2rem', flex: 1, minHeight: 0 });

function Panel({ id, d, T }: { id: PanelId; d: DatosTablero; T: Tema }) {
  switch (id) {
    case 'resumen': {
      const r = d.resumen;
      return (
        <div style={grid('1fr 1fr 1fr')}>
          <Cifra T={T} etiqueta="Animales en la finca" valor={n0(r.animales)}
            nota={r.por_categoria.slice(0, 3).map(c => `${c.n} ${c.categoria.toLowerCase()}`).join(' · ') || undefined} />
          <Cifra T={T} etiqueta="Kilos en pie" valor={n0(r.kg_totales)} unidad="kg"
            nota={r.peso_promedio != null ? `Promedio ${n0(r.peso_promedio)} kg por animal` : undefined} />
          <Cifra T={T} etiqueta="Valor del ganado hoy" valor={r.valor != null ? plataCorta(r.valor).replace(' millones', '') : '—'}
            unidad={r.valor != null && Math.abs(r.valor) >= 1e6 ? 'millones' : undefined} color={T.verde}
            nota={r.precio_kg ? `A $ ${n0(r.precio_kg)} el kilo en pie` : 'Ponga el precio del kilo en Ajustes'} />
        </div>
      );
    }
    case 'engorde': {
      const e = d.engorde;
      const cambio = e.gdp_4sem != null && e.gdp_4sem_anterior ? (e.gdp_4sem - e.gdp_4sem_anterior) / Math.abs(e.gdp_4sem_anterior) : null;
      const color = e.gdp_promedio == null ? T.texto : e.gdp_promedio < GDP_BAJA ? T.rojo : T.verde;
      return (
        <div style={grid('34rem 1fr')}>
          <Cifra T={T} etiqueta="Ganancia diaria promedio" valor={e.gdp_promedio != null ? n0(e.gdp_promedio * 1000) : '—'} unidad="g/día" color={color}
            nota={cambio == null ? `${e.animales_con_gdp} animales con dos pesajes o más`
              : Math.abs(cambio) < 0.02 ? 'Igual que el mes pasado'
              : `${cambio > 0 ? '▲ Mejoró' : '▼ Bajó'} ${Math.abs(Math.round(cambio * 100))}% frente al mes pasado`} />
          <Tarjeta T={T} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '1.9rem', fontWeight: 700, color: T.sec, marginBottom: '1rem' }}>GDP de los pesajes, últimas 8 semanas</div>
            <BarrasSemanas T={T} semanas={e.semanas} />
          </Tarjeta>
        </div>
      );
    }
    case 'listos': {
      const l = d.listos;
      const pct = l.con_peso ? Math.round((l.listos / l.con_peso) * 100) : 0;
      return (
        <div style={grid('1fr 1fr')}>
          <Tarjeta T={T} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.4rem' }}>
            <div style={{ fontSize: '1.9rem', fontWeight: 700, color: T.sec }}>Meta de peso: {n0(l.meta)} kg</div>
            <div style={{ fontSize: '9rem', fontWeight: 800, lineHeight: 1, color: l.listos ? T.verde : T.texto }}>
              {l.listos}<span style={{ fontSize: '3rem', color: T.sec, marginLeft: '1rem' }}>de {l.con_peso} listos</span>
            </div>
            <div style={{ height: '2.4rem', background: T.suave, borderRadius: '1.2rem', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: T.barra, borderRadius: '1.2rem' }} />
            </div>
            <div style={{ fontSize: '2.2rem', fontWeight: 700 }}>
              {n0(l.kg_listos)} kg{l.valor_listos != null ? ` · ${plataCorta(l.valor_listos)}` : ''}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 600, color: T.sec }}>
              {l.cerca} cerca de la meta (les faltan 30 kg o menos)
              {l.en_retiro > 0 && <span style={{ color: T.ambar }}> · {l.en_retiro} en retiro de droga</span>}
            </div>
          </Tarjeta>
          <Tarjeta T={T}>
            <div style={{ fontSize: '1.9rem', fontWeight: 700, color: T.sec, marginBottom: '.4rem' }}>Los más pesados</div>
            {l.mas_pesados.length
              ? l.mas_pesados.slice(0, 5).map(a => <FilaAnimal key={a.arete} T={T} a={a} derecha={`${n0(a.peso)} kg`} />)
              : <div style={{ fontSize: '2.2rem', fontWeight: 600, color: T.sec, marginTop: '1rem' }}>Todavía ninguno llega a la meta.</div>}
          </Tarjeta>
        </div>
      );
    }
    case 'no_engordan': {
      const n = d.no_engordan;
      if (!n.total) return <Vacio T={T} icono="✅" texto="Todos los animales pesados están engordando bien" color={T.verde} />;
      return (
        <div style={grid('34rem 1fr')}>
          <Cifra T={T} etiqueta="Ganan menos de 400 g/día" valor={String(n.total)} unidad="animales" color={T.rojo}
            nota={`${n.bajando ? `${n.bajando} están bajando de peso. ` : ''}Revíselos: parásitos, cojera o potrero.`} />
          <Tarjeta T={T}>
            {n.animales.slice(0, 6).map(a => (
              <FilaAnimal key={a.arete} T={T} a={a}
                derecha={a.gdp != null && a.gdp < 0 ? `▼ bajó ${n0(-a.gdp * 1000)} g/día` : gramosDia(a.gdp)}
                color={a.gdp != null && a.gdp < 0 ? T.rojo : T.ambar} />
            ))}
          </Tarjeta>
        </div>
      );
    }
    case 'ventas': {
      const v = d.ventas;
      return (
        <div style={grid('1fr 1fr 1fr')}>
          <Cifra T={T} etiqueta={`Vendidos (últimos ${v.dias} días)`} valor={String(v.ventas)} unidad="animales"
            nota={v.ventas ? `${n0(v.kg_vendidos)} kg en pie` : 'Sin ventas este mes'} />
          <Cifra T={T} etiqueta="Plata de las ventas" valor={v.total_ventas ? plataCorta(v.total_ventas).replace(' millones', '') : '—'}
            unidad={v.total_ventas >= 1e6 ? 'millones' : undefined} color={v.total_ventas ? T.verde : undefined} />
          <Tarjeta T={T} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '1.9rem', fontWeight: 700, color: T.sec }}>Bajas (muertes y pérdidas)</div>
            <div style={{ fontSize: '7rem', fontWeight: 800, lineHeight: 1.05, color: v.bajas ? T.rojo : T.verde }}>{v.bajas}</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 600, color: T.sec, marginTop: '.6rem' }}>
              {v.bajas ? v.causas.map(c => `${c.causa} (${c.n})`).join(' · ') : 'Ninguna baja este mes'}
            </div>
          </Tarjeta>
        </div>
      );
    }
    case 'clima': {
      const c = d.clima;
      if (!c) return <Vacio T={T} icono="🌤️" texto="Marque la ubicación de la finca en el mapa para ver el clima" />;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
            <Cifra T={T} etiqueta="Temperatura ahora" valor={c.temp_ahora != null ? `${Math.round(c.temp_ahora)}°` : '—'}
              nota={c.humedad != null ? `Humedad ${Math.round(c.humedad)}%` : undefined} />
            <Cifra T={T} etiqueta="Lluvia hoy" valor={c.dias[0]?.lluvia_mm != null ? n0(c.dias[0].lluvia_mm) : '—'} unidad="mm" color={T.azul}
              nota={c.dias[0]?.prob != null ? `Probabilidad ${c.dias[0].prob}%` : undefined} />
            <Cifra T={T} etiqueta="Lluvia próximos 7 días" valor={n0(c.lluvia_7)} unidad="mm" color={T.azul} nota="Estimado para la zona" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${c.dias.length}, 1fr)`, gap: '1.2rem', flex: 1 }}>
            {c.dias.map((x, i) => (
              <Tarjeta key={x.fecha} T={T} style={{ padding: '1.2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '.4rem' }}>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, textTransform: 'capitalize' }}>
                  {i === 0 ? 'Hoy' : new Date(`${x.fecha}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}
                </div>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, color: T.azul }}>{x.lluvia_mm != null ? `${n0(x.lluvia_mm)}` : '—'}<span style={{ fontSize: '1.5rem' }}> mm</span></div>
                <div style={{ fontSize: '1.6rem', fontWeight: 600, color: T.sec }}>{x.max != null ? `${Math.round(x.max)}°` : ''} / {x.min != null ? `${Math.round(x.min)}°` : ''}</div>
              </Tarjeta>
            ))}
          </div>
        </div>
      );
    }
    case 'tareas': {
      const t = d.tareas;
      if (!t.lista.length) return <Vacio T={T} icono="✅" texto="No hay tareas pendientes esta semana" color={T.verde} />;
      const color = { vencida: T.rojo, hoy: T.ambar, semana: T.texto };
      return (
        <div style={grid('34rem 1fr')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <Cifra T={T} etiqueta="Vencidas sin hacer" valor={String(t.vencidas)} color={t.vencidas ? T.rojo : T.verde} />
            <Cifra T={T} etiqueta="Para hoy · esta semana" valor={`${t.hoy} · ${t.semana}`} />
          </div>
          <Tarjeta T={T}>
            {t.lista.slice(0, 6).map((x, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.6rem', padding: '.9rem 0', borderBottom: `2px solid ${T.suave}`, alignItems: 'baseline' }}>
                <div style={{ fontSize: '2.3rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.titulo}</div>
                <div style={{ fontSize: '2.1rem', fontWeight: 800, color: color[x.cuando], whiteSpace: 'nowrap' }}>
                  {x.cuando === 'vencida' ? `Vencida ${fechaCorta(x.fecha)}` : x.cuando === 'hoy' ? 'Hoy' : fechaCorta(x.fecha)}
                </div>
              </div>
            ))}
          </Tarjeta>
        </div>
      );
    }
  }
}

const primeraMayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fechaCorta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');

// Barras de una sola serie: GDP promedio de los pesajes de cada semana.
function BarrasSemanas({ T, semanas }: { T: Tema; semanas: DatosTablero['engorde']['semanas'] }) {
  const max = Math.max(1, ...semanas.map(s => s.gdp ?? 0));
  const tope = Math.ceil(max * 4) / 4; // múltiplos de 250 g
  const conDatos = semanas.some(s => s.gdp != null);
  if (!conDatos) return <div style={{ fontSize: '2.2rem', fontWeight: 600, color: T.sec }}>No hay pesajes en las últimas 8 semanas.</div>;
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: '1.4rem', minHeight: 0, borderBottom: `2px solid ${T.borde}` }}>
      {semanas.map((s, i) => {
        const ultima = i === semanas.length - 1;
        const alto = s.gdp != null && s.gdp > 0 ? (s.gdp / tope) * 100 : 0;
        return (
          <div key={s.desde} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '.6rem' }}>
            <div style={{ fontSize: ultima ? '2.2rem' : '1.7rem', fontWeight: 800, color: s.gdp == null ? T.sec : s.gdp < GDP_BAJA ? T.rojo : T.texto }}>
              {s.gdp == null ? '—' : n0(s.gdp * 1000)}
            </div>
            <div style={{ width: '70%', height: `${alto * 0.72}%`, minHeight: s.gdp != null ? 4 : 0, background: s.gdp != null && s.gdp < GDP_BAJA ? T.rojo : T.barra, opacity: ultima ? 1 : 0.7, borderRadius: '.6rem .6rem 0 0' }} />
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: T.sec, whiteSpace: 'nowrap', paddingBottom: '.4rem', overflow: 'hidden', maxWidth: '100%' }}>
              {ultima ? 'Ahora' : new Date(`${s.desde}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace(/\./g, '').replace(' de ', ' ')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Pantalla de vinculación: código gigante + QR para abrir la app con el código puesto.
function PantallaCodigo({ T, codigo, expira, raiz, sinInternet, ahora }: { T: Tema; codigo: string; expira: string; raiz: React.CSSProperties; sinInternet: boolean; ahora: Date }) {
  const enlace = typeof window !== 'undefined' ? `${window.location.origin}/?vincular_tv=${codigo}` : '';
  const qr = useMemo(() => {
    if (!enlace) return null;
    const q = qrcode(0, 'M'); q.addData(enlace); q.make();
    const n = q.getModuleCount();
    const cuadros: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) cuadros.push(`M${c} ${r}h1v1h-1z`);
    return { n, d: cuadros.join('') };
  }, [enlace]);
  const min = Math.max(1, Math.ceil((Date.parse(expira) - ahora.getTime()) / 60e3));
  return (
    <div style={{ ...raiz, padding: '3rem 4rem' }}>
      <Marca T={T} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 30rem', gap: '4rem', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '3.8rem', fontWeight: 800, lineHeight: 1.15 }}>Conecte este televisor a su finca</div>
          <ol style={{ fontSize: '2.4rem', fontWeight: 600, color: T.sec, margin: '2rem 0 0', paddingLeft: '3rem', lineHeight: 1.5 }}>
            <li>En el celular abra <b style={{ color: T.texto }}>Ganado al Día</b></li>
            <li>Vaya a <b style={{ color: T.texto }}>Ajustes → Tablero en el televisor</b></li>
            <li>Escriba este código (o escanee el QR):</li>
          </ol>
          <div style={{ fontSize: '9.5rem', fontWeight: 800, letterSpacing: '.6rem', color: T.verde, marginTop: '1.6rem', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {codigoBonito(codigo)}
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 600, color: sinInternet ? T.ambar : T.sec, marginTop: '1.6rem' }}>
            {sinInternet ? '⚠ Sin internet. Revise la conexión del televisor.' : `El código cambia solo en ${min} min. No hay que tocar nada aquí.`}
          </div>
        </div>
        {qr && (
          <div style={{ background: '#fff', padding: '1.6rem', borderRadius: '1.4rem' }}>
            <svg viewBox={`-2 -2 ${qr.n + 4} ${qr.n + 4}`} style={{ width: '100%', display: 'block' }} shapeRendering="crispEdges" aria-label="Código QR para conectar">
              <path d={qr.d} fill="#000" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
