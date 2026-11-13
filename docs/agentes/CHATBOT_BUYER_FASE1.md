# Chatbot Buyer — fase 1 administrativa

**Backend con ajustes de auditoría v2 y pruebas simuladas aprobadas; pendientes SQL Server y Gemini reales. No incluye interfaz.**

Rama conservada: `feature/buyer-orientacion-interactiva`. HEAD/base real: `de14f0d6d921c778d90aedb28948f8f5a9403935`. Se conservaron las mejoras locales posteriores de preferencias, PAYER y diagnóstico B3, incluidos sus documentos, pruebas y evidencias. No hubo pull, cambio de rama, reset, commit ni push. No se encontraron AGENTS.md aplicables. No se cambiaron dependencias, Prisma ni procedimientos.

## Costuras y archivos

- [Clasificador existente](../../backend/src/services/buyerMessageClassifier.ts) y [tipos](../../backend/src/types/buyer.ts): modo conversacional opcional; los consumidores anteriores conservan el contrato de clasificación. `AMBIGUA` sigue devolviendo `id_servicio=null`.
- [Orquestador nuevo](../../backend/src/services/buyerConversationService.ts): reserva de turno, contexto SQL, minimización, una llamada de clasificación/redacción por intento, persistencia y respuesta posterior a las acciones.
- [Router nuevo](../../backend/src/routes/buyerConversation.routes.ts), montado en [Buyer](../../backend/src/routes/buyer.routes.ts). Las lecturas Buyer heredadas excluyen interacciones de chat y sus evaluaciones; el historial administrativo usa las rutas protegidas nuevas.
- [Evaluador existente](../../backend/src/services/buyerEvaluationService.ts): se reutiliza con `classifierOverride`, que llama al clasificador real extendido y guarda su propuesta antes del SP. Marca de turno conversacional, bloqueo del retry/evaluación genéricos para entradas de chat y etapa correcta en una evaluación pendiente de un contacto avanzado. En v2, la exclusión local de promesas usa interacción + identidad de ejecución, para no reutilizar una promesa abandonada al recuperar un turno vencido.
- Se reutilizan [recepción LEAD](../../backend/src/services/leadIntake.ts), `dbo.usp_ConvertirBuyerALead` y `dbo.usp_RegistrarEntradaAgenteLead`; no se añade otra conversión ni SQL generado por Gemini.

## Acceso administrativo

Se reutilizan [sesiones de personal](../../backend/src/services/leadStaffAuth.ts) y el login existente `POST /api/lead/commercial/staff/session`; no se crea autenticación pública. La siguiente interfaz deberá obtener la sesión enviando `{ "email": "correo del operador", "password": "contraseña existente" }` al login. Recibe `{token, expira_en, usuario}` y envía `Authorization: Bearer <token>` en **todas** las operaciones de chat, incluida la consulta paginada. Son ejemplos de contrato, no credenciales creadas en este bloque. Mantener el token fuera de URL, logs e historial de mensajes; se recomienda memoria de la interfaz. La implementación visual queda pendiente.

El token existente es opaco (43 caracteres base64url), con vigencia fija de 30 minutos. El backend mantiene sesiones en memoria; un reinicio las pierde y no hay renovación automática ni endpoint de refresh. Cada solicitud vuelve a comprobar usuario activo, rol y huella de contraseña. `DELETE /api/lead/commercial/staff/session` elimina la sesión y devuelve 204. No se modificaron cuentas, hashes, flags de autenticación ni el servicio de sesiones.

Acceso a los recursos del chat:

- Administrador: acceso administrativo a la persona.
- Negociador: requiere una solicitud de esa persona asignada a su `id_usuario`, conforme a la frontera de asignación existente.
- Sin sesión: 401; sin asignación/rol permitido: 403; autenticación de personal deshabilitada: 404, **sin fallback anónimo**.

