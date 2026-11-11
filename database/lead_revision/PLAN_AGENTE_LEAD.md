# Implementación del agente LEAD

Chat web y Gemini con configuración propia de LEAD. La OLTP decide las operaciones; los reportes R1–R3 y las medidas M1–M8 conservan sus reglas. El trabajo se valida en QA y la instalación y activación productivas requieren autorización separada.

| Fase | Estado | Entregable verificable |
| --- | --- | --- |
| 1. Contratos y políticas | Validada en documentación | Entrada, salida, responsables y bloqueos definidos; acuerdos externos pendientes explícitos. |
| 2. Persistencia y seguridad | Núcleo validado en QA | Cola de ingreso, auditoría, permisos y recuperación. El almacenamiento de chat, herramientas, seguimiento y revisión se incorpora con sus flujos. |
| 3. Orquestador y F1 | Flujo inicial validado en QA | Una decisión recuperable por ingreso, con prioridad y siguiente acción. Pendientes el adaptador Gemini y la delegación contextual. |
| 4. Chat web | Chat manual validado en QA por HTTP | Acceso temporal por solicitud, historial, recepción y reenvío idempotente. Pendientes la prueba visual y la conexión con BUYER. |
| 5. F2: alternativas | Recomendación asistida validada en QA | Agenda ordenada por rango confirmado y revalidación al ofrecer. Pendiente interpretar el chat con Gemini. |
| 6. F3: negociación | Aceptación por chat validada en QA | El personal comparte una versión y el paciente confirma su importe. Pendiente la asistencia con Gemini para objeciones. |
| 7. F4: seguimiento | Revisión humana validada en QA | Pausa y reanudación auditadas en el chat. Pendientes las reglas de contacto y el seguimiento automático. |
| 8. F5: traspaso | Traspaso manual validado en QA | Una reserva y un evento por autorización, incluso ante reintentos y concurrencia. Pendiente la delegación para el agente. |
| 9. Integración y entrega | Validación local en QA y entrega documentadas | Flujo asistido reproducible. Pendientes la prueba conjunta y el paquete de activación productiva. |

## Interfaces entre etapas

**Entrada.** Se conserva el [contrato BUYER → LEAD](CONTRATO_BUYER_LEAD.md). BUYER conserva mensaje, captación y trabajo pendiente; LEAD consume solo ingresos explícitos confirmados. No se incorporan solicitudes históricas por defecto. La prueba conjunta y el acceso al historial vinculado están pendientes.

**Salida.** LEAD prepara el expediente de una solicitud con la persona, la versión vigente aceptada de la propuesta, su importe, la alternativa aceptada, la revisión de las condiciones ofrecidas y la autorización expresa de reserva. La autorización queda ligada a esas condiciones y debe revalidarse antes de ejecutar. El traspaso existente ocupa la disponibilidad, crea la reserva pendiente, actualiza la etapa y registra el evento LEAD → PAYER en una transacción. La referencia estable devuelta al repetir la misma autorización es `id_reserva`.

PAYER recibe la reserva vinculada a `id_solicitud`, `id_persona` e `id_opcion`; la propuesta, autorización y evento se conservan como evidencia en sus relaciones de origen. La transición indica entrada a PAYER, no pago validado. PAYER debe confirmar este contrato en QA antes de la activación; no se añade una ruta paralela ni se delegan pagos o cobranza al agente LEAD. La operación antigua de reserva no es una herramienta del agente.

## Políticas y comportamiento por defecto

| Capacidad | Responsable de la definición | Mientras falte la política o evidencia |
| --- | --- | --- |
| F1: priorizar | LEAD; clínica para plazos y escalamiento | Ordenar por señales existentes en QA, sin inventar SLA ni probabilidades. |
| F2: recomendar y ofrecer | LEAD; clínica para excepciones de agenda | Recomendar disponibilidad elegible; no publicar si no se verifica vigencia o no está habilitada la comunicación. |
| F3: negociar | Clínica para precios, promociones y excepciones; LEAD para validar | Usar solo tarifas y condiciones verificables; sin descuentos supuestos. Objeción o silencio no acreditan rechazo. |
| F4: responder y seguir | Clínica para consentimiento, horarios, frecuencia y parada; LEAD para aplicar | Preparar borradores y tareas en QA; no automatizar contactos sin política vigente. Revocación detiene el seguimiento aplicable. |
| F5: preparar y transferir | Clínica para delegación; LEAD y PAYER para la interfaz | Preparar y mostrar bloqueos; sin transferencia autónoma hasta tener delegación y evidencia válida. |

