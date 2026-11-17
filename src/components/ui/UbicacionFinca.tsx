'use client';

import { useState } from 'react';
import { actualizarFinca, type DbFinca } from '@/lib/supabase';
import { leerCoordenadas } from '@/lib/clima';
import { C, inp, lbl, card, btnPrincipal, btnSecundario, aviso } from './estilosCampo';

/**
 * Coordenadas de la finca para el clima. Dos caminos sencillos:
 * 1) Estando en la finca: "Usar mi ubicación" (GPS del celular).
 * 2) Pegar las coordenadas de Google Maps: "4.1512, -73.6345".
 */
export default function UbicacionFinca({ finca, puedeEditar, onGuardado, compacto }: {
  finca: DbFinca; puedeEditar: boolean; onGuardado: () => void; compacto?: boolean;
}) {
  const tiene = finca.latitud != null && finca.longitud != null;
  const [texto, setTexto] = useState(tiene ? `${finca.latitud}, ${finca.longitud}` : '');
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error' | 'info'; txt: string } | null>(null);

  const usarGps = () => {
    if (!('geolocation' in navigator)) { setMsg({ tipo: 'error', txt: 'Este celular no permite leer la ubicación.' }); return; }
    setBuscando(true); setMsg({ tipo: 'info', txt: 'Buscando tu ubicación… puede tardar un minuto al aire libre.' });
    navigator.geolocation.getCurrentPosition(
      pos => {
        setBuscando(false);
        const lat = Math.round(pos.coords.latitude * 1e6) / 1e6, lon = Math.round(pos.coords.longitude * 1e6) / 1e6;
        setTexto(`${lat}, ${lon}`);
        setMsg({ tipo: 'info', txt: `Ubicación encontrada (±${Math.round(pos.coords.accuracy)} m). Revisa y toca Guardar.` });
      },
      err => {
        setBuscando(false);
        setMsg({ tipo: 'error', txt: err.code === 1 ? 'No diste permiso de ubicación. Actívalo en el navegador o pega las coordenadas.' : 'No se pudo leer la ubicación. Intenta al aire libre o pega las coordenadas.' });
      },
      { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 },
    );
  };

  const guardar = async () => {
    const c = leerCoordenadas(texto);
    if (!c) { setMsg({ tipo: 'error', txt: 'Escribe latitud y longitud, por ejemplo: 4.1512, -73.6345' }); return; }
    setGuardando(true); setMsg(null);
    const { error } = await actualizarFinca(finca.id, { latitud: c.lat, longitud: c.lon });
    setGuardando(false);
    if (error) { setMsg({ tipo: 'error', txt: navigator.onLine ? error : 'Sin señal. Guarda cuando tengas internet.' }); return; }
    setMsg({ tipo: 'ok', txt: 'Ubicación guardada' });
    onGuardado();
  };

  const c = leerCoordenadas(texto);
  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 6 }}>Ubicación de la finca</div>
      {!compacto && (
        <div style={{ fontSize: 16, color: C.suave, marginBottom: 12, lineHeight: 1.4 }}>
          Con la ubicación calculamos la lluvia y la temperatura de la finca, sin pluviómetro.
        </div>
      )}
      {!puedeEditar ? (
        <div style={{ fontSize: 17, fontWeight: 600 }}>
          {tiene ? `${finca.latitud}, ${finca.longitud}` : 'Pídele al propietario que guarde la ubicación de la finca.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={usarGps} disabled={buscando} style={{ ...btnSecundario, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.verde} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>
            {buscando ? 'Buscando…' : 'Estoy en la finca: usar mi ubicación'}
          </button>
          <div>
            <label style={lbl}>O PEGA LAS COORDENADAS (GOOGLE MAPS)</label>
            <input style={inp} value={texto} onChange={e => setTexto(e.target.value)} placeholder="4.1512, -73.6345" inputMode="text" />
          </div>
          {c && (
            <a href={`https://www.google.com/maps?q=${c.lat},${c.lon}`} target="_blank" rel="noreferrer" style={{ fontSize: 16, color: C.azul, fontWeight: 700 }}>
              Ver este punto en el mapa ↗
            </a>
          )}
          {msg && <div style={aviso(msg.tipo)}>{msg.txt}</div>}
          <button onClick={guardar} disabled={guardando} style={btnPrincipal(guardando)}>
            {guardando ? 'Guardando…' : 'Guardar ubicación'}
          </button>
        </div>
      )}
    </div>
  );
}
