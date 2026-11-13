# Ajustes visuales chatbot Buyer v3 — cierre focalizado

Fecha: 2026-11-13. Rama conservada: `feature/buyer-orientacion-interactiva`. HEAD inicial/final: `de14f0d6d921c778d90aedb28948f8f5a9403935`, con los cambios locales de ajustes_visuales_v2 y fases anteriores. No se encontraron AGENTS.md aplicables en el repositorio ni sus ancestros inspeccionados. Se conservaron archivos previos, no versionados y evidencias. Sin commit, push, cambio de rama ni migraciones.

**Resultado:** correcciones verificadas con **133 pruebas aprobadas en 9 archivos**, salida 0; backend y frontend compilan con salida 0. Son pruebas automatizadas con dependencias simuladas, no aceptación visual ni pruebas con SQL/Gemini reales.

## Correcciones

### Estado vigente e historial

[BuyerConversationPanel](../../frontend/src/modules/buyer/components/BuyerConversationPanel.tsx) emite `onTurnChanged(turn, {personId, actorId, source})` para PENDIENTE, PROCESANDO y COMPLETADA. La identidad de notificación incluye origen, turnId, **status** y evaluación. `onCompleted` queda reservado a turnos activos finalizados: invalidaciones de ficha/listados y, cuando corresponde, de LEAD/journeys. La lectura histórica no dispara estos efectos.

[BuyerDetailView](../../frontend/src/modules/buyer/components/BuyerDetailView.tsx) conserva el turno local ligado a persona y ámbito de sesión. Ignora notificaciones históricas y turnos anteriores a la interacción vigente recuperada de la ficha. Al cambiar de persona/sesión se desmonta el estado anterior. Una evaluación más reciente de la API prevalece sobre el turno local anterior.

Para un turno PENDIENTE/PROCESANDO no se propagan intención comercial, solicitud ni recepción de una evaluación anterior. Se muestra explícitamente su estado en la tarjeta. La evaluación del historial sigue visible en su conversación, sin convertirse en la evaluación vigente de la persona por navegar. La tarjeta de retry heredada no invoca el evaluador genérico para turnos de chat.

### Scroll

Se eliminaron los desplazamientos diferidos e incondicionales de send y restauración de borrador. El ajuste del scroll ocurre tras actualizar el DOM y consulta la posición de lectura actual. Solo desplaza el contenedor local; no usa scrollIntoView para mover toda la página.

Send, retry y polling conservan la posición si el operador subió y muestran **Ver mensajes nuevos**. Consultar estado conserva el contenido durante la espera, evitando vaciar el contenedor y perder su posición. El botón explícito permite ir al final. No quedan temporizadores diferidos de scroll que puedan ejecutarse después del logout/cambio de persona.

### Sesión, respuestas tardías y caché

- El panel se desmonta/recrea por persona y sesión general; aborta peticiones y cambia la época de ejecución. Una respuesta tardía, aunque fetch ignore abort, no repuebla mensajes ni dispara callbacks de la sesión anterior. Un prop de sesión no puede reemplazar una identidad general distinta.
- [useBuyerQueries](../../frontend/src/modules/buyer/hooks/useBuyerQueries.ts) separa las claves de caché por ámbito de sesión, sin incluir Bearer en ellas, y transmite AbortSignal. La paginación no reutiliza placeholderData de otra sesión.
- [buyer.service](../../frontend/src/modules/buyer/services/buyer.service.ts) comprueba la sesión antes/después del fetch y después de leer JSON. El fallo de ficha ya no se reintenta por un listado general que pudiera devolver datos de otra sesión.
- [StaffProtectedCacheBoundary](../../frontend/src/shared/context/StaffProtectedCacheBoundary.tsx), conectado en el proveedor de la aplicación, cancela consultas y limpia cachés al cambiar/cerrar sesión. Se probaron cambios durante la lectura del cuerpo de una ficha y limpieza de caché LEAD.
- Los sobres inciertos conservan exactamente clave/cuerpo por persona/operador. Se mantiene compatibilidad con el sobre legado por persona y se archiva el de otro propietario antes de reemplazar ese puntero. Otro operador no lo muestra ni lo reenvía. Volver a entrar no provoca reenvío automático. Cancelar HTTP no prueba que el servidor no haya persistido: por eso se conserva el sobre y se requiere comprobación explícita.
- [staffAuthService](../../frontend/src/shared/services/staffAuthService.ts) valida token Bearer de 43 caracteres base64url, fecha ISO con calendario válido y futura, ID entero positivo, nombres/apellidos y rol admitido. La sesión restaurada exige identidad plana/coherente con usuario, email y ámbito local; registros antiguos incompletos se descartan. Esta validación de formato **no sustituye** la autorización del servidor.
- Logout invalida un login pendiente; una respuesta de login tardía no guarda sesión. Se preserva la contraseña exacta ingresada, sin recortar espacios. El proveedor escucha cambios de almacenamiento entre pestañas y vencimiento.
- Se conserva **un único login institucional**. Se retiraron los perfiles de ejemplo, carga de cuentas para autocompletar y contraseña prellenada del [modal general](../../frontend/src/modules/buyer/components/landing/StaffLoginModal.tsx). No se crearon cuentas ni se modificaron roles/credenciales en este bloque.

