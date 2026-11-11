# Entrega del agente Buyer para integración con LEAD

**Estado EN REVISIÓN.** Rama de trabajo `feature/buyer-agent-gemini`. Actualización documental del 11 de noviembre de 2026.

La implementación está publicada como avance. El cierre de integración depende de los pendientes de la sección 3 y de la prueba conjunta. El [contrato BUYER → LEAD](../../database/lead_revision/CONTRATO_BUYER_LEAD.md) es la referencia compartida. Esta entrega explica el estado de Buyer y sus dependencias.

Para retomar la implementación, comenzar por la [guía de Germain](GUIA_RELEVO_GERMAIN_BUYER.md).

## 1. Revisiones y evidencia

| Referencia | Alcance |
| --- | --- |
| `b819dd5` de LEAD | Recepción mediante `registerLeadIntake`, tabla y procedimiento de entrada. Incorporada a Buyer mediante el merge `3be5a85`. |
| `7104fb8` de Buyer | Integración del clasificador, persistencia y primeras aclaraciones. |
| `ffb67b6` de Buyer | Recuperación post-commit, contexto e idempotencia. Contiene los fallos descritos abajo. |
| `2fff156` de Buyer | Publicación del avance con estado en revisión y banderas QA. Base examinada para esta actualización documental. |

Antigravity reportó compilación del backend y frontend, 76 pruebas generales aprobadas y 19 pruebas SQL aprobadas con una prueba real omitida. Son evidencias de su ejecución local sobre QA.

La auditoría independiente del paquete v3 reprodujo 24 pruebas simuladas del clasificador, con 4 reales omitidas. Dos comprobaciones adicionales de contexto y resolución explícita pasaron. Una comprobación adicional de consulta nueva desde PAYER falló. Esa auditoría no accedió al SQL Server local ni reprodujo la compilación completa o las pruebas SQL.

Los resultados anteriores corresponden a revisiones concretas. Quien cambie código debe registrar su nuevo commit, comandos, destino QA y resultados.

## 2. Qué puede avanzar cada equipo

| Equipo | Trabajo disponible ahora | Dependencia para el cierre |
| --- | --- | --- |
| BUYER | Corregir los pendientes, completar conversación, registrar mensajes y verificar recuperación. | Validar entrega y recuperación con LEAD en la misma copia QA. |
| LEAD | Desarrollar la negociación a partir de una entrada persistida y comprobar el inicio único por `id_solicitud`. Usar casos sintéticos con conversión válida. | Esperar las correcciones Buyer para certificar el recorrido público completo. |
| Ambos | Mantener el contrato, acordar esquema compartido y preparar las pruebas de aceptación. | Apertura de oportunidades nuevas para contactos avanzados y aprobación del paquete conjunto. |

BUYER gestiona formulario, rutas Buyer, clasificador y evaluación. LEAD gestiona recepción e inicio de negociación. Los cambios en Prisma, procedimientos y migraciones compartidas se coordinan antes de aplicarlos.

## 3. Pendientes prioritarios de Buyer

### P1. Diferenciar recuperación de una interacción nueva

En [buyerEvaluationService.ts](../../backend/src/services/buyerEvaluationService.ts), la búsqueda de una conversión por `id_captacion` ocurre al evaluar cualquier mensaje. Una persona ya convertida puede tener una interacción nueva que termine etiquetada como `CONVERSION_LEAD`, vinculada a su solicitud anterior y con `etapa_final: LEAD` aunque actualmente esté en PAYER.

La auditoría observó una respuesta y auditoría incorrectas. En esa rama no se observó una actualización de `Personas.id_etapa_actual`.

La corrección debe identificar el trabajo concreto cuya conversión fue interrumpida. La existencia de un evento histórico por captación y el nombre de la etapa actual, por sí solos, no distinguen ambos casos. Una recuperación legítima también encuentra a la persona ya en LEAD.

**Aceptación.** Una consulta nueva de una persona PAYER con conversión anterior se clasifica como consulta, conserva PAYER y evita `CONVERSION_LEAD`. La recuperación de la operación interrumpida devuelve la solicitud original y completa una sola entrada LEAD.

### P2. Proteger el registro concurrente por clave

En [buyer.routes.ts](../../backend/src/routes/buyer.routes.ts), la comprobación de `Idempotency-Key` se hace antes de la transacción de registro. Dos peticiones pueden superar esa lectura antes del primer commit.

Los bloqueos de los procedimientos de conversión y recepción protegen esas operaciones. El mapa por `id_interaccion` protege evaluaciones dentro de un proceso. Falta acreditar la exclusión del registro por clave antes de crear sus filas.

**Aceptación.** Dos peticiones simultáneas con la misma clave y contenido devuelven la misma interacción y evaluación. La misma clave con contenido distinto devuelve 409. Claves diferentes permiten mensajes iguales. Si la solución se limita a un proceso, documentar esa restricción. Una garantía entre procesos requiere coordinación persistente.

### P3. Verificar aislamiento QA en cada equipo

Las banderas ya están documentadas y añadidas a la plantilla. Falta confirmar su configuración local en cada equipo y los destinos efectivos. `backend/.env.example` conserva nombres de bases originales. Copiarlo exige ajustar las conexiones antes de iniciar el backend.

