# Implementación del agente LEAD

Chat web y Gemini con configuración propia de LEAD. La OLTP decide las operaciones; los reportes R1–R3 y las medidas M1–M8 conservan sus reglas. El trabajo se valida en QA y la instalación y activación productivas requieren autorización separada.

| Fase | Estado | Entregable verificable |
| --- | --- | --- |
| 1. Contratos y políticas | Validada en documentación | Entrada, salida, responsables y bloqueos definidos; acuerdos externos pendientes explícitos. |
| 2. Persistencia y seguridad | Núcleo validado en QA | Cola de ingreso, auditoría, permisos y recuperación. El almacenamiento de chat, herramientas, seguimiento y revisión se incorpora con sus flujos. |
| 3. Orquestador y F1 | Pendiente | Una ejecución recuperable por evento y una prioridad explicable. |
| 4. Chat web | Pendiente | Sesión vinculada, historial y mensajes sin duplicados. |
| 5. F2: alternativas | Pendiente | Opciones elegibles, revalidación e historial preservado. |
| 6. F3: negociación | Pendiente | Condiciones verificadas, versiones y evidencia de decisiones. |
| 7. F4: seguimiento | Pendiente | Límites por persona, parada, recuperación y revisión humana. |
| 8. F5: traspaso | Pendiente | Una reserva y un evento por traspaso autorizado, incluso ante reintentos. |
| 9. Integración y entrega | Pendiente | Prueba conjunta en QA, regresión de indicadores y paquete de activación. |

## Interfaces entre etapas

**Entrada.** Se conserva el [contrato BUYER → LEAD](CONTRATO_BUYER_LEAD.md). BUYER conserva mensaje, captación y trabajo pendiente; LEAD consume solo ingresos explícitos confirmados. No se incorporan solicitudes históricas por defecto. La prueba conjunta y el acceso al historial vinculado están pendientes.

**Salida.** LEAD prepara el expediente de una solicitud con la persona, la versión vigente aceptada de la propuesta, su importe, la alternativa aceptada, la revisión de las condiciones ofrecidas y la autorización expresa de reserva. La autorización queda ligada a esas condiciones y debe revalidarse antes de ejecutar. El traspaso existente ocupa la disponibilidad, crea la reserva pendiente, actualiza la etapa y registra el evento LEAD → PAYER en una transacción. La referencia estable devuelta al repetir la misma autorización es `id_reserva`.

PAYER recibe la reserva vinculada a `id_solicitud`, `id_persona` e `id_opcion`; la propuesta, autorización y evento se conservan como evidencia en sus relaciones de origen. La transición indica entrada a PAYER, no pago validado. PAYER debe confirmar este contrato en QA antes de la activación; no se añade una ruta paralela ni se delegan pagos o cobranza al agente LEAD. La operación antigua de reserva no es una herramienta del agente.

## Políticas y comportamiento por defecto

| Capacidad | Responsable de la definición | Mientras falte la política o evidencia |
| --- | --- | --- |
| F1: priorizar | LEAD; clínica para plazos y escalamiento | Ordenar por señales existentes en QA, sin inventar SLA ni probabilidades. |
| F2: recomendar y ofrecer | LEAD; clínica para excepciones de agenda | Recomendar disponibilidad elegible; no publicar si no se verifica vigencia o no está habilitada la comunicación. |
| F3: negociar | Clínica para precios, promociones y excepciones; LEAD para validar | Usar solo tarifas y condiciones verificables; sin descuentos supuestos. Objeción o silencio no acreditan rechazo. |
| F4: responder y seguir | Clínica para consentimiento, horarios, frecuencia y parada; LEAD para aplicar | Preparar borradores y tareas en QA; no automatizar contactos sin política vigente. Revocación detiene el seguimiento aplicable. |
| F5: preparar y transferir | Clínica para delegación; LEAD y PAYER para la interfaz | Preparar y mostrar bloqueos; sin transferencia autónoma hasta tener delegación y evidencia válida. |

Las políticas aprobadas deben tener versión, responsable y vigencia. La aceptación económica, la aceptación de la alternativa y la autorización de reserva se registran por separado. Un conflicto de identidad, agenda, precio o autorización se deriva al personal; el agente no completa la evidencia por inferencia. El envío se centraliza en el chat web, con estados verificables; el simulador legado no acredita contacto.

## Cola de ingreso en QA

Instalar [COLA_AGENTE_LEAD_QA.sql](COLA_AGENTE_LEAD_QA.sql) con SQLCMD y `-b` sobre `NexoSalud_LeadPruebas` después de instalar la recepción. La entrada nueva y su trabajo se guardan en la misma transacción. Las entradas anteriores a la migración no se encolan.

El ejecutor futuro usará una conexión independiente con el rol `rol_ejecutor_agente_lead`. Toma una tarea con un token temporal y resuelve el intento con ese mismo token. El plazo técnico predeterminado es de 60 segundos. Los fallos admiten hasta cinco intentos con espera creciente para reintentos explícitos. Al agotar intentos, la tarea queda en revisión. El token solo protege la resolución en la cola. Las futuras herramientas comerciales deben validar su propia idempotencia y vigencia antes de producir efectos.

En QA se instaló y reejecutó la migración y pasó `npm run test:lead:intake` con la cola presente. El ensayo verificó una sola toma entre ocho llamadas, recuperación después de expirar, rechazo del token anterior, finalización única y auditoría. Una prueba adicional con un usuario temporal confirmó los permisos de ejecución y la ausencia de acceso directo a las tablas comprobadas.
