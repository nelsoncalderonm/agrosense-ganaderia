import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SYSTEM_PROMPT } from './conocimiento';

// Modelo configurable por variable de entorno (SOPORTE_MODELO).
// Por defecto Claude Opus 5.5 con esfuerzo bajo: respuestas cortas de soporte.
const MODELO = process.env.SOPORTE_MODELO || 'claude-opus-5-5';
const MAX_PASOS_HERRAMIENTAS = 3;

export type Origen = 'app' | 'landing' | 'web' | 'whatsapp' | 'telegram';
export type Turno = { rol: 'user' | 'assistant'; texto: string };

export type ResultadoSoporte = {
  respuesta: string;
  conversacionId: string | null;
  escalada: boolean;
  leadRegistrado: boolean;
  whatsappUrl: string | null;
};

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropic) anthropic = new Anthropic(); // lee ANTHROPIC_API_KEY
  return anthropic;
}

const HERRAMIENTAS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'registrar_lead',
    description:
      'Guarda los datos de contacto de una persona interesada en AgroSense para que un asesor la contacte. ' +
      'Úsela cuando la persona quiera empezar, pida cotización, pregunte por el kit RFID, el plan Empresarial o el programa de embajadores, ' +
      'y ya haya dado al menos su nombre y su WhatsApp (o correo).',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['nombre', 'whatsapp', 'email', 'pais', 'animales', 'plan_interes', 'interes_kit_rfid', 'notas'],
      properties: {
        nombre: { type: 'string', description: 'Nombre de la persona.' },
        whatsapp: { type: ['string', 'null'], description: 'Número de WhatsApp con indicativo del país, si lo dio.' },
        email: { type: ['string', 'null'], description: 'Correo, si lo dio.' },
        pais: { type: ['string', 'null'], description: 'País de la finca.' },
        animales: { type: ['integer', 'null'], description: 'Número aproximado de animales.' },
        plan_interes: {
          type: ['string', 'null'],
          enum: ['prueba', 'finca', 'ceba_pro', 'empresarial', 'embajador', null],
          description: 'Plan o programa que le interesa.',
        },
        interes_kit_rfid: { type: ['boolean', 'null'], description: 'Si preguntó por el kit RFID.' },
        notas: { type: ['string', 'null'], description: 'Resumen en una o dos frases de lo que necesita.' },
      },
    },
  },
  {
    name: 'escalar_a_humano',
    description:
      'Pasa la conversación a un asesor humano de AgroSense, que contactará a la persona por WhatsApp. ' +
      'Úsela si la persona lo pide, si hay un problema de pago, factura o reembolso, si la app falla y los pasos básicos no lo resuelven, ' +
      'si pregunta algo que la base de conocimiento no cubre, o si está molesta.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['motivo', 'urgente', 'contacto'],
      properties: {
        motivo: { type: 'string', description: 'Qué necesita la persona, en una o dos frases para el asesor.' },
        urgente: { type: 'boolean', description: 'true si es un cliente con la app caída o un cobro mal hecho.' },
        contacto: { type: ['string', 'null'], description: 'WhatsApp, correo o nombre que la persona haya dado, si lo dio.' },
      },
    },
  },
];

function whatsappUrl(texto: string): string | null {
  const numero = (process.env.SOPORTE_WHATSAPP || '').replace(/\D/g, '');
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

// Aviso al equipo por Telegram (reutiliza el bot de AgroSense si está configurado).
async function avisarEquipo(mensaje: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.SOPORTE_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: mensaje, disable_web_page_preview: true }),
    });
  } catch (e) {
    console.error('[soporte] no se pudo avisar por Telegram', e);
  }
}

function db() {
  try {
    return getSupabaseAdmin();
  } catch {
    return null; // sin service role: el chat funciona, pero no guarda historial
  }
}