### Autorización consistente

[buyerChatAccess](../../backend/src/services/buyerChatAccess.ts) centraliza el criterio ya existente del chat: Administrador, o Negociador cuya persona tenga una **Solicitud con id_negociador correspondiente**. Se reutiliza en los [GET Buyer](../../backend/src/routes/buyer.routes.ts) y el [router de conversación](../../backend/src/routes/buyerConversation.routes.ts).

Se eliminó la consulta de ficha a AsignacionesPersonal: no tiene definición en Prisma ni en los SQL del repositorio revisados. No se afirma su ausencia física mediante una consulta nueva: no se conectó SQL en este bloque. Solicitudes.id_persona/id_negociador y sus relaciones sí forman parte del esquema existente. No se inventaron columnas, estados de asignación, roles ni permisos adicionales.

El listado aplica filtros SQL por persona para el Negociador; la ficha usa el mismo criterio. Una defensa adicional al formar DTOs elimina mensajes/evaluaciones de chat sin autorización. También oculta el motivo comercial sin autorización, porque puede copiar el texto del chat de conversión y reaparecer como concreteRequest/solicitudesHistory.

**Contrato preservado:** los GET heredados de ficha/listado pueden responder HTTP 200 con datos previos no conversacionales, pero sin mensajes ni evaluaciones del chat para tokens inventados/vencidos, usuarios inactivos o Negociadores sin asignación. Las rutas de conversación mantienen 401/403/404. No se presenta un 200 heredado como acceso autorizado al chat. Administrador y Negociador asignado reciben los campos permitidos; el Negociador no obtiene los de otras personas del listado.

## Pruebas y resultados reales

[buyerReadAuthorization.test.ts](../../backend/tests/buyerReadAuthorization.test.ts) monta el **buyer.routes.ts real** y ejecuta HTTP sobre GET /api/buyer, su variante paginada y GET /api/buyer/:id. Usa login/hash/sesiones reales del módulo de autenticación, con Usuarios/Prisma en memoria y Mart bloqueado. Comprueba token inventado, sesión vencida, usuario inactivo, Negociador no asignado/asignado y Administrador. Verifica ausencia de texto/evaluación protegidos, incluidos motivos comerciales, y presencia para el autorizado. No reemplaza esas rutas por un router ficticio ni se limita a /conversations. Los dobles devuelven deliberadamente contenido sin filtrar para comprobar también la defensa del DTO; se comprueban además los filtros Prisma enviados.

[BuyerVisualAudit.test.tsx](../../frontend/src/modules/buyer/components/BuyerVisualAudit.test.tsx) conecta ficha y panel reales con API simulada: COMPLETADA→PENDIENTE/PROCESANDO actualiza la tarjeta, no hereda conversión ni dispara invalidaciones de finalización; historial no reemplaza evaluación vigente; logout/cambio de operador limpia el turno local; ficha más reciente prevalece.

[Pruebas del panel](../../frontend/src/modules/buyer/components/BuyerConversationPanel.test.tsx): notificaciones y procedencia; lectura mientras send/retry/polling/Consultar estado esperan; respuestas tardías tras logout/cambio de operador; conservación de sobres por propietario; se mantienen las regresiones de TURN_PENDING, idempotencia y cambio de persona.

