# INFORME TÉCNICO INTEGRAL DE AUDITORÍA Y REDISEÑO DE LA FASE BUYER DE NEXOSALUD

**Proyecto:** NexoSalud — Sistema de Gestión Odontológica e Inteligencia de Negocios  
**Metodología:** IMPULSE (Buyer → Lead → Payer → Customer → Turned)  
**Institución / Caso:** Clínica Odontológica Luxedent (Trujillo, Perú)  
**Equipo Auditor:** Equipo Multidisciplinario Senior (Full-Stack, DBA SQL Server, BI/DWH Data Engineer, AI/LLM Engineer, QA & Sec)  
**Fecha:** 26 de Octubre de 2026  
**Rama Git:** `refactor/buyer-impulse-integral`  
**Commit de Referencia Base:** `44f07012f1e8f475444f5fec5c91fee3d94728f2` (sincronizado con origin/main `1c71215`)  

---

## 1. RESUMEN EJECUTIVO

NexoSalud ha sido concebido como una plataforma unificada para la gestión clínica y analítica de centros odontológicos privados, implementando la metodología **IMPULSE**. Dentro de este ciclo, la etapa **BUYER** constituye el punto crítico de entrada: su misión es captar prospectos interesados en servicios dentales, validar su identidad y medios de contacto, registrar su consentimiento legal conforme a la **Ley N° 29733 de Protección de Datos Personales de Perú**, clasificar preliminarmente su demanda y calificar su intención comercial antes de movilizar los recursos de agenda médica en **LEAD**.

La presente auditoría integral examinó exhaustivamente el código fuente (frontend React/Vite y backend Express/Prisma), los esquemas de bases de datos relacionales (`NexoSaludDB`) y dimensionales (`NexoSalud_Mart`), los procedimientos ETL en T-SQL, los scripts de prueba y el **Informe Oficial en Word** (`INforme nexosalud (1).docx`).

### Principales Conclusiones del Diagnóstico:
1. **Aspectos Operativos y Logros Actuales:** La base de datos SQL Server está en línea con catálogos consolidados (Sedes, Canales, Fuentes, Servicios, Roles). El frontend cuenta con interfaces visualmente atractivas (landing interactivo, stepper de viaje y listados responsivos). La matriz ejecutiva del Data Mart (`ExecutiveMatrixTable.tsx`) se conecta y pivotea dinámicamente datos desde `Fact_CaptacionBuyer`.
2. **Defectos Críticos Identificados:**
   - **Salto Ilegal de Etapa:** El formulario web público (`POST /api/buyer/register`) auto-convierte a todos los prospectos directamente a LEAD (`id_etapa_actual = 2`) en el instante de su creación, dejando vacía la fase BUYER y distorsionando a cero el tiempo de conversión.
   - **Forzado Artificial de Consentimiento Legal:** El endpoint `POST /api/buyer/:id/convert` sobreescribe `autoriza_contacto = true` de manera automática, vulnerando la Ley N° 29733.
   - **Fuga de Credenciales y Simulación de IA:** El Agente de Marketing corre en el navegador del cliente (`groqService.ts`), exponiendo `VITE_GROQ_API_KEY` en el bundle JS. Además, utiliza nombres de modelos inexistentes en Groq (`groq/compound-mini`, `qwen/qwen3.8-27b`), lo que hace fallar siempre la API y caer silenciosamente en heurísticas fijas. La tabla `DecisionesIA` en SQL Server tiene **cero registros**.
   - **Invasión de Dominio Clínico:** BUYER captura variables de anamnesis médica (dolor, prótesis, sangrado en `PersonaSaludOdontologica`), violando el marco de IMPULSE.
   - **KPIs Desconectados del Data Mart:** Las tarjetas de KPI del listado se calculan en memoria en el navegador mediante JavaScript, con tendencias quemadas en código (`+12.4%`) y costos de marketing hardcodeados (`DEFAULT_SOURCE_COSTS`).
   - **Granularidad Híbrida en el Mart:** `Fact_CaptacionBuyer` posee una clave primaria compuesta agregada por día/sede, dejando `KeyServicio` y `KeyTipoPersona` en `NULL` en el 100% de las filas de la base real y registrando `costo_atribuido_captacion = 0.00`.

