# Chatbot Buyer fase 3 QA — desbloqueo y comprobación real v2

**Autenticación real desbloqueada. Recorridos A–F comprobados mediante HTTP, SQL Server y Gemini reales, con aclaraciones/reintentos y fallos iniciales conservados. Aceptación visual pendiente.** No fue una ejecución completa exitosa al primer intento ni una prueba de calidad exhaustiva del modelo.

Rama conservada: `feature/buyer-orientacion-interactiva`. HEAD/base inspeccionada: `de14f0d6d921c778d90aedb28948f8f5a9403935`, más los cambios locales de fases 1/2 y de este bloque. Ejecución: 12/11/2026, aproximadamente 22:50–23:13 America/Bogota (13/11 UTC). No se encontraron AGENTS.md aplicables. Se conservaron los seis informes antiguos sin versionar y las evidencias anteriores. Sin pull, cambio de rama, reset, commit ni push.

## Destino, aislamiento y cuenta

SELECT previo a escrituras y al arranque confirmó **DANIELPC / NexoSalud_LeadEnsayoFinal**. La configuración usa localhost, admitido por el launcher únicamente en la máquina DANIELPC; sigue siendo obligatoria la comprobación SQL efectiva. No se modificó .env. TEST_SQLSERVER_URL tiene prioridad sobre SQLSERVER_URL; RUN_SQL_TESTS=false evita reescrituras implícitas.

La sonda anterior, posterior y final encontró cero columnas ausentes, los dos procedimientos y la vista requeridos, texto MAX y una cuenta activa compatible. Las huellas de ambos procedimientos y de la vista no cambiaron. Las sondas no observaron otras peticiones ni transacciones en esos instantes: esto no acredita vigilancia continua de todos los escritores.

Se usó exclusivamente el [launcher aislado](../../database/qa/buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs), revisado junto con sus imports: no importa index.ts, no arranca recuperadores ni dunning; el pool Mart es perezoso y su sincronización está bloqueada. Los puertos estaban libres antes del primer arranque. Solo se reinició el proceso aislado propio, identificado por puerto/PID/comando, para cargar las correcciones; no se detuvieron procesos ajenos ni se simularon caídas.

Cuenta sintética **id_usuario=5**, activa, rol **Administrador existente**. No se crearon roles. El [provisionador exclusivo](../../database/qa/buyer_chatbot_fase3_v2/provisionar_personal_qa.cjs) exige opt-in y destino configurado/efectivo exactos, usa transacción y applock, y llama a hashLeadStaffPassword real (scrypt-v1). Una creación y posteriores verificaciones devolvieron el mismo ID, sin restablecer contraseña. Se compararon los otros cuatro usuarios en memoria sin cambios; no se exportaron sus credenciales. El provisionador general y leadStaffAuth.ts permanecen intactos, incluidas sus guardas.

La credencial aleatoria está **fuera del repositorio**, en `%LOCALAPPDATA%\NexoSalud\QA\BuyerEnsayoFinal\credencial_buyer_qa_ensayofinal.json`. NTFS: herencia deshabilitada y un solo principal, el usuario actual, comprobado en evidencia. Para consultar localmente correo y contraseña, Daniel puede abrir ese archivo con Notepad; no se muestran aquí. No contiene tokens de sesión. Exclusiones locales explícitas en .git/info/exclude: `**/credencial_buyer_qa*.json` y `**/.buyer-qa-secrets/**`; el empaquetador usa además una lista cerrada y comprueba secretos reales antes de generar el ZIP.

Login HTTP real: **200**, identidad 5/Administrador; listado/historial con Bearer: **200**. Sin sesión: **401**. Logout: **204** y posterior uso de esa sesión: **401**. Login nuevo y recuperación desde SQL: **200**. No se confundió formato compatible con autenticación efectiva. No se creó un Negociador de prueba para repetir 403; esa autorización conserva sus pruebas simuladas y queda pendiente de QA real por rol.

