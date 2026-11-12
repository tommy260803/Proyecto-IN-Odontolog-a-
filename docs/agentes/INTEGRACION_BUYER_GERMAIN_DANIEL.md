# Integración local Buyer — Germain / Daniel

Fecha: 12 de noviembre de 2026. **Comprobaciones técnicas locales finales aprobadas; aceptación funcional y contraste SQL de esta versión pendientes.** No se declara resuelto el defecto de concurrencia ni validados los indicadores.

## Identidades e historial

| Referencia | Valor |
| --- | --- |
| Repositorio origin verificado | https://github.com/tommy260803/Proyecto-IN-Odontolog-a-.git |
| Rama destino, conservada | `feature/buyer-orientacion-interactiva` |
| HEAD previo / commit QA conservado | `83f2d2098ca77ea8ff40cc1fa648969c508ea95b` |
| Rama remota origen confirmada tras git fetch origin | `origin/feature/buyer-agent-gemini` |
| SHA concreto integrado | **`48677ec1da31c592f4effe1b0fd67dafeb28e42a`** |
| Ancestro común | `19613358530e899bfc68d5e6b3c33b6336ab9ce4` |
| Rama local de respaldo creada antes del merge | `backup/buyer-orientacion-interactiva-pre-germain-20261112T221624Z` |
| HEAD del respaldo | `83f2d2098ca77ea8ff40cc1fa648969c508ea95b` |

Se comprobaron rama, status y pertenencia del commit QA al historial. Antes de integrar, solo había los seis reportes antiguos sin versionar. Se ejecutó fetch, sin pull ni cambio de rama. El merge se preparó exactamente con:

```powershell
git merge --no-ff --no-commit 48677ec1da31c592f4effe1b0fd67dafeb28e42a
```

**No hubo conflictos de contenido ni archivos sin resolver.** No se usó aceptación automática global de ours/theirs. Los ocho archivos recibidos permanecen iguales a su versión en el SHA de Germain; no se inventó una reconciliación funcional de sus textos o fórmulas. Las diferencias funcionales identificadas se registran abajo para coordinación.

Este informe se incluye en el commit local de merge. Su SHA se obtiene sin autorreferencia con `git log -1 --format=%H -- docs/agentes/INTEGRACION_BUYER_GERMAIN_DANIEL.md`; la entrega de la sesión informa el SHA efectivo después de crearlo. Los dos padres esperados son el HEAD previo y el SHA origen indicados arriba.

## Commits y archivos incorporados

Desde el ancestro común se recibieron dos commits:

1. `1badedac1a5210e627eb863f42a4db9c3647f864`: manejo de falta del procedimiento receptor LEAD y documentación de actividades Buyer.
2. `48677ec1da31c592f4effe1b0fd67dafeb28e42a`: indicadores de conversión/calidad en el listado y actualización documental.

| Archivo | Cambio recibido |
| --- | --- |
| [buyer.routes.ts](../../backend/src/routes/buyer.routes.ts) | Añade indicadores a la respuesta paginada del listado: datos fuera de la página visible, filtros y cálculos B1/B2/B3. No modifica el registro público concurrente. |
| [leadIntake.ts](../../backend/src/services/leadIntake.ts) | Consulta OBJECT_ID antes del EXEC y lanza LeadIntakeUnavailableError si no encuentra el receptor. |
| [BuyerDetailView.tsx](../../frontend/src/modules/buyer/components/BuyerDetailView.tsx) | Reorganiza tres tarjetas: perfilamiento de necesidad, clasificación/preparación para LEAD y recomendación; distingue algunos textos de acción ejecutada. |
| [BuyerDetailModal.tsx](../../frontend/src/modules/buyer/components/BuyerDetailModal.tsx) | Reorganiza las tarjetas del modal y sus textos de resultado/recomendación. |
| [BuyerListView.tsx](../../frontend/src/modules/buyer/components/BuyerListView.tsx) | Consume los indicadores del backend; retira tendencias fijas y consulta adicional al listado LEAD. |
| [buyer.service.ts](../../frontend/src/modules/buyer/services/buyer.service.ts) | Extiende BuyerPage con el contrato opcional indicators. |
| [Indicadores de Buyer en NexoSalud.md](./Indicadores%20de%20Buyer%20en%20NexoSalud.md) | Redefine B3 de costo por LEAD a tiempo promedio de conversión, incluyendo fórmula y semáforo. |
| [PRUEBAS_3_ACTIVIDADES_AGENTE_BUYER.md](./PRUEBAS_3_ACTIVIDADES_AGENTE_BUYER.md) | Añade una guía de demostración manual desde la ficha; no es evidencia de ejecución ni sustituye los criterios QA acordados. |

