# Entrega del Agente Buyer: Integración de Clasificación Gemini, Orquestación y Entrada a LEAD

> [!IMPORTANT]
> **Estado del Avance: EN REVISIÓN**  
> La integración se encuentra actualmente en revisión técnica y funcional en el entorno QA. Antes de proceder con la fusión definitiva con otras ramas y el despliegue productivo, deben resolverse los pendientes prioritarios registrados en este documento.

Este documento constituye el contrato técnico y operativo de entrega del **Agente Buyer** integrado con el clasificador semántico **Gemini 3.5 Flash Lite** y el flujo de entrada formal acordado con el equipo LEAD, referenciado en [CONTRATO_BUYER_LEAD.md](../../database/lead_revision/CONTRATO_BUYER_LEAD.md).

---

## 1. Commits Revisados y Estado del Repositorio

- **`b819dd5`** (`origin/lead`): `feat(lead): registrar recepción idempotente de solicitudes Buyer`  
  Punto de partida del contrato LEAD con `dbo.usp_RegistrarEntradaAgenteLead`, script `ENTRADA_AGENTE_LEAD_QA.sql` y `leadIntake.ts`.
- **`f859c4c`**: `feat(buyer): avance de integracion clasificador Gemini con flujo Buyer y Lead`  
  Commit local de respaldo previo a la fusión.
- **`3be5a85`**: `Merge remote-tracking branch 'origin/lead' into feature/buyer-agent-gemini`  
  Fusión limpia de ramas sin conflictos, preservando `@google/genai` (^3.1.0) y los scripts de LEAD.
- **`7104fb8`**: `feat(buyer): adapta integracion con contrato LEAD, desacoplamiento y aclaraciones`  
  Desacoplamiento de llamadas fuera de transacción, esquema compartido, descompromiso de horarios rígidos e integración en dos turnos.
- **Commit actual**: `feat(buyer): robustece recuperacion post-commit, resolucion explicita e idempotencia`  
  Incorpora recuperación de caídas post-commit sin reclasificar, reconstrucción fiel desde `entrada`, validación de pertenencia de solicitudes e interacciones, e `Idempotency-Key` estricto con comprobación de hash.

---

## 2. Estado Real de la Integración

| Capacidad | Estado | Detalle Operativo |
|---|---|---|
| **Clasificación Semántica** | **OPERATIVO** | `@google/genai` con modelo `gemini-3.5-flash-lite`, timeout con `AbortSignal`, reintentos exponenciales y auditoría censurada. |
| **Persistencia Transaccional** | **OPERATIVO** | Persona en `BUYER`, captación, mensaje e interacción en `dbo.Interacciones`, y decisión inicial `PENDIENTE` en `dbo.DecisionesIA` en una única transacción atómica. |
| **Evaluación Desacoplada** | **OPERATIVO** | Llamada a Gemini fuera de la transacción SQL; consultas al catálogo real de servicios activos. |
| **Recuperación Post-Commit** | **OPERATIVO** | Si `dbo.usp_ConvertirBuyerALead` committed y ocurre una caída antes de actualizar la interacción o decisión, el sistema recupera los identificadores de `dbo.EventosEtapa` (`BUYER_LEAD:<id_captacion>`), completa `registerLeadIntake` y no reclasifica con Gemini. |
| **Reconstrucción en Reintentos** | **OPERATIVO** | Reconstruye desde `entrada` el servicio declarado y el contexto. Enriquece el prompt con mensaje anterior, pregunta del agente y respuesta actual. |
| **Pertenencia de Contexto** | **OPERATIVO** | Valida que `id_interaccion_previa` pertenezca a la misma persona; descarta el contexto si pertenece a otro usuario. |
| **Resolución Explícita de Solicitudes** | **OPERATIVO** | Para contactos en etapas posteriores (`LEAD`, etc.), resuelve menciones explícitas (`#123`) validando pertenencia (`CONSERVA_ETAPA_POSTERIOR`). Referencias dudosas o sin código quedan como `SOLICITUD_PENDIENTE_APERTURA`. |
| **Idempotencia Estricta** | **OPERATIVO** | `Idempotency-Key` como identidad persistente y hash SHA-256 de contenido. Misma clave con contenido distinto se rechaza con **409 Conflict**. Claves distintas permiten mensajes nuevos iguales. |
| **Protección Concurrente** | **OPERATIVO** | Cerrojo en memoria (`inFlightEvaluations` por `id_interaccion`) y cerrojos SQL con `UPDLOCK, HOLDLOCK` en `dbo.usp_RegistrarEntradaAgenteLead` y `dbo.usp_ConvertirBuyerALead`. |
| **Recuperación Automática** | **OPERATIVO** | Ejecutada al arrancar el servidor backend en [`backend/src/index.ts`](../../backend/src/index.ts) y accesible vía `POST /api/buyer/evaluations/recover`. |
| **Sincronización Mart en QA** | **DESACTIVADA** | `MartSyncService.isSyncEnabled()` mantiene la sincronización inactiva salvo presencia de `ENABLE_MART_SYNC=true`. |

