# Bot de Telegram y reportes semanales

## Qué hace
- **Vincular:** en Ajustes → *Conectar Telegram* se genera un enlace de un solo uso (`t.me/<bot>?start=<código>`, vence en 30 min). Al tocar *Iniciar* el chat queda ligado a la membresía (persona + finca).
- **Reporte semanal:** cron de Vercel los lunes 11:00 UTC (6 a.m. Colombia). Cubre la semana anterior (lunes a domingo): producción (pesajes, GDP vs. semana anterior, kilos ganados, mejores y peores), inventario y movimientos, y mano de obra por persona (pesajes, sesiones, tareas de agenda completadas). Lo reciben los vínculos con `recibir_reportes` (por defecto propietario y administrador).
- **Comandos:** `/resumen` (propietario/administrador, últimos 7 días), `/ayuda`.

Todo el cálculo está en la función SQL `agrosense.reporte_finca(finca, desde, hasta)`; `src/lib/reporteFinca.ts` solo le da formato.

## Configuración (una sola vez)
1. En Telegram, hablarle a **@BotFather** → `/newbot` → nombre (ej. *Ganado al Día*) y usuario (ej. `GanadoAlDiaBot`). Copiar el token.
2. En Vercel → Settings → Environment Variables (Production):
   - `TELEGRAM_BOT_TOKEN` = el token
   - `CRON_SECRET` = una cadena aleatoria larga (Vercel la usa para firmar los crons)
   - Opcionales: `TELEGRAM_BOT_USERNAME` (si no, se consulta con getMe), `TELEGRAM_WEBHOOK_SECRET` (si no, se deriva del token).
3. Redeploy de producción. El webhook se registra solo la primera vez que alguien toca *Conectar Telegram* en producción (los deploys de preview no lo tocan).
