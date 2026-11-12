# Pruebas de backend Buyer con SQL real — Daniel

**Resultado: A/B/C/D/E aprobados, salida 0.** Se probaron rutas HTTP y evaluador actuales con Prisma y procedimientos reales. Solo la respuesta externa de Gemini fue simulada; no se evaluó calidad del modelo.

## Versión y destino

- Fecha real de ejecución: **2026-11-12 19:57:52–19:57:55 UTC** (14:57 en Bogotá). El identificador se reservó al preparar el arnés; su hora no representa el inicio real.
- Rama conservada: `feature/buyer-orientacion-interactiva`.
- HEAD inspeccionado: `19613358530e899bfc68d5e6b3c33b6336ab9ce4`.
- Destino efectivo, confirmado antes y después por SELECT @@SERVERNAME / DB_NAME mediante el mismo Prisma que usan las rutas: **DANIELPC / NexoSalud_LeadEnsayoFinal**.
- Prefijo exclusivo, inicialmente ausente: **`QA_BBE_20261112T195045Z_`**. Los correos sintéticos usan `example.invalid`; no se usaron personas históricas como sujetos.
- Servicio real activo utilizado: **1, Evaluación odontológica**. Etapas reales: BUYER 1, LEAD 2, PAYER 3.
- Runtime: Node **v24.15.0**, dependencias ya instaladas del backend. No se instalaron dependencias.

Se leyeron los informes [de compatibilidad](./REVISION_QA_BUYER_DANIEL.md) y [de pruebas SQL](./PRUEBAS_CONVERSION_BUYER_QA_DANIEL.md), además de las pruebas existentes [buyerIntegrationFlow.test.ts](../../backend/tests/buyerIntegrationFlow.test.ts), [buyerMessageClassifier.test.ts](../../backend/tests/buyerMessageClassifier.test.ts), [buyerMessageJourney.test.ts](../../backend/tests/buyerMessageJourney.test.ts), [buyerUnifiedEvaluation.test.ts](../../backend/tests/buyerUnifiedEvaluation.test.ts) y [buyerDurationRoute.test.ts](../../backend/tests/buyerDurationRoute.test.ts). Las existentes ofrecen costuras útiles, pero las rutas no pasan classifierOverride. Las pruebas con persistencia simulada no se usaron como evidencia SQL; tampoco se ejecutó la suite amplia con escenarios de recuperación y limpieza fuera de este bloque.

No se encontraron AGENTS.md aplicables en la revisión inicial. Se conservaron los cambios anteriores, informes y ZIP. No se cambió de rama ni se ejecutaron pull, merge, commit o push. No se incorporó trabajo de Germain.

## Aislamiento y mecanismo de simulación

Los archivos de este bloque son nuevos y exclusivos de [QA backend](../../database/qa/buyer_backend/). Ningún archivo de producción fue editado. Se conservaron y compararon ocho huellas SHA-256: conexión, Prisma, rutas Buyer, evaluador, clasificador, receptor, Mart y tipos Buyer. Todas coinciden antes y después; las huellas completas están en [RESULTADOS.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/RESULTADOS.json).

[entorno_qa.cjs](../../database/qa/buyer_backend/entorno_qa.cjs) carga el entorno sin imprimir secretos, resuelve la precedencia TEST_SQLSERVER_URL sobre SQLSERVER_URL y fija la conexión resuelta solo en el proceso de prueba. Una base incorrecta bloquea la preparación; el servidor y la base efectivos se comprueban antes de cualquier fixture. No se modifica ningún archivo de entorno.

[gemini_controlado.cjs](../../database/qa/buyer_backend/gemini_controlado.cjs) usa una subclase del SDK real para instalar exclusivamente la sustitución en memoria de Models.generateContent. Devuelve el text JSON controlado para cada mensaje sintético. Se conservan el constructor real del SDK, los tipos, el prompt, el catálogo obtenido de SQL y el parseo/validación del clasificador real. La clave del proceso se sustituye por una ficticia. No se usa classifierOverride ni se simulan el evaluador, Prisma, conversión o recepción.

Se observaron **5 respuestas simuladas**, cada una con el catálogo en el prompt: A, B, C, preparación de E y nueva consulta E. D no volvió a clasificar. **Cero intentos HTTP externos**; el monitor solo permite el origen HTTP efímero local del arnés. El nombre de modelo que aparece en la evidencia es la configuración leída por el clasificador, no prueba de ejecución del modelo.

