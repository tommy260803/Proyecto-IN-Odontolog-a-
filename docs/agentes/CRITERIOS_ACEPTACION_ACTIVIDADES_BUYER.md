# Criterios funcionales y de aceptación de las actividades Buyer

**Estado: documento para revisión; no constituye aprobación de la implementación final.** Define el comportamiento acordado de las tres actividades y la evidencia necesaria para aceptarlas. Fecha: 12 de noviembre de 2026.

Referencia local inspeccionada: rama `feature/buyer-orientacion-interactiva`, HEAD **`19613358530e899bfc68d5e6b3c33b6336ab9ce4`**. Los ensayos QA anteriores se realizaron en **DANIELPC / NexoSalud_LeadEnsayoFinal**. En este encargo documental no se conectó a SQL Server, no se llamó a Gemini, no se ejecutaron pruebas de aplicación y no se modificaron código, SQL ni documentos de Germain.

## 1. Alcance, fuentes y lectura del estado

Fuentes de evidencia:

- [Revisión de compatibilidad QA](./REVISION_QA_BUYER_DANIEL.md): corrección del P2022 y alcance de la alineación estructural.
- [Pruebas SQL de conversión y recepción](./PRUEBAS_CONVERSION_BUYER_QA_DANIEL.md): conversión, repetición, recepción idempotente y entrega SQL pospuesta.
- [Pruebas del backend con Gemini controlado](./PRUEBAS_BACKEND_BUYER_QA_DANIEL.md): rutas/evaluador/SQL reales, clasificación externa sustituida; cinco casos aprobados.
- [Pruebas de fallos y concurrencia](./PRUEBAS_FALLOS_CONCURRENCIA_BUYER_QA_DANIEL.md): agotamiento de fallos y retry aprobados; doble envío concurrente defectuoso.
- [Guía de relevo](./GUIA_RELEVO_GERMAIN_BUYER.md) y [entrega Buyer](./ENTREGA_AGENTE_BUYER.md): contexto de desarrollo; sus pendientes históricos deben interpretarse junto con los resultados QA posteriores, sin sobrescribir esas fuentes.

Referencias de implementación, leídas sin modificarlas: [rutas Buyer](../../backend/src/routes/buyer.routes.ts), [evaluador](../../backend/src/services/buyerEvaluationService.ts), [clasificador](../../backend/src/services/buyerMessageClassifier.ts), [tipos Buyer](../../backend/src/types/buyer.ts), [ficha Buyer](../../frontend/src/modules/buyer/components/BuyerDetailView.tsx), [formulario público](../../frontend/src/modules/buyer/components/landing/BuyerIntakeForm.tsx) y [validación del formulario administrativo](../../frontend/src/modules/buyer/schemas/buyerSchema.ts).

Se distinguen tres niveles, aplicados en todo el documento:

| Nivel | Significado |
| --- | --- |
| **Esperado** | Requisito funcional verificable. Su redacción no afirma que ya esté implementado o probado. |
| **Comprobado, con alcance** | Resultado respaldado por un informe identificado, en el commit/destino y modalidad allí registrados. SQL real con respuestas Gemini controladas no acredita Gemini real ni pantalla. Lectura de código no equivale a prueba ejecutada. |
| **Pendiente** | Falta evidencia, implementación o corrección. Incluye el defecto de concurrencia ya reproducido. No cuenta como aprobado ni como prueba omitida exitosa. |

Los IDs A–H de este documento identifican **escenarios de aceptación final**; no son los mismos IDs de caso de los informes anteriores. Las correspondencias se indican expresamente.

## 2. Acuerdos transversales

