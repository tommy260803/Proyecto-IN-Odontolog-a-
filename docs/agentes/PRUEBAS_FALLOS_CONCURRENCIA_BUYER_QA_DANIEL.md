# Fallos y envíos concurrentes Buyer — QA Daniel

**Resultado: A y B aprobados; C fallido por duplicación de interacción y decisión con la misma Idempotency-Key. Salida del runner: 1.** El fallo se conserva para Germain; no se modificó producción ni se relajaron aserciones. La conversión y recepción SQL de C conservaron una única identidad comercial.

## Versión, destino y alcance

- Rama inspeccionada y conservada: `feature/buyer-orientacion-interactiva`.
- HEAD: **`19613358530e899bfc68d5e6b3c33b6336ab9ce4`**.
- Ventana real de pruebas: **2026-11-12 20:09:40.969–20:09:45.361 UTC**, 15:09 en Bogotá.
- Destino efectivo, verificado por la misma conexión Prisma antes y después: **DANIELPC / NexoSalud_LeadEnsayoFinal**.
- Prefijo exclusivo, inicialmente ausente: **`QA_BFC_20261112T200939Z_`**.
- Servicio real activo utilizado en C: **1 — Evaluación odontológica**.
- Node **v24.15.0**, dependencias existentes. Sin instalación de paquetes.

Se revisaron el [informe backend anterior](./PRUEBAS_BACKEND_BUYER_QA_DANIEL.md), el [informe SQL](./PRUEBAS_CONVERSION_BUYER_QA_DANIEL.md), el [informe de compatibilidad](./REVISION_QA_BUYER_DANIEL.md), el arnés existente y las pruebas de [integración Buyer](../../backend/tests/buyerIntegrationFlow.test.ts), además de las definiciones actuales del router, evaluador y clasificador. La prueba existente de concurrencia sobre una interacción ya creada no acredita la idempotencia del registro público simultáneo; este bloque prueba esa frontera.

Se conservaron los cambios locales y archivos sin versionar. No se encontraron instrucciones AGENTS.md aplicables en la revisión. No hubo cambio de rama, pull, merge, commit ni push. No se incorporaron cambios de Germain.

**Estos resultados solo corresponden al HEAD y huellas inspeccionados. Deben repetirse con prefijo nuevo sobre la versión final de Germain**, tanto los casos aprobados como el caso defectuoso. Un cambio en el router, evaluador, Prisma o procedimientos puede cambiar el resultado.

## Reutilización, aislamiento y frontera simulada

Los nuevos archivos están separados en [buyer_fallos_concurrencia](../../database/qa/buyer_fallos_concurrencia/). Se reutilizan sin modificación [consultas_qa.cjs](../../database/qa/buyer_backend/consultas_qa.cjs) para inspección/lectura de fixtures y conteos/huellas, y [entorno_qa.cjs](../../database/qa/buyer_backend/entorno_qa.cjs) para serialización y huellas de producción. Las huellas de ambos auxiliares coinciden con la entrega anterior.

[entorno_fallos.cjs](../../database/qa/buyer_fallos_concurrencia/entorno_fallos.cjs) conserva las guardas de conexión y usa una carpeta/prefijo nuevos. TEST_SQLSERVER_URL tiene prioridad sobre SQLSERVER_URL, respetando el comportamiento del backend; no se imprime ninguna cadena completa ni clave. Las variables de aislamiento y la clave ficticia solo afectan al proceso de pruebas. El destino configurado se comprueba antes de crear Prisma y SELECT @@SERVERNAME/DB_NAME confirma el destino efectivo antes de escribir.

[pruebas_fallos_concurrencia.test.cjs](../../database/qa/buyer_fallos_concurrencia/pruebas_fallos_concurrencia.test.cjs) monta las **rutas actuales reales** en Express loopback con puerto efímero. Solo permite registro público y retry explícito para estas peticiones. No importa index.ts ni el scheduler dunning, no invoca recuperadores generales y verifica Mart desactivado. No se arrancó backend general. El servidor de pruebas se cerró y Prisma se desconectó al terminar.

Las observaciones de procesos/puertos antes y después no muestran procesos del proyecto ni listeners 3001/5173; los procesos Node listados pertenecen a Codex. SQL Server Agent estaba detenido. Las inspecciones SQL previas/posteriores no encontraron peticiones activas ni transacciones ajenas en esta base. Son comprobaciones de la ventana observada, no un bloqueo permanente contra futuras escrituras externas.

