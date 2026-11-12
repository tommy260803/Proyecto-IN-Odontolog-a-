# Guía Principal de Relevo Técnico para Germain: Agente Buyer

**Documento principal de relevo para retomar el desarrollo del Agente Buyer.**
**Rama exclusiva de trabajo:** `feature/buyer-agent-gemini`
**Fecha de entrega:** 12 de noviembre de 2026

---

## 1. Estado del Avance

### 1.1 Declaración de Estado
> **ESTADO: IMPLEMENTADO PARCIALMENTE — PENDIENTE DE VALIDACIÓN QA.**
> El desarrollo y verificación de Buyer se realizan de forma **independiente**. La integración final de agentes con LEAD está formalmente aplazada hasta consolidar las pruebas locales de Buyer.

### 1.2 Funcionalidades Implementadas y Verificadas (v1 a v7)
1. **Evaluación Unificada Backend:** La ficha de detalle Buyer (`BuyerDetailView.tsx`) y los endpoints HTTP (`/buyer/:id/evaluate`) consumen la misma fuente de verdad: el clasificador estructurado de Gemini respaldado por `BuyerEvaluationService`. Se eliminaron las discrepancias entre heurísticas frontend y el modelo backend.
2. **Ciclo de Vida de Mensajes y Solicitudes:** Los registros informativos (`SOLO_CONSULTA` o `AMBIGUA`) se persisten exclusivamente en `dbo.Interacciones`, evitando la creación prematura de filas en `dbo.Solicitudes`. La creación de solicitudes comerciales queda reservada a la conversión formal atómica vía `dbo.usp_ConvertirBuyerALead`.
3. **Resolución Determinista del Servicio Declarado:** Se prioriza la preferencia vigente en `dbo.PersonaPreferencias` (con `fecha_fin` activa o nula), seguida de la captación inicial en `dbo.CaptacionesBuyer`, y únicamente como compatibilidad histórica la solicitud. Un servicio declarado no sustituye la intención del paciente.
4. **Matriz de Discrepancias de Horarios:** `detectScheduleDiscrepancy` distingue entre fechas (*"mañana"*) y turnos (*"por la mañana"*), soporta expresiones disyuntivas (*"mañana o tarde"*), valida turnos contra el catálogo real de `dbo.Horarios` (sin asumir IDs fijos 1/2/3) y no declara conflicto si la información es ambigua.
5. **Reintento Idempotente e Historial Auditable:** Decisiones previas en estado `PENDIENTE` bajo el mismo `contextFingerprint` se reutilizan acumulando el contador de intentos (`intentosRealizados`) y registrando el historial cronológico de fallos (`historial_errores`). Si el contexto cambia, la decisión previa se marca como `REEMPLAZADA`.
6. **Repetición Idempotente de Conversión:** Si una interacción ya completó su conversión, reevaluarla devuelve la decisión existente sin invocar a Gemini, conservando la huella (`contextFingerprint`), identificadores de solicitud/evento y estado de entrega.
7. **Recuperación Post-Commit sin Heurísticas de Texto:** Se eliminó `isReservationOriented`. La recuperación tras caídas post-commit SQL se apoya estrictamente en evidencia persistida de pertenencia de la operación (`hasPersistedOperationEvidence`).

### 1.3 Diferencia entre Niveles de Prueba
- **Pruebas Simuladas (Vitest en memoria):** 122 pruebas aprobadas en el test runner oficial (`npm --prefix frontend test`). Utilizan dobles de prueba (`createMockDb`) que emulan transacciones SQL, llamadas a stored procedures y respuestas sintéticas del clasificador (`classifierOverride`).
- **Pruebas SQL Real (Pendiente):** Validación de consultas, bloqueos de concurrencia y ejecución real de `dbo.usp_ConvertirBuyerALead` y `dbo.usp_RegistrarEntradaAgenteLead` contra una instancia viva de Microsoft SQL Server (`NexoSalud_LeadEnsayoFinal`).
- **Pruebas Gemini Real (Pendiente):** Invocación en vivo mediante `@google/genai` con modelo `gemini-3.5-flash-lite`, evaluando latencia, cuota y respuestas del LLM con una `GEMINI_API_KEY` válida.

