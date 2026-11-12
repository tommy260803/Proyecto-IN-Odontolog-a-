# Pruebas de las 3 actividades del agente Buyer

## Objetivo

Comprobar desde el software que el agente Buyer:

1. Interpreta la necesidad clínica del prospecto.
2. Clasifica su intención y determina si está preparado para LEAD.
3. Recomienda la siguiente acción comercial.

Estas pruebas se realizan desde la interfaz, no desde comandos ni consultas SQL.

## ¿En qué consiste cada actividad?

### Actividad 1: Perfilamiento de Necesidad Clínica

El agente interpreta el mensaje vigente del paciente y lo relaciona con el perfil registrado. Identifica el servicio o necesidad expresada y permite comparar el mensaje con la sede y el horario preferidos.

Responde:

> **¿Qué necesidad clínica o servicio expresa el paciente?**

### Actividad 2: Clasificación de Intención y Preparación para LEAD

El agente clasifica la intención del mensaje, por ejemplo `SOLICITA_RESERVA`, `SOLO_CONSULTA` o `AMBIGUA`. También determina si el contacto está preparado para avanzar a LEAD o si debe permanecer en BUYER.

Responde:

> **¿Qué quiere el paciente y puede avanzar en el embudo?**

### Actividad 3: Recomendación del Agente Buyer

El agente propone la siguiente acción según la clasificación anterior: solicitar una aclaración, brindar información, mantener el contacto en BUYER o iniciar la conversión a LEAD. Si la conversión ya ocurrió, muestra el resultado ejecutado y el siguiente paso en LEAD, no una recomendación pendiente.

Responde:

> **¿Qué debe hacerse a continuación?**

## Preparación

1. Abrir NexoSalud e ingresar al módulo **Buyer**.
2. Crear un Buyer de prueba con:
   - Nombres y apellidos completos.
   - Teléfono válido.
   - Servicio de interés.
   - Sede y horario preferidos.
   - Autorización de contacto marcada.
   - Un mensaje en **Motivo Concreto de Consulta**.
3. Abrir el detalle del Buyer.
4. Pulsar **Actualizar** en la tarjeta **Agente Buyer (Gemini)**.
5. Esperar a que finalice el análisis.

> La autorización es un requisito del formulario. Si no se marca, el sistema no permite crear el Buyer; por eso estas pruebas se concentran en el análisis del mensaje.

## Prueba 1: Necesidad clínica concreta

### Datos

Registrar como motivo:

> Quiero una evaluación odontológica porque tengo dolor en una muela y deseo saber si hay citas esta semana.

### Resultado esperado por actividad

En **1. Perfilamiento de Necesidad Clínica**:

- Se identifica la evaluación odontológica como servicio.
- Se reconoce el dolor como una necesidad o urgencia.
- Se muestran las preferencias registradas de sede y horario.
- Si el mensaje contradice el horario registrado, aparece una alerta de discrepancia.

En **2. Clasificación de Intención y Preparación para LEAD**:

- La intención se clasifica como comercial concreta o `SOLICITA_RESERVA`.
- El mensaje se reconoce como una solicitud de atención.
- Si cumple las reglas del proceso, se indica que puede avanzar a LEAD.

En **3. Recomendación del Agente Buyer**:

- Si todavía está en BUYER, recomienda iniciar la conversión a LEAD o asignar atención comercial.
- Si ya fue convertido, muestra que la conversión fue ejecutada y recomienda continuar la negociación y el agendamiento desde LEAD.

## Prueba 2: Clasificación de intención y preparación para LEAD

Usar el mismo Buyer y cambiar el motivo a:

> Deseo reservar una evaluación odontológica para esta semana.

Guardar los cambios y pulsar **Actualizar**.

### Resultado esperado por actividad

En **1. Perfilamiento de Necesidad Clínica**:

- Se identifica la evaluación odontológica como servicio.
- Se conserva la sede y el horario registrados como contexto del perfil.

En **2. Clasificación de Intención y Preparación para LEAD**:

- La intención aparece como `SOLICITA_RESERVA` o equivalente comercial.
- El mensaje se reconoce como concreto.
- Se indica que el contacto está preparado para avanzar a LEAD, si cumple las reglas del proceso.

En **3. Recomendación del Agente Buyer**:

