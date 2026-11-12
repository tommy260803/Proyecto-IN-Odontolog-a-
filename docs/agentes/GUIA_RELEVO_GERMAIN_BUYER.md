# Guía Principal de Relevo Técnico para Germain: Agente Buyer

**Documento principal de relevo para retomar el desarrollo del Agente Buyer.**
**Rama exclusiva de trabajo:** `feature/buyer-agent-gemini`
**Fecha de entrega:** 12 de noviembre de 2026

---

## 1. Estado del Avance

### 1.1 Declaración de Estado
> **ESTADO: IMPLEMENTADO PARCIALMENTE — PENDIENTE DE VALIDACIÓN QA.**
> El desarrollo y verificación de Buyer se realizan de forma **independiente**. La integración final de agentes con LEAD está formalmente aplazada hasta consolidar las pruebas locales de Buyer.

### 1.2 Funcionalidades implementadas y comprobadas con simulaciones (v1 a v7)
1. **Evaluación Unificada Backend:** La ficha de detalle Buyer (`BuyerDetailView.tsx`) y los endpoints HTTP (`/buyer/:id/evaluate`) consumen la misma fuente de verdad: el clasificador estructurado de Gemini respaldado por `BuyerEvaluationService`. Se eliminaron las discrepancias entre heurísticas frontend y el modelo backend.
2. **Ciclo de Vida de Mensajes y Solicitudes:** Los registros informativos (`SOLO_CONSULTA` o `AMBIGUA`) se persisten exclusivamente en `dbo.Interacciones`, evitando la creación prematura de filas en `dbo.Solicitudes`. La creación de solicitudes comerciales queda reservada a la conversión formal atómica vía `dbo.usp_ConvertirBuyerALead`.
3. **Resolución Determinista del Servicio Declarado:** Se prioriza la preferencia vigente en `dbo.PersonaPreferencias` (con `fecha_fin` activa o nula), seguida de la captación inicial en `dbo.CaptacionesBuyer`, y únicamente como compatibilidad histórica la solicitud. Un servicio declarado no sustituye la intención del paciente.
4. **Matriz de Discrepancias de Horarios:** `detectScheduleDiscrepancy` distingue entre fechas (*"mañana"*) y turnos (*"por la mañana"*), soporta expresiones disyuntivas (*"mañana o tarde"*), valida turnos contra el catálogo real de `dbo.Horarios` (sin asumir IDs fijos 1/2/3) y no declara conflicto si la información es ambigua.
5. **Reintento Idempotente e Historial Auditable:** Decisiones previas en estado `PENDIENTE` bajo el mismo `contextFingerprint` se reutilizan acumulando el contador de intentos (`intentosRealizados`) y registrando el historial cronológico de fallos (`historial_errores`). Si el contexto cambia, la decisión previa se marca como `REEMPLAZADA`.
6. **Repetición Idempotente de Conversión:** Si una interacción ya completó su conversión, reevaluarla devuelve la decisión existente sin invocar a Gemini, conservando la huella (`contextFingerprint`), identificadores de solicitud/evento y estado de entrega.
7. **Recuperación Post-Commit sin Heurísticas de Texto:** Se eliminó `isReservationOriented`. La recuperación tras caídas post-commit SQL se apoya estrictamente en evidencia persistida de pertenencia de la operación (`hasPersistedOperationEvidence`).

### 1.3 Diferencia entre Niveles de Prueba
- **Pruebas Simuladas (Vitest en memoria):** 122 pruebas aprobadas reportadas por Antigravity en el test runner oficial (`npm --prefix frontend test`). Utilizan dobles de prueba (`createMockDb`) que emulan transacciones SQL, llamadas a stored procedures y respuestas sintéticas del clasificador (`classifierOverride`).
- **Pruebas SQL Real (Pendiente):** Validación de consultas, bloqueos de concurrencia y ejecución real de `dbo.usp_ConvertirBuyerALead` y `dbo.usp_RegistrarEntradaAgenteLead` contra una instancia viva de Microsoft SQL Server (`NexoSalud_LeadEnsayoFinal`).
- **Pruebas Gemini Real (Pendiente):** Invocación en vivo mediante `@google/genai` con modelo `gemini-3.5-flash-lite`, evaluando latencia, cuota y respuestas del LLM con una `GEMINI_API_KEY` válida.

