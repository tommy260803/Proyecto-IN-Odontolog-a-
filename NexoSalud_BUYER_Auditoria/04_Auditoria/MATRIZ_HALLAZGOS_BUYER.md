# MATRIZ INTEGRAL DE HALLAZGOS TÉCNICOS — AUDITORÍA FASE BUYER NEXOSALUD

**Proyecto:** NexoSalud (Gestión Odontológica & BI bajo Metodología IMPULSE)  
**Fase Auditada:** BUYER (Identificación, Captación, Calificación y Conversión Inicial)  
**Fecha:** 26 de Octubre de 2026  
**Rama de Trabajo:** `refactor/buyer-impulse-integral`  
**Commit Base:** `44f07012f1e8f475444f5fec5c91fee3d94728f2` (origin/main: `1c712156b54cd339037e9e2ac9cee482e248a307`)  

---

## 1. CONVENCIONES DE CLASIFICACIÓN

- **Capas Afectadas:** `FUNCIONAL`, `FRONTEND`, `BACKEND_API`, `OLTP_BD`, `DIMENSIONAL_MART`, `ETL_DATOS`, `AGENTE_IA`, `IMPULSE_ALERTS`, `KPIS_BI`, `SEGURIDAD_LEGAL`.
- **Severidad:** `CRÍTICA`, `ALTA`, `MEDIA`, `BAJA`.
- **Prioridad de Corrección:** `P1 (Inmediata / Bloqueante)`, `P2 (Alta / Esencial)`, `P3 (Media / Estabilización)`, `P4 (Baja / Optimización)`.
- **Estado de Evidencia:** `CONFIRMADO`, `NO REPRODUCIDO`, `PENDIENTE DE VERIFICACIÓN`, `PROPUESTA DE MEJORA`.

---

## 2. MATRIZ DETALLADA DE HALLAZGOS

### [HAL-BUY-01] Auto-conversión Inmediata a LEAD en Formulario Web Saltando la Fase BUYER
- **Capa Afectada:** `BACKEND_API` / `FUNCIONAL`
- **Componente / Archivo:** `backend/src/routes/buyer.routes.ts` (L333, L337-346) y `src/modules/buyer/pages/BuyerRequestInfoPage.tsx` (L512-535).
- **Requisito del Informe Word:** § 224 y 226: El usuario ingresa como BUYER. Solo pasa a LEAD si expresa una intención concreta tras evaluación; si realiza consultas generales permanece en BUYER.
- **Comportamiento Esperado:** Al llenar el formulario web, la persona debe crearse en estado `BUYER` (`id_etapa_actual = 1`) y generar una oportunidad de captación en estado `NUEVO` o `EN_EVALUACION`.
- **Implementación Encontrada:** El endpoint `POST /api/buyer/register` asigna directamente `id_etapa_actual = etapaLead.id_etapa` y crea inmediatamente un registro en `EventosEtapa` con `etapa_origen = BUYER` y `etapa_destino = LEAD` en el mismo segundo de la creación.
- **Evidencia Verificable:**
  ```typescript
  // backend/src/routes/buyer.routes.ts L333-345
  persona = await tx.personas.create({
    data: {
      ...
      id_etapa_actual: etapaLead.id_etapa, // <-- ASIGNA DIRECTAMENTE LEAD
    }
  });
  await tx.eventosEtapa.create({
    data: {
      id_persona: persona.id_persona,
      etapa_origen: etapaBuyer.id_etapa,
      etapa_destino: etapaLead.id_etapa,
      motivo: 'Solicitud de información concreta (Ingreso web inicial)',
    }
  });
  ```