## Resultados y trazabilidad

Se usaron los sujetos sintéticos documentados 11000 y 11007. Tras las correcciones se prepararon, transaccionalmente y con opt-in, dos sujetos nuevos, sin inicialización global: **11011/captación 11009** para el recorrido corregido y **11012/captación 11010** para revisión manual. Prefijo `QA_CHAT_F3V2_..._20261112`, contacto de prueba en example.invalid, sin DNI/teléfono reales. La autorización de contacto es parte de estos fixtures ficticios, no evidencia de consentimiento de una persona real.

| Caso | Resultado real y evidencia SQL |
|---|---|
| A. Informativa | 11000: turno 193/interacción 20218. Repetida en 11011: 207/20224. HTTP 200, SOLO_CONSULTA, BUYER, ninguna solicitud nueva. Respuestas Gemini persistidas exactamente. |
| B. Ambigua + continuación | 11000: 195/20219 → 197/20220 en la misma conversación. En 11011: saludo 209/20225 pendiente por salida incompatible del modelo; dos reintentos sobre el mismo turno, finalizado tras aclarar el contrato. Continuación 214/20227, HTTP 200, SOLO_CONSULTA, BUYER y cero solicitudes. |
| C. Solicitud válida | Primer intento en 11000 (199/20221) pidió aclaración por cambio de intención y no convirtió. Respuesta explícita 204/20223: dos salidas Gemini inválidas quedaron pendientes; tras corregir instrucciones convirtió a solicitud 2932/evento 4104. La recepción inicial falló por transacción envolvente; retry explícito la confirmó sin repetir conversión ni Gemini. En 11011, 216/20228 pidió sede/horario; al responder que no había preferencia, 218/20229 convirtió directamente: solicitud **2933**, evento **4105**, servicio 1 activo y recepción CONFIRMADA en la misma petición HTTP 200. |
| D. Replay | Reenvío de la clave y cuerpo originales de 204 y de 218: HTTP 200, replayed=true, mismos conversationId/turnId/interactionId, evaluación y mensajes; igualdad de snapshots de IDs/recuentos antes/después. El replay inicial del turno 199 solo probaba idempotencia de una consulta; no se usó como prueba de conversión. |
| E. PAYER | 11007: 202/20222 y 212/20226. HTTP 200, nueva interacción informativa, conserva PAYER. Solicitud histórica 2929/evento 4101 no se atribuyeron a esos mensajes. Sin solicitud/evento/entrada nuevos para esta persona. |
| F. Otra sesión | Logout, rechazo del Bearer anterior, login nuevo, listado paginado limit=1 y reapertura por UUID. Historial HTTP idéntico y mensajes cotejados con SQL; no depende de memoria del navegador. No se alcanzó una segunda página de listado porque cada Buyer probado tenía una conversación. |

Conversaciones verificadas:

- 11000: `8187b075-d075-411f-bd48-aa28654a657d` — cinco turnos, final LEAD.
- 11011: `b79c80bd-1434-4879-ba3a-776c544038e9` — cinco turnos, final LEAD.
- 11007: `bdf7d983-3507-4aea-a38a-6a8d1f34f426` y `2d45c29b-8519-4f12-9549-8f0f0399af30` — PAYER conservado.
- 11012: BUYER, una captación, **cero interacciones/solicitudes/eventos/entradas**; reservado para prueba manual.

[Resumen SQL final](../../database/qa/buyer_chatbot_fase3_v2/evidencias/resumen_sql_final.json) y [consultas reproducibles](../../database/qa/buyer_chatbot_fase3_v2/CONSULTAS_VALIDACION_V2.sql). Los turnos tienen un mensaje asistente cada uno al finalizar; se conservan intentos y avisos de error. Se registraron **16 intentos reales de clasificación para 12 turnos**; no es un conteo de tramas HTTP internas del SDK. La recuperación final de recepción y los replays no llamaron a Gemini. No se repitieron benchmarks ni se usaron mocks como evidencia en vivo.