### 1.4 Commit Base y Trazabilidad de esta Entrega
El código y la guía de entrega se publicaron en **`8fa947d8d6cfda140d77df5f1c9e2ff6b83f5f47`**. Las aclaraciones posteriores de este documento no cambian ese código base. Registra por separado `git rev-parse HEAD` (revisión que pruebas) y el commit del último cambio de código.

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
   Si tienes cambios no confirmados, guárdalos primero en un commit propio o con `git stash push -u -m "wip-germain"` (incluye archivos nuevos no ignorados). Anota qué guardaste; no restaures automáticamente ese trabajo sobre los cambios recibidos.
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
npm --prefix backend ci
npm --prefix frontend ci
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
GEMINI_API_KEY="<CLAVE_LOCAL_NO_PUBLICAR>"
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
   - En SSMS, clic derecho sobre la base origen (ej. `NexoSaludDB`) → *Tasks* → *Back Up...*
   - Backup type: **Full**.
   - Marcar la casilla **Copy-only backup** (evita alterar la secuencia de backups LSN de la base principal).
   - Destino: Seleccionar un único archivo `.bak` (ej. `C:\Backups\NexoSaludDB_Base.bak`).
   - Clic en *OK*.
2. **Restaurar con nuevo nombre:**
   - Clic derecho en *Databases* → *Restore Database...*
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

**Antes de restaurar:** comprueba que la carpeta de respaldo exista y que la cuenta del servicio SQL Server tenga permiso de escritura. En el cuadro de destino del respaldo, elimina destinos adicionales y elige un nombre de archivo nuevo. No reutilices ni sobrescribas respaldos anteriores.

No se proporciona un `RESTORE ... WITH REPLACE`: esta operación es para crear una copia nueva. Si `NexoSalud_LeadEnsayoFinal` ya existe, verifica su compatibilidad y úsala; no la sobrescribas.

Para conocer los nombres lógicos reales de los archivos del respaldo, ejecuta esta consulta informativa, sustituyendo la ruta por el archivo que acabas de crear:

```sql
RESTORE FILELISTONLY
FROM DISK = N'C:\\Backups\\NexoSaludDB_Base.bak';
GO
```

Los valores `LogicalName` del resultado no se adivinan a partir del nombre de la base. Si generas el script desde el botón **Script** del asistente de SSMS, revisa que el destino sea la copia QA y que cada archivo físico tenga una ruta distinta de la base origen; incluye todos los archivos de datos y registro que aparezcan. No ejecutes un script que sobrescriba la base original o una copia QA existente.

La opción de tail-log no es necesaria para crear esta copia independiente; desactivarla evita que el asistente intente respaldar el log de un destino que no corresponde al ejercicio. No es una instrucción general para restaurar una base productiva.

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

### 4.3 Esquema incompleto: decidir antes de ejecutar scripts

Restaurar un respaldo no incorpora automáticamente cambios de esquema posteriores del repositorio. Primero registra los objetos que faltan con 4.2. Si el esquema ya es compatible, **no reinstales** ni repuebles.

- Lee [PROCEDIMIENTO_INSTALACION_OLTP.md](../../database/lead_revision/PROCEDIMIENTO_INSTALACION_OLTP.md) como referencia del paquete. Sus comandos sobre `NexoSaludDB` describen otra ventana; **no los copies para esta QA**.
- [APLICAR_BUYER_LEAD.sql](../../database/lead_revision/APLICAR_BUYER_LEAD.sql) exige un esquema base compatible y usa directivas SQLCMD (`:r`, `$(BaseEsperada)`). No es un inicializador para una base vacía ni se ejecuta como SQL normal pegado en SSMS.
- Solo si diagnosticaste la necesidad del paquete completo, detén backend y otros escritores de la copia QA. Desde la raíz, con `sqlcmd` instalado y ajustando servidor/autenticación a tu equipo, el destino debe ser explícitamente QA:

```powershell
sqlcmd -S localhost -E -C -I -b -d NexoSalud_LeadEnsayoFinal -f 65001 -v BaseEsperada=NexoSalud_LeadEnsayoFinal -i database/lead_revision/APLICAR_BUYER_LEAD.sql
```

- Si únicamente faltan enlaces o recepción de LEAD, revisa [PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql](../../database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql) antes de aplicarlo a QA. No instala todos los requisitos del modelo Prisma.
- La recepción existente sigue utilizándose por el backend al convertir, aunque el desarrollo del agente LEAD esté aplazado. Comprueba `EntradasAgenteLead` y `usp_RegistrarEntradaAgenteLead`.
- Tras el paquete completo, el control de lectura es:

```powershell
sqlcmd -S localhost -E -C -I -b -d NexoSalud_LeadEnsayoFinal -f 65001 -v BaseEsperada=NexoSalud_LeadEnsayoFinal -i database/lead_revision/VERIFICAR_OLTP_INSTALADO.sql
```

Anota archivos, commit y salidas. Si un preflight rechaza el esquema, investiga la diferencia: no elimines la guarda ni ejecutes inicializadores destructivos para continuar.

---

## 5. Pendientes de Desarrollo: Ubicación, Diagnóstico y Criterios de Aceptación

### 5.1 Recuperación Automática: Inclusión de `CONVERSION_EN_CURSO`
- **Ubicación:** [backend/src/services/buyerEvaluationService.ts](../../backend/src/services/buyerEvaluationService.ts), método `recoverPendingEvaluations`.
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

### 5.2 Recuperación post-commit e identidad de operación

- **Código:** [buyerEvaluationService.ts](../../backend/src/services/buyerEvaluationService.ts), pasos de recuperación y conversión.
- **SQL publicado:** [init_oltp.sql](../../database/buyer_revision/semana9/init_oltp.sql) registra la clave `BUYER_LEAD:<id_captacion>`. El receptor en [PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql](../../database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql) busca ese mismo formato.
- **Identidad en Buyer:** `operacion_id = BUYER_LEAD:<id_captacion>:<id_interaccion>` se guarda en el JSON de la decisión. Guardarla allí no cambia la clave del evento generada por el procedimiento.
- Verifica las definiciones realmente instaladas mediante `OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_ConvertirBuyerALead'))` y `OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_RegistrarEntradaAgenteLead'))`, siempre en QA.
- La prueba simulada con evento de tres componentes no acredita que SQL lo genere así. Añade la prueba con la clave de dos componentes que genera el SQL actual y con identidad persistida de la interacción.
- Revisa `hasConversionInProgress`: el código permite estado `CONVERSION_EN_CURSO` **o** acción `CONVERSION_LEAD` con identidad/intención. No exige en todos esos caminos que `operacion_id` coincida. No describir esas condiciones como una comprobación inequívoca ya validada.
- **Aceptación:** la misma operación interrumpida recupera solicitud/evento, sin nueva conversión; una interacción distinta conserva su etapa y no se adjudica la conversión histórica. Comprueba contacto en LEAD y en PAYER. Si decides cambiar el formato del evento, actualiza de manera compatible todos sus productores, receptores y pruebas; no lo cambies solo para hacer coincidir un mock.