Se formuló una **Arquitectura Objetivo** basada en la entidad relacional `OportunidadesCaptacion`, un esquema estrella con grano por oportunidad comercial, un servicio seguro de Agente IA en backend con persistencia en `DecisionesIA` y endpoints analíticos directos desde el Data Mart.

---

## 2. ALCANCE Y METODOLOGÍA DE REVISIÓN

La auditoría cubrió el recorrido de extremo a extremo del dato:
$$\text{Captación Web / Admisión} \longrightarrow \text{API Backend} \longrightarrow \text{OLTP SQL Server} \longrightarrow \text{ETL T-SQL} \longrightarrow \text{Data Mart} \longrightarrow \text{Dashboards BI}$$

### Técnicas Empleadas:
- **Inspección de Código Estático:** Rastreo de flujo de ejecución en TypeScript, Express y React.
- **Auditoría de Esquemas de Base de Datos:** Análisis de DDLs, restricciones de integridad, nulabilidad, índices y disparadores en `init_oltp.sql` e `init_mart.sql`.
- **Inspección de Datos en Vivo:** Ejecución de scripts de consulta tipados (`inspect-dbs.ts`, `check-after-etl.ts`) contra la instancia local de SQL Server en el puerto 1433.
- **Evaluación de Seguridad y Cumplimiento:** Revisión de exposición de secretos, sanitización de inputs y cumplimiento de la Ley N° 29733.
- **Contraste Documental:** Comparación punto a punto con los 1,031 párrafos del informe oficial extraído de Word.

---

## 3. ARQUITECTURA Y FUNCIONAMIENTO ACTUAL

```
[Usuario / Formulario Web]
        │ POST /api/buyer/register
        ▼
[Express Router: buyer.routes.ts]
        │
        ├─► Forzado directo: id_etapa_actual = 2 (LEAD)  <-- DEFECTO CRÍTICO
        ├─► Inserta Personas (Nombres, DNI, Teléfono)
        ├─► Inserta PersonaSaludOdontologica (Dolor, Sangrado) <-- INVASIÓN CLÍNICA
        ├─► Inserta Solicitudes (Demanda directa)
        └─► Inserta EventosEtapa (BUYER -> LEAD inmediato: 0 seg)
        
[Dashboard Staff: BuyerDetailModal.tsx]
        │
        └─► Invoca groqService.ts en el Navegador
                ├─► Lee VITE_GROQ_API_KEY (Expuesta en bundle cliente)
                ├─► Consulta modelos inválidos en api.groq.com (Falla HTTP 404)
                ├─► Catch silencioso -> Regex heurístico local
                └─► NO PERSISTE NADA EN DecisionesIA (0 rows en BD)

[Proceso ETL: etl_populate_mart.sql]
        │
        ├─► Mapea Sedes mediante CASE WHEN p.zona IN ('Centro Histórico', ...)
        ├─► Hace join erróneo: p.id_campana_origen = df.id_campana en Dim_Fuente
        └─► Inserta Fact_CaptacionBuyer agrupado: KeyServicio = NULL, Costo = 0.00
```

---

## 4. DIAGNÓSTICO FUNCIONAL DE BUYER

### 4.1. Captación de Datos
- **Canales Identificados:** Presencial, Llamada, WhatsApp, Página Web, Formulario Web, Redes Sociales.
- **Funcionamiento Real vs Simulado:** La captura web funciona y persiste en la base transaccional, pero no respeta la etapa BUYER: al registrarse por web, el backend promueve al usuario inmediatamente a LEAD. Los parámetros UTM y códigos QR no poseen campos normalizados en `Personas` ni en `Interacciones`, agrupándose en el texto libre de `mensaje`.

