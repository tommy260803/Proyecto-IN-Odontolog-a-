# Buyer: preparación técnica del recorrido manual QA

Versión 13/11/2026, rama `feature/buyer-orientacion-interactiva`, HEAD `de14f0d6d921c778d90aedb28948f8f5a9403935` más el trabajo local conservado. Sin commit, push, pull, cambios de rama, migraciones ni modificaciones de cuentas. No hay AGENTS.md aplicables encontrados. **Preparación técnica comprobada; recorrido visual y conversión del prospecto nuevo pendientes de Daniel.**

## Comprobado y correcciones

- El [launcher](../../database/qa/buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs) expone una lista cerrada: sesión, listado, catálogos, deduplicación, creación administrativa, ficha y conversación. Exige sesión real antes de ejecutar los handlers. Listado/catálogos/deduplicación/creación: Administrador. Negociador: ficha/chat solo con una solicitud asignada, conforme al contrato existente. No se crea una solicitud anticipada para inventar esa asignación. Captación pública, edición, conversión directa y recuperación/evaluación generales siguen bloqueadas en este launcher. Esto no modifica las rutas públicas heredadas del servidor general, que no se inició.
- Se conservan destino configurado/efectivo exactos, loopback `127.0.0.1`, CORS `http://127.0.0.1:5173` y flags de aislamiento. `localhost` SQL se admite únicamente en la máquina DANIELPC y después se verifica mediante SELECT `@@SERVERNAME`/`DB_NAME()`. TEST_SQLSERVER_URL tiene prioridad sobre SQLSERVER_URL. No se editó .env. No se importó index.ts ni se arrancaron Mart, dunning o recuperadores.
- [Servicio frontend](../../frontend/src/modules/buyer/services/buyer.service.ts): Bearer vigente en catálogos, deduplicación y creación; rechaza creación sin sesión y no entrega una respuesta tardía a otro operador. Las lecturas ya tenían protección por sesión. El formulario sigue guardando mediante la operación administrativa, sin evaluación automática: el código inserta persona, captación, preferencias y consulta inicial, y reserva Solicitudes para el procedimiento de conversión. Esta revisión del código **no sustituye la prueba manual pendiente del guardado**.
- [Layout](../../frontend/src/app/layouts/AppLayout.tsx): el login general ignoraba el destino elegido; ahora cierra el modal y navega al destino seleccionado. Prueba con el modal, servicio de sesión, contexto y router reales; HTTP simulado. No se añade otro login del chat.
- Cabecera `X-QA-Buyer-Revision` del servidor aislado: SHA-256 de un inventario cerrado de launcher, conexión, rutas, acceso, autenticación, conversación, clasificador/evaluador, tipos y recepción. La sonda HTTP compara esa huella con el código local. Vite devolvió los módulos actualizados y la URL API correcta. Esto acredita versión servida, no aceptación visual.

## Resultados exactos

| Comprobación | Resultado |
|---|---|
| SELECT efectivo / prerrequisitos | DANIELPC / NexoSalud_LeadEnsayoFinal; cero columnas ausentes y sin bloqueos en la sonda previa. |
| Pruebas Node del launcher | 2 aprobadas, salida 0. Identidad simulada y HTTP local real; no prueban credenciales SQL. |
| Vitest focalizado | 5 archivos, 36 pruebas aprobadas, salida 0. API/persistencia simuladas; incluyen nueva navegación, nuevo Bearer administrativo y regresiones de autorización/sesión. |
| Compilación backend | `tsc`, salida 0. |
| Compilación frontend | `tsc && vite build`, salida 0; advertencia de chunks mayores de 500 kB. |
| Login HTTP real | 200; id_usuario 5, Administrador, vencimiento futuro. Sin publicar token/contraseña. |
| Listado / catálogos con sesión | 200 / 200; página de 1 elemento, total 10839; 12 servicios, 8 canales, 3 fuentes y 3 sedes. |
| Listado / creación sin sesión | 401 / 401. POST de prueba con DNI deliberadamente inválido; no alcanzó el handler. |
| Captación pública en launcher aislado | POST /buyer/register: 404 incluso con sesión. |
| Logout y token revocado | 204; lectura posterior 401. La sonda no dejó una sesión reutilizable. |
| Frontend servido | /buyer y /buyer/nuevo: 200; módulos de sesión, administración y layout actualizados. |

Ejecución HTTP real: 13/11/2026 09:35:36–09:35:39 UTC (04:35 America/Bogota). Huella verificada: `902be21f81ea53e955888501c6d5a15698f86d2942dbb148551d2b21d428ac21`. [Evidencias completas saneadas](../../database/qa/buyer_demo_integral/evidencias).