[gemini_fallos_controlados.cjs](../../database/qa/buyer_fallos_concurrencia/gemini_fallos_controlados.cjs) conserva el constructor real del SDK mediante subclase e instala únicamente la sustitución de **Models.generateContent en memoria**. A lanza errores con status 503; B y C devuelven text JSON. Se mantienen prompt, catálogo SQL, validación, reintentos, backoff y persistencia reales del clasificador/evaluador. No se usa classifierOverride y no se simulan Prisma, conversión ni receptor.

Se observaron **6 llamadas externas simuladas**: tres errores en A, una respuesta válida en B y dos respuestas válidas en C. **Cero intentos HTTP externos**. El monitor fetch permite solamente el origen propio del arnés. El nombre de modelo presente en la evidencia es configuración del clasificador, no ejecución del modelo.

Las ocho huellas de producción se conservaron: conexión, esquema Prisma, rutas Buyer, evaluador, clasificador, receptor, Mart y tipos Buyer. Los dos procedimientos y la vista coinciden antes/después con las huellas del bloque SQL previo:

| Objeto SQL real | SHA-256 de definición NVARCHAR |
| --- | --- |
| dbo.usp_ConvertirBuyerALead | `6A42F2ADD1BE9F827074A50A6DCB579C6341F71C35E8F0216E4E04A70DC634A5` |
| dbo.usp_RegistrarEntradaAgenteLead | `280708E81E3BE607A3772F082961EBE6E8371C1698414F3FDAC8B82D8A0C087E` |
| dbo.v_DatosCaptacionBuyer | `BAC8AB4A8AF43E8FB98BFABFE29FA8DC4F4D17F42CB5389EDEF23844EE85665D` |

## A. Agotamiento de fallos transitorios — APROBADO

Se envió un registro **público**, que guarda y evalúa automáticamente, con un contacto sintético nuevo y mensaje informativo. Cada llamada a Gemini devolvió el error controlado `QA_GEMINI_503`, status 503. No se alteraron las opciones del clasificador: maxRetries=2 produce **tres intentos reales de su bucle**, con backoff predeterminado de 500/1000 ms más jitter.

Esperado y obtenido:

- HTTP **202**, success=true; estado PENDIENTE, acción REINTENTO_PENDIENTE.
- Mensaje exacto persistido una vez en interacción **20191**, persona **10989**, captación **10987**.
- Una decisión **165**, requiere_revision=true; `intentosRealizados=3`, `intentos_realizados=3` y fingerprint `5d71dc0f835fb4c31942d0fcbd0c1159`.
- Error persistido: `Fallo al clasificar mensaje Buyer tras 3 intento(s): QA_GEMINI_503`.
- `historial_errores` contiene **una entrada del ciclo de evaluación fallido**, no tres entradas: coincide con el contrato vigente. Los tres intentos individuales aparecen en la traza de la sustitución SDK.
- BUYER; cero solicitudes, eventos o entradas LEAD. El error Gemini no deshace el mensaje confirmado previamente.

Los intentos simulados ocurrieron a 20:09:42.752, 20:09:43.274 y 20:09:44.303 UTC. La duración persistida de ese ciclo fue **1552 ms**. Que el trabajo sea recuperable se comprueba con B mediante retry explícito; no se afirma recuperación automática.

Evidencia: [CASO_A.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/CASO_A.json).

## B. Retry explícito después del fallo — APROBADO

Sin registrar de nuevo el mensaje, POST `/api/buyer/evaluations/20191/retry` devuelve una respuesta Gemini controlada SOLO_CONSULTA, id_servicio=null. La ruta y retryEvaluationByInteraction reconstruyen el contexto desde SQL real.

Esperado y obtenido: HTTP **200**, COMPLETADA/SOLO_CONSULTA; se mantienen **persona 10989, captación 10987, interacción 20191, decisión 165 y fingerprint**. Sigue habiendo un solo mensaje, una decisión y ninguna fila comercial. El contador acumulado pasa de **3 a 4** en SQL y HTTP, con una llamada SDK nueva. Se conserva exactamente el historial del fallo anterior en la decisión y en HTTP; requiere_revision pasa a false. La persona sigue BUYER.

La duración final persistida, **1 ms**, corresponde a la clasificación del ciclo exitoso actual; el contador sí es acumulado. No se interpreta ese campo como suma de latencias anteriores ni se exige un historial de duración que el contrato actual no almacena.

Evidencia: [CASO_B.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/CASO_B.json), que conserva el estado previo al retry y el posterior. La decisión 165 actual ya está COMPLETADA; la evidencia A conserva el estado pendiente observado antes de B.

## C. Registro público simultáneo con la misma clave — FALLO DE APLICACIÓN