async function asegurarConversacion(
  conversacionId: string | null,
  origen: Origen,
  authUserId: string | null,
  visitanteId: string | null,
): Promise<string | null> {
  const sb = db();
  if (!sb) return null;
  if (conversacionId) {
    const { data } = await sb.from('soporte_conversaciones').select('id').eq('id', conversacionId).maybeSingle();
    if (data) return data.id as string;
  }
  const { data, error } = await sb
    .from('soporte_conversaciones')
    .insert({ origen, auth_user_id: authUserId, visitante_id: visitanteId })
    .select('id')
    .single();
  if (error) {
    console.error('[soporte] no se pudo crear la conversación', error.message);
    return null;
  }
  return data.id as string;
}

export async function contarMensajes(conversacionId: string | null): Promise<number> {
  const sb = db();
  if (!sb || !conversacionId) return 0;
  const { data } = await sb.from('soporte_conversaciones').select('mensajes_count').eq('id', conversacionId).maybeSingle();
  return (data?.mensajes_count as number | undefined) ?? 0;
}

type Contexto = { conversacionId: string | null; origen: Origen; ultimaPregunta: string };
type EfectoHerramienta = { escalada?: boolean; motivo?: string; lead?: boolean };

async function ejecutarHerramienta(
  nombre: string,
  input: unknown,
  ctx: Contexto,
): Promise<{ texto: string; efecto: EfectoHerramienta; error?: boolean }> {
  const sb = db();
  const datos = (input ?? {}) as Record<string, unknown>;

  if (nombre === 'registrar_lead') {
    if (typeof datos.nombre !== 'string' || (!datos.whatsapp && !datos.email)) {
      return { texto: 'Faltan el nombre y un WhatsApp o correo. Pídaselos a la persona.', efecto: {}, error: true };
    }
    const lead = {
      conversacion_id: ctx.conversacionId,
      nombre: String(datos.nombre).slice(0, 120),
      whatsapp: datos.whatsapp ? String(datos.whatsapp).slice(0, 40) : null,
      email: datos.email ? String(datos.email).slice(0, 160) : null,
      pais: datos.pais ? String(datos.pais).slice(0, 60) : null,
      animales: typeof datos.animales === 'number' ? Math.round(datos.animales) : null,
      plan_interes: datos.plan_interes ? String(datos.plan_interes) : null,
      interes_kit_rfid: typeof datos.interes_kit_rfid === 'boolean' ? datos.interes_kit_rfid : null,
      notas: datos.notas ? String(datos.notas).slice(0, 500) : null,
    };
    if (sb) {
      const { error } = await sb.from('soporte_leads').insert(lead);
      if (error) console.error('[soporte] no se pudo guardar el lead', error.message);
    }
    await avisarEquipo(
      `🐂 Nuevo interesado en AgroSense (${ctx.origen})\n` +
        `Nombre: ${lead.nombre}\nWhatsApp: ${lead.whatsapp ?? '-'}\nCorreo: ${lead.email ?? '-'}\n` +
        `País: ${lead.pais ?? '-'} · Animales: ${lead.animales ?? '-'} · Plan: ${lead.plan_interes ?? '-'}` +
        `${lead.interes_kit_rfid ? ' · Quiere kit RFID' : ''}\nNotas: ${lead.notas ?? '-'}`,
    );
    return { texto: 'Datos guardados. Un asesor lo contactará por WhatsApp.', efecto: { lead: true } };
  }

  if (nombre === 'escalar_a_humano') {
    const motivo = String(datos.motivo ?? '').slice(0, 500);
    if (sb && ctx.conversacionId) {
      await sb
        .from('soporte_conversaciones')
        .update({ escalada: true, motivo_escalada: motivo })
        .eq('id', ctx.conversacionId);
    }
    await avisarEquipo(
      `${datos.urgente ? '🚨 URGENTE · ' : ''}Soporte AgroSense pide un asesor (${ctx.origen})\n` +
        `Motivo: ${motivo}\nContacto: ${datos.contacto ?? 'no lo dio'}\n` +
        `Último mensaje: "${ctx.ultimaPregunta.slice(0, 300)}"` +
        (ctx.conversacionId ? `\nConversación: ${ctx.conversacionId}` : ''),
    );
    return { texto: 'Caso pasado al equipo. Un asesor escribirá pronto.', efecto: { escalada: true, motivo } };
  }

  return { texto: `Herramienta desconocida: ${nombre}`, efecto: {}, error: true };
}

