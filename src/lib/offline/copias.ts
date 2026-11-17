// Copia local de los datos para poder trabajar sin señal (buscar animales por arete/RFID, ver potreros).
import { STORE_KV, poner, leer } from './almacen';

export async function guardarCopia<T>(clave: string, datos: T) {
  try { await poner(STORE_KV, { datos, guardado_en: new Date().toISOString() }, clave); } catch { /* sin espacio o sin IndexedDB */ }
}

export async function leerCopia<T>(clave: string): Promise<{ datos: T; guardado_en: string } | null> {
  try { return (await leer<{ datos: T; guardado_en: string }>(STORE_KV, clave)) ?? null; } catch { return null; }
}