1. **Servicio seleccionado ≠ intención de reservar.** Es una preferencia declarada. Solo el mensaje y su contexto conversacional pueden fundamentar SOLICITA_RESERVA; un saludo con servicio seleccionado sigue necesitando aclaración.
2. **Datos registrados e inferencias se distinguen.** Nombre, contacto, consentimiento, sede, horario, canal, fuente y campaña conservan su origen. Una tarjeta del agente no debe atribuir a Gemini el descubrimiento de un dato elegido en el formulario.
3. **No inventar hechos.** Precio solo desde una fuente autorizada y vigente; sin ella, indicar que el precio no está confirmado. Servicio activo no significa cupo disponible. No inventar disponibilidad, consentimiento, diagnósticos, tratamientos clínicamente indicados ni garantías de resultado. El agente orienta sobre el siguiente paso, sin diagnosticar.
4. **Conversación automática.** Al recibir y guardar una respuesta a una pregunta del agente, el sistema reevalúa automáticamente ese turno con su contexto y muestra el siguiente resultado. No requiere que un operador pulse Aprobar, Actualizar o autorice continuar. El usuario sí envía su respuesta; eso no es aprobación humana de la decisión.
5. **Transcripción identificada.** Si un operador transcribe una respuesta recibida por otro canal, se conserva el texto como respuesta transcrita, el operador, canal y fecha, vinculados al turno. No se presenta como mensaje escrito directamente en el portal ni como inferencia de Gemini. El operador no debe inventar o conceder consentimiento por el prospecto.
6. **Historial y etapas.** No sobrescribir mensajes anteriores ni adjudicar una conversión histórica a una consulta nueva. Conservar LEAD/PAYER y otras etapas avanzadas; una consulta informativa no degrada a BUYER ni crea por sí misma otra oportunidad.
7. **Confirmaciones veraces.** Guardar un mensaje, completar una evaluación, crear una solicitud y confirmar entrega a LEAD son hechos distintos. Mostrar cada uno solo cuando exista evidencia persistida. Solicitud comercial no equivale a cita reservada, precio aceptado o atención clínica confirmada.
8. **Sin aprobación humana obligatoria.** Una marca técnica como requiere_revision o una acción ACLARACION señala información pendiente o un estado; no introduce una cola de aprobación necesaria para continuar. El backend verifica reglas automáticamente.
9. **Identidad de la operación.** Un retry técnico conserva la interacción del mensaje; una respuesta conversacional nueva crea otro turno relacionado; el replay del mismo formulario conserva la operación original. Son tres acciones distintas.

### Diferencias de canal que deben respetarse

El contrato actual del **registro público**, POST `/api/buyer/register`, guarda y evalúa automáticamente. El **registro administrativo**, POST `/api/buyer`, guarda sin evaluar; el ensayo de ese contrato debe llamar posteriormente a evaluate. No se declarará evaluación automática por el solo registro administrativo. Esa evaluación explícita inicial no autoriza a imponer aprobación manual a cada respuesta del panel conversacional acordado.

La continuación de una aclaración debe usar un recorrido que registre el turno y dispare su evaluación automáticamente. Si el panel de Germain utiliza otro contrato, deberá demostrarlo en la prueba final. Registrar administrativamente una respuesta y pulsar Actualizar no demuestra por sí solo ese recorrido automático.

## 3. Actividad 1 — Validación de los datos del Buyer

### Objetivo

Determinar si la identidad, contacto, consentimiento y preferencias son utilizables y coherentes, señalando faltantes o contradicciones antes de una acción comercial. Validar datos no significa confirmar intención, diagnosticar ni convertir.

### Datos de entrada

Identificadores de persona/captación cuando existan; nombre y apellidos; teléfono y/o correo según el contrato del canal; consentimiento explícito y su procedencia; mensaje original; servicio, sede y horario declarados; canal/fuente/campaña realmente recibidos; preferencias vigentes, etapa e historial de la persona; catálogos actuales de servicios/sedes/horarios y coincidencias de identidad.

No se unifican aquí arbitrariamente los formularios: el administrativo actual exige teléfono y otros campos en su esquema de interfaz, mientras las pruebas backend admitieron contactos sintéticos con correo. La aceptación de cada canal debe comprobar su validación de formato y los requisitos del backend por separado; no basta una marca visual de teléfono conforme.

### Responsabilidades

- **Gemini:** interpretar el texto para señalar ambigüedades o información declarada que deba contrastarse. No certifica formatos, identidad, autorización, disponibilidad ni validez de IDs; no completa datos ausentes como si fueran ciertos.
- **Backend:** validar y normalizar formatos conforme al canal sin cambiar su significado; resolver identidad sin mezclar personas; comprobar consentimiento registrado, calidad, datos mínimos y referencias a catálogos reales; detectar contradicciones y conservar etapa/historial. La regla para convertir exige nombres/apellidos, contacto utilizable, autorización expresa, calidad válida y servicio activo; la intención se decide en las actividades siguientes.

### Resultado visible esperado

Resumen de datos registrados con origen, campos conformes y observaciones concretas: por ejemplo, “Falta autorización de contacto” o “El horario seleccionado difiere del mensaje”. Distinguir “No informado”, “No válido” y “Pendiente de aclaración”. No mostrar “Datos completos” por inferencia o por una respuesta exitosa del modelo.

