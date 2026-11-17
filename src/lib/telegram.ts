import 'server-only';
import { createHash } from 'node:crypto';

// Cliente mínimo de la API de bots de Telegram (sin dependencias).
// Variables de entorno: TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET.

export type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
};

export function telegramConfigurado(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export async function enviarMensaje(chatId: number, html: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'Falta TELEGRAM_BOT_TOKEN' };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => null) as { description?: string } | null;
  return { ok: false, error: body?.description ?? `HTTP ${res.status}` };
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- Fechas en hora de Colombia ----------

export function hoyBogota(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d); // YYYY-MM-DD
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Semana anterior completa (lunes a domingo) respecto a hoy en Colombia.
export function semanaAnterior(d = new Date()): { desde: string; hasta: string } {
  const hoy = hoyBogota(d);
  const dow = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const lunesEstaSemana = sumarDias(hoy, -((dow + 6) % 7));
  return { desde: sumarDias(lunesEstaSemana, -7), hasta: sumarDias(lunesEstaSemana, -1) };
}

export function fechaCorta(fecha: string): string {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${meses[m - 1]}`;
}

// ---------- Configuración del bot ----------


// Secreto que Telegram envía en cada llamada al webhook. Si no se define
// TELEGRAM_WEBHOOK_SECRET, se deriva del token (así solo hace falta una variable).
export function webhookSecret(): string | null {
  if (process.env.TELEGRAM_WEBHOOK_SECRET) return process.env.TELEGRAM_WEBHOOK_SECRET;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return createHash('sha256').update(`agrosense-webhook:${token}`).digest('hex').slice(0, 48);
}

async function api<T>(method: string, body?: unknown): Promise<T | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => null) as { ok: boolean; result: T } | null;
  return json?.ok ? json.result : null;
}

let usernameCache: string | null = null;
export async function botUsername(): Promise<string | null> {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, '');
  if (usernameCache) return usernameCache;
  const me = await api<{ username: string }>('getMe');
  usernameCache = me?.username ?? null;
  return usernameCache;
}

// Registra el webhook en Telegram apuntando al dominio de producción.
// Solo corre en producción para que un deploy de preview no se robe el bot.
export async function asegurarWebhook(): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production') return;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const secret = webhookSecret();
  if (!host || !secret) return;
  const url = `https://${host}/api/telegram/webhook`;
  const info = await api<{ url: string }>('getWebhookInfo');
  if (info?.url === url) return;
  await api('setWebhook', { url, secret_token: secret, allowed_updates: ['message'] });
  await api('setMyCommands', {
    commands: [
      { command: 'resumen', description: 'Reporte de los últimos 7 días' },
      { command: 'ayuda', description: 'Ver comandos' },
    ],
  });
}
