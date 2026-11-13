# Chatbot Buyer fase 2 — panel administrativo

Rama: `feature/buyer-orientacion-interactiva`. HEAD base real conservado: `de14f0d6d921c778d90aedb28948f8f5a9403935`. Esta revisión incluye cambios locales posteriores a ese commit: fase 1 con auditoría v2 y mejoras previas de presentación. No se hizo pull, cambio de rama, reset, commit ni push. No se encontraron AGENTS.md aplicables en la ruta ni en los directorios intervenidos.

**Implementada la interfaz administrativa; pruebas con API simulada aprobadas. Pendiente aceptación visual y recorrido con proveedores reales.** No se modificaron backend, Prisma, SQL, procedimientos, cuentas, controles de acceso ni indicadores. No se ejecutaron SQL Server, Gemini, index.ts, Mart, dunning ni recuperadores.

## Archivos y alcance

- [BuyerConversationPanel.tsx](../../frontend/src/modules/buyer/components/BuyerConversationPanel.tsx): componente separado, acceso de personal, listado/historial, envío, reintento y consulta periódica de estado.
- [BuyerDetailView.tsx](../../frontend/src/modules/buyer/components/BuyerDetailView.tsx): integra el panel en la columna del agente; conserva las actividades existentes y los ajustes anteriores de preferencias/PAYER. Los turnos completados invalidan la caché Buyer (ficha y listados). Una evaluación persistida COMPLETADA/CONVERSION_LEAD con solicitud/evento invalida además LEAD heredado, `['lead','opportunities']` de la mesa comercial actual y journeys. No modifica etapas desde el cliente.
- [buyerConversation.service.ts](../../frontend/src/modules/buyer/services/buyerConversation.service.ts): HTTP con Bearer, errores explícitos y conservación del envío incierto por pestaña/persona/operador.
- [buyerConversation.types.ts](../../frontend/src/modules/buyer/types/buyerConversation.types.ts): tipos según `BuyerConversationService.view`, listado, historial y login existentes; la evaluación tipa solo los campos consumidos.
- [BuyerConversationPanel.test.tsx](../../frontend/src/modules/buyer/components/BuyerConversationPanel.test.tsx) y [BuyerConversationIntegration.test.tsx](../../frontend/src/modules/buyer/components/BuyerConversationIntegration.test.tsx): pruebas nuevas. Se conserva y ejecuta también la prueba previa de presentación de la ficha.

Se utilizan Button, Textarea, iconos Lucide y estilos Tailwind del proyecto. Sin dependencias nuevas. No se construyó un acceso público ni una integración WhatsApp.

## Uso y autenticación

1. Abrir la ficha del prospecto. En «Conversación administrativa Buyer», ingresar correo y contraseña **existentes de personal autorizado**.
2. El panel usa `POST /api/lead/commercial/staff/session`, comprueba acceso mediante el listado de conversaciones y utiliza el token emitido en `Authorization: Bearer …`. El login general del portal, [staffAuthService](../../frontend/src/shared/services/staffAuthService.ts), no emite ese token y no se usa para autorizar el chat. Se siguió el patrón HTTP del acceso de personal LEAD, sin suplantar identidad ni recurrir a sus perfiles locales.
3. Administrador: acceso sujeto al backend. Negociador: requiere asignación conforme al contrato vigente. El cliente no autoriza por `id_persona`, no envía `id_usuario` y no altera los roles.
4. Abrir una conversación guardada o iniciar una nueva. Seleccionar «Respuesta transcrita por el operador» o «Mensaje de la persona ingresado por el operador», escribir y pulsar «Enviar y evaluar». Cada respuesta nueva es otro turno y se evalúa automáticamente; no requiere el botón antiguo Actualizar.
5. Al recargar, identificarse de nuevo y reabrir desde el listado persistido. «Más conversaciones» consume su cursor (páginas de 20); «Más turnos» consume el cursor de historial (hasta 100 por página). Si quedan páginas de turnos, se pide cargarlas antes de enviar, para no omitir un estado pendiente.
6. «Cerrar sesión del chat» elimina el token local y solicita DELETE de la sesión existente. No cierra ni modifica otros accesos del portal.