export async function responder(opts: {
  historial: Turno[];
  origen: Origen;
  conversacionId: string | null;
  authUserId: string | null;
  visitanteId: string | null;
}): Promise<ResultadoSoporte> {
  const { historial, origen, authUserId, visitanteId } = opts;
  const ultimaPregunta = historial[historial.length - 1]?.texto ?? '';
  const conversacionId = await asegurarConversacion(opts.conversacionId, origen, authUserId, visitanteId);
  const ctx: Contexto = { conversacionId, origen, ultimaPregunta };

  // El historial entre turnos viaja como texto (sin bloques de razonamiento);
  // dentro de este turno, la respuesta del modelo se devuelve tal cual en el ciclo de herramientas.
  const messages: Anthropic.Beta.BetaMessageParam[] = historial.map((t) => ({ role: t.rol, content: t.texto }));
  // Contexto operativo (fuera del prompt de sistema para no romper la caché).
  messages.push({
    role: 'system',
    content:
      origen === 'app'
        ? 'Quien escribe es un cliente con sesión iniciada en la app de AgroSense.'
        : `Quien escribe llega desde ${origen === 'whatsapp' ? 'WhatsApp' : 'la página web'} y puede ser un prospecto o un cliente.`,
  } as unknown as Anthropic.Beta.BetaMessageParam);

  let escalada = false;
  let leadRegistrado = false;
  let respuesta = '';
  let tokensEntrada = 0;
  let tokensSalida = 0;

  for (let paso = 0; paso <= MAX_PASOS_HERRAMIENTAS; paso++) {
    const res = await getAnthropic().beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: HERRAMIENTAS,
      messages,
    });
    tokensEntrada += (res.usage.input_tokens ?? 0) + (res.usage.cache_read_input_tokens ?? 0);
    tokensSalida += res.usage.output_tokens ?? 0;

    if (res.stop_reason === 'refusal') {
      respuesta = 'Disculpe, no puedo ayudarle con eso por aquí. Si es sobre AgroSense, un asesor le puede atender por WhatsApp.';
      break;
    }

    const texto = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (texto) respuesta = texto;

    const usos = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || usos.length === 0) break;

    messages.push({ role: 'assistant', content: res.content });
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const uso of usos) {
      const r = await ejecutarHerramienta(uso.name, uso.input, ctx);
      if (r.efecto.escalada) escalada = true;
      if (r.efecto.lead) leadRegistrado = true;
      resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: r.texto, is_error: r.error });
    }
    messages.push({ role: 'user', content: resultados });
  }

  if (!respuesta) {
    respuesta = escalada || leadRegistrado
      ? 'Listo. Un asesor de AgroSense le escribirá pronto por WhatsApp.'
      : 'Disculpe, no entendí bien. ¿Me lo puede contar con otras palabras?';
  }

  const sb = db();
  if (sb && conversacionId) {
    await sb.from('soporte_mensajes').insert([
      { conversacion_id: conversacionId, rol: 'user', contenido: ultimaPregunta },
      { conversacion_id: conversacionId, rol: 'assistant', contenido: respuesta },
    ]);
    const { data } = await sb
      .from('soporte_conversaciones')
      .select('mensajes_count, tokens_entrada, tokens_salida')
      .eq('id', conversacionId)
      .maybeSingle();
    await sb
      .from('soporte_conversaciones')
      .update({
        mensajes_count: (data?.mensajes_count ?? 0) + 1,
        tokens_entrada: (data?.tokens_entrada ?? 0) + tokensEntrada,
        tokens_salida: (data?.tokens_salida ?? 0) + tokensSalida,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversacionId);
  }

  return {
    respuesta,
    conversacionId,
    escalada,
    leadRegistrado,
    whatsappUrl: whatsappUrl('Hola, vengo del chat de AgroSense y necesito ayuda.'),
  };
}
