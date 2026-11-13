# Documento de Aceptación Manual — Chatbot Buyer (Fase 3 QA v2)

Este documento registra los pasos y la matriz de comprobación para la prueba manual del chatbot Buyer en el entorno aislado de **DANIELPC / NexoSalud_LeadEnsayoFinal**.

> [!IMPORTANT]
> **Estado de los pasos:** Todos los pasos de interacción visual y aceptación funcional inician en estado **PENDIENTE** hasta recibir la ejecución y evidencia de Daniel. Las comprobaciones HTTP previas y de procesos no sustituyen la aceptación en pantalla.

---

## 1. Estado y Verificación de Servicios Locales

Los servicios requeridos ya se encuentran activos y corresponden estrictamente a las instancias aisladas del proyecto:

| Servicio | Puerto | PID | Proceso identificado | Estado |
|---|---|---|---|---|
| **Backend Aislado** | `127.0.0.1:3001` | **31432** | `node.exe database/qa/buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs` | **ACTIVO** (200 en `/api/buyer/catalogs`) |
| **Frontend Vite SPA** | `127.0.0.1:5173` | **12616** | `node.exe ... vite.js --host 127.0.0.1 --port 5173 --strictPort` | **ACTIVO** (200 en `/buyer/11012`) |

- **Reutilización:** Se reutilizan estos procesos existentes. No se arrancan servidores duplicados ni se usa `index.ts`.
- **Aislamiento:** El backend aislado mantiene las guardas hacia `DANIELPC / NexoSalud_LeadEnsayoFinal`, CORS restringido a `127.0.0.1:5173`, Mart Sync y Dunning inactivos, y rutas acotadas al flujo de conversación Buyer y sesión comercial.

---

## 2. Estado de la Persona Sintética 11012

Verificación efectuada mediante SELECT de solo lectura contra `NexoSalud_LeadEnsayoFinal`:

```json
{
  "id_persona": 11012,
  "etapa": "BUYER",
  "captaciones": 1,
  "interacciones": 0,
  "solicitudes": 0,
  "eventos": 0,
  "entradas": 0
}
```

- **Condición:** Persona 11012 permanece en etapa `BUYER`, sin interacciones, solicitudes, eventos ni entradas en la mesa LEAD.
- **Reserva:** Reservada exclusivamente para la prueba manual de Daniel desde el navegador.

---

## 3. Guía de Acceso, Credenciales y Reconocimiento de Sesión

### URLs para la prueba
- **Ficha principal (Persona 11012):** `http://127.0.0.1:5173/buyer/11012`
- **Ficha de comprobación PAYER (Persona 11007):** `http://127.0.0.1:5173/buyer/11007`

### Consulta local de la credencial protegida
La credencial generada reside fuera del repositorio en:
`%LOCALAPPDATA%\NexoSalud\QA\BuyerEnsayoFinal\credencial_buyer_qa_ensayofinal.json`

> [!CAUTION]
> No imprimir la contraseña en terminal ni incluirla en reportes, capturas o commits.

Formas seguras de consultarla localmente:
1. **Abrir con Notepad:**
   ```powershell
   notepad "$env:LOCALAPPDATA\NexoSalud\QA\BuyerEnsayoFinal\credencial_buyer_qa_ensayofinal.json"
   ```
2. **Copiar la contraseña directamente al portapapeles (sin imprimirla):**
   ```powershell
   Get-Content "$env:LOCALAPPDATA\NexoSalud\QA\BuyerEnsayoFinal\credencial_buyer_qa_ensayofinal.json" | ConvertFrom-Json | Select-Object -ExpandProperty password | Set-Clipboard
   ```
   *El correo asociado es:* `qa.buyer.chat.ensayofinal@example.invalid`

### Reconocimiento de sesión autorizada en el panel
1. **Sin autenticar:** En la tarjeta *«Conversación administrativa Buyer»* (columna derecha de la ficha), se muestra el formulario de ingreso solicitando *Correo del personal* y *Contraseña del personal*, con el botón *Acceder a conversación*.
2. **Autorizado exitosamente:**
   - El formulario desaparece.
   - En la cabecera del panel se visualiza el distintivo del usuario:
     `QA_BUYER_CHAT_ENSAYOFINAL CUENTA_SINTETICA_FASE3 · Administrador`
   - Se muestra el botón *Cerrar sesión del chat*.
   - Se habilitan las secciones *«Conversaciones guardadas»*, *«Historial persistido»*, y el formulario con el selector *«Origen del mensaje»* y el campo de texto con botón *«Enviar y evaluar»*.