### 5.3 Concurrencia HTTP e Idempotencia Real
- **Ubicación:** [backend/src/routes/buyer.routes.ts](../../backend/src/routes/buyer.routes.ts).
- **Diagnóstico:** La verificación de `Idempotency-Key` realiza una consulta previa `findFirst` antes de la transacción de inserción. Si dos peticiones HTTP con idéntica clave llegan en paralelo durante la ventana entre lectura e inserción, ambas superan la verificación previa antes de que la primera haga commit, creando dos interacciones duplicadas.
- **Criterio de Aceptación:**
  - Dos envíos simultáneos con la misma `Idempotency-Key` y mismo cuerpo deben reutilizar la interacción y la misma evaluación.
  - La misma clave con cuerpo distinto debe responder HTTP `409 Conflict`.
  - La deduplicación de persona no debe confundirse con la idempotencia del formulario.
  - La protección debe ser a nivel de base de datos o mutex distribuido, ya que un bloqueo solo en memoria local (`Map`) no cubre despliegues multi-proceso o reinicios de Node.js.

### 5.4 Diagnóstico de Regresión General al Ejecutar la Suite
- **Ubicación:** Raíz del proyecto al ejecutar test runners.
- **Diagnóstico:** Si se ejecuta bare `npx vitest run` desde la raíz, fallan 5 suites de frontend con `ReferenceError: document is not defined` y `Cannot find package '@/domain/enums'`. Esto ocurre porque Vitest por defecto corre en entorno `node` y no lee la configuración de Vite del frontend.
- **Estado Real:** Antigravity reportó **122 pruebas aprobadas** con el comando oficial; este conteo no acredita pruebas SQL/Gemini omitidas. Reproduce el resultado y registra también omisiones. El comando utilizado fue:
  ```powershell
  npm --prefix frontend test
  ```
  Este comando invoca `vitest run --root .. --config frontend/vite.config.ts`, cargando el entorno `jsdom`, el alias `@/` y los mocks de DOM de `frontend/src/tests/setup.ts`.

### 5.5 Otros Problemas Conocidos Consolidados
- **Ejecución Periódica de Reintentos:** `recoverPendingEvaluations` corre una única vez al iniciar el backend (`src/index.ts`). No existe actualmente un temporizador recurrente (cron job o agenda periódica) para reintentar evaluaciones que sigan en `PENDIENTE` por caídas posteriores.
- **Referencias Dudosas a Solicitudes:** Cuando un contacto en etapas avanzadas (`PAYER`, `CUSTOMER`, `TURNED`) envía una consulta sobre una solicitud pero no se puede comprobar fehacientemente su pertenencia, el sistema lo etiqueta como `SOLICITUD_PENDIENTE_APERTURA`. Para la entrega independiente de Buyer, conserva el mensaje, la etapa y el estado pendiente, y permite aclaración automática. No implementes apertura de nuevas oportunidades históricas sin definir antes su identidad y sus efectos; no es un requisito esperar al agente LEAD para probar los demás casos de Buyer.

---

## 6. Pruebas en orden y evidencias

### 6.1 Reglas de ejecución

1. Comprueba conexión y esquema con 4.2; configura las variables según 3.4.
2. Ejecuta pruebas simuladas desde la raíz:
   ```powershell
   npm --prefix frontend test
   ```
   Para un diagnóstico focalizado:
   ```powershell
   npm --prefix frontend test backend/tests/buyerMessageJourney.test.ts backend/tests/buyerUnifiedEvaluation.test.ts
   ```
3. Para las pruebas existentes de integración SQL, confirma primero que la conexión efectiva apunta a QA. `TEST_SQLSERVER_URL` tiene prioridad; no basta con cambiar `SQLSERVER_URL` si el otro sigue definido. Ejecuta únicamente la suite correspondiente:
   ```powershell
   try {
     $env:RUN_SQL_TESTS = "true"
     npm --prefix frontend test backend/tests/buyerIntegrationFlow.test.ts
   } finally {
     Remove-Item Env:RUN_SQL_TESTS -ErrorAction SilentlyContinue
   }
   ```
   Revisa antes la preparación y limpieza de ese archivo; usa una copia QA recuperable. No habilites toda la batería SQL del repositorio a ciegas: algunas pruebas de LEAD requieren otro nombre de base.