El token vive solo en memoria, sin localStorage/sessionStorage ni URL. La sesión existente dura 30 minutos, no dispone de refresh y se pierde al reiniciar el backend. No se crearon cuentas ni credenciales. El formulario elimina su contraseña al iniciar la petición y no la guarda en estado o logs.

- **401:** ocultar historial, detener envíos/polling y solicitar identificación; conservar el borrador y el envío incierto. Reautenticar solo consulta estado/listado, nunca reenvía automáticamente.
- **403:** mostrar falta de acceso y ocultar el historial; se puede identificar otra cuenta autorizada. Sin alternativa anónima.
- **404 en acceso o sin código de recurso:** función no disponible, posiblemente autenticación deshabilitada o guarda QA incompatible; no mostrar el compositor ni habilitar acceso público. Un 404 con código de conversación/turno se trata como recurso no disponible, no como permiso concedido.
- Errores de red/503: mostrar el fallo; no declarar guardado ni éxito. Consultar o comprobar el mismo envío explícitamente.
- **409 con código exacto TURN_PENDING (corrección v2):** el backend rechazó el mensaje nuevo antes de registrarlo. Guardar su texto/origen/destino como borrador separado por persona y operador, liberar el sobre rechazado y refrescar el listado. Abrir el turno anterior y consultar/reintentar según `retryable`. Recuperar el borrador exige una acción explícita que vuelve al destino original; no se envía ni se traslada a otra conversación automáticamente. No se aplica este tratamiento a otros 4xx/5xx ni a respuestas ilegibles.

Se conserva la guarda del backend: `LEAD_STAFF_AUTH_QA` solo admite `NexoSalud_LeadPruebas`. Para la futura prueba en **DANIELPC / NexoSalud_LeadEnsayoFinal** hace falta el modo autenticado normal existente, cuenta válida y asignación cuando corresponda. No se activaron flags, ni se modificó `.env`, ni se debilitó la guarda.

## Contratos consumidos y continuidad

Base `/api/buyer/:id_persona/conversations`, con sesión Bearer en todos los recursos:

| Operación | Petición | Uso de la respuesta |
| --- | --- | --- |
| Listar | GET `?after=0&limit=20` | `personId`, `items` (ID, estado, último turno/acción, retryable), `nextAfter`. |
| Historial | GET `/:conversationId?after=0` | `personId`, `conversationId`, `turns`, `nextAfter`. Se valida pertenencia antes de mostrarlo. |
| Enviar | POST `/messages`, `Idempotency-Key`; cuerpo `{conversationId?,message,origin}` | Turno persistido, mensajes exactos, evaluación, estado e identidad. 200 y 202 son respuestas válidas. |
| Reintentar evaluación | POST `/:conversationId/turns/:turnId/retry`, cuerpo `{}` | Mismo turno/interacción; no se vuelve a llamar a `/messages`. |

Un envío nuevo reserva UUID y **cadena JSON exacta** antes de iniciar fetch. El sobre incierto se guarda en sessionStorage, por persona y operador, sin token ni contraseña. Contiene el texto del mensaje para poder repetirlo: dura hasta recibir un turno confirmado, recibir el rechazo confirmado TURN_PENDING (se mueve a borrador) o cerrar la pestaña. No se usa como autorización ni se representa como historial persistido. El mismo operador, autenticado y autorizado, puede pulsar «Comprobar envío original». Se conserva clave, cuerpo, espacios, origen y ausencia de `conversationId` cuando se creó sin conocerlo. Incluso al abrir otra conversación o recargar no se añade ese ID al cuerpo anterior. Otro operador no puede repetir ese sobre desde el panel. Si el almacenamiento está bloqueado, se impide enviar para no perder la identidad de la operación.

