# Pendientes de Buyer en las dos bases y el ETL

Responsable propuesto: **Germain**, con revisión de Daniel. [Guía principal](../README.md) · [Cómo ejecutar](EJECUCION_SQL_SERVER.md) · [Cambios realizados](../CAMBIOS_REALIZADOS.md).

Este trabajo termina la parte de **BD**. No requiere implementar el agente para verificar sus reglas.

## 1. Leer la implementación vigente

- [OLTP](../semana9/init_oltp.sql): buscar `CaptacionesBuyer`, `v_DatosCaptacionBuyer` y `usp_ConvertirBuyerALead`.
- [Mart](../semana9/init_mart.sql): buscar `fact_captacion_buyer`.
- [ETL](../semana9/poblamiento_merge_mart.sql): estudiar el bloque 1. Preparación de datos → resolución de dimensiones → cálculo individual → `DELETE + INSERT` dentro de transacción.
- [Indicadores y reporte](../semana9/03_indicadores_y_reporte_buyer.sql): comparar con Buyer en «Informe IN final».

### Contrato de datos actual

| Objeto | Función real |
|---|---|
| `Personas` | Identidad. Una nueva consulta no crea por sí sola otra persona. |
| `CaptacionesBuyer` | Una primera captación por persona; `id_persona` es único. Guarda fecha, canal, fuente/campaña, sede, servicio, motivo, calidad, autorización y procedencia. |
| `EventosEtapa` | Historial de transiciones. La extensión agrega `id_captacion`, `id_solicitud` y `clave_operacion_buyer`. |
| `Solicitudes` | Requerimiento LEAD creado al convertir, no evidencia automática de la primera conversión. |
| `Interacciones` | Comunicaciones vinculadas a persona. Actualmente no tiene una columna `id_captacion` nueva: no insertarla como si existiera. |
| `GastosCampana` | Gastos por campaña y fecha. Es la fuente monetaria, no una constante en el ETL. |
| `DecisionesIA` | Bitácora existente, ampliada con referencias opcionales a captación e interacción para el futuro. |
| `fact_captacion_buyer` | Una fila por persona/captación; cinco medidas originales, dimensiones y fechas/evidencia. |

El ETL selecciona el primer evento verificable BUYER → LEAD desde la captación, resolviendo las etapas por nombre. Admite eventos históricos sin `id_captacion`, vinculados por persona: es una compatibilidad histórica, no una razón para omitir el vínculo en nuevos registros.

## 2. Registrar el punto de partida

1. Ejecutar [02_validacion.sql](../semana9/02_validacion.sql).
2. Conservar resultados y fecha de corte. La evidencia ya aportada muestra 805 / 680 / 310 en Buyer, todos `HISTORICO_OBSERVADO`.
3. Anotar que los 805 tienen sede y servicio desconocidos, que hay cero interacciones y cero gastos. No marcar esas funcionalidades como probadas.
4. Crear los casos nuevos en una copia local de pruebas. Identificarlos con un prefijo único en correos, motivos o descripciones; utilizar datos ficticios. No borrar ni retocar el baseline para producir los resultados esperados.
5. Si agregas scripts para pruebas, separarlos de `01_catalogos.sql`, indicar que son sintéticos, evitar duplicarlos al reejecutar y documentar su efecto esperado sobre los conteos.

## 3. Cerrar la regla de calidad y su temporalidad

Hay una decisión funcional pendiente: la descripción inicial del informe acepta al menos un medio de contacto, pero la tabla del perfil menciona teléfono, servicio y motivo obligatorios.

La regla **implementada** en la vista requiere calidad `Valido`, autorización en la captación, nombres y apellidos no vacíos y teléfono **o** correo no vacío. La conversión también exige servicio activo y motivo no vacío. No verifica por sí sola formato válido del teléfono/correo ni clasifica semánticamente el motivo.

Acciones:

1. Confirmar con Daniel la definición que prevalece en la pestaña principal. Distinguir contacto utilizable de contacto calificado para convertir.
2. Proponer una regla única para BD, ETL y futuro backend; no cambiarla solo en una consulta.
3. Revisar la temporalidad: la vista combina calidad/autorización guardadas en `CaptacionesBuyer` con nombres/medios **actuales** de `Personas`. No es un snapshot completo de toda la calidad inicial.
4. Decidir si B2 evalúa calidad al captar o calidad actual. Si es inicial, guardar evidencia mínima de validación al captar y evitar que cambios posteriores alteren silenciosamente la cohorte. Si es actual, documentar y sincronizar explícitamente la rectificación, preservando historial.
5. Definir cómo se registra una autorización posterior o su revocación. No resolverlo con `UPDATE` masivos ni valores `true` por defecto. El procedimiento actual bloquea convertir si la persona revocó autorización, aunque la captura inicial la conserve.

