// AgroSense: service worker para abrir la app sin señal.
// - Páginas: primero la red (con límite de tiempo); sin señal, la última copia guardada.
// - Archivos de la app (/_next/static): se guardan la primera vez y se sirven desde el celular.
// - Supabase y otras APIs no pasan por aquí: los datos sin señal los maneja la cola local de la app.
const VERSION = 'v1';
const CACHE_PAGINAS = `agrosense-paginas-${VERSION}`;
const CACHE_ESTATICOS = `agrosense-estaticos-${VERSION}`;
const MAX_ESTATICOS = 300;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_PAGINAS)
      .then(c => c.addAll(['/', '/manifest.webmanifest', '/icono-192.png', '/icono-512.png']))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const vigentes = new Set([CACHE_PAGINAS, CACHE_ESTATICOS]);
    for (const k of await caches.keys()) if (k.startsWith('agrosense-') && !vigentes.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

// La app nos manda los archivos que ya cargó antes de que este service worker existiera.
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.tipo === 'guardar-archivos' && Array.isArray(data.urls)) {
    event.waitUntil(guardarArchivos(data.urls));
  }
});

async function guardarArchivos(urls) {
  const cache = await caches.open(CACHE_ESTATICOS);
  await Promise.all(urls.map(async u => {
    try {
      const url = new URL(u, self.location.origin);
      if (url.origin !== self.location.origin || !url.pathname.startsWith('/_next/static/')) return;
      if (await cache.match(url.href)) return;
      const r = await fetch(url.href);
      if (r.ok) await cache.put(url.href, r);
    } catch { /* sin señal: se intentará la próxima vez */ }
  }));
  await recortar(cache);
}

async function recortar(cache) {
  const claves = await cache.keys();
  for (let i = 0; i < claves.length - MAX_ESTATICOS; i++) await cache.delete(claves[i]);
}

function conTiempo(promesa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('tiempo')), ms);
    promesa.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase, fuentes externas, etc.
  if (url.pathname.startsWith('/api/')) return;      // APIs propias: siempre a la red

  // Archivos con hash: nunca cambian, se sirven desde el celular.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_ESTATICOS);
      const guardado = await cache.match(req);
      if (guardado) return guardado;
      const r = await fetch(req);
      if (r.ok) cache.put(req, r.clone());
      return r;
    })());
    return;
  }

  // Navegación: red primero (6 s), si no la copia guardada de la página o de la portada.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_PAGINAS);
      try {
        const r = await conTiempo(fetch(req), 6000);
        if (r.ok) cache.put(req, r.clone());
        return r;
      } catch {
        return (await cache.match(req)) || (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Íconos, manifest y demás: copia guardada al instante y se actualiza por detrás.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_PAGINAS);
    const guardado = await cache.match(req);
    const red = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => guardado || Response.error());
    return guardado || red;
  })());
});
