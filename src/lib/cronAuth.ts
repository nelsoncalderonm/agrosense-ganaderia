import 'server-only';

// Vercel Cron envía "Authorization: Bearer <CRON_SECRET>" cuando la variable existe.
export function cronAutorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}