Dos clientes enviaron el mismo JSON y encabezado **Idempotency-Key `qa_bfc_20261112t200939z_c`**, con sujeto nuevo y solicitud de reserva para servicio activo 1. Hash de contenido idéntico persistido en ambas decisiones: `5294f5c1a1600515bb2786749b46a53430780a9881b662d9cc6bb3a1d372eb1f`.

Las dos tareas esperan una barrera cliente común y se despachan juntas con Promise.allSettled. Una segunda barrera HTTP, antes del router, espera ambas recepciones y libera las dos. **No hay barrera, sustitución ni resultado fabricado en Prisma.** El middleware de observación siempre ejecuta `next(params)`. El retardo de **600 ms** solo afecta a la respuesta externa Gemini simulada de C y permanece por debajo del timeout real.

### Evidencia de solapamiento

Los tiempos ms siguientes son monotónicos, del mismo proceso (performance.now), no relojes de servidores distintos:

| Petición | Recepción HTTP ms | Entrada al router ms | Fin de respuesta ms | HTTP | Interacción / decisión |
| --- | --- | --- | --- | --- | --- |
| C1 | 3525.473 | 3526.600 | 4204.095 | 201 | 20193 / 167 |
| C2 | 3526.552 | 3526.726 | 4203.781 | 201 | 20192 / 166 |

Ambas peticiones fueron recibidas antes de liberar la barrera y entraron al router antes de terminar cualquiera. **Solapamiento servidor: 677.055 ms; cliente: 681.211 ms.** El primer instante UTC de recepción fue 20:09:44.377 y ambas respuestas terminaron a 20:09:45.056 UTC. No son dos peticiones secuenciales.

Lecturas reales de idempotencia observadas:

| Petición | Inicio ms | Fin ms | Decisión encontrada |
| --- | --- | --- | --- |
| C2 | 3528.025 | 3530.267 | ninguna |
| C1 | 3532.521 | 3533.255 | ninguna |

Ambas lecturas terminaron antes del primer create de interacción (3544.507 ms) o de decisión (3546.168 ms). Luego C1 también inició create de interacción a 3571.786 ms y de decisión a 3573.958 ms. Estos tiempos de middleware señalan inicio de operación Prisma, no instantes exactos de commit SQL.

### Esperado frente a obtenido

| Invariante | Esperado | Obtenido |
| --- | --- | --- |
| Persona / captación | 1 / 1 | 1 / 1: **10990 / 10988** |
| Interacción por clave y contenido | 1 | **2: 20192 y 20193** |
| Decisión por clave | 1 | **2: 166 y 167** |
| Identidad de interacción devuelta | igual | **distinta** |
| Solicitud / evento / entrada LEAD | 1 / 1 / 1 vinculados | **1 / 1 / 1: 2920 / 4092 / 2920**, vinculados correctamente |
| Etapa y entrega | LEAD / CONFIRMADA | LEAD; ambas decisiones CONFIRMADA |
| Mensaje comercial | registrado una vez | ambas interacciones con el mismo mensaje y solicitud 2920 |

C1 fue tratado como consulta recurrente de la misma persona (totalConsultas=2); C2 como registro inicial. Ambos HTTP 201. Se observaron dos clasificaciones y **dos EXEC de conversión y dos de recepción reales**; los procedimientos protegieron la identidad comercial, pero no impidieron duplicar el registro de mensaje/decisión previo.

Fallaron cinco aserciones de cardinalidad/identidad, todas derivadas de esa duplicación. La aserción de una sola decisión CONFIRMADA falla porque hay **dos confirmadas**, no porque la entrega SQL haya fallado. No se observó excepción Prisma, bloqueo de barrera, intento de red externa, error de montaje ni fallo de la comprobación final. Por ello es un fallo de aplicación demostrado, no un bloqueo del arnés.

### Causa sustentada y caso para Germain

En el [router actual](../../backend/src/routes/buyer.routes.ts), la búsqueda de Idempotency-Key en DecisionesIA.entrada ocurre **antes de la transacción writeBuyer** (aprox. líneas 479–529). La transacción posterior guarda incondicionalmente una interacción y decisión nuevas (aprox. líneas 670–718). Aunque writeBuyer usa Serializable y protege la identidad de persona/captación, no vuelve a reservar/comprobar la clave dentro de esa unidad atómica. Las dos consultas previas devuelven ninguna decisión y ambas peticiones pueden avanzar.

El [evaluador actual](../../backend/src/services/buyerEvaluationService.ts) serializa por **id_interaccion**, no por la clave de registro; aquí ya recibe dos IDs distintos. Esta protección no reúne las dos operaciones.