### Información que debe persistirse

Datos realmente proporcionados y normalizados, consentimiento y fecha/origen cuando exista, captación y preferencias vigentes; mensaje original íntegro; resultado/motivo de validación relevante para la evaluación; discrepancias y su resolución con procedencia, sin perder los valores anteriores. Los cambios de contexto deben poder relacionarse con la evaluación que los usó.

### Criterios verificables de aceptación

- **V1.** Un dato de contacto inválido o ausente se identifica según el canal; no se convierte una persona sin contacto utilizable. No se alteran nombres o números para fingir conformidad.
- **V2.** Consentimiento ausente/negativo nunca se transforma en positivo por Gemini, un valor implícito del mensaje o una transcripción. Se impide la conversión hasta que exista autorización expresa válida.
- **V3.** Un servicio/horario/sede se contrasta con el catálogo efectivo; un ID inválido o servicio inactivo no se sustituye silenciosamente por el primer servicio activo.
- **V4.** Las coincidencias reutilizan la identidad correcta sin fusionar sujetos distintos; falta de certeza produce una observación, no una asociación histórica arbitraria.
- **V5.** Las diferencias entre formulario y texto se presentan y conservan; solo una respuesta explícita puede resolverlas con trazabilidad. “Mañana” como fecha no se confunde automáticamente con turno de mañana.
- **V6.** La pantalla, la respuesta backend y los registros persistidos describen los mismos datos y estado. Recargar conserva la información y no crea mensajes ni evaluaciones nuevas por sí mismo.

**Estado:** comprobada la persistencia de fixtures válidos y la conservación de identidad/etapa en los casos QA citados. Pendientes la matriz de datos inválidos/consentimiento negativo por canal, las contradicciones con SQL real y la aceptación visual completa. No se considera probada la validación semántica de Gemini real.

## 4. Actividad 2 — Elaborar una orientación personalizada y conducir la aclaración

### Objetivo

Responder de forma útil al mensaje y conducir la conversación hasta comprender la necesidad y el siguiente paso, usando los datos efectivamente conocidos. La personalización debe reflejar el mensaje, servicio/contexto y pregunta pendiente, sin repetir preguntas ya contestadas ni asumir una reserva.

### Datos de entrada

Mensaje vigente; resultado de validación; servicio y preferencias declaradas; catálogo autorizado; etapa actual; mensajes/preguntas/respuestas anteriores de la misma persona, con IDs de turno; respuesta nueva y su origen directo o transcrito; hechos verificados que puedan comunicarse, como un precio con fuente vigente si existe. La ausencia de esa fuente también es información que condiciona la respuesta.

### Responsabilidades

- **Gemini:** interpretar la intención y la respuesta dentro de la conversación; distinguir información, ambigüedad y solicitud explícita. Si se incorpora generación de orientación, redactar una explicación/pregunta limitada a hechos suministrados y señalar incertidumbre. No inventar precio, agenda, consentimiento ni diagnóstico.
- **Backend:** construir contexto de la misma persona/operación, validar la salida y el servicio contra SQL, aplicar reglas y decidir qué puede mostrarse. Puede elaborar la pregunta con reglas/plantillas; la calidad de la actividad se mide por su contenido y continuidad, no por atribuir todo el texto a Gemini. Guardar cada turno antes de evaluarlo; disparar automáticamente la evaluación de la respuesta y persistir resultado/errores.

### Resultado visible esperado

Una orientación vinculada al mensaje y, cuando falte información, una pregunta concreta que explique qué falta. Debe poder leerse la secuencia de conversación y enviarse la respuesta en el mismo recorrido. Tras enviarla: estado “Procesando”, seguido de orientación, nueva aclaración, requisitos faltantes o solicitud registrada, según lo realmente obtenido. Si sigue siendo ambiguo, formular la siguiente pregunta automáticamente; no declarar éxito comercial solo porque desaparezca una pregunta.

### Información que debe persistirse

Mensaje inicial completo, texto exacto de la orientación/pregunta efectivamente mostrada, respuesta nueva y sus vínculos a interacción/decisión previas; procedencia del turno, canal y operador/fecha si es transcripción; contexto utilizado y su vigencia; clasificación, acción, discrepancias y aclaraciones; intentos, errores y estado recuperable. Una respuesta nueva no sobrescribe el mensaje inicial y un retry no crea otra respuesta.

### Criterios verificables de aceptación