### 4.2. Registro de Personas y Desduplicación
- El endpoint `GET /api/buyer/check-duplicate` busca coincidencias por los últimos 9 dígitos del teléfono, email o DNI. Es funcional pero opera con consultas `contains` que generan escaneos de tabla (`Table Scan`).
- Ante un duplicado, si el usuario marca `isNewPersonConfirmed`, el sistema crea una segunda fila en `Personas` con el mismo número telefónico, duplicando la identidad física del paciente.

### 4.3. Gestión, Seguimiento y Conversión a LEAD
- Los estados teóricos (`NUEVO`, `CONTACTADO`, `CALIFICADO`, `DESCARTADO`) no existen como columna en la tabla `Personas`; se infieren a partir de `id_etapa_actual` y `estado_calidad`.
- La conversión formal en `POST /api/buyer/:id/convert` exige que exista una solicitud, pero sobreescribe `autoriza_contacto = true` violando la autodeterminación informativa del paciente.

---

## 5. DIAGNÓSTICO FRONTEND Y EXPERIENCIA DE USUARIO

- **Componentes Principales:** `BuyerListView.tsx`, `BuyerForm.tsx`, `BuyerDetailModal.tsx`, `BuyerDetailView.tsx`, `BuyerRequestInfoPage.tsx` (Landing).
- **Hallazgos Visuales y Usabilidad:**
  - El diseño visual es moderno, profesional y alineado al sector odontológico (paleta de colores teal/slate, tipografía nítida).
  - **Métricas Simuladas en Pantalla:** En `BuyerListView.tsx` (L254, 262, 270), las tendencias porcentuales de las tarjetas superiores están hardcodeadas: `trend: '+12.4%'`, `trend: '+4.2%'`, `trend: '+1.8%'`.
  - **Ausencia de Consola de Alertas:** Las 4 Impulse Alerts documentadas solo se evalúan como insignias aisladas en el modal de detalle; en el listado general no existe ningún indicador o filtro de anomalías.
  - **Fricción en Formularios:** Se solicita información innecesaria para captación (universidad, ciclo, régimen laboral, datos médicos).

---

## 6. DIAGNÓSTICO BACKEND Y API

- **Rutas Auditadas:** `backend/src/routes/buyer.routes.ts` (1,049 líneas de código).
- **Riesgo Crítico de Autorización:** Ninguna ruta cuenta con protección de sesión o token JWT. Todos los métodos (`GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/convert`) son accesibles públicamente por cualquier cliente HTTP.
- **Lógica de Transacciones:** Utiliza transacciones de Prisma (`prisma.$transaction`), lo cual es adecuado para asegurar consistencia entre `Personas`, `Solicitudes` e `Interacciones`.
- **Fuga de Alcance en `GET /`:** La consulta lista a cualquier persona que tenga `id_canal_origen != null`. Esto hace que pacientes antiguos que ya completaron su tratamiento en `TURNED` sigan apareciendo en la lista de BUYER con la etiqueta `CONVERTED`.

---

## 7. DIAGNÓSTICO BASE DE DATOS TRANSACCIONAL (OLTP)

- **Instancia Verificada:** `NexoSaludDB` en SQL Server (`127.0.0.1:1433`).
- **Tablas Relacionadas con BUYER:** `Personas` (71 filas), `Canales` (6), `Fuentes` (7), `Campanas` (6), `GastosCampana` (6), `Interacciones` (41), `Solicitudes` (60), `EventosEtapa` (98), `DecisionesIA` (0 filas).
- **Deficiencias de Esquema:**
  1. Falta de clave foránea compuesta o restricción de unicidad que impida que una persona tenga dos eventos de transición idénticos en `EventosEtapa`.
  2. Inclusión de la tabla `PersonaSaludOdontologica` que recopila datos clínicos prematuros.
  3. Ausencia de la entidad `OportunidadesCaptacion`, forzando la sobrecarga de `Solicitudes`.

---

## 8. DIAGNÓSTICO BASE DE DATOS DIMENSIONAL (DATA MART)