Usar `QA_ENV=true`, `DISABLE_MART_SYNC=true` y `DUNNING_ENABLED=false`. La habilitación posterior del Mart requiere revisar tanto las conexiones como los nombres explícitos de bases y procedimientos.

## 4. Interfaz que LEAD debe consumir

1. Buyer confirma el registro del mensaje y trabajo pendiente antes de llamar a Gemini.
2. Si corresponde convertir, reutiliza `dbo.usp_ConvertirBuyerALead` y conserva persona, captación, evento y solicitud.
3. Después del commit llama a [registerLeadIntake](../../backend/src/services/leadIntake.ts) con `id_solicitud`, fuera de la transacción de conversión.
4. El procedimiento de recepción devuelve `id_solicitud`, `id_evento_etapa`, `id_captacion` e `id_persona`. Una fila de `EntradasAgenteLead` acredita la recepción para el futuro agente.
5. Buyer confirma su entrega después de recibir la respuesta. LEAD identifica su trabajo por `id_solicitud` para tolerar avisos repetidos y recuperar su propio inicio.

El error 54702 indica una transacción externa incompatible. El 54703 indica ausencia de conversión vinculada y requiere investigar la inconsistencia. Los fallos transitorios mantienen la entrega pendiente. Una entrada única no demuestra por sí sola que toda la negociación posterior sea idempotente.

La conversión abre la oportunidad comercial. LEAD valida después disponibilidad y reserva. Una consulta nueva de un contacto avanzado conserva su etapa y queda pendiente de apertura hasta acordar ese flujo.

## 5. Preparación de QA y orden de ejecución

SQL Server/T-SQL continúa siendo el entorno vigente. Cada integrante prepara su copia local. Cambiar de rama actualiza archivos y no instala el esquema ni copia los datos.

1. Preparar una restauración de prueba con nombres y archivos exclusivos. Buyer ha usado `NexoSalud_LeadEnsayoFinal`. Consultar los [pasos de Germain](GUIA_RELEVO_GERMAIN_BUYER.md#3-preparar-la-copia-qa).
2. Verificar el paquete OLTP. Si la copia compatible aún necesita la instalación BUYER/LEAD, seguir el [procedimiento de instalación](../../database/lead_revision/PROCEDIMIENTO_INSTALACION_OLTP.md) con el destino QA explícito. Si está instalada, ejecutar sus controles de lectura.
3. Para la recepción, revisar la [propuesta compartida Buyer](../../database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql). Admite `NexoSalud_LeadEnsayoFinal` y `NexoSalud_LeadPruebas`. El [instalador original LEAD](../../database/lead_revision/ENTRADA_AGENTE_LEAD_QA.sql) admite únicamente `NexoSalud_LeadPruebas`. Elegir un paquete acordado según el destino y verificar el esquema resultante.
4. Instalar dependencias, generar Prisma y compilar. La generación de Prisma crea el cliente a partir del esquema del repositorio.
5. Ejecutar pruebas simuladas. Luego activar explícitamente las pruebas SQL contra la misma copia QA.
6. Corregir P1 y P2 antes de dar por aprobada la prueba conjunta desde el formulario.

La propuesta fue aplicada en la QA local de Daniel según el reporte de Antigravity. Su ejecución en esa copia no acredita su instalación en otros equipos ni su aprobación para bases principales. Crea columnas faltantes sin incorporar necesariamente todas las claves foráneas del paquete original. Verificar las restricciones al consolidar el esquema.

## 6. Matriz de aceptación conjunta

| Caso | Resultado exigido |
| --- | --- |
| Consulta informativa inicial | Mensaje guardado, contacto BUYER, sin solicitud comercial nueva. |
| Aclaración y respuesta breve | Reutiliza mensaje anterior y pregunta del agente. Conserva contexto al reintentar. |
| Servicio desconocido o autorización ausente | Conserva etapa y solicita información o señala requisitos. |
| Conversión elegible | Una solicitud, un evento vinculado y una entrada LEAD. |
| Caída después de convertir | Recupera la misma operación y entrega sin duplicar ni reclasificar una consulta ajena. |
| Respuesta de LEAD perdida | Reenvía el mismo `id_solicitud` y recupera su entrada existente. |
| Reenvío concurrente del formulario | Misma clave conserva la misma interacción y evaluación. |
| Mensaje nuevo desde PAYER | Clasifica independientemente, conserva PAYER y evita conversión histórica indebida. |
| Referencia explícita a solicitud | Verifica número y pertenencia. Referencia dudosa queda pendiente. |
| Inicio del agente LEAD repetido | Inicia o retoma una negociación por `id_solicitud`. LEAD aporta su evidencia. |

## 7. Entrega para la siguiente revisión

Cada equipo actualiza su documento con commit probado, scripts ejecutados en orden, configuración de destino sin secretos, resultados y pendientes. Germain publica sus avances en la misma rama Buyer y LEAD conserva su rama. Antes de integrar, comparar las dos puntas y resolver cambios compartidos.

La siguiente revisión conjunta se activa cuando Buyer publique las correcciones P1/P2 con pruebas y LEAD publique su receptor/agente con evidencia de inicio idempotente. Registrar allí cualquier decisión pendiente sobre nuevas oportunidades. El [contrato compartido](../../database/lead_revision/CONTRATO_BUYER_LEAD.md) se actualiza de forma coordinada si cambia la interfaz.
