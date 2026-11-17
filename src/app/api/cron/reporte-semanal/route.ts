import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cronAutorizado } from '@/lib/cronAuth';
import { enviarDocumento, enviarMensaje, semanaAnterior, telegramConfigurado } from '@/lib/telegram';
import { generarPdfReporte, nombreArchivoReporte } from '@/lib/reportePdf';
import { formatearReporte, type ReporteFinca } from '@/lib/reporteFinca';
import { lineasClima } from '@/lib/climaReporte';

export const maxDuration = 300;

// Lunes 6 a.m. Colombia (vercel.json): reporte de la semana anterior (lunes a domingo).
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return new Response('unauthorized', { status: 401 });
  if (!telegramConfigurado()) return Response.json({ skipped: 'sin TELEGRAM_BOT_TOKEN' });

  const admin = getSupabaseAdmin();
  const { desde, hasta } = semanaAnterior();

  const { data: vincs, error } = await admin.from('telegram_vinculos')
    .select('id, finca_id, chat_id').eq('activo', true).eq('recibir_reportes', true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: yaEnviados } = await admin.from('reportes_enviados')
    .select('vinculo_id').eq('tipo', 'semanal').eq('periodo_inicio', desde).eq('ok', true);
  const enviados = new Set((yaEnviados ?? []).map(r => r.vinculo_id));

  const cache = new Map<string, { texto: string; pdf: Uint8Array; nombre: string }>();
  let ok = 0, fallos = 0;
  for (const v of vincs ?? []) {
    if (enviados.has(v.id)) continue;
    let rep = cache.get(v.finca_id);
    if (!rep) {
      const { data, error: rErr } = await admin.rpc('reporte_finca', { p_finca_id: v.finca_id, p_desde: desde, p_hasta: hasta });
      if (rErr || !data) { fallos++; continue; }
      const r = data as ReporteFinca;
      rep = { texto: formatearReporte(r, undefined, await lineasClima(admin, v.finca_id, desde, hasta)), pdf: generarPdfReporte(r), nombre: nombreArchivoReporte(r) };
      cache.set(v.finca_id, rep);
    }
    const res = await enviarMensaje(v.chat_id, rep.texto);
    if (res.ok) await enviarDocumento(v.chat_id, rep.pdf, rep.nombre, '📄 Reporte en PDF para guardar o reenviar');
    if (res.ok) ok++; else fallos++;
    // Si el usuario bloqueó el bot, dejamos de intentar.
    if (!res.ok && /blocked|chat not found|deactivated/i.test(res.error ?? '')) {
      await admin.from('telegram_vinculos').update({ activo: false }).eq('id', v.id);
    }
    await admin.from('reportes_enviados').upsert({
      vinculo_id: v.id, finca_id: v.finca_id, tipo: 'semanal',
      periodo_inicio: desde, periodo_fin: hasta, ok: res.ok, error: res.error ?? null,
      enviado_at: new Date().toISOString(),
    }, { onConflict: 'vinculo_id,tipo,periodo_inicio' });
  }
  return Response.json({ desde, hasta, enviados: ok, fallos });
}