Las políticas aprobadas deben tener versión, responsable y vigencia. La aceptación económica, la aceptación de la alternativa y la autorización de reserva se registran por separado. Un conflicto de identidad, agenda, precio o autorización se deriva al personal; el agente no completa la evidencia por inferencia. El envío se centraliza en el chat web, con estados verificables; el simulador legado no acredita contacto.

## Cola de ingreso en QA

Instalar [COLA_AGENTE_LEAD_QA.sql](COLA_AGENTE_LEAD_QA.sql) con SQLCMD y `-b` sobre `NexoSalud_LeadPruebas` después de instalar la recepción. La entrada nueva y su trabajo se guardan en la misma transacción. Las entradas anteriores a la migración no se encolan.

El ejecutor futuro usará una conexión independiente con el rol `rol_ejecutor_agente_lead`. Toma una tarea con un token temporal y resuelve el intento con ese mismo token. El plazo técnico predeterminado es de 60 segundos. Los fallos admiten hasta cinco intentos con espera creciente para reintentos explícitos. Al agotar intentos, la tarea queda en revisión. El token solo protege la resolución en la cola. Las futuras herramientas comerciales deben validar su propia idempotencia y vigencia antes de producir efectos.

En QA se instaló y reejecutó la migración y pasó `npm run test:lead:intake` con la cola presente. El ensayo verificó una sola toma entre ocho llamadas, recuperación después de expirar, rechazo del token anterior, finalización única y auditoría. Una prueba adicional con un usuario temporal confirmó los permisos de ejecución y la ausencia de acceso directo a las tablas comprobadas.

## Primera ejecución de F1 en QA

Aplicar [PRIORIZACION_AGENTE_LEAD_QA.sql](PRIORIZACION_AGENTE_LEAD_QA.sql) con SQLCMD y `-b` después de la cola. Desde `backend`, ejecutar `npx --no-install tsx src/scripts/run-lead-orchestrator.ts` con `LEAD_AGENT_SQLSERVER_URL` apuntando a QA y una identidad del rol ejecutor. El comando consume como máximo un ingreso por llamada.

La cola conserva el orden de toma por disponibilidad del trabajo. F1 clasifica la solicitud tomada según seguimiento vencido, seguimiento previsto para hoy en Lima, primera respuesta pendiente u oportunidad sin acción inmediata. Una oportunidad archivada, cerrada o fuera de LEAD se finaliza. La decisión se registra junto con el cierre del trabajo y su auditoría. Las acciones registradas son recomendaciones internas; queda pendiente la delegación contextual con Gemini cuando exista contexto verificable de conversación.

Pasaron `npm run build` y `npm run test:lead:intake` contra QA. Ocho ejecuciones concurrentes sobre una misma solicitud temporal produjeron una sola decisión persistida y un seguimiento vencido recibió prioridad 1.

## Chat web en QA

Aplicar [CHAT_AGENTE_LEAD_QA.sql](CHAT_AGENTE_LEAD_QA.sql) con SQLCMD y `-b` después de la recepción. En el backend QA, habilitar `LEAD_STAFF_AUTH_QA=true` y `LEAD_CHAT_QA=true`. En el frontend QA, habilitar `VITE_LEAD_WORKSPACE=true`, `VITE_LEAD_STAFF_AUTH_QA=true` y `VITE_LEAD_CHAT_QA=true`.

El personal asignado o un administrador inicia sesión en una oportunidad con entrada acreditada y autorización de contacto vigente. Desde la oportunidad genera un enlace temporal para entregar al paciente en QA. Cada enlace vence a las 24 horas y reemplaza el anterior. El chat vincula el acceso a la persona de la entrada y su solicitud. El historial se consulta por páginas y el navegador confirma la recepción de mensajes de la otra parte. La marca de recepción acredita que llegaron al navegador, sin inferir lectura ni aceptación comercial. El reenvío durante la misma sesión reutiliza la clave del mensaje.

