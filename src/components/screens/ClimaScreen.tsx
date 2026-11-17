'use client';

import { useState } from 'react';
import type { DbFinca } from '@/lib/supabase';
import { comparaNormal, type DiaClima, type ResumenClima } from '@/lib/clima';
import { useClima } from '@/hooks/useClima';
import EncabezadoPantalla from '../ui/EncabezadoPantalla';
import UbicacionFinca from '../ui/UbicacionFinca';
import { C, card, btnSecundario, aviso } from '../ui/estilosCampo';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fechaDia = (s: string) => new Date(`${s}T12:00:00`);
const nombreDia = (s: string, i: number) => i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DIAS[fechaDia(s).getDay()];
const corta = (s: string) => fechaDia(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
const mm = (v: number | null | undefined) => v == null ? '—' : `${Math.round(v)} mm`;
const grados = (v: number | null | undefined) => v == null ? '—' : `${Math.round(v)}°`;

const NIVEL = {
  seco: { color: C.ambar, fondo: C.ambarSuave },
  normal: { color: C.verde, fondo: C.verdeSuave },
  lluvioso: { color: C.azul, fondo: C.azulSuave },
};

function Cifra({ valor, etiqueta, color = C.texto }: { valor: string; etiqueta: string; color?: string }) {
  return (
    <div style={{ background: C.fondo, borderRadius: 6, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.suave, marginTop: 4 }}>{etiqueta}</div>
    </div>
  );
}

function Comparacion({ real, normal, texto }: { real: number; normal: number | null; texto: string }) {
  const c = comparaNormal(real, normal);
  if (!c || normal == null) return null;
  const n = NIVEL[c.nivel];
  return (
    <div style={{ background: n.fondo, color: n.color, borderRadius: 6, padding: '10px 12px', fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>
      {texto}: {mm(real)} · lo normal es {mm(normal)}<br />
      <span style={{ fontWeight: 800 }}>{c.txt}</span>
    </div>
  );
}

function Pronostico({ dias }: { dias: DiaClima[] }) {
  const max = Math.max(10, ...dias.map(d => d.lluvia_mm ?? 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {dias.map((d, i) => (
        <div key={d.fecha} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 70px', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${C.borde}` : 'none' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{nombreDia(d.fecha, i)}</div>
            <div style={{ fontSize: 14, color: C.suave, fontWeight: 600 }}>{corta(d.fecha)}</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 14, background: C.fondo, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, ((d.lluvia_mm ?? 0) / max) * 100)}%`, height: '100%', background: C.azul }} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.azul, minWidth: 54, textAlign: 'right' }}>{mm(d.lluvia_mm)}</div>
            </div>
            {d.prob_lluvia != null && <div style={{ fontSize: 14, color: C.suave, fontWeight: 600, marginTop: 2 }}>Probabilidad de lluvia {d.prob_lluvia}%</div>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 17, fontWeight: 800 }}>
            {grados(d.temp_max)}<span style={{ color: C.suave, fontWeight: 600 }}> / {grados(d.temp_min)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Barras30({ dias }: { dias: DiaClima[] }) {
  const max = Math.max(10, ...dias.map(d => d.lluvia_mm ?? 0));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110 }} role="img" aria-label="Lluvia diaria de los últimos 30 días">
        {dias.map(d => (
          <div key={d.fecha} title={`${corta(d.fecha)}: ${mm(d.lluvia_mm)}`} style={{ flex: 1, background: (d.lluvia_mm ?? 0) > 0 ? C.azul : C.borde, height: `${Math.max(3, ((d.lluvia_mm ?? 0) / max) * 100)}%`, borderRadius: '2px 2px 0 0' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.suave, fontWeight: 600, marginTop: 6 }}>
        <span>{dias[0] ? corta(dias[0].fecha) : ''}</span><span>Ayer</span>
      </div>
    </div>
  );
}

function Semanas({ semanas }: { semanas: ResumenClima['lluvia']['semanas'] }) {
  const max = Math.max(10, ...semanas.map(s => s.mm));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {semanas.map((s, i) => (
        <div key={s.desde} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 64px', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{i === semanas.length - 1 ? 'Última semana' : `${corta(s.desde)} – ${corta(s.hasta)}`}</div>
          <div style={{ height: 16, background: C.fondo, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(s.mm / max) * 100}%`, height: '100%', background: C.azul }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.azul, textAlign: 'right' }}>{mm(s.mm)}</div>
        </div>
      ))}
    </div>
  );
}