Después de recibir el turno, se elimina el sobre y se continúa mediante su ID; un resultado PENDIENTE no implica reenviar el mensaje. El historial muestra exclusivamente `messages` devueltos por el backend, diferenciando operador/transcriptor, asistente y sistema, como texto React con saltos de línea, sin HTML arbitrario. Acciones, etapa, solicitud y recepción se muestran solo si están en la evaluación persistida; no se deducen de la intención, selección de servicio ni del mensaje redactado.

PROCESANDO activo se consulta cada **5 segundos**, con una sola lectura en vuelo, hasta completar o recibir `retryable=true`. El panel no calcula vencimientos con el reloj del navegador. La recuperación es un botón explícito condicionado a ese booleano, tanto para PENDIENTE como para PROCESANDO recuperable. Un fallo pausa la consulta y deja «Consultar estado» manual. No hay bucles automáticos de reintentos de escritura. Se cancelan timers/peticiones al desmontar, cambiar de conversación/persona o perder sesión. El estado está aislado por persona y las respuestas tardías se descartan mediante abort y época de solicitud; no se mezclan turnos de conversaciones diferentes al resolver un envío incierto.

## Verificación ejecutada

Desde PowerShell, raíz del repositorio:

```powershell
$env:RUN_LIVE_GEMINI_TESTS='false'
$env:RUN_SQL_TESTS='false'
$env:DISABLE_MART_SYNC='true'
$env:ENABLE_MART_SYNC='false'
$env:DUNNING_ENABLED='false'
npm --prefix frontend test -- frontend/src/modules/buyer/components/BuyerConversationPanel.test.tsx frontend/src/modules/buyer/components/BuyerConversationIntegration.test.tsx frontend/src/modules/buyer/components/BuyerDetailView.test.tsx
npm --prefix backend run build
npm --prefix frontend run build
```

- [Pruebas finales](../../database/qa/buyer_chatbot_fase2/evidencias/pruebas_finales.txt): **25 aprobadas**, tres archivos, salida 0. 16 del panel, 2 de integración y 7 regresiones de presentación. API simulada mediante fetch; componentes, servicio HTTP y gestión de estado reales. Sin conexión a proveedores.
- Casos: envío/continuación con clave nueva, recuperación tras remontaje, ambas paginaciones, red y misma clave/cuerpo exacto sin ID inicial, sobre incierto tras recarga, retry de mismo turno, procesamiento/polling hasta completar, retryable del servidor aun con fecha aparentemente vencida, cancelación al desmontar, 401 y nueva sesión sin autoenvío, 403/404, cambio de persona con envío e historial en vuelo, PAYER, texto sin HTML, aislamiento entre conversaciones, pausa por error de polling e invalidación de las cachés afectadas.
- [Backend](../../database/qa/buyer_chatbot_fase2/evidencias/build_backend.txt): compilación salida 0. [Frontend](../../database/qa/buyer_chatbot_fase2/evidencias/build_frontend.txt): TypeScript y Vite salida 0; advertencia de bundle mayor de 500 kB, sin ampliar este bloque a optimización general.
- Diagnósticos del editor: sin errores en los seis archivos de código/pruebas de este bloque.
- Huellas iniciales: conservados todos los archivos locales anteriores salvo la integración aditiva de BuyerDetailView. Backend, seis reportes antiguos sin versionar y evidencias previas intactos. Índice Git vacío.

Durante el desarrollo se corrigieron dos fallos del arnés de reloj (el timer real se creaba antes de activar el reloj simulado), tipos demasiado restrictivos de callbacks en la prueba y un fixture de integración que generaba un objeto Buyer distinto en cada render. Este último bloqueó un worker Vitest, que se detuvo tras identificarlo; se corrigió el fixture a identidad estable. Se conservan las salidas iniciales, la corrida interrumpida y la final; no se debilitaron las aserciones ni se cambió producción para satisfacer esos errores del arnés.

## Paquete y pendientes reales