4. Inicia backend/frontend según 3.5 y realiza los recorridos manuales. Usar el sistema con su clave configurada ya puede consumir Gemini; no depende de `RUN_LIVE_GEMINI_TESTS`, que controla las pruebas automatizadas.
5. Para la suite de clasificador con red, con la clave local ya configurada:
   ```powershell
   try {
     $env:RUN_LIVE_GEMINI_TESTS = "true"
     npm --prefix frontend test backend/tests/buyerMessageClassifier.test.ts
   } finally {
     Remove-Item Env:RUN_LIVE_GEMINI_TESTS -ErrorAction SilentlyContinue
   }
   ```
   No copies claves a comandos compartidos ni capturas.

Si las variables de prueba ya tenían un valor útil en tu sesión, guárdalo antes y restáuralo al terminar. Confirma los códigos de salida; una prueba omitida no está aprobada.

### 6.2 Recorridos funcionales de Buyer

Usa un nombre sintético único por prueba, teléfono/correo no utilizados e IDs reales de los catálogos. Anota persona, captación, interacción y decisión de cada caso.

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| Registro administrativo informativo | Crear mediante formulario administrativo o `POST /api/buyer`; abrir ficha y pulsar **Actualizar** | El registro guarda mensaje/captación. La evaluación posterior produce `SOLO_CONSULTA`; ninguna solicitud comercial. Registrar por sí solo no garantiza una decisión de Gemini. |
| Formulario público informativo | Enviar por el formulario que usa `POST /api/buyer/register` | Guarda y evalúa el mensaje; consulta de precio permanece en BUYER. |
| Reserva explícita | Seleccionar servicio activo, consentimiento y contacto válidos; evaluar solicitud de reserva | Una solicitud y un evento BUYER → LEAD; verificar entrega separadamente en `EntradasAgenteLead`. No prometer disponibilidad de una cita. |
| Ambigüedad | Registrar y evaluar “Hola, buenas tardes” | `AMBIGUA` con aclaración; sin solicitud nueva. |
| Horario y contexto | Mensaje pide tarde con formulario mañana; evaluar, editar solo horario a tarde y recargar | Primero aclaración; luego evaluación anterior desactualizada. **Actualizar** resuelve el nuevo contexto, conserva la interacción y añade la versión pertinente de decisión. |
| Mensaje extenso | Mensaje mayor de 500 caracteres con una frase distintiva al final; registrar y consultar | `Interacciones.mensaje` conserva el final. El límite del resumen de captación no limita el mensaje completo. |
| Aclaración en dos turnos | Usar el formulario público y su contexto/identificador previo; responder a la pregunta del agente | Conserva el mensaje anterior, la pregunta y la respuesta actual, sin asociar contexto de otra persona. No basta con editar libremente una ficha para demostrar ese recorrido. |
| Fallo-fallo-éxito | Prueba simulada del evaluador con errores controlados | Mismo `id_decision`, historial conservado e intentos acumulados. Es simulada hasta crear y ejecutar el ensayo equivalente contra QA. |
| Recarga | Recargar ficha evaluada | Lee decisión persistida; no genera otra llamada al clasificador por la recarga. |
| Contacto en PAYER | Registrar mensaje nuevo con `POST /api/buyer`, abrir su ficha y evaluar | Una interacción nueva para la misma persona; etapa PAYER intacta, sin recuperar la conversión anterior. Registrar y evaluar son pasos distintos en esta ruta. |
| Repetición | Evaluar de nuevo el mismo mensaje/contexto ya convertido | Misma decisión, solicitud y evento; no duplica oportunidades. |
| Caída y reinicio | Tras corregir 5.1, ejecutar fallo controlado antes del SP y después de su commit | Recupera la operación correcta; no repite solicitud/evento. Inyecta el fallo solo en QA y retira el mecanismo al finalizar. |
| Entrega pendiente | Simular fallo del receptor tras conversión confirmada y reintentar | Misma solicitud, una entrada de recepción; confirmar entrega no recrea la conversión. |
| Concurrencia HTTP | Crear prueba que lance dos `POST /api/buyer/register` realmente en paralelo con misma clave y cuerpo | Misma interacción/operación. Misma clave con cuerpo distinto: 409. Distintas claves: mensajes distintos permitidos. La ruta administrativa `POST /api/buyer` no es la que implementa actualmente `Idempotency-Key`. |