`id_persona` selecciona el recurso después de verificar sesión/asignación; no autoriza. El `id_usuario` guardado procede de la sesión; el cuerpo no puede proporcionarlo. El modo de autenticación QA existente está limitado a `NexoSalud_LeadPruebas`; no se cambió esa guarda para acceder a `NexoSalud_LeadEnsayoFinal`. Antes de una prueba real en este último destino, coordinar cuentas y el modo autenticado normal existente. Activar sus flags puede afectar otras rutas LEAD heredadas: no se activaron en este encargo. Las pruebas HTTP de este bloque sustituyen la identidad por un doble, no certifican login SQL real.

Contrato para la siguiente interfaz: ante **401**, conservar el borrador, detener envíos y pedir nueva sesión; después consultar estado SQL/listado antes de repetir el envío original con la misma clave y cuerpo. Ante **403**, mostrar falta de acceso y no recurrir a otra ruta sin protección. Con autenticación deshabilitada, el chat responde **404**: mostrar función no disponible, sin habilitar acceso anónimo ni usar las rutas Buyer heredadas como sustituto del historial. Un error 503 al comprobar sesión no acredita acceso. No hay interfaz ni almacenamiento de token nuevos en este bloque.

## Contratos HTTP

Base: `/api/buyer/:id/conversations`. No hay rutas nuevas bajo `/public`, WhatsApp ni acceso directo de pacientes.

| Método y ruta relativa | Cuerpo / parámetros | Resultado |
| --- | --- | --- |
| GET `/?after=0&limit=20` | Cursor de cabecera `id_decision`; límite 1–50 | Lista solo conversaciones de la persona autorizada: `conversationId`, `status`, `lastTurnId`, `lastAction`, `retryable`. `nextAfter` permite otra página. Orden de creación ascendente; sin texto de mensajes en el resumen. |
| POST `/messages` | `message`, `origin`, `conversationId` opcional; `Idempotency-Key` obligatoria | Crea conversación si se omite su ID, guarda mensaje y evalúa automáticamente. |
| GET `/:conversationId?after=0` | Cursor opcional de `turnId` | Hasta 100 turnos completos, incluyendo todos sus mensajes/errores; `nextAfter` si hay otra página. |
| POST `/:conversationId/turns/:turnId/retry` | Cuerpo vacío | Reintenta PENDIENTE o reclama PROCESANDO vencido bajo bloqueo SQL. No registra otro mensaje. Si está completo o sigue activo, devuelve su estado sin ejecutarlo de nuevo. |

Ejemplo de envío (administrador/operador autenticado):

```json
{
  "conversationId": "UUID-devuelto-por-el-servidor-opcional-en-el-primer-envio",
  "message": "¿Qué incluye la evaluación?",
  "origin": "OPERADOR_TRANSCRIPTOR"
}
```

`origin` admite `OPERADOR` (contenido del paciente ingresado por personal) y `OPERADOR_TRANSCRIPTOR` (respuesta transcrita). No acredita identidad ni consentimiento del paciente. Ambos requieren personal autenticado. Solo se aceptan esas tres claves; `history`, preguntas previas, IDs de usuario, evaluaciones y preferencias enviados libremente se rechazan con 400. Texto no vacío, máximo 2000 caracteres. La conversación debe ser un UUID previamente emitido para esa persona; cruce de persona/conversación/turno: 404 y ninguna inserción.

La respuesta incluye:

```json
{
  "conversationId": "UUID-del-servidor",
  "turnId": 123,
  "interactionId": 456,
  "status": "COMPLETADA",
  "messages": [
    {"role":"operador_transcriptor","text":"texto exacto","origin":"OPERADOR_TRANSCRIPTOR","actorId":7,"at":"fecha UTC"},
    {"role":"asistente","text":"respuesta exacta devuelta","origin":"GEMINI","at":"fecha UTC"}
  ],
  "declaredServiceId": 1,
  "analysis": {
    "intention":"SOLO_CONSULTA",
    "interpretedServiceId":null,
    "pendingData":[],
    "contradictions":[],
    "proposedAction":"INFORMAR"
  },
  "evaluation": {"id_decision":789,"accion":"SOLO_CONSULTA","etapa_final":"BUYER"},
  "attempts":[{"at":"fecha UTC","result":"COMPLETADA"}],
  "retryable":false,
  "replayed":false
}
```