- **Tipo de Problema:** Defecto arquitectónico y violación de máquina de estados.
- **Severidad:** CRÍTICA.
- **Impacto:** Ningún usuario captado por la web existe en la fase BUYER; pasan a LEAD sin calificación. El indicador B1 (conversión en 14 días) queda distorsionado con tiempo de conversión = 0 días para todos los registros web.
- **Causa Raíz:** Simplificación apresurada para conectar el formulario web con la mesa de negociación de LEAD sin implementar la máquina de estados de BUYER.
- **Solución Recomendada:** Modificar `POST /api/buyer/register` para que cree el registro con `id_etapa_actual = etapaBuyer.id_etapa`, persistiendo la oportunidad en BUYER. La conversión a LEAD debe ocurrir tras evaluación automática del Agente de Marketing o por acción del operador.
- **Alternativas Consideradas:** Permitir un flag `autoConvert` solo si el formulario web incluye solicitud formal de reserva, pero se descartó para respetar estrictamente la metodología IMPULSE.
- **Dependencias:** `backend/src/routes/buyer.routes.ts`, `src/modules/buyer/pages/BuyerRequestInfoPage.tsx`.
- **Riesgo de Implementación:** Medio (requiere ajustar la vista de LEAD para que no espere que todo registro web aparezca de inmediato en negociación).
- **Prioridad:** P1.
- **Prueba de Aceptación:** Enviar solicitud desde el formulario web; verificar en BD que `id_etapa_actual = 1` (BUYER) y no exista evento de conversión a LEAD hasta que se cumpla el criterio formal.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-02] Forzado Artificial de Consentimiento Legal al Convertir a LEAD (Vulneración Ley 29733)
- **Capa Afectada:** `BACKEND_API` / `SEGURIDAD_LEGAL`
- **Componente / Archivo:** `backend/src/routes/buyer.routes.ts` (L980).
- **Requisito del Informe Word:** § 282, 307: La autorización de contacto es obligatoria conforme a la Ley de Protección de Datos Personales N° 29733. El consentimiento debe ser libre, previo, expreso e informado.
- **Comportamiento Esperado:** Si un prospecto no otorgó autorización de datos, el sistema debe alertar (`Falta Autorización`) y no debe permitir el avance a LEAD hasta que el usuario la brinde formalmente.
- **Implementación Encontrada:** En el endpoint `POST /api/buyer/:id/convert`, el backend actualiza forzosamente `autoriza_contacto: true` y genera `fecha_autorizacion` con la fecha actual, falseando el consentimiento del paciente en la base de datos.
- **Evidencia Verificable:**
  ```typescript
  // backend/src/routes/buyer.routes.ts L976-984
  await tx.personas.update({
    where: { id_persona: numId },
    data: {
      id_etapa_actual: etapaLead.id_etapa,
      autoriza_contacto: true, // <-- FORZADO AUTOMÁTICO ILEGAL
      fecha_autorizacion: personaActual.fecha_autorizacion || new Date(),
      fecha_actualizacion: new Date(),
    }
  });
  ```
- **Tipo de Problema:** Vulnerabilidad legal y adulteración de trazabilidad de consentimiento.
- **Severidad:** CRÍTICA.
- **Impacto:** Exposición de la clínica a sanciones administrativas por la Autoridad Nacional de Protección de Datos Personales (MINJUS Perú) bajo la Ley 29733; corrompe la validez del indicador B2 (Contactos Utilizables).
- **Causa Raíz:** Bypass implementado para evitar que el validador de LEAD rechace prospectos sin autorización.
- **Solución Recomendada:** Eliminar la sobreescritura automática. Si `autoriza_contacto` es falso, rechazar la conversión con HTTP 422 ("No es posible transferir a LEAD un prospecto sin consentimiento informado registrado").
- **Alternativas Consideradas:** Enviar mensaje interactivo de WhatsApp solicitando la aceptación antes de permitir el botón de conversión.
- **Dependencias:** `backend/src/routes/buyer.routes.ts`, `src/modules/buyer/components/BuyerDetailModal.tsx`.
- **Riesgo de Implementación:** Bajo.
- **Prioridad:** P1.
- **Prueba de Aceptación:** Intentar convertir a LEAD un prospecto con `autoriza_contacto = false`; el endpoint debe responder error 422 y no modificar la BD.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-03] Ejecución del Agente de Marketing en Frontend y Exposición de Credenciales Groq
- **Capa Afectada:** `AGENTE_IA` / `SEGURIDAD_LEGAL` / `BACKEND_API`
- **Componente / Archivo:** `src/shared/services/groqService.ts` (L1-20, L315-340, L555-595).
- **Requisito del Informe Word:** § 394–399: Agente Inteligente de Marketing ejecuta 4 actividades clave (validación de datos, perfilamiento, atribución y evaluación de intención comercial) y gobierna la transición.
- **Comportamiento Esperado:** El agente de IA debe residir en un servicio de backend seguro (`MarketingAgentService`), consumiendo la API de inferencia sin exponer credenciales al cliente y registrando sus inferencias en la base de datos transaccional.
- **Implementación Encontrada:** El agente se ejecuta íntegramente en el navegador web del usuario a través de `groqService.ts`, leyendo `import.meta.env.VITE_GROQ_API_KEY`. No existe ningún endpoint de IA para BUYER en Express.
- **Evidencia Verificable:**
  ```typescript
  // src/shared/services/groqService.ts L555-585
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (apiKey && apiKey !== 'tu_groq_api_key_aqui' && ...) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { ... });
  }
  ```
