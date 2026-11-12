# Estabilización Buyer — 12 noviembre 2026

Base: `70a09e3e32059d183ced2b96503d7ed298362900`, rama conservada `feature/buyer-orientacion-interactiva`. **Versión para revisión; aceptación visual pendiente.** Se aceptan las actividades de [Germain](./PRUEBAS_3_ACTIVIDADES_AGENTE_BUYER.md); no se rediseñaron conforme al documento anterior. Destino efectivo comprobado: **DANIELPC / NexoSalud_LeadEnsayoFinal**. Mart/dunning desactivados en los procesos QA; sin index.ts ni recuperadores generales.

## Resultado y correcciones

- Backend A/B/C/D/E volvió a pasar antes y después. La carrera de registro volvió a fallar en la base integrada antes de corregirla; se conserva esa evidencia.
- [buyer.routes.ts](../../backend/src/routes/buyer.routes.ts): reserva por SHA de Idempotency-Key mediante `sys.sp_getapplock`, exclusiva y propiedad de la transacción SQL, con comprobación repetida antes de insertar. Se libera al commit **antes de Gemini**. Sin DDL, migración o cambio de procedimientos/Prisma. Si no obtiene la reserva en 4 s, responde 503 para reintentar con la misma clave.
- Con la corrección, dos registros simultáneos idénticos conservan una interacción/decisión y una conversión. Solapamiento final: **56,700 ms**. El replay responde antes de terminar el clasificador; replay y conflicto posterior no alteran filas ni reclasifican.
- Otra pareja simultánea, misma clave y cuerpos diferentes, respondió **201/409**: ambas lecturas iniciales vieron ausencia, la segunda comprobación transaccional encontró la decisión ya reservada, y solo un mensaje, decisión, solicitud, evento y entrada quedaron guardados. Una sola clasificación simulada. No se limpiaron duplicados de las pruebas históricas.
- [buyerIndicators.ts](../../backend/src/services/buyerIndicators.ts) y el listado usan **primer evento BUYER→LEAD**, nunca Personas.fecha_actualizacion. B1 conserva conversión dentro de 14 días desde captación; B3 conserva **tiempo**, no costo, desde registro hasta evento. Se corrigió la correspondencia entre suma y divisor; faltantes/intervalos negativos producen No disponible, no un promedio parcial.
- B2 exige nombres/contacto informados, consentimiento y calidad Valido, excluyendo duplicados detectados. Describe datos registrados, no identidad/contacto verificados. B1 usa cohorte de captación; B2/B3 cohorte de registro. Búsqueda/canal/estado se comparten con el listado; la fecha se aplica a cada cohorte y se explica en la respuesta.
- [BuyerListView.tsx](../../frontend/src/modules/buyer/components/BuyerListView.tsx) muestra **No disponible con explicación** y período; [buyer.service.ts](../../frontend/src/modules/buyer/services/buyer.service.ts) incorpora la explicación/fuente al tipo. No se cambiaron las actividades ni el panel conversacional.

## Indicadores contrastados con SQL independiente

[Consulta equivalente](../../database/qa/buyer_estabilizacion/contrastar_indicadores.sql) y [runner HTTP/SQL](../../database/qa/buyer_estabilizacion/contrastar_indicadores.cjs). Pasaron ocho contrastes: histórico, fecha, búsqueda sintética, convertidos, nuevos, canal, vacío y página 2. Comparación numérica con tolerancia 0,0001 por representación decimal; numeradores y denominadores coinciden. Se comprobó que la normalización telefónica SQL cubre todos los caracteres existentes en esta QA.

Valores históricos **al cierre, incluyendo los fixtures de este bloque**, nuevamente contrastados después de las escrituras finales:

| Indicador | Valor | Fuente / condición |
| --- | --- | --- |
| B1 | **2876 / 9210 = 31,226927 %** | CaptacionesBuyer.fecha_captacion → primer EventosEtapa.fecha_hora con origen BUYER y destino LEAD; 14 días exactos, utilizabilidad actual. |
| B2 | **9210 / 10836 = 84,994463 %** | Personas, nombres/contacto/consentimiento/calidad y duplicados detectados; cohorte de fecha_registro. |
| B3 | **No disponible** | 2876 convertidos, **13 intervalos negativos**, todos con diferencia de −300 minutos por DATEDIFF. No se ajustaron ni excluyeron silenciosamente para fabricar un promedio. |

En el canal ensayado sin intervalos inválidos, B3 fue **5,72654454 días**, confirmado por SQL. La diferencia UTC/local es una causa probable de los intervalos negativos: los registros creados desde JS y los eventos SQL muestran cinco horas de desfase. Normalizar esa convención horaria y evaluar datos previos queda pendiente; no se reescribieron fechas históricas. Los límites de día/zona horaria necesitan una comprobación específica antes de certificar todos los filtros temporales.

