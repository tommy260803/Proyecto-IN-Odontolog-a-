# MATRIZ DE ACTUALIZACIÓN DOCUMENTAL PROPUESTA PARA EL INFORME OFICIAL DE NEXOSALUD
**Documento Objetivo:** `INforme nexosalud (1).docx`  
**Módulo Focal:** Etapa BUYER (Párrafos 221 al 408 y secciones transversales)  
**Fecha:** 26 de Octubre de 2026  
**Rama:** `refactor/buyer-impulse-integral`  

---

## 1. PROPÓSITO

Esta matriz detalla las modificaciones exactas que deberán aplicarse al informe Word oficial de NexoSalud cuando se autorice la implementación del rediseño. Se indican los párrafos, tablas, figuras y secciones afectadas, el contenido original, el motivo del cambio y el texto/estructura propuesto.

---

## 2. MODIFICACIONES PLANIFICADAS POR SECCIÓN

### 2.1. Sección: Modelo Transaccional E-R General (§ 151–220)

- **Elemento Actual:** Tabla 2 (Entidades de la Base de Datos NexoSalud) y Figura 2 (Diagrama E-R General).
- **Problema:** No existe una entidad intermedia que modele los contactos comerciales independientes de una misma persona en el tiempo, forzando la sobrecarga de `Solicitudes` o `Personas`.
- **Modificación Propuesta:**
  - **AGREGAR:** Entidad `OportunidadesCaptacion` (o `BuyerOportunidades`), con atributos: `id_oportunidad` (PK), `id_persona` (FK), `id_canal`, `id_fuente`, `id_campana`, `id_servicio_interes`, `sede_preferida`, `estado_captacion` ('NUEVO', 'EN_CALIFICACION', 'CALIFICADO', 'CONVERTIDO_LEAD', 'DESCARTADO'), `motivo_descarte`, `fecha_captacion`, `fecha_primera_respuesta`, `fecha_cierre`.
  - **CONSERVAR:** `Personas` como núcleo maestro de identidad civil (DNI, nombres, apellidos, teléfono, correo) y `Interacciones` como log atómico omnicanal.
  - **MODIFICAR:** Texto explicativo de la Tabla 2 y actualización del enlace Mermaid en la Figura 2.

---

### 2.2. Sección: Delimitación y Registro en BUYER (§ 221–230, Tabla 3)

- **Elemento Actual:** Tabla 3 (Casos de Perfiles de Buyer) y campos permitidos.
- **Problema:** El código almacena campos de salud bucal (`PersonaSaludOdontologica`) en BUYER, violando el enunciado de que BUYER no recopila datos clínicos sensibles.
- **Modificación Propuesta:**
  - **CORREGIR:** Redactar explícitamente en el informe la restricción estricta de aislamiento de dominio: *“En la etapa BUYER queda terminantemente prohibida la captura y almacenamiento de datos clínicos, sintomatológicos o de anamnesis (como dolor, sangrado, prótesis). Dichas variables pertenecen exclusivamente a la anamnesis estructurada de la etapa CUSTOMER”*.
  - **MODIFICAR:** Ajustar la Tabla 3 para delimitar claramente los datos capturados en el formulario público: Nombres, Teléfono (WhatsApp 9 dígitos), Correo (opcional), Servicio de Interés preliminar, Sede de preferencia, Franja horaria y Consentimiento Expreso (Checkbox Ley 29733 con enlace a política de privacidad).

---

### 2.3. Sección: Criterio de Salida BUYER → LEAD (§ 226–227)

- **Elemento Actual:** Párrafo 226 y 227 sobre conversión.
- **Problema:** En el código actual, la captación web envía al prospecto directamente a LEAD, invalidando el proceso de captación de BUYER.
- **Modificación Propuesta:**
  - **CORREGIR:** Especificar la máquina de estados determinista de BUYER:
    1. `NUEVO` (Ingreso por canal web, llamada o redes sociales, validación sintáctica de datos).
    2. `EN_CALIFICACION` (Evaluación automática por el Agente de Marketing o asesor).
    3. `CALIFICADO` (Registro con datos completos, autorización confirmada e intención comercial identificada).
    4. `CONVERTIDO_LEAD` (Paso formal a negociación, inserción en `Solicitudes` y registro en `EventosEtapa`).
    5. `DESCARTADO` (Falta de respuesta, spam, datos falsos o rechazo explícito con motivo documentado).
  - Aclarar que la inserción en `Solicitudes` ocurre **únicamente cuando la oportunidad alcanza el estado CONVERTIDO_LEAD**, nunca durante el registro crudo inicial de BUYER.

---

### 2.4. Sección: Dimensionalización de BUYER (§ 331–337, Figura 4)

- **Elemento Actual:** Párrafo 332, 336 y Figura 4 (Análisis Dimensional de la Etapa Buyer).
- **Problema:** El informe menciona que el grano es "por contacto ingresado", pero la tabla física en SQL Server tiene una PK compuesta agregada sin grano por oportunidad y con `KeyServicio` y `KeyTipoPersona` en NULL y fuera de la PK. Además, `costo_atribuido_captacion` no está formalizado matemáticamente.
- **Modificación Propuesta:**
  - **MODIFICAR:** Rediseñar la definición de `Fact_CaptacionBuyer` adoptando la **Alternativa B: Grano por Oportunidad de Captación**:
    - **Clave Subrogada y Clave Natural:** `id_captacion_buyer` (PK Subrogada), `id_oportunidad_captacion` (Clave de Negocio con restricción UNIQUE).
    - **Dimensiones:** `KeyTiempoCaptacion` (Role-playing date), `KeyTiempoConversion` (Nullable para cohorte), `KeySede`, `KeyCanal`, `KeyFuente`, `KeyCampana`, `KeyServicioInteres`, `KeyTipoPersona`, `KeyEstadoRegistro`.
    - **Medidas:** `contacto_registrado` (1), `contacto_utilizable` (1 o 0 según Ley 29733 y validación), `conversion_lead` (1 si avanzó a LEAD, 0 si no), `tiempo_conversion_dia` (DATEDIFF en días entre captación y conversión), `costo_atribuido_captacion` (prorrateo de gastos de campaña vigentes sobre los contactos captados en el período).
  - **ACTUALIZAR:** Reemplazar el diagrama de Figura 4 con el nuevo esquema estrella conforme a Kimball y sintaxis estándar snake_case.