- **O1.** Servicio elegido + saludo produce una pregunta contextual sobre la necesidad o intención; no solicita otra vez el servicio ya conocido sin explicar una duda real y no convierte por la selección.
- **O2.** Una consulta de precio recibe orientación informativa; cualquier cifra debe coincidir con una fuente autorizada vigente identificable. Sin fuente, se informa que el precio no está confirmado, sin cifra inventada ni promesa de reserva.
- **O3.** Enviar la respuesta a una aclaración provoca evaluación automática con la pregunta y el turno previos; no exige aprobación de un operador ni pulsar Actualizar para continuar.
- **O4.** Un “sí” se interpreta solo si la pregunta previa permite saber qué confirma y pertenece a esa persona. No reutilizar conversación de otro contacto; si el contexto no basta, pedir precisión.
- **O5.** Cada turno y texto visible se recupera al recargar; la evaluación anterior se conserva como historial si cambia el contexto, sin mostrarse como vigente cuando ya no lo es.
- **O6.** Una respuesta transcrita se rotula y persiste con su origen y operador; desencadena la misma continuación automática al enviarse, sin presentarla como escritura directa del prospecto.
- **O7.** Un fallo del proveedor deja el mensaje durable y un estado pendiente comprensible. El retry de ese mismo turno reutiliza su interacción y, si no cambió el contexto, la decisión; mantiene identidad, contador e historial de fallos.

**Estado:** el código de referencia muestra contexto conversacional y continuación desde el formulario público; el contrato Gemini actual devuelve intención/id_servicio y el backend construye aclaraciones. Esa lectura no acredita una orientación generativa personalizada ni un panel conversacional terminado. Se comprobaron ACLARACION y fallos/retry en backend con SQL real y Gemini controlado. Pendientes el recorrido completo de varios turnos, persistencia/visualización de todos los textos, transcripción identificada y calidad de Gemini real.

## 5. Actividad 3 — Recomendación del Agente Buyer

### Objetivo

Proponer y ejecutar el siguiente paso permitido por la necesidad comprendida y las reglas verificadas: informar, aclarar, completar requisitos, reintentar o registrar/derivar una solicitud. La recomendación debe explicar su fundamento y distinguir claramente una sugerencia de una acción ya confirmada.

### Datos de entrada

Intención validada, mensaje y contexto vigentes; validación de datos/consentimiento; servicio activo y discrepancias resueltas; etapa e historial; identidad persistida de la interacción/evaluación/operación; resultados reales de conversión y recepción si corresponde.

### Responsabilidades

- **Gemini:** aportar la interpretación semántica y el servicio del catálogo correspondiente a la necesidad. No autoriza conversiones, confirma citas ni modifica SQL; tampoco puede imponer revisión humana como condición de continuación.
- **Backend:** decidir la acción con reglas deterministas y evidencia persistida. Para BUYER con intención explícita, requisitos conformes, servicio activo y sin contradicción pendiente, realizar la conversión y recepción mediante los procedimientos reales. Mantener identidad frente a retries/replays y preservar etapas avanzadas. Devolver a pantalla lo que ocurrió, incluido cualquier estado de entrega pendiente.

### Resultado visible esperado

Recomendación y motivo relacionados con el turno: “Continuar con información”, “Necesitamos aclarar el horario”, “Falta autorización” o “Solicitud registrada para gestión por LEAD”. Si se ejecutó la acción, mostrar estado e identidad verificables; si falta entrega, indicar pendiente. No afirmar “Cita confirmada” por haber creado una solicitud, ni “Derivado con éxito” por ausencia de aclaración.

### Información que debe persistirse

Intención, servicio, acción, explicación/orientación que fundamenta la recomendación, estado y contexto de la evaluación; intentos/historial de errores; IDs de persona, captación, interacción y decisión. Solo si corresponde convertir: solicitud, evento, clave de operación, vínculo de la interacción y entrada LEAD/estado de entrega. Una recomendación informativa conserva IDs comerciales nulos para ese turno, sin borrar el historial previo de la persona.

### Criterios verificables de aceptación