### 1.4 Commit Base y Trazabilidad de esta Entrega
El trabajo previo de Germain tuvo como último commit `3e4cd2d` (*"feat: Agregar servicio de evaluación dental y casos de prueba relacionados"*), precedido por `9956065` y `2fff156`.

Para identificar con precisión el hash exacto del commit que contiene esta entrega sin inventarlo antes de su publicación, ejecuta desde la raíz:

```powershell
git log -1 --format=%H -- docs/agentes/GUIA_RELEVO_GERMAIN_BUYER.md
```

---

## 2. Actualizar el Clon Local

Sigue estrictamente estos pasos numerados para sincronizar el repositorio sin sobrescribir trabajo ajeno:

1. **Comprobar estado de cambios locales:**
   ```powershell
   git status --short
   ```
   Si tienes cambios no confirmados, resguárdalos con `git stash push -m "wip-germain"` antes de continuar.
2. **Descargar los últimos cambios remotos:**
   ```powershell
   git fetch origin
   ```
3. **Cambiar a la rama oficial de Buyer:**
   ```powershell
   git switch feature/buyer-agent-gemini
   ```
4. **Sincronizar mediante avance rápido exclusivo (`fast-forward`):**
   ```powershell
   git pull --ff-only origin feature/buyer-agent-gemini
   ```
   > [!WARNING]
   > No utilices `git push --force`, no descartes cambios locales con `git reset --hard` ni crees ramas paralelas (ej. `feature/buyer-germain`). Todo el trabajo debe converger en `feature/buyer-agent-gemini`.
5. **Verificar el commit recibido en HEAD:**
   ```powershell
   git rev-parse HEAD
   git log -3 --oneline
   ```

---

## 3. Preparación del Entorno

### 3.1 Versiones Requeridas
Según las declaraciones en [frontend/package.json](../../frontend/package.json) (`engines.node: "^22.13.0 || ^24.0.0 || >=26.0.0"`):
- **Node.js:** Versión 22.13.0+ LTS o 24.x LTS (verificado con v24.15.0).
- **npm:** Versión 10+ u 11+ (verificado con v11.12.1).
- **Sistema Operativo:** Windows con PowerShell 5.1 o PowerShell 7+.

### 3.2 Instalación de Dependencias
Ejecuta desde la raíz del proyecto:

```powershell
npm --prefix backend install
npm --prefix frontend install
```

### 3.3 Generación del Cliente Prisma y Compilación
Prisma requiere generar el cliente a partir del esquema [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma):

```powershell
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix frontend run build
```

### 3.4 Configuración de Variables de Entorno (`backend/.env`)
Crea o edita el archivo `backend/.env` basándote en [backend/.env.example](../../backend/.env.example). **Nunca agregues credenciales reales a Git**:

```env
# Conexión principal de Prisma a la base de prueba QA
SQLSERVER_URL="sqlserver://localhost:1433;database=NexoSalud_LeadEnsayoFinal;integratedSecurity=true;trustServerCertificate=true;"

# Conexión ODBC para DataMart y sincronización analítica (backend/src/db/mart.ts)
OLTP_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSalud_LeadEnsayoFinal;Trusted_Connection=yes;TrustServerCertificate=yes;"
MART_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSalud_Mart;Trusted_Connection=yes;TrustServerCertificate=yes;"

# Puerto del backend (escucha en 3001 por defecto según backend/src/index.ts)
PORT=3001

# Parámetros operativos para pruebas controladas
QA_ENV=true
DISABLE_MART_SYNC=true
DUNNING_ENABLED=false

# Clave de Gemini para pruebas reales (mantener privada)
GEMINI_API_KEY="AIzaSy..."
```

Verifica que Git ignore el archivo de entorno:
```powershell
git check-ignore backend/.env
```

