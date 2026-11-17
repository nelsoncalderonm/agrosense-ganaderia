# Bot de Telegram, reportes semanales y lluvia

## Qué hace
- **Vincular:** en Ajustes → *Conectar Telegram* se genera un enlace de un solo uso (`t.me/<bot>?start=<código>`, vence en 30 min). Al tocar *Iniciar* el chat queda ligado a la membresía (persona + finca).
- **Reporte semanal:** cron de Vercel los lunes 11:00 UTC (6 a.m. Colombia). Cubre la semana anterior (lunes a domingo): producción (pesajes, GDP vs. semana anterior, kilos ganados, mejores y peores), inventario y movimientos, lluvia (semana, mes, promedio de 12 semanas) y mano de obra por persona (pesajes, sesiones, tareas de agenda completadas, registros de lluvia). Lo reciben los vínculos con `recibir_reportes` (por defecto propietario y administrador).
- **Comandos:** `/lluvia 12`, `/lluvia 8 ayer`, `/lluvia 5 2026-11-10`, `/resumen` (propietario/administrador, últimos 7 días), `/ayuda`.
- **Recordatorio de lluvia:** cron diario 13:00 UTC (8 a.m. Colombia) a vaqueros y administradores si la finca no tiene sensor activo y nadie anotó la lluvia del día.
- **Lluvia en la app:** tarjeta en Ajustes para anotar milímetros y ver 7 días / mes / promedio semanal.

Todo el cálculo está en la función SQL `agrosense.reporte_finca(finca, desde, hasta)`; `src/lib/reporteFinca.ts` solo le da formato.

## Configuración (una sola vez)
1. En Telegram, hablarle a **@BotFather** → `/newbot` → nombre (ej. *AgroSense*) y usuario (ej. `AgroSenseFincaBot`). Copiar el token.
2. En Vercel → Settings → Environment Variables (Production):
   - `TELEGRAM_BOT_TOKEN` = el token
   - `CRON_SECRET` = una cadena aleatoria larga (Vercel la usa para firmar los crons)
   - Opcionales: `TELEGRAM_BOT_USERNAME` (si no, se consulta con getMe), `TELEGRAM_WEBHOOK_SECRET` (si no, se deriva del token).
3. Redeploy de producción. El webhook se registra solo la primera vez que alguien toca *Conectar Telegram* en producción (los deploys de preview no lo tocan).

## Sensores de lluvia (fase 2)
Tabla `agrosense.sensores_lluvia` (proveedor `ecowitt` | `lorawan` | `davis` | `otro`). Las lecturas van a `lluvia_registros` con `fuente = 'sensor'` y `sensor_id`; si un día tiene dato de sensor, el reporte usa ese en lugar del manual. Las llaves de API del proveedor van en variables de entorno, nunca en la tabla.
- Recomendado: Ecowitt WH40 + gateway GW1100 (WiFi, API en api.ecowitt.net).
- Sin WiFi: pluviómetro de balancín LoRaWAN (Dragino / Milesight) + gateway.