---

## 4. Recorrido Paso a Paso y Matriz de Aceptación

### Paso A — Consulta informativa sobre evaluación odontológica
- **Objetivo:** Responder dudas clínicas/asistenciales manteniendo etapa BUYER sin registrar solicitudes.
- **Acción:**
  - En la ficha `http://127.0.0.1:5173/buyer/11012`, iniciar sesión en el panel de conversación.
  - Dejar origen: `Respuesta transcrita por el operador` (o cambiar a `Mensaje de la persona ingresado por el operador`).
  - Enviar mensaje:
    > «¿En qué consiste una evaluación odontológica? Solo quiero información, no deseo solicitar una cita.»
- **Observar en pantalla:**
  - Indicador de carga *«Esperando al servidor…»*.
  - Turno #1 creado con estado `COMPLETADA`.
  - Roles en mensajes: `Operador transcriptor` y `Asistente Buyer`.
  - Resumen al pie del turno: `Resultado persistido: SOLO_CONSULTA · Etapa: BUYER`.
  - No debe aparecer número de solicitud ni cambio a etapa LEAD.
- **SELECT de verificación posterior:**
  ```sql
  SELECT p.id_persona, e.nombre etapa,
         (SELECT COUNT(*) FROM dbo.Interacciones i WHERE i.id_persona = p.id_persona) interacciones,
         (SELECT COUNT(*) FROM dbo.Solicitudes s WHERE s.id_persona = p.id_persona) solicitudes
  FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa = p.id_etapa_actual
  WHERE p.id_persona = 11012;
  ```
  *Esperado:* `etapa: 'BUYER'`, `interacciones: 1`, `solicitudes: 0`.
- **Estado de aceptación:** `[PENDIENTE]`

---

### Paso B — Mensaje ambiguo y respuesta pertinente a la pregunta del agente
- **Objetivo:** Gestionar mensajes sin intención clara mediante aclaración, y continuar en la misma conversación sin forzar conversiones.
- **Acción:**
  - Enviar:
    > «Hola»
  - Observar respuesta del agente pidiendo aclaración (`ACLARACION · Etapa: BUYER`).
  - Responder en la misma conversación (sin abrir nueva conversación ni pulsar F5):
    > «Me refiero a evaluación odontológica; quiero información, todavía no quiero pedir una cita.»
- **Observar en pantalla:**
  - Turno intermedio de aclaración y nuevo turno con respuesta explicativa.
  - Ambos turnos quedan en `COMPLETADA` y `Etapa: BUYER`.
  - Cero solicitudes creadas.
- **SELECT de verificación posterior:**
  ```sql
  SELECT d.id_decision, JSON_VALUE(d.entrada,'$.status') estado,
         JSON_VALUE(d.entrada,'$.evaluation.accion') accion
  FROM dbo.DecisionesIA d WHERE d.id_persona = 11012 AND d.agente = 'BUYER_CHAT'
  ORDER BY d.id_decision;
  ```
- **Estado de aceptación:** `[PENDIENTE]`

---

### Paso C — Cambio explícito a solicitar una cita
- **Objetivo:** Convertir de forma legítima tras solicitud explícita de contacto/cita.
- **Acción:**
  - Enviar:
    > «Antes pedí información, pero ahora he decidido solicitar una cita de evaluación odontológica. Solicito expresamente que envíen mi solicitud para que me contacten; ya no busco solo información.»
  - *Si el modelo solicita preferencias de sede u horario:*
    Responder de forma natural sin forzar la reserva:
    > «No tengo sede ni horario preferidos. Deseo solicitar la evaluación odontológica y que el equipo me contacte para coordinar esos detalles. Solicito expresamente que envíen mi solicitud; no estoy reservando una fecha ni un horario.»
  - *Manejo de turno PENDIENTE:* Si por variabilidad del modelo el turno quedara con botón *«Reintentar turno»*, usar dicho botón sin escribir un mensaje nuevo.
- **Observar en pantalla:**
  - Turno finalizado con `COMPLETADA`.
  - Resumen del turno: `Resultado persistido: CONVERSION_LEAD · Etapa: LEAD · Solicitud #<ID> · Recepción LEAD: CONFIRMADA`.
  - La ficha del Buyer actualiza su estado o distintivo a `LEAD`.
