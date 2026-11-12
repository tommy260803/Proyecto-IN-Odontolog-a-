# Entrega del Agente Buyer — Desarrollo independiente y relevo QA

**Estado:** IMPLEMENTADO PARCIALMENTE — PENDIENTE DE VALIDACIÓN QA.
**Rama de trabajo:** `feature/buyer-agent-gemini`
**Fecha de actualización:** 12 de noviembre de 2026

---

## 1. Resumen Ejecutivo y Guía Principal

El desarrollo y verificación del módulo Buyer se ha realizado de forma independiente, dejando la integración final de agentes aplazada hasta consolidar las pruebas locales.

Para retomar el desarrollo, configurar el entorno y ejecutar las pruebas paso a paso, consultar la **[Guía Principal de Relevo para Germain](GUIA_RELEVO_GERMAIN_BUYER.md)**.
El informe detallado de las correcciones de auditoría y pruebas focalizadas se encuentra en **[RESULTADOS_REVISION_BUYER_V7.md](../../RESULTADOS_REVISION_BUYER_V7.md)**.

---

## 2. Revisiones y Trazabilidad del Módulo

| Referencia | Autor / Contexto | Alcance y Aportes |
|---|---|---|
| `b819dd5` | LEAD | Recepción mediante `registerLeadIntake`, tabla `dbo.EntradasAgenteLead` y procedimiento de entrada. |
| `7104fb8` | Buyer | Integración inicial del clasificador Gemini y primeras aclaraciones. |
| `ffb67b6` | Buyer | Recuperación post-commit y contexto conversacional. |
| `2fff156` | Buyer | Publicación del avance con estado en revisión y banderas de entorno QA. |
| `3e4cd2d` | Germain | Servicio de evaluación dental, casos de prueba y documentación operativa. |
| **Esta Entrega** | Daniel / Buyer | Unificación de la ficha con el clasificador backend (fuente única de verdad), eliminación de `isReservationOriented`, recuperación post-commit basada en identidad persistida (`hasPersistedOperationEvidence`), persistencia de `CONVERSION_EN_CURSO` previa al SP, preservación de `historial_errores`, resolución determinista de preferencias/horarios y 122 pruebas automatizadas aprobadas reportadas por Antigravity (sin acreditar SQL/Gemini en vivo). |

---

## 3. Capacidades implementadas y comprobadas con simulaciones

1. **Fuente Única de Evaluación:** La ficha del paciente (`BuyerDetailView.tsx`) y los endpoints administrativos consumen `BuyerEvaluationService`, eliminando discrepancias entre heurísticas frontend y la inferencia estructurada de Gemini.
2. **Ciclo de Vida de Mensajes sin Solicitudes Prematuras:** Las consultas informativas o ambiguas se persisten únicamente en `dbo.Interacciones`. Las oportunidades comerciales en `dbo.Solicitudes` se generan exclusivamente a través de la conversión formal atómica (`dbo.usp_ConvertirBuyerALead`).
3. **Resolución Determinista del Servicio Declarado:** Se prioriza la preferencia vigente en `dbo.PersonaPreferencias`, seguida de la captación inicial en `dbo.CaptacionesBuyer`, y como compatibilidad histórica la solicitud.
4. **Matriz de Discrepancias de Horarios:** `detectScheduleDiscrepancy` diferencia fechas de turnos, admite alternativas disyuntivas (*"mañana o tarde"*), valida contra el catálogo de `dbo.Horarios` y no inventa contradicciones ante ambigüedades.
5. **Reintento Idempotente e Historial de Errores:** Reutiliza la misma decisión en estado `PENDIENTE` acumulando el contador de intentos y registrando `historial_errores` de forma auditable.
6. **Repetición Idempotente de Conversión:** Reevaluar una interacción ya convertida retorna la decisión existente sin invocar a Gemini, conservando huella, IDs y estado de entrega.
7. **Recuperación Post-Commit sin Heurísticas de Texto:** Eliminación de falsos positivos por palabras clave (*"reserva"*, *"horarios"*); la recuperación requiere evidencia persistida de pertenencia de la operación vinculada a la interacción.