- **Tipo de Problema:** Fuga de secretos, arquitectura invertida (Business Logic en frontend) e inoperabilidad sin frontend abierto.
- **Severidad:** CRÍTICA.
- **Impacto:** Fuga de la API Key en el bundle JavaScript de producción (cualquier visitante puede extraerla en DevTools); imposibilidad de ejecutar automatizaciones en background; las llamadas directas a la API omiten el agente.
- **Causa Raíz:** Prototipado frontend que no fue migrado a la capa de servicios backend.
- **Solución Recomendada:** Crear `backend/src/services/marketingAgentService.ts` y el endpoint `POST /api/buyer/:id/analyze-ai`. Mover los prompts y la llamada a Groq al backend, leyendo `process.env.GROQ_API_KEY`.
- **Alternativas Consideradas:** Implementar un proxy de backend, pero es preferible un servicio de dominio completo que orqueste reglas y LLM.
- **Dependencias:** `backend/.env`, `backend/src/routes/buyer.routes.ts`.
- **Riesgo de Implementación:** Medio.
- **Prioridad:** P1.
- **Prueba de Aceptación:** Inspeccionar el bundle frontend en busca de `GROQ_API_KEY` (debe ser inexistente); invocar endpoint backend de análisis y verificar respuesta JSON estructurada.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-04] Declaración de Modelos Inexistentes en Groq y Fallback Silencioso Oculto
- **Capa Afectada:** `AGENTE_IA`
- **Componente / Archivo:** `src/shared/services/groqService.ts` (L2).
- **Requisito del Informe Word:** § 220, 394: Modelo Groq LLM como motor de inferencia analítica.
- **Comportamiento Esperado:** Invocación a modelos reales soportados por Groq Cloud (ej. `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`).
- **Implementación Encontrada:** La lista de modelos configurada en código contiene nombres no existentes en la API de Groq:
  ```typescript
  // src/shared/services/groqService.ts L2
  const GROQ_MODELS = ['groq/compound-mini', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];
  ```
  Al llamar a Groq con estos IDs, la API devuelve HTTP 404 / 400 (`model_not_found`). El bloque `try/catch` captura el fallo sin emitir error y activa el fallback a un clasificador basado en expresiones regulares y palabras clave fijas (`commercialKeywords`).
- **Tipo de Problema:** Defecto de integración externa y fallo simulado silencioso.
- **Severidad:** CRÍTICA.
- **Impacto:** El sistema nunca ejecuta inferencia real con LLM, operando como un motor puramente determinista bajo la falsa apariencia de un agente de inteligencia artificial generativa.
- **Causa Raíz:** Nombres de modelos inventados o copiados de una especificación preliminar no validada contra la documentación oficial de Groq.
- **Solución Recomendada:** Homologar los modelos a `llama-3.3-70b-versatile` (modelo principal de alta capacidad) y `llama-3.1-8b-instant` (modelo de baja latencia para fallback).
- **Alternativas Consideradas:** Uso de SDK oficial `@groq/groq-sdk` en Node.js.
- **Dependencias:** `src/shared/services/groqService.ts`, configuración backend.
- **Riesgo de Implementación:** Bajo.
- **Prioridad:** P1.
- **Prueba de Aceptación:** Ejecutar llamada de prueba con `llama-3.3-70b-versatile`; verificar respuesta HTTP 200 con tokens consumidos.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-05] Tabla `DecisionesIA` Inerte con Cero Registros en Base de Datos
- **Capa Afectada:** `OLTP_BD` / `AGENTE_IA`
- **Componente / Archivo:** `database/init_oltp.sql` (L596-617) y base de datos SQL Server `NexoSaludDB`.
- **Requisito del Informe Word:** § 220: `DecisionesIA`: Registro de inferencias y sugerencias generadas por modelos de IA; campos: agente, fecha_hora, entrada, regla_aplicada, decisión, acción, requiere_revisión.
- **Comportamiento Esperado:** Cada ejecución del Agente de Marketing que evalúe duplicidad, intención o conversión debe persistir una tupla en `DecisionesIA` para auditoría médica y comercial.
- **Implementación Encontrada:** La consulta `SELECT COUNT(*) FROM DecisionesIA` en SQL Server arroja **0 registros**. Ningún archivo de backend ejecuta `prisma.decisionesIA.create()`.
- **Evidencia Verificable:**
  Salida del script `inspect-dbs.ts`:
  `- DecisionesIA: 0 rows`
  Búsqueda con `git grep`: solo aparece en el DDL y `schema.prisma`.