- **R1.** SOLO_CONSULTA y AMBIGUA nunca crean solicitudes, eventos de conversión ni entradas LEAD por sí mismas.
- **R2.** Una solicitud inequívoca solo convierte cuando las validaciones están conformes, el servicio es activo y no queda contradicción pendiente; no requiere aprobación humana adicional. Si falta un requisito, mostrarlo y continuar su aclaración.
- **R3.** Una conversión válida produce una solicitud, un evento y una entrada vinculados por persona/captación/solicitud/evento, con etapa y entrega coherentes. No se certifica una cita disponible o pagada.
- **R4.** Reintentar una operación ya completada devuelve la identidad existente, sin otra conversión. Una consulta nueva se evalúa por su propia evidencia; la etapa o la última solicitud de la persona no bastan para apropiarse de una conversión histórica.
- **R5.** Un contacto en PAYER conserva PAYER al consultar; un mensaje informativo nuevo no recibe id_solicitud/id_evento de un turno anterior ni crea una entrada nueva.
- **R6.** Dos envíos simultáneos con la misma clave y contenido representan un único registro y conversión; la misma clave con contenido diferente se rechaza con conflicto sin efectos adicionales. Deduplicar persona no satisface este criterio si se duplican mensajes o decisiones.
- **R7.** La recomendación visible coincide con la decisión persistida y su vigencia, también al recargar. No sustituirla por una clasificación frontend contradictoria ni mostrar una recomendación histórica como respuesta al mensaje nuevo.

**Estado:** conversión/recepción, repetición y conservación de PAYER comprobadas en el alcance de los informes SQL/backend; falta aceptación de pantalla y semántica real. **R6 no está cumplido:** se reprodujo duplicación de interacción/decisión en envíos públicos concurrentes. La corrección permanece pendiente para Germain y no se implementa aquí.

## 6. Matriz de escenarios para la prueba final

Las pantallas/textos indicados expresan el significado esperado, no un diseño ni un literal obligatorio. Cada prueba debe correlacionar pantalla, respuesta backend y filas reales; una tarjeta visual o un HTTP 200 aislado no bastan. Para casos iniciados en BUYER se presupone identidad/contacto/consentimiento válidos salvo la variante negativa que se ensaye. “Sin filas comerciales” significa **sin filas nuevas atribuibles a ese turno**, no borrar solicitudes históricas.

### A. Servicio seleccionado + saludo ambiguo

- **Acción:** seleccionar un servicio activo S y enviar “Hola, buenas tardes”. Evaluar por el recorrido del canal; en registro administrativo documentar la evaluación explícita inicial.
- **Pantalla esperada:** S aparece como preferencia declarada, intención ambigua y orientación como “Veo tu interés en S. ¿Buscas información o deseas solicitar una cita?”. Sin confirmación de reserva ni repetición innecesaria de la selección.
- **SQL esperado:** mensaje/captación/preferencia y evaluación ACLARACION persistidos, etapa BUYER; cero solicitudes/eventos/entradas nuevos. Conservar la pregunta mostrada para relacionarla con la respuesta posterior.
- **Evidencia necesaria:** selección y mensaje enviados, pantalla de pregunta, respuesta HTTP con IDs, filas antes/después y texto persistido de la aclaración. En la prueba semántica debe verse que S no fue tomado como intención de reserva.
- **Estado:** la rama AMBIGUA con registro administrativo y preferencia de servicio se comprobó con Gemini controlado (caso B del informe backend). Pendientes la pregunta personalizada, pantalla y clasificación real de este ejemplo exacto.

### B. Consulta de precio sin intención de reservar

- **Acción:** enviar “¿Cuánto cuesta una evaluación odontológica? Solo quiero información”. Ensayar con y sin precio autorizado disponible como fuente; no inventar una fuente para el caso.
- **Pantalla esperada:** orientación informativa y siguiente paso opcional. Solo mostrar una cifra si puede verificarse su fuente/vigencia; en otro caso indicar que el precio no está confirmado. No comunicar derivación o reserva exitosa.
- **SQL esperado:** interacción y decisión SOLO_CONSULTA, BUYER; ninguna fila comercial nueva. Persistir el texto comunicado y referencia a la fuente si hubo precio, o la falta de confirmación si no hubo.
- **Evidencia necesaria:** texto de entrada/salida, catálogo/fuente de precio sanitizados cuando exista, respuesta backend y consultas de filas/etapa. Probar que seleccionar servicio tampoco dispara conversión.
- **Estado:** persistencia SOLO_CONSULTA sin conversión comprobada (caso A backend). No están comprobadas la respuesta de precio, la fuente vigente, Gemini real ni la pantalla.

### C. Confirmación de solicitud después de una pregunta del agente

