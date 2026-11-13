# Reporte de Corrección de Auditoría: Chatbot Buyer (Ajustes Visuales v2)

**Fecha:** 2026-11-13  
**Rama:** `feature/buyer-orientacion-interactiva`  
**Base:** Auditoría sobre `revision_chatbot_buyer_ajustes_visuales_v1.zip`  
**Política:** Sin commit, sin push, sin migraciones de esquema ni cambios de SP, sin mensajes a la persona sintética 11012.

---

## 1. Resumen de Defectos Corregidos

### Defecto 1: Autorización real en endpoints de Buyer
- **Archivo:** `backend/src/routes/buyer.routes.ts`
- **Diagnóstico v1:** `isStaffAuthorized` utilizaba una expresión regular sobre el encabezado `Authorization` (`/^Bearer\s+[A-Za-z0-9_-]{10,}/i`), validando únicamente formato sintáctico sin comprobar token real, vigencia, rol ni asignación.
- **Corrección v2:**
  - En `GET /buyer` (listado general): Se utiliza `getLeadStaffIdentity(req, prisma)`. Solo los usuarios con rol `'Administrador'` tienen acceso al contenido de chat en el listado, evitando un booleano global permisivo que exponga chats a roles sin autorización transversal.
  - En `GET /buyer/:id` (ficha de detalle): Se valida sesión real con `getLeadStaffIdentity(req, prisma)`. Si el rol es `'Administrador'`, se autoriza; si es `'Negociador'`, se verifica asignación activa contra la tabla de asignaciones para la persona específica. Si la comprobación falla o no está asignado, `isStaffAuthorized` queda estrictamente en `false`.
  - Cuando no hay autorización, se preserva el filtrado que excluye `BUYER_CHAT_ENTRADA` y decisiones con `conversationTurnId`.

### Defecto 2: Sesión general sin perfiles simulados
- **Archivo:** `frontend/src/shared/services/staffAuthService.ts`
- **Diagnóstico v1:** Cuando el endpoint de sesión devolvía 404 o error de red, un bloque de fallback creaba sesiones locales ficticias a partir del email o cuentas preconfiguradas. `getSession()` aceptaba perfiles con solo email.
- **Corrección v2:**
  - Eliminado el fallback completo de perfiles simulados. Un 404, error de red o fallo de autenticación rechaza y lanza excepción.
  - Validación estricta de la respuesta del servidor en `authenticate()`: debe incluir `token` (string válido), `expira_en`, y objeto `usuario` con `id_usuario`, `nombres`, `apellidos` y `rol`. Ningún dato se inventa por defecto.
  - `getSession()` requiere `token` válido además de `email`. Perfiles locales sin token son descartados inmediatamente.
  - Al cerrar sesión (`logout()`), se emite DELETE a `/lead/commercial/staff/session` para invalidar la sesión en el backend, se limpia `localStorage` y se notifica a los suscriptores (`notify(null)`), impidiendo que respuestas en vuelo repueblen la UI.

### Defecto 3: Unificación con Actividades y ciclo de vida de latestChatTurn
- **Archivo:** `frontend/src/modules/buyer/components/BuyerDetailView.tsx`
- **Diagnóstico v1:** `latestChatTurn` no se limpiaba al cambiar de `buyerId`, permitiendo que el turno de una ficha previa sobrescribiera la evaluación de la ficha recién abierta. Además, turnos `PENDIENTE` o `PROCESANDO` no comunicaban su estado correctamente o marcaban erróneamente `es_mensaje_vigente: true`.
- **Corrección v2:**
  - Añadido `useEffect` vinculado a `[buyerId]` que reinicia `setLatestChatTurn(null)` al cambiar de ficha.
  - En `useMemo(() => ...)` de `evaluacion`:
    - Turno con estado `'COMPLETADA'` y `evaluation`: refleja la evaluación persistida con `es_mensaje_vigente: true`, `isChatTurn: true`, y su resultado.
    - Turno con estado `'PENDIENTE'` o `'PROCESANDO'`: se comunica como estado intermedio (`estado: latestChatTurn.status`, `accion: status`, `es_mensaje_vigente: false`), impidiendo que una decisión no finalizada se marque como vigente o sobreescriba la evaluación histórica.
    - No se realizan llamadas duplicadas a Gemini ni se reevalúa innecesariamente.