- **Tipo de Problema:** Funcionalidad documentada pero no implementada en persistencia.
- **Severidad:** ALTA.
- **Impacto:** Cero auditabilidad de las recomendaciones de IA; imposibilidad de medir precisión, falsos positivos o supervisión humana en producción.
- **Causa Raíz:** Como el agente corría en el navegador, no se implementó el puente de persistencia hacia el backend.
- **Solución Recomendada:** En el nuevo servicio de backend de IA, insertar automáticamente en `DecisionesIA` la entrada sanitizada, el prompt hash, el resultado JSON y la acción sugerida.
- **Alternativas Consideradas:** Logging a archivos de texto, pero viola el modelo relacional del proyecto.
- **Dependencias:** `backend/src/routes/buyer.routes.ts`, `prisma/schema.prisma`.
- **Riesgo de Implementación:** Bajo.
- **Prioridad:** P2.
- **Prueba de Aceptación:** Evaluar un prospecto; verificar que `SELECT COUNT(*) FROM DecisionesIA` aumente en 1 con datos consistentes.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-06] Invasión del Dominio Clínico en BUYER: Captura Indebida de Anamnesis Dental
- **Capa Afectada:** `OLTP_BD` / `FRONTEND` / `BACKEND_API`
- **Componente / Archivo:** `database/init_oltp.sql` (L208-225), `backend/src/routes/buyer.routes.ts` (L758-773), `src/modules/buyer/components/BuyerForm.tsx`.
- **Requisito del Informe Word:** § 223, 225: La etapa BUYER solo recopila datos básicos de contacto. *“En esta fase no se realizan diagnósticos ni se recopila información clínica detallada”*.
- **Comportamiento Esperado:** El formulario de BUYER no debe incluir campos clínicos ni insertar registros en tablas médicas.
- **Implementación Encontrada:** Se agregó la tabla `PersonaSaludOdontologica` con campos de dolor, sensibilidad, tratamientos previos, prótesis y sangrado, los cuales se exponen en el formulario de creación de BUYER y se guardan en el backend.
- **Evidencia Verificable:**
  ```sql
  -- database/init_oltp.sql L208-220
  CREATE TABLE PersonaSaludOdontologica (
      ultima_visita_odontologica VARCHAR(50) NULL,
      nivel_dolor VARCHAR(20) NULL,
      presenta_sensibilidad VARCHAR(10) NULL,
      sangrado_o_inflamacion VARCHAR(30) NULL,
      usa_aparato_o_protesis VARCHAR(30) NULL, ...
  );
  ```
- **Tipo de Problema:** Contaminación de límites de dominio (Bounded Context) de IMPULSE.
- **Severidad:** ALTA.
- **Impacto:** Fricción excesiva en el registro de captación; captura injustificada de datos de salud sin profesional odontólogo colegiado asignado; contradicción con el marco teórico del informe oficial.
- **Causa Raíz:** Confusión sobre en qué etapa debe realizarse el triaje odontológico preliminar.
- **Solución Recomendada:** Remover los campos de `PersonaSaludOdontologica` del flujo de BUYER. Dichos campos deben capturarse únicamente en LEAD (mesa de negociación) o CUSTOMER (anamnesis de box). En BUYER solo se conserva `servicio_de_interes` y `motivo_consulta` administrativo.
- **Alternativas Consideradas:** Dejar los campos como opcionales en BUYER, pero se rechaza porque distorsiona la métrica de captación limpia.
- **Dependencias:** `BuyerForm.tsx`, `BuyerDetailView.tsx`, `buyer.routes.ts`.
- **Riesgo de Implementación:** Medio (requiere ajustar componentes que renderizan estos inputs).
- **Prioridad:** P2.
- **Prueba de Aceptación:** Registrar un prospecto en BUYER sin campos médicos; validar que no se inserte tupla en `PersonaSaludOdontologica`.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-07] Ausencia de Entidad `OportunidadesCaptacion` y Colisión de Prospectos Recurrentes
- **Capa Afectada:** `OLTP_BD` / `FUNCIONAL`
- **Componente / Archivo:** `backend/src/routes/buyer.routes.ts` (L231-306), `database/init_oltp.sql`.
- **Requisito del Informe Word:** § 161, 203: `Personas` es el núcleo de identidad único; un usuario puede interactuar múltiples veces en el tiempo sin duplicar su identidad.
- **Comportamiento Esperado:** Relación `Personas (1) -> OportunidadesCaptacion (0..N)`. Si Juan Pérez vuelve a escribir 6 meses después, se genera una nueva oportunidad comercial sin corromper sus solicitudes previas ni crear un segundo Juan Pérez.
- **Implementación Encontrada:** No existe `OportunidadesCaptacion`. El sistema utiliza un parámetro ad-hoc `isNewPersonConfirmed`. Si es falso, sobreescribe los campos de la persona preexistente y anexa a `Solicitudes`. Si es verdadero, crea una persona duplicada con el mismo teléfono.
- **Tipo de Problema:** Deficiencia de modelamiento relacional.
- **Severidad:** ALTA.
- **Impacto:** Imposibilidad de medir cohortes de retorno en captación; ambigüedad entre la persona física y la oportunidad comercial; riesgo de sobreescribir consentimientos o atribuciones de origen.
- **Causa Raíz:** Se intentó resolver la captación vinculando directamente `Personas` con `Interacciones` y `Solicitudes`, saltándose el concepto de oportunidad.
- **Solución Recomendada:** Incorporar la entidad `OportunidadesCaptacion` con clave propia, vinculando `id_persona`, `id_canal`, `id_fuente`, `id_campana`, `estado` y `fecha_captacion`.
- **Alternativas Consideradas:** Reutilizar `Solicitudes`, pero `Solicitudes` ya tiene lógica y relaciones complejas acopladas a la agenda de citas y cotizaciones de LEAD (`Opciones`, `Reservas`).
- **Dependencias:** Esquema OLTP, migración Prisma, servicios backend.
- **Riesgo de Implementación:** Medio-Alto.
- **Prioridad:** P2.
- **Prueba de Aceptación:** Una persona existente registra un nuevo interés por un tratamiento distinto; se crea 1 fila en `OportunidadesCaptacion` vinculada al mismo `id_persona`.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-08] Granularidad Inconsistente y Atributos Desconectados en `Fact_CaptacionBuyer`
- **Capa Afectada:** `DIMENSIONAL_MART`
- **Componente / Archivo:** `database/init_mart.sql` (L174-192), `database/etl_populate_mart.sql` (L436-505).
- **Requisito del Informe Word:** § 332: Grano de captación por contacto; medidas aditivas `contacto_registrado`, `contacto_utilizable`, `conversion_lead` y semiaditivas `tiempo_conversion_dia`, `costo_atribuido_captacion`.
- **Comportamiento Esperado:** Grano inequívoco a nivel de oportunidad comercial o contacto individual, con claves foráneas a todas las dimensiones declaradas (incluyendo `Dim_Servicio` y `Dim_TipoPersona`).
- **Implementación Encontrada:** La tabla física en SQL Server tiene una PK compuesta agregada: `(KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro)`. Las dimensiones `KeyServicio` y `KeyTipoPersona` están como columnas NULL y no forman parte de la PK. Además, en los 71 registros actuales de la BD, `KeyServicio` y `KeyTipoPersona` tienen valor `NULL`.
- **Evidencia Verificable:**
  Salida de `check-after-etl.ts`:
  ```javascript
  {
    KeyTiempo: 20260205, KeySede: 1, KeyServicio: null, KeyCanal: 1, KeyFuente: 1,
    KeyTipoPersona: null, KeyEstadoRegistro: 1, contacto_registrado: 1, ...
  }
  ```
