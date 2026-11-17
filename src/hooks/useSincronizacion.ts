'use client';

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { listarCola, suscribirCola, type Operacion } from '@/lib/offline/cola';
import { estadoMotor, iniciarSincronizacion, sincronizar } from '@/lib/offline/sincronizar';

export type EstadoSync = {
  enLinea: boolean;
  sincronizando: boolean;
  pendientes: Operacion[];
  conflictos: Operacion[];
  ultimaSync: string | null;
  sincronizarAhora: () => void;
};

function suscribirRed(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
}

// Estado de la señal y de la cola local, para mostrarlo en pantalla.
export function useSincronizacion(): EstadoSync {
  const enLinea = useSyncExternalStore(suscribirRed, () => navigator.onLine, () => true);
  const [cola, setCola] = useState<Operacion[]>([]);
  const [motor, setMotor] = useState(estadoMotor());

  const refrescar = useCallback(() => {
    listarCola().then(setCola);
    setMotor(estadoMotor());
  }, []);

  useEffect(() => {
    iniciarSincronizacion();
    const quitar = suscribirCola(refrescar);
    listarCola().then(setCola);
    return quitar;
  }, [refrescar]);

  return {
    enLinea,
    sincronizando: motor.sincronizando,
    pendientes: cola.filter(o => o.estado === 'pendiente'),
    conflictos: cola.filter(o => o.estado === 'conflicto'),
    ultimaSync: motor.ultimaSync,
    sincronizarAhora: () => { void sincronizar(); },
  };
}