### Defecto 4: Desplazamiento condicional en el chat
- **Archivo:** `frontend/src/modules/buyer/components/BuyerConversationPanel.tsx`
- **Diagnóstico v1:** En `submit()`, se llamaba incondicionalmente a `scrollToBottom(true)` antes de enviar, ignorando si el operador estaba leyendo mensajes anteriores. Además, `scrollIntoView()` arrastraba innecesariamente la página completa.
- **Corrección v2:**
  - Se eliminó la llamada incondicional a `scrollToBottom(true)` en `submit()`. El desplazamiento solo ocurre tras recibir el turno confirmado en `acceptTurn()`, condicionado a `!userScrolledUpRef.current`.
  - La función `scrollToBottom()` ahora realiza desplazamiento sobre el contenedor local (`messagesContainerRef.current.scrollTo({ top: scrollHeight, behavior })`), evitando mover la ventana o descolocar la vista de la ficha. Si el operador subió mientras esperaba respuesta, su posición se conserva y se muestra el botón "Ver mensajes nuevos".

---

## 2. Pruebas Añadidas y Resultados

### Backend (`backend/tests/buyerConversationAudit.test.ts`)
- Suite de autorización real añadida:
  - Token inventado $\rightarrow$ HTTP 401, chat inaccesible.
  - Token vencido $\rightarrow$ HTTP 401, chat inaccesible.
  - Usuario inactivo $\rightarrow$ HTTP 401, chat inaccesible.
  - Negociador sin asignación a la persona $\rightarrow$ HTTP 403, chat inaccesible.
  - Negociador con asignación $\rightarrow$ HTTP 200, autorizado.
  - Administrador $\rightarrow$ HTTP 200, autorizado.
- Resultado: **20/20 pruebas aprobadas** (100%).

### Frontend (`BuyerConversationPanel.test.tsx` y `BuyerDetailView.test.tsx`)
- Pruebas añadidas para `staffAuthService`:
  - 404 o error de red $\rightarrow$ rechazo sin conceder sesión.
  - Respuesta sin token válido $\rightarrow$ rechazo sin conceder sesión.
  - Respuesta incompleta sin datos de usuario $\rightarrow$ rechazo sin inventar datos.
  - `getSession()` rechaza perfil con solo email.
  - `logout()` envía DELETE al backend y limpia almacenamiento local.
- Pruebas añadidas para `BuyerDetailView`:
  - Turno `PROCESANDO` o `PENDIENTE` no marca `es_mensaje_vigente: true`.
  - Preservación de evaluación histórica y no ejecución de Gemini al actualizar chat.
- Resultado:
  - `BuyerConversationPanel.test.tsx`: **34/34 pruebas aprobadas**.
  - `BuyerConversationIntegration.test.tsx`: **2/2 pruebas aprobadas**.
  - `BuyerDetailView.test.tsx`: **10/10 pruebas aprobadas**.

---

## 3. Estado de Compilación

| Componente | Comando | Resultado |
|------------|---------|-----------|
| Backend | `npm --prefix backend run build` (`tsc`) | **Exit code 0** (Sin errores) |
| Frontend | `npm --prefix frontend run build` (`tsc && vite build`) | **Exit code 0** (Sin errores) |

---

## 4. Manifiesto y Empaquetado

- **Paquete:** `revision_chatbot_buyer_ajustes_visuales_v2.zip`
- **Diff:** `database/qa/buyer_chatbot_ajustes_visuales_v2/ajustes_v2.patch`
- **Evidencias:** `database/qa/buyer_chatbot_ajustes_visuales_v2/evidencias/`
- **Persona Sintética 11012:** Intacta, no modificada, sin mensajes nuevos ni alteraciones de turnos.
