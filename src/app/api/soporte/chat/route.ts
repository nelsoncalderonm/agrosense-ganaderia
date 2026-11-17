import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { contarMensajes, responder, type Origen, type Turno } from '@/lib/soporte/asistente';

// Chat de soporte con IA para clientes (desde la app) y prospectos (landing / WhatsApp).
// POST { mensajes: [{rol, texto}], conversacionId?, origen?, visitanteId? }
// Si viene "Authorization: Bearer <token de Supabase>", se marca como cliente.

const MAX_TURNOS = 20;              // historial que se envía al modelo
const MAX_CARACTERES = 1500;        // por mensaje
const MAX_MENSAJES_CONVERSACION = 40;
const LIMITE_POR_MINUTO = 8;        // por IP (mejor esfuerzo: memoria de la instancia)

const ORIGENES: Origen[] = ['app', 'landing', 'web', 'whatsapp', 'telegram'];
const visitasPorIp = new Map<string, number[]>();

function origenesPermitidos(): string[] {
  return (process.env.SOPORTE_ORIGENES_PERMITIDOS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const permitidos = origenesPermitidos();
  if (!origin || !(permitidos.includes('*') || permitidos.includes(origin))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    Vary: 'Origin',
  };
}

function json(request: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

function limitar(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (visitasPorIp.get(ip) ?? []).filter((t) => ahora - t < 60_000);
  recientes.push(ahora);
  visitasPorIp.set(ip, recientes);
  if (visitasPorIp.size > 5000) visitasPorIp.clear();
  return recientes.length > LIMITE_POR_MINUTO;
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return json(request, { error: 'El soporte con IA no está configurado (falta OPENROUTER_API_KEY o ANTHROPIC_API_KEY).' }, 503);
  }

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconocida';
  if (limitar(ip)) {
    return json(request, { error: 'Demasiados mensajes seguidos. Espere un momento e intente de nuevo.' }, 429);
  }

  const body = (await request.json().catch(() => null)) as {
    mensajes?: { rol?: string; texto?: string }[];
    conversacionId?: string | null;
    origen?: string;
    visitanteId?: string | null;
  } | null;
  if (!body || !Array.isArray(body.mensajes) || body.mensajes.length === 0) {
    return json(request, { error: 'Falta el mensaje.' }, 400);
  }

  const historial: Turno[] = body.mensajes
    .slice(-MAX_TURNOS)
    .filter((m) => (m.rol === 'user' || m.rol === 'assistant') && typeof m.texto === 'string' && m.texto.trim())
    .map((m) => ({ rol: m.rol as Turno['rol'], texto: (m.texto as string).trim().slice(0, MAX_CARACTERES) }));
  // El primer turno debe ser del usuario y el último también.
  while (historial.length && historial[0].rol !== 'user') historial.shift();
  if (!historial.length || historial[historial.length - 1].rol !== 'user') {
    return json(request, { error: 'El último mensaje debe ser del usuario.' }, 400);
  }

  // Cliente con sesión en la app: se valida el token con Supabase.
  let authUserId: string | null = null;
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (token) {
    try {
      const { data } = await getSupabaseAdmin().auth.getUser(token);
      authUserId = data.user?.id ?? null;
    } catch {
      authUserId = null;
    }
  }

  let origen: Origen = ORIGENES.includes(body.origen as Origen) ? (body.origen as Origen) : 'web';
  if (origen === 'app' && !authUserId) origen = 'web';

  const conversacionId = typeof body.conversacionId === 'string' && /^[0-9a-f-]{36}$/i.test(body.conversacionId)
    ? body.conversacionId
    : null;
  if ((await contarMensajes(conversacionId)) >= MAX_MENSAJES_CONVERSACION) {
    return json(request, {
      error: 'Esta conversación ya es muy larga. Escríbanos por WhatsApp y un asesor le atiende.',
    }, 429);
  }

  try {
    const resultado = await responder({
      historial,
      origen,
      conversacionId,
      authUserId,
      visitanteId: typeof body.visitanteId === 'string' ? body.visitanteId.slice(0, 64) : null,
    });
    return json(request, resultado);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json(request, { error: 'Estamos atendiendo muchas consultas. Intente en un minuto.' }, 429);
    }
    if (error instanceof Anthropic.APIError) {
      console.error('[soporte] error de la API de Claude', error.status, error.message);
    } else {
      console.error('[soporte] error inesperado', error);
    }
    return json(request, { error: 'No pudimos responder ahora. Intente de nuevo o escríbanos por WhatsApp.' }, 502);
  }
}
