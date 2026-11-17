import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { enviarDocumento, enviarMensaje, esc, hoyBogota, sumarDias, webhookSecret, type TgUpdate } from '@/lib/telegram';
import { formatearReporte, type ReporteFinca } from '@/lib/reporteFinca';
import { generarPdfReporte, nombreArchivoReporte } from '@/lib/reportePdf';

type Vinculo = {
  id: string; finca_id: string; auth_user_id: string; created_at: string;
  membresias: { nombre: string; rol: string } | null;
  fincas: { nombre: string } | null;
};

const AYUDA_DUENO = '<b>Comandos</b>\n/resumen — reporte de los últimos 7 días\n\nCada lunes a las 6 a.m. le llega el reporte semanal.';
const AYUDA_TRABAJADOR = 'Este bot envía el reporte semanal al propietario y al administrador de la finca.';

export async function POST(request: Request) {
  const secret = webhookSecret();
  if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await request.json().catch(() => null) as TgUpdate | null;
  const msg = update?.message;
  if (!msg?.text || msg.chat.type !== 'private') return Response.json({ ok: true });

  try {
    await manejar(msg.chat.id, msg.text.trim(), msg.from?.username ?? null);
  } catch (e) {
    console.error('telegram webhook', e);
    await enviarMensaje(msg.chat.id, 'Hubo un error procesando su mensaje. Intente de nuevo en un momento.');
  }
  // Siempre 200 para que Telegram no reintente en bucle.
  return Response.json({ ok: true });
}

async function manejar(chatId: number, texto: string, username: string | null) {
  const admin = getSupabaseAdmin();
  const [cmdRaw, ...args] = texto.split(/\s+/);
  const cmd = cmdRaw.toLowerCase().replace(/@\w+$/, '');

  if (cmd === '/start') {
    if (!args[0]) {
      await enviarMensaje(chatId, 'Hola 👋 Para conectar este chat, abra Ganado al Día → Ajustes → <b>Conectar Telegram</b>.');
      return;
    }
    const { data: c } = await admin.from('telegram_codigos')
      .select('codigo, membresia_id, expira_at, usado_at, membresias(id, finca_id, auth_user_id, nombre, rol, fincas(nombre))')
      .eq('codigo', args[0]).maybeSingle();
    const m = c?.membresias as unknown as { id: string; finca_id: string; auth_user_id: string; nombre: string; rol: string; fincas: { nombre: string } | null } | null;
    if (!c || !m || c.usado_at || new Date(c.expira_at) < new Date()) {
      await enviarMensaje(chatId, 'Este enlace ya se usó o venció. Genere uno nuevo en Ganado al Día → Ajustes → Conectar Telegram.');
      return;
    }
    const recibe = m.rol === 'owner' || m.rol === 'admin';
    const { error } = await admin.from('telegram_vinculos').upsert({
      membresia_id: m.id, finca_id: m.finca_id, auth_user_id: m.auth_user_id,
      chat_id: chatId, telegram_username: username, recibir_reportes: recibe, activo: true,
      created_at: new Date().toISOString(),
    }, { onConflict: 'membresia_id' });
    if (error) throw error;
    await admin.from('telegram_codigos').update({ usado_at: new Date().toISOString() }).eq('codigo', c.codigo);
    await enviarMensaje(chatId, [
      `✅ Listo, ${esc(m.nombre)}. Este chat quedó conectado a <b>${esc(m.fincas?.nombre ?? 'su finca')}</b>.`,
      '', recibe ? AYUDA_DUENO : AYUDA_TRABAJADOR,
    ].join('\n'));
    return;
  }

  const { data: vincs } = await admin.from('telegram_vinculos')
    .select('id, finca_id, auth_user_id, created_at, membresias(nombre, rol), fincas(nombre)')
    .eq('chat_id', chatId).eq('activo', true).order('created_at', { ascending: false });
  const vinculos = (vincs ?? []) as unknown as Vinculo[];
  if (!vinculos.length) {
    await enviarMensaje(chatId, 'Este chat no está conectado. Abra Ganado al Día → Ajustes → <b>Conectar Telegram</b>.');
    return;
  }
  const esDueno = (v: Vinculo) => v.membresias?.rol === 'owner' || v.membresias?.rol === 'admin';

  if (cmd === '/resumen') {
    const propias = vinculos.filter(esDueno);
    if (!propias.length) {
      await enviarMensaje(chatId, 'El resumen solo está disponible para el propietario o administrador de la finca.');
      return;
    }
    const hasta = hoyBogota();
    const desde = sumarDias(hasta, -6);
    for (const v of propias) {
      const { data, error } = await admin.rpc('reporte_finca', { p_finca_id: v.finca_id, p_desde: desde, p_hasta: hasta });
      if (error) throw error;
      const r = data as ReporteFinca;
      await enviarMensaje(chatId, formatearReporte(r, 'Últimos 7 días'));
      await enviarDocumento(chatId, generarPdfReporte(r, 'Últimos 7 días'), nombreArchivoReporte(r), '📄 Reporte en PDF');
    }
    return;
  }

  await enviarMensaje(chatId, vinculos.some(esDueno) ? AYUDA_DUENO : AYUDA_TRABAJADOR);
}
