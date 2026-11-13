# MEMORIA DESCRIPTIVA

## NexoSalud: plataforma inteligente para la gestión odontológica y conversión comercial

### TÍTULO DEL SOFTWARE

**NexoSalud - Sistema de Inteligencia de Negocios para la gestión del ciclo comercial odontológico**

## 1. Problema que resuelve

Las clínicas odontológicas reciben consultas y solicitudes de atención a través de distintos canales, como formularios web, redes sociales, llamadas, WhatsApp y atención presencial. Cuando esta información se registra de forma dispersa o manual, se dificulta conocer el origen del contacto, identificar sus necesidades clínicas, hacer seguimiento oportuno y medir cuántos contactos avanzan hacia una oportunidad comercial real.

Esta situación puede generar registros incompletos, duplicados, pérdida de solicitudes, demora en la atención y poca visibilidad sobre el rendimiento de las campañas de captación. Además, el personal debe revisar manualmente los mensajes de los pacientes para determinar si se trata de una consulta informativa, una necesidad concreta o una intención de solicitar un servicio odontológico.

NexoSalud aborda este problema centralizando la información de las personas y sus interacciones, organizando el recorrido comercial por etapas y utilizando un agente Buyer para apoyar la evaluación inicial de los contactos. De esta manera, la clínica puede tomar decisiones basadas en datos y dar continuidad al paciente desde su captación hasta las etapas posteriores del ciclo de atención.

## 2. Funcionalidad: ¿para qué sirve?

NexoSalud es una plataforma web para registrar, consultar y gestionar personas interesadas en los servicios de una clínica odontológica. El sistema permite controlar el ciclo comercial completo, desde el registro inicial como BUYER hasta las etapas de LEAD, PAYER, CUSTOMER y TURNED.

La plataforma permite:

- Registrar datos personales, medios de contacto, autorización y motivo de consulta.
- Identificar el servicio odontológico, sede, horario, canal y fuente de interés.
- Detectar registros duplicados o con problemas de calidad.
- Consultar interacciones, solicitudes, preferencias y decisiones del agente.
- Evaluar el mensaje vigente de un Buyer con apoyo de inteligencia artificial.
- Recomendar si un contacto debe continuar en BUYER o avanzar a LEAD.
- Convertir un Buyer a LEAD cuando existe una intención comercial concreta.
- Consultar pacientes y dar seguimiento a las etapas posteriores.
- Visualizar reportes ejecutivos e indicadores de la etapa BUYER.
- Analizar la conversión, calidad de contactos y tiempo promedio de avance comercial.

### Módulos operativos

#### A) Acceso y configuración

Permite iniciar la operación del sistema y administrar configuraciones, catálogos y parámetros necesarios para la gestión de la clínica, como canales, fuentes, servicios, sedes, horarios y campañas.

#### B) Gestión de BUYER

Centraliza los contactos captados que todavía se encuentran en evaluación comercial. El usuario puede registrar, buscar, filtrar, paginar y consultar el detalle de cada Buyer.

El módulo muestra información de:

- Datos personales y medios de contacto.
- Autorización de contacto y tratamiento de datos.
- Servicio de interés y preferencia de atención.
- Sede, horario, modalidad y canal.
- Fuente o campaña de origen.
- Motivo concreto de consulta.
- Estado de calidad, duplicidad y etapa comercial.

#### C) Agente inteligente BUYER

El agente Buyer analiza el contexto vigente del contacto y organiza su resultado en tres actividades:

1. **Perfilamiento de la necesidad clínica:** identifica qué necesidad expresa el paciente y contrasta el mensaje con sus preferencias registradas.
2. **Clasificación de intención y preparación para LEAD:** determina si el mensaje demuestra una intención comercial concreta y si el contacto está preparado para avanzar.
3. **Recomendación del agente Buyer:** recomienda mantener el registro en BUYER o proceder con la conversión a LEAD. Si la conversión ya fue ejecutada, muestra el resultado y el siguiente paso comercial.

La autorización de contacto se solicita como requisito previo del registro. Por ello, no se presenta como una decisión posterior del agente.

#### D) Gestión de LEAD

Permite recibir los Buyers convertidos y gestionar su seguimiento comercial. Esta etapa concentra los contactos que ya presentan una intención suficientemente concreta para continuar con negociación, contacto comercial o agendamiento.

#### E) Gestión de PAYER, CUSTOMER y TURNED

Organiza las etapas posteriores del recorrido del paciente:

- **PAYER:** seguimiento relacionado con pagos o condiciones económicas.
- **CUSTOMER:** gestión del paciente que ya recibió o contrató un servicio.
- **TURNED:** seguimiento posterior, fidelización o retorno del paciente.