Conteos globales SQL antes/después idénticos: Personas 10839, CaptacionesBuyer 10839, Interacciones 20053, DecisionesIA 72, Solicitudes 2880, EventosEtapa 4060 y EntradasAgenteLead 19. 11012 se consultó solo para verificar conservación: LEAD, 5 interacciones, 1 solicitud y 1 evento antes/después. No se usó como sujeto de conversión. Conservación de conteos no equivale a comparación completa del contenido de la base.

**Cero prospectos creados, cero escrituras SQL y cero llamadas Gemini en este bloque.** Solo SELECT y login/logout de sesiones en memoria. No se creó todavía un prospecto reservado para grabación; lo creará Daniel conforme a su última instrucción. Benites permanece intacto: usuario 2, Carlos Benites (Operador 02), Negociador activo, credencial incompatible. No se prepara su contraseña: la presentación usará exclusivamente el Administrador QA existente, usuario 5.

La herramienta MCP sugerida por la skill typescript-runtime-validation no está invocable en esta sesión; se ejecutaron los comandos nativos del proyecto. No se declara un resultado MCP ni un recorrido de navegador. El intento anterior de controlar Brave quedó bloqueado; no se volvió a controlar ningún navegador.

## Arranque desde la raíz

Los servicios quedaron activos y verificados en loopback. **No arranques otra instancia si ya están escuchando.** Si hace falta iniciarlos después, abre dos terminales PowerShell en la raíz del repositorio:

```powershell
# Terminal 1: solo servidor QA aislado
./database/qa/buyer_demo_integral/iniciar_backend_qa.ps1
```

```powershell
# Terminal 2: frontend real contra ese servidor
./database/qa/buyer_demo_integral/iniciar_frontend_qa.ps1
```

Los scripts establecen flags solo para su proceso, no alteran .env y se detienen si el puerto está ocupado. No usar `npm --prefix backend run dev`, que arrancaría index.ts. El launcher exige QA_BUYER_CHAT_REAL=true, LEAD_STAFF_AUTH_ENABLED=true, LEAD_STAFF_AUTH_QA=false, DISABLE_MART_SYNC=true, DUNNING_ENABLED=false y RUN_SQL_TESTS=false. Vite usa VITE_USE_API=true y VITE_API_URL=http://127.0.0.1:3001/api. Si se reinicia el backend, sus sesiones en memoria se pierden: volver a iniciar sesión.

## Guía manual de presentación

1. Abrir **http://127.0.0.1:5173/buyer**. En el menú del personal de la cabecera, elegir «Iniciar sesión del personal». También puede iniciarse desde el acceso de personal de la landing. El error de listado sin sesión debe desaparecer tras autenticar. Elegir «Embudo BUYER (Captación)» en el login general.
2. Consultar **localmente**, sin copiar al informe/grabación, el correo y contraseña de la cuenta QA Administrador:

   ```powershell
   notepad "$env:LOCALAPPDATA\NexoSalud\QA\BuyerEnsayoFinal\credencial_buyer_qa_ensayofinal.json"
   ```

   El archivo ya existe fuera del repositorio con acceso NTFS restringido al usuario. No mostrar su ventana al grabar; cerrar al consultar. No hay perfiles simulados ni contraseña por defecto. Si falta ese archivo, detenerse y coordinar el acceso existente, sin restablecer cuentas automáticamente. No activar LEAD_STAFF_AUTH_QA=true para EnsayoFinal.
