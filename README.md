# Transformación en tensión

Experiencia del Laboratorio de Aprendizaje y Decisión — HACERLO.

Se conservan las cuatro situaciones, las siete dimensiones de McKinsey, las ocho palancas culturales y sus efectos, la pertinencia contextual, las sinergias y la fatiga por sobreintervención.

## Uso

1. En **Acceso facilitador**, iniciar sesión con la cuenta de correo y contraseña del Laboratorio y crear una sala con nombre y código. La cuenta debe tener el permiso de facilitador de Firebase.
2. Compartir la invitación (incluye código y enlace) o el QR de 180 px.
3. Los equipos entran con el código y un nombre. Se guarda su acceso en el navegador para retomar la partida.
4. El facilitador ve los equipos y sus decisiones con actualización automática cada cuatro segundos. Puede filtrar por equipo/ronda y descargar todas las decisiones en CSV.
5. Las salas pertenecen a la cuenta: al iniciar sesión desde otro navegador aparecen en **Salas de tu cuenta**. **Cerrar sesión** elimina la información privada de la vista. Las claves de salas anteriores solo sirven para vincularlas una vez, después de autenticar a un facilitador.

El ingreso puede cerrarse y reabrirse; los equipos que ya entraron conservan su acceso y pueden terminar.

## Dinámica compartida con Nexus

Se conservan el caso de Transformación en tensión, sus cuatro situaciones, siete dimensiones 7S, ocho palancas y 120 créditos iniciales. La interfaz usa el lenguaje visual de Nexus: fondo azul profundo, acentos azules y menta, ilustración de red, tarjetas y resultados explicados.

- Diagnóstico: distribuir 100 puntos de atención en las 7S; hipótesis de 20 a 180 caracteres; objetivo y predicción por dimensión (−4 a +4).
- Selección libre de las ocho palancas, sin límite de tres ni advertencias sobre saturación antes de decidir. Los costos y el saldo se mantienen visibles. La deuda permite continuar y aparece en rojo.
- El resultado muestra pertinencia (40), diagnóstico (20), predicción (10), efecto (15), foco (10) y agilidad (5). Descuenta exceso de esfuerzo (hasta 45), acciones inoportunas (hasta 20) y demora (hasta 3). La agilidad solo suma si la pertinencia y el diagnóstico son suficientes. La ronda queda entre 0 y 100.
- Ranking: promedio de las rondas evaluadas, menos `min(50, round(deuda × 0.4))`, con mínimo cero. Las partidas antiguas sin evaluaciones nuevas conservan su fórmula original. Las decisiones antiguas no se recalculan.
- Cada palanca tiene un esfuerzo interno: arquitectura/procesos 3; liderazgo/talento/cambio 2; estrategia/cultura/espacio 1. La capacidad depende de Personas y Capacidades. El resultado explica el exceso en lenguaje cotidiano después de decidir.
- Modalidad dirigida: sala en espera, abrir/reabrir una ronda y cerrar para conversar. Reabrir conserva respuestas confirmadas y habilita a los equipos pendientes. El tiempo de conversación se excluye y reabrir no borra el tiempo de decisión acumulado.
- Modalidad autónoma: cada equipo avanza a su ritmo. No hay envío automático ni cierre por tiempo.
- El facilitador ve ranking por ronda, patrones y preguntas de reflexión; puede retirar equipos o reiniciar la sala con confirmación. El reinicio archiva equipos e historiales, invalida su acceso operativo y permite nuevos ingresos; no borra los datos archivados.
- Evolución gráfica de las 7S, feedback por decisión, ranking de resultados, enlace/QR e informe CSV. Las decisiones de otros equipos siguen siendo privadas.

## Datos y acceso