- **Tipo de Problema:** Diseño dimensional híbrido defectuoso (mezcla de tabla transaccional y agregado periódico mal definido).
- **Severidad:** ALTA.
- **Impacto:** Imposibilidad de cruzar captación con servicios demandados en el Data Mart; reportes BI no pueden desglosar por categoría de tratamiento en BUYER.
- **Causa Raíz:** Se creó la PK compuesta para evitar duplicados en el ETL agrupando filas, sacrificando el grano fino por servicio.
- **Solución Recomendada:** Reestructurar `Fact_CaptacionBuyer` con grano por Oportunidad de Captación (`id_captacion_buyer` PK subrogada, `id_oportunidad` clave de negocio UNIQUE). Incluir `KeyServicio` y `KeyTipoPersona` con manejo de miembro 'No especificado' (Key 0) en lugar de NULL.
- **Alternativas Consideradas:** Grano por interacción (generaría explosión de filas innecesaria) o agregado diario (no permite cruces analíticos por paciente).
- **Dependencias:** `init_mart.sql`, `etl_populate_mart.sql`.
- **Riesgo de Implementación:** Medio.
- **Prioridad:** P2.
- **Prueba de Aceptación:** Poblar el Mart; verificar que no existan NULLs en claves de dimensiones y que `KeyServicio` refleje el servicio de interés del prospecto.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-09] Medida `costo_atribuido_captacion` Nula en Data Mart y Costos Hardcodeados en Cliente
- **Capa Afectada:** `DIMENSIONAL_MART` / `ETL_DATOS` / `KPIS_BI`
- **Componente / Archivo:** `database/etl_populate_mart.sql` (L450-462), `src/domain/indicators/index.ts` (L178-230).
- **Requisito del Informe Word:** § 336, 349: `costo_atribuido_captacion` prorratea el gasto publicitario de campañas para calcular el CAC y B3.
- **Comportamiento Esperado:** El proceso ETL debe calcular la fracción del gasto de `GastosCampana` atribuible a cada contacto del período y poblar la columna en la tabla de hechos.
- **Implementación Encontrada:** En SQL Server, `costo_atribuido_captacion` tiene valor `0.00` en todos los registros. Para mostrar el KPI B3, el frontend recurre a un diccionario estático en memoria en TypeScript con valores ficticios (`DEFAULT_SOURCE_COSTS: Facebook: 500, Google: 400...`).
- **Tipo de Problema:** Proceso ETL incompleto y cálculo analítico simulado en frontend.
- **Severidad:** ALTA.
- **Impacto:** El Data Mart no provee información financiera de captación; el KPI B3 mostrado en pantalla no refleja el gasto real registrado en contabilidad/marketing.
- **Causa Raíz:** Falta de desarrollo del algoritmo de prorrateo temporal y de campaña en el script T-SQL del ETL.
- **Solución Recomendada:** Implementar en el ETL una CTE de prorrateo que distribuya el total mensual de `GastosCampana` entre los contactos válidos captados por dicha campaña en el mismo mes.
- **Alternativas Consideradas:** Atribución directa por clic/lead desde API de Meta/Google Ads, pero el proyecto maneja gastos consolidados en `GastosCampana`.
- **Dependencias:** `database/etl_populate_mart.sql`, `src/domain/indicators/index.ts`.
- **Riesgo de Implementación:** Medio.
- **Prioridad:** P2.
- **Prueba de Aceptación:** Ejecutar ETL; verificar que la suma de `costo_atribuido_captacion` en `Fact_CaptacionBuyer` concilie exactamente con `SUM(importe)` en `GastosCampana` para campañas activas.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-10] Reglas Frágiles y Cruce Erróneo en Script ETL de BUYER
- **Capa Afectada:** `ETL_DATOS`
- **Componente / Archivo:** `database/etl_populate_mart.sql` (L464-473).
- **Requisito del Informe Word:** § 318, 320: Trazabilidad rigurosa de origen y sede.
- **Comportamiento Esperado:** La sede debe resolverse por la relación directa en BD (`Sedes` o `PersonaPreferencias.sede_preferida`), y la fuente debe cruzarse con `Fuentes` (`id_fuente`).
- **Implementación Encontrada:**
  1. Mapeo hardcodeado de urbanizaciones de Trujillo en SQL:
     ```sql
     ds.id_sede = CASE 
       WHEN p.zona IN ('Centro Histórico', 'Centro Historico', 'El Recreo', 'Florencia de Mora', ...) THEN 1
       WHEN p.zona IN ('California', 'Víctor Larco Herrera', ...) THEN 2
       WHEN p.zona IN ('El Golf') THEN 3 ELSE 0 END
     ```
  2. Join cruzado conceptualmente incorrecto:
     ```sql
     LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Fuente] df ON p.id_campana_origen = df.id_campana
     ```
