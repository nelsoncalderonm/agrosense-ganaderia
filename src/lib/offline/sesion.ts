// Sin señal, Supabase no puede renovar una sesión vencida y la daría por cerrada.
// Para no sacar al vaquero de la app en la manga, usamos la última sesión guardada en el celular
// solo para mostrar los datos locales. La sincronización espera a tener una sesión válida.
import type { Session } from '@supabase/supabase-js';

export function sesionGuardada(): Session | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) {
        const s = JSON.parse(localStorage.getItem(k) ?? 'null');
        if (s?.user?.id && s?.access_token) return s as Session;
      }
    }
  } catch { /* nada guardado */ }
  return null;
}