- `config.js` contiene únicamente la URL y la clave publicable de Supabase.
- En un proyecto nuevo, ejecutar primero `database/rooms.sql` y luego `database/facilitator-auth.sql`. Ambos ya están aplicados en el proyecto conectado; no repetir la instalación sobre las tablas existentes.
- Las tablas `tension_private` tienen RLS, políticas explícitas de denegación y permisos directos revocados para clientes.
- Los equipos conservan una clave aleatoria de 256 bits, generada con Web Crypto; la base de datos guarda solo SHA-256. Esa clave no concede permisos de facilitador.
- El facilitador usa Firebase Authentication (`simuladores-juegos`), con correo/contraseña y el claim firmado `facilitator: true`, igual que NEXUS. La sesión usa persistencia de sesión y permite cerrar sesión explícitamente. No se guardan contraseñas en el almacenamiento de la aplicación.
- `functions/tension-facilitator` valida en el servidor la firma RS256 del ID token contra las claves públicas de Google, el proyecto, emisor, vencimiento, fecha de autenticación y permiso de facilitador. Usa `jose` 6.2.17 fijado en `deno.json`. La verificación JWT genérica de la puerta de Supabase está desactivada porque la función verifica por sí misma los tokens de Firebase, que pertenecen a otro emisor.
- La función envía únicamente el UID verificado a la RPC `public.tension_facilitator`. Solo `service_role` puede ejecutar esa RPC; la credencial de servicio se toma del entorno de Supabase y no se envía al navegador. La base verifica la propiedad de cada sala. Las solicitudes del cliente no pueden elegir su UID autorizado.
- Se retiraron `create`, `host` y `status` de la RPC pública de participantes. Ni una clave de sala ni una sesión corriente de Supabase pueden abrir el panel del facilitador. El listado de salas se filtra por propietario en el servidor.
- Las funciones privilegiadas permanecen en un esquema privado, con `search_path` vacío y permisos limitados. Las envolturas públicas usan `SECURITY INVOKER`.
- El servidor aplica los costos, efectos y puntuación; no acepta puntajes ni historiales enviados por el cliente. Registra fecha, justificación, palancas, consecuencias, deuda y diagnóstico antes/después.
- Cada decisión es idempotente y usa bloqueo de fila. El servidor acumula el tiempo de decisión y excluye las pausas de conversación; recargar no repone el tiempo. Los borradores se conservan localmente hasta que el servidor confirma el guardado.
- El ranking público devuelve resultados y nombres de equipos, sin justificaciones, claves ni diagnósticos privados.
- Los registros anteriores en `public.game_results` se conservaron sin modificaciones. Las nuevas salas usan el esquema privado; el historial anterior no se reasigna a nuevos propietarios.

## Validación

```sh
npm ci
npm test
```

`database/nexus-dynamics.sql` actualiza la base existente de forma aditiva (una sola vez). `database/verify-nexus.sql` debe ejecutarse dentro de `BEGIN; … ROLLBACK;` para verificar la base real sin conservar equipos ni salas de prueba. Cubre ocho palancas, deuda, cuatro rondas, reintentos, privacidad, apertura dirigida, diagnóstico, tiempo y reinicio con archivo. `database/verify.sql` documenta la versión anterior con cierre automático y ya no representa la dinámica actual.

`tests/server-fixtures.json` contiene únicamente equipos de prueba generados por el servidor en una transacción revertida. Permite contrastar el cálculo del navegador con el servidor y probar la interfaz sin escribir datos reales. Las pruebas de interfaz usan un DOM simulado. El formulario de acceso también se comprobó visualmente en un navegador real; no se usaron credenciales personales de facilitadores en las pruebas.

La aplicación es estática y se publica con GitHub Pages. QRCode.js 1.0.0 se incluye localmente con su licencia MIT; las invitaciones no se envían a un generador de QR externo.

La función `tension-facilitator` ya está desplegada. Para reinstalarla, incluir los cuatro archivos de su directorio y usar `deno.json` como mapa de importación. Las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son las variables estándar del entorno de funciones de Supabase. No se requieren cambios en las reglas de Firestore para esta corrección: Firebase autentica al facilitador y la base existente sigue almacenando la simulación.