- **Tipo de Problema:** Error lógico de base de datos y fragilidad ante nuevos datos.
- **Severidad:** ALTA.
- **Impacto:** Si un paciente vive en Huanchaco pero se atiende en la Sede Centro, el hecho registra California. La dimensión `Dim_Fuente` queda mal vinculada cuando el origen es orgánico (sin campaña).
- **Causa Raíz:** Atajo de transformación para poblar rápidamente datos sintéticos de prueba.
- **Solución Recomendada:** Reemplazar el `CASE` de zonas por la preferencia declarada en `PersonaPreferencias.sede_preferida` (o sede de asignación), y separar limpiamente `Dim_Fuente` (`id_fuente`) de `Dim_Campana` (`id_campana`).
- **Alternativas Consideradas:** Mantener zona como dimensión geográfica independiente.
- **Dependencias:** `etl_populate_mart.sql`, estructura del Mart.
- **Riesgo de Implementación:** Bajo.
- **Prioridad:** P2.
- **Prueba de Aceptación:** Probar prospectos sin zona o con sedes específicas; verificar correspondencia exacta en el Mart.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-11] Cálculo de KPIs en Memoria Frontend Bypaseando el Data Mart
- **Capa Afectada:** `KPIS_BI` / `FRONTEND`
- **Componente / Archivo:** `src/domain/indicators/index.ts` (L54-250) y `src/modules/buyer/components/BuyerListView.tsx` (L236-275).
- **Requisito del Informe Word:** § 340 (Tabla 5) y § 388 (Figura 8): Los indicadores B1, B2 y B3 se calculan a partir de `NexoSalud_Mart.dbo.fact_captacion_buyer`.
- **Comportamiento Esperado:** Las tarjetas de KPI del módulo BUYER deben consumir un endpoint analítico del backend que consulte las medidas agregadas de `Fact_CaptacionBuyer`.
- **Implementación Encontrada:** El frontend ejecuta funciones de JavaScript sobre el array de objetos traído de `/api/buyer` (datos transaccionales OLTP). Además, las tendencias visuales (`+12.4%`, `+4.2%`, `+1.8%`) están quemadas como strings estáticos en el JSX de `BuyerListView.tsx`.
- **Tipo de Problema:** Arquitectura analítica desconectada e indicadores simulados.
- **Severidad:** CRÍTICA.
- **Impacto:** Si la base transaccional tiene 10,000 registros, el frontend intentará descargar todos en JSON para calcular porcentajes en el navegador, provocando congelamiento de la interfaz; total inutilidad del Data Mart para los KPIs operativos de cabecera.
- **Causa Raíz:** Desacoplamiento entre el equipo de frontend y el equipo de base de datos durante el desarrollo de los sprints.
- **Solución Recomendada:** Crear endpoint `GET /api/reports/kpis/buyer` que consulte directamente `Fact_CaptacionBuyer` mediante T-SQL optimizado y devuelva los valores consolidados, semáforos y tendencias MoM reales.
- **Alternativas Consideradas:** Mantener cálculo dual (OLTP para tiempo real de hoy, Mart para histórico cerrado).
- **Dependencias:** `backend/src/routes/report.routes.ts`, `useReportsData.ts`.
- **Riesgo de Implementación:** Medio.
- **Prioridad:** P1.
- **Prueba de Aceptación:** Cambiar datos en el Mart y verificar que las tarjetas de KPI en la pantalla de BUYER se actualicen automáticamente sin descargar el listado transaccional.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-12] Ausencia de Mecanismo Centralizado de Impulse Alerts para BUYER
- **Capa Afectada:** `IMPULSE_ALERTS` / `FRONTEND` / `BACKEND_API`
- **Componente / Archivo:** `src/modules/buyer/components/BuyerDetailModal.tsx` (L263-287), `src/modules/buyer/components/BuyerListView.tsx`.
- **Requisito del Informe Word:** § 400–407: Matriz de 4 Impulse Alerts para detectar desvíos proactivamente (Incompleto, Duplicado, Falta autorización, Intención ambigua).
- **Comportamiento Esperado:** Un panel de monitoreo de alertas o contador proactivo visible en la lista de BUYER que permita al equipo administrativo filtrar y resolver anomalías en lote.
- **Implementación Encontrada:** No existe alerta consolidada. Las alertas solo se evalúan como badges estéticos individuales dentro del modal de detalle cuando se abre un paciente específico. En la pantalla principal no se visualiza ninguna alerta.
- **Tipo de Problema:** Requisito funcional parcialmente simulado en UI.
- **Severidad:** ALTA.
- **Impacto:** Los asesores comerciales no pueden enterarse de prospectos con intención ambigua o falta de datos sin hacer clic individualmente en cada fila de la tabla.
- **Causa Raíz:** Falta de un servicio de evaluación de reglas de alerta en backend.
- **Solución Recomendada:** Implementar un endpoint `GET /api/buyer/alerts` que compute las 4 alertas documentadas y las presente en un banner superior interactivo con filtros directos.
- **Alternativas Consideradas:** Tareas programadas (cron) que envíen notificaciones por correo o WhatsApp al equipo de marketing.
- **Dependencias:** `backend/src/routes/buyer.routes.ts`, `BuyerListView.tsx`.
- **Riesgo de Implementación:** Bajo.
- **Prioridad:** P2.
- **Prueba de Aceptación:** Registrar un prospecto sin teléfono; verificar que el contador de "Registros Incompletos" en la cabecera del listado se incremente inmediatamente.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-13] Filtrado Ambiguo en `GET /api/buyer` que Retorna Pacientes de Fases Avanzadas
- **Capa Afectada:** `BACKEND_API`
- **Componente / Archivo:** `backend/src/routes/buyer.routes.ts` (L451-458, L507-511).
- **Requisito del Informe Word:** § 375–380: Listado de prospectos en evaluación comercial de la fase BUYER.
- **Comportamiento Esperado:** La consulta de BUYER debe listar exclusivamente registros que pertenecen o se originaron en la etapa BUYER y su estado comercial dentro del embudo de captación.
- **Implementación Encontrada:** La cláusula `where` en Prisma incluye:
  ```typescript
  where: {
    OR: [
      { id_campana_origen: { not: null } },
      { id_canal_origen: { not: null } },
      { Etapa: { nombre: { in: ['BUYER', 'LEAD'] } } }
    ]
  }
  ```
  Como casi todas las personas registradas en la clínica tienen `id_canal_origen` asignado, la consulta trae pacientes que ya están en PAYER, CUSTOMER o TURNED, mapeándolos artificialmente con `state = 'CONVERTED'`.