[pruebas_backend_real.test.cjs](../../database/qa/buyer_backend/pruebas_backend_real.test.cjs) monta el router real en Express local, con puerto efímero, y limita las rutas accesibles a registro público, administrativo, evaluación y retry. No importa index.ts ni el scheduler dunning; MartSyncService.isSyncEnabled() devuelve false por configuración. No se invoca recuperación general. El servidor de pruebas se cierra al finalizar y Prisma se desconecta.

Antes y después no se encontraron procesos del proyecto ni listeners en 3001/5173; SQL Server Agent estaba detenido. Las peticiones SQL ajenas activas y transacciones ajenas estaban vacías en las inspecciones. Los procesos Node listados pertenecen a Codex. Estas son observaciones durante la ventana de pruebas, no un bloqueo permanente contra nuevas escrituras externas.

Las huellas de los procedimientos y la vista coinciden con el bloque SQL anterior:

| Objeto instalado | SHA-256 de definición NVARCHAR |
| --- | --- |
| dbo.usp_ConvertirBuyerALead | `6A42F2ADD1BE9F827074A50A6DCB579C6341F71C35E8F0216E4E04A70DC634A5` |
| dbo.usp_RegistrarEntradaAgenteLead | `280708E81E3BE607A3772F082961EBE6E8371C1698414F3FDAC8B82D8A0C087E` |
| dbo.v_DatosCaptacionBuyer | `BAC8AB4A8AF43E8FB98BFABFE29FA8DC4F4D17F42CB5389EDEF23844EE85665D` |

El middleware de observación delega siempre a Prisma. Registró cuatro EXEC reales: conversión y recepción para C, y conversión y recepción para preparar E. Los registros persistidos y sus claves se leyeron después desde SQL. D no ejecutó de nuevo los procedimientos: resolvió la evaluación completada con la identidad previamente persistida.

## Casos esperados y obtenidos

| Caso | Esperado | Obtenido |
| --- | --- | --- |
| A, SOLO_CONSULTA | Registro público guarda mensaje, evalúa automáticamente, persiste decisión; BUYER, sin solicitud | HTTP 200; interacción 20186, decisión 160 COMPLETADA; BUYER; 0 solicitudes/eventos/entradas |
| B, AMBIGUA | Registro administrativo guarda; evaluación explícita pide aclaración sin convertir | Registro HTTP 201 sin decisión ni llamada Gemini; evaluate HTTP 200, ACLARACION no vacía, requiere_revision=true; BUYER; 0 filas comerciales |
| C, SOLICITA_RESERVA | Con datos válidos y servicio activo crea una solicitud, evento y entrada relacionados | Registro HTTP 201; evaluate HTTP 200; solicitud 2918, evento 4090, entrada 2918; LEAD; entrega CONFIRMADA; enlaces de persona/captación/solicitud/evento correctos |
| D, retry de interacción C | Identidad estable, sin filas comerciales adicionales | POST retry/20188 HTTP 200; misma decisión 162, solicitud 2918, evento 4090, fingerprint y entrada; ya_convertido=true; ninguna respuesta Gemini adicional |
| E, consulta nueva en PAYER | Guarda otro mensaje, conserva PAYER, sin apropiarse de conversión previa | Registro HTTP 200 sin evaluar automáticamente; evaluate HTTP 200 SOLO_CONSULTA, PAYER, NO_APLICA; nueva interacción 20190 sin id_solicitud; nueva decisión 164 sin solicitud ni evento; historial comercial y decisión anterior intactos |

En C también se comprobó la clave `BUYER_LEAD:10985`, la vinculación de la interacción con su solicitud y los IDs/CONFIRMADA dentro del JSON persistido de decisión. En E se compararon íntegramente las filas de solicitud, evento y entrada con su estado anterior, además del texto de la decisión previa. En A/B se comprobó la ausencia real de filas comerciales, no solo el contenido HTTP.

E requiere un historial comercial del propio sujeto nuevo: se creó por registro administrativo y evaluación reales, con solicitud 2919/evento 4091/entrada 2919. Después se hizo un **UPDATE SQL real** exclusivamente sobre persona 10988, condicionado por ID, nombre y correo sintéticos, para ponerla en PAYER. Ese paso prepara el fixture; **no prueba el flujo de pago ni la transición comercial a PAYER**. La nueva consulta se registró y evaluó después, preservando ese historial.