Evidencias: [ocho contrastes](../../database/qa/buyer_backend/ejecucion_20261112T224600Z_cafe/INDICADORES_RESULTADOS.json), [cierre](../../database/qa/buyer_backend/ejecucion_20261112T224900Z_cafe/INDICADORES_RESULTADOS.json) y [intervalos negativos](../../database/qa/buyer_estabilizacion/ejecucion_20261112T223227Z/INTERVALOS_INVALIDOS_LECTURA.txt).

## Gemini real: cuatro llamadas, cuatro recorridos aprobados por HTTP y SQL

| Caso | Persona | Interacción / decisión | Resultado |
| --- | --- | --- | --- |
| Informativa | 11000 | 20205 / 179 | HTTP 200, SOLO_CONSULTA, BUYER, sin solicitud. |
| Saludo | 11001 | 20206 / 180 | HTTP 200, AMBIGUA/ACLARACION; pregunta coherente sobre solicitar cita o pedir información. La pregunta la elabora el backend. |
| Solicitud explícita | 11002 | 20207 / 181 | HTTP 201, LEAD; solicitud **2925**, evento **4097**, entrada 2925, CONFIRMADA. |
| Continuación del saludo | 11001 | 20208 / 182 | HTTP 201; contexto de 20206/180 persistido, solicitud **2926**, evento **4098**, entrada 2926, CONFIRMADA. |

No hubo respuestas prefijadas en estos cuatro casos: SDK, clasificación, rutas y SQL reales. Se conserva [evidencia de llamadas/resultados/contexto](../../database/qa/buyer_backend/ejecucion_20261112T223700Z_a11e/GEMINI_REAL_RESULTADOS.json). No prueba calidad general del modelo ni aceptación visual. No se prometió precio o cupo.

## Pruebas finales y reproducción

Backend/frontend compilan con salida 0. **49 pruebas unitarias afectadas aprobadas**: indicadores, journey y evaluador. Backend A–E real con clasificador controlado: aprobado. Fallos/retry/concurrencia real con clasificador controlado: aprobado, ahora también replay y conflicto sin escrituras. Conflicto concurrente con cuerpo distinto: aprobado. No se repitió la suite completa.

[Resumen de salidas](../../database/qa/buyer_estabilizacion/ejecucion_20261112T223227Z/) y [IDs de todos los sujetos](../../database/qa/buyer_estabilizacion/ejecucion_20261112T223227Z/INVENTARIO_SINTETICOS.json): **18 personas nuevas, 10992–11009**, con prefijos exclusivos, conservadas. Los tests finales usan 11004–11007 para backend y 11008–11009 para fallos; el doble envío final conserva interacción **20216**, decisión **190**, solicitud **2930**, evento **4102** y entrada 2930. El conflicto concurrente usa persona 11003. Las huellas de las ocho tablas comparadas fuera de cada prefijo se conservaron; no es una auditoría de todo el contenido de la base.

Desde la raíz, los arneses existentes siguen ejecutándose con `node --test --test-concurrency=1` y los archivos [backend](../../database/qa/buyer_backend/pruebas_backend_real.test.cjs) y [fallos](../../database/qa/buyer_fallos_concurrencia/pruebas_fallos_concurrencia.test.cjs). Usar QA_BUYER_RUN_ID / QA_BUYER_FAILURE_RUN_ID **nuevos**. Los scripts nuevos son [Gemini real acotado](../../database/qa/buyer_estabilizacion/gemini_real_acotado.cjs), [conflicto concurrente](../../database/qa/buyer_estabilizacion/conflicto_concurrente.cjs) y contraste indicado arriba. **No repetir el script real sin intención de consumir nuevas llamadas y crear fixtures.**

Se preservaron dos incidentes del contraste de lectura: SQL 8124 en la primera normalización telefónica y un plan posterior esperando RESOURCE_SEMAPHORE. Se detuvo solo su proceso QA de lectura y se simplificó la consulta; los contrastes finales pasaron. Un SELECT inicial también corrigió el nombre de las columnas de etapa a etapa_origen/etapa_destino. Ninguno ejecutó DML ni justificó cambiar datos para pasar.

## Comprobación manual y pendientes

Abrir las fichas 11000, 11001 y 11002: verificar las tres actividades aceptadas, el mensaje/turno vigente, la aclaración y su continuación, las referencias y entrega real; después comprobar PAYER 11007 sin atribuir la conversión histórica a su nueva consulta. Revisar listado con B1 31,2 %, B2 85,0 % y B3 No disponible, explicación y filtros. Los valores cambiarán si se agregan registros.

**Aceptación visual pendiente: no se realizó recorrido visual. B3 no disponible por 13 intervalos negativos.** Pendientes: acordar y comprobar la convención horaria, los intervalos inválidos y los bordes de día; recuperación automática tras caída y despliegue entre varias instancias no ensayados. No se arrancó backend general, Mart, dunning o recuperadores. Se publica esta versión en nuestra rama para revisión, conservando el merge base y el trabajo anterior. No se aplicaron migraciones ni cambios de estructura; sí escrituras sintéticas autorizadas y procedimientos reales. Para esta publicación no se repitieron pruebas ni llamadas externas.
