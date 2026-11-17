'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ResumenClima } from '@/lib/clima';

export type EstadoClima = 'cargando' | 'ok' | 'sin_coordenadas' | 'error';

const clave = (fincaId: string) => `gad:clima:${fincaId}`;
const UNA_HORA = 60 * 60 * 1000;

function leerCache(fincaId: string): ResumenClima | null {
  try {
    const raw = localStorage.getItem(clave(fincaId));
    return raw ? JSON.parse(raw) as ResumenClima : null;
  } catch { return null; }
}

/**
 * Clima de la finca. Guarda la última respuesta en el celular para verla sin señal.
 * Solo vuelve a pedir datos si lo guardado tiene más de una hora (o si se pide a mano).
 */
export function useClima(fincaId: string | undefined, coordsClave: string) {
  const [data, setData] = useState<ResumenClima | null>(null);
  const [estado, setEstado] = useState<EstadoClima>('cargando');
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (forzar = false) => {
    if (!fincaId) return;
    const cache = leerCache(fincaId);
    if (cache) { setData(cache); setEstado('ok'); }
    const fresco = cache && Date.now() - new Date(cache.actualizado).getTime() < UNA_HORA;
    if ((fresco && !forzar) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      if (!cache) { setEstado('error'); setError('Sin señal. Abre esta pantalla con internet una vez para guardar el clima.'); }
      return;
    }
    if (!cache) setEstado('cargando');
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`/api/clima?finca_id=${encodeURIComponent(fincaId)}`, {
        headers: { Authorization: `Bearer ${s.session?.access_token ?? ''}` },
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) { setEstado('sin_coordenadas'); setData(null); return; }
      if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
      try { localStorage.setItem(clave(fincaId), JSON.stringify(body)); } catch { /* almacenamiento lleno */ }
      setData(body as ResumenClima); setEstado('ok'); setError(null);
    } catch (e) {
      if (!cache) { setEstado('error'); setError(e instanceof Error ? e.message : 'No se pudo cargar el clima'); }
    }
  }, [fincaId]);

  // Si cambian las coordenadas, lo guardado ya no sirve.
  useEffect(() => {
    if (!fincaId) return;
    const cache = leerCache(fincaId);
    if (cache && coordsClave && `${cache.lat},${cache.lon}` !== coordsClave) {
      try { localStorage.removeItem(clave(fincaId)); } catch { /* nada */ }
    }
    const t = setTimeout(() => { cargar(); }, 0);
    return () => clearTimeout(t);
  }, [fincaId, coordsClave, cargar]);

  return { data, estado, error, recargar: () => cargar(true) };
}
