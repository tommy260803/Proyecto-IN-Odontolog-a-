# QA de rutas y evaluador Buyer con SQL Server real

Prueba aislada, secuencial y con escrituras sintéticas confirmadas. No es una prueba del modelo Gemini. Requiere las dependencias existentes del backend y Node 24 (ejecución comprobada con 24.15.0). No instala ni cambia dependencias.

Desde la raíz del repositorio, con backend general, Mart, dunning y recuperadores detenidos:

```powershell
node --check database/qa/buyer_backend/entorno_qa.cjs
node --check database/qa/buyer_backend/consultas_qa.cjs
node --check database/qa/buyer_backend/gemini_controlado.cjs
node --check database/qa/buyer_backend/pruebas_backend_real.test.cjs
# Nuevo identificador y prefijo en cada ejecución; no reutilizar el de la evidencia.
Remove-Item Env:QA_BUYER_RUN_ID -ErrorAction SilentlyContinue
node --test --test-concurrency=1 database/qa/buyer_backend/pruebas_backend_real.test.cjs
$LASTEXITCODE
```

La conexión se resuelve en memoria con la misma precedencia de TEST_SQLSERVER_URL; no se imprimen URLs ni claves. Se bloquea una base distinta de NexoSalud_LeadEnsayoFinal antes de crear Prisma; SELECT @@SERVERNAME/DB_NAME comprueba DANIELPC antes de escribir. Deben existir las etapas BUYER/LEAD/PAYER, un servicio activo y las huellas esperadas de los dos procedimientos y la vista. Otra sesión SQL activa o una transacción ajena bloquea la preparación.

El entorno de pruebas desactiva Mart, no importa index.ts ni el scheduler dunning, y no llama recuperación general. Solo abre Express en loopback con puerto efímero y permite los cuatro patrones POST requeridos. El monitor HTTP permite únicamente ese origen. Los procesos externos deben comprobarse por separado: el arnés no los detiene automáticamente.

[gemini_controlado.cjs](./gemini_controlado.cjs) conserva el SDK real, reemplaza en memoria Models.generateContent y devuelve text JSON asociado al mensaje sintético exacto. La subclase del constructor solo instala esa sustitución; no reemplaza el clasificador, el evaluador ni la persistencia. El clasificador real construye el prompt, lee el catálogo real y valida las respuestas. Usa clave ficticia durante la prueba. No usa classifierOverride.

[pruebas_backend_real.test.cjs](./pruebas_backend_real.test.cjs) monta las rutas reales. A usa el registro público con evaluación automática; B/C/E usan registro administrativo y evaluación explícita. D usa retry de la interacción de C. E prepara una conversión real y cambia a PAYER exclusivamente su nueva persona sintética mediante UPDATE SQL acotado por ID, nombre y correo. Esto no prueba pagos.

[consultas_qa.cjs](./consultas_qa.cjs) comprueba los registros persistidos y compara conteos y SHA-256 del JSON ordenado por PK de ocho tablas, excluyendo el prefijo propio. No devuelve datos históricos al paquete, solo sus huellas y conteos. Opciones, Reservas y PropuestasEconomicasLead solo se comparan por conteo. No se afirma conservación completa del contenido de toda la base.

Se conservan los fixtures: cuatro personas y sus dependencias. No hay DELETE ni limpieza automática. Los resultados incluyen cada petición/respuesta sintética, los EXEC reales observados por middleware que siempre delega a Prisma y el estado final. Una futura ejecución generará otros IDs y otra carpeta. El receptor confirma su propia transacción; estas rutas no se envuelven en un rollback artificial.

[03_REVISAR_SINTETICOS_SOLO_LECTURA.sql](./03_REVISAR_SINTETICOS_SOLO_LECTURA.sql) revisa solo el prefijo de la ejecución entregada. No aplica actualizaciones.

No ejecutar la suite amplia de integración como sustituto: contiene otros escenarios y limpieza. No se probaron Gemini real, interfaz, concurrencia HTTP, recuperación automática, caída del proceso ni rollback ante fallo.

Informe y resultados reales: [PRUEBAS_BACKEND_BUYER_QA_DANIEL.md](../../../docs/agentes/PRUEBAS_BACKEND_BUYER_QA_DANIEL.md) y [RESULTADOS.json](./ejecucion_20261112T195045Z/RESULTADOS.json).
