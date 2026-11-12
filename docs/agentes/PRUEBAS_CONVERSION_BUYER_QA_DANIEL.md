# Pruebas SQL de conversión y recepción Buyer — Daniel

Fecha: 12 de noviembre de 2026. **A, B, C y D aprobados en los procedimientos reales instalados.** El caso D acredita entrega SQL pospuesta; no acredita caída ni recuperación del proceso backend.

## Revisión, autorización y entorno

- Rama inspeccionada y conservada: `feature/buyer-orientacion-interactiva`.
- HEAD: `19613358530e899bfc68d5e6b3c33b6336ab9ce4`.
- Destino exclusivo confirmado por Prisma y SQLCMD: **DANIELPC / NexoSalud_LeadEnsayoFinal**.
- Prefijo exclusivo de esta ejecución: **`QA_BCV_20261112T193315Z_`**. Se verificó que inicialmente no existía ningún sujeto con ese prefijo.
- Se leyó el [informe de corrección P2022](REVISION_QA_BUYER_DANIEL.md). Las pruebas actuales no reinstalan el parche estructural.
- Los cambios locales anteriores, los seis reportes sin versionar y los ZIP previos se conservaron. No hubo pull, fetch, merge, cambio de rama, commit ni push. No se incorporaron cambios de Germain.
- No se modificaron procedimientos, vistas, restricciones, Prisma, rutas, servicios, tipos, componentes ni pruebas del agente. Los entregables de este bloque son nuevos archivos SQL, evidencias y este informe; figuran como `??` en Git.
- No se encontraron instrucciones AGENTS.md en la raíz ni en los subárboles aplicables comprobados.

No se encontraron procesos del proyecto ni listeners en 3001/5173. SQL Server Agent estaba detenido. La sesión SSMS observada estaba inactiva y sin transacción abierta; no se cerró. Las guardas de cada ejecución rechazan peticiones o transacciones ajenas activas en QA. No se arrancaron backend general, recuperadores, sincronización Mart ni Gemini; no se invocó HTTP de la aplicación.

Evidencias: [inspección instalada](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/00_INSPECCION_INSTALADA.json), [procesos antes](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/00_CONTROL_PROCESOS_ANTES.json) y [procesos después](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/10_CONTROL_PROCESOS_DESPUES.json). Son observaciones de esta ventana, no una garantía contra futuras escrituras manuales externas.

## Definiciones reales y dependencias

Se consultaron `sys.sql_modules`, `sys.parameters`, `sys.sql_expression_dependencies`, columnas, defaults, índices, FK, CHECK y triggers. El archivo de [inspección](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/00_INSPECCION_INSTALADA.json) conserva las definiciones completas efectivamente instaladas. No se asumió que el texto del repositorio equivaliera exactamente al de SQL Server.

| Objeto instalado | SHA-256 de la definición NVARCHAR |
| --- | --- |
| dbo.usp_ConvertirBuyerALead | `6A42F2ADD1BE9F827074A50A6DCB579C6341F71C35E8F0216E4E04A70DC634A5` |
| dbo.usp_RegistrarEntradaAgenteLead | `280708E81E3BE607A3772F082961EBE6E8371C1698414F3FDAC8B82D8A0C087E` |
| dbo.v_DatosCaptacionBuyer | `BAC8AB4A8AF43E8FB98BFABFE29FA8DC4F4D17F42CB5389EDEF23844EE85665D` |

Las guardas de los scripts exigen esas tres huellas, servidor/base exactos, VIEW DEFINITION, sesión sin transacción previa, catálogos existentes y restricciones habilitadas/confiables. Rechazan triggers adicionales activos en las cinco tablas afectadas; en la inspección no había ninguno. No se deshabilitó ninguna protección.

La conversión depende de CaptacionesBuyer, Personas, Etapas, Servicios, Solicitudes, EventosEtapa y la vista de captación. La vista usa además Campanas. El receptor une Solicitudes, EventosEtapa, CaptacionesBuyer y Etapas antes de insertar EntradasAgenteLead. Las FK entrantes y salientes, incluidos posibles consumidores comerciales, se inventariaron sin alterarlas.

Restricciones relevantes comprobadas:

- CaptacionesBuyer: PK de `id_captacion`, UQ de `id_persona`, FK a persona y catálogos, calidad admitida y origen `REGISTRO_DIRECTO`/`HISTORICO_OBSERVADO`.
- Personas: nombres/apellidos y etapa requeridos, FK a Etapas, calidad admitida y unicidad filtrada de DNI no nulo. Los fixtures dejan DNI y teléfono nulos; usan correo sintético `example.invalid`.
- Solicitudes: PK, FK a persona/servicio y estados permitidos; las reglas LEAD agregadas admiten los campos comerciales inicialmente nulos que genera el procedimiento.
- EventosEtapa: FK a persona, etapas, captación y solicitud; índice único filtrado de `clave_operacion_buyer`.
- EntradasAgenteLead: **PK de `id_solicitud`**, UQ de `id_evento_etapa`, FK a solicitud/evento/captación/persona y default UTC. No existe un ID independiente de entrada: se identifica por solicitud.

## Transacciones y datos mínimos determinados antes de ejecutar

### Conversión

Parámetros reales: `@id_captacion INT`, `@id_servicio INT`, `@motivo NVARCHAR(200)` y `@id_usuario INT = NULL`.

La captación debe existir, tener fecha no futura y corresponder a una persona en BUYER. Se exigen etapas BUYER/LEAD, nombre y apellido no vacíos, contacto por teléfono o correo, autorización tanto en captación como en persona, calidad `Valido`, motivo no vacío y servicio activo. La vista comprueba los mínimos del contacto; la autorización/calidad actual de la persona se vuelven a comprobar en el procedimiento.

Se seleccionó del catálogo el servicio activo **1, Evaluación odontológica**, sin modificarlo. Las etapas se resolvieron por nombre en cada script, no se fijaron sus IDs. Los fixtures proporcionan consentimiento explícito y fecha, correo reservado de pruebas, motivo con el prefijo y captación `REGISTRO_DIRECTO`; se omite usuario porque es opcional. No se requiere crear interacciones ni decisiones de Gemini.

El procedimiento activa XACT_ABORT y abre su propia transacción. En el camino correcto, un COMMIT anidado reduce `@@TRANCOUNT` pero no confirma una transacción externa. Esto permite A/B con BEGIN externo y ROLLBACK al final. En su CATCH, un ROLLBACK sin savepoint puede revertir toda la transacción del llamador: **no se provocó ese camino de fallo**.

La repetición busca un evento previo BUYER → LEAD desde la fecha de captación, acepta vínculo a esa captación o nulo y devuelve sus IDs con `ya_convertido=1` antes de exigir que la persona siga en BUYER. El evento nuevo usa la clave real de dos componentes **`BUYER_LEAD:<id_captacion>`**. Esta prueba no valida la identidad por interacción del agente ni la apropiación de conversiones históricas por mensajes nuevos.

### Recepción

Parámetro real: `@id_solicitud INT`. El receptor **rechaza una transacción externa o IMPLICIT_TRANSACTIONS con error 54702** antes de abrir su propia transacción. Esa prohibición se determinó leyendo la definición; no se ejecutó una prueba negativa 54702.

Trabaja en READ COMMITTED, usa UPDLOCK/HOLDLOCK al consultar la clave de solicitud y verifica las relaciones de persona/captación/evento, etapas BUYER → LEAD y clave de operación. Si falta la conversión vinculada, su código prevé 54703; tampoco se probó ese caso negativo. Cada llamada correcta confirma su propia transacción y deja `@@TRANCOUNT=0`.

Por tanto, C y D requieren datos sintéticos confirmados. Se conservan sus filas en QA: no se implementó limpieza global ni borrado de registros históricos. Los bloqueos presentes en el código no se presentan como una prueba de concurrencia.

## Scripts, orden ejecutado y reproducibilidad

Todos los archivos se ejecutaron completos, sin GO, mediante SQLCMD con `-E -C -I -b`, conectando explícitamente a DANIELPC y NexoSalud_LeadEnsayoFinal. Cada invocación abrió una sesión nueva. Antes de escribir se verificó sintaxis con PARSEONLY; salida 0 para los cinco scripts.