- **Tipo de Problema:** Lógica de filtrado de base de datos defectuosa.
- **Severidad:** MEDIA.
- **Impacto:** La tabla de BUYER se sobrecarga con todo el histórico clínico de la clínica, ralentizando las consultas y mezclando pacientes ya fidelizados con prospectos en captación.
- **Causa Raíz:** Falta de separación entre la entidad Persona y la entidad Oportunidad de Captación.
- **Solución Recomendada:** Filtrar por `id_etapa_actual = 1` o por oportunidades de captación activas/archivadas del período.
- **Alternativas Consideradas:** Añadir un parámetro `?includeHistorical=true` para auditorías especiales.
- **Dependencias:** `backend/src/routes/buyer.routes.ts`.
- **Riesgo de Implementación:** Bajo.
- **Prioridad:** P3.
- **Prueba de Aceptación:** Verificar que un paciente atendido en TURNED no aparezca en la lista operativa de nuevos prospectos de BUYER a menos que tenga una nueva oportunidad abierta.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-14] Ausencia Total de Autenticación y Autorización en Endpoints de BUYER
- **Capa Afectada:** `SEGURIDAD_LEGAL` / `BACKEND_API`
- **Componente / Archivo:** `backend/src/routes/buyer.routes.ts` (L70, L202, L446, L629, L786, L958, L1024).
- **Requisito del Informe Word:** § 190–192: Roles operativos (Administrador, Marketing, Negociador).
- **Comportamiento Esperado:** Los endpoints administrativos de listado, edición, conversión y eliminación deben estar protegidos por middleware de autenticación (JWT/Sesión) y validar que el rol tenga permisos de Marketing o Administración.
- **Implementación Encontrada:** Todos los endpoints en `buyer.routes.ts` son completamente públicos. Cualquier cliente HTTP externo puede invocar `DELETE /api/buyer/1` o `GET /api/buyer` sin credenciales, extrayendo datos personales o purgando registros.
- **Tipo de Problema:** Vulnerabilidad de seguridad crítica (OWASP API1: Broken Object Level Authorization & API2: Broken Authentication).
- **Severidad:** CRÍTICA.
- **Impacto:** Exposición total de la base de datos de pacientes (DNI, nombres, teléfonos, correos) a internet; riesgo de borrado malicioso sin trazabilidad.
- **Causa Raíz:** Desarrollo rápido sin middlewares de seguridad aplicados en la capa de enrutamiento.
- **Solución Recomendada:** Aplicar middleware `requireAuth` y `requireRole(['Administrador', 'Marketing'])` a todas las rutas de `buyer.routes.ts`, excepto al webhook/endpoint de captura pública que debe contar con rate limiting y validación de captcha/token CSRF.
- **Alternativas Consideradas:** Protección por API Key de servicio.
- **Dependencias:** `backend/src/routes/buyer.routes.ts`, módulo de autenticación.
- **Riesgo de Implementación:** Medio.
- **Prioridad:** P1.
- **Prueba de Aceptación:** Enviar petición GET o DELETE sin token Bearer; el servidor debe rechazar con HTTP 401 Unauthorized.
- **Estado de Evidencia:** CONFIRMADO.

