# Tablero en el televisor

Pantalla completa para el televisor de la casa o la oficina de la finca: `/tv`.

## Conectar un televisor
1. Abrir `/tv` en el navegador del Smart TV (o en un Fire TV / Android TV / computador conectado al televisor).
2. Sale un código de 6 letras y un QR. El código cambia solo cada 15 minutos.
3. En el celular, el dueño o el administrador va a **Ajustes → Tablero en el televisor** y escribe el código
   (o escanea el QR, que abre la app con el código puesto).
4. El televisor guarda su token y queda conectado aunque se apague.

**Chromecast:** no tiene navegador. Use "Crear enlace para Chromecast o Fire TV" y abra ese enlace en Chrome
del computador o del celular y transmita la pestaña / la pantalla. Quien tenga el enlace puede ver el tablero;
se desactiva con "Desconectar este televisor".

## Control remoto
- ← / → cambian de panel. OK (Enter) pone pantalla completa.
- La pantalla pide no apagarse (Wake Lock) donde el navegador lo permite.

## Datos
`GET /api/tv/datos` (header `x-tv-token`) calcula todo en el servidor con la llave de servicio, solo para la finca
del televisor. Se actualiza cada 5 minutos; sin internet sigue mostrando los últimos datos con un aviso.

| Panel | Fuente |
|---|---|
| Resumen | `animales` activos; valor = kg × `fincas.precio_kg` (PR #12) |
| Engorde | `animales.gdp` y `pesajes.gdp_calculado` por semana (8 semanas) |
| Listos para vender | `fincas.meta_peso_kg` (PR #12, 480 kg si no existe) y días de retiro de `eventos_sanitarios` (PR #12) |
| No están engordando | GDP < 400 g/día, igual que el reporte semanal (PR #7/#13) |
| Ventas y bajas | `animal_eventos` tipo venta (igual que el reporte semanal) y `bajas`, últimos 30 días |
| Clima | Open-Meteo con `fincas.latitud/longitud` (PR #14). Con `OPEN_METEO_API_KEY` usa el servidor comercial |
| Tareas | `eventos` sin completar: vencidas, hoy y próximos 7 días |

Si las columnas de los PRs #12 y #14 todavía no existen, el panel muestra un mensaje en vez de fallar.

## Base de datos
Migración `20261117001100_agrosense_tablero_tv.sql`: tabla `agrosense.pantallas_tv` (token guardado como sha256,
código, paneles, segundos por panel, tema). RLS: solo dueño/administrador ven y editan sus televisores; desde el
celular solo se pueden cambiar nombre, paneles, segundos y tema.