## Conservación del trabajo y configuración

Se verificó por SHA-256 la conservación byte a byte de **110 archivos preexistentes** seleccionados: scripts, pruebas, evidencias y documentos de los bloques QA anteriores, los seis reportes antiguos y archivos de entorno existentes. El resultado guarda solo la comprobación de conservación, sin divulgar valores ni huellas de secretos. Ningún archivo comprobado cambió. Se conservaron los ZIP previos y el resto del trabajo local; no se incorporan ZIP al commit.

Evidencia: [CONSERVACION_Y_REVISION.json](../../database/qa/buyer_integracion/ejecucion_20261112T221624Z/CONSERVACION_Y_REVISION.json). Incluye SHA completos, commits recibidos, respaldo, ausencia de conflictos, comparación de los ocho archivos con el origen y ausencia de cambios en dependencias/Prisma/SQL.

Los resultados y criterios anteriores se conservan como evidencia del commit que probaron; su inclusión en el merge **no certifica automáticamente este nuevo árbol**. En particular, sus huellas de producción no deben actualizarse como si sus pruebas ya hubieran sido repetidas aquí.

No se modificaron archivos de entorno, se inició index.ts, Mart, dunning o recuperadores generales, ni se hizo push. No se conectó a SQL Server, se ejecutaron scripts SQL o se llamó a Gemini durante esta integración. Los ensayos HTTP unitarios solo abrieron servidores locales efímeros con persistencia simulada.

## Dependencias, Prisma y requisitos SQL

- **Sin cambios** en manifiestos/lockfiles de backend/frontend, esquema Prisma, migraciones o archivos SQL desde el ancestro común. No fue necesario ejecutar npm ci ni regenerar Prisma por esta integración. Se usaron las dependencias existentes; Node v24.15.0, Vitest 5.0.1 y Vite 8.3.0.
- No se ejecutaron migraciones, db push, reset ni instaladores. La alineación QA P2022 previa se conserva; no se repite.
- El receptor sigue requiriendo dbo.usp_RegistrarEntradaAgenteLead y sus dependencias existentes. La novedad es el chequeo OBJECT_ID con la identidad SQL de la aplicación antes de invocarlo. Su visibilidad de metadatos/permisos debe verificarse en QA; la ausencia produce un error explícito que el evaluador debe tratar como entrega pendiente.
- Los nuevos indicadores solo leen campos ya presentes de Personas y su Etapa. Esto no añade una dependencia de esquema; tampoco demuestra que esos campos sean la fuente funcional correcta de las métricas.
- Destino del siguiente ensayo SQL: **DANIELPC / NexoSalud_LeadEnsayoFinal**, confirmado en los bloques anteriores. **No se volvió a confirmar mediante conexión real en este bloque**; deberá hacerse antes de las próximas pruebas.

## Compilaciones y pruebas locales

Se leyeron los scripts y la configuración de pruebas antes de ejecutarlos. Las compilaciones realizan tsc y Vite, no arrancan la aplicación. No se ejecutaron las pruebas QA que escriben fixtures en SQL ni buyerIntegrationFlow.test.ts, aunque tenga guardas de entorno.

El [preload de aislamiento](../../database/qa/buyer_integracion/bloquear_servicios_reales.cjs) fija flags SQL/live en false, desactiva Mart/dunning, sustituye las conexiones del proceso por un destino bloqueado y usa una clave ficticia. Rechaza fetch externos y conexiones TCP hacia puertos de bases conocidos; permite HTTP local efímero para tests de rutas. Se propaga a workers mediante NODE_OPTIONS. No edita archivos de entorno ni reemplaza datos de producción en disco. Es un mecanismo de aislamiento de estas pruebas, no evidencia de recuperación ni de SQL real.

