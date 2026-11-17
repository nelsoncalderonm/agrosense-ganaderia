import type { MetadataRoute } from 'next';

// Permite instalar AgroSense en el celular como una app (ícono en la pantalla de inicio)
// y abrirla sin internet.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AgroSense Ganadería',
    short_name: 'AgroSense',
    description: 'Gestión ganadera que funciona con o sin señal',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#EEF2EC',
    theme_color: '#15A34A',
    lang: 'es',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
