# Informe de Revisión Buyer V7: Recuperación Post-Commit, Trazabilidad de Historial y Guía QA Acreditada

**Rama de trabajo:** `feature/buyer-agent-gemini`
**Fecha:** 12 de noviembre de 2026
**Estado de publicación:** Código publicado en `8fa947d8d6cfda140d77df5f1c9e2ff6b83f5f47`; pendiente de validación QA. Compilaciones y pruebas simuladas reportadas por Antigravity. La guía operativa vigente es [GUIA_RELEVO_GERMAIN_BUYER.md](docs/agentes/GUIA_RELEVO_GERMAIN_BUYER.md).

---

## 1. Correcciones Técnicas Implementadas (Cierre V7)

### 1.1. Recuperación Post-Commit sin Heurísticas de Texto
- **Problema detectado en auditoría v6:** La función evaluadora utilizaba `isReservationOriented = /(?:reserva|cita|agendar|turno)/i.test(mensaje)` como criterio para decidir si un contacto con conversión histórica previa debía recuperar dicha conversión. Esto provocaba falsos positivos: consultas meramente informativas o con negación explícita (ej. *"No quiero reservar, solo consultar horarios"*) eran erróneamente adjudicadas a la solicitud histórica de la captación, alterando la etapa y devolviendo `CONVERSION_LEAD`.
- **Solución implementada:**
  - Se **eliminó por completo** `isReservationOriented` de la lógica de recuperación.
  - La recuperación post-commit se apoya estrictamente en **evidencia persistida de pertenencia de la operación** (`hasPersistedOperationEvidence`), validando cualquiera de las siguientes condiciones del código cuya suficiencia debe verificarse en QA:
    1. La interacción actual ya tiene vinculada la solicitud (`thisInteraction.id_solicitud === conv.id_solicitud`).
    2. La decisión previa registrada para esta interacción ya contenía dicha solicitud (`prevParsedDecision.id_solicitud === conv.id_solicitud`).
    3. El código acepta `estado === 'CONVERSION_EN_CURSO'` o acción `CONVERSION_LEAD` acompañada de coincidencia de `operacion_id` o intención `SOLICITA_RESERVA`. No exige en todos esos caminos coincidencia de operación; su suficiencia sigue pendiente de verificar.
    4. La clave persistida en el evento de etapa contiene el identificador de la interacción actual (`clave_operacion_buyer === BUYER_LEAD:${id_captacion}:${id_interaccion}`).
  - Inmediatamente antes de ejecutar `EXEC dbo.usp_ConvertirBuyerALead`, se actualiza la decisión en `dbo.DecisionesIA` con `estado: 'CONVERSION_EN_CURSO'`, `operacion_id: BUYER_LEAD:${id_captacion}:${id_interaccion}` y `accion: 'CONVERSION_LEAD'`.
  - Si no existe evidencia suficiente vinculada a la interacción actual, **no se adjudica la conversión histórica** y se procede con la clasificación normal del mensaje.

### 1.2. Trazabilidad Auditable de Historial de Errores e Intentos
- **Problema detectado en auditoría v6:** Cuando una evaluación en estado `PENDIENTE` acumulaba errores previos y posteriormente completaba con éxito en un reintento, el payload de salida y la decisión en base de datos perdían el detalle de `historial_errores`, impidiendo auditar los fallos transitorios previos.
- **Solución implementada:**
  - Al inicio de la evaluación (`executeEvaluationCore`), se extraen de forma segura los intentos previos (`prevAttempts`) y el historial cronológico de errores (`prevErrorHistory`).
  - Tanto en las rutas de éxito (`COMPLETADA` para `SOLO_CONSULTA`, `ACLARACION`, `REQUISITOS_INCOMPLETOS`, `CONSERVA_ETAPA_POSTERIOR`, `SOLICITUD_PENDIENTE_APERTURA` y `CONVERSION_LEAD`), como en la recuperación post-commit, se preserva `historial_errores: prevErrorHistory.length > 0 ? prevErrorHistory : undefined`.
  - Se totaliza el número de intentos acumulados (`intentosRealizados = prevAttempts + 1`).
  - Se expuso la propiedad `historial_errores?: string[]` en los tipos TypeScript `BuyerEvaluationOutcome` y `BuyerEvaluationSummary`.

---

## 2. Pruebas Focalizadas Ejecutadas y Validadas

Se incorporaron tres pruebas automatizadas específicas en `backend/tests/buyerUnifiedEvaluation.test.ts` para certificar los hallazgos de auditoría v7:

| Prueba Focalizada | Escenario | Comprobación y Resultado |
|---|---|---|
| **V7-A. Conversión histórica sin interacción vinculada + negación de reserva** | Captación con conversión histórica en `EventosEtapa` (`BUYER_LEAD:10`) y nuevo mensaje: *"No quiero reservar, solo consultar horarios"* | ✅ Clasifica la consulta como `SOLO_CONSULTA`.<br>✅ Conserva etapa `BUYER`.<br>✅ `id_solicitud` es nulo (no reutiliza la solicitud 450 histórica).<br>✅ `ya_convertido` no se activa. |
| **V7-B. Recuperación con estado post-commit simulado en memoria** | El doble de prueba prepara solicitud 451 y evento 902 con `BUYER_LEAD:11:3005` para la interacción 3005. No se ejecutó un procedimiento ni un COMMIT en SQL Server | ✅ Recupera la misma solicitud (451) y evento (902).<br>✅ Cero llamadas adicionales al clasificador.<br>✅ No duplica filas en `EventosEtapa` (conteo se mantiene en 1).<br>✅ Actualiza `Interacciones.id_solicitud = 451` y completa la entrega. |
| **V7-C. Secuencia fallo-fallo-éxito sobre la misma interacción** | Interacción 3006 sufre dos fallos de red simulados en Gemini y en el tercer intento responde exitosamente `SOLO_CONSULTA` | ✅ Reutiliza el mismo `id_decision` sin dejar huérfanos (`size === 1`).<br>✅ Registra `intentosRealizados = 3`.<br>✅ Preserva `historial_errores` con ambos mensajes de error transitorio en el resultado y en `DecisionesIA`. |

### Resultados Globales de la Suite Automatizada
- `backend/tests/buyerUnifiedEvaluation.test.ts`: **23 pruebas superadas (100%)**.
- `backend/tests/buyerMessageJourney.test.ts`: **21 pruebas superadas (100%)**.
- `backend/tests/buyerMessageClassifier.test.ts`: **28 casos: 24 aprobados y 4 omitidos de red en vivo**.
- `backend/tests/buyerDurationRoute.test.ts`: **1 prueba superada**.
- `backend/tests/buyerDurationMatrix.test.ts`: **4 pruebas superadas**.
- `backend/tests/buyerCampaignMatrix.test.ts`: **5 pruebas superadas**.
- **Total Módulo Buyer:** **78 pruebas superadas, 4 omitidas (modo offline), 0 fallos**.

---

## 3. Guía de Configuración y Despliegue QA Contrastada

> [!IMPORTANT]
> Las variables de entorno han sido verificadas contra `backend/prisma/schema.prisma`, `backend/src/db.ts`, `backend/src/db/mart.ts` y `backend/.env.example`. No inventar variables ni alterar los nombres de conexión oficiales.

### 3.1. Matriz de Variables de Entorno (`backend/.env`)

```env
# -----------------------------------------------------------------------------
# Base de Datos Transaccional (SQL Server)
# -----------------------------------------------------------------------------
# Prisma requiere obligatoriamente SQLSERVER_URL (definido en backend/prisma/schema.prisma)
SQLSERVER_URL="sqlserver://localhost:1433;database=NexoSalud_LeadEnsayoFinal;integratedSecurity=true;trustServerCertificate=true;"

# Jerarquía en db.ts: Si se define TEST_SQLSERVER_URL, tiene máxima prioridad
# sobre SQLSERVER_URL para sobreescribir la conexión en escenarios de prueba/QA:
# TEST_SQLSERVER_URL="sqlserver://localhost:1433;database=NexoSalud_LeadEnsayoFinal;integratedSecurity=true;trustServerCertificate=true;"

# Si TEST_SQLSERVER_URL no está definido pero se activa RUN_SQL_TESTS=true,
# db.ts sustituye dinámicamente la base de datos de SQLSERVER_URL por NexoSalud_LeadEnsayoFinal.

# -----------------------------------------------------------------------------
# Conexión Directa ODBC (Sincronización Mart y Analytics)
# -----------------------------------------------------------------------------
# mart.ts utiliza OLTP_CONNECTION_STRING para consultas directas sin Prisma
OLTP_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSalud_LeadEnsayoFinal;Trusted_Connection=yes;TrustServerCertificate=yes;"
MART_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSalud_Mart;Trusted_Connection=yes;TrustServerCertificate=yes;"

# -----------------------------------------------------------------------------
# Parámetros del Servidor y Procesos de Segundo Plano
# -----------------------------------------------------------------------------
# El servidor backend escucha por defecto en el puerto 3001 (src/index.ts)
PORT=3001

# Desactivar cobranza y cancelaciones automáticas para evitar mutaciones de estado
# imprevistas en etapas avanzadas durante las pruebas de Buyer
DUNNING_ENABLED=false

# Indicadores de entorno QA y bypass de sincronización mart en segundo plano
QA_ENV=true
DISABLE_MART_SYNC=true

# -----------------------------------------------------------------------------
# Credencial del Clasificador Gemini
# -----------------------------------------------------------------------------
# Requerido únicamente para invocar la API externa en vivo (gemini-3.5-flash-lite)
GEMINI_API_KEY="<CLAVE_DE_ACCESO_GEMINI_REAL>"
```