---

### [HAL-BUY-15] Desfase en la Definición de Cohortes Maduras para el Indicador B1
- **Capa Afectada:** `KPIS_BI` / `DIMENSIONAL_MART`
- **Componente / Archivo:** `src/domain/indicators/index.ts` (L54-125), `database/init_mart.sql`.
- **Requisito del Informe Word:** § 347, 355: B1 mide la proporción de contactos utilizables que se convierten en LEAD dentro de los 14 días.
- **Comportamiento Esperado:** Para calcular una tasa de conversión en ventana fija (14 días), solo deben considerarse prospectos cuya fecha de registro sea anterior a hoy menos 14 días (cohorte cerrada/madura), o reportar el sesgo de maduración.
- **Implementación Encontrada:** El código frontend toma todos los BUYERs registrados (incluso los registrados ayer) y los incluye en el denominador (`evaluableCount++`). Si se registraron ayer y aún no convierten, cuentan como no convertidos, castigando artificialmente la tasa de conversión.
- **Tipo de Problema:** Sesgo metodológico de Business Intelligence en cálculo de cohortes.
- **Severidad:** MEDIA.
- **Impacto:** Falsa alarma en el indicador B1 (marca semáforo rojo permanentemente cuando hay alto volumen de registros recientes).
- **Causa Raíz:** No se implementó el filtro temporal de maduración de cohortes en la función `calculateB1`.
- **Solución Recomendada:** Incorporar la condición `differenceInDays(now, buyerDate) >= CONVERSION_WINDOW_DAYS` para el denominador de la cohorte formal, o calcular B1 separando "Cohortes Maduras" de "Cohortes Activas en Ventana".
- **Alternativas Consideradas:** Modelo Kaplan-Meier de supervivencia, pero excede la complejidad del proyecto.
- **Dependencias:** `src/domain/indicators/index.ts`, diseño dimensional.
- **Riesgo de Implementación:** Bajo.
- **Prioridad:** P3.
- **Prueba de Aceptación:** Generar prospectos con 2 días de antigüedad; validar que no penalicen el ratio oficial de conversión a 14 días.
- **Estado de Evidencia:** CONFIRMADO.