[StaffSessionSecurity.test.tsx](../../frontend/src/shared/context/StaffSessionSecurity.test.tsx): login/restauración inválidos, calendario/vencimiento, IDs, identidad inconsistente, login tardío, respuesta de ficha tardía y caché. [StaffLoginModal.test.tsx](../../frontend/src/modules/buyer/components/landing/StaffLoginModal.test.tsx): campos vacíos y ausencia de perfiles/carga de cuentas.

Se mantienen las regresiones existentes de conversación, auditoría, integración de finalización y presentación de preferencias/PAYER. Algunos selectores antiguos se precisaron para apuntar a la tarjeta concreta y las pruebas protegidas ahora proporcionan una sesión simulada válida: no se eliminaron aserciones. Se conservan los logs completos de iteraciones registradas, incluidos fallos por selectores ambiguos, temporizadores simulados; no se presentan como aprobaciones.

Desde la raíz:

```powershell
$tests = @(
  'backend/tests/buyerReadAuthorization.test.ts',
  'backend/tests/buyerConversation.test.ts',
  'backend/tests/buyerConversationAudit.test.ts',
  'frontend/src/modules/buyer/components/BuyerConversationPanel.test.tsx',
  'frontend/src/modules/buyer/components/BuyerConversationIntegration.test.tsx',
  'frontend/src/modules/buyer/components/BuyerDetailView.test.tsx',
  'frontend/src/modules/buyer/components/BuyerVisualAudit.test.tsx',
  'frontend/src/shared/context/StaffSessionSecurity.test.tsx',
  'frontend/src/modules/buyer/components/landing/StaffLoginModal.test.tsx'
)
npm --prefix frontend test -- @tests
npm --prefix backend run build
npm --prefix frontend run build
```

| Comprobación final | Resultado |
|---|---|
| Vitest focalizado | **133/133, 9/9 archivos; exit 0** |
| Backend tsc | **exit 0** |
| Frontend tsc + Vite | **exit 0**; aviso de chunks >500 kB, sin cambiar límites ni optimizar fuera de alcance |
| Diagnóstico del editor sobre fuentes revisadas | Sin errores encontrados |

[Logs y evidencias](../../database/qa/buyer_chatbot_ajustes_visuales_v3/evidencias) contienen stdout/stderr completos de las ejecuciones guardadas; se sanea la raíz local y cualquier coincidencia con secretos. El runner MCP de la guía TypeScript no estaba invocable en esta sesión; se usaron los comandos reales del repositorio, sin inventar un resultado de ese runner ni crear una auditoría general.

## Conservación, límites y paquete

No se ejecutaron consultas/escrituras SQL, procedimientos, migraciones, Gemini real, servidor general, recuperadores ni envío real alguno. **No se accedió ni modificó el historial real de 11012**; no se inventan nuevos recuentos de esa persona. Las peticiones HTTP de prueba usan servidor efímero y base simulada; el frontend usa fetch simulado.

Pendiente aceptación visual en navegador y QA contra proveedores reales de estos ajustes. No se declaran verificadas concurrencia entre procesos ni recuperación tras caída. El defecto de concurrencia histórico conserva su estado pendiente. No se tocaron conversiones, procedimientos ni el evaluador/modelo para forzar resultados.

`revision_chatbot_buyer_ajustes_visuales_v3.zip` es incremental sobre el estado local **ajustes_visuales_v2 y fases previas**, no una instalación autónoma desde HEAD limpio. Incluye archivos cambiados/nuevos, pruebas, este reporte, logs saneados, diff respecto del estado inicial del encargo y manifiesto SHA-256. El diff es para revisión; se sustituye cualquier antiguo valor de contraseña prellenada eliminado por un marcador, sin incluir esa credencial en el paquete. El manifiesto corresponde a los archivos finales, no a ese texto eliminado.

Se verifica inventario exacto, apertura, descompresión, hashes de cada entrada contra manifiesto y archivos locales. El comprobante externo VERIFICACION_ZIP.json evita autorreferencia. Se excluyen secretos, .env, credencial QA externa, dependencias, compilados, respaldos, ZIP anteriores e informes antiguos ajenos. Se conservaron todos los archivos previos fuera del paquete y no se realizó commit ni push.