### Identidades sintéticas conservadas

| Caso | Persona | Captación | Interacción | Decisión | Solicitud | Evento | Entrada LEAD (id_solicitud) | Etapa final |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 10985 | 10983 | 20186 | 160 | — | — | — | BUYER |
| B | 10986 | 10984 | 20187 | 161 | — | — | — | BUYER |
| C/D | 10987 | 10985 | 20188 | 162 | 2918 | 4090 | 2918 | LEAD |
| E, historial preparado | 10988 | 10986 | 20189 | 163 | 2919 | 4091 | 2919 | PAYER tras preparación SQL |
| E, consulta nueva | 10988 | 10986 | 20190 | 164 | sin atribución | sin atribución | sin nueva entrada | PAYER |

Nombres exactos: prefijo más A/B/C/E; apellidos QA SINTETICO. Los datos quedan confirmados, sin limpieza automática ni global. No se reutilizaron los sujetos sintéticos de pruebas anteriores.

## Efectos reales en SQL y conservación comprobada

**Hubo escrituras DML reales**: registros de las rutas, evaluaciones, conversión, recepción y el UPDATE acotado del fixture E. No fue una ejecución de solo lectura. No hubo DDL, aplicación del parche estructural, cambios a procedimientos/Prisma, borrados ni repoblamiento. Los procedimientos y rutas confirman sus propias transacciones; no se usó rollback para ocultar sus efectos.

| Tabla | Antes | Después | Nuevas filas del prefijo |
| --- | --- | --- | --- |
| Personas | 10811 | 10815 | 4 |
| CaptacionesBuyer | 10811 | 10815 | 4 |
| Interacciones | 20004 | 20009 | 5 |
| DecisionesIA | 1 | 6 | 5 |
| Solicitudes | 2863 | 2865 | 2 |
| EventosEtapa | 4043 | 4045 | 2 |
| EntradasAgenteLead | 2 | 4 | 2 |
| PersonaPreferencias | 1 | 5 | 4 |

En estas ocho tablas, la diferencia de conteos coincide exactamente con las filas del prefijo. Se comparó además SHA-256 del JSON de todas las columnas, ordenado por PK y excluyendo el prefijo: **ocho huellas iguales**. Es evidencia de conservación de esas representaciones del contenido fuera del fixture, más fuerte que igualdad de conteos, con el límite de la serialización y la ventana observada. No es una comprobación integral de todo el contenido de todas las tablas de la base.

Conteos adicionales sin cambio: Opciones 310, Reservas 124, PropuestasEconomicasLead 0; objetos de usuario 256. En esas tres tablas solo se compararon conteos. Los módulos comprobados conservaron sus huellas. No se afirma una auditoría de escritura o contenido completa de los demás catálogos.

## Comandos, archivos y evidencias

Ejecutado desde la raíz, después de comprobar los procesos:

```powershell
node --check database/qa/buyer_backend/entorno_qa.cjs
node --check database/qa/buyer_backend/consultas_qa.cjs
node --check database/qa/buyer_backend/gemini_controlado.cjs
node --check database/qa/buyer_backend/pruebas_backend_real.test.cjs
$env:QA_BUYER_RUN_ID = '20261112T195045Z'
node --test --test-concurrency=1 database/qa/buyer_backend/pruebas_backend_real.test.cjs
```

Sintaxis: cuatro salidas 0. Pruebas: **6 tests contabilizados por Node (padre + cinco casos), 6 pass, 0 fail, 0 skipped, salida 0**, duración total 2853 ms. El panel de problemas no informó errores en los nuevos archivos QA. Se usó directamente el runner integrado de Node; no se atribuye este resultado a una ejecución de la herramienta TypeScript Runtime Validation, que no estaba invocable en esta sesión.

Para reproducir, seguir [README.md](../../database/qa/buyer_backend/README.md) y **generar otro identificador**; el arnés rechaza una carpeta con RESULTADOS.json existente o un prefijo ya presente. La reproducción añade fixtures nuevos y los conserva. No ejecutar el comando con el identificador entregado esperando reutilizar los sujetos.

