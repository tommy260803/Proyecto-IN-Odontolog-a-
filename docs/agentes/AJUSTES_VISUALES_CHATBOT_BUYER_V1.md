# Ajustes Visuales y Centralización de Sesión — Chatbot Buyer Fase 3 Visual v1

**Fecha:** 2026-11-13  
**Rama:** `feature/buyer-orientacion-interactiva`  
**Entorno QA:** `DANIELPC / NexoSalud_LeadEnsayoFinal`  
**Sujeto de prueba reservado:** Persona sintética 11012 (Conversación `890e10a3-0799-4bf0-8830-c65a25f50dea`)

---

## 1. Resumen de Ajustes Implementados

### 1.1. Eliminación del Segundo Inicio de Sesión
- **Diagnóstico:** El panel `BuyerConversationPanel` exigía un login redundante por cada Buyer abierto o tras recargar la página, utilizando un `staffAuthService` simulado en `localStorage`.
- **Solución implementada:**
  - Se conectó `staffAuthService` con los endpoints reales de sesión comercial del backend: `POST /api/lead/commercial/staff/session` para login y `DELETE /api/lead/commercial/staff/session` para cierre de sesión con token Bearer.
  - Se creó el contexto global `StaffAuthContext` (`StaffAuthProvider`), integrado en la jerarquía general de la aplicación (`AppLayout` y `Header`).
  - Se eliminaron del componente `BuyerConversationPanel`: campos de correo y contraseña, botón «Acceder a conversación» y botón «Cerrar sesión del chat».
  - La sesión institucional se reutiliza entre diferentes fichas sin reautenticar y persiste de forma reactiva tras recargar la página.
  - El cierre de sesión general invalida inmediatamente el acceso al chatbot en todas las fichas.
  - Si no existe sesión activa, el panel muestra un aviso claro y un botón para abrir el modal institucional de autenticación.
  - Se conservan estrictamente las protecciones de idempotencia y retención de envíos inciertos y borradores rechazados por persona y operador.

### 1.2. Simplificación del Origen del Mensaje
- Se ocultó el selector desplegable de origen en el panel administrativo.
- El valor para los nuevos mensajes quedó fijado en `OPERADOR_TRANSCRIPTOR`.
- Se incorporó la leyenda explicativa: *«El operador transcribe la respuesta de la persona.»*
- Los orígenes históricos de mensajes previos se conservan íntegros sin alteración.

### 1.3. Unificación de Chatbot y Tarjeta de Actividades
- **Diagnóstico:** Al completar turnos en el chat o recargar la ficha, la tarjeta inferior de actividades del Agente Buyer permanecía en `SIN EVALUACIÓN` debido a que las consultas generales de la ficha excluían las interacciones de chat y sus decisiones asociadas.
- **Solución implementada:**
  - En `BuyerDetailView.tsx`, se integró `latestChatTurn` con la computación reactiva de `evaluacion`. El análisis persistido (`intencion`, `accion`, `explicacion`, `turnId`, `isChatTurn`, `entregaLeadEstado`, `id_solicitud`) se refleja inmediatamente en la tarjeta inferior sin requerir llamadas adicionales.
  - En `buyer.routes.ts` (`GET /:id` y `GET /`), se condicionó la lectura de interacciones y decisiones de chat a la presencia de un token de personal autorizado (`isStaffAuthorized`). Las solicitudes generales no autorizadas siguen sin exponer el contenido de los mensajes de chat confidenciales, cumpliendo con las guardas de seguridad y pruebas de contrato.
  - En `buyer.service.ts`, `getBuyerById`, `getAllBuyers` y `getBuyersPage` envían la cabecera `Authorization: Bearer <token>` de la sesión institucional, permitiendo restaurar el estado completo de la evaluación al recargar la página directamente desde SQL Server.
  - Se modificó la acción del botón «Actualizar» en la ficha: cuando existe conversación de chat (`hasChatConversation: true`), el botón sincroniza el estado persistido invalidando las consultas de TanStack Query sin ejecutar `evaluateBuyer.mutate`, evitando evaluaciones duplicadas con Gemini.

