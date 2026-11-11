# Guía de relevo para Germain en Buyer

**Fecha de referencia 11 de noviembre de 2026.** Trabajar en `feature/buyer-agent-gemini`, la misma rama utilizada por Daniel. La base revisada para este relevo es `2fff156`, con implementación previa `ffb67b6`. Los commits posteriores pueden incluir esta actualización documental o nuevos avances. Verificarlos antes de editar.

El [documento de entrega Buyer](ENTREGA_AGENTE_BUYER.md) resume el estado y las dependencias para LEAD. El [contrato compartido](../../database/lead_revision/CONTRATO_BUYER_LEAD.md) define la recepción. Comenzar por esta guía y consultar ambos durante el trabajo.

## 1. Objetivo del relevo

Completar la integración existente del agente Buyer con Gemini `gemini-3.5-flash-lite`. El clasificador independiente fue auditado. La prioridad está en el registro, recuperación e idempotencia que lo rodean.

Hay dos fallos de cierre. La recuperación por captación confunde mensajes nuevos de contactos avanzados con una conversión interrumpida. La lectura previa de claves de idempotencia deja una ventana para registros concurrentes duplicados.

Daniel y Germain deben acordar quién publica el bloque activo. Mientras Germain lo implementa, Daniel puede revisar resultados. Cada relevo comienza actualizando el clon.

## 2. Abrir el proyecto y sincronizar la rama

Abrir en Antigravity la raíz del proyecto que contiene `backend`, `frontend`, `database` y `docs`. Ejecutar en PowerShell desde esa raíz.

```powershell
git status --short
git fetch origin
git branch --list feature/buyer-agent-gemini
```

Si existen cambios locales, guardarlos en su rama antes de continuar. Si la rama ya existe localmente, ejecutar lo siguiente.

```powershell
git switch feature/buyer-agent-gemini
git pull --ff-only
```

Si aún no existe localmente, crear su seguimiento desde la rama remota.

```powershell
git switch --track origin/feature/buyer-agent-gemini
```

Confirmar rama y revisión.

```powershell
git branch --show-current
git log -5 --oneline
git status --short
```