### 3.5 Comandos de Inicio y Puertos
- **Backend (Puerto 3001):**
  ```powershell
  # Modo desarrollo con recarga automática:
  npm --prefix backend run dev
  # O ejecución de compilados:
  npm --prefix backend start
  ```
- **Frontend (Puerto 5173):**
  ```powershell
  npm --prefix frontend run dev
  ```

---

## 4. Copia QA de SQL Server (`NexoSalud_LeadEnsayoFinal`)

> [!IMPORTANT]
> - Utiliza `NexoSalud_LeadEnsayoFinal` si ya está creada y contiene el poblamiento previo. Si ya existe y es compatible, **no repitas la restauración**.
> - No borres ni sobrescribas la base de datos original (`NexoSaludDB`).
> - No necesitas la copia idéntica ni las mismas contraseñas de Daniel; cada desarrollador gestiona su copia QA local.
> - `QA_ENV=true` es un indicador lógico de configuración: **no cambia mágicamente la base de datos de conexión**; las variables `SQLSERVER_URL` y `OLTP_CONNECTION_STRING` deben apuntar explícitamente a `NexoSalud_LeadEnsayoFinal`.
> - En [backend/src/db.ts](../../backend/src/db.ts), la variable `TEST_SQLSERVER_URL` tiene **máxima prioridad**: si está definida en el entorno, anula a `SQLSERVER_URL`.

### 4.1 Creación de la Copia QA en SSMS (Paso a Paso)

Si no dispones de la base `NexoSalud_LeadEnsayoFinal`, sigue este procedimiento en SQL Server Management Studio:

1. **Crear respaldo de solo copia (COPY_ONLY):**
   - En SSMS, clic derecho sobre la base origen (ej. `NexoSaludDB`) $\rightarrow$ *Tasks* $\rightarrow$ *Back Up...*
   - Backup type: **Full**.
   - Marcar la casilla **Copy-only backup** (evita alterar la secuencia de backups LSN de la base principal).
   - Destino: Seleccionar un único archivo `.bak` (ej. `C:\Backups\NexoSaludDB_Base.bak`).
   - Clic en *OK*.
2. **Restaurar con nuevo nombre:**
   - Clic derecho en *Databases* $\rightarrow$ *Restore Database...*
   - Seleccionar *Device* y ubicar `C:\Backups\NexoSaludDB_Base.bak`.
   - En *Destination Database*, escribir explícitamente: `NexoSalud_LeadEnsayoFinal`.
3. **Reubicar archivos físicos (MOVE):**
   - Ir a la pestaña **Files** (Archivos).
   - Marcar **Relocate all files to folder** o cambiar manualmente las rutas de destino:
     - Archivo de datos: `.../DATA/NexoSalud_LeadEnsayoFinal.mdf`
     - Archivo de registro: `.../DATA/NexoSalud_LeadEnsayoFinal_log.ldf`
     > [!CAUTION]
     > Deben tener nombres y rutas físicas distintos a los de la base origen para evitar colisión de archivos.
4. **Desactivar la copia del final del registro (Tail-log backup):**
   - Ir a la pestaña **Options** (Opciones).
   - **Desmarcar** la opción *"Take tail-log backup before restore"* (Realizar copia del final del registro antes de restaurar).
   - *¿Por qué?* SSMS intenta respaldar el log activo de la base de destino antes de sobrescribirla. Al tratarse de una base nueva independiente, este intento falla con el error `BACKUP LOG cannot be performed because there is no current database backup`. Al desmarcarlo, se evita el error.
5. **Finalizar con RECOVERY:**
   - En *Recovery state*, asegurar que esté seleccionado **RESTORE WITH RECOVERY** (deja la base lista para su uso operativo).
   - Clic en *OK*.