- **Acción:** partir de A con una pregunta inequívoca, por ejemplo “¿Deseas solicitar una cita para S?”, y responder “Sí, quiero solicitarla”. En una variante, un operador transcribe esa respuesta identificando su origen. Usar siempre la misma persona y vínculos al turno previo.
- **Pantalla esperada:** al enviar se reanuda automáticamente la evaluación, sin Aprobar ni Actualizar. Si todos los requisitos están conformes, mostrar solicitud registrada y entrega real; si la respuesta sigue siendo ambigua o falta un requisito, presentar la siguiente aclaración automáticamente. La transcripción debe distinguirse del mensaje directo.
- **SQL esperado:** conservar mensaje/pregunta iniciales; crear un nuevo turno con la respuesta y su vínculo de contexto, evaluación y procedencia. Con intención explícita y reglas conformes, una solicitud/evento/entrada vinculados. Reintentar el turno no crea otro mensaje ni oportunidad.
- **Evidencia necesaria:** secuencia completa de pantalla y peticiones, IDs del turno previo/nuevo, contexto de la misma persona, pregunta/respuesta persistidas, clasificación y enlaces SQL; evidencia de que no hubo aprobación intermedia. En variante transcrita, operador/canal/fecha y rótulo visibles/persistidos.
- **Estado:** conversión directa válida y retry completado comprobados (C/D backend), pero **no acreditan este recorrido conversacional**. Pendientes varios turnos, interpretación contextual del “sí”, continuación automática integral y origen transcrito.

### D. Contradicción entre horario seleccionado y mensaje

- **Acción:** seleccionar un horario real de mañana y enviar “Quiero solicitar cita, pero solo puedo por la tarde”. Después responder a la pregunta con el horario que confirma. Añadir control “mañana quiero consultar” para no confundir fecha con turno.
- **Pantalla esperada:** mostrar ambas declaraciones y preguntar cuál es correcta; no elegir silenciosamente. Tras la respuesta, continuar automáticamente y reflejar el horario resuelto. Ninguna promesa de cupo disponible por el hecho de elegir un turno.
- **SQL esperado:** conservar preferencia original, mensaje y discrepancia; ACLARACION sin conversión mientras el conflicto siga abierto. Guardar la respuesta/resolución y la vigencia de preferencias/contexto con historial; evaluar de nuevo antes de cualquier conversión admisible. No sobrescribir la evidencia de la contradicción.
- **Evidencia necesaria:** IDs y valores del catálogo Horarios, preferencia/mensaje previos, pregunta y respuesta, versiones/contextos antes/después, ausencia de filas comerciales durante el conflicto y decisión final. No asumir IDs de turno fijos.
- **Estado:** existe lógica de discrepancias por lectura de código y antecedentes de simulación; **pendiente** ensayo integral con SQL real, pantalla y respuesta conversacional. No se incorpora como aprobado por la matriz genérica de pruebas anteriores.

### E. Servicio no disponible

- **Acción:** solicitar un servicio inactivo o ausente del catálogo autorizado; incluir la variante de una selección antigua que ya no es activa. No confundir servicio activo sin agenda confirmada con servicio ofertable ausente.
- **Pantalla esperada:** explicar que el servicio solicitado no está disponible/confirmado en el catálogo y pedir aclaración u ofrecer únicamente alternativas activas como opciones, sin seleccionarlas por el usuario. Nunca prometer disponibilidad de citas.
- **SQL esperado:** conservar la petición original y la referencia declarada cuando sea válida como antecedente; decisión ACLARACION sin conversión al servicio inactivo ni a otro servicio sustituto. Si el canal rechaza un ID inválido antes de registrar, mostrar rechazo claro y comprobar cero efectos; esa variante no se presenta como orientación conversacional persistida.
- **Evidencia necesaria:** estado/ausencia del servicio en catálogo al evaluar, petición y respuesta, pantalla de explicación, decisión/ID efectivo y conteos de solicitud/evento/entrada. Comprobar que no se eligió el primer servicio activo ni una preferencia histórica ajena a la petición.
- **Estado:** validación de catálogo y aclaración existen como referencia de código; escenario exacto con SQL real, inactivación previa y pantalla **pendiente**. La gestión del dato no aceptado por cada canal debe quedar explícita en la prueba.

### F. Fallo de Gemini y reintento sin perder el mensaje

