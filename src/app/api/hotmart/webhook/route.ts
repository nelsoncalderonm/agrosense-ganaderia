import { createHash, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { appUrl, crearOrganizacionCliente, invitarOEncontrarUsuario } from '@/lib/server/clientes';

// Webhook de Hotmart (versión 2.0.0). Configúralo en Hotmart → Herramientas → Webhook
// apuntando a https://<tu-dominio>/api/hotmart/webhook, y copia el "Hottok" a la
// variable de entorno HOTMART_HOTTOK.
//
// Responde 200 cuando el aviso quedó procesado (o ya lo estaba) y 500 si algo falló,
// para que Hotmart lo reintente. Cada aviso se guarda en agrosense.hotmart_eventos.

type Estado = 'activa' | 'atrasada' | 'cancelada' | 'reembolsada';

const ESTADO_POR_EVENTO: Record<string, Estado> = {
  PURCHASE_APPROVED: 'activa',
  PURCHASE_COMPLETE: 'activa',
  PURCHASE_DELAYED: 'atrasada',
  PURCHASE_CANCELED: 'cancelada',
  SUBSCRIPTION_CANCELLATION: 'cancelada',
  PURCHASE_REFUNDED: 'reembolsada',
  PURCHASE_CHARGEBACK: 'reembolsada',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Payload = { id?: string; event?: string; hottok?: string; creation_date?: number; data?: any };

function hottokValido(recibido: string | null | undefined): boolean {
  const esperado = process.env.HOTMART_HOTTOK;
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function fecha(ms: unknown): string | null {
  const n = typeof ms === 'string' ? Number(ms) : ms;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null;
}

function extraer(p: Payload) {
  const d = p.data ?? {};
  const buyer = d.buyer ?? d.subscriber ?? {};
  const subscriber = d.subscription?.subscriber ?? d.subscriber ?? {};
  const transaccion: string | null = d.purchase?.transaction ?? null;
  const subscriberCode: string | null = subscriber.code ?? null;
  return {
    email: (buyer.email ?? subscriber.email ?? '').trim().toLowerCase() as string,
    nombre: (buyer.name ?? subscriber.name ?? '').trim() as string,
    telefono: (buyer.checkout_phone ?? buyer.phone ?? subscriber.phone ?? null) as string | null,
    productId: d.product?.id != null ? String(d.product.id) : null,
    planNombre: (d.subscription?.plan?.name ?? null) as string | null,
    planId: d.subscription?.plan?.id != null ? String(d.subscription.plan.id) : null,
    transaccion,
    // Clave estable de la suscripción. Una compra sin recurrencia usa su transacción.
    clave: subscriberCode ?? (transaccion ? `tx:${transaccion}` : null),
    proximoCobro: fecha(d.purchase?.date_next_charge ?? d.date_next_charge),
    fechaCompra: fecha(d.purchase?.approved_date ?? d.purchase?.order_date),
  };
}

export async function POST(request: Request) {
  const raw = await request.text();
  let payload: Payload;
  try { payload = JSON.parse(raw); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  if (!hottokValido(request.headers.get('x-hotmart-hottok') ?? payload.hottok)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return Response.json({ error: 'Servidor mal configurado' }, { status: 500 }); }

  const evento = payload.event ?? 'DESCONOCIDO';
  const eventoId = payload.id ?? createHash('sha256').update(raw).digest('hex');

  // Idempotencia: si ya se procesó este aviso, no se repite.
  const { data: previo } = await admin.from('hotmart_eventos').select('procesado').eq('id', eventoId).maybeSingle();
  if (previo?.procesado) return Response.json({ ok: true, repetido: true });
  if (!previo) {
    const { error } = await admin.from('hotmart_eventos').insert({ id: eventoId, evento, payload });
    if (error && error.code !== '23505') return Response.json({ error: error.message }, { status: 500 });
  }

  try {
    const resultado = await procesar(admin, evento, payload, request);
    await admin.from('hotmart_eventos').update({ procesado: true, error: null }).eq('id', eventoId);
    return Response.json({ ok: true, ...resultado });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from('hotmart_eventos').update({ error: msg }).eq('id', eventoId);
    return Response.json({ error: msg }, { status: 500 });
  }
}

async function procesar(admin: ReturnType<typeof getSupabaseAdmin>, evento: string, payload: Payload, request: Request) {
  const estado = ESTADO_POR_EVENTO[evento];
  if (!estado) return { ignorado: evento };

  const x = extraer(payload);
  if (!x.clave) throw new Error('El aviso no trae código de suscriptor ni transacción');

  // Plan: por producto (y por nombre de plan si hay varios planes del mismo producto).
  let planId: string | null = null;
  if (x.productId) {
    const { data: planes } = await admin.from('planes').select('id, hotmart_plan_codigo')
      .eq('hotmart_product_id', x.productId).eq('activo', true);
    const lista = (planes ?? []) as { id: string; hotmart_plan_codigo: string | null }[];
    // El plan de Hotmart se reconoce por su nombre (sin importar mayúsculas ni tildes) o por su id.
    const buscados = [x.planNombre, x.planId].filter(Boolean).map(v => normalizar(String(v)));
    planId = (lista.find(p => p.hotmart_plan_codigo && buscados.includes(normalizar(p.hotmart_plan_codigo)))
      ?? lista.find(p => !p.hotmart_plan_codigo) ?? (lista.length === 1 ? lista[0] : undefined))?.id ?? null;
  }

  const { data: existente } = await admin.from('suscripciones')
    .select('id, organizacion_id, estado, comprador_email, comprador_nombre')
    .eq('hotmart_subscriber_code', x.clave).maybeSingle();

  const ahora = new Date().toISOString();
  const cambios: Record<string, unknown> = {
    estado,
    ultimo_evento: evento,
    hotmart_product_id: x.productId,
    ...(x.transaccion ? { hotmart_transaccion: x.transaccion } : {}),
    ...(x.proximoCobro ? { proximo_cobro: x.proximoCobro } : {}),
    ...(planId ? { plan_id: planId } : {}),
    ...(estado === 'activa' && !existente ? { fecha_inicio: x.fechaCompra ?? ahora } : {}),
    ...(estado === 'cancelada' || estado === 'reembolsada' ? { cancelada_en: ahora } : {}),
  };

  let suscripcionId: string;
  let organizacionId: string | null = existente?.organizacion_id ?? null;
  const email = x.email || existente?.comprador_email || '';
  const nombre = x.nombre || existente?.comprador_nombre || email.split('@')[0];

  if (existente) {
    const { error } = await admin.from('suscripciones').update(cambios).eq('id', existente.id);
    if (error) throw new Error(error.message);
    suscripcionId = existente.id;
  } else {
    if (!email) throw new Error('El aviso no trae el correo del comprador');
    const { data, error } = await admin.from('suscripciones').insert({
      ...cambios, hotmart_subscriber_code: x.clave, comprador_email: email, comprador_nombre: nombre || null,
    }).select('id').single();
    if (error || !data) throw new Error(error?.message ?? 'No se pudo guardar la suscripción');
    suscripcionId = data.id;
  }

  // Compra aprobada y aún sin cliente: crear la cuenta y enviar la invitación.
  let invitado = false;
  if (estado === 'activa' && !organizacionId) {
    const { userId, invitado: inv } = await invitarOEncontrarUsuario(admin, email, nombre, `${appUrl(request)}/`);
    invitado = inv;
    organizacionId = await crearOrganizacionCliente(admin, {
      nombre: nombre ? `Ganadería ${nombre}` : email,
      email, contactoNombre: nombre, telefono: x.telefono, origen: 'hotmart',
    }, userId);
    const { error } = await admin.from('suscripciones').update({ organizacion_id: organizacionId }).eq('id', suscripcionId);
    if (error) throw new Error(error.message);
  }

  return { estado, suscripcion_id: suscripcionId, organizacion_id: organizacionId, invitado };
}