#### F) Gestión de pacientes

Permite consultar los registros clínicos y personales disponibles para la atención odontológica. La vista utiliza paginación y consultas resumidas para facilitar la carga de información y evitar traer datos innecesarios al navegador.

#### G) Reportes e inteligencia de negocios

Presenta matrices y reportes ejecutivos para analizar el comportamiento de las etapas comerciales. En BUYER se visualizan indicadores alineados con el documento de indicadores del proyecto:

- **B1. Conversión BUYER → LEAD en 14 días.**
- **B2. Contactos utilizables.**
- **B3. Tiempo promedio de conversión a LEAD.**

Estos indicadores permiten relacionar la calidad de los datos con la velocidad y efectividad de la conversión comercial.

### Elemento distintivo

El elemento diferenciador de NexoSalud es la integración de un agente Buyer dentro del flujo comercial. El sistema no se limita a almacenar registros: interpreta el mensaje vigente del contacto, considera sus preferencias clínicas y genera una recomendación explicable para apoyar la decisión de mantenerlo en BUYER o transferirlo a LEAD.

La recomendación del agente funciona como apoyo a la gestión comercial y no reemplaza el criterio del personal de la clínica. Las decisiones quedan asociadas al contacto para conservar trazabilidad del proceso.

## 3. Arquitectura del software

### A) Lenguajes de programación

- **TypeScript:** lenguaje utilizado en el frontend y backend para mantener tipado, validación y consistencia entre las capas del sistema.
- **SQL:** lenguaje utilizado para consultar y gestionar la información almacenada en SQL Server y para consultar estructuras del DataMart de inteligencia de negocios.
- **HTML y CSS:** tecnologías utilizadas por la interfaz web, junto con Tailwind CSS para la composición visual y el diseño responsive.

### B) Base de datos

- **Microsoft SQL Server:** motor principal de persistencia de NexoSalud.
- **Prisma ORM:** herramienta utilizada por el backend para consultar las entidades del sistema, como personas, etapas, interacciones, solicitudes, preferencias, campañas, gastos y eventos de conversión.
- **NexoSalud_Mart:** estructura dimensional utilizada para reportes y análisis de inteligencia de negocios, incluyendo hechos de captación Buyer e inversión de campañas cuando la información está disponible.

La base de datos conserva la trazabilidad del recorrido de cada persona mediante eventos de etapa, interacciones, solicitudes, decisiones del agente y cambios de estado.

### C) Backend

- **Node.js:** entorno de ejecución del servidor.
- **Express:** framework utilizado para exponer la API REST.
- **Prisma Client:** capa de acceso tipado a SQL Server.
- **Google Gemini:** proveedor utilizado por el agente Buyer para el análisis semántico cuando corresponde.
- **TypeScript:** lenguaje principal del backend.

El backend expone servicios para los módulos BUYER, LEAD, PAYER, CUSTOMER, TURNED, pacientes, reportes, configuración y autenticación de pacientes. También controla validaciones, conversiones de etapa, recuperación de evaluaciones pendientes y respuestas de la API.

### D) Frontend

- **React:** biblioteca utilizada para construir la interfaz web.
- **Vite:** herramienta de desarrollo y compilación.
- **React Router:** gestión de navegación entre módulos.
- **TanStack Query:** gestión de consultas, caché e invalidación de datos.
- **React Hook Form y Zod:** gestión y validación de formularios.
- **Tailwind CSS:** estilos, diseño responsive y estados visuales.
- **TypeScript:** tipado de componentes, servicios y modelos de datos.

La interfaz está organizada por módulos y ofrece estados de carga, error, paginación, filtros, búsqueda y visualización detallada de cada registro.

## 4. Indicadores principales de BUYER

### B1. Conversión BUYER → LEAD en 14 días

Mide el porcentaje de contactos BUYER utilizables que se convierten en LEAD dentro de los 14 días posteriores a su registro.

```text
(Contactos BUYER utilizables convertidos a LEAD en 14 días
/ Total de contactos BUYER utilizables) × 100
```

### B2. Contactos utilizables

Mide qué proporción de los contactos registrados cuenta con información suficiente para ser gestionada comercialmente.

```text
(Contactos BUYER utilizables / Contactos registrados) × 100
```

### B3. Tiempo promedio de conversión a LEAD

Mide la cantidad promedio de días que transcurre entre el registro de un Buyer y su conversión a LEAD.

```text
Suma de días entre registro y conversión
/ Total de conversiones a LEAD
```

Este indicador permite evaluar la rapidez del proceso comercial y detectar oportunidades de mejora en el seguimiento de los contactos.