La publicación de referencia es [2fff156](https://github.com/tommy260803/Proyecto-IN-Odontolog-a-/commit/2fff15691325546731ac7b04bf377936b81bd46e). Revisar cualquier avance posterior. Un rechazo de `pull --ff-only` indica divergencia que necesita inspección antes de integrar.

## 3. Preparar la copia QA

QA es una copia local de la OLTP donde ejecutar pruebas y provocar fallos. Los respaldos de Daniel y sus variables locales se preparan por separado del repositorio.

### 3.1 Crear o identificar la copia

En SSMS, expandir Bases de datos y localizar la OLTP de trabajo. Si ya existe una QA válida, verificar su contenido antes de reutilizarla.

Para preparar una nueva copia, detener el backend durante la captura, generar un respaldo completo de solo copia con un único archivo de destino y restaurarlo como `NexoSalud_LeadEnsayoFinal`. En la restauración, usar rutas físicas exclusivas para datos y log, y desactivar la copia del final del registro antes de restaurar. Confirmar siempre el nombre de destino.

El respaldo debe conservar el poblamiento sintético y las mejoras Buyer. Si Daniel facilita su respaldo, restaurarlo en el SQL Server local y comprobarlo. Los archivos de respaldo permanecen fuera de Git.

En una consulta nueva de SSMS ejecutar este control de lectura.

```sql
USE NexoSalud_LeadEnsayoFinal;
GO
SELECT @@SERVERNAME AS servidor, DB_NAME() AS base_actual;

SELECT COUNT(*) AS personas FROM dbo.Personas;

SELECT
    OBJECT_ID('dbo.CaptacionesBuyer', 'U') AS captaciones,
    OBJECT_ID('dbo.usp_ConvertirBuyerALead', 'P') AS convertir,
    OBJECT_ID('dbo.usp_Lead_ReporteR1', 'P') AS reporte_lead,
    OBJECT_ID('dbo.EntradasAgenteLead', 'U') AS entradas_lead,
    OBJECT_ID('dbo.usp_RegistrarEntradaAgenteLead', 'P') AS registrar_entrada;
```

Los identificadores muestran existencia. La validación completa del esquema requiere los controles de LEAD.

### 3.2 Elegir la migración según el estado

Si la copia aún necesita el paquete OLTP BUYER/LEAD, leer primero el [procedimiento](../../database/lead_revision/PROCEDIMIENTO_INSTALACION_OLTP.md). Sobre una restauración compatible pendiente de migrar, y desde la raíz del repositorio, usar el destino QA explícito.

```powershell
$qaServer = "localhost"
sqlcmd -S $qaServer -E -C -I -b -d NexoSalud_LeadEnsayoFinal -f 65001 -v BaseEsperada=NexoSalud_LeadEnsayoFinal -i database/lead_revision/APLICAR_BUYER_LEAD.sql
```

Sustituir `localhost` por la instancia local real cuando corresponda. Si el paquete ya está instalado, continuar con la verificación.

```powershell
$qaServer = "localhost"
sqlcmd -S $qaServer -E -C -I -b -d NexoSalud_LeadEnsayoFinal -f 65001 -v BaseEsperada=NexoSalud_LeadEnsayoFinal -i database/lead_revision/VERIFICAR_OLTP_INSTALADO.sql
```

Si falta la recepción LEAD, revisar y coordinar la [propuesta compartida](../../database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql). Está limitada a QA y fue utilizada en la copia de Daniel. Para una copia compatible, ejecutar el paquete acordado con el backend detenido.

```powershell
$qaServer = "localhost"
sqlcmd -S $qaServer -E -C -I -b -d NexoSalud_LeadEnsayoFinal -f 65001 -i database/buyer_revision/PROPUESTA_ESQUEMA_COMPARTIDO_BUYER_LEAD.sql
```

El [instalador original de recepción LEAD](../../database/lead_revision/ENTRADA_AGENTE_LEAD_QA.sql) acepta solo `NexoSalud_LeadPruebas`. Conservar su guarda y elegir el destino y paquete coordinados. La propuesta QA no sustituye la instalación completa de LEAD y debe verificarse también en sus restricciones.

Ante un error SQL, conservar la salida y revisar la transacción y el esquema antes de continuar. Guardar las salidas de controles y migraciones para la revisión.

## 4. Configurar el entorno local

Crear `backend/.env` a partir de la plantilla y ajustar servidor, puerto y método de autenticación. La plantilla publicada usa `NexoSaludDB`, por lo que hay que cambiar expresamente el destino para QA.

```dotenv
SQLSERVER_URL="sqlserver://localhost:1433;database=NexoSalud_LeadEnsayoFinal;integratedSecurity=true;trustServerCertificate=true;"
OLTP_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSalud_LeadEnsayoFinal;Trusted_Connection=yes;TrustServerCertificate=yes;"
PORT=3001
QA_ENV=true
DISABLE_MART_SYNC=true
DUNNING_ENABLED=false
GEMINI_API_KEY="REEMPLAZAR_LOCALMENTE"
```

La cadena Prisma y la conexión ODBC deben funcionar con la autenticación de ese equipo. Conservar los formatos de conexión que el proyecto soporte y comprobarlos localmente. Configurar `MART_CONNECTION_STRING` solo con un destino conocido y mantener desactivada la sincronización durante este bloque. Revisar además si `TEST_SQLSERVER_URL` existe en el entorno, porque tiene prioridad en el cliente del backend.

Usar una clave Gemini propia o la acordada por el equipo, guardada localmente. Verificar que Git ignore el archivo.

```powershell
git check-ignore backend/.env
```

Instalar dependencias y generar el cliente Prisma desde la raíz.

```powershell
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix frontend run build
```

Regenerar Prisma actualiza el cliente. Las migraciones SQL se aplican en el paso anterior con sus controles.

## 5. Corregir en este orden

### 5.1 Recuperación vinculada a la operación

Leer [buyerEvaluationService.ts](../../backend/src/services/buyerEvaluationService.ts), especialmente `executeEvaluationCore`, `retryEvaluationByInteraction` y los recuperadores.

Primero crear una prueba de regresión con una persona que tenga conversión anterior y etapa actual PAYER. Registrar una interacción nueva informativa y comprobar que se evalúa independientemente, conserva PAYER y no devuelve `CONVERSION_LEAD`.

Después delimitar la recuperación mediante evidencia persistente de la operación interrumpida. Conservar el vínculo del mensaje que inició la conversión. La etapa LEAD por sí sola no identifica una recuperación, pues también es el resultado esperado de un commit previo.

Probar tanto el mensaje nuevo como la caída inmediatamente después del commit y antes de persistir la entrega. La operación interrumpida debe recuperar la misma solicitud y terminar con una entrada LEAD.

Si la solución necesita campos nuevos, describir la migración mínima y coordinarla con LEAD antes de modificar el esquema compartido.

### 5.2 Idempotencia antes de crear filas

Leer [buyer.routes.ts](../../backend/src/routes/buyer.routes.ts) y el [servicio frontend](../../frontend/src/modules/buyer/services/buyer.service.ts).

Probar dos peticiones HTTP simultáneas con igual clave y contenido, desde el punto de entrada real. Deben devolver la misma interacción y evaluación. También probar igual clave con contenido distinto y mensajes iguales con claves diferentes.

La exclusión debe cubrir la comprobación y el registro. Valorar una restricción o coordinación transaccional persistente. El mapa por `id_interaccion` no protege dos interacciones que ya se crearon por separado. Un cerrojo en memoria por clave limita la garantía al proceso que lo mantiene.

Evitar ocultar el fallo cambiando el resultado esperado de la prueba.

### 5.3 Integración y contexto

Verificar que el segundo turno incorpore el mensaje previo, la pregunta del agente y la respuesta. Reintentar después de una interrupción y confirmar que recupera el contexto persistido. Una interacción previa ajena debe rechazarse o descartarse sin utilizar su contenido.

Conservar el servicio desconocido como aclaración. Validar referencias explícitas a solicitudes de la misma persona y el caso de referencia dudosa.

La recuperación automática actual corre una vez al arrancar. Verificar qué ocurre si ese intento vuelve a fallar y documentar el mecanismo operativo de reintento. La existencia de un método de recuperación no acredita una programación periódica.

## 6. Ejecutar las comprobaciones

Todos los comandos siguientes parten de la raíz del proyecto. El SQL Server debe estar disponible para las pruebas SQL. Mantener desactivadas las banderas de pruebas reales al ejecutar las simuladas.

```powershell
Remove-Item Env:RUN_SQL_TESTS -ErrorAction SilentlyContinue
Remove-Item Env:RUN_LIVE_GEMINI_TESTS -ErrorAction SilentlyContinue
npm --prefix frontend test
npm --prefix backend run build
npm --prefix frontend run build
```

Para SQL, comprobar previamente el destino real y mantener las guardas `DB_NAME()`. Las pruebas crean y limpian datos sintéticos.

```powershell
$env:RUN_SQL_TESTS = "true"
try {
    npm --prefix frontend test -- backend/tests/buyerIntegrationFlow.test.ts
} finally {
    Remove-Item Env:RUN_SQL_TESTS -ErrorAction SilentlyContinue
}
```

Registrar el código de salida de cada comando. Una limpieza fallida también debe quedar registrada y resuelta en QA.

Las llamadas reales a Gemini se activan por separado y consumen cuota. Para comprobar el clasificador de forma explícita, ejecutar lo siguiente cuando corresponda.

```powershell
$env:RUN_LIVE_GEMINI_TESTS = "true"
try {
    npm --prefix frontend test -- backend/tests/buyerMessageClassifier.test.ts
} finally {
    Remove-Item Env:RUN_LIVE_GEMINI_TESTS -ErrorAction SilentlyContinue
}
```

La suite SQL sustituye al modelo en varios casos. Distinguir siempre la base real del modelo simulado. Para probar conjuntamente SQL y Gemini, revisar el caso condicional y activar ambas banderas de forma explícita.

## 7. Coordinar con LEAD en el momento de integrar

LEAD puede continuar su agente desde una entrada válida de `EntradasAgenteLead`. Buyer confirma la conversión y llama a [registerLeadIntake](../../backend/src/services/leadIntake.ts) después del commit. La recepción repetida por solicitud debe devolver la misma entrada.

Coordinar con LEAD cuando ocurra uno de estos cambios.

- Se necesite una columna, índice o procedimiento compartido.
- Cambie la firma o el resultado de la recepción.
- Estén corregidos los fallos Buyer y se vaya a ejecutar la matriz conjunta.
- Se defina la apertura de nuevas oportunidades para contactos avanzados.

Los errores 54702 y 54703 tienen el significado descrito en el [contrato](../../database/lead_revision/CONTRATO_BUYER_LEAD.md). Registrar las inconsistencias en lugar de marcarlas como entrega confirmada.

## 8. Guardar y publicar el relevo

Actualizar [ENTREGA_AGENTE_BUYER.md](ENTREGA_AGENTE_BUYER.md) con capacidades verificadas, pendientes, commits y resultados. Distinguir pruebas locales, auditorías externas y evidencia reutilizada.

Antes de cada commit, revisar los cambios y preparar rutas explícitas. Excluir credenciales, archivos `.env`, respaldos, ZIP, dependencias instaladas y compilados. Separar la corrección de recuperación de la de concurrencia para facilitar la revisión.

```powershell
git status --short
git diff --check
git diff
```

Después de crear los commits del bloque y verificar sus archivos, publicar en la misma rama.

```powershell
git push origin feature/buyer-agent-gemini
git rev-parse HEAD
git status --short
```

Si otro integrante publicó entretanto, inspeccionar sus commits y coordinar la integración. Un rechazo del push requiere resolver esa diferencia.

Entregar a Daniel y LEAD el hash publicado, enlace al documento actualizado, comandos ejecutados y pendientes. La fusión se decide tras las pruebas conjuntas descritas en la entrega.