| Comprobación | Resultado final | Evidencia |
| --- | --- | --- |
| `npm --prefix backend run build` | Salida **0**, tsc aprobado | [BUILD_BACKEND.txt](../../database/qa/buyer_integracion/ejecucion_20261112T221624Z/BUILD_BACKEND.txt) |
| `npm --prefix frontend run build` | Salida **0**, tsc + Vite aprobados, 3684 módulos transformados | [BUILD_FRONTEND.txt](../../database/qa/buyer_integracion/ejecucion_20261112T221624Z/BUILD_FRONTEND.txt) |
| Siete suites Buyer/matrices seleccionadas | Salida **0**: **80 aprobadas, 4 omitidas**; siete archivos aprobados | [TESTS_OFFLINE_TERCERA.txt](../../database/qa/buyer_integracion/ejecucion_20261112T221624Z/TESTS_OFFLINE_TERCERA.txt) |
| Nueva suite de disponibilidad LEAD | Salida **0**: **7 aprobadas**, un archivo aprobado | [TESTS_LEAD_DISPONIBILIDAD_FINAL.txt](../../database/qa/buyer_integracion/ejecucion_20261112T221624Z/TESTS_LEAD_DISPONIBILIDAD_FINAL.txt) |

**Total final: 87 pruebas aprobadas, 4 omitidas**, en dos invocaciones focalizadas. Las cuatro omitidas son de Gemini real y no cuentan como aprobadas. No se ejecutó toda la suite del proyecto ni recorridos de interfaz.

La suite nueva [leadIntakeAvailability.test.ts](../../backend/tests/leadIntakeAvailability.test.ts) verifica IDs inválidos sin consulta, metadatos vacíos/procedimiento ausente con error explícito sin ejecutar receptor, y procedimiento presente con la solicitud/entrada esperadas. Todas sus consultas son dobles unitarios; no acredita instalación o funcionamiento SQL del receptor en esta versión.

Comandos reproducibles desde la raíz, con una consola de validación separada para no conservar sus variables en una consola de operación:

```powershell
npm --prefix backend run build
npm --prefix frontend run build
$guardPath = (Resolve-Path database/qa/buyer_integracion/bloquear_servicios_reales.cjs).Path.Replace('\','/')
$env:NODE_OPTIONS = '--require="' + $guardPath + '"'
npm --prefix frontend test -- backend/tests/buyerCampaignMatrix.test.ts backend/tests/buyerDurationMatrix.test.ts backend/tests/buyerDurationRoute.test.ts backend/tests/buyerMessageClassifier.test.ts backend/tests/buyerMessageJourney.test.ts backend/tests/buyerUnifiedEvaluation.test.ts backend/tests/matrixUnknowns.test.ts
npm --prefix frontend test -- backend/tests/leadIntakeAvailability.test.ts
```

No usar estas variables bloqueadas para un ensayo SQL posterior: salir de esa consola y preparar el ensayo QA por separado. El runner oficial resuelve Vitest instalado en node_modules de la raíz; no se presupone un binario bajo frontend/node_modules. Las dependencias no se reinstalaron para corregir una ruta de invocación.

### Incidentes de validación resueltos

Se conservan los errores iniciales, sin presentarlos como fallos de la aplicación ni esconderlos:

1. La herramienta de tareas del editor devolvió `No invocation context`, sin crear tareas ni ejecutar builds. Se usaron los scripts npm revisados directamente.
2. [Primera invocación offline](../../database/qa/buyer_integracion/ejecucion_20261112T221624Z/TESTS_OFFLINE_PRIMERA.txt): NODE_OPTIONS con barras Windows no escapadas produjo MODULE_NOT_FOUND antes de arrancar Vitest. Se corrigió a barras `/`.
3. [Segunda invocación offline](../../database/qa/buyer_integracion/ejecucion_20261112T221624Z/TESTS_OFFLINE_SEGUNDA.txt): se asumió un binario Vitest bajo frontend/node_modules; el existente está resuelto desde la raíz. No se ejecutó ningún test. Se corrigió usando el script npm oficial; la tercera invocación pasó.
4. [Primera prueba nueva del receptor](../../database/qa/buyer_integracion/ejecucion_20261112T221624Z/TESTS_LEAD_DISPONIBILIDAD.txt): dos fallos debidos a que it.each desestructuraba los arrays de metadatos y entregaba un valor no iterable al doble. Se corrigió la tabla a objetos con propiedad rows, manteniendo intacta la aserción de LeadIntakeUnavailableError. La implementación de Germain no cambió. La ejecución final pasó las siete pruebas.

Se siguieron los principios de validación runtime de distinguir defectos de invocación/prueba de fallos de aplicación. La herramienta específica de validación TypeScript no está invocable en esta sesión; no se atribuyen a ella estos resultados de npm/Vitest ni se fabrica un standalone-result.

El control de formato al preparar el commit encontró únicamente cuatro avisos de línea vacía final en salidas originales de herramientas. Se conservan esas salidas sin editarlas; no afectan código ni pruebas. Los avisos y su excepción limitada a esos archivos TXT se registran en [CONTROL_FORMATO_EVIDENCIAS.json](../../database/qa/buyer_integracion/ejecucion_20261112T221624Z/CONTROL_FORMATO_EVIDENCIAS.json). No se declara que el chequeo de formato sin excepciones haya dado salida 0.

## Diferencias funcionales que no se resuelven por inventar comportamiento

### Actividades y conversación

Los [criterios acordados](./CRITERIOS_ACEPTACION_ACTIVIDADES_BUYER.md) exigen: **1) validación de datos, 2) orientación personalizada y aclaración, 3) recomendación**. El avance recibido rotula **1) perfilamiento de necesidad clínica, 2) clasificación de intención/preparación para LEAD, 3) recomendación**. La nueva [guía de Germain](./PRUEBAS_3_ACTIVIDADES_AGENTE_BUYER.md) describe esos otros nombres y una demostración con Actualizar. Ambas referencias quedan conservadas; renombrar tres tarjetas no acredita el acuerdo funcional ni sustituye la actividad de orientación.

El avance no modifica el clasificador, el evaluador ni el formulario conversacional público. La orientación personalizada, la continuidad automática tras una respuesta, el origen transcrito y sus evidencias deben comprobarse con la matriz A–H acordada. No se introduce aprobación humana obligatoria para conciliarlos.

La ficha usa la evaluación backend, mientras el modal mantiene el análisis de analyzeBuyerMarketingAgent. Esa doble fuente exige comprobar coherencia, incluidos PAYER y mensajes nuevos. En la nueva tarjeta de preparación de la ficha, el texto alternativo “Debe permanecer en BUYER” requiere contraste cuando la persona ya es PAYER; no se ejecutó su recorrido visual. La representación de conversión por estado global tampoco demuestra entrega CONFIRMADA de la interacción vigente. Estas observaciones de código no se convierten en cambios funcionales no acordados.

### Indicadores: contraste de fórmula y fuente, sin aprobación numérica

Se contrastó el código recibido con su documentación y las fuentes que consulta. **No se calcularon valores reales en QA ni se declaran correctos B1/B2/B3.**

