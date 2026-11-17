// Cálculos sencillos sobre figuras dibujadas en el mapa.
export type LatLon = [number, number];

const R = 6378137; // radio de la Tierra (m), el mismo de los mapas web
const rad = (g: number) => (g * Math.PI) / 180;

/** Área de un polígono sobre la esfera, en hectáreas. */
export function areaHa(pts: LatLon[]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [lat1, lon1] = pts[i];
    const [lat2, lon2] = pts[(i + 1) % pts.length];
    s += rad(lon2 - lon1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((s * R * R) / 2) / 10000;
}

/** Distancia entre dos puntos, en metros. */
export function distanciaM(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Perímetro cerrado en metros (metros de cerca). */
export function perimetroM(pts: LatLon[]): number {
  if (pts.length < 2) return 0;
  return pts.reduce((s, p, i) => s + distanciaM(p, pts[(i + 1) % pts.length]), 0);
}

export function centro(pts: LatLon[]): LatLon {
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}

/** Acepta lo que venga de la base y devuelve vértices válidos o null. */
export function leerFigura(v: unknown): LatLon[] | null {
  if (!Array.isArray(v)) return null;
  const pts = v.filter((p): p is LatLon => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(p => [Number(p[0]), Number(p[1])] as LatLon);
  return pts.length >= 3 ? pts : null;
}

export const haTxt = (ha: number) => ha.toLocaleString('es-CO', { maximumFractionDigits: ha < 10 ? 2 : 1 });