---

### 2.5. Sección: Indicadores de BUYER (§ 338–373, Tabla 5)

- **Elemento Actual:** Fórmulas y definiciones de B1, B2 y B3.
- **Problema:** Discrepancia entre la fórmula documental y el cálculo de la aplicación; B1 no contempla explícitamente el tratamiento de cohortes incompletas (sesgo de ventana inmadura); B3 utiliza costos inventados en memoria en el frontend.
- **Modificación Propuesta:**
  - **MODIFICAR B1 (Conversión a LEAD en 14 días):**
    - Especificar fórmula formal:
      $$\text{B1} = \frac{\sum \text{conversion\_lead (con } \text{tiempo\_conversion\_dia} \le 14\text{)}}{\sum \text{contacto\_utilizable (cohorte madura } \ge 14\text{ días)}} \times 100$$
    - Añadir regla de maduración de cohorte: Los contactos registrados con menos de 14 días respecto a la fecha de corte analítico no deben ser parte del denominador oficial de B1, o deben etiquetarse como "Cohorte en maduración", para no falsear el indicador a la baja.
  - **MODIFICAR B2 (Contactos Utilizables):**
    - Formalizar la condición binaria de utilizabilidad: Teléfono móvil válido de 9 dígitos + Nombre verificable + Consentimiento libre y previo registrado (`autoriza_contacto = 1` y `fecha_autorizacion IS NOT NULL`) + Sin duplicidad no resuelta (`estado_calidad = 'Valido'`).
  - **MODIFICAR B3 (Costo por LEAD Atribuible):**
    - Formalizar la atribución:
      $$\text{B3} = \frac{\sum \text{costo\_atribuido\_captacion (campañas vinculadas)}}{\sum \text{conversion\_lead (atribuibles a dichas campañas)}}$$
    - Eliminar la mención a costos por defecto y basar la medición estrictamente en la tabla `GastosCampana` del OLTP integrada al Data Mart.

---

### 2.6. Sección: Agente Inteligente de Marketing (§ 394–399, Figura 9)

- **Elemento Actual:** Descripción del Agente de Marketing y captura de pantalla Figura 9.
- **Problema:** En la implementación real el agente corre en el frontend, llama a modelos inexistentes, no tiene endpoint backend y nunca escribe en `DecisionesIA`.
- **Modificación Propuesta:**
  - **REESTRUCTURAR COMPLETAMENTE:**
    - Documentar la arquitectura cliente-servidor: Servicio backend `MarketingAgentService` ejecutado en Node.js, aislando la API key de Groq (o proveedor LLM) en el servidor.
    - Modelo LLM homologado: `llama-3.3-70b-versatile` o `llama-3.1-8b-instant` con fallback a motor determinista de reglas de negocio.
    - Persistencia obligatoria: Cada análisis del agente debe generar un registro auditable en `DecisionesIA` con `agente = 'MARKETING_AGENT'`, `entrada`, `regla_aplicada`, `decision`, `accion`, `requiere_revision`.
    - Matriz de gobernanza: Acciones autónomas (clasificación preliminar, sugerencia de sede, cálculo de score) vs. Acciones supervisadas (conversión forzada de casos dudosos, descarte definitivo de prospectos).

---

### 2.7. Sección: Impulse Alerts de BUYER (§ 400–408, Figura 10, Tabla de Alertas)

- **Elemento Actual:** Párrafos 401-405 y Figura 10.
- **Problema:** Alertas no tienen tabla en base de datos, no se muestran en el listado general y operan de forma pasiva dentro de un modal.
- **Modificación Propuesta:**
  - **AGREGAR TABLA:** Incluir en el informe la matriz formal de Impulse Alerts de BUYER:
    1. **ALT-BUY-01 (Registro Incompleto):** Prospecto captado sin teléfono de 9 dígitos o sin nombre. Disparador: Inmediato al registro. Acción: Notificación para completar datos.
    2. **ALT-BUY-02 (Posible Duplicado):** Coincidencia de teléfono, correo o DNI con registro preexistente. Acción: Presentar diálogo de desduplicación/resolución de identidad.
    3. **ALT-BUY-03 (Falta de Consentimiento):** Prospecto sin confirmación de Ley 29733. Acción: Bloqueo de contacto comercial masivo hasta regularización.
    4. **ALT-BUY-04 (Intención Ambigua):** Consulta que no expresa tratamiento ni requerimiento administrativo. Acción: Envío de flujo conversacional interactivo orientativo.
    5. **ALT-BUY-05 (SLA de Primera Respuesta en Riesgo):** Oportunidad en BUYER sin contacto inicial transcurridos 15 minutos. Severidad: Alta.
  - Diseñar la persistencia en tabla `AlertasOperativas` o consumo dinámico en cabecera del listado.