Comprobación adicional con SQLCMD integrado, salida 0, únicamente lecturas:

```powershell
sqlcmd -S DANIELPC -d NexoSalud_LeadEnsayoFinal -E -b -r 1 -f 65001 -y 0 -w 65535 -i database\qa\buyer_backend\03_REVISAR_SINTETICOS_SOLO_LECTURA.sql -o database\qa\buyer_backend\ejecucion_20261112T195045Z\REVISION_SQL_SOLO_LECTURA.txt
```

No sobrescribir la evidencia entregada al reproducir: escoger otro archivo de salida. La consulta [03_REVISAR_SINTETICOS_SOLO_LECTURA.sql](../../database/qa/buyer_backend/03_REVISAR_SINTETICOS_SOLO_LECTURA.sql) está limitada al prefijo entregado, con guarda de servidor/base.

Evidencias nuevas en [ejecucion_20261112T195045Z](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/):

- [ENTORNO_ANTES.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/ENTORNO_ANTES.json) y [ENTORNO_DESPUES.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/ENTORNO_DESPUES.json): procesos, puertos, versión y estado Git.
- [ESTADO_ANTES.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/ESTADO_ANTES.json) y [RESULTADOS.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/RESULTADOS.json): destino efectivo, módulos, conteos/huellas, cinco casos completos, HTTP, llamadas simuladas y EXEC reales. El estado final está dentro de RESULTADOS.json.
- [CASO_A.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/CASO_A.json), [CASO_B.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/CASO_B.json), [CASO_C.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/CASO_C.json), [CASO_D.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/CASO_D.json) y [CASO_E.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/CASO_E.json): pruebas y filas sintéticas por caso.
- [EJECUCION_NODE_TEST.txt](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/EJECUCION_NODE_TEST.txt): salida original del runner.
- [REVISION_SQL_SOLO_LECTURA.txt](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/REVISION_SQL_SOLO_LECTURA.txt) y [REVISION_SQL_RESULTADO.json](../../database/qa/buyer_backend/ejecucion_20261112T195045Z/REVISION_SQL_RESULTADO.json): corroboración independiente SQLCMD.

Estado Git: **sin diferencias en archivos versionados**. Los archivos de este bloque son nuevos y sin versionar bajo la carpeta QA indicada y este informe. Los seis RESULTADOS_REVISION_BUYER previos, las carpetas QA anteriores y los otros dos informes sin versionar se preservaron. El ZIP de entrega queda ignorado por las reglas existentes y no altera el índice.

## Errores, límites y pendientes

No fallaron los cinco casos ni la comprobación posterior; no fue necesario cambiar implementación para obtener el resultado. No se presenta un fallo funcional reproducible porque no ocurrió en esta ventana y configuración.

La prueba valida el recorrido HTTP secuencial hasta SQL cuando el clasificador devuelve los JSON controlados. No valida Gemini real, su disponibilidad, cuota, latencia, red, clasificación de lenguaje natural ni calidad. Tampoco interfaz, concurrencia HTTP, autenticación integral del backend general, recuperación automática tras caída, reinicio de procesos, entrega durante caída ni rollback ante fallo. D valida retry explícito de una evaluación ya completada; no simula un crash. E no valida pagos.

Solo se recorrió un servicio activo y los datos sintéticos indicados. Otras validaciones negativas, otros canales/contratos, horarios, reservas posteriores y el resto de la suite quedan fuera de alcance. El siguiente bloque debe decidir expresamente cuáles probar, manteniendo separados estos resultados de cualquier validación de Gemini real.

## Paquete de revisión

Entrega: [pruebas_backend_buyer_qa_daniel_20261112.zip](../../pruebas_backend_buyer_qa_daniel_20261112.zip). Incluye únicamente los archivos nuevos de este bloque, el informe, scripts y evidencias con rutas relativas. El manifiesto SHA-256 y la lista de entradas están en [MANIFIESTO_ENTREGA.json](../../database/qa/buyer_backend/MANIFIESTO_ENTREGA.json). La verificación externa [VERIFICACION_ZIP.json](../../database/qa/buyer_backend/VERIFICACION_ZIP.json) registra apertura, lectura completa y comparación de cada entrada con su archivo de origen. No se incluyen secretos, archivos de entorno, dependencias, .git, dist ni respaldos.