3. Pulsar **Registrar Prospecto** (URL directa: http://127.0.0.1:5173/buyer/nuevo). Completar explícitamente los campos de esta tabla. Esperar catálogos reales; si fallan, no presentar las opciones de fallback como evidencia SQL. DNI y correo son opcionales; teléfono es obligatorio y admite 9 dígitos. Los siguientes valores son únicamente fixtures locales sin comunicaciones externas.

| Campo | Ensayo manual | Prospecto separado para grabación |
|---|---|---|
| Nombres | QA_DEMO_UI_20261113_ENSAYO | QA_DEMO_UI_20261113_GRABACION |
| Apellidos | Prospecto Sintetico QA | Prospecto Sintetico QA |
| Teléfono ficticio | 000131301 | 000131302 |
| Correo opcional | buyer.ensayo.20261113@example.invalid | buyer.grabacion.20261113@example.invalid |
| DNI | Dejar vacío | Dejar vacío |
| Servicio | Evaluación odontológica (activo, id 1) | El mismo, elegido explícitamente |
| Sede / horario | Seleccionar expresamente la preferencia ficticia del ensayo | Seleccionar expresamente, no asumirla del valor inicial |
| Canal y fuente | Elegir valores reales cargados del catálogo | Igual |
| Consulta inicial | Quiero información sobre la evaluación odontológica. Por ahora no deseo solicitar atención. | Igual |
| Autorización | Marcar como dato sintético del fixture, sin atribuir consentimiento a una persona real | Igual |

   Si aparece coincidencia, detenerse y elegir otro sufijo/teléfono ficticio único; no usar un contacto histórico. No se comprobó por HTTP la disponibilidad de estos dos teléfonos: el formulario realiza esa consulta. Guardar una sola vez y esperar la respuesta. La ruta administrativa no evalúa automáticamente la consulta inicial. Registrar el ID que asigne SQL. Tras guardar vuelve al listado; buscar el nombre y abrir su ficha **/buyer/ID_REAL**. No se inventa una URL con un ID todavía inexistente.
4. Antes de abrir el chat, ejecutar las [consultas manuales de solo lectura](../../database/qa/buyer_demo_integral/CONSULTAS_MANUALES.sql): se espera BUYER, una persona/captación y consulta inicial, cero solicitudes/eventos/entradas comerciales. Capturar los IDs y verificar el texto, servicio y preferencias.
5. En **Conversación administrativa Buyer**, usar la misma sesión general, origen «Respuesta transcrita por el operador». No usar el enlace WhatsApp ni el botón antiguo Actualizar. Enviar: **«¿Qué incluye la evaluación odontológica? Solo quiero información; todavía no deseo solicitar atención.»** Debe persistir el turno y responder sin conversión; comprobar BUYER y cero solicitudes. Gemini es real durante esta prueba manual: sus respuestas no están garantizadas por las pruebas simuladas.
6. En la misma conversación enviar **«Hola, quisiera orientación.»**. Leer la aclaración y responder a su pregunta concreta; por ejemplo **«Me refiero a la evaluación odontológica. Por ahora solo quiero información.»**. Verificar continuidad y que no se prometa una reserva. No responder «sí» fuera del contexto de una pregunta inequívoca.
7. Cuando corresponda probar conversión, enviar **«Ahora sí deseo solicitar atención para una evaluación odontológica. Autorizo que me contacten para esta solicitud.»**. Si pregunta sede/horario, responder conforme a las preferencias ficticias que se eligieron. El backend debe validar y ejecutar el procedimiento existente. Registrar solicitud/evento y **el resultado real de recepción LEAD**; no anunciar reserva confirmada ni convertir desde el frontend. Si PENDIENTE, conservarlo, revisar error y usar retry del mismo turno solo cuando el servidor lo permita; no crear otro mensaje para ocultar el fallo.
8. Verificar actividades actualizadas, etapa e IDs con SQL y el estado mostrado por el chat. El launcher no expone la mesa LEAD general: una pantalla LEAD no es parte de esta preparación. En herramientas de red, capturar solo respuesta Buyer saneada; ocultar Authorization, login y almacenamiento de sesión.
9. Recargar la ficha, reabrir la conversación desde su listado y comparar historial. Si la sesión venció, usar el mismo login general. Capturar pantalla antes/después sin credenciales. No confundir este paso con recuperación automática tras caída.
10. Para grabación usar el segundo prospecto nuevo. Puede crearse antes, pero **no enviar intención de atención ni convertirlo durante el ensayo**. Si ya se usaron esos nombres, elegir un sufijo nuevo y ajustar el filtro de la consulta. No tocar 11012.

## Reproducir comprobaciones técnicas

Desde la raíz, con servicios QA activos para la sonda HTTP:

```powershell
node --test database/qa/buyer_demo_integral/launcher.test.cjs
npm --prefix frontend test -- frontend/src/modules/buyer/services/buyerAdministrative.test.ts frontend/src/app/layouts/BuyerAdministrativeNavigation.test.tsx frontend/src/modules/buyer/components/landing/StaffLoginModal.test.tsx frontend/src/shared/context/StaffSessionSecurity.test.tsx backend/tests/buyerReadAuthorization.test.ts
npm --prefix backend run build
npm --prefix frontend run build
node database/qa/buyer_demo_integral/comprobar_http_real.cjs
```

La sonda lee la credencial local en memoria, verifica destino y huella, prueba accesos y revoca su token. No crea contactos ni evalúa mensajes. Evidencias nuevas usan timestamp, sin sobrescribir las HTTP anteriores.

## Entrega incremental y pendientes

El ZIP incluye los cambios de este encargo y su continuación, pruebas, launcher, herramientas QA, este informe, evidencias saneadas, diff respecto al snapshot inicial del encargo y manifiesto SHA-256. Dependencia de revisión incluida sin modificar: lector local de credencial (solo código, jamás el archivo privado). Es **incremental sobre el estado local de fases 1/2/3 y ajustes visuales v3**; no constituye una instalación completa aplicable únicamente sobre de14f0d6.

Pendientes: creación por formulario y sus efectos SQL, recorrido Gemini desde pantalla, aclaración/continuación, conversión/recepción del nuevo fixture, persistencia visual al recargar, aceptación visual, concurrencia entre procesos y recuperación tras caída. No se modificó B3 ni se resolvió la convención horaria. La demostración completa no se declara aprobada hasta completar y registrar esos pasos manuales pertinentes.