- **Instancia Verificada:** `NexoSalud_Mart` en SQL Server.
- **Tabla Auditada:** `fact_captacion_buyer` (71 registros).
- **Dimensiones:** `Dim_Tiempo` (366 filas), `Dim_Canal` (6), `Dim_Fuente` (7), `Dim_Sede` (3), `Dim_Servicio` (4), `Dim_TipoPersona` (6), `Dim_EstadoRegistro` (3).
- **Hallazgos Dimensionales Críticos:**
  - **Violación de Grano Atómico:** La tabla física declara `PRIMARY KEY (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro)`. Esto impide registrar más de un hecho si coincide en día, sede, canal, fuente y estado, perdiendo la individualidad de la oportunidad.
  - **Columnas Huérfanas:** `KeyServicio` y `KeyTipoPersona` son NULL en todas las filas de la base real.
  - **Medida Financiera en Cero:** `costo_atribuido_captacion` es `0.00` en el 100% de los hechos.

---

## 9. DIAGNÓSTICO PROCESOS ETL

- **Script Auditado:** `database/etl_populate_mart.sql` (sección 5.1, líneas 437 a 505).
- **Mapeo Geográfico Frágil:** Asigna la sede física evaluando la zona de residencia del paciente mediante un `CASE WHEN p.zona IN (...)` con nombres de urbanizaciones quemados en código SQL en lugar de usar la relación relacional de la clínica.
- **Join Conceptual Incorrecto:** Cruza campañas con fuentes mediante `LEFT JOIN Dim_Fuente df ON p.id_campana_origen = df.id_campana`.
- **Idempotencia:** Utiliza `MERGE`, lo cual previene duplicados en reejecuciones, pero al apoyarse en la PK compuesta, realiza agregaciones forzadas con `SUM()` y `AVG()`.

---

## 10. DIAGNÓSTICO DEL AGENTE INTELIGENTE DE MARKETING (IA)

- **Ubicación:** `src/shared/services/groqService.ts`.
- **Modelos:** Configurado con `['groq/compound-mini', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b']`. Todos inválidos en Groq.
- **Comportamiento en Fallo:** Salto al bloque catch que ejecuta evaluación determinista por regex sobre `ctx.concreteRequest`.
- **Trazabilidad:** Inexistente. Cero filas en `DecisionesIA`.
- **Seguridad:** API key expuesta en el frontend; vulnerable a inyección de prompts en el campo de texto libre.

---

## 11. DIAGNÓSTICO DE IMPULSE ALERTS

1. **Registro Incompleto:** Se evalúa en cliente. Si falta teléfono o nombre, muestra badge. (No persistida).
2. **Posible Duplicado:** Comprueba duplicidad sintáctica. (No persistida).
3. **Falta Autorización:** Advierte ausencia de consentimiento. Sin embargo, el backend la sobreescribe automáticamente al convertir.
4. **Intención Ambigua:** Se activa ante palabras genéricas ("info", "hola"). No bloquea la conversión en backend.
- **Veredicto:** Alertas pasivas, confinadas a un modal y desconectadas de un centro de notificaciones operativo.

---

## 12. DIAGNÓSTICO DE KPIS Y DASHBOARDS

### B1. Conversión BUYER → LEAD en 14 días
- **Implementación:** Calculado en TypeScript en `src/domain/indicators/index.ts`.
- **Problema:** No consume `Fact_CaptacionBuyer`. No filtra cohortes maduras: incluye prospectos registrados hace menos de 14 días, castigando artificialmente el indicador.

### B2. Contactos Utilizables
- **Implementación:** `(usableCount / totalCaptured) * 100` en memoria en cliente.
- **Problema:** Considera utilizables registros que fueron forzados a `autoriza_contacto = true` en el backend.

### B3. Costo por LEAD Atribuible
- **Implementación:** En cliente divide costos fijos asignados por nombre de fuente (`Facebook: 500, Google: 400`) entre los leads.
- **Problema:** En el Data Mart la medida vale cero. Los costos son ficticios y calculados en el navegador.

---

## 13. SEGURIDAD, CALIDAD Y PRUEBAS