### 3.2. Verificaciones de Esquema en Base de Datos (Solo Lectura)

> [!CAUTION]
> No ejecute comandos de migración destructivos (`prisma db push --force-reset` ni recreaciones de tablas) sobre `NexoSalud_LeadEnsayoFinal`. La base de datos ya cuenta con las estructuras existentes. Ejecute únicamente consultas de validación informativa:

```sql
-- 1. Validar presencia de tablas nucleares del módulo Buyer y transaccional
SELECT TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN (
    'Personas', 'CaptacionesBuyer', 'Interacciones', 'DecisionesIA',
    'PersonaPreferencias', 'Horarios', 'Servicios', 'Solicitudes',
    'EventosEtapa', 'Etapas'
);

-- 2. Validar estructura de columnas en dbo.DecisionesIA
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DecisionesIA'
  AND COLUMN_NAME IN ('id_decision', 'agente', 'id_persona', 'id_captacion', 'id_interaccion', 'entrada', 'decision', 'accion', 'requiere_revision', 'resultado_revision');

-- 3. Validar existencia del procedimiento de conversión
SELECT ROUTINE_NAME, ROUTINE_TYPE, CREATED, LAST_ALTERED
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_NAME = 'usp_ConvertirBuyerALead';

-- 4. Validar servicios activos disponibles para clasificación
SELECT id_servicio, nombre, activo
FROM dbo.Servicios
WHERE activo = 1;

-- 5. Validar horarios configurados
SELECT id_horario, dia_semana, hora_inicio, hora_fin
FROM dbo.Horarios;
```

---

## 4. Declaración de Alcance y Pendientes Técnicos

Para mantener una absoluta claridad técnica y no atribuir validaciones que exceden los límites del entorno actual:

1. **Pruebas Automatizadas con Dobles en Memoria (No SQL Real Físico):**
   - Las pruebas ejecutadas en `Vitest` emplean dobles de prueba controlados (`createMockDb`) que emulan el comportamiento de Prisma, `$queryRaw`, `$executeRaw` y el procedimiento almacenado `dbo.usp_ConvertirBuyerALead`.
   - **Pendiente:** La ejecución de pruebas funcionales contra una instancia viva de Microsoft SQL Server apuntando a `NexoSalud_LeadEnsayoFinal` se realizará en la sesión de pruebas de QA.
2. **Clasificador Gemini (Simulado vs. Real):**
   - La suite de regresión ejecuta con `classifierOverride` determinista para garantizar velocidad e idempotencia reproducible.
   - **Pendiente:** La validación de inferencia semántica en vivo contra la API de Google Gemini (`gemini-3.5-flash-lite`) requiere configurar `GEMINI_API_KEY` en el archivo local de QA.
3. **Protección de Concurrencia HTTP Simultánea:**
   - Si dos peticiones HTTP con la misma `Idempotency-Key` llegan en paralelo durante la ventana entre lectura e inserción a la API web antes de que la primera complete su registro en base de datos, se requiere idempotencia atómica persistente (por ejemplo, clave única y operación transaccional o bloqueo SQL adecuado con relectura). Un Map en un proceso no garantiza varios procesos ni reinicios.
   - **Pendiente:** La idempotencia de registros públicos simultáneos sigue pendiente de implementación y prueba funcional; no es una capacidad validada de esta entrega.

---

## 5. Resumen de Archivos Modificados para Empaquetado

- `backend/src/services/buyerEvaluationService.ts`: Eliminación de `isReservationOriented`, recuperación post-commit basada en evidencia persistida (`hasPersistedOperationEvidence`), persistencia de `CONVERSION_EN_CURSO` antes de commit y propagación de `historial_errores`.
- `backend/src/types/buyer.ts`: Declaración de `historial_errores?: string[]` en `BuyerEvaluationOutcome` y `BuyerEvaluationSummary`.
- `backend/src/routes/buyer.routes.ts`: Trazabilidad y no creación de solicitudes prematuras en registros informativos.
- `frontend/src/modules/buyer/components/BuyerDetailView.tsx`: Consumo unificado del evaluador backend.
- `backend/tests/buyerUnifiedEvaluation.test.ts`: Pruebas P1, P2 y P3 añadidas y validadas.
- `backend/tests/buyerMessageJourney.test.ts`: Recorrido completo de mensaje y resolución de servicios.
- `RESULTADOS_REVISION_BUYER_V7.md`: Documentación técnica y guía QA.
