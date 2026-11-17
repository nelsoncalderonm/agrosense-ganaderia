# Modo sin señal

AgroSense funciona en la manga sin internet. Lo que se registra queda en el celular y se envía solo cuando vuelve la señal.

## Cómo funciona

1. **App instalable (PWA).** `src/app/manifest.ts` + `public/sw.js`. El service worker guarda la página y los archivos de la app; sin señal abre la última copia. Solo se registra en producción.
2. **Copia local de datos.** Cada vez que la app descarga una finca, la guarda en el celular (`src/lib/offline/copias.ts`). Sin señal muestra esa copia y avisa la fecha.
3. **Cola local.** Pesajes, altas de animales (compra y nacimiento), ventas, bajas, traslados, eventos sanitarios y gastos pasan por `src/lib/offline/acciones.ts`. Cada registro se guarda primero en IndexedDB con un id único y la hora real del celular.
4. **Sincronización.** `src/lib/offline/sincronizar.ts` envía la cola en orden a `agrosense.sync_aplicar` al abrir la app, al volver la señal, al volver a la pantalla y cada minuto. Con señal, el formulario recibe la respuesta al instante como antes.
5. **Lo pendiente se ve de inmediato.** `proyeccion.ts` aplica la cola sobre la lista de animales: un animal creado sin señal se puede buscar por arete y pesar enseguida.

## Reglas de conflicto (en la base)

- **Sin duplicados:** `sync_operaciones` guarda el id de cada registro. Si llega dos veces, se responde lo mismo sin aplicarlo de nuevo.
- **Mismo arete registrado en dos celulares:** es el mismo animal. El segundo se une al primero y sus pesajes van al animal existente (`resolver_animal`).
- **Pesaje viejo que llega tarde:** no pisa el peso actual; se corrige la GDP del pesaje siguiente.
- **Pesaje el mismo día del ingreso:** no calcula GDP (antes daba valores absurdos).
- **No se puede aplicar** (animal ya vendido, rol sin permiso, fecha del celular adelantada): queda como "conflicto". Nada se pierde. Se revisa tocando la barra de arriba: descartar o intentar de nuevo. Owner/admin ven también los conflictos de otros celulares.

## Sesión sin señal

Si el token vence sin internet, la app usa la sesión guardada solo para mostrar los datos locales. La sincronización espera a que Supabase renueve la sesión. El primer inicio de sesión sí necesita internet.

## App nativa (Capacitor)

Todo el almacenamiento está en `src/lib/offline/almacen.ts`. IndexedDB funciona dentro de Capacitor; si se quiere SQLite nativo, se cambia solo ese archivo.

## Pendiente

- Campos para Sinigán (RUV del predio, número oficial del animal, fecha de nacimiento) y armar la lista de una guía leyendo chapetas sin señal: el formato de la cola ya lo permite, falta el formulario.
- Ver los eventos sanitarios en la ficha del animal.
- Ícono definitivo cuando se decida el nombre.
