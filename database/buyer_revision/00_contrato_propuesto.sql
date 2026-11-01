/*
NEXOSALUD / BUYER -- DECISIONES DE DISENO PARA REVISION CON DANIEL Y GERMAIN
ESTADO: propuesta, no migracion. Este archivo no modifica datos ni esquemas.

BASE COMPARADA
  main: 09f680e23a4815eea21ac57ca5b468e513b34f15 (cambios en el buyer).
  refactor/buyer-impulse-integral: f76e252 (14 commits propios, 3 de main ausentes).
  Requisitos: primera seccion del snapshot INforme nexosalud.docx suministrado.
  Las secciones posteriores de entrevistas/borradores y el Word de la rama NO
  sustituyen a Informe IN final. No se han modificado documentos de Drive.

CONTRATO DEL REPORTE QUE DEBE CONSERVARSE
  Filtro: anio/mes del registro inicial.
  Filas: fuente de atraccion / canal. Columnas: sede declarada de captacion.
  Valor: contactos registrados, una persona en su primera captacion.
  Ausencia de sede: miembro No especificado; NO inferirla desde zona.
  Persona recurrente != nueva persona captada. No sumar indiscriminadamente
  oportunidades, interacciones y solicitudes como contactos nuevos.

01 / database/init_oltp.sql Y NUEVA MIGRACION ADITIVA
  Conservar Personas como identidad. Aprovechar el concepto OportunidadesCaptacion
  de la rama refactor, pero anadir es_captacion_inicial y un indice unico filtrado
  por id_persona donde es_captacion_inicial=1. El backfill no inventa episodios.
  Capturar en la oportunidad canal, fuente/campana, sede y servicio DECLARADOS,
  necesidad, fecha y evidencia de autorizacion, calidad y procedencia del dato.
  Congelar la atribucion inicial; cambios posteriores van a historial/episodio nuevo.
  Datos no reconstruibles: NULL y procedencia HISTORICO_NO_VERIFICADO, no score=85,
  Desktop ni fechas de respuesta/conversion sinteticas.
  Consentimientos nuevos: NULL/desconocido o false segun contrato; nunca true
  por defecto o por migrar registros. No cambiar el significado de autoriza_contacto.
  No declarar atencion, marketing o IA autorizados si no existe evidencia.

02 / EventosEtapa
  No crear una segunda tabla equivalente a la bitacora existente.
  Agregar id_oportunidad e id_solicitud opcionales con FK y validacion de que
  persona/oportunidad/solicitud pertenecen a la misma identidad.
  Agregar identificador idempotente de operacion (unico cuando no sea NULL).
  Conversion: validar datos/intencion/autorizacion, crear Solicitud, registrar
  evento BUYER->LEAD y actualizar estado en UNA transaccion.
  Resolver las etapas por nombre, no asumir BUYER=1 o LEAD=2.
  No repetir evento/solicitud ante reintentos; no retroceder etapas posteriores.
  Historico: solo asociar eventos a episodios cuando la relacion sea demostrable.

03 / PREPARACION PARA IA (NO IMPLEMENTAR EL AGENTE EN ESTA ENTREGA)
  Reusar DecisionesIA; enlazar con oportunidad/interaccion, modelo/proveedor,
  version de regla/prompt, entrada minima, salida estructurada, confianza,
  revision humana, actor y fecha. Registrar sugerencia != ejecutar transicion.
  Una inferencia no concede autorizacion ni crea por si sola un evento comercial.
  Preparar reglas/alertas de incompleto, duplicado, falta de autorizacion e
  intencion ambigua. No crear nuevas metricas/SLA ajenas al alcance principal.

04 / database/init_mart.sql Y MIGRACION ADITIVA
  Conservar dimensiones conformadas. Miembros desconocidos Key=0.
  Lookup por clave natural unica; Dim_Fuente requiere (fuente,campana), incluyendo
  fuente conocida sin campana. Dim_EstadoRegistro requiere (calidad,autorizacion).
  No hardcodear identidades 1/2/3/4, ni escoger MIN de una campana real como fallback.

  Crear Fact_CaptacionBuyerDetalle: UNA fila por primera captacion de persona
  (id_persona e id_oportunidad_inicial unicos). Fechas de captacion y conversion,
  claves dimensionales, evento de conversion, fecha de corte/carga y procedencia.
  Medidas originales:
    contacto_registrado=1;
    contacto_utilizable: regla explicita de nombre/contacto/autorizacion/calidad;
    conversion_lead: existencia del evento verificable BUYER->LEAD de ese episodio;
    tiempo_conversion_dia: duracion decimal real; NULL si no hay conversion;
    costo_atribuido_captacion: distribucion documentada, no cero ficticio.
  Medidas auxiliares:
    cohorte_evaluable_14_dia, conversion_lead_utilizable_14_dia,
    tiempo_conversion_minuto (sumable) y cantidad_conversion_tiempo (denominador).
  Agrupado/vista de compatibilidad para el reporte existente: SUM de conteos e
  importes; duracion promedio = suma de duraciones / conversiones con tiempo.
  No AVG de promedios ni MIN(KeyServicio/KeyTipoPersona) para representar un grupo.
  Servicio/tipo se consultan desde el detalle o se incluyen en el grano agregado.

05 / HECHO ADICIONAL RECOMENDADO: Fact_GastoCampana
  UNA fila por id_gasto original, con fecha y campana/fuente/canal verificables.
  Necesario para reconciliar gasto, incluso en campanas SIN contactos.
  No distribuir gasto sobre sede/servicio sin declarar el criterio de atribucion.
  Si se prorratea por campana/mes: conservar centimos exactos, asignar residuo
  determinista y exponer gasto_no_atribuido cuando no haya contactos.
  No mezclar gasto del mes con contactos de otra cohorte sin declarar la ventana.
  No unir directamente dos hechos: agregar cada uno a dimensiones comunes primero.

06 / database/poblamiento_dimensional.sql Y backend/src/services/martSyncService.ts
  UNA implementacion canonica de Buyer (procedimiento invocado desde backend).
  Extraer eventos por origen/destino y episodio, no por etapa actual ni solicitud.
  Procesar cambios en captaciones antiguas con conversion nueva.
  Carga con staging unico, validaciones, transaccion, control de concurrencia,
  idempotencia y log. Borrados solo dentro del conjunto/periodo de carga verificado.
  La version INSERT y MERGE, si ambas se conservan, deben compartir extraccion.
  Nunca ejecutar el antiguo syncBuyer sobre el agregado nuevo tras migrarlo.

07 / INDICADORES Y REPORTES
  Conservar umbrales del informe principal:
    B1 verde >=20%, ambar >=10% y <20%, rojo <10%.
    B2 verde >=80%, ambar >=60% y <80%, rojo <60%.
    B3 verde <=50, ambar >50 y <=100, rojo >100 soles.
  B1: contactos utilizables del MISMO conjunto evaluable convertidos en 14 dias /
      contactos utilizables de ese conjunto. Comparar timestamps con DATEADD,
      no DATEDIFF(DAY)<=14. Mostrar por separado cohortes aun no maduras.
  B2: utilizables / contactos registrados (no oportunidades repetidas).
  B3: costo de captacion de la cohorte / LEADs atribuibles de la MISMA cohorte.
      NULL cuando no hay conversiones; no presentar costo cero como exito.
  Aclaracion pendiente con negocio: tabla de perfil exige telefono/servicio/motivo,
  mientras la definicion inicial acepta al menos un medio de contacto. Propuesta:
  utilizable basico = identidad+medio+autorizacion; calificado agrega intencion y
  servicio. Documentar la regla final antes de migrar; no cambiarla en silencio.
  Conservar diseno visual de matriz; solo corregir agregacion y datos desconocidos.

08 / POR QUE NO INTEGRAR ENTERA refactor/buyer-impulse-integral
  Su migracion marca TODO historico CONVERTIDO_LEAD, genera fechas y consentimiento
  true; el ETL acepta oportunidad convertida OR solicitud OR etapa actual>=2.
  Usa identidades de estado fijas, sede inferida, costo redondeado por contacto,
  MIN de dimensiones y AVG de promedios en la matriz. Los umbrales publicados en
  sus docs (30/85/45) no son los del informe principal (20/80/50).
  El agente/frontend y reorganizacion de carpetas no corresponden a esta fase DB.
  Los archivos que dicen 100% certificado no prueban estas reglas de negocio.

09 / PUERTAS DE ACEPTACION ANTES DE INTEGRAR
  Contactos OLTP=detalle=matriz por fecha/fuente/canal/sede; sin perdida Key=0.
  Un evento a LEAD por episodio y ninguna conversion sin evento verificable.
  Reintento/concurrencia no duplican Solicitudes/Eventos/filas de hecho.
  Casos 14 dias exactos, +1 segundo, sin conversion y cohortes inmaduras.
  Gastos: origen=atribuido+no_atribuido al centimo; campana sin contacto incluida.
  Una persona con dos oportunidades no duplica el contacto inicial del reporte.
  Promedio ponderado correcto, fechas ausentes NULL y dimensiones sin fanout.
  Reejecutar ETL produce mismo resultado; conversion tardia actualiza cohorte vieja.
  Totales/checksums de LEAD/PAYER/CUSTOMER/TURNED permanecen sin modificaciones.

ESTADO DE ESTA RAMA
  Solo revision y diagnostico de lectura. No ejecuta ALTER/UPDATE/DELETE sobre BD.
  No implica que la migracion ni el agente esten implementados o probados.
*/