export default function ClimaScreen({ finca, puedeEditar, onOpenDrawer, onFincaActualizada }: {
  finca?: DbFinca; puedeEditar: boolean; onOpenDrawer: () => void; onFincaActualizada: () => void;
}) {
  const coords = finca?.latitud != null && finca?.longitud != null ? `${Number(finca.latitud)},${Number(finca.longitud)}` : '';
  const { data, estado, error, recargar } = useClima(finca?.id, coords);
  const [editarUbic, setEditarUbic] = useState(false);
  const enLinea = typeof navigator === 'undefined' || navigator.onLine;

  if (!finca) return null;
  const sinCoords = !coords || estado === 'sin_coordenadas';

  return (
    <div style={{ paddingBottom: 90 }}>
      <EncabezadoPantalla titulo="Clima" onOpenDrawer={onOpenDrawer} derecha={!sinCoords && data ? (
        <button onClick={recargar} style={{ ...btnSecundario, height: 44, fontSize: 16 }}>Actualizar</button>
      ) : undefined} />
      <div className="ag-list-grid" style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sinCoords ? (
          <UbicacionFinca key={finca.id} finca={finca} puedeEditar={puedeEditar} onGuardado={onFincaActualizada} />
        ) : estado === 'cargando' && !data ? (
          <div style={{ ...card, fontSize: 18, fontWeight: 700, textAlign: 'center' }}>Cargando el clima…</div>
        ) : !data ? (
          <div style={{ ...card }}>
            <div style={aviso('error')}>{error ?? 'No se pudo cargar el clima.'}</div>
            <button onClick={recargar} style={{ ...btnSecundario, marginTop: 10, width: '100%' }}>Intentar de nuevo</button>
          </div>
        ) : (
          <>
            {!enLinea && <div style={aviso('info')}>Sin señal. Estos son los datos guardados el {new Date(data.actualizado).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.</div>}

            {/* Hoy */}
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 12 }}>Hoy</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Cifra valor={grados(data.ahora.temp)} etiqueta="Temperatura ahora" />
                <Cifra valor={mm(data.hoy?.lluvia_mm)} etiqueta="Lluvia esperada hoy" color={C.azul} />
                <Cifra valor={`${grados(data.hoy?.temp_max)} / ${grados(data.hoy?.temp_min)}`} etiqueta="Máxima / mínima" />
                <Cifra valor={data.ahora.humedad == null ? '—' : `${Math.round(data.ahora.humedad)}%`} etiqueta="Humedad" />
              </div>
            </div>

            {/* Lluvia: totales */}
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 12 }}>Lluvia</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Cifra valor={mm(data.lluvia.ultimos_7)} etiqueta="Últimos 7 días" color={C.azul} />
                <Cifra valor={mm(data.lluvia.proximos_7)} etiqueta="Próximos 7 días" color={C.azul} />
                <Cifra valor={mm(data.lluvia.ultimos_30)} etiqueta="Últimos 30 días" color={C.azul} />
                <Cifra valor={mm(data.lluvia.mes_actual)} etiqueta={`En ${data.lluvia.mes_nombre} (hasta ayer)`} color={C.azul} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <Comparacion real={data.lluvia.ultimos_30} normal={data.lluvia.normal_30} texto="Últimos 30 días" />
                {data.lluvia.normal_mes != null && (
                  <div style={{ fontSize: 16, color: C.suave, fontWeight: 600 }}>
                    En {data.lluvia.mes_nombre} normalmente llueven {mm(data.lluvia.normal_mes)} en total (promedio de {data.lluvia.anios_normal} años).
                  </div>
                )}
              </div>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 6 }}>Próximos 7 días</div>
              <Pronostico dias={data.pronostico} />
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 12 }}>Lluvia por semana</div>
              <Semanas semanas={data.lluvia.semanas} />
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 12 }}>Lluvia diaria, últimos 30 días</div>
              <Barras30 dias={data.historial} />
              {data.temp.max_prom_30 != null && (
                <div style={{ fontSize: 16, color: C.suave, fontWeight: 600, marginTop: 10 }}>
                  Temperatura promedio del mes: máxima {grados(data.temp.max_prom_30)}, mínima {grados(data.temp.min_prom_30)}.
                </div>
              )}
            </div>

            <div style={{ fontSize: 15, color: C.suave, lineHeight: 1.45, padding: '0 2px' }}>
              Estimación con satélite y modelos del clima (Open-Meteo) para la zona de la finca. Puede variar frente a lo que cae en un potrero puntual.
              Actualizado {new Date(data.actualizado).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.
            </div>

            {puedeEditar && (editarUbic ? (
              <UbicacionFinca key={finca.id} finca={finca} puedeEditar compacto onGuardado={() => { setEditarUbic(false); onFincaActualizada(); }} />
            ) : (
              <button onClick={() => setEditarUbic(true)} style={btnSecundario}>Cambiar ubicación de la finca</button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