- **Acción:** con Gemini controlado, provocar agotamiento de fallos transitorios; después devolver una clasificación válida al retry de la misma interacción. No reenviar el formulario como mecanismo de retry.
- **Pantalla esperada:** “Mensaje guardado; evaluación pendiente” y mecanismo de reintento sin pedir volver a escribir. Tras retry, resultado vigente y contador/historial coherentes; sin falso éxito durante el fallo. No requiere aprobación humana de la clasificación.
- **SQL esperado:** durante el fallo, un mensaje durable y una decisión recuperable, sin conversión. Con el mismo contexto, retry reutiliza interacción y decisión, acumula intentos y conserva errores; el resultado posterior solo crea filas comerciales si la intención válida lo exige. Si el contexto cambia, conservar la decisión anterior y documentar la nueva versión, sin confundirlo con retry idéntico.
- **Evidencia necesaria:** traza de fallos y éxito simulados, respuesta pendiente y final, IDs constantes, texto íntegro del mensaje, estado de decisión antes/después e historial. En el contrato actual default, tres errores 503 y un éxito posterior deben reflejar contador 3 → 4 y un registro del ciclo fallido en historial_errores.
- **Estado:** **comprobado en backend/SQL real con proveedor simulado** (A/B del informe de fallos: interacción 20191, decisión 165). Pendientes recorrido visual final y otros tipos de fallo. No acredita indisponibilidad real de Gemini ni recuperación automática tras caída.

### G. Consulta nueva de una persona en PAYER

- **Acción:** preparar un sujeto sintético en PAYER con historial comercial propio y enviar un mensaje informativo nuevo. Identificar el contrato de registro y evaluación; si es administrativo, separar ambos pasos.
- **Pantalla esperada:** conservar PAYER y mostrar la nueva consulta/orientación como vigente; el historial anterior sigue visible como historial. No mostrar la conversión pasada como resultado de este mensaje ni anunciar una nueva derivación.
- **SQL esperado:** nueva interacción y evaluación SOLO_CONSULTA, sin vínculo comercial heredado para el turno; PAYER intacto; solicitudes/eventos/entradas históricos conservados y sin filas comerciales adicionales. El historial de otra interacción no demuestra pertenencia de una operación a esta.
- **Evidencia necesaria:** etapa/historial antes y después, IDs del mensaje nuevo, campos id_solicitud/id_evento sin atribución en su decisión, ausencia de entrada nueva y captura de pantalla diferenciando consulta actual e historial.
- **Estado:** **comprobado en backend con SQL real y Gemini controlado** (E backend: persona 10988, nueva interacción 20190). PAYER se preparó mediante actualización acotada de fixture: no se probó el flujo de pagos. Pantalla y Gemini real pendientes.

### H. Doble envío del mismo formulario

- **Acción:** lanzar dos registros públicos realmente simultáneos, misma Idempotency-Key y contenido, con sujeto nuevo. Coordinar inicio y registrar solapamiento. Ensayar aparte replay posterior y misma clave con contenido diferente; la variante de conflicto no es la misma carrera inicial.
- **Pantalla esperada:** un solo mensaje/registro lógico y la misma identidad de operación, sin dos éxitos que aparenten dos solicitudes. Se admite mostrar pendiente mientras la operación original termina; no duplicar para resolver la espera. Misma clave/cuerpo diferente: conflicto claro sin segunda operación. Deshabilitar el botón ayuda, pero no sustituye la garantía del backend.
- **SQL esperado:** una interacción y una decisión de registro; si convierte, una solicitud/evento/entrada vinculados. Replay conserva IDs. Conflicto no altera ni duplica registros. Una clave nueva para un turno nuevo debe permitir conservar ese nuevo mensaje, sin confundirlo con el replay técnico.
- **Evidencia necesaria:** cuerpo/clave iguales sanitizados, dos peticiones y sus tiempos de recepción/entrada/respuesta, intersección temporal real, respuestas e IDs; consulta de filas por clave/prefijo, conteos antes/después y vínculos comerciales. Dos envíos secuenciales no acreditan concurrencia.
- **Estado: DEFECTO PENDIENTE, aceptación no cumplida.** En el caso C del informe de fallos hubo 677 ms de solapamiento, dos HTTP 201 y **dos interacciones 20192/20193 y decisiones 166/167** para la misma clave; se conservó una única solicitud 2920/evento 4092/entrada 2920. La unicidad comercial no compensa duplicar el registro. Ambas lecturas previas de clave encontraron ausencia antes de crear las filas. No se corrige aquí; la versión final de Germain debe resolverlo y superar este ensayo con sujetos nuevos. Replay y conflicto deben documentarse por separado; no se dan por probados por este fallo.

## 7. Persistencia y brechas de contrato a revisar