Los IDs anteriores son ejemplos de contrato, **no IDs SQL creados**. `evaluation` contiene el resultado real del evaluador, con los IDs comerciales y entrega cuando corresponden. `analysis` conserva la propuesta validada del modelo; puede diferir de `evaluation` si el backend bloqueó la acción. No expone la respuesta preliminar como confirmación ejecutada.

Estados: HTTP 200 para turno completo/replay completo; 202 para `PENDIENTE` o `PROCESANDO`. `PENDIENTE` tiene `retryable=true`, mensaje de rol `sistema`, causa categorizada e historial de intentos, sin una respuesta asistente exitosa inventada. `execution={id,expiresAt}` identifica la ejecución y su vencimiento UTC calculado por SQL Server. Historial y listado calculan `retryable` con ese reloj: PROCESANDO activo no reclamable; vencido admite retry explícito. Una respuesta tardía sustituida devuelve el turno persistido vigente con `executionSuperseded=true`, sin guardar su propia respuesta. 409 por clave con contenido distinto, otro turno pendiente o identidad/vencimiento no verificables; 503 por reserva/almacenamiento no disponible. Si falla la respuesta HTTP, consultar historial o repetir la misma clave y cuerpo. Repetir el envío no dispara retry implícito.

`Idempotency-Key`: 8–128 caracteres ASCII visibles sin espacios, ámbito persona y chat administrativo. Se guarda SHA-256; igual clave/cuerpo devuelve el mismo turno, interacción y respuesta. Cambiar mensaje, origen o conversación con la misma clave es conflicto. Para repetir la creación inicial, conservar el cuerpo inicial sin añadir después el `conversationId`; para otro mensaje, usar una clave nueva. Retry usa la identidad de turno persistida y no necesita una clave nueva ni admite mensaje/contexto.

## Gemini y validación

El modo anterior sigue pidiendo solo intención/servicio. Con `conversationContext`, una misma petición SDK pide:

```json
{
  "intencion":"AMBIGUA",
  "id_servicio":null,
  "respuesta":"¿Deseas información o solicitar atención?",
  "datos_pendientes":[],
  "contradicciones":[],
  "accion_propuesta":"ACLARAR",
  "confirmar_servicio":null
}
```

Intenciones existentes: `AMBIGUA`, `SOLO_CONSULTA`, `SOLICITA_RESERVA`. Acciones propuestas: `INFORMAR`, `ACLARAR`, `SOLICITAR_CONVERSION`. `id_servicio` es interpretado; el declarado en el formulario/preferencia va separado. `confirmar_servicio` solo admite un ID activo y acción ACLARAR. El backend añade en ese caso una pregunta inequívoca sobre solicitar conversión, sin prometer reserva/disponibilidad, y persiste pregunta/servicio. Un “sí” solo puede usar esa pregunta si es la última respuesta asistente de **esta conversación** reconstruida desde SQL y el servicio continúa activo. Una pregunta libre distinta no habilita la confirmación.

Gemini recibe mensaje minimizado, hasta seis turnos completados/12 mensajes recientes (500 caracteres por mensaje), la pregunta inequívoca separada si corresponde, preferencias vigentes con procedencia y hasta 100 servicios activos (ID/nombre). El historial completo no se borra. No se envía el objeto Persona, DNI, teléfono, email, nombres ni apellidos conocidos; también se enmascaran patrones de contacto/identificadores en el texto libre. No se envían IDs de persona/operador/conversación. Este filtrado no certifica anonimización de cualquier dato personal no estructurado escrito arbitrariamente por el operador.