La [inspección SQL independiente](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/DIAGNOSTICO_SQL_SOLO_LECTURA.txt) confirma que la clave queda en el JSON entrada: DecisionesIA solo tiene su PK por id_decision entre los índices inspeccionados, sin una columna/computada o restricción única que reserve Idempotency-Key. Interacciones tampoco tiene una clave única de operación. En cambio, EventosEtapa conserva índice único filtrado en clave_operacion_buyer y EntradasAgenteLead PK por id_solicitud más unicidad de id_evento_etapa, coherentes con la no duplicación comercial observada.

Esta explicación combina el intercalado observado, el código inspeccionado y los índices efectivos. **No se aplicó corrección ni DDL.** Germain debe coordinar una reserva/verificación atómica de la identidad del registro y sus contratos de replay/409, sin depender solo de la protección por interacción. Cualquier propuesta de contrato o índice requiere revisión separada; no se implementó en este bloque.

Reproductor: ejecutar el [test nuevo](../../database/qa/buyer_fallos_concurrencia/pruebas_fallos_concurrencia.test.cjs) siguiendo el [README](../../database/qa/buyer_fallos_concurrencia/README.md), con prefijo nuevo. C conserva las aserciones esperadas de una sola interacción/decisión y debe quedar rojo en el intercalado defectuoso. No volver a enviar la clave ya preservada para reproducir la carrera inicial: su replay posterior encontraría una decisión existente y sería otro escenario. Una reproducción futura puede tener un intercalado distinto; una ejecución sin duplicación no acredita por sí sola ausencia de carrera.

Evidencia completa: [CASO_C.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/CASO_C.json) y [RESULTADOS.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/RESULTADOS.json). No se enviaron mensajes externos a Germain; este informe es el relevo reproducible.

## Datos conservados y efectos de esta ejecución

**Hubo escrituras SQL reales confirmadas**, no solo consultas: dos personas sintéticas nuevas, dos captaciones, tres interacciones, tres decisiones, una solicitud, un evento, una entrada LEAD y dos preferencias. El retry modifica la decisión/interacción existentes de A/B; C actualiza la misma persona al guardar su segundo registro duplicado. Los procedimientos y rutas usan sus transacciones reales. No se envolvieron en rollback artificial ni se limpió la evidencia.

| Sujeto | Persona | Captación | Interacciones | Decisiones | Solicitud / evento / entrada | Etapa final |
| --- | --- | --- | --- | --- | --- | --- |
| QA_BFC_20261112T200939Z_AB | 10989 | 10987 | 20191 | 165 | ninguna | BUYER |
| QA_BFC_20261112T200939Z_C | 10990 | 10988 | 20192, 20193 | 166, 167 | 2920 / 4092 / 2920 | LEAD |

Correos: prefijo/nombre anterior en minúsculas más `@example.invalid`; apellidos QA SINTETICO. No se usaron sujetos históricos del poblamiento ni de bloques previos. No hubo limpieza global, DELETE, DDL, reinstalación de esquema ni modificaciones a procedimientos/Prisma.

| Tabla | Antes | Después | Nuevas filas del prefijo |
| --- | --- | --- | --- |
| Personas | 10815 | 10817 | 2 |
| CaptacionesBuyer | 10815 | 10817 | 2 |
| Interacciones | 20009 | 20012 | 3 |
| DecisionesIA | 6 | 9 | 3 |
| Solicitudes | 2865 | 2866 | 1 |
| EventosEtapa | 4045 | 4046 | 1 |
| EntradasAgenteLead | 4 | 5 | 1 |
| PersonaPreferencias | 5 | 7 | 2 |

La diferencia de conteos coincide con los registros del prefijo. Las **ocho huellas SHA-256** del JSON ordenado por PK, con todas las columnas y excluyendo el prefijo propio, permanecen iguales. Esto comprueba esa representación del contenido fuera del fixture en esas ocho tablas; no es una auditoría integral del contenido de toda la base. Opciones 310, Reservas 124 y PropuestasEconomicasLead 0 conservaron sus conteos; no se calculó su huella de contenido. Objetos de usuario: 256, sin cambio.

## Comandos ejecutados y evidencias

Desde la raíz del repositorio:

```powershell
node --check database/qa/buyer_fallos_concurrencia/entorno_fallos.cjs
node --check database/qa/buyer_fallos_concurrencia/gemini_fallos_controlados.cjs
node --check database/qa/buyer_fallos_concurrencia/pruebas_fallos_concurrencia.test.cjs
$env:QA_BUYER_FAILURE_RUN_ID = '20261112T200939Z'
node --test --test-concurrency=1 database/qa/buyer_fallos_concurrencia/pruebas_fallos_concurrencia.test.cjs
```

