# Entrega de BUYER y LEAD para el equipo

Esta es la guía principal para continuar **PAYER, CUSTOMER y TURNED**. La OLTP de BUYER y LEAD está instalada en **`NexoSaludDB`** e incluye la captación, la conversión trazable, la negociación comercial y las consultas R1–R3. Las **nueve dimensiones y los cinco hechos de LEAD** están instalados en **`NexoSalud_Mart`**. [Estado, dependencias y orden de ejecución del Mart](#7-data-mart-de-lead).

La recepción del futuro agente se documenta en el [contrato BUYER → LEAD](CONTRATO_BUYER_LEAD.md).

El [plan del agente LEAD](PLAN_AGENTE_LEAD.md) registra el avance, las políticas pendientes y el contrato de salida a PAYER.

**Paquete de instalación actualizado en preparación.** La sección 8 registra el inventario y el avance del paquete reproducible. Los scripts de despliegue anteriores son evidencia de instalaciones realizadas; todavía no constituyen un instalador universal para una laptop nueva.

La rama `lead` incluye el paquete SQL, el esquema Prisma, las rutas de BUYER y LEAD y el panel de reportes R1–R3. Para usar la aplicación, configuren el backend para una OLTP con las migraciones de la sección 6 ya aplicadas. Ejecuten `npm run prisma:generate` y `npm run build` en `backend`. En `frontend`, `npm test` ejecuta las pruebas de componentes y rutas simuladas, y `npm run build` compila la interfaz. Las pruebas que escriben en SQL requieren una copia de QA.

El nuevo espacio de trabajo LEAD está disponible para revisión en QA. Con el backend apuntando a `NexoSalud_LeadPruebas`, activen `VITE_LEAD_WORKSPACE=true` al iniciar Vite. La bandeja en `/lead` lista solicitudes con ingreso documentado y cada detalle se abre por `id_solicitud`. Los enlaces anteriores por paciente abren un selector. Esta entrega es de consulta. La edición comercial y el traspaso a PAYER se habilitarán conforme se validen sus contratos. El flujo anterior sigue disponible con la configuración predeterminada.

La bandeja ordena primero los seguimientos vencidos, luego los programados para el resto del día en Lima, después las oportunidades pendientes sin primera respuesta registrada y finalmente las demás. Los filtros de servicio, negociador, ingreso, seguimiento y estado se aplican en la API antes de paginar. Las fechas de seguimiento se interpretan como instantes UTC y se muestran en hora de Lima. Las oportunidades cerradas o archivadas conservan sus fechas sin generar alertas operativas.

En el detalle, «Alternativas» distingue las preferencias del paciente, las ofertas auditadas y la agenda de candidatos. La agenda consulta por solicitud y fecha, y exige servicio, sede y profesional activos, habilitación profesional para el servicio y un horario futuro en Lima. Las condiciones de cada oferta se leen de la primera y última observación del historial. Un estado base se identifica como tal. Consultar la agenda no registra ofertas ni reserva horarios. La edición, las decisiones y el archivo desde el espacio nuevo requieren acceso del personal y validación dentro de la escritura.

«Propuestas económicas» agrupa las versiones por propuesta raíz. Presenta la versión vigente y sus antecedentes con precio cotizado, promoción registrada y decisión. La tarifa de referencia se toma del servicio activo y su período de vigencia. Las promociones de catálogo son activas y compatibles con ese servicio. La pantalla separa esas referencias del importe cotizado y del acuerdo registrado.

En QA, el personal autorizado puede registrar cotizaciones ya presentadas y añadir versiones a una propuesta vigente. Se registra el precio declarado y se conserva el nombre de la promoción al presentar la versión. Los cambios no reescriben cotizaciones anteriores. Un reintento con las mismas condiciones y la misma lista de versiones puede recuperar el registro ya creado.

La aceptación o el rechazo de una cotización se registra sobre su versión vigente, tras confirmar que el paciente comunicó la decisión. Un rechazo requiere un motivo activo de ámbito `PROPUESTA`. Una decisión guardada se conserva al repetirla y bloquea una decisión distinta sobre la misma versión. La aceptación de la cotización es un paso separado del acuerdo comercial de la solicitud.

El resultado comercial de la solicitud se registra por separado en QA. El acuerdo exige confirmación expresa y toma el valor de una versión vigente aceptada. El cierre sin acuerdo exige un motivo y se bloquea si existe una reserva vinculada. Registrar el resultado no crea reservas ni cambia la etapa de la persona.

«Actividad y seguimiento» carga la bitácora por solicitud al abrir la sección. Muestra canal, autor y la clasificación registrada cuando existen. Una entrada en la bitácora no acredita entrega de un mensaje. Los hitos comerciales se muestran por fecha registrada, separados de la hora de Lima del próximo seguimiento. La consulta conserva el historial de solicitudes cerradas o archivadas.

«Preparación para PAYER» y los scripts QA descritos originalmente arriba son evidencia del diseño anterior; el procedimiento operativo vigente de CAP-05 se instaló después y se describe a continuación.

**Acceso del personal en QA y habilitación operativa.** En QA, `LEAD_STAFF_AUTH_QA=true` en backend y `VITE_LEAD_STAFF_AUTH_QA=true` en frontend limita el login a `NexoSalud_LeadPruebas`. Para habilitación operativa se requiere configurar explícitamente `LEAD_STAFF_AUTH_ENABLED=true` en backend y `VITE_LEAD_STAFF_AUTH_ENABLED=true` al compilar/iniciar frontend. El login valida una contraseña `scrypt-v1` contra la cuenta activa de `Usuarios`; acepta los roles `Administrador` y `Negociador`, y vuelve a verificar la cuenta y la asignación a la solicitud en cada escritura protegida. Los tokens aleatorios duran 30 minutos y se mantienen en memoria del proceso; reiniciar el backend cierra las sesiones. Al activar el modo operativo, las escrituras comerciales heredadas se rechazan con HTTP 410, excepto la prerreserva pública del paciente. El modo no está activado en las bases ni en los archivos de entorno.

Las cuentas creadas por la ruta antigua de Configuración usan una contraseña inicial que no es válida para LEAD. Para provisionar una credencial, ejecuten desde `backend` `npm run lead:staff:provision -- --qa` con la conexión apuntando a `NexoSalud_LeadPruebas`. Para `NexoSaludDB`, el comando requiere `--production`, conexión verificada y escribir la frase de confirmación exacta; solicita la contraseña sin mostrarla y actualiza solo `Usuarios.password_hash`. Este proceso aún no se ha ejecutado en la base principal. No activen `LEAD_STAFF_AUTH_ENABLED` hasta haber provisionado las cuentas necesarias y coordinado la habilitación del nuevo espacio LEAD.

**Programación de seguimiento en QA.** Tras verificar el acceso del personal se puede programar, reprogramar o cancelar el próximo seguimiento de una oportunidad abierta. `PATCH /api/lead/commercial/opportunities/:id/follow-up` recibe la fecha local de Lima en `fecha_lima` (o `null` para cancelar) y la fecha UTC que se estaba consultando en `fecha_esperada_utc` (o `null`). El servidor comprueba sesión, asignación y fecha anterior en la misma transacción. Un conflicto requiere revisar la fecha vigente antes de reintentar. El cambio usa el campo existente de la solicitud. El esquema actual carece de un historial específico de cambios de seguimiento con actor y fechas anterior y nueva.

El personal autorizado puede registrar una nota de contacto o una respuesta del paciente en la bitácora. El servidor vincula la nota con la solicitud y la cuenta autenticada. Una respuesta marcada como útil fija la fecha de primera respuesta solo si todavía está vacía. Si se añade otra entrada mientras se escribe, el formulario conserva el borrador y permite revisar la bitácora antes de volver a guardar.

**Registro de alternativas en QA.** Tras verificar el acceso del personal, consulta la agenda, elige un candidato y confirma el turno y precio ofrecidos. Puedes vincular una versión vigente de propuesta y una preferencia vigente del paciente. La API vuelve a verificar el horario, profesional, sede y reservas en la transacción, y guarda la oferta pendiente con el historial SQL existente. Un reintento idéntico recupera la oferta pendiente si es la única nueva respecto a la lista consultada. Si el conjunto cambió de otra manera, hay que revisar el detalle y volver a confirmar.

**Gestión de alternativas en QA.** El personal autorizado puede modificar horario o turno de una alternativa pendiente, dejando el motivo y conservando el precio y la preferencia. También puede registrar aceptación o rechazo, con un motivo tipificado para el rechazo, y archivar opciones no seleccionadas sin borrar su historial. La API exige la revisión consultada y bloquea las acciones en opciones con reserva, incluso cancelada. Registrar aceptación no crea una reserva.

**Validación en navegador del espacio de consulta.** Con Vite y las rutas comerciales de lectura conectadas a `NexoSalud_LeadPruebas`, se comprobó la búsqueda por solicitud, la apertura y recarga del detalle, las consultas de alternativas, propuestas, actividad y preparación para PAYER, y el acceso a R1–R3. Se probaron los anchos de 1280, 390 y 320 px. El teclado permitió abrir el detalle y sus secciones y desplazar la tabla de R1; las tablas de R1 y R3 conservaron el desplazamiento dentro del contenedor a 390 y 320 px, respectivamente. Esta prueba cubre el flujo de consulta. La validación de escrituras del espacio nuevo y la aceptación de la integración con PAYER requieren los contratos indicados arriba.

En la misma copia pasó la regresión SQL de conversión idempotente BUYER → LEAD, historial y reportes, con reversión al finalizar. Al ejecutar [PRUEBA_INTEGRACION_LEAD.sql](PRUEBA_INTEGRACION_LEAD.sql) mediante `sqlcmd`, usen `-I` para habilitar `QUOTED_IDENTIFIER`, requerido por los índices filtrados.

**Ensayo integral reproducible de las rutas nuevas.** En backend, con `SQLSERVER_URL` apuntando a `NexoSalud_LeadPruebas` y ambos scripts de QA instalados, ejecuten `npm run test:lead:flow`. La prueba rechaza otras bases. Registra una captación, convierte a LEAD, autentica al negociador, registra una respuesta útil, presenta y versiona una cotización, acepta una alternativa, guarda el acuerdo, registra la autorización y traspasa a una reserva pendiente. Comprueba los reintentos, M1/M3/M6 y la reversión de los datos y conteos, incluidos los historiales. El escenario usa una transacción QA compartida por las rutas HTTP. La concurrencia entre conexiones independientes requiere un ensayo separado.

**Concurrencia del traspaso.** Con la misma configuración QA, `npm run test:lead:concurrency` usa conexiones SQL independientes. Crea casos sintéticos confirmados y elimina exclusivamente esos registros al terminar, incluidos sus historiales. Prueba dos envíos del mismo traspaso, dos solicitudes que compiten por un horario y un fallo intencional después de crear la reserva. El servidor adquiere el bloqueo transaccional `NexoSalud:LEAD:PAYER` antes de leer las condiciones, para ordenar los traspasos del flujo nuevo y evitar la espera circular al actualizar un horario.

### CAP-05 · Traspaso vigente a PAYER

El **11/11/2026** se instaló con autorización en `NexoSaludDB` el incremento [11_TRASPASO_PAYER_LEAD.sql](11_TRASPASO_PAYER_LEAD.sql). Su SHA-256 verificado fue `EE32E607B8C8FF7BC90C91ECCC8CC28B303C476A5392B53FC1A0228C1808E5EF`. Añade `AccesosPreReservaLead`, que guarda únicamente el hash del token privado y su vigencia, y `TraspasosPayerLead`, que vincula solicitud, persona, opción, propuesta, reserva, evento, evidencia y clave idempotente. El respaldo previo fue `NexoSaludDB_pre_CAP05_43987AFC8DA64BCDA11A45DDCE95C464.bak`; `RESTORE VERIFYONLY WITH CHECKSUM` terminó correctamente.

En la Mesa, **Pre-Reserva** genera un enlace privado de un solo expediente y condiciones. **Cerrar Trato** muestra servicio, precio, sede, profesional, horario y vencimiento verificados; exige marcar por separado aceptación comercial y autorización de reserva, y registrar la evidencia declarada. En el formulario público, el paciente debe confirmar la misma oferta y el consentimiento de contacto. No se puede cambiar el horario desde ese enlace. Los avisos externos siguen siendo una acción del asesor; crear el enlace no envía WhatsApp ni correo.

**Integración futura con WhatsApp/OpenWA (coordinación BUYER–LEAD).** OpenWA todavía no está conectado a CAP-05: LEAD no recibe mensajes de WhatsApp ni convierte automáticamente un “sí” del chat en aceptación o reserva. El equipo BUYER puede usar su integración para entregar al paciente el enlace privado que LEAD genera; debe conservar la URL completa, incluido `#token=...`, y tratar ese token como secreto (no registrarlo en logs ni compartirlo entre conversaciones). El paciente confirma la oferta y autoriza la reserva en la página segura. Si luego se acuerda aceptar confirmaciones directamente por WhatsApp, antes habrá que definir un contrato entre equipos que vincule el mensaje entrante con `id_persona`, `id_solicitud` y `id_opcion`, conserve su ID externo/canal/fecha como evidencia, deduplique reintentos y vuelva a validar precio y horario; un texto ambiguo o una clasificación de IA no sustituye la aceptación y autorización expresas. El webhook, la recepción de respuestas y el envío automatizado no forman parte de este despliegue.

El backend verifica dentro de una transacción que la propuesta sea la versión vigente y no vencida, que el precio coincida con la opción, que el horario ofrecido siga libre y futuro en hora de Lima, y que sede, servicio y especialista estén activos y relacionados. También rechaza reservas existentes y solapamientos del mismo especialista. La transacción ocupa el horario, registra aceptación, reserva pendiente, etapa PAYER, evento y recibo idempotente; un reintento recupera la misma reserva. Los enlaces guardan el hash del token y no exponen el token en el encabezado Referer. El pago **no** se crea ni valida en LEAD; PAYER muestra esa reserva como `PENDIENTE` hasta que su equipo registre el pago.

El preflight e instalación conservaron los conteos y checksums agregados de `Personas` (806), `Solicitudes` (311), `Opciones` (318), `PropuestasEconomicasLead` (8), `Reservas` (126), `Pagos` (124) y `EventosEtapa` (1493). Los conteos/checksums anteriores y posteriores coincidieron; el incremento dejó ambas tablas nuevas vacías. `NexoSalud_Mart` y sus nueve dimensiones/cinco hechos no se modificaron. No se instalaron reservas ficticias. El detalle operativo, las huellas y el respaldo utilizado se resumen aquí; no se guarda el archivo `.bak` en el repositorio.

El ensayo HTTP de CAP-05 en `NexoSalud_LeadPruebas` comprobó validaciones, reintentos, concurrencia, rollback inyectado, acceso privado, agenda, rechazo de datos manipulados, integración de la ruta existente del personal y lectura de la reserva como pendiente en PAYER sin pago. Resultado más reciente: **26 comprobaciones aprobadas**. También pasaron `npm run build` del backend, las pruebas de componentes/rutas del frontend y su compilación; la prueba visual en navegador queda pendiente porque la automatización de navegador está deshabilitada en esta sesión. Las pruebas usan fixtures sintéticos solo en QA y los eliminan al terminar.

Para repetir el ensayo en QA, desde `backend`, ejecuten `npm run test:lead:payer`; el script fuerza `NexoSalud_LeadPruebas` y se niega a correr contra otra base. Para operar la aplicación, abran una negociación con una alternativa registrada: utilicen **Pre-Reserva** para generar el enlace privado o **Cerrar Trato** para confirmar en la Mesa. No vuelvan a ejecutar el SQL11 sobre la base instalada ni usen enlaces antiguos que no incluyan el token privado.

**Límites conocidos:** el modo de autenticación del personal sigue apagado hasta provisionar las credenciales descritas arriba; con el modo apagado se preserva el acceso local previo sin inventar un usuario. Los traspasos históricos sin recibo CAP-05 se bloquean para conciliación manual, no se reconstruyen como si se hubiera registrado una aceptación. Los despliegues del Mart y de otras fases permanecen fuera de CAP-05.

## 1. Qué cambió en la base

La migración fue aditiva. Conservó las tablas y los identificadores existentes y agregó estos objetos de negocio y auditoría.

| Tabla nueva | Para qué sirve |
| --- | --- |
| `CaptacionesBuyer` | Guarda una captación inicial por persona. Conserva fecha, canal, fuente, campaña, sede, servicio, motivo, calidad y autorización cuando hay evidencia. |
| `PropuestasEconomicasLead` | Guarda las cotizaciones de una solicitud, con tratamiento, sede opcional, precio, promoción, fechas y resultado. La raíz identifica la propuesta y cada revisión tiene su propio ID y número de versión. |
| `PromocionesLead` y `MotivosRechazoLead` | Catalogan promociones y motivos tipificados. Los motivos se separan por ámbito, propuesta o alternativa, y por categoría. |
| `CambiosOpcionLead` | Registra modificaciones comerciales a una opción sin crear otra alternativa para el conteo. Identifica los cambios previos a una reserva. |
| `HistorialSolicitudesLead`, `HistorialPropuestasLead` e `HistorialOpcionesLead` | Guardan los estados observados y sus fechas UTC. El historial de opciones conserva también la fecha, horario, sede y profesional que se ofrecieron. |
| `ConfiguracionLeadRevision` | Fija el inicio de la auditoría para saber desde cuándo se pueden consultar cortes históricos de LEAD. |

En las **tablas compartidas** quedaron estas extensiones:

- `EventosEtapa` enlaza la transición BUYER → LEAD con `id_captacion`, `id_solicitud` y una `clave_operacion_buyer` única cuando se registra. `DecisionesIA` puede referenciar una captación y una interacción.
- `Solicitudes` conserva el ID de la oportunidad. Se añadieron fecha de ingreso a LEAD, canal de origen, sede de interés, negociador, próximo seguimiento y los campos de decisión comercial, importe, propuesta aceptada y motivo de cierre. También se añadieron la marca de archivo y la clave y huella para los reintentos web.
- `Opciones` conserva el ID de la alternativa y su disponibilidad. Se añadieron el resultado y su fecha, el motivo de rechazo, las referencias a la propuesta y la preferencia, los datos de horario preferido y turno ofrecido, y la marca de archivo. `Interacciones.id_solicitud` permite vincular comunicaciones a una oportunidad de la misma persona.

## 2. De BUYER a LEAD

1. El alta habitual registra `Personas` y la captación en una transacción. Si hay una coincidencia inequívoca de identidad, el flujo de alta reutiliza a la persona. La restricción única sobre `CaptacionesBuyer.id_persona` impide duplicar su captación.
2. `dbo.usp_ConvertirBuyerALead` recibe la captación, el servicio y el motivo. Verifica calidad, contacto utilizable, autorización y servicio activo. Crea la solicitud, enlaza el evento BUYER → LEAD y actualiza la etapa de la persona en una transacción. Un reintento devuelve los identificadores de la conversión existente. Los registros históricos sin vínculo comprobado no deben completarse por inferencia.
3. El formulario web probado vincula el ingreso a su solicitud. Repetir el mismo contenido con la misma clave de idempotencia devuelve esa solicitud. Una consulta nueva puede abrir otra oportunidad de la misma persona sin duplicar su identidad.

## 3. Cómo funciona LEAD

- **Oportunidad.** Se trabaja por `id_solicitud`. El resultado comercial puede ser `PENDIENTE`, `ACEPTADA` o `CERRADA_SIN_ACUERDO`. `NULL` indica que no hay resultado documentado. Aceptar exige evidencia comercial expresa y una propuesta aceptada de la misma solicitud con el importe acordado. Cerrar sin acuerdo exige fecha y motivo. Reservar o pagar no acredita por sí solo un acuerdo.
- **Propuesta.** La raíz tiene versión 1 y `id_propuesta_raiz` nulo. Un cambio de precio o promoción crea una nueva versión ligada a la misma raíz. Una decisión guarda estado y fecha. El rechazo usa el motivo tipificado de ámbito `PROPUESTA`. Para R2 se toma la versión vigente al corte y se cuenta la raíz una sola vez.
- **Alternativa.** Se usa una disponibilidad vigente y se guardan los datos preferidos y ofrecidos. `dbo.usp_Lead_PresentarAlternativa` permite registrar la oferta en SQL y valida sus vínculos. El rechazo requiere fecha y motivo de ámbito `ALTERNATIVA`. Una modificación previa a la reserva conserva el mismo `id_opcion` y deja evidencia. Para cambiar el horario, se referencia otra disponibilidad. Los disparadores protegen el horario ya ofrecido y las condiciones de opciones con reserva.
- **Historial.** Los disparadores capturan las escrituras desde el inicio de la auditoría. El archivo lógico permite retirar una solicitud u opción de la mesa sin perder su evidencia. Los históricos sin datos suficientes se mantienen sin clasificar. Cambiar el ámbito o la categoría de un motivo ya usado alteraría el KPI histórico y está bloqueado.

## 4. Contrato con PAYER, CUSTOMER y TURNED

| Etapa | Cómo continuar con las tablas existentes |
| --- | --- |
| **PAYER** | Usar `Reservas.id_persona`, `id_solicitud` e `id_opcion` para conservar el vínculo con la negociación y la opción elegida. Verificar que las tres referencias correspondan entre sí. Registrar pagos en `Pagos` vinculados a la reserva. Mantener separados el importe cobrado, el precio ofrecido y el valor del acuerdo comercial. |
| **CUSTOMER** | Usar `Atenciones.id_reserva` y conservar la persona, servicio, sede y profesional de la atención. Registrar asistencia y prestación en `Atenciones`. Actualizar esos estados clínicos sin reescribir la solicitud, la oferta ni el pago anterior. |
| **TURNED** | Conservar `id_persona` y `id_atencion` al registrar seguimientos en `Seguimientos`. Usar `EventosEtapa` para documentar transiciones. Si se abre otra solicitud para la misma persona, vincularla a su identidad existente. `Incidencias` conserva sus referencias a reserva, pago o atención según corresponda. |

**Al extender el esquema**, mantengan las claves primarias y foráneas, los campos de fecha y los disparadores de auditoría. Una reprogramación debe conservar la evidencia del horario original. Eviten borrar solicitudes u opciones con historia, cambiar sus IDs o reclasificar motivos para corregir resultados. Usen migraciones incrementales y prueben en una restauración las escrituras nuevas, las restricciones y el resultado de los reportes.

La validación de las etapas posteriores sigue a cargo de sus equipos. En las pruebas exploratorias se detectaron estados que las rutas existentes intentaban escribir y que las restricciones no admitían. En la copia, `Pagos.estado` admitía `Confirmado` y rechazó `Validado`. En `Atenciones`, se rechazó `Confirmada` como asistencia y `Finalizado` como estado del servicio. También se detectó que una reactivación desde TURNED podía crear otra persona antes de fallar al crear la solicitud. Revisen esos contratos en copia antes de reutilizar esas rutas.

## 5. Medidas e indicadores desde la OLTP

| Grano | Medidas binarias por registro | Indicador |
| --- | --- | --- |
| Una solicitud ingresada a LEAD | **M1** oportunidad aceptada, **M2** oportunidad cerrada sin acuerdo. | **L1** = 100 × ΣM1 / (ΣM1 + ΣM2) |
| Una propuesta raíz, con su versión vigente al corte | **M3** propuesta aceptada, **M4** propuesta rechazada, **M5** propuesta rechazada por motivo económico. | **L2** = 100 × ΣM5 / (ΣM3 + ΣM4) |
| Una opción ofrecida, con independencia de sus modificaciones | **M6** alternativa aceptada, **M7** alternativa rechazada, **M8** alternativa rechazada por incompatibilidad. | **L3** = 100 × ΣM8 / (ΣM6 + ΣM7) |

Los pendientes y los casos sin evidencia quedan fuera de los denominadores. El resultado sin denominador es `NULL` («No calculable»). M5 y M8 requieren un rechazo y su motivo tipificado. Una diferencia de horario no constituye por sí sola una incompatibilidad rechazada.

El panel muestra el período consultado y el corte que aplicó la API, en hora de Lima y UTC. R1 conserva el selector de corte. R2 y R3 muestran el corte de ejecución del servidor. Sus totales se presentan junto al indicador para distinguirlos del detalle filtrado por motivo.

Las vistas `dbo.v_OrigenMedidasOportunidadLead`, `dbo.v_OrigenMedidasPropuestaLead` y `dbo.v_OrigenMedidasAlternativaLead` exponen el estado actual. Las funciones `dbo.fn_Lead_Oportunidades_Corte`, `dbo.fn_Lead_Propuestas_Corte` y `dbo.fn_Lead_Alternativas_Corte` reconstruyen el estado observado a un corte UTC. `dbo.usp_Lead_ReporteR1`, `dbo.usp_Lead_ReporteR2` y `dbo.usp_Lead_ReporteR3` consultan, respectivamente, negociaciones, propuestas y alternativas. En R2 y R3 el filtro de motivo acota el detalle. El KPI conserva todos los motivos de la población delimitada por los demás filtros.

## 6. Qué ejecutar y qué quedó validado

- **Para continuar sobre `NexoSaludDB`**, usen el esquema instalado. [`VERIFICAR_OLTP_INSTALADO.sql`](VERIFICAR_OLTP_INSTALADO.sql) comprueba medidas y restricciones. Los scripts de comparación de catálogo y filas sirven para contrastar con una restauración de referencia.
- **Para instalar en una copia compatible todavía sin migrar**, el punto de entrada aprobado es [`APLICAR_BUYER_LEAD.sql`](APLICAR_BUYER_LEAD.sql). Para el ensayo, el instalador admite `NexoSalud_LeadEnsayoFinal` como destino explícito. Ejecuta [`01_BUYER_OLTP.sql`](01_BUYER_OLTP.sql) y [`INSTALAR_LEAD_COMPLETO.sql`](INSTALAR_LEAD_COMPLETO.sql), en ese orden y en una transacción. Sigan el [procedimiento de instalación, huellas y recuperación](PROCEDIMIENTO_INSTALACION_OLTP.md). No repitan el instalador sobre la base ya actualizada ni ejecuten los inicializadores de la base para incorporar cambios de otras etapas.
- **Pruebas.** Se verificaron el respaldo y su restauración, la conservación de las filas originales de 31 tablas, el esquema y las restricciones. En una restauración posterior a la instalación pasaron la conversión idempotente, el corte de versiones, la conservación de alternativas y sus modificaciones, M1–M8 y R1–R3. [`PRUEBA_INTEGRACION_LEAD.sql`](PRUEBA_INTEGRACION_LEAD.sql) usa datos sintéticos con rollback y rechaza la base principal. El [informe de instalación](RESULTADOS_INSTALACION_OLTP.md) registra los resultados reales.
- **Pendientes.** En la principal aún no había conversiones documentadas ni casos resueltos al corte de verificación. Falta observar la primera conversión real, validar el poblamiento con los primeros resultados comerciales acreditados y completar las pruebas de PAYER, CUSTOMER y TURNED.

## 7. Data Mart de LEAD

El **9 de noviembre de 2026** se instalaron nueve dimensiones. Se reutilizaron `Dim_Tiempo`, `Dim_Servicio`, `Dim_Canal`, `Dim_Sede`, `Dim_Negociador` y `Dim_Profesional`, y se agregaron `Dim_Promocion`, `Dim_MotivoRechazo` y `Dim_Horario`. Horario representa los roles preferido y ofrecido. [Diseño y pruebas](mart_dimensiones/README.md) · [Informe de instalación de dimensiones](mart_dimensiones/RESULTADO_DESPLIEGUE_MART_LEAD.md).

El **10 de noviembre de 2026** se instalaron los cinco hechos agregados con claves primarias compuestas y 25 claves foráneas. El ETL usa las unidades y medidas de la [sección 5](#5-medidas-e-indicadores-desde-la-oltp) y suma las operaciones por combinación dimensional. [Grano, claves y consultas de verificación](mart_hechos/README.md).

| Hecho instalado | Medidas |
| --- | --- |
| `fact_oportunidades_lead` | M1, M2 |
| `fact_propuestas_aceptadas_lead` | M3 |
| `fact_propuestas_rechazadas_lead` | M4, M5 |
| `fact_alternativas_aceptadas_lead` | M6 |
| `fact_alternativas_rechazadas_lead` | M7, M8 |

Al instalar, M1–M8 conciliaron en cero en ambas bases porque todavía no había resultados comerciales acreditados. Las dimensiones y los cinco hechos heredados conservaron sus filas y medidas. El informe corresponde a la carga inicial. El panel R1–R3 consulta la OLTP. La programación de cargas periódicas y los dashboards sobre el Mart quedan fuera de esta entrega. [Informe de instalación de hechos](mart_hechos/RESULTADO_DESPLIEGUE_HECHOS_LEAD.md).

**Dependencias entre etapas.** LEAD usa el ingreso BUYER documentado y las dimensiones compartidas. La actualización del hecho BUYER, su hecho de inversión y su ETL completo se coordinan por separado. PAYER consume las referencias de reservas y pagos descritas en la sección 4. Su nuevo paquete dimensional tampoco es un prerrequisito de LEAD y su despliegue sigue separado. Si se programan cargas concurrentes, coordinen la ventana. BUYER y LEAD usan el mismo recurso de bloqueo en la OLTP. El recurso auditado de PAYER está en el Mart y no los serializa. [Auditoría de compatibilidad](auditoria_dimensional/DIAGNOSTICO_INTEGRACION.md).

**Orden aplicado.** En una restauración compatible que aún necesite la instalación, reproducir **OLTP BUYER → LEAD**, luego **dimensiones** y después **hechos**, siguiendo las guardas de cada entorno. En las bases principales ya actualizadas, usar los controles de lectura. Las guías de ventana documentan la instalación inicial y el procedimiento de recuperación.

**Seguimiento operativo CAP-01/CAP-04, instalado el 11/11/2026.** El incremento [10_SEGUIMIENTO_OPERATIVO_LEAD.sql](10_SEGUIMIENTO_OPERATIVO_LEAD.sql) creó el estado y el historial de seguimiento en NexoSaludDB con autorización del usuario. Las prioridades se calculan en lectura y se actualizan en la interfaz cada 30 segundos. El bloque de la Mesa permite programar, pausar, cancelar y preparar un borrador. La generación con IA, la evaluación automática en segundo plano y la trazabilidad de autor en el modo sin sesión siguen pendientes.

**Personalización del borrador, 11/11/2026.** El generador local usa el nombre y servicio, las dos últimas interacciones de tipo `Respuesta del paciente` vinculadas a la misma solicitud y las últimas versiones pendientes de cada propuesta raíz. Cita las respuestas como evidencia y adapta la continuación a precio, sede, horario o especialista. No interpreta el motivo operativo del asesor como palabras del paciente. Solo menciona un precio cuando hay una única propuesta elegible y su vigencia supera tanto la fecha actual como la del seguimiento; con varias propuestas no asume cuál fue elegida. Sin evidencia suficiente pide comprobar condiciones, sin inventar horarios, descuentos ni aceptación. No consulta Gemini ni realiza envíos. `Actualizar mensaje` regenera explícitamente un borrador PREPARADO con control de revisión y nueva clave; un reintento normal de preparación recupera el existente y un envío FALLIDO conserva su contenido y clave. Los borradores existentes no se reescriben automáticamente. Antes de conectar OpenWA sigue siendo necesario reclamar trabajos, coordinar las actualizaciones con el emisor y revalidar el contexto al enviar.

Validación de esta mejora: ocho pruebas del generador, dos de prioridad y 19 de controles Gemini aprobadas; compilaciones de backend y frontend aprobadas (Vite advierte tamaño de bundle). La consulta de solo lectura a la principal encontró dos seguimientos PREPARADO: solicitud 55 sin respuestas del paciente ni propuestas vinculadas y solicitud 139 con 12 respuestas y una propuesta. Esta lectura no demuestra el recorrido completo del botón en navegador; esa comprobación queda pendiente. No se alteraron datos ni esquema para esta mejora.

Se creó el respaldo COPY_ONLY con CHECKSUM `NexoSaludDB_pre_seguimiento_A077F286-9A8E-48AE-97BA-01F172891837.bak` en el directorio predeterminado de SQL Server. RESTORE VERIFYONLY WITH CHECKSUM confirmó su validez. Se verificaron las operaciones HTTP en una transacción revertida, incluidos conflicto de revisión, bloqueo por pausa, preparación repetida sin duplicación y cancelación. La primera ejecución detectó una incompatibilidad al parametrizar UUID NULL, corregida mediante conversión SQL explícita antes de repetir satisfactoriamente la verificación. Las tablas nuevas quedaron con cero filas. Se conservaron los conteos y checksums agregados de Personas (806), Solicitudes (311), Interacciones (13), Opciones (317), Reservas (126) y PropuestasEconomicasLead (7). Los checksums agregados son una conciliación adicional, no huellas criptográficas. La API devolvió instalado=true y 199 solicitudes en la consulta de prioridades.

El futuro conector usa `GET /api/lead/operational/connector/pending` para consultar mensajes preparados cuyo plazo venció, y `POST /api/lead/operational/connector/result` para confirmar `clave_envio`, `estado` (ENVIADO/FALLIDO) e `id_externo`. Ambos requieren `Authorization: Bearer <LEAD_FOLLOWUP_CONNECTOR_TOKEN>`, configurado fuera de Git. Una consulta de pendientes no reclama el mensaje. Antes de habilitar varios procesos de envío deberá añadirse un mecanismo de reclamación y acordarse la idempotencia con OpenWA. La política de frecuencia usa `LEAD_FOLLOWUP_MIN_HOURS` y bloquea un nuevo contacto posterior a un envío cuando esa política falta. La integración de WhatsApp y su consentimiento específico deben validarse antes de conectar el envío.

1. OLTP con [`APLICAR_BUYER_LEAD.sql`](APLICAR_BUYER_LEAD.sql) y su [procedimiento](PROCEDIMIENTO_INSTALACION_OLTP.md).
2. Dimensiones con [`09_APLICAR_DIMENSIONES.sql`](mart_dimensiones/09_APLICAR_DIMENSIONES.sql), según el [procedimiento dimensional](mart_dimensiones/PRE_DESPLIEGUE_MART_LEAD.md).
3. Hechos con [`08_APLICAR_HECHOS.sql`](mart_hechos/08_APLICAR_HECHOS.sql) y su [procedimiento de ventana](mart_hechos/PRE_DESPLIEGUE_HECHOS_LEAD.md). La conciliación posterior se puede reproducir con [`04_VALIDAR_HECHOS.sql`](mart_hechos/04_VALIDAR_HECHOS.sql), usando los parámetros del entorno.

## 8. Paquete reproducible de instalación y datos de presentación

### Avance por fases

| Fase | Estado | Entrega |
| --- | --- | --- |
| 1. Inventario | Completado el 11/11/2026, Lima | Catálogo observado, correspondencia con fuentes, dependencias y diferencias enumeradas abajo. |
| 2. OLTP completa | Pendiente | Consolidar la base de BUYER y las ampliaciones de LEAD, incluidos los incrementos 09, 10 y 11. |
| 3. Estructura del Mart | Pendiente | Resolver la diferencia de versión BUYER antes de consolidar la estructura compartida y los cinco hechos LEAD. |
| 4. Cargas del Mart | Pendiente | Dimensiones y hechos por separado, SQL sencillo y conciliación independiente. |
| 5. Datos ficticios OLTP | Pendiente | Cohorte identificable, historial coherente y resultados esperados definidos antes de insertar. |
| 6. Validación integral | Pendiente | Instalación desde vacío, reejecución, OLTP/reportes/Mart y recorridos de interfaz. |
| 7. Entrega portátil | Pendiente | Requisitos, comandos ordenados, conexiones locales y pasos de presentación. |

El orden final de ejecución será **estructura OLTP → estructura Mart → datos ficticios OLTP → dimensiones → hechos → validación → aplicación**. Las cargas analíticas no crearán decisiones comerciales ficticias. El nuevo paquete se alojará en `instalacion_actualizada/`; por ahora contiene exclusivamente el inventario, no scripts de instalación o poblamiento listos para ejecutar.

### Resultado del inventario de lectura

Fuentes: instancia `ANTHONY`, SQL Server `16.0.1000.6`, bases `NexoSaludDB`, `NexoSalud_Mart` y catálogo de la copia ya existente `NexoSalud_LeadPruebas`. Las tres estaban ONLINE y de lectura/escritura. Esta fase solo ejecutó SELECT sobre catálogos y agregados; no creó bases ni modificó esquema o registros.

[Consulta reutilizable de inventario](instalacion_actualizada/00_INVENTARIAR.sql) · [Manifiesto de metadatos y huellas de fuentes](instalacion_actualizada/MANIFIESTO_ORIGEN.json).

| Base principal | Tablas de aplicación | Columnas | FK | Módulos de aplicación |
| --- | ---: | ---: | ---: | ---: |
| `NexoSaludDB` | 44 | 412 | 94 | 20 |
| `NexoSalud_Mart` | 27 | 176 | 56 | 0 |

Se excluyen de esos totales `sysdiagrams` y ocho funciones/procedimientos auxiliares de diagramas SSMS en cada base. No son dependencias del sistema y no se exportarán al instalador. No hay FK ni CHECK deshabilitados o no confiables en las capturas. Los 20 módulos OLTP son tres funciones de corte, siete disparadores, cinco procedimientos y cinco vistas. El Mart contiene 17 dimensiones y diez hechos: cinco heredados y cinco LEAD. Las 25 FK de los hechos nuevos existen.

**Prisma.** La comparación de nombres de columnas escalares no encontró columnas modeladas ausentes en SQL. La revisión de nulabilidad, tipos nativos explícitos, longitudes y precisión/escala decimal tampoco detectó diferencias. No sustituye una validación de relaciones o de comportamiento de las rutas. Hay diez tablas de aplicación manejadas mediante SQL directo y diez columnas adicionales no modeladas por Prisma; están enumeradas en el manifiesto y no deben desaparecer de la consolidación. Entre ellas se encuentran la captación, las claves de registro web y el vínculo de la conversión. No se ejecutó `db push` ni se regeneró el esquema.

**Correspondencia de código SQL.** Los 18 módulos base de BUYER/LEAD coinciden con sus fuentes al normalizar espacios y la cabecera `CREATE OR ALTER` que SQL Server guarda como `CREATE`. El disparador de vigencia coincide en sus condiciones, pero la definición instalada contiene texto de comentario/error con codificación alterada respecto a UTF-8 del repositorio. La fase 2 conservará su lógica y normalizará la codificación del nuevo script. La vista heredada `v_DatosDimTiempo` está instalada sin definición localizada en los SQL actuales del repositorio: se conservará desde la definición inventariada y se documentará como heredada. Ninguna de estas observaciones motivó cambios en la principal.

### Diferencias que condicionan la consolidación

1. **BUYER instalado y BUYER publicado no son la misma versión dimensional.** En la principal, `fact_captacion_buyer` tiene PK compuesta por `KeyTiempo`, `KeySede`, `KeyCanal`, `KeyFuente` y `KeyEstadoRegistro`. El `init_mart.sql` de BUYER declara el hecho revisado con PK `id_persona`. La principal no tiene `fact_inversion_campana_buyer`, `usp_SincronizarCaptacionBuyer` ni `usp_SincronizarInversionCampanaBuyer`, aunque `MartSyncService` llama a esos procedimientos. No se puede certificar ese botón de sincronización con el catálogo instalado ni ejecutar el inicializador de BUYER sobre la principal como parche. Antes de cerrar la fase 3 se contrastará la entrega aprobada de BUYER y se declarará la versión objetivo y sus diferencias. No se cambiará el grano de BUYER por decisión implícita del paquete LEAD.
2. **QA contiene nueve tablas que la principal no tiene:** `EntradasAgenteLead`, `TrabajosAgenteLead`, `AuditoriaTrabajosAgenteLead`, `PriorizacionesAgenteLead`, `AccesosChatLead`, `MensajesChatLead`, `PropuestasChatLead`, `RevisionesChatLead` y `AutorizacionesReservaLead`. El chat experimental requiere modo de personal QA y banderas QA. CAP-05 de la Mesa usa `AccesosPreReservaLead` y `TraspasosPayerLead`, que sí están instaladas. La consolidación no convertirá el piloto de chat en una función operativa solo por incluir sus tablas. El aviso `registerLeadIntake` depende de `usp_RegistrarEntradaAgenteLead`, ausente en la principal; deberá seguir identificado como integración pendiente hasta su instalación y conexión expresas.
3. **Los scripts actuales tienen guardas de entorno.** El Mart valida pares de bases específicos y el nombre `ANTHONY` para el principal. El incremento 10 exige `NexoSaludDB`. La fase de instalación portátil sustituirá esa dependencia del equipo de origen por parámetros y verificaciones explícitas del destino; no eliminará las guardas a ciegas.
4. **La semilla antigua mezcla catálogos y operaciones.** `buyer_revision/semana9/01_catalogos.sql` no es un archivo de solo catálogos. Se separarán los valores estructurales necesarios de la nueva cohorte ficticia. No se reutilizará su poblamiento antiguo como si acreditara el flujo LEAD actualizado.
5. **La principal ya tiene actividad posterior a los informes anteriores.** El catálogo observado registra 127 reservas y un recibo CAP-05, frente a 126 y cero al instalar el incremento. Es una lectura posterior, no una alteración realizada en este inventario. Al corte `2026-11-12T04:20:25.1193382Z` (11/11, 23:20 Lima), las funciones OLTP devolvieron M1–M8 = `0,0,1,0,0,3,0,0`, mientras los cinco hechos nuevos seguían sin filas. Por tanto, no se repetirán como actuales los ceros del despliegue inicial ni se forzará que oportunidades, propuestas y alternativas tengan los mismos conteos: son unidades diferentes. Se conciliará la evidencia durante el diseño de la cohorte y la carga.

### Metodología y condiciones de cierre

Se mantienen las nueve dimensiones, los cinco hechos agregados, las 25 FK y las fórmulas aprobadas. El ETL y el nuevo poblamiento priorizarán `SELECT`, `JOIN`, `GROUP BY`, `COUNT`, `SUM`, `CASE`, `INSERT` y `MERGE`. No se añadirán funciones personalizadas, cursores o SQL dinámico para generar datos o cambiar el diseño. Las tres funciones de corte y los disparadores OLTP existentes conservan su función de trazabilidad; su exportación no introduce nuevas reglas dimensionales.

La fase 1 verifica inventario y diferencias; no demuestra una instalación limpia, una carga idempotente ni un recorrido visual. Esas comprobaciones se ejecutarán en sus fases y se registrarán por separado. La versión de la principal queda preservada. Los futuros datos ficticios no se insertaron y no se alteraron los históricos existentes. Los cambios de esta fase se registran en un commit local de `lead`, sin push ni merge.