No hay precios ni agenda autorizados: se pasan como hechos solo catálogo/procedencia y su ausencia. El esquema valida límites y acciones; el filtro heurístico detecta afirmaciones de ejecución previa, precios numéricos, disponibilidad o diagnóstico y las rechaza como fallo recuperable. En v2 reconoce negaciones acotadas: permite «La disponibilidad no está confirmada.» y «No puedo emitir un diagnóstico.», sin dispensar otras afirmaciones dentro de la misma respuesta. Normaliza acentos para mantener bloqueados verbos como «reservé». Las pruebas incluyen negación seguida de una reserva inventada y delimitación clínica seguida de una confirmación inventada. Estas reglas e instrucciones **no constituyen una garantía exhaustiva de veracidad**, ni certifican calidad clínica o calidad del modelo; Gemini real queda pendiente.

El backend bloquea conversión por saludo, monosílabo sin pregunta inequívoca, contradicciones/datos pendientes o servicio interpretado desconocido; no sustituye silenciosamente ese último por el seleccionado. Conserva propuesta original y decisión validada por separado. También bloquea adjudicar a un mensaje nuevo una conversión histórica de la captación. El evaluador conserva sus controles de consentimiento, datos, calidad, servicio activo y etapas avanzadas. No introduce aprobación humana obligatoria; la siguiente respuesta es otro envío evaluado automáticamente.

La respuesta preliminar no puede anunciar acciones realizadas. Después de evaluar, el orquestador comunica los IDs y la recepción confirmados por backend; comprueba el enlace de solicitud con la interacción. Una conversión con recepción pendiente se describe como tal. Una consulta PAYER conserva etapa y no hereda solicitud/evento históricos. La respuesta final puede tener origen `GEMINI`, `BACKEND_VALIDACION`, `BACKEND_RESULTADO` o `GEMINI_Y_BACKEND`; se guarda exactamente la que devuelve HTTP.

## Persistencia e idempotencia

No se necesita estructura nueva. Se reutiliza [el esquema existente](../../backend/prisma/schema.prisma):

- `Interacciones`: una fila entrante con persona, operador real, fecha, tipo `BUYER_CHAT_ENTRADA` y mensaje. Se crea dentro de la misma transacción que su turno y antes de Gemini.
- `DecisionesIA`, agente `BUYER_CHAT`: cabecera `kind=conversation` y un registro `kind=turn` por envío. El JSON versionado en **entrada MAX** contiene conversación, hashes, roles/origen, texto exacto, estados, intentos, propuesta, validación, evaluación y respuesta. Las relaciones existentes persona/usuario/captación/interacción se conservan. La evaluación BUYER real tiene su propio `id_decision`, referenciado desde el turno.
- Los mensajes de asistente/sistema viven en ese JSON, sin crear una interacción saliente que los consumidores anteriores confundan con un mensaje nuevo del paciente. El JSON usa escapes ASCII para conservar Unicode en `VARCHAR(MAX)`; `Interacciones.mensaje` es una copia de consulta, y el historial exacto es el envelope JSON. La comprobación de Unicode SQL real está pendiente.
- `decision` contiene solo un resumen corto, no respuestas/contexto largos en sus 500 caracteres.

`sp_getapplock`, exclusivo y propiedad de transacción, con recurso `BuyerChat:<persona>` serializa reserva, búsqueda de clave y cambios de estado. La primera reserva crea mensaje/turno atómicamente; la reclamación pasa a PROCESANDO con UUID de ejecución y vencimiento de 60 segundos, obtenido mediante `SYSUTCDATETIME()` bajo el mismo bloqueo. **Las transacciones terminan antes de Gemini.** Otra petición no reclama una ejecución activa y no se admite otro turno pendiente para la persona. Al vencer, un retry explícito marca el intento previo INTERRUMPIDA/LEASE_EXPIRED y reserva otra identidad. Un PROCESANDO legado sin UUID/vencimiento UTC verificables o un estado desconocido devuelve 409 EXECUTION_UNVERIFIABLE: no se reinicia a ciegas.