Tres comprobaciones de sintaxis con salida 0. Runner con **salida 1**, cuatro tests contabilizados: **dos aprobados A/B, dos fallidos C y padre por el subtest fallido; cero omitidos/cancelados**. No son dos defectos independientes. Duración total **4565 ms**. El chequeo del panel de problemas no encontró errores en los archivos nuevos. Se utilizó directamente Node Test Runner; no se afirma haber ejecutado una herramienta de validación TypeScript no invocable en esta sesión.

El parámetro test-concurrency=1 ordena los escenarios; no vuelve secuenciales las dos peticiones Promise.allSettled de C, como demuestran las trazas.

Después se ejecutó [02_DIAGNOSTICO_SOLO_LECTURA.sql](../../database/qa/buyer_fallos_concurrencia/02_DIAGNOSTICO_SOLO_LECTURA.sql) con SQLCMD, salida **0**, usando `-S DANIELPC -d NexoSalud_LeadEnsayoFinal -E -b -r 1 -f 65001 -y 0 -w 65535`. No modifica datos. Su guarda rechaza otro servidor/base; el prefijo está limitado a los sujetos entregados. Comando completo reproducible en el [README](../../database/qa/buyer_fallos_concurrencia/README.md).

Evidencias nuevas en [ejecucion_20261112T200939Z](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/):

- [ENTORNO_ANTES.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/ENTORNO_ANTES.json) y [ENTORNO_DESPUES.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/ENTORNO_DESPUES.json): versión, Git, procesos/puertos y servicio SQL Agent.
- [ESTADO_ANTES.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/ESTADO_ANTES.json) y [RESULTADOS.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/RESULTADOS.json): destino, huellas, estado final, casos, HTTP, cronología, errores, SQL real y simulación.
- [CASO_A.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/CASO_A.json), [CASO_B.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/CASO_B.json), [CASO_C.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/CASO_C.json): esperados y obtenidos, sin alterar las aserciones.
- [EJECUCION_NODE_TEST.txt](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/EJECUCION_NODE_TEST.txt) y [COMANDO_RESULTADO.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/COMANDO_RESULTADO.json): salida original y código 1.
- [DIAGNOSTICO_SQL_SOLO_LECTURA.txt](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/DIAGNOSTICO_SQL_SOLO_LECTURA.txt) y [DIAGNOSTICO_SQL_RESULTADO.json](../../database/qa/buyer_fallos_concurrencia/ejecucion_20261112T200939Z/DIAGNOSTICO_SQL_RESULTADO.json): corroboración SQLCMD de sujetos, JSON de claves e índices.

## Estado Git, entrega y límites

No hay diferencias en archivos versionados ni en el índice Git. Los nuevos archivos de este bloque son este informe y la carpeta QA separada indicada; figuran sin versionar. Se conservaron los seis reportes RESULTADOS_REVISION_BUYER, las carpetas QA anteriores, los otros informes sin versionar y los ZIP previos. La entrega ZIP está ignorada por las reglas existentes. No se modificaron rutas, servicios, tipos, componentes, pruebas existentes, Prisma ni procedimientos.

Paquete nuevo: [pruebas_fallos_concurrencia_buyer_qa_daniel_20261112.zip](../../pruebas_fallos_concurrencia_buyer_qa_daniel_20261112.zip). Incluye pruebas/scripts/informe/evidencias de este bloque y los dos auxiliares reutilizados sin cambios, con rutas relativas. No incluye secretos, archivos de entorno, dependencias, dist, .git ni respaldos. [MANIFIESTO_ENTREGA.json](../../database/qa/buyer_fallos_concurrencia/MANIFIESTO_ENTREGA.json) enumera contenido y huellas; [VERIFICACION_ZIP.json](../../database/qa/buyer_fallos_concurrencia/VERIFICACION_ZIP.json) se genera externamente tras abrir y leer todas las entradas, comparándolas contra el origen. La verificación del empaquetado no cambia el resultado funcional fallido de C.

Se prueba una pareja concurrente real HTTP, en una instancia del router, con el intercalado observado y SQL Server real. No se certifican otros intercalados, volumen de carga, varios procesos/instancias ni todos los errores externos posibles. A simula errores 503, no timeout o cancelación real de red. B usa retry explícito, no recuperación general o posterior a caída.

**No están probados Gemini real, calidad de clasificación, interfaz ni recuperación automática después de una caída.** Tampoco rollback ante fallo ni reinicio del backend. La corrección de la carrera queda pendiente de coordinación con Germain y de repetición de estas pruebas en su versión final.