### 2.1 Pendientes Prioritarios en Revisión

1. **Distinción entre recuperación post-commit e interacción posterior de contacto ya convertido**:
   - *Problema detectado*: La comprobación de recuperación por captación (`BUYER_LEAD:<id_captacion>`) se aplica actualmente de forma genérica al evaluar. Si un paciente que ya fue convertido a LEAD/PAYER envía un mensaje nuevo (ej. una consulta informativa sobre horarios o doctores), el sistema reutiliza su captación histórica y asume erróneamente que se trata de una caída post-commit pendiente de recuperar, retornando `CONVERSION_LEAD` en lugar de responder a su consulta.
   - *Solución requerida*: Debe distinguir la operación interrumpida de una interacción posterior, vinculando la detección a la interacción en curso o comprobando si la persona ya se encuentra en etapas avanzadas con una interacción nueva que requiere evaluación independiente.

2. **Protección de `Idempotency-Key` frente a registros HTTP simultáneos**:
   - *Problema detectado*: La verificación actual consulta la base de datos antes de registrar. Si dos peticiones HTTP con la misma `Idempotency-Key` llegan exactamente en el mismo milisegundo (concurrencia de red), ambas podrían superar la comprobación previa antes de que la primera haga commit en SQL Server.
   - *Solución requerida*: Incorporar cerrojo en memoria (`inFlightByKey`) y/o restricción de unicidad transaccional para serializar o rechazar con 409 Conflict solicitudes simultáneas con la misma clave.

3. **Inclusión de variables de entorno QA en la configuración**:
   - *Requerimiento*: Añadir explícitamente `QA_ENV=true` y `DISABLE_MART_SYNC=true` al ejemplo de configuración QA y plantilla de variables para garantizar aislamiento respecto al data mart y comportamiento estricto en pruebas.

---

## 3. Estructura de Componentes y Enlaces al Código

- **Contrato de Integración y Entrega a LEAD**:  
  [`database/lead_revision/CONTRATO_BUYER_LEAD.md`](../../database/lead_revision/CONTRATO_BUYER_LEAD.md)  
  Documenta el contrato de entrega formal de solicitudes desde BUYER hacia LEAD a través de `dbo.usp_RegistrarEntradaAgenteLead` y `dbo.EntradasAgenteLead`.

- **Propuesta de Esquema Compartido BUYER <-> LEAD**:  
  [`database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql`](../../database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql)  
  Script SQL reproducible con guardas de seguridad unificadas para entornos QA (`NexoSalud_LeadEnsayoFinal` y `NexoSalud_LeadPruebas`).

- **Función Interna de Entrada LEAD (`registerLeadIntake`)**:  
  [`backend/src/services/leadIntake.ts`](../../backend/src/services/leadIntake.ts)  
  Ejecuta la entrega desacoplada fuera de la transacción SQL contra `dbo.usp_RegistrarEntradaAgenteLead`.

- **Clasificador Semántico Independiente**:  
  [`backend/src/services/buyerMessageClassifier.ts`](../../backend/src/services/buyerMessageClassifier.ts)  
  Implementa la clasificación con `@google/genai` (v3.1.0), modelo `gemini-3.5-flash-lite`, timeout con `AbortSignal`, reintentos exponenciales con jitter y métricas censuradas (`intentosRealizados`, `duracionTotalMs`).