Antes de cada operación SQL del evaluador/orquestador se vuelve a adquirir el bloqueo, se comprueba identidad + vencimiento y se renueva el plazo. La operación y ese chequeo comparten una transacción breve: cercar solo el guardado final no impediría un SP tardío. Se incluyen los procedimientos existentes, ejecutados dentro de esa transacción breve; **nunca se espera Gemini dentro de ella**. Una ejecución sustituida no puede guardar propuesta, evaluación, respuesta ni efectos comerciales posteriores. El doble de persistencia comprueba la espera externa con profundidad de transacción cero; su anterior veto a cualquier SP dentro de transacción se sustituyó porque v2 necesita ese cercado atómico. El comportamiento de transacciones anidadas, locks y errores de los SP **todavía exige prueba con SQL real**. No se modificó ningún procedimiento. El prototipo usa búsquedas JSON sin índices nuevos; medir volumen real antes de escalar.

La propuesta Gemini queda guardada antes de devolverla al evaluador y ejecutar SQL. Un fallo posterior puede reutilizarla sin otra llamada, si el contexto/catálogo no cambió. Un retry de Gemini fallido reutiliza mensaje y evaluación pendientes, con otro intento explícito. En modo conversación no hay reintentos SDK automáticos: una llamada por intento técnico; los consumidores antiguos conservan su backoff. No se mantiene ninguna transacción esperando al modelo.

Antes de evaluar nuevamente, v2 reconcilia `Interacciones`, la decisión BUYER de **esa interacción**, su operación persistida y el evento BUYER→LEAD con solicitud de la misma persona/captación. Si acredita conversión, reutiliza sus IDs y ejecuta solamente la recepción idempotente necesaria; conserva la propuesta guardada y no repite Gemini ni el SP de conversión. Un corte después del SP y antes de enlazar la interacción se recupera con esa evidencia. Evidencia ausente, contradictoria, ambigua o usada por otra interacción impide repetir la conversión; solo una operación prevista sin evento ni solicitud persistidos puede volver al SP idempotente. La recuperación no adjudica una conversión histórica a un mensaje nuevo. Si la recepción continúa fallando, se comunica como pendiente. No hay recuperador general ni polling de fondo: se necesita retry autenticado explícito.

No hay migración ni script de instalación. Se preparó [00_PRERREQUISITOS_SOLO_LECTURA.sql](../../database/qa/buyer_chatbot_fase1/00_PRERREQUISITOS_SOLO_LECTURA.sql) para comprobar exclusivamente DANIELPC / NexoSalud_LeadEnsayoFinal, columnas MAX, procedimientos y restricciones: **no se ejecutó**. Orden siguiente: revisar paquete → acordar acceso administrativo → ejecutar comprobación de lectura → pruebas sintéticas SQL reales autorizadas. No usar db push/reset ni registrar instalación LEAD completa.

## Pruebas ejecutadas

[Prueba nueva](../../backend/tests/buyerConversation.test.ts) y [doble de persistencia](../../backend/tests/helpers/buyerChatMemory.ts): **20 casos nuevos** con SDK/persistencia simulados y evaluador/rutas/validación reales. Incluyen los ocho escenarios solicitados, bloqueo de respuestas prematuras, Unicode, contexto acotado sin borrado, fallo SQL después de Gemini, historial anterior no adjudicado, saludo mal clasificado, servicio desconocido, etapa PAYER ante fallo, protección de retry genérico y no exposición por la ficha heredada. La prueba HTTP usa Express loopback y autenticación simulada; la prueba de doble envío solapa operaciones del servicio con una barrera, **no acredita locks reales SQL ni concurrencia HTTP en producción**.

