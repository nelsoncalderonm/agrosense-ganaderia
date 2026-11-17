'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Turno = { rol: 'user' | 'assistant'; texto: string };

const SUGERENCIAS_CLIENTE = [
  'No me conecta el lector RFID',
  '¿Cómo registro un pesaje?',
  'Quiero cambiar de plan',
];
const SUGERENCIAS_VISITANTE = [
  '¿Cuánto cuesta?',
  '¿Cómo funciona la prueba gratis?',
  '¿Necesito el lector RFID?',
];

const SALUDO = 'Hola, soy el asistente de Ganado al Día. ¿En qué le puedo ayudar?';
const CLAVE_STORAGE = 'agrosense-soporte';

type Props = {
  /** 'app' cuando hay sesión iniciada; 'web' en la página pública /soporte. */
  origen: 'app' | 'web' | 'landing';
  /** true: panel abierto y a pantalla completa (página /soporte). */
  embebido?: boolean;
};

function leerGuardado(): { mensajes: Turno[]; conversacionId: string | null } {
  try {
    const raw = sessionStorage.getItem(CLAVE_STORAGE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { mensajes: [], conversacionId: null };
}

export default function SoporteChat({ origen, embebido = false }: Props) {
  const [abierto, setAbierto] = useState(embebido);
  const [mensajes, setMensajes] = useState<Turno[]>([]);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify({ mensajes, conversacionId })); } catch {}
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, conversacionId, enviando]);

  async function enviar(contenido: string) {
    const limpio = contenido.trim();
    if (!limpio || enviando) return;
    const nuevos: Turno[] = [...mensajes, { rol: 'user', texto: limpio }];
    setMensajes(nuevos);
    setTexto('');
    setError(null);
    setEnviando(true);
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (origen === 'app') {
        const { data } = await supabase.auth.getSession();
        if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
      }
      const res = await fetch('/api/soporte/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mensajes: nuevos, conversacionId, origen }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No pudimos responder ahora.');
      setMensajes([...nuevos, { rol: 'assistant', texto: data.respuesta }]);
      if (data.conversacionId) setConversacionId(data.conversacionId);
      if (data.whatsappUrl && (data.escalada || data.leadRegistrado)) setWhatsappUrl(data.whatsappUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos responder ahora.');
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setMensajes([]);
    setConversacionId(null);
    setWhatsappUrl(null);
    setError(null);
  }

  const sugerencias = origen === 'app' ? SUGERENCIAS_CLIENTE : SUGERENCIAS_VISITANTE;

  if (!abierto) {
    return (
      <button
        onClick={() => {
          // Recupera la conversación de esta pestaña (se pierde al cerrar el navegador).
          if (mensajes.length === 0) {
            const g = leerGuardado();
            setMensajes(g.mensajes);
            setConversacionId(g.conversacionId);
          }
          setAbierto(true);
        }}
        aria-label="Abrir chat de ayuda"
        className="ag-soporte-burbuja"
        style={{
          position: 'fixed', right: 16, bottom: 84, zIndex: 35, height: 52, padding: '0 18px 0 14px',
          borderRadius: 26, border: 'none', background: '#15A34A', color: '#fff', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 20px rgba(21,163,74,.35)', cursor: 'pointer',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        Ayuda
      </button>
    );
  }

  const panel: React.CSSProperties = embebido
    ? { position: 'relative', width: '100%', maxWidth: 560, height: '100dvh', margin: '0 auto' }
    : { position: 'fixed', right: 16, bottom: 84, zIndex: 45, width: 'min(380px, calc(100vw - 32px))', height: 'min(560px, calc(100dvh - 120px))', borderRadius: 12, boxShadow: '0 12px 40px rgba(20,40,20,.25)' };

  return (
    <div className="animate-up" style={{ ...panel, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #E1E8DD' }}>
      <div style={{ background: '#15A34A', color: '#fff', padding: origen === 'landing' ? '12px 52px 12px 14px' : '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Ayuda Ganado al Día</div>
          <div style={{ fontSize: 11.5, opacity: 0.9 }}>Asistente con IA · le pasa con una persona si lo necesita</div>
        </div>
        {mensajes.length > 0 && (
          <button onClick={reiniciar} title="Nueva conversación" style={{ background: 'rgba(255,255,255,.18)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, padding: '6px 8px', cursor: 'pointer' }}>Nueva</button>
        )}
        {!embebido && (
          <button onClick={() => setAbierto(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}>×</button>
        )}
      </div>

      <div className="scrollbar-none" style={{ flex: 1, overflowY: 'auto', padding: 14, background: '#F5F8F3', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Burbuja turno={{ rol: 'assistant', texto: SALUDO }} />
        {mensajes.length === 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {sugerencias.map((s) => (
              <button key={s} onClick={() => enviar(s)} style={{ border: '1px solid #BFD8BF', background: '#fff', color: '#2F6B2F', borderRadius: 16, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>{s}</button>
            ))}
          </div>
        )}
        {mensajes.map((m, i) => <Burbuja key={i} turno={m} />)}
        {enviando && <div style={{ fontSize: 13, color: '#6E8A6E', padding: '4px 2px' }} className="animate-blink">Escribiendo…</div>}
        {error && <div style={{ fontSize: 13, color: '#B42318', background: '#FEF3F2', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start', background: '#25D366', color: '#fff', fontWeight: 700, fontSize: 13.5, borderRadius: 20, padding: '9px 14px', textDecoration: 'none' }}>
            Escribir a un asesor por WhatsApp
          </a>
        )}
        <div ref={finRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); enviar(texto); }}
        style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #E1E8DD', background: '#fff' }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={1500}
          placeholder="Escriba su pregunta…"
          aria-label="Su pregunta"
          style={{ flex: 1, height: 44, border: '1px solid #C5D2C0', borderRadius: 22, padding: '0 14px', fontSize: 15, outline: 'none' }}
        />
        <button type="submit" disabled={enviando || !texto.trim()} style={{ height: 44, minWidth: 44, borderRadius: 22, border: 'none', background: enviando || !texto.trim() ? '#A7C7A7' : '#15A34A', color: '#fff', fontWeight: 700, fontSize: 14, padding: '0 16px', cursor: 'pointer' }}>
          Enviar
        </button>
      </form>
    </div>
  );
}

function Burbuja({ turno }: { turno: Turno }) {
  const mio = turno.rol === 'user';
  return (
    <div style={{
      alignSelf: mio ? 'flex-end' : 'flex-start', maxWidth: '85%', whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.4,
      background: mio ? '#15A34A' : '#fff', color: mio ? '#fff' : '#1F2E1F',
      border: mio ? 'none' : '1px solid #E1E8DD', borderRadius: 12, padding: '9px 12px',
    }}>
      {turno.texto}
    </div>
  );
}