- **Estado de aceptación:** `[PENDIENTE]`

---

### Paso D — Comprobar resultado persistido, solicitud/evento y recepción LEAD
- **Objetivo:** Verificar en base de datos la integridad referencial y el despacho completo a la mesa comercial LEAD.
- **Comprobación:**
  - Ejecutar:
    ```powershell
    node database/qa/buyer_chatbot_fase3_v2/resumen_sql_final.cjs
    ```
  - Comprobar que en la salida:
    - Persona 11012 aparece con: `etapa: "LEAD"`, `solicitudes: 1`, `eventos: 1`, `entradas: 1`.
    - En `vinculos`: `id_persona: 11012`, `id_solicitud` coincidente con `recepcion_solicitud`, `id_evento_etapa` coincidente con `recepcion_evento`.
- **Estado de aceptación:** `[PENDIENTE]`

---

### Paso E — Recargar, volver a iniciar sesión y reabrir historial
- **Objetivo:** Demostrar que el historial y la sesión son independientes del estado volátil del navegador y se recuperan fielmente desde SQL Server.
- **Acción:**
  - Pulsar *«Cerrar sesión del chat»* (o recargar el navegador con F5).
  - Verificar que el panel vuelve al estado inicial de login.
  - Ingresar nuevamente las credenciales locales.
  - En *«Conversaciones guardadas»*, hacer clic en la conversación listada.
- **Observar en pantalla:**
  - Recuperación íntegra de todos los turnos anteriores (#1, #2, #3, etc.) con sus textos exactos, roles y evaluaciones persistidas.
- **Estado de aceptación:** `[PENDIENTE]`

---

### Paso F — Consulta informativa en persona 11007 (PAYER)
- **Objetivo:** Garantizar que un cliente en etapa post-conversión (`PAYER`) no sufre regresión de etapa ni se le atribuyen solicitudes históricas previas a una consulta nueva.
- **Acción:**
  - Navegar a `http://127.0.0.1:5173/buyer/11007`.
  - Autenticar el panel con la misma credencial.
  - Enviar:
    > «¿En qué consiste una evaluación odontológica? Solo quiero información, no deseo solicitar una cita.»
- **Observar en pantalla:**
  - Respuesta informativa generada.
  - Resumen: `Resultado persistido: SOLO_CONSULTA · Etapa: PAYER`.
  - El distintivo de la persona permanece en `PAYER`.
- **SELECT de verificación posterior:**
  ```sql
  SELECT p.id_persona, e.nombre etapa,
         (SELECT COUNT(*) FROM dbo.Solicitudes s WHERE s.id_persona = p.id_persona) solicitudes,
         (SELECT COUNT(*) FROM dbo.EventosEtapa v WHERE v.id_persona = p.id_persona) eventos
  FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa = p.id_etapa_actual
  WHERE p.id_persona = 11007;
  ```
  *Esperado:* `etapa: 'PAYER'`, `solicitudes: 1` (la histórica 2929; ninguna nueva), `eventos: 1` (histórico 4101).
- **Estado de aceptación:** `[PENDIENTE]`

---

## 5. Resumen de Estados de Aceptación

| Caso | Descripción | Verificación Técnica Previa | Aceptación Visual Daniel |
|---|---|---|---|
| **A** | Consulta informativa en 11012 (BUYER conservado) | Aprobada por HTTP/SQL en arnés v2 | **PENDIENTE** |
| **B** | Saludo ambiguo + aclaración en misma conversación | Aprobada por HTTP/SQL en arnés v2 | **PENDIENTE** |
| **C** | Solicitud explícita de cita (Conversión a LEAD) | Aprobada por HTTP/SQL en arnés v2 | **PENDIENTE** |
| **D** | Trazabilidad SQL: Solicitud, Evento y Entrada LEAD | Aprobada por HTTP/SQL en arnés v2 | **PENDIENTE** |
| **E** | Logout, recarga F5, reingreso y carga de historial | Aprobada por HTTP/SQL en arnés v2 | **PENDIENTE** |
| **F** | Consulta informativa en 11007 (PAYER conservado) | Aprobada por HTTP/SQL en arnés v2 | **PENDIENTE** |
