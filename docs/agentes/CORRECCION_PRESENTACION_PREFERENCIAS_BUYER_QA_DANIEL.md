# Preferencias Buyer y diagnóstico horario acotado

Versión inspeccionada: `de14f0d6d921c778d90aedb28948f8f5a9403935`, rama `feature/buyer-orientacion-interactiva`. Corrección local, sin commit ni push. Destino confirmado por consulta: **DANIELPC / NexoSalud_LeadEnsayoFinal**. Sin backend general, Mart, dunning, recuperadores ni llamadas Gemini.

## Contraste de los cuatro sujetos

SQL y `GET /api/buyer/:id` reales, antes y después: [evidencia anterior](../../database/qa/buyer_presentacion/evidencias/antes.json) y [posterior](../../database/qa/buyer_presentacion/evidencias/despues.json).

| Persona | Etapa SQL actual | Preferencia vigente | Sede / horario SQL | API | Ficha y perfilamiento corregidos |
| --- | --- | --- | --- | --- | --- |
| 11000 | BUYER | 23 | NULL / NULL | cadena vacía / cadena vacía | No informado / No informado |
| 11001 | LEAD | 24 | NULL / NULL | cadena vacía / cadena vacía | No informado / No informado |
| 11002 | LEAD | 25 | NULL / NULL | cadena vacía / cadena vacía | No informado / No informado |
| 11007 | PAYER | 30 | NULL / NULL | cadena vacía / cadena vacía | No informado / No informado |

Las cuatro preferencias tienen `fecha_fin` NULL; las captaciones también carecen de `id_sede`. Antes, el código de la ficha sustituía ausencias por “Sede California” y “Mañana / Tarde (Flexible)”; perfilamiento decía “No especificada/No especificado”. La edición inicializaba sede California y horario 1. El contraste anterior de presentación se obtuvo del código; los valores corregidos se comprobaron renderizando el componente real en DOM con las respuestas GET reales conservadas, sin invocar el evaluador.

## Corrección

- [Ficha](../../frontend/src/modules/buyer/components/BuyerDetailView.tsx) y perfilamiento usan [la misma resolución](../../frontend/src/modules/buyer/lib/buyerPresentation.ts). Mantienen la selección de preferencia vigente del backend (ID descendente y `fecha_fin`), sin rescatar preferencias vencidas ni completar ausencias con IA. Se indica que sede/horario provienen del registro, no de inferencias Gemini.
- La edición empieza vacía cuando falta preferencia y conserva valores guardados aunque el catálogo no los incluya o tarde en cargar. No guarda nada por abrir la ficha o editar.
- [GET de listado/ficha](../../backend/src/routes/buyer.routes.ts) agrega `pref_horario` con las horas del registro `Horarios` asociado y `currentStage`, sin modificar Prisma ni SQL. Se eliminan rótulos horarios fijos por ID: en SQL el ID 1 es **08:00–12:00**, el 2 **14:00–18:00** y el 3 **08:00–12:00**, diferentes de los antiguos turnos fijos de la ficha. La prueba de preferencias informadas usa un objeto de presentación controlado; **no se inventó una preferencia SQL para estos cuatro sujetos**.
- [Distintivo de listado/ficha](../../frontend/src/modules/buyer/components/BuyerListView.tsx): 11007 muestra **Etapa actual: PAYER**. Su evento **4101 BUYER→LEAD** se presenta como **Conversión histórica a LEAD**, separado de su nueva evaluación `SOLO_CONSULTA`. El texto de preparación aclara que esa consulta conserva PAYER; ya no dice que deba permanecer en BUYER. El estado comercial interno `CONVERTED` se conserva; ya no se presenta como etapa actual LEAD. `convertedAt` solo se obtiene de ese tipo de transición, sin inventarlo a partir de actualización/registro/autorización. Los distintivos de calidad (p. ej. Duplicado) se conservan.

## B3: diagnóstico, sin corrección temporal

El [cálculo B3](../../backend/src/services/buyerIndicators.ts) permanece sin cambios: `Personas.fecha_registro` → primer `EventosEtapa.fecha_hora` BUYER→LEAD. Si un intervalo es negativo o falta evidencia, devuelve **No disponible**; se añadió una regresión explícita para el intervalo negativo, sin desplazar fechas ni excluirlo del divisor.

Fuentes contrastadas con el esquema físico y el procedimiento instalado:

- Registro: el alta pública usa `personas.create` sin `fecha_registro` explícita; [schema.prisma](../../backend/prisma/schema.prisma) declara `@default(now())`. El default físico es `SYSDATETIME()`. En estos sujetos, el valor almacenado coincide con la hora UTC de ejecución QA, no con la hora local del servidor.
- Captación: el router inserta `SYSDATETIME()` explícitamente; la columna no tiene default físico. No es la fecha inicial de B3.
- Conversión: `dbo.usp_ConvertirBuyerALead` instalado usa `@fecha DATETIME2=SYSDATETIME()`; huella conservada `6A42F2ADD1BE9F827074A50A6DCB579C634A5`. El default físico de `EventosEtapa.fecha_hora` también es `SYSDATETIME()`. La [definición original](../../database/lead_revision/01_BUYER_OLTP.sql) coincide en ese reloj.
- Los tres campos son `datetime2`, sin zona. Comparar `CONVERT(varchar,fecha,126)` con la lectura Prisma demuestra que los mismos números terminan serializados con `Z`; esa marca no demuestra que todos los valores originales se generaran en UTC.

Muestra real SQL sin zona:

| Persona | Registro | Evento BUYER→LEAD | Diferencia SQL en segundos |
| --- | --- | --- | --- |
| 11001 | 2026-11-12 22:37:39.088 | 2026-11-12 17:37:43.6092365 | -17996 |
| 11002 | 2026-11-12 22:37:40.480 | 2026-11-12 17:37:41.4672126 | -17999 |
| 11007 | 2026-11-12 22:47:44.970 | 2026-11-12 17:47:45.0493630 | -17999 |

En la lectura diagnóstica, SQL `SYSDATETIME()` dio **18:13:05** y `SYSUTCDATETIME()` **23:13:05**. Node informó `America/Bogota`, offset **300 minutos**, hora local 18:13 y `toISOString()` 23:13Z. Hay evidencia de dos convenciones mezcladas en estos casos. Falta trazar el INSERT generado por Prisma en una prueba temporal específica para atribuir concluyentemente el origen del valor de registro y acordar una convención común. Esto **no demuestra el origen de cada fecha histórica** ni autoriza reparación masiva. Tampoco normaliza la fecha mostrada del historial: su interpretación local/UTC queda pendiente junto con B3. No se sumaron cinco horas, actualizaron fechas ni excluyeron intervalos negativos.

## Validación y límites

- Cuatro GET anteriores y cuatro posteriores: **HTTP 200**, SQL real. Comparación de huellas/conteos de ocho tablas para esos cuatro sujetos: iguales antes/después y entre ejecuciones. Solo SELECT; sin DML, DDL ni ejecución de procedimientos.
- [Pruebas afectadas](../../database/qa/buyer_presentacion/evidencias/pruebas_afectadas.txt): **13 aprobadas** en dos archivos: [presentación de ficha](../../frontend/src/modules/buyer/components/BuyerDetailView.test.tsx) y [cálculo B3](../../backend/tests/buyerIndicators.test.ts). Incluyen ausencias, preferencias informadas, edición sin valores predeterminados, PAYER/historial y conservación de distintivos de calidad. Tras ajustar el texto de preparación para PAYER, se repitieron solo las [7 de presentación](../../database/qa/buyer_presentacion/evidencias/presentacion_final.txt): aprobadas.
- Compilaciones [backend](../../database/qa/buyer_presentacion/evidencias/build_backend.txt) y [frontend final](../../database/qa/buyer_presentacion/evidencias/build_frontend_final.txt): **salida 0**. No se repitieron arneses comerciales completos ni pruebas con escritura.
- **Pendiente revisión manual en navegador** de las cuatro fichas y sus modos de edición. No se declara aceptación visual, Gemini real ni recuperación tras caída.

Reproducción: desde `frontend`, `npm test -- frontend/src/modules/buyer/components/BuyerDetailView.test.tsx backend/tests/buyerIndicators.test.ts`; desde cada paquete, `npm run build`. El [script de lectura SQL/HTTP](../../database/qa/buyer_presentacion/comprobar_presentacion.cjs) se ejecutó desde la raíz con argumentos `antes` y `despues`, en procesos aislados; conserva evidencias y rechaza sobrescribirlas. Para otra ejecución, conservar los archivos y usar una ruta nueva de evidencia. Las seis revisiones antiguas sin versionar se conservaron.
