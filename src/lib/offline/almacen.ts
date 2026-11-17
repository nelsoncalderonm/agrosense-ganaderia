// Almacenamiento local del celular (IndexedDB).
// Todo el modo sin señal pasa por este archivo: cuando AgroSense sea app nativa (Capacitor),
// basta con cambiar esta implementación por SQLite sin tocar las pantallas.

const DB_NOMBRE = 'agrosense-offline';
const DB_VERSION = 1;

export const STORE_COLA = 'cola';   // operaciones pendientes y conflictos
export const STORE_KV = 'kv';       // copias de datos para ver sin señal

let dbPromesa: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Este navegador no permite guardar datos sin señal'));
  if (!dbPromesa) {
    dbPromesa = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NOMBRE, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_COLA)) {
          const s = db.createObjectStore(STORE_COLA, { keyPath: 'id' });
          s.createIndex('orden', 'orden');
        }
        if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromesa = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromesa = null; reject(req.error); };
    });
  }
  return dbPromesa;
}

function enTx<T>(store: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return abrir().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, modo);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export function poner<T>(store: string, valor: T, clave?: IDBValidKey): Promise<void> {
  return enTx<IDBValidKey>(store, 'readwrite', s => s.put(valor, clave)).then(() => undefined);
}

export function leer<T>(store: string, clave: IDBValidKey): Promise<T | undefined> {
  return enTx<T | undefined>(store, 'readonly', s => s.get(clave));
}

export function borrar(store: string, clave: IDBValidKey): Promise<void> {
  return enTx(store, 'readwrite', s => s.delete(clave)).then(() => undefined);
}

export function todos<T>(store: string, indice?: string): Promise<T[]> {
  return enTx<T[]>(store, 'readonly', s => (indice ? s.index(indice).getAll() : s.getAll()));
}

export function nuevoId(): string {
  const c = globalThis.crypto as Crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x: number) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
