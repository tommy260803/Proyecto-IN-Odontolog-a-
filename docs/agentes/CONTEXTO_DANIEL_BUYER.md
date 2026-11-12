# Contexto de trabajo para Daniel: agente Buyer

**Fecha:** 11 de noviembre de 2026  
**Rama de trabajo:** `feature/buyer-agent-gemini`

## 1. Propósito del documento

Este documento resume lo trabajado en la etapa Buyer para que Daniel pueda
continuar la revisión y preparar una demostración independiente. Buyer debe
recibir y ordenar una oportunidad odontológica, validar sus datos, interpretar
el mensaje del prospecto y recomendar el siguiente abordaje comercial.

La integración completa con LEAD se coordina después. Para la presentación
actual, Buyer debe poder demostrarse de forma autónoma desde la interfaz.

## 2. Qué está implementado

### Registro y calidad de datos

- Registro de nombre, teléfono, correo, servicio, sede, horario, canal, fuente,
  mensaje y consentimiento.
- Validación de teléfono móvil y consentimiento de la Ley N.° 29733.
- Detección de coincidencias por teléfono, correo o DNI.
- Conservación de interacciones recurrentes de un contacto existente.
- Historial de eventos en la ficha Buyer.

### Clasificación e intención

El clasificador del backend utiliza Gemini para analizar el mensaje Buyer y
obtener una intención, servicio asociado y datos de evaluación. En la vista
de detalle también existe un análisis comercial que combina reglas
heurísticas con una llamada opcional a Groq si se configura
`VITE_GROQ_API_KEY`.

Las clasificaciones que deben demostrarse son:

- Solicitud concreta o reserva.
- Consulta informativa.
- Mensaje ambiguo o saludo.
- Necesidad urgente, como dolor o solicitud inmediata.

La misma ficha debe producir resultados distintos al cambiar el mensaje y
volver a pulsar **Actualizar**.

### Preferencias y atribución

La tarjeta **Clasificación de Preferencias** presenta servicio, sede, horario y
categoría. Estos valores pueden venir seleccionados desde el formulario; el
agente los organiza y valida, pero no debe presentarse como si hubiera
descubierto datos que el usuario ya registró.

La tarjeta **Origen y Atribución** presenta canal, fuente y campaña. La fuente
debe llegar desde el formulario, parámetros de captación o datos persistidos.
El agente puede generar una explicación comercial, pero no puede inventar el
origen si no fue enviado.

### Recomendación comercial

Cuando la intención es concreta y los datos están completos, el agente puede
recomendar asignar un asesor comercial o recepcionista de inmediato. Cuando el
mensaje es ambiguo o falta información, debe mantener el contacto en Buyer y
solicitar aclaración.

## 3. Qué debe mostrar la demostración

La demostración recomendada usa tres fichas sintéticas:

| Caso | Mensaje | Resultado esperado |
|---|---|---|
| Reserva | `Quiero reservar una evaluación odontológica por la tarde.` | Intención alta y atención prioritaria |
| Consulta | `¿Cuánto cuesta una evaluación odontológica?` | Consulta informativa; no conversión automática |
| Ambigüedad | `Hola, buenas tardes.` | Aclaración; mantener en Buyer |

En cada ficha se debe revisar:

1. Validación de teléfono y consentimiento.
2. Preferencias persistidas.
3. Canal y fuente.
4. Intención y recomendación.
5. Timeline.
6. Comportamiento de **Actualizar**.

La guía operativa completa está en
[PRUEBAS_BUYER_AGENTE_IA.md](./PRUEBAS_BUYER_AGENTE_IA.md).

## 4. Archivos principales

- [buyerMessageClassifier.ts](../../backend/src/services/buyerMessageClassifier.ts):
  clasificador Gemini del backend.
- [buyerEvaluationService.ts](../../backend/src/services/buyerEvaluationService.ts):
  orquestación de evaluación, persistencia, recuperación y conversión.
- [buyer.routes.ts](../../backend/src/routes/buyer.routes.ts):
  registro, listado, paginación, estados y detección de duplicados.
- [groqService.ts](../../frontend/src/shared/services/groqService.ts):
  análisis comercial mostrado en el frontend y reglas de intención.
- [BuyerDetailView.tsx](../../frontend/src/modules/buyer/components/BuyerDetailView.tsx):
  detalle Buyer, tarjetas del agente, botón **Actualizar** y timeline.
- [BuyerListView.tsx](../../frontend/src/modules/buyer/components/BuyerListView.tsx):
  listado, paginación y filtros de estado.

## 5. Configuración local

La API key de Gemini debe estar únicamente en `backend/.env`:

```env
GEMINI_API_KEY="CLAVE_LOCAL"
```

Variables recomendadas para pruebas:

```env
QA_ENV=true
DISABLE_MART_SYNC=true
DUNNING_ENABLED=false
```

El frontend usa normalmente:

```env
VITE_USE_API=true
VITE_API_URL=http://localhost:3001/api
```

No compartir `.env`, claves, contraseñas ni capturas que los contengan. SSMS
no necesita permanecer abierto, pero el servicio de SQL Server sí debe estar
activo y el backend debe apuntar a la base correcta.

## 6. Limitaciones y decisiones importantes

### El agente no reemplaza al formulario

El agente interpreta y recomienda. No debe fingirse que la IA descubre el
canal, la fuente, la sede o el horario cuando ya fueron seleccionados por el
usuario. Las tarjetas 2 y 3 son útiles como resumen operativo y trazabilidad,
pero su valor inteligente depende de que existan mensajes libres o datos que
normalizar.

### Dos capas de análisis

Gemini en backend y el análisis mostrado en el detalle no son exactamente el
mismo componente. El backend clasifica durante el flujo de registro; el
frontend recalcula el diagnóstico comercial visible. Por eso una diferencia
entre ambos debe investigarse antes de presentarla como error de Gemini.

### Cuota del proveedor

Las llamadas reales a Gemini consumen cuota. Un fallo por límite de solicitudes
no demuestra que la lógica esté incorrecta. Para la presentación conviene
reutilizar fichas sintéticas y evitar recalcular repetidamente sin necesidad.

### Duplicados

Dos fichas con el mismo teléfono, correo o DNI pueden ser correctamente
marcadas como duplicadas. No usar esos datos en varios casos de demostración.
El filtro **Nuevo** debe excluir fichas duplicadas y el filtro **Duplicado** debe
incluir coincidencias reales.

## 7. Pendientes técnicos

### P1: distinguir mensaje nuevo de recuperación

Una persona que ya pasó a PAYER o LEAD puede enviar un mensaje nuevo. La etapa
actual por sí sola no prueba que exista una conversión interrumpida. El sistema
debe recuperar solo la operación persistida que realmente quedó incompleta y
no etiquetar una consulta nueva como `CONVERSION_LEAD`.

### P2: idempotencia concurrente

La misma solicitud repetida con la misma clave debe reutilizar la interacción
existente. Hay que probar dos peticiones simultáneas y también la misma clave
con contenido distinto, que debe rechazarse con conflicto. Una protección solo
en memoria no garantiza el comportamiento entre varios procesos.

### P3: QA e integración con LEAD

Las pruebas de escritura y concurrencia deben ejecutarse sobre una copia QA,
no sobre `NexoSaludDB` si esta es la base de trabajo principal. La integración
Buyer → LEAD requiere coordinar `id_solicitud`, `id_evento_etapa`,
`id_captacion` e `id_persona` según el contrato compartido.

## 8. Posibles mejoras

1. Mostrar en la interfaz el mensaje original que fundamenta la intención.
2. Separar visualmente “dato registrado” de “inferencia del agente”.
3. Mostrar confianza, reglas activadas o motivos de la recomendación.
4. Persistir la evaluación visible para que no dependa únicamente del estado
   local del navegador.
5. Añadir una acción explícita para solicitar aclaración al prospecto.
6. Registrar quién revisó la recomendación y cuándo.
7. Incorporar una prueba de regresión por cada mensaje que haya causado una
   clasificación incorrecta.
8. Coordinar con LEAD un contrato de entrada único e idempotente.

## 9. Preguntas para acordar entre Daniel y Germain

- ¿La demostración usará la base principal o una copia QA?
- ¿Qué tres fichas sintéticas se presentarán y quién las creará?
- ¿Qué comportamiento se considera conversión válida a LEAD?
- ¿El análisis visible debe ser principalmente heurístico o depender de una
  respuesta de proveedor externo?
- ¿Qué datos de atribución estarán disponibles realmente en la presentación?
- ¿Quién valida los casos P1 y P2 antes de integrar con LEAD?

## 10. Criterio de entrega de Buyer

Buyer está listo para una demostración independiente cuando:

- el backend y frontend compilan;
- el formulario registra una ficha sintética;
- el agente diferencia reserva, consulta y ambigüedad;
- teléfono y consentimiento se validan;
- preferencias y atribución se conservan;
- la recomendación de abordaje cambia según la intención;
- los duplicados y filtros muestran estados coherentes;
- no se exponen credenciales;
- las pruebas de escritura se ejecutan en QA.

La aprobación de la integración completa requiere además resolver P1/P2 y
ejecutar la matriz conjunta con LEAD.