---

## 4. Pendientes Prioritarios de Buyer para el Relevo

### P1. Recuperación Automática: Selección de `CONVERSION_EN_CURSO`
En [backend/src/services/buyerEvaluationService.ts](../../backend/src/services/buyerEvaluationService.ts), el método `recoverPendingEvaluations` busca decisiones con `estado: 'PENDIENTE'` o `accion: 'REINTENTO_PENDIENTE'`, pero omite `{ decision: { contains: '"estado":"CONVERSION_EN_CURSO"' } }`. Si el servidor cae durante la conversión, el proceso al arrancar no recupera estas decisiones en curso.
*Aceptación:* Incluir `CONVERSION_EN_CURSO` en la consulta y verificar la recuperación sin duplicar solicitudes ni eventos.

### P2. Verificación de Clave de Operación en SQL Real
El SQL publicado genera `BUYER_LEAD:<id_captacion>`; el JSON Buyer registra además `operacion_id` por interacción. Son identidades distintas. La simulación con evento de tres componentes no cambia el procedimiento SQL. Validar en la copia real `NexoSalud_LeadEnsayoFinal` que la clave `clave_operacion_buyer` generada por `dbo.usp_ConvertirBuyerALead` coincida con los criterios de búsqueda de `dbo.usp_RegistrarEntradaAgenteLead` (en [database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql](../../database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql)).
*Aceptación:* Una consulta nueva de un contacto nunca debe apropiarse de una conversión histórica.

### P3. Protección frente a Registros HTTP Concurrentes
En la ruta pública `POST /api/buyer/register` de [buyer.routes.ts](../../backend/src/routes/buyer.routes.ts), la verificación de `Idempotency-Key` previa a la inserción permite que dos peticiones simultáneas en el mismo milisegundo superen la validación antes del primer commit. La ventana de carrera no requiere coincidencia exacta de milisegundo.
*Aceptación:* Dos envíos simultáneos con la misma clave y contenido deben reutilizar interacción y operación. Misma clave con contenido distinto debe responder HTTP 409 Conflict. La protección debe garantizarse a nivel de base de datos o mutex distribuido.

### P4. Validación en Vivo contra SQL Server y Gemini Real
- **SQL Server Real:** Ejecución de la suite de integración contra la base viva `NexoSalud_LeadEnsayoFinal` (`RUN_SQL_TESTS=true`).
- **Gemini Real:** Verificación de latencia, cuota y respuestas semánticas en vivo con `GEMINI_API_KEY` activa (`RUN_LIVE_GEMINI_TESTS=true`).

---

## 5. Interfaz de Integración con el Agente LEAD

1. Buyer confirma el registro del mensaje y la interacción antes de invocar la evaluación.
2. Si corresponde convertir, invoca atómicamente `dbo.usp_ConvertirBuyerALead`.
3. Tras el commit SQL, invoca [registerLeadIntake](../../backend/src/services/leadIntake.ts) de forma desacoplada para formalizar la entrega en `dbo.EntradasAgenteLead`.
4. El agente LEAD iniciará su ciclo de negociación a partir de las entradas registradas en `dbo.EntradasAgenteLead`.

---

## 6. Verificación Automatizada

La suite completa del proyecto se ejecuta mediante:
```powershell
npm --prefix frontend test
```
**Resultado reportado por Antigravity:** 122 pruebas aprobadas con el comando oficial. SQL y Gemini real siguen pendientes; registra también las omisiones de cada ejecución. Esta revisión documental no ejecutó la suite. Los rótulos P1/P2/P3 de los tests del informe V7 son nombres locales y no prueban que la concurrencia HTTP esté cerrada.