La evidencia temporal/validación es un atributo del origen. No exige crear otro indicador ni otra medida comercial.

## 4. Probar sede y servicio declarados

1. Consultar catálogos `Sedes`, `Servicios`, `Canales`, `Fuentes` y `Campanas`; resolver identificadores por registros verificables, no asumir que sede 1 o servicio 1 significan lo deseado.
2. Preparar contactos nuevos con sede y servicio explícitos, incluyendo distintas combinaciones de fuente/canal/sede para comprobar la matriz.
3. Insertar persona y su captación en la misma transacción, con `origen_datos='REGISTRO_DIRECTO'`, fecha real del caso y los IDs declarados. La captación debe existir antes del siguiente ETL; de lo contrario este la incorporará como `HISTORICO_OBSERVADO` sin sede/servicio.
4. Mantener un caso sin sede/servicio para probar los miembros desconocidos. No reemplazar ausencias por una sede real.
5. Verificar que la fuente corresponde a la campaña. El ETL ya rechaza pares incoherentes; evaluar reforzarlo al escribir mediante una operación de registro o restricciones compatibles con el modelo.
6. Ejecutar el bloque 1 del ETL y la consulta matricial de [03_indicadores_y_reporte_buyer.sql](../semana9/03_indicadores_y_reporte_buyer.sql).
7. Comprobar que cada caso aparece en su combinación y que los subtotales suman el total. Las 805 captaciones antiguas pueden seguir en «No especificada» si no hay evidencia original.

**Aceptación:** los registros nuevos no caen todos en clave 0; los desconocidos no se pierden; no se duplica una persona por solicitudes recurrentes; el reporte conserva su formato.

## 5. Cargar y verificar gastos

Crear un script de datos monetarios de prueba **separado**, o cargar evidencia real cuando exista. Campos actuales de `GastosCampana`: `id_campana`, `fecha`, `importe` y `descripcion`.

Preparar al menos:

- Una campaña con varios contactos y un importe que genere céntimos residuales.
- Una campaña con gasto y ningún contacto.
- Una campaña con contactos pero sin evidencia de gasto.
- Un gasto explícito de cero, identificado como tal, para distinguirlo de falta de información.
- Campañas o meses diferentes para comprobar que no se mezclan cohortes.

Pasos:

1. Alinear fechas de gasto y captación por campaña/mes, que es la regla de reparto vigente.
2. Ejecutar el bloque 1 del ETL y la conciliación de costos de `02_validacion.sql`.
3. Comprobar por campaña/mes: **gasto original = atribuido + pendiente de atribución**. Verificar al céntimo, no por aproximación.
4. Confirmar que campaña sin contactos mantiene gasto no atribuido y no se reparte a contactos de otra campaña.
5. Confirmar que ausencia de gasto produce `NULL`, mientras un gasto explícito cero produce cero.
6. Calcular B3 para la cohorte probada. Si el baseline sigue sin gastos, el B3 global puede continuar `NULL`; filtrar la cohorte sintética con sus claves/fechas en una consulta de prueba separada. No alterar la consulta oficial para ocultar registros sin evidencia.
7. Si se desea completar B3 global en el entorno sintético, identificar expresamente los gastos simulados añadidos a las campañas originales. No presentarlos como historia real de la clínica.

B3 es costo **atribuido a la cohorte** por LEAD de esa cohorte. Cuando hay gasto sin contactos no equivale automáticamente al gasto total del negocio dividido entre todos los LEADs. `Fact_GastoCampana` sigue siendo opcional si se necesita analizar ese segundo problema con dimensiones y grano propios.

## 6. Probar interacciones

1. Registrar comunicaciones sintéticas asociadas a las personas de prueba, usando campos existentes como `id_persona`, `id_canal`, `id_fuente`, `tipo`, `mensaje` y `fecha_hora`.
2. Comprobar persona y catálogos asociados, orden temporal y conservación del historial.
3. Registrar varias interacciones para una persona. El conteo de `contacto_registrado` debe aumentar solo por las personas nuevas, no por la cantidad de mensajes.
4. Si se enlaza posteriormente una decisión con `id_interaccion` e `id_captacion`, comprobar que ambos pertenecen a la misma persona. Las FK simples existentes no bastan para demostrar esa correspondencia conjunta.

## 7. Probar la conversión real de la BD

Usar un contacto nuevo en BUYER, utilizable y con autorización explícita del caso sintético. El procedimiento ya existe:

```sql
EXEC NexoSaludDB.dbo.usp_ConvertirBuyerALead
    @id_captacion = <ID_DE_TU_CAPTACION>,
    @id_servicio = <ID_ACTIVO_DEL_CATALOGO>,
    @motivo = N'Solicita precio y disponibilidad del servicio',
    @id_usuario = <ID_DEL_OPERADOR_O_NULL>;
```

La plantilla contiene marcadores: sustituirlos antes de ejecutar. No es una llamada lista para pegar con IDs predeterminados.

Comprobar en origen:

1. Una solicitud nueva con la persona/servicio correctos.
2. Un evento BUYER → LEAD con persona, captación y solicitud correspondientes.
3. Etapa actual LEAD, sin retroceder una fase posterior.
4. `clave_operacion_buyer` identificando la operación.
5. Segunda ejecución para esa captación devuelve `ya_convertido=1` y no crea otra solicitud ni otro evento.

Casos de rechazo: captación inexistente, fecha futura, sin autorización, autorización revocada en `Personas`, calidad inválida, motivo vacío, servicio inexistente/inactivo y persona que ya está en otra fase sin evento Buyer válido. El procedimiento comprueba presencia del motivo, no determina con IA que la intención sea concreta.

Probar también dos sesiones intentando convertir la misma captación. No interpretar la existencia de un índice o bloqueo como una prueba de concurrencia ejecutada. Registrar solicitudes/eventos antes y después. Si un caso histórico devuelve `id_solicitud=NULL`, investigar su evidencia; no enlazar una solicitud cualquiera para completar el campo.

Después de la conversión, ejecutar el bloque 1 y comprobar `conversion_lead`, evento, fecha y duración de esa persona en el Mart.

## 8. Ventanas, actualización e idempotencia

Ejecutar [04_pruebas_reglas_buyer.sql](../semana9/04_pruebas_reglas_buyer.sql), y completar pruebas integrales con datos temporales controlados:

| Caso | Esperado |
|---|---|
| Sin evento LEAD | Conversión 0, fecha/duración `NULL`. |
| Conversión a 14 días exactos | Incluida en B1 si el contacto es utilizable. |
| Conversión un segundo después | Conversión general 1, excluida del numerador de B1. |
| Evento anterior a captación | Aparece en el control de cronología; no se convierte en duración cero válida. |
| Cohorte con menos de 14 días | Mostrar que su ventana está incompleta. No cambiar el denominador oficial en silencio. |
| Contacto antiguo que convierte ahora | El siguiente ETL actualiza su fila/cohorte original. |
| ETL repetido sin cambios de origen | Mismas claves, evidencia y cinco medidas; puede cambiar `fecha_corte_etl`. |
| Fallo durante una carga | El hecho no queda parcialmente borrado. Probarlo solo en la copia de pruebas. |

Si comparan cohortes maduras, aplicar la misma elegibilidad al numerador y al denominador. La consulta oficial actual utiliza contactos utilizables registrados, de acuerdo con la fórmula principal; cambiar esa interpretación necesita acuerdo y texto concordante en el informe.

## 9. Qué archivos entregar al cerrar

- SQL de casos complementarios claramente sintéticos e idempotentes, si se requieren para reproducir pruebas.
- Migración aditiva para bases ya revisadas si se añadieron restricciones o atributos; no repetir `init_oltp.sql` en una base poblada.
- Definiciones nuevas equivalentes en creación desde cero y ruta de actualización. Revisar `init_oltp.sql` y `migracion_buyer.sql` cuando cambie una vista/procedimiento existente.
- Correcciones necesarias al bloque 1, validaciones e indicadores, respetando cinco medidas y tres indicadores.
- Resultados antes/después y estado por caso: **pasó, falló o pendiente**. No afirmar ejecución de pruebas que solo se leyeron.

### Lista final de aceptación

- [ ] Regla de calidad y temporalidad acordada con el informe.
- [ ] Captaciones nuevas con sede/servicio declarados y desconocidos conservados.
- [ ] Interacciones no multiplican contactos.
- [ ] Gastos reconciliados al céntimo y ausencias distinguibles de cero.
- [ ] Conversión nueva y reintento verificados en solicitud, evento y hecho.
- [ ] Rechazos y concurrencia probados.
- [ ] Límite de 14 días comprobado con timestamps.
- [ ] Conversión tardía actualiza la cohorte original.
- [ ] ETL repetible sin duplicados; rollback de fallo comprobado.
- [ ] Reporte consistente por fecha/fuente/canal/sede, no solo en total general.
- [ ] Si se ejecutó solo bloque 1, medidas de las otras fases permanecen iguales. Si se ejecutó el completo, sus conciliaciones siguen pasando.
- [ ] Diferencias funcionales justificadas, commits revisables y ninguna integración automática a `main`.