Pasaron las compilaciones de backend y frontend y el ensayo HTTP + SQL `npm run test:lead:flow` con el chat habilitado. El ensayo verificó diálogo, recepción, paginación, repetición de clave, aislamiento por solicitud, rotación y vencimiento del enlace. Pendientes la prueba visual en navegador y la integración del historial y la identidad del paciente con BUYER.

## Alternativas según el rango confirmado

El personal puede consultar una fecha con un rango de horas en Lima. Si es obligatorio, aparecen únicamente horarios que caben por completo en él. Si es flexible, aparecen primero los que coinciden y luego los demás horarios elegibles, identificados como fuera del rango preferido. Los filtros previos de sede y profesional siguen disponibles en la API.

La consulta no registra ofertas. La operación existente revalida el horario antes de registrar la opción y conserva las condiciones en el historial. En QA, el ensayo comercial comprobó ambos modos y rechazó con 409 una oferta cuyo horario pasó a ocupado después de la consulta. La interpretación automática del mensaje del paciente y la publicación autónoma por chat siguen pendientes.

## Cotizaciones en el chat de QA

Aplicar [PROPUESTAS_CHAT_LEAD_QA.sql](PROPUESTAS_CHAT_LEAD_QA.sql) después del esquema de chat. El personal comparte una cotización pendiente desde la oportunidad. El chat muestra la versión, el importe registrado y la promoción si corresponde. El paciente confirma el importe desde la tarjeta y el sistema registra la aceptación y su evidencia en una sola transacción. Una versión anterior o sin publicar queda fuera del flujo de aceptación.

El texto libre conserva su función de conversación. Las objeciones y solicitudes de cambio se atienden por ese canal y el personal gestiona los rechazos explícitos con el flujo existente. Quedan pendientes Gemini para asistir con objeciones y la identidad de paciente para un uso productivo. El chat QA acredita el uso del acceso temporal vinculado a la solicitud.

El ensayo HTTP + SQL en QA verificó que un mensaje ambiguo deja la cotización pendiente, que una versión reemplazada y un importe distinto se rechazan, y que el reintento de aceptación conserva la evidencia original.

## Revisión humana en el chat de QA

Aplicar [REVISION_CHAT_LEAD_QA.sql](REVISION_CHAT_LEAD_QA.sql) después del esquema de chat. El personal autorizado pausa o reanuda el seguimiento desde la oportunidad, con un motivo en cada cambio. La revisión consultada debe seguir vigente para actualizarla. El historial registra quién hizo el cambio y cuándo.

Durante una pausa, el chat bloquea los mensajes del personal y la publicación de cotizaciones. El paciente puede enviar mensajes y consultar las cotizaciones compartidas. Para reanudar se verifica que el acceso, la etapa y el consentimiento sigan vigentes. La pausa se aplica al chat de esa solicitud. Las reglas para automatizar contactos y limitar su frecuencia por persona están pendientes.

Pasaron las compilaciones y el ensayo HTTP + SQL en QA. La prueba cubrió permisos, bloqueo de salida, recepción de mensajes durante la pausa, rechazo de una revisión desactualizada y registro de la reanudación.

## Traspaso a PAYER en QA

El personal registra la autorización para la propuesta aceptada y la revisión vigente de la alternativa. El traspaso revalida la agenda y registra en una sola transacción la reserva pendiente, la ocupación del horario, el cambio de etapa y el evento. Un reintento devuelve la reserva existente cuando consta exactamente un evento LEAD a PAYER para esa persona, solicitud y autorización. Si falta la evidencia o se duplica, el diagnóstico indica que requiere revisión.

Pasaron `npm run test:lead:flow` y `npm run test:lead:concurrency`. El ensayo comprobó que retirar la evidencia bloquea el reintento sin duplicar la reserva. Con conexiones SQL independientes se verificó que los reintentos conservan la reserva original, que solo una solicitud obtiene un horario disputado y que un fallo antes de guardar el evento revierte todo el traspaso. La ejecución autónoma sigue pendiente de delegación y validación conjunta con PAYER.

## Entrega y reproducción en QA

En una copia dedicada `NexoSalud_LeadPruebas` con el paquete OLTP BUYER y LEAD, aplicar estos archivos desde la raíz con `sqlcmd -S "<instancia QA>" -E -C -I -b -d NexoSalud_LeadPruebas -f 65001 -i "<ruta al script>"`, en este orden:

1. [ENTRADA_AGENTE_LEAD_QA.sql](ENTRADA_AGENTE_LEAD_QA.sql).
2. [COLA_AGENTE_LEAD_QA.sql](COLA_AGENTE_LEAD_QA.sql) y [PRIORIZACION_AGENTE_LEAD_QA.sql](PRIORIZACION_AGENTE_LEAD_QA.sql).
3. [CHAT_AGENTE_LEAD_QA.sql](CHAT_AGENTE_LEAD_QA.sql), [PROPUESTAS_CHAT_LEAD_QA.sql](PROPUESTAS_CHAT_LEAD_QA.sql) y [REVISION_CHAT_LEAD_QA.sql](REVISION_CHAT_LEAD_QA.sql).
4. [AUTORIZACION_RESERVA_QA.sql](AUTORIZACION_RESERVA_QA.sql) y [TRASPASO_PAYER_QA.sql](TRASPASO_PAYER_QA.sql).

Configurar `SQLSERVER_URL` para la copia, habilitar `LEAD_CHAT_QA=true` para incluir el chat y ejecutar desde `backend` las suites `npm run test:lead:intake`, `npm run test:lead:flow` y `npm run test:lead:concurrency` en secuencia. Los casos usan datos sintéticos y revierten o limpian sus registros. Para detener el piloto de chat, desactivar `LEAD_CHAT_QA` y reiniciar el backend. El historial queda disponible en SQL Server y se puede volver a habilitar el chat con las mismas condiciones.

Pasaron las tres suites de backend en la copia existente y ambas compilaciones, incluida la del frontend con el chat habilitado. Pasaron 52 pruebas de frontend en 15 archivos. La validación cubre recepción y F1, chat, negociación, reserva y concurrencia. La regresión comercial verificó M1, M3 y M6 para un caso aceptado. La conciliación completa de M1–M8 y L1–L3 queda fuera de la evidencia de este ensayo. También quedan pendientes la prueba visual en navegador, la integración real con BUYER y PAYER, el adaptador de Gemini y sus evaluaciones, las políticas de seguimiento y delegación, y la preparación de un paquete productivo con respaldo y recuperación.
## Piloto Gemini para el personal en QA

El adaptador clasifica el mensaje de paciente seleccionado con hasta tres mensajes previos de la misma conversación. Devuelve una sugerencia predefinida para que el personal la revise. La sugerencia se devuelve al solicitante y las decisiones comerciales siguen sus flujos existentes.

Para probarlo, usar el chat de `NexoSalud_LeadPruebas` con `LEAD_CHAT_QA=true`, `LEAD_GEMINI_QA=true`, la clave local `GEMINI_API_KEY` y un `LEAD_GEMINI_MODEL` disponible para esa clave. Con sesión de administrador o del negociador asignado, enviar un POST a `/lead/commercial/chat/staff/:id/suggestion` bajo el prefijo de la API, con `id_mensaje` y `datos_sinteticos: true`. Usar una conversación enteramente sintética, ya que se transmite texto libre al proveedor. La pausa del chat bloquea esta operación.

Cada intento realiza como máximo una llamada, con un plazo de ocho segundos. El backend reutiliza hasta 256 sugerencias en memoria, admite una llamada simultánea y espera 60 segundos entre intentos por proceso. Reiniciar el backend reinicia estos controles. El piloto expone la ruta para pruebas y la interfaz del chat queda pendiente de conectar.

Verificación local desde `backend` con `npm run build` y `node --require tsx/cjs --test tests/leadGemini.test.ts`. Con la URL de QA y los indicadores anteriores, `npm run test:lead:flow` verifica la ruta con Gemini simulado por defecto. Para el ensayo real, activar `LEAD_GEMINI_QA_LIVE_TEST=true` y usar el modelo y la clave configurados. El ensayo limita a una sola solicitud al proveedor y revierte sus datos.

El flujo HTTP + SQL pasó en QA con el proveedor simulado y con una llamada real a `gemini-3.1-flash-lite`. El mensaje sintético sobre disponibilidad por la tarde obtuvo `HORARIO`. Las solicitudes inválidas no llamaron al proveedor y la repetición devolvió la sugerencia guardada en memoria. El ensayo confirmó la reversión de los datos de prueba.