La caída y la concurrencia requieren ensayos nuevos o ampliados: no están acreditadas por los tests secuenciales ni por evaluar dos veces una interacción que ya existe. La creación de la reserva no demuestra que el agente LEAD negocie; su integración final sigue aplazada.

### 6.3 Consultas de comprobación por caso

Ejecuta solo en QA. Reemplaza el valor de `@id_persona` por el ID sintético que devolvió la API; no ejecutes con un ID de paciente real.

```sql
USE NexoSalud_LeadEnsayoFinal;
GO
DECLARE @id_persona INT = NULL; -- Sustituir NULL por el ID sintético del caso.
IF @id_persona IS NULL
    THROW 51901, 'Indica el id_persona sintético del caso antes de consultar.', 1;

SELECT p.id_persona, et.nombre AS etapa, p.autoriza_contacto
FROM dbo.Personas p
LEFT JOIN dbo.Etapas et ON et.id_etapa = p.id_etapa_actual
WHERE p.id_persona = @id_persona;

SELECT * FROM dbo.CaptacionesBuyer WHERE id_persona = @id_persona;
SELECT * FROM dbo.PersonaPreferencias WHERE id_persona = @id_persona
ORDER BY id_preferencia DESC;
SELECT id_interaccion, id_solicitud, tipo, mensaje, resultado, fecha_hora
FROM dbo.Interacciones WHERE id_persona = @id_persona
ORDER BY fecha_hora DESC, id_interaccion DESC;
SELECT id_decision, id_interaccion, entrada, decision, accion
FROM dbo.DecisionesIA WHERE agente = 'BUYER' AND id_persona = @id_persona
ORDER BY id_decision DESC;
SELECT id_solicitud, id_persona FROM dbo.Solicitudes
WHERE id_persona = @id_persona;
SELECT id_evento_etapa, id_captacion, id_solicitud, clave_operacion_buyer
FROM dbo.EventosEtapa WHERE id_persona = @id_persona;
SELECT id_solicitud, id_evento_etapa, id_captacion, id_persona
FROM dbo.EntradasAgenteLead WHERE id_persona = @id_persona;
```

Para cada caso guarda: commit, nombre de base, hora, petición sin secretos, respuesta, IDs y consultas antes/después. En concurrencia comprueba filas reales, no solo respuestas HTTP. En recarga comprueba el contador/espía o logs de llamadas al clasificador; una tarjeta idéntica no demuestra ausencia de llamadas.

**Limpieza:** conserva los datos sintéticos identificados durante la revisión. No borres personas e interacciones con un par de `DELETE`: hay decisiones, captaciones, preferencias, solicitudes y eventos con relaciones. Si necesitas eliminar un caso, prepara una limpieza transaccional limitada a sus IDs y revisa sus dependencias; o utiliza otra copia QA nueva sin sobrescribir la actual. No elimines registros originales del respaldo.

---

## 7. Cierre del Trabajo y Entrega

Al finalizar tus pruebas y correcciones:
1. **Registrar:** Commit probado, destino de base de datos (`SELECT @@SERVERNAME, DB_NAME()`), comandos ejecutados y estado de pruebas.
2. **Commits pequeños:** Realiza commits atómicos en la misma rama `feature/buyer-agent-gemini` con mensajes descriptivos bajo convención conventional commits (`feat(buyer): ...`, `fix(buyer): ...`).
3. **Publicar:** Ejecuta `git push origin feature/buyer-agent-gemini` (sin `--force`).
4. **Documentar:** Actualiza [ENTREGA_AGENTE_BUYER.md](ENTREGA_AGENTE_BUYER.md) resumiendo los avances logrados y los pendientes restantes.
5. **No modificar el informe académico** en este encargo.

