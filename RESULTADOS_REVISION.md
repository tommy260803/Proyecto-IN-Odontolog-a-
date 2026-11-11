# Resultados de la Revisión — Clasificador Buyer (Gemini 3.5 Flash Lite) — v3

**Rama:** `feature/buyer-agent-gemini` (originada desde `lead`)  
**Fecha:** 10 de noviembre de 2026  
**SDK Oficial:** `@google/genai` (v3.1.0)  
**Modelo:** `gemini-3.5-flash-lite`  
**Variable de Autenticación:** `GEMINI_API_KEY`

---

## 1. Resumen de Correcciones y Ajustes Finales

1. **Auditoría Completa en Errores Finales**:
   - Se asegura que todas las clases de error ([`BuyerClassificationError`](file:///c:/Users/Daniel/Downloads/Proyecto-IN-Odontolog-a-/backend/src/services/buyerMessageClassifier.ts#L33), [`BuyerTimeoutError`](file:///c:/Users/Daniel/Downloads/Proyecto-IN-Odontolog-a-/backend/src/services/buyerMessageClassifier.ts#L46) y [`BuyerValidationError`](file:///c:/Users/Daniel/Downloads/Proyecto-IN-Odontolog-a-/backend/src/services/buyerMessageClassifier.ts#L59)) conserven el número real de intentos realizados (`intentosRealizados`), el historial estructurado de cada intento (`intentos: BuyerClassificationAttempt[]`) y la duración total transcurrida (`duracionTotalMs`).
   - Todos los mensajes de error son procesados por [`sanitizeSensitiveInfo`](file:///c:/Users/Daniel/Downloads/Proyecto-IN-Odontolog-a-/backend/src/services/buyerMessageClassifier.ts#L125) para censurar cualquier clave de API (`[REDACTED_API_KEY]`) o token Bearer.
2. **Validación Exhaustiva de Opciones y Argumentos**:
   - En constructor y sobrescrituras por llamada ([`validateClassifierOptions`](file:///c:/Users/Daniel/Downloads/Proyecto-IN-Odontolog-a-/backend/src/services/buyerMessageClassifier.ts#L75)): `timeoutMs` debe ser número positivo y finito; `maxRetries` debe ser entero no negativo; `initialRetryDelayMs` debe ser positivo y finito; `backoffFactor` debe ser mayor o igual a 1.
   - En el CLI ([`classify-buyer-cli.ts`](file:///c:/Users/Daniel/Downloads/Proyecto-IN-Odontolog-a-/backend/src/scripts/classify-buyer-cli.ts#L18)): se rechazan argumentos incompletos o inválidos (ej. `--timeout abc`, `--timeout -5`, opciones desconocidas o `--message` vacío) antes de instanciar el clasificador o llamar a Gemini, terminando con código de salida 1.
3. **Manejo Estricto de `RUN_LIVE_GEMINI_TESTS`**:
   - Si `RUN_LIVE_GEMINI_TESTS=true` y falta la clave `GEMINI_API_KEY` en el entorno o en `backend/.env`, la prueba termina con un error explícito e informativo en lugar de omitirse silenciosamente.
   - Se documenta el procedimiento estándar para retirar la variable de entorno en PowerShell (`Remove-Item env:RUN_LIVE_GEMINI_TESTS` o `$env:RUN_LIVE_GEMINI_TESTS = $null`).
4. **Clarificación y Separación de Pruebas**:
   - Se renombró el bloque de pruebas estructurales a *Validación Estructural de Respuestas JSON Predefinidas* para reflejar con precisión que validan la normalización y el cumplimiento de esquema sobre cargas útiles simuladas.
   - La evaluación semántica real realizada por Gemini 3.5 Flash Lite se mantiene en su propio bloque aislado condicional.
5. **Prueba de Cancelación y Secuencialidad Estricta**:
   - Se agregó una prueba unitaria específica que simula la cancelación de una petición mediante `AbortSignal` al vencer el tiempo límite, verificando que la llamada anterior finalizó y liberó sus recursos antes de que iniciara el reintento sucesivo (`call2StartedAt >= call1FinishedAt`).
6. **Estandarización de Comandos a Directorio Único**:
   - Todos los comandos del reporte se ejecutan desde un único directorio: la **raíz del proyecto** (`Proyecto-IN-Odontolog-a-`), empleando `--prefix` para las operaciones sobre `backend` o `frontend`.

---

## 2. Inventario de Archivos Afectados

| Ruta Relativa | Tipo | Descripción |
|---|---|---|
| `backend/src/types/buyer.ts` | Nuevo | Tipos compartidos (`BuyerIntention`, `ServiceCatalogItem`, `BuyerClassificationResult`, etc.). |
| `backend/src/services/buyerMessageClassifier.ts` | Nuevo | Servicio del clasificador con `@google/genai`, validación estricta, timeout, reintentos y auditoría de errores. |
| `backend/src/services/buyerSyntheticData.ts` | Nuevo | Catálogo sintético y banco de 20 casos sintéticos (negaciones, condicionales, inyecciones). |
| `backend/src/scripts/classify-buyer-cli.ts` | Nuevo | CLI terminal con validación previa de argumentos y código de salida estricto. |
| `backend/tests/buyerMessageClassifier.test.ts` | Nuevo | Suite de 28 pruebas Vitest (24 simuladas/unitarias + 4 de integración real en vivo). |
| `backend/package.json` | Modificado | Dependencia `@google/genai` (^3.1.0) y script npm `"classify:buyer"`. |
| `backend/package-lock.json` | Modificado | Árbol de dependencias bloqueado para el backend. |
| `backend/tsconfig.json` | Incluido | Configuración TypeScript para compilación del backend. |
| `backend/.env.example` | Modificado | Plantilla de variables con valores ficticios (`GEMINI_API_KEY="..."`). |
| `frontend/package.json` | Incluido | Definición del script `test` con Vitest a nivel de workspace. |
| `frontend/package-lock.json` | Incluido | Árbol de dependencias bloqueado para el frontend. |
| `frontend/tsconfig.json` | Incluido | Configuración TypeScript del frontend. |
| `frontend/vite.config.ts` | Incluido | Configuración de Vitest para ejecutar pruebas en `backend/tests/`. |
| `frontend/src/tests/setup.ts` | Incluido | Setup de entorno cargado por Vitest. |
| `frontend/.env.example` | Incluido | Variables de entorno frontend de ejemplo sin secretos. |
| `RESULTADOS_REVISION.md` | Actualizado | Documento descriptivo del paquete de revisión v3. |

---

## 3. Comandos Exactos de Reproducción

> **Nota:** Todos los comandos están estandarizados para ejecutarse desde el directorio raíz del proyecto: `C:\Users\Daniel\Downloads\Proyecto-IN-Odontolog-a-`

### A. Verificación de Tipos TypeScript
* **Directorio de ejecución:** Raíz del proyecto (`.`)
* **Comando:**
  ```powershell
  npx tsc -p backend/tsconfig.json --noEmit
  ```

### B. Compilación del Backend
* **Directorio de ejecución:** Raíz del proyecto (`.`)
* **Comando:**
  ```powershell
  npm --prefix backend run build
  ```

### C. Pruebas Unitarias y Simuladas (Offline / Mock)
* **Directorio de ejecución:** Raíz del proyecto (`.`)
* **Comando:**
  ```powershell
  npm --prefix frontend test backend/tests/buyerMessageClassifier.test.ts
  ```

### D. Pruebas de Integración Real con Gemini (Live API)
* **Directorio de ejecución:** Raíz del proyecto (`.`)
* **Comando en PowerShell:**
  ```powershell
  $env:RUN_LIVE_GEMINI_TESTS="true"; npm --prefix frontend test backend/tests/buyerMessageClassifier.test.ts; Remove-Item env:RUN_LIVE_GEMINI_TESTS
  ```
* **Comando en Bash / Linux:**
  ```bash
  RUN_LIVE_GEMINI_TESTS=true npm --prefix frontend test backend/tests/buyerMessageClassifier.test.ts
  ```
* **Para retirar la variable en PowerShell si se interrumpió la sesión:**
  ```powershell
  Remove-Item env:RUN_LIVE_GEMINI_TESTS
  # o alternativamente:
  $env:RUN_LIVE_GEMINI_TESTS = $null
  ```

### E. Suite Sintética CLI (Terminal Independiente)
* **Directorio de ejecución:** Raíz del proyecto (`.`)
* **Comando (evaluación completa 20 casos):**
  ```powershell
  npm --prefix backend run classify:buyer
  ```
* **Comando (clasificación de mensaje puntual):**
  ```powershell
  npx --prefix backend tsx backend/src/scripts/classify-buyer-cli.ts --message "Quiero agendar cita para brackets"
  ```
* **Comando (verificación de rechazo de argumentos inválidos):**
  ```powershell
  npx --prefix backend tsx backend/src/scripts/classify-buyer-cli.ts --timeout abc
  ```

### F. Suite General de Regresión del Repositorio
* **Directorio de ejecución:** Raíz del proyecto (`.`)
* **Comando:**
  ```powershell
  npm --prefix frontend test
  ```

---

## 4. Estado de las Comprobaciones (Ejecutadas vs. Reutilizadas)

### 4.1. Comprobaciones Ejecutadas en esta Sesión

1. **Verificación TypeScript**:
   * Comando: `npx tsc -p backend/tsconfig.json --noEmit`
   * Resultado: **0 errores de tipado**, compilación limpia con `strict: true`.
2. **Suite Unitaria y Simulada (Vitest)**:
   * Comando: `npm --prefix frontend test backend/tests/buyerMessageClassifier.test.ts`
   * Resultado: **24 pruebas aprobadas, 4 omitidas intencionalmente** (reservadas para el modo en vivo), **0 fallidas**. Duración: `246 ms`.
3. **Prueba de Cancelación Activa y Secuencialidad**:
   * Verificado que la llamada 1 recibió la señal de aborto al expirar el tiempo límite, finalizó y liberó recursos (`call1FinishedAt`), antes de que iniciara la llamada 2 de reintento (`call2StartedAt >= call1FinishedAt`).
4. **Prueba de Auditoría de Errores Finales**:
   * Verificado que `BuyerClassificationError`, `BuyerTimeoutError` y `BuyerValidationError` conservan `intentosRealizados`, `intentos: BuyerClassificationAttempt[]` y `duracionTotalMs` con mensajes sanitizados.
5. **Prueba de Error Explícito ante Falta de Clave en Modo Live**:
   * Verificado que si `RUN_LIVE_GEMINI_TESTS=true` y falta `GEMINI_API_KEY`, se lanza un error explícito.
6. **Validación de Argumentos CLI**:
   * Verificado que argumentos como `--timeout abc` o `--invalid` son rechazados con mensaje de error claro y código de salida 1 antes de llamar a Gemini.

### 4.2. Evidencia Reutilizada (Sin Repetir Llamadas Reales Innecesarias)

Dado que las directivas de sistema, el modelo (`gemini-3.5-flash-lite`) y los contratos de entrada/salida no fueron modificados en estos ajustes de control, se reutiliza la evidencia real certificada:
1. **Pruebas de Integración Real con Gemini (`RUN_LIVE_GEMINI_TESTS="true"`)**:
   * 4 pruebas en vivo aprobadas (negaciones con redirección a limpieza, consultas de precio de implantes, solicitudes condicionales a horario y neutralización de prompt injection malicioso como AMBIGUA con ID `null`).
   * Tasa de aprobación: **4 de 4 (100%)**.
2. **Benchmark Sintético de 20 Casos en CLI**:
   * Tasa de aprobación: **20 de 20 casos (100%)**. Código de salida: `0`.

### 4.3. Comprobaciones Pendientes

* **Integración con Rutas Express de Registro y Conversión (`/buyer/register`, `/buyer/:id/convert`)**:
  * Queda expresamente pendiente hasta que el equipo **LEAD** confirme formalmente su contrato de interfaz y ciclo de vida de los estados de captación. El clasificador se entrega como servicio independiente modular listo para ser consumido.

---

## 5. Auditoría de Seguridad del Paquete

El archivo comprimido `revision_clasificador_buyer_v3.zip` ha sido verificado mediante extracción temporal y escaneo automatizado:
* **Cero claves o secretos reales**: `GEMINI_API_KEY` real no figura en ningún archivo empaquetado.
* **Exclusión estricta**: Sin archivos `.env`, `.env.local`, `.git/`, `node_modules/`, `dist/`, `.vite/` ni respaldos de base de datos (`.bak`, `.mdf`).
* **Valores ficticios**: Los archivos `.env.example` incluidos contienen exclusivamente marcadores genéricos de muestra (`"tu_clave_gemini_api_aqui"`).