*Equivalente en script T-SQL:*
```sql
BACKUP DATABASE [NexoSaludDB]
TO DISK = 'C:\Backups\NexoSaludDB_Base.bak'
WITH COPY_ONLY, FORMAT, INIT;
GO

RESTORE DATABASE [NexoSalud_LeadEnsayoFinal]
FROM DISK = 'C:\Backups\NexoSaludDB_Base.bak'
WITH
    MOVE 'NexoSaludDB' TO 'C:\SQLData\NexoSalud_LeadEnsayoFinal.mdf',
    MOVE 'NexoSaludDB_log' TO 'C:\SQLData\NexoSalud_LeadEnsayoFinal_log.ldf',
    RECOVERY,
    REPLACE;
GO
```

### 4.2 Comprobaciones SELECT de Solo Lectura

Ejecuta estas consultas en SSMS para verificar el servidor, base y componentes necesarios:

```sql
USE NexoSalud_LeadEnsayoFinal;
GO

-- 1. Servidor y base actual
SELECT @@SERVERNAME AS servidor, DB_NAME() AS base_actual;

-- 2. Tablas obligatorias
SELECT TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN (
    'Personas', 'CaptacionesBuyer', 'Interacciones', 'DecisionesIA',
    'PersonaPreferencias', 'Horarios', 'Servicios', 'Solicitudes',
    'EventosEtapa', 'Etapas', 'EntradasAgenteLead'
);

-- 3. Columnas obligatorias de DecisionesIA
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DecisionesIA'
  AND COLUMN_NAME IN ('id_decision', 'agente', 'id_persona', 'id_captacion', 'id_interaccion', 'entrada', 'decision', 'accion', 'requiere_revision', 'resultado_revision');

-- 4. Procedimientos almacenados requeridos
SELECT ROUTINE_NAME, ROUTINE_TYPE, CREATED, LAST_ALTERED
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_NAME IN ('usp_ConvertirBuyerALead', 'usp_RegistrarEntradaAgenteLead');

-- 5. Catálogo de servicios activos
SELECT id_servicio, nombre, activo
FROM dbo.Servicios
WHERE activo = 1;

-- 6. Catálogo de horarios
-- NOTA: La tabla dbo.Horarios NO contiene columna 'nombre'; solo dia_semana, hora_inicio, hora_fin
SELECT id_horario, dia_semana, hora_inicio, hora_fin
FROM dbo.Horarios;
```

### 4.3 Scripts Faltantes y Orden Comprobado
> [!NOTE]
> Restaurar un respaldo no incorpora automáticamente cambios de esquema posteriores del repositorio. Si falta algún objeto, aplica los scripts comprobados en este orden estricto:

1. **Paquete OLTP Base:** Si la base carece del esquema Buyer/LEAD, revisar y aplicar [database/lead_revision/APLICAR_BUYER_LEAD.sql](../../database/lead_revision/APLICAR_BUYER_LEAD.sql).
2. **Esquema Compartido y Entrada LEAD:** Para asegurar las columnas `id_solicitud` en `Interacciones`, `id_captacion`/`id_interaccion` en `DecisionesIA` y el procedimiento `dbo.usp_RegistrarEntradaAgenteLead`, aplicar [database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql](../../database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql).
3. **Verificación:** Ejecutar [database/lead_revision/VERIFICAR_OLTP_INSTALADO.sql](../../database/lead_revision/VERIFICAR_OLTP_INSTALADO.sql).

---

## 5. Pendientes de Desarrollo: Ubicación, Diagnóstico y Criterios de Aceptación

