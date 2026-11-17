# Soporte al cliente con IA

Asistente que responde a clientes (dentro de la app) y a interesados (landing, enlace de WhatsApp), con Claude y una base de conocimiento propia.

## Dónde aparece
- **App**: botón verde "Ayuda" abajo a la derecha. Si el cliente tiene sesión, la conversación queda marcada como de cliente.
- **Página pública** `/soporte`: para poner el enlace en la bio de WhatsApp, Instagram o en correos.
- **Landing u otra web**: pegar antes de `</body>`:
  ```html
  <script src="https://SU-DOMINIO-DE-LA-APP/soporte-widget.js" defer></script>
  ```
  Opcional: `data-texto="¿Dudas?"` y `data-color="#15A34A"`.

## Qué hace
- Responde con la información de `src/lib/soporte/conocimiento.ts` (precios, prueba, kit RFID, funciones, preguntas frecuentes). **Para cambiar lo que sabe, edite ese archivo.**
- `registrar_lead`: cuando un interesado quiere empezar o pide cotización, guarda nombre, WhatsApp, país, número de animales y plan en `agrosense.soporte_leads` y avisa al equipo por Telegram.
- `escalar_a_humano`: pagos, fallas que no se resuelven, enojo o preguntas fuera de la base. Marca la conversación y avisa por Telegram; el chat muestra el botón de WhatsApp.
- Guarda cada conversación y los tokens usados en `agrosense.soporte_conversaciones` / `soporte_mensajes`.

## Variables de entorno (Vercel)
| Variable | Obligatoria | Para qué |
|---|---|---|
| `OPENROUTER_API_KEY` | Una de las dos | Llave de OpenRouter (openrouter.ai/keys). Si existe, el chat usa OpenRouter con `anthropic/claude-opus-5.5`. |
| `ANTHROPIC_API_KEY` | Una de las dos | Llave directa de la API de Claude (console.anthropic.com). Se usa si no hay llave de OpenRouter. |
| `SOPORTE_WHATSAPP` | Recomendada | Número de WhatsApp del asesor con indicativo, ej. `+57 300 123 4567`. |
| `SOPORTE_TELEGRAM_CHAT_ID` | Recomendada | Chat de Telegram donde llegan los avisos de leads y escalamientos (usa `TELEGRAM_BOT_TOKEN`). |
| `SOPORTE_MODELO` | No | Modelo. Por defecto `anthropic/claude-opus-5.5` (OpenRouter) o `claude-opus-5-5` (Anthropic), con esfuerzo bajo. Más barato: `anthropic/claude-haiku-5.5` / `claude-haiku-5-5`. |
| `SOPORTE_ORIGENES_PERMITIDOS` | No | Solo si otra web llama la API directamente (no hace falta para el widget, que usa un iframe). |

## Límites para controlar costos
8 mensajes por minuto por IP, 1.500 caracteres por mensaje, 20 turnos de historial y 40 mensajes por conversación. La base de conocimiento va en caché de prompts.

## Base de datos
Migración `supabase/migrations/20261117000800_agrosense_soporte_ia.sql` (solo esquema `agrosense`). Sin aplicarla el chat funciona, pero no guarda historial ni leads (sí avisa por Telegram).

## Siguiente fase
WhatsApp directo (que el asistente conteste dentro de WhatsApp) requiere la API de WhatsApp Business de Meta con número verificado; la misma función `responder()` sirve para conectarlo.