- Antes de convertir, recomienda proceder con la transferencia a LEAD.
- Después de convertir, muestra que la conversión fue ejecutada y que el siguiente paso es continuar la negociación en LEAD.

> Para observar la recomendación previa a la conversión, realiza esta prueba con un Buyer nuevo. Una vez convertido, el sistema muestra el resultado ejecutado.

## Prueba 3: Mensaje ambiguo

Cambiar el motivo a:

> Hola, buenas tardes.

Guardar y pulsar **Actualizar**.

### Resultado esperado por actividad

En **1. Perfilamiento de Necesidad Clínica**:

- No se identifica un servicio concreto.
- El perfil registrado se conserva, pero el agente no lo presenta como una intención confirmada.

En **2. Clasificación de Intención y Preparación para LEAD**:

- La intención aparece como `AMBIGUA`.
- Se indica que el contacto debe permanecer en BUYER.

En **3. Recomendación del Agente Buyer**:

- Recomienda solicitar una aclaración.
- No recomienda convertir automáticamente a LEAD.

## Prueba 4: Diferenciar consulta informativa de intención comercial

Cambiar el motivo a:

> ¿Cuánto cuesta una limpieza dental?

Guardar y pulsar **Actualizar**.

### Resultado esperado por actividad

En **1. Perfilamiento de Necesidad Clínica**:

- Identifica la limpieza dental como el servicio consultado.
- Muestra la sede y el horario registrados como contexto, si existen.

En **2. Clasificación de Intención y Preparación para LEAD**:

- La clasificación debe ser `SOLO_CONSULTA` o equivalente informativa.
- Se indica que todavía no existe una solicitud concreta de reserva.

En **3. Recomendación del Agente Buyer**:

- El agente debe recomendar brindar información de precios o del servicio.
- No debe recomendar una conversión inmediata a LEAD únicamente por preguntar el precio.

## Prueba 5: Comparación de resultados

Realizar las pruebas con Buyers separados cuando una prueba pueda convertir el registro a LEAD. Pulsar **Actualizar** después de cada cambio.

| Mensaje | Actividad 1: necesidad | Actividad 2: intención | Actividad 3: recomendación |
|---|---|---|---|
| “Quiero una evaluación porque tengo dolor.” | Evaluación y posible urgencia | Intención comercial concreta | Avanzar a atención comercial o LEAD |
| “Deseo reservar una evaluación.” | Servicio y solicitud de reserva | `SOLICITA_RESERVA` | Iniciar transferencia a LEAD |
| “Hola, buenas tardes.” | Necesidad no identificada | `AMBIGUA` | Solicitar aclaración |
| “¿Cuánto cuesta una limpieza?” | Servicio consultado | `SOLO_CONSULTA` | Brindar información, sin conversión automática |

La evidencia principal es que las tres tarjetas cambian según el mensaje y no repiten siempre la misma respuesta.

## Lista de comprobación para la demostración

- [ ] El agente muestra el mensaje evaluado.
- [ ] La actividad 1 interpreta la necesidad y la relaciona con el perfil.
- [ ] La actividad 2 cambia según la intención del mensaje.
- [ ] La actividad 2 distingue una intención concreta de un saludo ambiguo.
- [ ] La actividad 3 recomienda una acción diferente según el resultado.
- [ ] Después de una conversión, la actividad 3 muestra el resultado ejecutado y el siguiente paso en LEAD.
- [ ] Un mensaje ambiguo permanece en BUYER.
- [ ] Una consulta informativa no se presenta automáticamente como reserva.
- [ ] El botón **Actualizar** muestra un estado de procesamiento.
- [ ] El resultado se conserva al volver a abrir la ficha.
- [ ] El historial muestra la interacción evaluada.

## Explicación breve para el docente

> La primera actividad interpreta la necesidad clínica; la segunda clasifica la intención y determina si el prospecto está preparado para avanzar a LEAD; la tercera recomienda la acción comercial. Por ello, el agente no solo valida datos registrados: transforma el mensaje del paciente en una decisión de atención trazable.

Los indicadores de Buyer complementan este flujo: la clasificación y la recomendación apoyan la conversión BUYER → LEAD, mientras que la calidad del registro permite determinar qué contactos son utilizables.