Los nombres siguientes describen la correspondencia con el modelo actual, **no son una propuesta de migración aprobada**:

| Información funcional | Soporte de referencia | Verificación / brecha |
| --- | --- | --- |
| Identidad, contacto, autorización y etapa | Personas, CaptacionesBuyer | Contrastar dato/origen con entrada del canal; matriz negativa pendiente. |
| Preferencias y catálogo | PersonaPreferencias, Servicios, Horarios y demás catálogos aplicables | Respetar vigencia y no presentar selecciones como inferencias. Persistencia de la resolución de contradicciones por verificar. |
| Mensajes y vínculos de conversación | Interacciones y contexto de entrada de DecisionesIA | Mensaje íntegro comprobado en los ensayos indicados; cadena completa de turnos y pertenencia deben demostrarse. |
| Evaluación, acción, pregunta y errores | DecisionesIA.entrada/decision/accion/resultado_revision | Comprobados estados y retry acotados; conservar exactamente el texto mostrado, no solo una explicación reconstruida diferente. |
| Conversión y recepción | Solicitudes, EventosEtapa, EntradasAgenteLead; vínculo de Interacciones | Comprobados procedimientos y rutas acotados, sin certificar agenda o negociación LEAD. |
| Transcripción: autor, origen, canal, fecha y turno | Contrato de captura/auditoría por revisar | La existencia de un campo id_usuario no demuestra origen transcrito ni trazabilidad completa. No declarar implementado sin persistencia y lectura verificables. |
| Orientación personalizada y recomendación visible | Contrato de evaluación/presentación por revisar | El JSON Gemini actual solo exige intención/id_servicio; no acredita generación o almacenamiento de todos los textos requeridos. |
| Identidad del formulario concurrente | Clave en entrada de DecisionesIA, según contrato actual | Defecto comprobado de reserva/verificación no atómica. Pendiente; ninguna modificación propuesta se ejecuta en este documento. |

Si se necesitan nuevos campos, cambios en Prisma o contratos de procedimientos para guardar orientación, origen transcrito o identidad de operación, debe prepararse una propuesta separada y coordinarse. La carencia se registra como pendiente; no se sustituye por almacenamiento solo en memoria del navegador ni por atribución ficticia.

La ficha de referencia todavía organiza **cuatro tarjetas** (calidad de datos, preferencias, atribución y recomendación). Las **tres actividades acordadas en este documento** son funcionales: preferencias y atribución son datos de apoyo, no sustituyen la actividad de orientación y aclaración. No se declara implementada esa reorganización del panel por renombrar tarjetas o leer el código.

## 8. Evidencia mínima y condición de aceptación final

Para cada escenario se completará un registro con: versión/HEAD y huellas relevantes, fecha, canal, sujeto/prefijo sintético nuevo, destino SQL efectivo, precondiciones y catálogo; pasos, texto exacto de mensajes/preguntas/respuestas y origen; captura o recorrido de pantalla; peticiones/respuestas sanitizadas, IDs de persona/captación/interacción/decisión/solicitud/evento/entrada cuando procedan; lecturas SQL antes/después; esperado/obtenido y resultado **aprobado, fallido o pendiente**. Para concurrencia, añadir las trazas de solapamiento. No incluir claves ni cadenas de conexión.

Distinguir en cada evidencia **respuesta Gemini controlada** de **Gemini real**. Los ensayos controlados validan reglas/persistencia frente a una salida dada, sin acreditar la calidad del modelo. Los límites de los informes previos siguen vigentes. Recopilar evidencia de pantalla será una ejecución futura: este documento no ejecuta esos pasos ni autoriza iniciar procesos o consumir el proveedor.

La aceptación final requiere que las tres actividades cumplan sus criterios, que A–H tengan evidencia del recorrido correspondiente sobre la versión final de Germain y que H deje de reproducir el defecto con aserciones de unicidad intactas. Una demostración parcial debe rotular lo pendiente; no se convierte en aprobación completa por tener tests SQL verdes. Repetir también F/G y el resto de regresiones después de los cambios finales, con contactos sintéticos nuevos.

**Permanecen fuera de lo comprobado:** Gemini real, calidad de orientación personalizada, interfaz integral y recuperación automática tras caída. La entrega SQL pospuesta y el retry explícito ya ensayados no acreditan esa recuperación de proceso. Estos aspectos requieren sus bloques de prueba y evidencia específicos; no se introduce una aprobación humana obligatoria para operar el agente.
