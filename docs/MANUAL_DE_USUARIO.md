# MANUAL DE USUARIO

## NexoSalud

**Sistema de gestión e inteligencia de negocios para la etapa BUYER**  
**Versión:** 0.0.0


## ÍNDICE GENERAL

### Contenido

- [A) PANTALLA PÚBLICA, LOGIN Y REGISTRO](#a-pantalla-pública-login-y-registro)
  1. [Portal público y acceso del personal](#1-portal-público-y-acceso-del-personal)
  2. [Registro público de solicitud BUYER](#2-registro-público-de-solicitud-buyer)
- [B) ETAPA BUYER](#b-etapa-buyer)
  1. [Prospectos de Admisión (BUYER)](#1-prospectos-de-admisión-buyer)
  2. [Registrar Nuevo Prospecto (BUYER)](#2-registrar-nuevo-prospecto-buyer)
  3. [Ficha de Prospecto](#3-ficha-de-prospecto)
  4. [Actividades del Agente Buyer](#4-actividades-del-agente-buyer)
  5. [Indicadores de la etapa BUYER](#5-indicadores-de-la-etapa-buyer)

---

## Acceso, perfiles y alcance

NexoSalud dispone de un portal público y de un acceso de personal mediante la opción **Personal**. El frontend declara los perfiles **Administrador Clínico**, **Administrador**, **Negociador Clínico**, **Coordinadora de Admisión** y **Especialista / Staff**. La etapa BUYER está orientada al personal que registra, revisa y califica prospectos para determinar si deben continuar en BUYER o convertirse a LEAD. Actualmente las rutas internas se encuentran disponibles desde el layout principal y no existe un guard global que restrinja cada pantalla por rol; por ello, el acceso efectivo debe administrarse según la configuración y las reglas operativas definidas por la clínica.

## A) PANTALLA PÚBLICA, LOGIN Y REGISTRO

### 1. Portal público y acceso del personal

La pantalla inicial presenta la información comercial de NexoSalud, los tratamientos odontológicos, la tecnología, las sedes y los medios de contacto. Desde la navegación pública, el visitante puede seleccionar **Solicitar información**, comunicarse por WhatsApp o seleccionar **Personal** para abrir la ventana **Iniciar sesión en NexoSalud**. El acceso del personal permite ingresar con las credenciales disponibles y seleccionar el destino interno; si la información no cumple las validaciones de acceso, se muestra un mensaje de error y no se inicia la sesión. La pantalla también puede mostrar el estado de la sesión activa y la opción para cerrar sesión.

**Figura 1**  
*Pantalla del Portal público y acceso del personal*

![Figura 1 - Pantalla del Portal público y acceso del personal](./capturas/01-portal-acceso-personal.png)

### 2. Registro público de solicitud BUYER

El portal público contiene el formulario de **Solicitud de información / orientación odontológica**, mediante el cual una persona puede iniciar su registro como Buyer. El formulario solicita los datos de identificación y contacto, el motivo de consulta, el servicio de interés y la autorización de contacto y tratamiento de datos. Al enviar la información, el sistema valida los campos obligatorios, verifica las condiciones de duplicidad disponibles y registra la solicitud en la etapa BUYER; si falta un dato, el contacto no autoriza la comunicación o existe un problema de registro, se muestra el mensaje correspondiente y no se completa la operación.

**Figura 2**  
*Formulario público de solicitud BUYER*

![Figura 2 - Formulario público de solicitud BUYER](./capturas/02-registro-publico-buyer.png)

## B) ETAPA BUYER

### 1. Prospectos de Admisión (BUYER)

La pantalla **Prospectos de Admisión (BUYER)** presenta las tarjetas de indicadores **B1 · Conversión a LEAD en 14 días**, **B2 · Contactos utilizables** y **B3 · Tiempo promedio de conversión**, seguidas del listado de prospectos captados. B1 muestra las conversiones dentro de 14 días divididas entre los Buyers utilizables; B2 muestra los contactos utilizables divididos entre los contactos registrados; B3 muestra los días acumulados divididos entre las conversiones con fecha válida. El usuario puede buscar por nombre, documento, correo, teléfono, canal, campaña o servicio; filtrar por estado, canal y rango de fechas; seleccionar el número de filas por página y navegar entre páginas. El botón **Registrar Prospecto** abre el formulario interno de alta. En cada fila se puede abrir el detalle, usar **Convertir** cuando el registro está preparado para avanzar y abrir **Más acciones**. Al confirmar una conversión válida, el sistema cambia el registro desde BUYER a LEAD y muestra un mensaje de éxito; los errores de carga, validación o conversión se notifican en la misma pantalla.

**Figura 3**  
*Pantalla de Prospectos de Admisión (BUYER)*

![Figura 3 - Pantalla de Prospectos de Admisión (BUYER)](./capturas/03-listado-buyer.png)

**Figura 4**  
*Indicadores de la etapa BUYER*

![Figura 4 - Indicadores de la etapa BUYER](./capturas/04-indicadores-buyer.png)

### 2. Registrar Nuevo Prospecto (BUYER)

La pantalla **Registrar Nuevo Prospecto (BUYER)** contiene los campos de nombres, apellidos, documento, teléfono, correo, servicio de interés, sede preferida, canal, fuente de atracción, motivo concreto de consulta y autorización de contacto y tratamiento de datos. Los campos obligatorios deben completarse con el formato solicitado y la autorización es necesaria para crear el registro; además, el sistema puede advertir si el teléfono, correo o documento coincide con otro contacto. Al seleccionar **Registrar Prospecto (BUYER)** o **Guardar Prospecto**, se valida la información y se crea el contacto en la etapa BUYER junto con su contexto inicial. Si faltan datos, el formato no es válido, no existe autorización o se detecta una condición que impide el registro, la pantalla muestra el mensaje de validación y conserva el formulario para su corrección.

**Figura 5**  
*Pantalla de Registrar Nuevo Prospecto (BUYER)*

![Figura 5 - Pantalla de Registrar Nuevo Prospecto (BUYER)](./capturas/05-nuevo-buyer.png)

**Figura 6**  
*Validación de autorización y duplicidad del registro BUYER*

![Figura 6 - Validación de autorización y duplicidad del registro BUYER](./capturas/06-validacion-nuevo-buyer.png)

### 3. Ficha de Prospecto

La **Ficha de Prospecto** muestra los datos personales, los medios de contacto, el servicio de interés, la sede, el horario, el canal, el origen, el motivo vigente, el estado de calidad, las preferencias, el historial y la trazabilidad del contacto. Desde las acciones superiores se puede seleccionar **Convertir a LEAD**, editar la información, guardar cambios, abrir el historial, eliminar el prospecto o iniciar el contacto por WhatsApp cuando existe un número disponible. El botón **Actualizar** solicita una nueva evaluación del mensaje vigente y guarda el resultado del agente; si las preferencias o el mensaje cambiaron después de la evaluación anterior, la pantalla indica que el resultado está desactualizado. La conversión solicita confirmación y puede mostrar una advertencia cuando la intención es ambigua; una conversión válida actualiza la etapa y notifica el resultado.

**Figura 7**  
*Pantalla de Ficha de Prospecto*

![Figura 7 - Pantalla de Ficha de Prospecto](./capturas/07-ficha-buyer.png)

**Figura 8**  
*Edición de datos de la Ficha de Prospecto*

![Figura 8 - Edición de datos de la Ficha de Prospecto](./capturas/08-edicion-ficha-buyer.png)

### 4. Actividades del Agente Buyer

La sección **Actividades del Agente Buyer** organiza el análisis en tres actividades: **Perfilamiento de la necesidad clínica**, **Clasificación de intención y preparación para LEAD** y **Recomendación del Agente Buyer**. La primera separa el servicio, la sede, el horario y la necesidad expresada; la segunda muestra la intención detectada y si el contacto está preparado para avanzar; la tercera presenta el resultado, la recomendación, el estado y el siguiente paso. Para evaluar o reevaluar se selecciona **Actualizar**; el sistema utiliza el mensaje vigente y el contexto registrado, persiste la decisión y muestra una indicación si no hay evaluación, si existe un mensaje nuevo o si la evaluación quedó desactualizada. Antes de convertir se muestra una recomendación pendiente; después de convertir, se informa que la conversión a LEAD fue ejecutada. La autorización de contacto no es una actividad del agente, porque constituye un requisito previo del registro BUYER.

**Figura 9**  
*Actividades del Agente Buyer con evaluación completada*

![Figura 9 - Actividades del Agente Buyer con evaluación completada](./capturas/09-actividades-agente-buyer.png)

**Figura 10**  
*Evaluación Buyer pendiente o desactualizada*

![Figura 10 - Evaluación Buyer pendiente o desactualizada](./capturas/10-evaluacion-buyer-pendiente.png)

### 5. Indicadores de la etapa BUYER

Las tarjetas superiores se calculan sobre el conjunto de registros que corresponde al período y filtros seleccionados, no únicamente sobre las filas visibles de la página. **B1 · Conversión a LEAD en 14 días** divide los contactos BUYER utilizables convertidos dentro de los 14 días entre el total de contactos BUYER utilizables y expresa el resultado en porcentaje. **B2 · Contactos utilizables** divide los contactos que cuentan con identificación, medio de contacto, autorización y calidad válida entre todos los contactos registrados. **B3 · Tiempo promedio de conversión** divide los días acumulados entre el registro y la conversión entre el total de conversiones con fecha válida. Cada tarjeta muestra el resultado y su división para facilitar la interpretación; cuando no existe información suficiente, el sistema muestra **N/D** en lugar de fabricar un porcentaje o un promedio.

**Figura 11**  
*Detalle de la división de los indicadores BUYER*

![Figura 11 - Detalle de la división de los indicadores BUYER](./capturas/11-formulas-indicadores-buyer.png)

