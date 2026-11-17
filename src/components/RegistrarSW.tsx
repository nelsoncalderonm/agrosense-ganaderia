'use client';

import { useEffect } from 'react';

// Registra el service worker para que la app abra sin señal.
// Solo en producción: en desarrollo los archivos cambian a cada rato.
export default function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const enviarArchivos = (sw: ServiceWorker | null) => {
      const urls = performance.getEntriesByType('resource')
        .map(e => e.name)
        .filter(u => u.startsWith(location.origin + '/_next/static/'));
      sw?.postMessage({ tipo: 'guardar-archivos', urls });
    };
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(reg => navigator.serviceWorker.ready.then(() => enviarArchivos(reg.active)))
      .catch(() => { /* sin soporte: la app sigue funcionando con señal */ });
  }, []);
  return null;
}
