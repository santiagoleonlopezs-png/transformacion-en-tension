# Transformación en tensión

Experiencia del Laboratorio de Aprendizaje y Decisión — HACERLO.

Se conservan las cuatro situaciones, las siete dimensiones de McKinsey, las ocho palancas culturales y sus efectos, la pertinencia contextual, las sinergias y la fatiga por sobreintervención.

## Uso

1. En **Acceso facilitador**, crear una sala con nombre y código.
2. Compartir la invitación (incluye código y enlace) o el QR de 180 px.
3. Los equipos entran con el código y un nombre. Se guarda su acceso en el navegador para retomar la partida.
4. El facilitador ve los equipos y sus decisiones con actualización automática cada cuatro segundos. Puede filtrar por equipo/ronda y descargar todas las decisiones en CSV.
5. En **Guardar acceso privado**, copiar la clave para recuperar el panel desde otro navegador. Esa clave no forma parte de la invitación pública.

El ingreso puede cerrarse y reabrirse; los equipos que ya entraron conservan su acceso y pueden terminar.

## Presupuesto y resultado

El saldo inicial es de 120 créditos para las cuatro rondas. Se permite gastar por encima del saldo disponible. Los números negativos se muestran en rojo y no bloquean las intervenciones.

El puntaje base conserva los pesos originales: Cultura Agile 50 %, coherencia 40 % y presupuesto disponible 10 %. El componente de presupuesto tiene un mínimo de cero. A ese resultado se resta `min(50, round(deuda × 0.4))`, con un puntaje final mínimo de cero. La vista de selección anticipa costo, saldo, deuda y penalización.

## Datos y acceso

- `config.js` contiene únicamente la URL y la clave publicable de Supabase.
- `database/rooms.sql` instala las tablas privadas y la RPC `public.tension_api` en un proyecto nuevo. Ya se aplicó en el proyecto conectado; no volver a ejecutarlo sobre las tablas existentes.
- Las tablas `tension_private` tienen RLS, políticas explícitas de denegación y permisos directos revocados para clientes.
- Cada sala/equipo usa una capacidad aleatoria de 256 bits, generada con Web Crypto. La base de datos guarda solo SHA-256. La autorización se verifica dentro de la RPC; el código de sala nunca autoriza el panel del facilitador ni las decisiones privadas.
- La función privilegiada está en un esquema privado, usa `search_path` vacío y tiene permisos de ejecución limitados. Las funciones auxiliares no son ejecutables por clientes. La envoltura pública usa `SECURITY INVOKER`.
- El servidor aplica los costos, efectos y puntuación; no acepta puntajes ni historiales enviados por el cliente. Registra fecha, justificación, palancas, consecuencias, deuda y diagnóstico antes/después.
- Cada decisión es idempotente y usa bloqueo de fila. El servidor conserva el plazo de la ronda para evitar que recargar reponga el tiempo. Los borradores se conservan localmente hasta que el servidor confirma el guardado.
- El ranking público devuelve resultados y nombres de equipos, sin justificaciones, claves ni diagnósticos privados.
- Los registros anteriores en `public.game_results` se conservaron sin modificaciones. Las nuevas salas usan el esquema privado; el historial anterior no se reasigna a nuevos propietarios.

## Validación

```sh
npm ci
npm test
```

`database/verify.sql` debe ejecutarse dentro de `BEGIN; … ROLLBACK;` para verificar la base real sin conservar equipos ni salas de prueba. Cubre deuda, cuatro rondas, reintentos, privacidad, cierre/reapertura, recuperación y tiempo agotado.

`tests/server-fixtures.json` contiene únicamente equipos de prueba generados por el servidor en una transacción revertida. Permite contrastar el cálculo del navegador con el servidor y probar la interfaz sin escribir datos reales. Las pruebas de interfaz usan un DOM simulado; no sustituyen una revisión visual en un navegador.

La aplicación es estática y se publica con GitHub Pages. QRCode.js 1.0.0 se incluye localmente con su licencia MIT; las invitaciones no se envían a un generador de QR externo.