| Orden | Script | Evidencia principal |
| --- | --- | --- |
| 1 | [Captura de solo lectura](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/01_CAPTURA_SOLO_LECTURA.sql) | [Estado anterior](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/01_ESTADO_ANTES.txt) |
| 2 | [A/B con rollback](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/02_CASOS_AB_ROLLBACK.sql) | [Salida A/B](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/02_RESULTADO_AB.txt) y [validación](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/02_VALIDACION_AB.json) |
| 3 | Misma captura de solo lectura, nueva sesión | [Estado tras rollback A/B](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/03_ESTADO_TRAS_AB.txt) |
| 4 | [C recepción repetida](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/03_CASO_C_RECEPCION_REPETIDA.sql) | [Salida C](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/04_RESULTADO_C.txt) |
| 5 | [D1 conversión sin aviso](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/04_CASO_D1_CONVERSION_SIN_AVISO.sql) | [Salida D1](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/05_RESULTADO_D1.txt) |
| 6 | Captura en sesión distinta, sin invocar receptor | [Conversión D confirmada y sin entrada](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/06_ESTADO_D1_CONFIRMADO_SIN_AVISO.txt) |
| 7 | [D2 recepción posterior](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/05_CASO_D2_RECEPCION_POSTERIOR.sql), nueva invocación SQLCMD | [Salida D2](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/07_RESULTADO_D2.txt) |
| 8 | Captura de solo lectura | [Estado final](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/08_ESTADO_FINAL.txt) y [resultados comparados](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/09_RESULTADOS_COMPARADOS.json) |

**No repetir los scripts de creación C/D con este prefijo.** Sus guardas rechazan sujetos ya existentes; D2 rechaza una entrega que ya tenga entrada. Para otro ensayo se necesita un prefijo nuevo y revisar los scripts. La captura de solo lectura sí se puede repetir sobre el destino autorizado.

Los procedimientos se invocaron con EXEC directo, sin envolverlos en INSERT EXEC, para no interferir con sus posibles ROLLBACK ni ocultar errores de transacción. Sus resultados originales quedaron en las salidas. Después se compararon explícitamente las respuestas de ambas conversiones A/B y de ambas recepciones C, además de las aserciones internas de cada script.

## Resultados esperados y obtenidos

| Caso | Esperado | Obtenido | Límite |
| --- | --- | --- | --- |
| A. Conversión válida | Una solicitud y un evento ligados a persona/captación; etapa LEAD; servicio/motivo/clave correctos | **Aprobado**, salida 0. Solicitud 2915, evento 4087, `ya_convertido=0`, `@@TRANCOUNT=1` dentro de la transacción externa | Operación SQL correcta en un sujeto nuevo y aislado; no clasificación ni formulario |
| B. Misma conversión repetida | Mismos IDs, una sola solicitud/evento/captación y sin opciones, reservas, propuestas o entradas adicionales | **Aprobado**, salida 0. Solicitud 2915 y evento 4087 repetidos, `ya_convertido=1`. A/B completo revertido al final; `@@TRANCOUNT=0` | Repetición secuencial de la misma captación/motivo; no concurrencia ni interacción nueva |
| C. Recepción repetida | Una entrada por solicitud, misma identidad y contenido tras dos llamadas | **Aprobado**, salida 0. Ambas respuestas: `2916 / 4088 / 10981 / 10983`; una sola entrada, misma huella incluyendo fecha UTC; una solicitud y un evento | Recepción SQL secuencial, fuera de transacción externa; no avisos HTTP concurrentes |
| D. Conversión confirmada y recepción pospuesta | Conversión durable con cero entradas; posterior receptor crea una entrada usando la misma solicitud/evento | **Aprobado**, salida 0. D1 confirmó 2917/4089 con 0 entradas; captura independiente lo confirmó. D2 registró una entrada para esos mismos IDs | Recuperación de entrega **a nivel SQL**; no caída real, reinicio ni recuperación automática |

No falló ninguna aserción ni llamada a procedimiento de A–D. Todas las ejecuciones funcionales y capturas terminaron con salida 0. No se editaron procedimientos o código para obtener esos resultados.

## IDs sintéticos y estado conservado