[Pruebas de auditoría v2](../../backend/tests/buyerConversationAudit.test.ts): **19 casos adicionales**, once del filtro, seis de ejecución/recuperación y dos del listado protegido. Incluyen turno activo no reclamable usando reloj SQL simulado, vencimiento recuperable, resultados tardíos tras completar y durante otra ejecución activa, cortes después de conversión/recepción y justo después del SP, rechazo de PROCESANDO sin identidad verificable, paginación y aislamiento por persona, 401/403/404 y parámetros inválidos. El fixture prohíbe acceso al cliente SQL por defecto. Se simuló la interrupción mediante barreras y errores de persistencia: **no se mató ni reinició un proceso real**.

Comando desde PowerShell en la raíz:

```powershell
$env:RUN_LIVE_GEMINI_TESTS='false'
$env:RUN_SQL_TESTS='false'
$env:DISABLE_MART_SYNC='true'
$env:ENABLE_MART_SYNC='false'
$env:DUNNING_ENABLED='false'
npm --prefix frontend test -- backend/tests/buyerConversationAudit.test.ts backend/tests/buyerConversation.test.ts backend/tests/buyerMessageClassifier.test.ts backend/tests/buyerUnifiedEvaluation.test.ts backend/tests/buyerMessageJourney.test.ts
npm --prefix backend run build
```

[Resultado final v2](../../database/qa/buyer_chatbot_fase1_v2/evidencias/pruebas_finales.txt): **107 aprobadas, 4 omitidas**, cinco archivos; salida **0**. Las cuatro omitidas pertenecen a la integración Gemini real y se mantuvieron desactivadas. [Compilación backend v2](../../database/qa/buyer_chatbot_fase1_v2/evidencias/build_backend.txt): salida **0**. La corrida v2 conserva las regresiones del clasificador/evaluador y los 20 casos de fase 1. Se preservan también las evidencias v1. Sin conexiones/escrituras SQL Server ni llamadas Gemini reales; no se arrancó index.ts, Mart, dunning o recuperadores.

## Límites y pendientes

1. SQL Server real: comprobar prerrequisitos, rollback/atomicidad, carreras entre procesos, permisos de application lock, exactitud Unicode y compatibilidad de las restricciones. No se certifica rendimiento de búsquedas de envelopes ni el contrato bajo cambios simultáneos de preferencias.
2. Autenticación real y asignación: preparar cuentas autorizadas sin inventar usuarios; la prueba actual sustituye sesión/persistencia. La protección nueva y los filtros Buyer no son una auditoría de autorización de todos los módulos heredados.
3. Recuperación acotada implementada y comprobada con dobles: vencimiento SQL, identidad, cercado y reconciliación. **Pendiente** prueba real de caída entre commits/recepción, ejecutor anterior sobreviviente y concurrencia entre procesos en SQL Server. No equivale a recuperación automática del backend. El retry genérico no puede procesar estos turnos; los recuperadores generales deben seguir detenidos para las pruebas aisladas.
4. Gemini real: pertinencia, salud/veracidad, negaciones, preguntas largas y preferencias cambiadas durante una llamada, en una fase expresamente autorizada. No se certifica calidad del modelo con respuestas simuladas.
5. Interfaz: no implementada ni validada. La siguiente fase consumirá listado/historial/enviar/retry autenticados con el contrato de sesión documentado. B3 y su convención horaria siguen pendientes del bloque anterior; este encargo no normaliza fechas ni modifica indicadores.

El paquete anterior v1 y sus evidencias se conservan. `revision_chatbot_buyer_fase1_v2.zip` contiene los seis archivos existentes ajustados en esta auditoría (servicio, clasificador, evaluador, router, doble y este documento), la prueba nueva, evidencias, manifiesto de huellas y [diff de este ajuste](../../database/qa/buyer_chatbot_fase1_v2/auditoria/ajuste_desde_inicio.patch). La base del diff es el estado local exacto al comenzar **esta auditoría**, no HEAD; no incluye las mejoras locales anteriores ni el desarrollo completo de fase 1 como cambios nuevos. Excluye entorno, secretos, dependencias, compilados, ZIP y respaldos. No se cambió el índice Git, ni hubo commit o push.