`revision_chatbot_buyer_fase2.zip` es **incremental respecto del estado local de inicio de fase 2**, no un proyecto instalable desde HEAD. Requiere el repositorio actual con fase 1 y sus ajustes v2 (rutas, persistencia, autenticación y cercado/reconciliación), además de las mejoras locales anteriores de presentación y las dependencias ya instaladas. Consultar [fase 1](./CHATBOT_BUYER_FASE1.md). Los ZIP anteriores no van dentro del paquete nuevo.

Incluye los seis archivos de código/pruebas, este informe, evidencias, huellas previas, [diff exclusivo de fase 2](../../database/qa/buyer_chatbot_fase2/auditoria/cambios_fase2.patch) y manifiesto SHA-256 de los archivos incluidos. BuyerDetailView se entrega completo conservando sus cambios previos; el diff permite separar esta integración. Excluye `.env`, secretos, dependencias instaladas, `.git`, compilados, respaldos y ZIP. La comprobación de apertura, descompresión y coincidencia de hashes queda en `database/qa/buyer_chatbot_fase2/evidencias/VERIFICACION_ZIP.txt`, fuera del ZIP para evitar autorreferencia.

Pendiente para QA autorizada: sesión real y asignación, carga/reapertura de historial SQL real, doble envío HTTP entre procesos, recuperación cercada de fase 1 con SQL Server, Gemini real y aceptación visual en escritorio/móvil con los estilos definitivos. Verificar conversión/recepción con datos sintéticos y que se refresquen ambas mesas; repetir PAYER sin atribuir conversión histórica. No se certifica caída real ni recuperación automática del proceso. Estos resultados no resuelven por sí solos el defecto histórico de concurrencia, B3 ni la convención horaria. No hay IDs sintéticos nuevos en SQL: los IDs de pruebas son fixtures en memoria.

## Corrección focalizada v2: TURN_PENDING

Revisión sobre la misma rama/HEAD y estado local, sin alterar backend, SQL, autenticación ni procedimientos. [Informe de corrección y arranque para QA](./CORRECCION_TURN_PENDING_BUYER_FASE2.md).

- El sobre rechazado deja de bloquear retry del turno anterior. «Actualizar conversaciones» permite volver a consultar; «Más conversaciones» conserva el cursor para localizar pendientes en páginas posteriores.
- «Borrador rechazado» conserva el texto exacto tras recarga, fuera del historial. «Recuperar borrador en su destino original» vuelve explícitamente a conversación nueva o consulta el historial de la conversación original antes de restaurarlo. Cambiar de conversación limpia el compositor, conservando la copia recuperable; no hay reenvío automático.
- Un envío incierto mantiene clave/cuerpo originales. Se valida también la identidad mínima del turno en una respuesta 2xx: JSON incompleto no acredita recepción. Un metadato local relaciona el envío recuperado con su borrador para consumirlo una sola vez incluso después de otro error de red y recarga; no forma parte del cuerpo HTTP.
- [Pruebas v2](../../database/qa/buyer_chatbot_fase2_v2/evidencias/pruebas_finales.txt): **34 aprobadas**, tres archivos, salida 0; incluye las 25 anteriores y nueve regresiones nuevas. [Compilación frontend v2](../../database/qa/buyer_chatbot_fase2_v2/evidencias/build_frontend.txt): salida 0, con la advertencia de tamaño del bundle ya conocida. No se repitió compilación backend porque no se modificó su código.
- Paquete incremental `revision_chatbot_buyer_fase2_v2.zip`: archivos ajustados, prueba, informe, arranque QA aislado, evidencias, diff del ajuste y manifiesto SHA-256. Depende de fase 2 inicial + fase 1 auditada v2. El paquete anterior se conserva.

La preparación de arranque no se ejecutó. El arranque general llama al recuperador Buyer sin flag de exclusión; el informe proporciona un servidor QA mínimo que reutiliza las rutas/autenticación reales sin importar index.ts. Sigue pendiente verificar una cuenta autorizada en NexoSalud_LeadEnsayoFinal. SQL Server, Gemini real y aceptación visual **siguen pendientes**.