| Caso | Nombre exclusivo | Persona | Captación | Solicitud | Evento | Entrada / estado final |
| --- | --- | --- | --- | --- | --- | --- |
| A/B | `QA_BCV_20261112T193315Z_AB` | 10982 | 10980 | 2915 | 4087 | **Revertido**: no persisten estas cuatro filas ni entrada |
| C | `QA_BCV_20261112T193315Z_C` | 10983 | 10981 | 2916 | 4088 | Conservado en LEAD; una entrada por solicitud 2916 |
| D | `QA_BCV_20261112T193315Z_D` | 10984 | 10982 | 2917 | 4089 | Conservado en LEAD; una entrada por solicitud 2917 |

Los correos son el nombre sintético seguido de `@example.invalid`; apellidos `QA SINTETICO`, sin DNI ni teléfono. El motivo comercial también contiene el prefijo. Ninguna persona del poblamiento se usó como sujeto.

Claves conservadas: C `BUYER_LEAD:10981`, D `BUYER_LEAD:10982`. Primera recepción C: **2026-11-12 19:38:41.9503710 UTC**. D1 sin aviso: **19:38:56.6997204 UTC**; recepción D: **19:39:06.8630428 UTC**. La captura final es **19:39:06.9486407 UTC**.

Los IDs de A/B se consumieron aunque el fixture se revirtiera: SQL Server no revierte normalmente los contadores IDENTITY. No se reseedearon ni reutilizaron. El rollback de un caso correcto no equivale a probar rollback ante un fallo interno del procedimiento.

## Efectos sobre los datos y preservación del contexto

| Tabla | Antes | Después | Explicación |
| --- | --- | --- | --- |
| Personas | 10809 | 10811 | +2, solo C y D |
| CaptacionesBuyer | 10809 | 10811 | +2, solo C y D |
| Solicitudes | 2861 | 2863 | +2, solo C y D |
| EventosEtapa | 4041 | 4043 | +2, solo C y D |
| EntradasAgenteLead | 0 | 2 | Una por C y D |

Opciones **310**, Reservas **124**, PropuestasEconomicasLead **0**, Interacciones **20004** y DecisionesIA **1** conservaron sus conteos. El catálogo mantuvo **256 objetos** y las tres huellas de definición permanecieron iguales.

La captura calcula SHA-256 del JSON de todas las filas fuera del prefijo, ordenadas por PK e incluyendo nulos. Las cuatro tablas con filas previas conservaron sus huellas. EntradasAgenteLead fuera del prefijo permaneció vacío; su huella se reporta NULL en ambas capturas. Tras A/B, también coincidieron todos los conteos y huellas anteriores. Estas comprobaciones no son una auditoría integral ni una comparación binaria de páginas; los conteos por sí solos tampoco prueban igualdad de valores. No se exportaron datos de personas históricas: solo sus conteos y huellas.

## Incidentes, pendientes y límites

Se registró un incidente de herramienta **antes de cualquier escritura de prueba**: SQLCMD rechazó inicialmente la ruta absoluta con barras `C:/...` con el mensaje de opciones `-E` y `-U/-P` excluyentes. Se comprobó que SQLCMDUSER y SQLCMDPASSWORD no estaban definidas. Al usar ruta nativa Windows entre comillas para `-i`, la verificación PARSEONLY terminó correctamente. No se cambió autenticación, destino ni protección SQL. Se conservan [incidente](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/00_INCIDENTE_SQLCMD.json), [resolución](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/00_INCIDENTE_SQLCMD_RESUELTO.json) y [salida PARSEONLY](../../database/qa/buyer_conversion/ejecucion_20261112T193315Z/00_PARSEONLY.txt). No se clasifica como un fallo de los procedimientos.

Quedan fuera de estas conclusiones:

- Concurrencia HTTP, concurrencia entre sesiones SQL y reintentos simultáneos.
- Caída real, reinicio, estado pendiente del agente y recuperación automática del proceso.
- Clasificación Gemini y cualquier recorrido de interfaz.
- Mensajes nuevos de personas históricas o en fases posteriores; no se probó su identidad por interacción.
- Casos negativos 51001–51008, 54702/54703, fallos internos y su camino de rollback.
- Negociación, reserva, procedimientos de otras fases o instalación completa LEAD.

**Conclusión acotada:** conversión real de un sujeto sintético, repetición de esa conversión, recepción secuencial idempotente y entrega SQL pospuesta funcionan en el destino inspeccionado. Se conservaron únicamente los dos sujetos sintéticos confirmados documentados. No se realizó limpieza global ni se modificó la implementación de Germain.