Evidencias completas por ejecución en [evidencias](../../database/qa/buyer_chatbot_fase3_v2/evidencias): sufijos `03-53-16-042Z` (A/B/E/F y primer C fallido), `03-54-08-431Z`, `03-55-05-860Z` (salida inválida), `03-56-40-887Z` (conversión/recepción pendiente), `04-00-47-189Z` (recepción reconciliada/replay), `04-08-54-930Z` y `04-09-47-721Z` (saludo pendiente), `04-10-50-774Z` (saludo recuperado/continuación y pregunta de preferencias), `04-11-35-506Z` (conversión/recepción directa, replay e historial final). Algunos FAIL posteriores a un fallo de prerequisito son aserciones de dependencia del arnés: C/D no se enviaron cuando B no había terminado; F2 falló una vez por no disponer del resultado C2 en el arnés, aunque la lectura HTTP funcionó. Se conservan esas evidencias y se distinguen de fallos del sistema.

## Correcciones acotadas

- [buyerMessageClassifier.ts](../../backend/src/services/buyerMessageClassifier.ts): instrucciones y descripciones de esquema explican las relaciones ya exigidas entre intención, acción y confirmar_servicio. Este último debe ser null al informar o solicitar conversión. Diagnóstico seguro de enums para una acción incompatible. No se elimina validación ni se transforma una salida inválida en éxito. El primer caso C muestra que el modelo puede pedir una aclaración adicional; no se garantiza calidad universal del modelo.
- [buyerConversationService.ts](../../backend/src/services/buyerConversationService.ts): se demostró por SELECT la guarda **54702** del receptor real. La llamada específica de recepción usa un solo batch sin transacción envolvente: applock de sesión, comprobación de identidad/vencimiento con reloj SQL y vínculo persona/turno/interacción/solicitud, ejecución del SP y liberación del lock también en CATCH. Las demás operaciones conservan fencing transaccional. Sin transacción mientras espera a Gemini.
- Retry explícito de un turno COMPLETADA con entrega PENDIENTE: el servidor indica retryable; reconcilia solo la evidencia de esa interacción, completa primero el vínculo demostrado y reintenta recepción. No repite conversión/Gemini; actualiza la única respuesta asistente y conserva intentos. El panel ya respeta retryable y no necesitó cambios.
- [Pruebas nuevas](../../backend/tests/buyerConversationRealQa.test.ts) y [doble SQL](../../backend/tests/helpers/buyerChatMemory.ts): rechazo de salidas inválidas, autocommit de recepción, recuperación sin duplicados. Una regresión detectó que el vínculo debía reconciliarse antes del receptor cercado; se corrigió y se conserva el log fallido anterior.
- La sonda previa admite una ruta de evidencia nueva mediante QA_BUYER_PREFLIGHT_OUTPUT para conservar los archivos anteriores.

No se cambió Prisma, esquema, procedimientos, autenticación, roles anteriores, indicadores B3 ni código frontend. No hubo migraciones ni db push/reset.

## Efectos persistidos y comprobaciones locales

Conteos globales antes → final: Personas **10837→10839**; Interacciones **20036→20048**; DecisionesIA **33→61**; Solicitudes **2877→2879**; EventosEtapa **4057→4059**; EntradasAgenteLead **16→18**. Además, dos captaciones nuevas y una cuenta QA nueva. Los 28 registros DecisionesIA son 4 cabeceras + 12 turnos + 12 evaluaciones; los retries reutilizaron sus registros. Se conservaron estos sujetos/evidencias, sin limpieza global ni alteración manual de estados para fabricar resultados.

Los snapshots de replay verifican IDs y recuentos de los sujetos; los textos y estados del turno se compararon exactamente con lo persistido. No constituyen comparación completa del contenido de toda la base ni prueba de rollback ante fallo. No se ensayó una restauración.

Comandos desde la raíz y resultados reales:

```powershell
$env:QA_CREATE_BUYER_STAFF_ENSAYO='true'; $env:RUN_SQL_TESTS='false'
node database/qa/buyer_chatbot_fase3_v2/provisionar_personal_qa.cjs --crear-o-verificar
# Creó/verificó usuario 5, sin reset; salida 0. No repetir para cambiar su contraseña.
$env:QA_BUYER_PREFLIGHT_OUTPUT='database/qa/buyer_chatbot_fase3_v2/evidencias/otra_comprobacion.json'
node database/qa/buyer_chatbot_fase3/comprobacion_previa.cjs
# Sin bloqueos, salida 0, con los flags de aislamiento de abajo.
node database/qa/buyer_chatbot_fase3_v2/resumen_sql_final.cjs
npm --prefix frontend test -- backend/tests/buyerConversationRealQa.test.ts backend/tests/buyerConversationAudit.test.ts backend/tests/buyerConversation.test.ts backend/tests/buyerMessageClassifier.test.ts
# SDK/SQL simulados: 69 aprobadas, 4 live omitidas; salida 0.
node --test database/qa/buyer_chatbot_fase3_v2/provisionador_guardas.test.cjs database/qa/buyer_chatbot_fase3/launcher_destino.test.cjs
# 8 guardas aprobadas, sin proveedores; salida 0.
npm --prefix backend run build
# tsc aprobado, salida 0.
```

[Arnés real](../../database/qa/buyer_chatbot_fase3_v2/probar_chat_real.cjs): requiere QA_BUYER_CHAT_REAL=true y RUN_SQL_TESTS=false; QA_BUYER_PERSON_ID indica un fixture Buyer documentado. Sin parámetro utiliza 11000 y rechaza el arranque si ya no está en BUYER. **No repetirlo ciegamente sobre 11000/11011, ahora LEAD.** Ejemplo de comando realmente usado: `node database/qa/buyer_chatbot_fase3_v2/probar_chat_real.cjs --continuar-conversion database/qa/buyer_chatbot_fase3_v2/evidencias/QA_CHAT_REAL_2026-11-13T04-10-50-774Z.json`, con QA_BUYER_PERSON_ID=11011; salida 0. Los modos de continuación/retry usan las identidades y claves originales registradas, nunca fuerzan estados. Para una ejecución nueva, preparar explícitamente un fixture nuevo; el 11012 se dejó para Daniel.

## Prueba manual de Daniel

Los dos servicios aislados quedaron activos al cerrar el bloque. Si ya escuchan en 3001/5173, identificar primero sus procesos y usar esas instancias; no lanzar duplicados ni detener procesos desconocidos. Para iniciarlos tras cerrarlos, dos terminales desde la raíz:

```powershell
Set-Location 'C:\Users\Daniel\Downloads\Proyecto-IN-Odontolog-a-'
$env:QA_BUYER_CHAT_REAL='true'
$env:LEAD_STAFF_AUTH_ENABLED='true'
$env:LEAD_STAFF_AUTH_QA='false'
$env:RUN_SQL_TESTS='false'
$env:DISABLE_MART_SYNC='true'
$env:ENABLE_MART_SYNC='false'
$env:DUNNING_ENABLED='false'
node database/qa/buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs
```