### 1.4. Desplazamiento Automático y Control de Posición (Scroll)
- Se añadieron referencias al contenedor (`messagesContainerRef`) y al ancla inferior (`messagesEndRef`).
- Se activa desplazamiento suave al fondo automáticamente al enviar un mensaje y al recibir una respuesta del asistente.
- Si el operador se encuentra leyendo mensajes anteriores (desplazamiento hacia arriba), el sistema respeta su posición y despliega un botón flotante accesible: *«Ver mensajes nuevos»* con icono de flecha descendente.
- Al reabrir conversaciones o paginar con *«Más turnos»*, se preserva la navegación sin saltos imprevistos.

### 1.5. Análisis y Corrección de Aclaración en Turno 227
- **Diagnóstico del turno 227:** La persona 11012 pasó de una consulta informativa inicial a solicitar atención médica explícita. El modelo detectó intención de reserva pero marcó pendientes `sede` y `horario`. El backend reaccionaba mecánicamente con un texto genérico y fragmentado: `"Necesitamos aclarar los datos pendientes o contradictorios antes de continuar. sede; horario. ¿Puedes aclararlos?"`.
- **Solución implementada:**
  - En `buyerMessageClassifier.ts`, se instruyó explícitamente al clasificador que un cambio de intención (de duda a cita) es legítimo y debe priorizarse el mensaje actual sobre el historial informativo.
  - En `buyerConversationService.ts`, se reemplazó la generación robótica de aclaraciones por preguntas naturales y específicas de agendamiento (consultando preferencia de sede y disponibilidad horaria) y explicaciones detalladas en caso de contradicciones reales.
  - No se debilitaron las validaciones de negocio ni se forzaron conversiones prematuras.

---

## 2. Archivos Modificados y Creados

### Backend
1. `backend/src/services/buyerMessageClassifier.ts`
2. `backend/src/services/buyerConversationService.ts`
3. `backend/src/routes/buyer.routes.ts`

### Frontend
4. `frontend/src/shared/services/staffAuthService.ts`
5. `frontend/src/shared/context/StaffAuthContext.tsx` *(creado)*
6. `frontend/src/app/providers/index.tsx`
7. `frontend/src/app/layouts/AppLayout.tsx`
8. `frontend/src/shared/components/layout/Header.tsx`
9. `frontend/src/modules/buyer/components/BuyerConversationPanel.tsx`
10. `frontend/src/modules/buyer/components/BuyerConversationPanel.test.tsx`
11. `frontend/src/modules/buyer/components/BuyerDetailView.tsx`
12. `frontend/src/modules/buyer/components/BuyerDetailView.test.tsx`
13. `frontend/src/modules/buyer/services/buyer.service.ts`

---

## 3. Verificación de Pruebas y Compilación

### Pruebas Frontend y Backend Ejecutadas
```powershell
npm --prefix frontend test -- `
  frontend/src/modules/buyer/components/BuyerConversationPanel.test.tsx `
  frontend/src/modules/buyer/components/BuyerConversationIntegration.test.tsx `
  frontend/src/modules/buyer/components/BuyerDetailView.test.tsx `
  backend/tests/buyerConversationRealQa.test.ts `
  backend/tests/buyerConversationAudit.test.ts `
  backend/tests/buyerConversation.test.ts `
  backend/tests/buyerMessageClassifier.test.ts
```
**Resultado:** 7 suites pasadas, 109 pruebas aprobadas, 4 omitidas (tests en vivo opt-in), 0 fallos.

### Compilación TypeScript
- **Backend (`npm --prefix backend run build`):** Salida 0, sin errores (`tsc`).
- **Frontend (`npm --prefix frontend run build`):** Salida 0, sin errores (`tsc && vite build`).

### Estado de la Base de Datos y Procesos
- Persona sintética 11012: sus 4 turnos (221, 223, 225, 227) y su estado BUYER permanecen intactos en `DANIELPC / NexoSalud_LeadEnsayoFinal`.
- Servidor backend aislado en ejecución: `http://127.0.0.1:3001` (`database/qa/buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs`).
- Frontend en ejecución: `http://127.0.0.1:5173`.