| Indicador | Implementación recibida / riesgo pendiente |
| --- | --- |
| B1, conversión en 14 días | Cuenta personas utilizables actualmente en LEAD/PAYER/CUSTOMER/TURNED cuyo intervalo Personas.fecha_actualizacion − Personas.fecha_registro está entre 0 y 14. La definición habla de conversión verificable desde captación; fecha_actualizacion no es necesariamente la fecha del evento BUYER→LEAD y puede cambiar después. Contrastar contra CaptacionesBuyer/EventosEtapa y definir cohorte/vigencia. |
| B2, contactos utilizables | Numerador: nombres/apellidos, contacto no vacío, autorización=true, no duplicado detectado y calidad distinta de Rechazado. Esto no exige explícitamente calidad Valido ni formato de contacto válido. Duplicación inferida se calcula sobre candidatos en BUYER; revisar su significado en etapas avanzadas y frente al universo del denominador/filtros. |
| B3, tiempo promedio | Cambia explícitamente el B3 documental anterior de costo por LEAD a tiempo de conversión. El promedio usa diferencias no negativas con fecha_actualizacion presente, pero conversions cuenta todos los convertidos, incluso sin fecha válida. El divisor que puede mostrar la tarjeta no siempre coincide con el usado por averageDays. Ejemplo lógico, no dato QA: dos convertidos, solo uno con intervalo de 2 días, producirían promedio 2, totalDays 2 y conversions 2; el detalle 2/2 no explica ese promedio. Coordinar definición y fuente antes de aceptarlo. |
| Período y filtros | Los indicadores se calculan fuera de la página visible y aplican búsqueda/fecha/canal/estado, pero se rotulan “Histórico completo”/“Histórico”. Comprobar coherencia del rótulo con el filtro, respuesta no paginada, cero denominadores, NULL y cambios de tamaño de página. |

Las pruebas de matrices aprobadas corresponden a sus agregaciones y fuentes simuladas existentes; **no validan por extensión la nueva agregación del listado**. Los reportes de inversión/CPL permanecen como componentes distintos; la redefinición de B3 del listado/documento no equivale a una redefinición aprobada de todos los reportes del proyecto.

### Concurrencia: defecto previo abierto

El [informe de fallos/concurrencia](./PRUEBAS_FALLOS_CONCURRENCIA_BUYER_QA_DANIEL.md) conserva el caso con dos peticiones realmente solapadas, dos interacciones/decisiones y una sola conversión comercial para la misma Idempotency-Key. El diff de Germain no cambia esa frontera del registro. **Sigue pendiente; no se declara corregido.** No se repitió aquí porque el ensayo escribe en SQL y está excluido de esta ventana. Los IDs y resultados antiguos no deben confundirse con evidencia posterior al merge.

## Siguiente bloque en QA

1. Registrar el SHA efectivo del merge y conservar los historiales. Comprobar de nuevo procesos y configuración sin divulgar secretos; confirmar exclusivamente DANIELPC / NexoSalud_LeadEnsayoFinal por consultas de lectura y usar el respaldo recuperable conforme al alcance del ensayo.
2. Revisar la sonda previa y las huellas/prerrequisitos SQL existentes, sin ejecutar instaladores por defecto. No hay un nuevo script SQL recibido que deba aplicarse. Verificar también la visibilidad de OBJECT_ID con la cuenta de aplicación.
3. Repetir listado/ficha y las lecturas Prisma contra ese destino. Capturar indicators paginados con sus filtros y contrastar manualmente numerador, denominador, fechas y fuente con consultas de lectura, antes de aceptar sus cifras o semáforos.
4. En una ventana de pruebas autorizada para escrituras sintéticas, reutilizar los arneses de [backend](../../database/qa/buyer_backend/) y [fallos/concurrencia](../../database/qa/buyer_fallos_concurrencia/), con prefijos y carpetas nuevos. Mantener solo Gemini controlado y los servicios generales detenidos. **Repetir explícitamente la carrera de Idempotency-Key sin debilitar aserciones.** Revisar primero sus guardas frente al nuevo chequeo del receptor; conservar fallos como evidencia.
5. Coordinar las diferencias de actividades y ejecutar los [escenarios A–H](./CRITERIOS_ACEPTACION_ACTIVIDADES_BUYER.md) cuando esté disponible el recorrido final. La interfaz, Gemini real y recuperación automática tras caída requieren evidencias separadas; no se acreditan con estas compilaciones o pruebas unitarias.

La integración técnica local puede confirmarse con las compilaciones/pruebas finales aprobadas y ambos padres conservados. **La aceptación funcional completa del agente no está lista:** concurrencia, indicadores y las diferencias señaladas siguen abiertos. No se hizo push.
