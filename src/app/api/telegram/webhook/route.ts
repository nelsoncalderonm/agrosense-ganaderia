import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { enviarMensaje, esc, hoyBogota, sumarDias, fechaCorta, webhookSecret, type TgUpdate } from '@/lib/telegram';
import { formatearReporte, type ReporteFinca } from '@/lib/reporteFinca';

type Vinculo = {
  id: string; finca_id: string; auth_user_id: string; created_at: string;
  membresias: { nombre: string; rol: string } | null;
  fincas: { nombre: string } | null;
};

const AYUDA_TRABAJADOR = [
  '<b>Comandos</b>',
  '/lluvia 12 — anota 12 mm de lluvia de hoy',
  '/lluvia 0 — no llovió',
  '/lluvia 8 ayer — anota la lluvia de ayer',
].join('\n');
const AYUDA_DUENO = AYUDA_TRABAJADOR + '\n/resumen — reporte de los últimos 7 días\n\nCada lunes a las 6 a.m. le llega el reporte semanal.';

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
      await enviarMensaje(chatId, 'Hola 👋 Para conectar este chat, abra AgroSense → Ajustes → <b>Conectar Telegram</b>.');
      return;
    }
    const { data: c } = await admin.from('telegram_codigos')
      .select('codigo, membresia_id, expira_at, usado_at, membresias(id, finca_id, auth_user_id, nombre, rol, fincas(nombre))')
      .eq('codigo', args[0]).maybeSingle();
    const m = c?.membresias as unknown as { id: string; finca_id: string; auth_user_id: string; nombre: string; rol: string; fincas: { nombre: string } | null } | null;
    if (!c || !m || c.usado_at || new Date(c.expira_at) < new Date()) {
      await enviarMensaje(chatId, 'Este enlace ya se usó o venció. Genere uno nuevo en AgroSense → Ajustes → Conectar Telegram.');
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
    await enviarMensaje(chatId, 'Este chat no está conectado. Abra AgroSense → Ajustes → <b>Conectar Telegram</b>.');
    return;
  }
  const esDueno = (v: Vinculo) => v.membresias?.rol === 'owner' || v.membresias?.rol === 'admin';

  if (cmd === '/lluvia') {
    const mm = Number((args[0] ?? '').replace(',', '.'));
    if (!args[0] || !Number.isFinite(mm) || mm < 0 || mm > 500) {
      await enviarMensaje(chatId, 'Escriba los milímetros, por ejemplo: <code>/lluvia 12</code> (o <code>/lluvia 0</code> si no llovió).');
      return;
    }
    const hoy = hoyBogota();
    let fecha = hoy;
    const f = (args[1] ?? '').toLowerCase();
    if (f === 'ayer') fecha = sumarDias(hoy, -1);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(f) && f <= hoy) fecha = f;
    // Varias fincas: la del vínculo más reciente.
    const v = vinculos[0];
    const fila = { finca_id: v.finca_id, fecha, mm: Math.round(mm * 10) / 10, fuente: 'telegram', registrado_por: v.auth_user_id };
    const { data: prev } = await admin.from('lluvia_registros').select('id')
      .eq('finca_id', v.finca_id).eq('fecha', fecha).is('sensor_id', null).maybeSingle();
    const { error } = prev
      ? await admin.from('lluvia_registros').update(fila).eq('id', prev.id)
      : await admin.from('lluvia_registros').insert(fila);
    if (error) throw error;
    await enviarMensaje(chatId, `🌧 Anotado: <b>${fila.mm} mm</b> el ${fechaCorta(fecha)} en ${esc(v.fincas?.nombre ?? 'la finca')}.${prev ? ' (Reemplazó el dato anterior.)' : ''}`);
    return;
  }

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
      await enviarMensaje(chatId, formatearReporte(data as ReporteFinca, 'Últimos 7 días'));
    }
    return;
  }

  await enviarMensaje(chatId, vinculos.some(esDueno) ? AYUDA_DUENO : AYUDA_TRABAJADOR);
}