### 5.1 Recuperación Automática: Inclusión de `CONVERSION_EN_CURSO`
- **Ubicación:** [backend/src/services/buyerEvaluationService.ts](../../backend/src/services/buyerEvaluationService.ts#L1675-L1686), método `recoverPendingEvaluations`.
- **Diagnóstico del fallo:** Actualmente el método solo busca decisiones con `decision: { contains: '"estado":"PENDIENTE"' }` o `accion: 'REINTENTO_PENDIENTE'`. Si el servidor backend cae o se reinicia justo cuando una decisión fue marcada como `CONVERSION_EN_CURSO` (antes o después del commit de `usp_ConvertirBuyerALead`), el recuperador automático al arranque (`src/index.ts`) la omite por completo.
- **Corrección requerida:**
  Agregar al filtro `OR` de `pendingDecisions`:
  ```ts
  { decision: { contains: '"estado":"CONVERSION_EN_CURSO"' } },
  ```
- **Prueba y Aceptación:**
  1. Insertar una decisión sintética con `estado: 'CONVERSION_EN_CURSO'` y clave de operación persistida.
  2. Ejecutar `BuyerEvaluationService.recoverPendingEvaluations()` antes del commit SQL: debe evaluar y completar la conversión.
  3. Ejecutarlo después del commit SQL pero con interacción pendiente: debe recuperar `id_solicitud` y `id_evento_etapa` sin duplicar filas.

### 5.2 Recuperación Post-Commit y Clave de Operación en SQL Real
- **Ubicación:** [backend/src/services/buyerEvaluationService.ts](../../backend/src/services/buyerEvaluationService.ts#L684-L770) y [database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql](../../database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql#L78-L79).
- **Diagnóstico:** `Paso B` en el servicio utiliza `clave_operacion_buyer = BUYER_LEAD:${id_captacion}:${id_interaccion}` (o `BUYER_LEAD:${id_captacion}`). En `usp_RegistrarEntradaAgenteLead`, la consulta SQL busca `e.clave_operacion_buyer = CONCAT('BUYER_LEAD:', c.id_captacion)`. Debe verificarse en la base real que ambas claves coincidan o que el SP soporte la clave con sufijo de interacción.
- **Criterio de Aceptación:** Una consulta nueva de un contacto no debe apropiarse de conversiones históricas bajo ninguna circunstancia.

### 5.3 Concurrencia HTTP e Idempotencia Real
- **Ubicación:** [backend/src/routes/buyer.routes.ts](../../backend/src/routes/buyer.routes.ts#L120-L165).
- **Diagnóstico:** La verificación de `Idempotency-Key` realiza una consulta previa `findFirst` antes de la transacción de inserción. Si dos peticiones HTTP con idéntica clave llegan en paralelo en el mismo milisegundo, ambas superan la verificación previa antes de que la primera haga commit, creando dos interacciones duplicadas.
- **Criterio de Aceptación:**
  - Dos envíos simultáneos con la misma `Idempotency-Key` y mismo cuerpo deben reutilizar la interacción y la misma evaluación.
  - La misma clave con cuerpo distinto debe responder HTTP `409 Conflict`.
  - La deduplicación de persona no debe confundirse con la idempotencia del formulario.
  - La protección debe ser a nivel de base de datos o mutex distribuido, ya que un bloqueo solo en memoria local (`Map`) no cubre despliegues multi-proceso o reinicios de Node.js.

### 5.4 Diagnóstico de Regresión General al Ejecutar la Suite
- **Ubicación:** Raíz del proyecto al ejecutar test runners.
- **Diagnóstico:** Si se ejecuta bare `npx vitest run` desde la raíz, fallan 5 suites de frontend con `ReferenceError: document is not defined` y `Cannot find package '@/domain/enums'`. Esto ocurre porque Vitest por defecto corre en entorno `node` y no lee la configuración de Vite del frontend.
- **Estado Real:** La suite se encuentra **100% aprobada** (122 pruebas pasando) cuando se ejecuta mediante el comando oficial del proyecto:
  ```powershell
  npm --prefix frontend test
  ```
  Este comando invoca `vitest run --root .. --config frontend/vite.config.ts`, cargando el entorno `jsdom`, el alias `@/` y los mocks de DOM de `frontend/src/tests/setup.ts`.

### 5.5 Otros Problemas Conocidos Consolidados
- **Ejecución Periódica de Reintentos:** `recoverPendingEvaluations` corre una única vez al iniciar el backend (`src/index.ts`). No existe actualmente un temporizador recurrente (cron job o agenda periódica) para reintentar evaluaciones que sigan en `PENDIENTE` por caídas posteriores.
- **Referencias Dudosas a Solicitudes:** Cuando un contacto en etapas avanzadas (`PAYER`, `CUSTOMER`, `TURNED`) envía una consulta sobre una solicitud pero no se puede comprobar fehacientemente su pertenencia, el sistema lo etiqueta como `SOLICITUD_PENDIENTE_APERTURA`. Queda pendiente definir con el equipo de LEAD el flujo administrativo para la apertura manual o asignación de solicitudes en este estado.

---

## 6. Pruebas en Orden de Ejecución

> **Regla de Ejecución:** Comprobar primero conexión y esquema $\rightarrow$ luego pruebas simuladas $\rightarrow$ luego SQL real $\rightarrow$ finalmente Gemini real.

### Caso 1: Consulta Informativa sin Solicitud Comercial (Existente Reproducible)
- **Preparación:** Persona en `BUYER` sin citas previas.
- **Acción:** `POST /buyer` con mensaje: *"¿Cuánto cuesta la limpieza dental y qué horarios tienen?"*.
- **Resultado Esperado:** Estado `COMPLETADA`, acción `SOLO_CONSULTA`, etapa final `BUYER`. `id_solicitud` es null.
- **Consulta SQL:**
  ```sql
  SELECT COUNT(*) FROM dbo.Solicitudes WHERE id_persona = @id_persona; -- Esperado: 0
  SELECT resultado FROM dbo.Interacciones WHERE id_persona = @id_persona; -- Esperado: 'Consulta Informativa'
  ```
- **Evidencia:** Registro en `dbo.DecisionesIA` con `accion = 'SOLO_CONSULTA'`.
- **Limpieza:** `DELETE FROM dbo.Interacciones WHERE id_persona = @id_persona; DELETE FROM dbo.Personas WHERE id_persona = @id_persona;`

### Caso 2: Reserva Explícita con Servicio Activo (Existente Reproducible)
- **Preparación:** Persona en `BUYER` con datos completos y consentimiento (`autoriza_contacto = 1`).
- **Acción:** Mensaje: *"Quiero reservar una cita para ortodoncia invisible mañana"*.
- **Resultado Esperado:** Acción `CONVERSION_LEAD`, etapa final `LEAD`, crea fila en `dbo.Solicitudes` y evento en `dbo.EventosEtapa`. Entrega a LEAD confirmada.
- **Consulta SQL:**
  ```sql
  SELECT s.id_solicitud, e.id_evento_etapa, el.id_solicitud AS lead_entry
  FROM dbo.Solicitudes s
  JOIN dbo.EventosEtapa e ON e.id_solicitud = s.id_solicitud
  LEFT JOIN dbo.EntradasAgenteLead el ON el.id_solicitud = s.id_solicitud
  WHERE s.id_persona = @id_persona;
  ```
- **Evidencia:** Fila en `dbo.EntradasAgenteLead`.

### Caso 3: Ambigüedad y Aclaración (Existente Reproducible)
- **Preparación:** Contacto nuevo. Mensaje vago: *"Hola, buenas tardes"*.
- **Acción:** `POST /buyer/:id/evaluate`.
- **Resultado Esperado:** Acción `ACLARACION`, intención `AMBIGUA`, aclaración generada educadamente solicitando más información.

### Caso 4: Preferencias Editadas y Evaluación Desactualizada (Existente Reproducible)
- **Preparación:** Contacto con preferencia horaria inicial en turno Mañana. Mensaje pide turno tarde.
- **Acción:** Evaluar interacción.
- **Resultado Esperado:** Detecta discrepancia de horarios (`scheduleDiscrepancy.detectada = true`), genera aclaración de horarios y no modifica la preferencia de forma silenciosa.

### Caso 5: Mensaje Completo e Historial en Contexto Conversacional (Existente Reproducible)
- **Preparación:** Contacto con mensaje previo de aclaración.
- **Acción:** Paciente responde: *"En el turno tarde por favor"*.
- **Resultado Esperado:** Prompt enriquecido con mensaje anterior, pregunta del agente y respuesta actual. Clasificación exitosa.

### Caso 6: Reintento Fallo-Fallo-Éxito sobre la Misma Interacción (Existente Reproducible)
- **Preparación:** Simulación de dos errores 503 consecutivos de Gemini seguidos de una respuesta exitosa.
- **Acción:** Invocar `evaluateBuyerInteraction` 3 veces con el mismo `id_interaccion`.
- **Resultado Esperado:** Misma fila de decisión (`id_decision`), `intentosRealizados = 3`, `historial_errores` contiene los 2 mensajes de error previos, estado final `COMPLETADA`.

### Caso 7: Recarga de Ficha sin Llamada Automática a Gemini (Existente Reproducible)
- **Preparación:** Interacción evaluada previamente (`COMPLETADA`).
- **Acción:** Recargar la ficha (`GET /buyer/:id`).
- **Resultado Esperado:** Retorna la decisión persistida; cero llamadas a Gemini (idempotencia pura).

### Caso 8: Contacto en PAYER con Consulta Nueva (Existente Reproducible)
- **Preparación:** Persona en etapa `PAYER` con conversión previa en `dbo.EventosEtapa`. Mensaje: *"¿Qué costo tiene el control mensual?"*.
- **Acción:** `POST /buyer/:id/evaluate`.
- **Resultado Esperado:** Acción `SOLO_CONSULTA`, etapa final `PAYER`, no se apropia de la conversión antigua ni cambia a `LEAD`.

### Caso 9: Conversión Repetida sin Duplicados (Existente Reproducible)
- **Preparación:** Conversión previa confirmada (`id_solicitud = 501`).
- **Acción:** Reenviar evaluación idéntica.
- **Resultado Esperado:** Devuelve `id_solicitud = 501` y mismo `id_evento_etapa`. No inserta nuevas filas en `dbo.Solicitudes`.

### Caso 10: Caída Post-Commit y Recuperación tras Reinicio (Por Probar en SQL Real)
- **Preparación:** Simular caída del proceso Node.js matando el proceso tras el commit de `usp_ConvertirBuyerALead` (decisión queda en `CONVERSION_EN_CURSO`).
- **Acción:** Iniciar el backend. El recuperador automático (tras implementar 5.1) o un reintento manual debe procesar la interacción.
- **Resultado Esperado:** Recupera `id_solicitud` y `id_evento_etapa` existentes, actualiza `Interacciones` y finaliza entrega en `EntradasAgenteLead`. Cero filas duplicadas en `Solicitudes`.

### Caso 11: Envíos HTTP Simultáneos con Misma Idempotency-Key (Por Crear / Probar)
- **Preparación:** Script en PowerShell con dos llamadas asíncronas simultáneas (`Invoke-RestMethod` en paralelo) con cabecera `Idempotency-Key: test-uuid-1234`.
- **Acción:** Enviar concurrentemente hacia `POST /buyer`.
- **Resultado Esperado:** Ambas peticiones completan con código 200/201 devolviendo el mismo `id_persona`, `id_captacion` e `id_interaccion`.

---

## 7. Cierre del Trabajo y Entrega

Al finalizar tus pruebas y correcciones:
1. **Registrar:** Commit probado, destino de base de datos (`SELECT @@SERVERNAME, DB_NAME()`), comandos ejecutados y estado de pruebas.
2. **Commits pequeños:** Realiza commits atómicos en la misma rama `feature/buyer-agent-gemini` con mensajes descriptivos bajo convención conventional commits (`feat(buyer): ...`, `fix(buyer): ...`).
3. **Publicar:** Ejecuta `git push origin feature/buyer-agent-gemini` (sin `--force`).
4. **Documentar:** Actualiza [ENTREGA_AGENTE_BUYER.md](ENTREGA_AGENTE_BUYER.md) resumiendo los avances logrados y los pendientes restantes.
5. **No modificar el informe académico** en este encargo.
