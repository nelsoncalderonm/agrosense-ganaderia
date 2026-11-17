'use client';

// Inicio: animales listos para el matadero (meta de peso), retiros y los que no están engordando.
import { useState } from 'react';
import type { DbAnimal } from '@/lib/supabase';
import { enlaceOfertaWhatsApp, fechaCorta, GDP_BAJA, type ResumenVenta, type Retiro } from '@/lib/venta';

const card: React.CSSProperties = { background: '#fff', border: '1px solid #B9C6B4', borderRadius: 4, padding: 15, marginTop: 12 };
const nombre = (a: DbAnimal) => a.nombre ? `${a.nombre} · ${a.arete}` : a.arete;

function Fila({ a, derecha, color, sub }: { a: DbAnimal; derecha: string; color: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderTop: '1px solid #EDF1EA' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre(a)}</div>
        {sub && <div style={{ fontSize: 16, color, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, flexShrink: 0 }}>{derecha}</div>
    </div>
  );
}

export function ListosParaVender({ r, retiros, fincaNombre, ubicacion, puedeOfrecer, onCambiarMeta, onAbrirAnimal }: {
  r: ResumenVenta;
  retiros: Map<string, Retiro>;
  fincaNombre: string;
  ubicacion: string | null;
  puedeOfrecer: boolean;
  onCambiarMeta?: () => void;
  onAbrirAnimal?: (dbId: string) => void;
}) {
  const [verLista, setVerLista] = useState(false);
  const hay = r.listos.length > 0;

  return (
    <div style={{ ...card, borderLeft: `4px solid ${hay ? '#15803D' : '#8FA38A'}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Listos para vender</div>
        {onCambiarMeta && (
          <button onClick={onCambiarMeta} style={{ background: 'none', border: 'none', color: '#15803D', fontWeight: 700, fontSize: 17, cursor: 'pointer', padding: 4 }}>Cambiar meta</button>
        )}
      </div>
      <div style={{ fontSize: 17, color: '#3A4D3A', marginTop: 2 }}>Meta para el matadero: <b style={{ color: '#0F1A0F' }}>{r.meta.toLocaleString('es-CO')} kg</b></div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
        <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: hay ? '#15803D' : '#4A5E4A' }}>{r.listos.length}</div>
        <div style={{ fontSize: 18, color: '#3A5A3A', fontWeight: 600 }}>
          {hay ? <>animales · {r.pesoPromListos.toLocaleString('es-CO')} kg promedio</> : 'todavía ninguno llegó a la meta'}
        </div>
      </div>

      {r.enRetiro.length > 0 && (
        <div style={{ marginTop: 10, background: '#FEE2E2', color: '#991B1B', borderRadius: 4, padding: '8px 10px', fontSize: 17, fontWeight: 700 }}>
          ⛔ {r.enRetiro.length} {r.enRetiro.length === 1 ? 'llegó' : 'llegaron'} a la meta pero {r.enRetiro.length === 1 ? 'está' : 'están'} en retiro: no vender todavía
        </div>
      )}
      {r.cerca > 0 && (
        <div style={{ marginTop: 8, fontSize: 17, color: '#3A4D3A' }}>A {r.cerca} más {r.cerca === 1 ? 'le' : 'les'} faltan 30 kg o menos.</div>
      )}

      {(hay || r.enRetiro.length > 0) && (
        <button onClick={() => setVerLista(v => !v)} style={{ marginTop: 12, width: '100%', height: 44, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A5A3A', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>
          {verLista ? 'Ocultar lista' : 'Ver cuáles son'}
        </button>
      )}

      {verLista && (
        <div style={{ marginTop: 6 }}>
          {r.listos.map(a => (
            <div key={a.id} onClick={() => onAbrirAnimal?.(a.id)} style={{ cursor: onAbrirAnimal ? 'pointer' : 'default' }}>
              <Fila a={a} derecha={`${Math.round(a.peso_actual ?? 0)} kg`} color="#15803D" />
            </div>
          ))}
          {r.enRetiro.map(a => {
            const ret = retiros.get(a.id);
            return (
              <div key={a.id} onClick={() => onAbrirAnimal?.(a.id)} style={{ cursor: onAbrirAnimal ? 'pointer' : 'default' }}>
                <Fila a={a} derecha={`${Math.round(a.peso_actual ?? 0)} kg`} color="#B91C1C"
                  sub={ret ? `No vender hasta el ${fechaCorta(ret.hasta)}` : 'En retiro'} />
              </div>
            );
          })}
        </div>
      )}

      {hay && puedeOfrecer && (
        <a
          href={enlaceOfertaWhatsApp({ finca: fincaNombre, ubicacion, animales: r.listos, pesoProm: r.pesoPromListos, kgTotal: r.kgListos })}
          target="_blank" rel="noopener noreferrer"
          style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, padding: '8px 12px', textAlign: 'center', lineHeight: 1.2, borderRadius: 4, background: '#15803D', color: '#fff', fontWeight: 800, fontSize: 18, textDecoration: 'none', boxShadow: '0 4px 14px rgba(21,163,74,.28)' }}
        >
          Ofrecer a Frigorodeo por WhatsApp
        </a>
      )}
    </div>
  );
}

export function NoEngordan({ animales, onAbrirAnimal }: { animales: DbAnimal[]; onAbrirAnimal?: (dbId: string) => void }) {
  const [todos, setTodos] = useState(false);
  if (!animales.length) return null;
  const lista = todos ? animales : animales.slice(0, 5);
  return (
    <div style={{ ...card, borderLeft: '4px solid #B45309' }}>
      <div style={{ fontWeight: 800, fontSize: 20 }}>No están engordando</div>
      <div style={{ fontSize: 17, color: '#3A4D3A', marginTop: 2 }}>
        {animales.length} {animales.length === 1 ? 'animal gana' : 'animales ganan'} menos de {GDP_BAJA * 1000} gramos al día. Revíselos: parásitos, cojera o potrero.
      </div>
      <div style={{ marginTop: 6 }}>
        {lista.map(a => {
          const g = a.gdp ?? 0;
          const txt = g < 0 ? `Bajó ${Math.round(-g * 1000)} g/día` : `Gana ${Math.round(g * 1000)} g/día`;
          return (
            <div key={a.id} onClick={() => onAbrirAnimal?.(a.id)} style={{ cursor: onAbrirAnimal ? 'pointer' : 'default' }}>
              <Fila a={a} derecha={txt} color={g < 0 ? '#B91C1C' : '#B45309'} />
            </div>
          );
        })}
      </div>
      {animales.length > 5 && (
        <button onClick={() => setTodos(v => !v)} style={{ marginTop: 6, width: '100%', height: 42, border: '1px solid #8FA38A', borderRadius: 4, background: '#fff', color: '#3A5A3A', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>
          {todos ? 'Ver menos' : `Ver los ${animales.length}`}
        </button>
      )}
    </div>
  );
}
