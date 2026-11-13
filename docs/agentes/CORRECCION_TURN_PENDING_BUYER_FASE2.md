# Corrección focalizada TURN_PENDING — chatbot Buyer fase 2 v2

Rama conservada: `feature/buyer-orientacion-interactiva`. HEAD: `de14f0d6d921c778d90aedb28948f8f5a9403935`. Se trabaja sobre fase 1/2 y presentación locales posteriores. Sin reset, cambio de rama, commit ni push. Se conservaron los archivos sin versionar, seis informes antiguos y evidencias previas. No se encontraron instrucciones AGENTS.md aplicables.

## Contrato y corrección

En [BuyerConversationService.send](../../backend/src/services/buyerConversationService.ts), bajo bloqueo SQL, se comprueba primero un replay de la misma clave; después la pertenencia de conversación y si existe algún turno no completado de la persona. `409 TURN_PENDING` se lanza **antes** de insertar cabecera, interacción o turno nuevos. El [router](../../backend/src/routes/buyerConversation.routes.ts) devuelve `{code,error}` con ese estado. Es evidencia contractual de rechazo; no una inferencia basada en cualquier error HTTP. Backend/procedimientos no se modificaron ni ejecutaron.

Se ajustaron [panel](../../frontend/src/modules/buyer/components/BuyerConversationPanel.tsx), [servicio](../../frontend/src/modules/buyer/services/buyerConversation.service.ts), [tipo del sobre](../../frontend/src/modules/buyer/types/buyerConversation.types.ts), [pruebas](../../frontend/src/modules/buyer/components/BuyerConversationPanel.test.tsx) y [documento de fase 2](./CHATBOT_BUYER_FASE2.md):

- Solo la combinación HTTP 409 + código exacto TURN_PENDING mueve el sobre a un borrador recuperable por persona/operador y libera `pending`. Se guarda el borrador antes de eliminar el sobre; ante fallo de almacenamiento no se pierde el mensaje y se informa el problema.
- Se refresca una vez el listado, conservando paginación. El operador localiza/abre el turno anterior y lo consulta o reintenta según `retryable`; el borrador no deshabilita ese retry. Si la actualización del listado falla, existe un botón de consulta manual; no se reenvía el texto.
- La restauración vuelve explícitamente al destino original (conversación nueva o UUID validado mediante historial). Conserva texto exacto y origen. Navegar a otra conversación limpia el compositor, manteniendo el borrador guardado. No se mezcla con el historial persistido ni se inserta automáticamente.
- Red, JSON ilegible, 2xx sin contrato de turno, 400, conflicto de clave o 503 conservan el sobre exacto aun tras recarga. Un 503 que incluya TURN_PENDING no basta para eliminarlo. Siguen vigentes persona, operador, sesión y pertenencia. El metadato local `recoveredDraftKey` evita ofrecer de nuevo un borrador ya consumido al confirmar un retry incierto después de recargar; no se envía al backend.

## Comprobaciones reales de este bloque

```powershell
# Desde la raíz del repositorio, sin arrancar servicios reales
$env:RUN_LIVE_GEMINI_TESTS='false'
$env:RUN_SQL_TESTS='false'
$env:DISABLE_MART_SYNC='true'
$env:ENABLE_MART_SYNC='false'
$env:DUNNING_ENABLED='false'
npm --prefix frontend test -- frontend/src/modules/buyer/components/BuyerConversationPanel.test.tsx frontend/src/modules/buyer/components/BuyerConversationIntegration.test.tsx frontend/src/modules/buyer/components/BuyerDetailView.test.tsx
npm --prefix frontend run build
node --check database/qa/buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs
```

Resultados: [34 pruebas aprobadas](../../database/qa/buyer_chatbot_fase2_v2/evidencias/pruebas_finales.txt), tres archivos, salida 0; [frontend compilado](../../database/qa/buyer_chatbot_fase2_v2/evidencias/build_frontend.txt), salida 0; [sintaxis del servidor QA](../../database/qa/buyer_chatbot_fase2_v2/evidencias/sintaxis_servidor.txt), salida 0. Vite mantiene la advertencia de bundle mayor de 500 kB. API simulada con fetch; no certifica persistencia ni concurrencia SQL real. No se repitieron suites backend ni se cambió código para forzar resultados.

Nueve regresiones añadidas: recorrido completo con pendiente en página posterior y dos recargas, seis variantes que conservan sobres inciertos, restauración al UUID original con segundo fallo/retry tras recarga y aislamiento del borrador por persona/operador. El recorrido verifica mismo endpoint/turno anterior, número de envíos constante después del rechazo y retry, texto exacto conservado, sin envío al restaurar ni traslado a la conversación anterior. Los IDs son fixtures: no se crearon registros SQL.

## Preparación para prueba real — comandos NO ejecutados

Se revisaron [index.ts](../../backend/src/index.ts), [db.ts](../../backend/src/db.ts), [autenticación](../../backend/src/services/leadStaffAuth.ts), [MartSyncService](../../backend/src/services/martSyncService.ts), [dunningScheduler](../../backend/src/services/dunningScheduler.ts) y [router frontend](../../frontend/src/app/router/index.tsx).