- **Servicio de Evaluación y Persistencia Buyer**:  
  [`backend/src/services/buyerEvaluationService.ts`](../../backend/src/services/buyerEvaluationService.ts)  
  Orquestador central: resuelve solicitudes explícitas con [`resolveExplicitSolicitud`](../../backend/src/services/buyerEvaluationService.ts#L45), detecta caídas post-commit, enriquece prompts conversacionales, ejecuta la conversión formal y gestiona la recuperación automática.

- **Definiciones de Tipos y Contratos**:  
  [`backend/src/types/buyer.ts`](../../backend/src/types/buyer.ts)  
  Contiene interfaces de clasificación, catálogo de servicios, métricas de auditoría, acciones (`SOLICITUD_PENDIENTE_APERTURA`, `CONSERVA_ETAPA_POSTERIOR`) y contexto conversacional.

- **Rutas API del Módulo Buyer**:  
  [`backend/src/routes/buyer.routes.ts`](../../backend/src/routes/buyer.routes.ts)  
  Implementa `POST /buyer/register` con validación estricta de `Idempotency-Key` (409 ante conflicto de hash), persistencia transaccional y endpoints de recuperación (`POST /buyer/evaluations/recover`) y reintento (`POST /buyer/evaluations/:id/retry`).

- **Interfaz Pública y Formulario de Captación**:  
  [`frontend/src/modules/buyer/components/landing/BuyerIntakeForm.tsx`](../../frontend/src/modules/buyer/components/landing/BuyerIntakeForm.tsx)  
  Formulario de admisión con continuación interactiva de aclaraciones en dos turnos (`id_interaccion_previa`), diferenciación de reenvíos idénticos y reemplazo de promesas rígidas por textos configurables.

- **Pruebas Automatizadas de Integración**:  
  [`backend/tests/buyerIntegrationFlow.test.ts`](../../backend/tests/buyerIntegrationFlow.test.ts)  
  Suite completa con 20 casos de prueba protegidos con la bandera `RUN_SQL_TESTS=true` y guarda `DB_NAME()`.

---

## 4. Orden de Instalación y Configuración QA

### 4.1 Configuración de Variables de Entorno

Crear el archivo `backend/.env` basado en `backend/.env.example`:

```ini
SQLSERVER_URL="sqlserver://localhost:1433;database=NexoSalud_LeadEnsayoFinal;integratedSecurity=true;trustServerCertificate=true;"
OLTP_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSalud_LeadEnsayoFinal;Trusted_Connection=yes;TrustServerCertificate=yes;"
MART_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSalud_Mart;Trusted_Connection=yes;TrustServerCertificate=yes;"
PORT=3001
DUNNING_ENABLED=false
QA_ENV=true
DISABLE_MART_SYNC=true
GEMINI_API_KEY="tu_clave_gemini_api_aqui"
```

### 4.2 Despliegue de Esquema en Base de Datos QA

Ejecutar desde la raíz del proyecto en PowerShell:

```powershell
sqlcmd -S localhost -d NexoSalud_LeadEnsayoFinal -E -i database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql
```

### 4.3 Compilación del Proyecto

```powershell
# Compilación Backend (TypeScript)
npm --prefix backend run build

# Compilación Frontend (TypeScript + Vite)
npm --prefix frontend run build
```

### 4.4 Ejecución de Pruebas

```powershell
# Pruebas unitarias simuladas (sin tocar SQL ni Gemini)
npm --prefix frontend test

# Pruebas del clasificador semántico
npm --prefix frontend test -- backend/tests/buyerMessageClassifier.test.ts

# Pruebas integradas SQL contra la base de datos QA
$env:RUN_SQL_TESTS='true'; npm --prefix frontend test -- backend/tests/buyerIntegrationFlow.test.ts
Remove-Item Env:\RUN_SQL_TESTS
```

### 4.5 Inicio del Backend

```powershell
npm --prefix backend run dev
# Al arrancar, BuyerEvaluationService.recoverPendingEvaluations() ejecuta la recuperación automática de pendientes.
```

---

## 5. Aclaración de Cambios de Esquema

### 5.1 Cambios YA Aplicados en QA (`NexoSalud_LeadEnsayoFinal`)
1. **`dbo.Interacciones.id_solicitud INT NULL`**:  
   Permite vincular el mensaje con la oportunidad comercial generada.
2. **`dbo.DecisionesIA.id_captacion INT NULL` e `id_interaccion INT NULL`**:  
   Asegura la trazabilidad directa entre la auditoría de IA y la interacción del paciente.
3. **`dbo.EntradasAgenteLead`**:  
   Tabla de recepción formal para LEAD (`id_solicitud` PK, `id_evento_etapa` UK, `id_captacion`, `id_persona`, `fecha_registro_utc`).
4. **`dbo.usp_RegistrarEntradaAgenteLead`**:  
   Procedimiento almacenado de entrega con cerrojo `UPDLOCK, HOLDLOCK` y comprobación estricta de evento `BUYER_LEAD:<id_captacion>`.

### 5.2 Cambios que Requieren Coordinación con LEAD para Producción
1. **Inclusión en scripts de migración baseline de LEAD**:  
   Asegurar que `database/lead_revision/INSTALAR_LEAD_COMPLETO.sql` contenga formalmente la columna `id_solicitud` en `dbo.Interacciones`.
2. **Homologación de columnas en `dbo.Solicitudes`**:  
   En `schema.prisma`, alinear la definición de `Solicitudes` con las columnas físicas existentes en producción (`fecha_solicitud` en lugar de `fecha_creacion`).
3. **Flujo de apertura para contactos avanzados**:  
   Consensuar el procedimiento mediante el cual el equipo LEAD toma las solicitudes marcadas como `SOLICITUD_PENDIENTE_APERTURA` y las convierte en una oportunidad de atención secundaria o recurrente.

---

## 6. Evidencia de Verificación y Casos de Prueba

### Resultados Globales

- **Compilación Backend (`tsc`)**: **EXIT 0** (0 errores)
- **Compilación Frontend (`vite build`)**: **EXIT 0** (Bundle generado en `dist/`)
- **Suite Vitest Completa (`npm --prefix frontend test`)**: **16 pasados, 1 omitido (76 pruebas pasadas, 0 fallidas)**
- **Suite Integrada SQL (`RUN_SQL_TESTS=true`)**: **1 pasado (19 pruebas pasadas, 1 omitida condicional)**

### Detalle de los 19 Casos Validados en SQL (`buyerIntegrationFlow.test.ts`)

1. `Registro en BUYER`: nuevo contacto permanece estrictamente en `BUYER` antes de evaluar intención. (**PASS**)
2. `Clasificación informativa`: consulta de horarios permanece en `BUYER` sin crear solicitud. (**PASS**)
3. `Aclaración con contexto`: mensaje vago genera orientación cordial y preserva entrada. (**PASS**)
4. `Conversión válida`: intención explícita convierte a `LEAD` vía `dbo.usp_ConvertirBuyerALead` y registra en `dbo.EntradasAgenteLead`. (**PASS**)
5. `Requisitos incumplidos`: sin autorización de contacto, la reserva permanece en `BUYER`. (**PASS**)
6. `Reintento del mismo mensaje`: `retryEvaluationByInteraction` procesa el mismo ID sin duplicar interacciones. (**PASS**)
7. `Contactos avanzados sin evidencia`: nueva solicitud permanece pendiente de apertura (`SOLICITUD_PENDIENTE_APERTURA`). (**PASS**)
8. `Contactos avanzados con evidencia`: vincula solicitud abierta previa (`CONSERVA_ETAPA_POSTERIOR`). (**PASS**)
9. `Recuperación tras reinicio`: reanuda evaluaciones `PENDIENTE` en `dbo.DecisionesIA` tras caída del servicio. (**PASS**)
10. `Entrega repetida a LEAD`: llamadas sucesivas a `registerLeadIntake` son estrictamente idempotentes. (**PASS**)
11. `Servicio desconocido`: intención de reserva sin tratamiento del catálogo solicita aclaración sin sustituir por servicio 1. (**PASS**)
12. `Aclaraciones en dos turnos`: turno 1 pide aclaración y turno 2 con `id_interaccion_previa` resuelve y convierte a `LEAD`. (**PASS**)
13. `Reenvíos concurrentes`: peticiones simultáneas del mismo mensaje son serializadas sin duplicar registros. (**PASS**)
14. `Rutas HTTP`: `POST /buyer/register` y `POST /buyer/evaluations/recover` responden con códigos y contrato esperado. (**PASS**)
15. `Caída post-commit`: detecta conversión previa en SQL (`BUYER_LEAD:<id_captacion>`), recupera `id_solicitud`, completa `registerLeadIntake` sin reclasificar en Gemini y actualiza la interacción. (**PASS**)
16. `Reconstrucción de contexto`: reintento recupera servicio declarado y enriquece prompt con mensaje anterior, pregunta del agente y respuesta actual. (**PASS**)
17. `Validación de pertenencia`: rechaza contexto cruzado cuando la interacción previa pertenece a otra persona. (**PASS**)
18. `Resolución explícita de solicitud`: vincula solicitud legítima comprobando pertenencia; referencias dudosas (inexistentes o de otro usuario) quedan como `SOLICITUD_PENDIENTE_APERTURA`. (**PASS**)
19. `Idempotency-Key estricto`: misma clave con contenido distinto se rechaza con **409 Conflict**; misma clave con mismo contenido devuelve resultado persistido (replayed); claves distintas permiten mensajes iguales. (**PASS**)

### 6.3 Próxima Prueba Planificada

- **Caso 20 (Próxima Implementación)**: *Consulta informativa nueva de una persona en PAYER con conversión anterior.*
  - **Contexto**: Un paciente preexistente que ya completó la conversión (`BUYER` → `LEAD`) y actualmente se encuentra en la etapa avanzada `PAYER` envía una nueva interacción puramente informativa (ej. "¿Atienden emergencias los domingos?").
  - **Comportamiento esperado**:
    1. El sistema no debe confundir la existencia de la conversión previa en la captación con una caída post-commit pendiente de recuperar.
    2. Debe clasificar la intención del nuevo mensaje mediante Gemini (`SOLO_CONSULTA`).
    3. Debe registrar la interacción en `dbo.Interacciones` y devolver la orientación informativa de Buyer.
    4. **Debe conservar intacta la etapa `PAYER` del paciente** y **evitar devolver `CONVERSION_LEAD`**.