- **Protección de Datos (Ley N° 29733 Perú):** Vulneración crítica por auto-asignación de consentimiento en `POST /:id/convert`.
- **OWASP API Security:** Ausencia de autenticación en `/api/buyer` (Broken Authentication & BOLA).
- **Pruebas Automatizadas:** Ausencia total de tests unitarios o E2E para el módulo BUYER en frontend y backend.

---

## 14. DISCREPANCIAS CON EL INFORME ACADÉMICO

Ver documento exhaustivo:  
`03_Informe_Oficial/MATRIZ_DISCREPANCIAS_DOCUMENTALES.md` (12 discrepancias mayores sustentadas en código).

---

## 15. MATRIZ INTEGRAL DE PROBLEMAS

Ver documento exhaustivo:  
`04_Auditoria/MATRIZ_HALLAZGOS_BUYER.md` (15 hallazgos clasificados con severidad, impacto, causa raíz y aceptación).

---

## 16. ARQUITECTURA OBJETIVO

Ver documento exhaustivo:  
`06_Rediseno_Propuesto/ARQUITECTURA_OBJETIVO_BUYER.md`.

---

## 17. PROPUESTAS DE CORRECCIÓN, MODIFICACIÓN, ELIMINACIÓN Y AMPLIACIÓN

- **CORREGIR:** Auto-conversión a LEAD en formulario web, forzado de autorización de datos, modelos inválidos de Groq, joins erróneos en ETL.
- **MODIFICAR:** Reestructurar `Fact_CaptacionBuyer` con grano por oportunidad y claves conformadas sin NULLs; calcular B1 con cohortes maduras.
- **ELIMINAR:** Exposición de API key en cliente, tendencias hardcodeadas en JSX, captura de datos médicos en BUYER.
- **AGREGAR:** Entidad `OportunidadesCaptacion`, servicio seguro de IA en backend con persistencia en `DecisionesIA`, banner proactivo de alertas en consola de admisión, endpoint analítico de KPIs desde el Mart.
- **CONSERVAR:** Tabla maestra de `Personas`, historial de `Interacciones` y auditoría de saltos en `EventosEtapa`.

---

## 18. PRIORIZACIÓN Y PLAN SECUENCIAL

Ver documento exhaustivo:  
`07_Plan_Implementacion/PLAN_IMPLEMENTACION_SECUENCIAL.md` (10 fases secuenciales y plan de rollback).

---

## 19. IMPACTO SOBRE OTRAS ETAPAS IMPULSE

- **LEAD:** Beneficio directo al recibir prospectos con intención validada y consentimiento legal real. `Solicitudes` se genera de forma limpia.
- **PAYER:** Mayor tasa de cobros validados al filtrar prospectos con intención real.
- **CUSTOMER / TURNED:** Preservación estricta de la historia clínica anclada al expediente maestro de `Personas`.

---

## 20. LIMITACIONES Y ELEMENTOS PENDIENTES DE VERIFICACIÓN

1. **Validación de Facturación Publicitaria Real:** Los datos actuales de `GastosCampana` corresponden a registros de prueba; la conciliación con APIs de Meta Ads/Google Ads queda para una fase posterior.
2. **Ambiente de Producción:** Las pruebas diagnósticas se ejecutaron en el entorno de desarrollo local contra la base de datos SQL Server activa.

---

## 21. CONCLUSIONES TÉCNICAS

1. La fase BUYER posee las bases de catálogos y entidades requeridas, pero sufre de desviaciones críticas de implementación (auto-conversión web, forzado de consentimiento, IA ejecutada en cliente y desconexión analítica de KPIs).
2. El rediseño propuesto es 100% viable técnicamente, no requiere cambiar de stack tecnológico (continúa sobre React, Node.js, Express, Prisma y SQL Server) y resuelve de raíz las vulnerabilidades legales y de modelamiento.
3. El paquete entregable en el archivo ZIP provee todos los insumos necesarios para que un revisor externo audite, reproduzca y apruebe la futura implementación sin decisiones improvisadas.