El comando general `npm --prefix backend run dev` importa index.ts, arranca dunning y ejecuta `recoverPendingEvaluations()` al escuchar. `DUNNING_ENABLED=false` detiene dunning y `DISABLE_MART_SYNC=true` detiene Mart, pero **no hay un flag que omita ese recuperador de index.ts**. Por eso no usar ese arranque general para esta prueba aislada. Se entrega [servir_buyer_aislado.cjs](../../database/qa/buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs), solo de QA: no importa index.ts/dunning ni llama recuperadores; monta las rutas Buyer reales necesarias y las funciones de login/logout existentes. No modifica su autorización ni sustituye Gemini, Prisma o procedimientos. Solo se verificó su sintaxis; falta ejecutar y comprobarlo sobre el entorno real.

**Requisitos pendientes antes de arrancar:** dependencias y cliente Prisma existentes; SQL Server accesible; URL efectiva configurada por el responsable para DANIELPC / NexoSalud_LeadEnsayoFinal; persona sintética QA identificada; clave Gemini válida para los envíos reales autorizados y una cuenta de personal activa, con contraseña conocida y `password_hash` existente en formato scrypt-v1, rol exacto Administrador o Negociador. Para Negociador también una solicitud de esa persona asignada a su usuario. **No se comprobó que exista una cuenta válida en ese destino: es un requisito pendiente**, no se crearon cuentas ni se ejecutó provisión.

La URL efectiva prioriza TEST_SQLSERVER_URL sobre SQLSERVER_URL. No imprimirlas ni pegarlas en comandos/documentos. Con RUN_SQL_TESTS=false no se aplica la reescritura de base del modo de pruebas. El servidor QA rechaza antes de conectar configuraciones distintas del formato explícito `sqlserver://DANIELPC[:puerto];database=NexoSalud_LeadEnsayoFinal;…` y, antes de escuchar, consulta solo `@@SERVERNAME`/`DB_NAME()` para confirmar el destino. Si las guardas fallan, detenerse y revisar con el responsable; no eliminarlas ni reescribir destinos automáticamente.

La autenticación QA tiene prioridad sobre ENABLED: `LEAD_STAFF_AUTH_QA=true` solo permite NexoSalud_LeadPruebas. Para EnsayoFinal se usa el modo normal existente `LEAD_STAFF_AUTH_ENABLED=true` y `LEAD_STAFF_AUTH_QA=false`. Esto no debilita la guarda QA. Los flags de abajo son solo variables del proceso de la futura terminal; no se cambió `.env` en este bloque. El opt-in QA_BUYER_CHAT_REAL pertenece únicamente al launcher nuevo.

**Terminal 1, PowerShell desde la raíz**, después de autorizar la prueba y verificar configuración/cuenta. Mantener detenido cualquier backend general anterior; no matar procesos ajenos ni ocupar un puerto que ya esté en uso:

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

El servidor escucha solo 127.0.0.1:3001 tras confirmar destino. Expone lecturas de ficha/catálogos, chat y sesión; no expone captación pública, evaluación genérica, recuperadores ni escritura de ficha. Usar únicamente el panel, no las acciones antiguas Actualizar/Convertir ni otras mesas del portal en esta sesión aislada. Ctrl+C para detenerlo y desconectar Prisma.

**Terminal 2, PowerShell desde la misma raíz:**

```powershell
Set-Location 'C:\Users\Daniel\Downloads\Proyecto-IN-Odontolog-a-'
$env:VITE_API_URL='http://127.0.0.1:3001/api'
$env:VITE_USE_API='true'
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir `http://127.0.0.1:5173/buyer/ID_PERSONA_SINTETICA_QA`, sustituyendo el último segmento por un ID sintético previamente verificado en EnsayoFinal. En «Conversación administrativa Buyer», iniciar sesión con la cuenta autorizada existente. El login general del portal no concede ese Bearer. Comprobar historial/listado, luego el caso TURN_PENDING y su borrador/recuperación sin autoenvío. Cada envío real puede llamar Gemini y escribir SQL; requiere el siguiente bloque autorizado. 401 solicita nueva sesión, 403 exige asignación/rol y 404 puede indicar autenticación deshabilitada/guarda o recurso ausente; no usar rutas anónimas como alternativa.

## Entrega y límites

`revision_chatbot_buyer_fase2_v2.zip` es incremental sobre el estado local de fase 2 inicial + fase 1 auditada v2. Incluye cinco archivos existentes ajustados (panel, servicio, tipo, prueba y documento), este informe, launcher QA, evidencias, diff contra el estado exacto al comenzar el ajuste y manifiesto SHA-256. No incluye secretos, entorno, dependencias, compilados, respaldos ni ZIP anteriores. Apertura y hashes se verifican y registran fuera del ZIP en `database/qa/buyer_chatbot_fase2_v2/evidencias/VERIFICACION_ZIP.txt` para evitar autorreferencia.

**SQL Server, Gemini real y aceptación visual siguen pendientes.** Tampoco se probaron caída real, concurrencia entre procesos o recuperación automática. No se actualizan indicadores, fechas ni contratos SQL con esta corrección. Sin commit ni push.