```powershell
Set-Location 'C:\Users\Daniel\Downloads\Proyecto-IN-Odontolog-a-'
$env:VITE_API_URL='http://127.0.0.1:3001/api'
$env:VITE_USE_API='true'
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

No usar index.ts ni el arranque general. LEAD_STAFF_AUTH_QA=true se limita a LeadPruebas: **no habilitar ese modo en EnsayoFinal**. Aquí se usa el modo enabled real con Bearer. La guarda QA existente no se debilitó. CORS admite exactamente http://127.0.0.1:5173. Vite arrancó y la ficha/SPA y API devolvieron 200; CORS y el 401 sin sesión se verificaron por HTTP. Eso no acredita aceptación visual.

Abrir **http://127.0.0.1:5173/buyer/11012** (BUYER verificado). En «Conversación administrativa Buyer», usar correo/contraseña del archivo local protegido; la sesión general del portal no los reemplaza. Sin credenciales publicadas ni cuentas modificadas.

1. «¿En qué consiste una evaluación odontológica? Solo quiero información, no deseo solicitar una cita.» Esperar respuesta persistida, COMPLETADA y BUYER, sin solicitud.
2. «Hola». Esperar aclaración. Responder en la misma conversación: «Me refiero a evaluación odontológica; quiero información, todavía no quiero pedir una cita.» No usar el antiguo Actualizar para continuar.
3. «Antes pedí información, pero ahora he decidido solicitar una cita de evaluación odontológica. Solicito expresamente que envíen mi solicitud para que me contacten; ya no busco solo información.» Si pregunta sede/horario, responder: «No tengo sede ni horario preferidos. Deseo solicitar la evaluación odontológica y que el equipo me contacte para coordinar esos detalles. Solicito expresamente que envíen mi solicitud; no estoy reservando una fecha ni un horario.» Solo considerar conversión/recepción cuando el backend las confirme.
4. Si hay PENDIENTE, usar Reintentar turno cuando el servidor lo permita, sin volver a escribir el mensaje. Conservar captura del aviso y de intentos. No generar un retry automático ni suponer que Gemini siempre responderá válidamente.
5. Cerrar sesión, volver a entrar, listar/reabrir y recargar: comprobar roles operador/transcriptor, asistente/sistema, textos, estados y mismo historial. En http://127.0.0.1:5173/buyer/11007, una consulta nueva debe conservar PAYER; el distintivo histórico no acredita una conversión nueva.

Capturar pantalla sin credenciales, IDs de conversación/turno/interacción, respuesta/estado, refresco de ficha y SELECT correspondiente. No exportar Authorization, tokens o contraseñas en HAR/capturas. La mesa LEAD completa y escrituras antiguas de ficha no están expuestas por este launcher mínimo. Ctrl+C en cada terminal detiene sus servicios al terminar.

Para desactivar al finalizar la aceptación, revisar [DESACTIVAR_CUENTA_QA_NO_EJECUTADO.sql](../../database/qa/buyer_chatbot_fase3_v2/DESACTIVAR_CUENTA_QA_NO_EJECUTADO.sql), cambiar únicamente su opt-in a 1 y ejecutar en la sesión QA correcta. Verifica destino, ID 5, marcas sintéticas y rol; solo pone activo=0 a esa cuenta. **No se ejecutó**. El middleware rechazará sus siguientes peticiones; no restablece ni modifica otras cuentas.

## Entrega y límites

`revision_chatbot_buyer_fase3_qa_v2.zip` es **incremental** sobre las fases 1/2 auditadas y el paquete fase 3 anterior; requiere sus archivos locales y las dependencias ya instaladas. Contiene código cambiado, herramientas QA, consultas, pruebas, informe, evidencias saneadas, diff respecto al estado inicial de este encargo y MANIFIESTO_SHA256.txt. Incluye el launcher/sonda reutilizados como apoyo de revisión. Excluye credencial externa, entornos, contraseñas, hashes de contraseña, tokens, conexiones completas, dependencias, compilados, respaldos y ZIP anteriores. El comprobante de apertura/listado/hashes queda fuera para evitar autorreferencia.

Pendientes: **aceptación visual por Daniel**, 403 real por rol, paginación con varias conversaciones/páginas, variabilidad y calidad del modelo, caída real y concurrencia entre procesos. El defecto de concurrencia histórico no se da por corregido por estos replays secuenciales. Los tests de interrupción/ejecución tardía siguen siendo simulados. El reinicio controlado para cargar código no acredita recuperación automática tras una caída. B3 y la convención horaria no se modificaron ni se revalidaron en este bloque.
