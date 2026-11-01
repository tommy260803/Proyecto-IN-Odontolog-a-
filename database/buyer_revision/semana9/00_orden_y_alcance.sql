/* GUIA DE EJECUCION Y ALCANCE -- NO EJECUTA INSTRUCCIONES

ESTADO: implementacion SQL candidata de BUYER sobre el esquema de Semana 9.
No se ha ejecutado contra SQL Server en el entorno de preparacion.
No ejecutar sobre produccion ni reemplazar archivos desplegados automaticamente.
Usar copia de pruebas y conservar respaldos. Revisar resultados antes de integrar.
No modifica el Google Docs ni cambia umbrales/reportes del informe principal.

DOS RUTAS ALTERNATIVAS (NO MEZCLAR):
A. Bases nuevas / vacias:
   1) init_oltp.sql (DDL completo original + extension Buyer).
   2) 01_catalogos.sql (copia EXACTA del original; solo una vez).
   3) init_mart.sql (DDL original; solo el hecho Buyer cambia a detalle).
   4) poblamiento_merge_mart.sql (AHORA EXCLUSIVO BUYER).
   5) 02_validacion.sql y 03_indicadores_y_reporte_buyer.sql (lectura).
   Los otros cuatro hechos se crean pero NO se pueblan con el ETL de esta carpeta.
   El poblamiento de esas fases queda fuera de este alcance.
B. Copias existentes del esquema de Semana 9 con tabla fact_captacion_buyer:
   1) migracion_buyer.sql. Ejecutar por bloques, detenerse ante cualquier error.
      Crea la extension OLTP y archiva el hecho agregado como
      fact_captacion_buyer_legacy_semana9 antes de crear el detalle nuevo.
      No borra registros ni totales del hecho anterior.
   2) poblamiento_merge_mart.sql (solo Buyer).
   3) 02_validacion.sql y 03_indicadores_y_reporte_buyer.sql.
   No volver a ejecutar init_oltp.sql ni 01_catalogos.sql en bases pobladas.

NO ES MIGRACION UNIVERSAL DE main:
main mezcla nombres Fact_CaptacionBuyer/PascalCase con codigo snake_case.
El guard de migracion avisa si encuentra ese esquema. No repetir ni ignorar errores.
No ejecutar el syncBuyer viejo del backend sobre el hecho atomico. La integracion
backend/Prisma requiere conectar el alta a CaptacionesBuyer y llamar a
usp_ConvertirBuyerALead; la sincronizacion debe usar esta logica de extraccion.
Las rutas actuales NO quedan adaptadas automaticamente por estos scripts.

MEDIDAS: siguen siendo las cinco del informe. No se almacenan medidas auxiliares.
- contacto_registrado y contacto_utilizable: conteos 0/1 a nivel de contacto.
- conversion_lead: evento real BUYER->LEAD; no Solicitudes ni etapa actual.
- tiempo_conversion_dia: duracion individual decimal; NULL si no convierte.
- costo_atribuido_captacion: reparto campana/mes con centimos exactos;
  NULL si no hay evidencia de gasto (no se fabrica gasto cero).
Las fechas y el evento son atributos de trazabilidad necesarios para B1.

CaptacionesBuyer es una tabla TRANSACCIONAL, no otro hecho dimensional.
Una fila por persona evita contar cada oportunidad recurrente como nuevo contacto.
No se adopta OportunidadesCaptacion ni se obliga a integrar la rama refactor.
Fact_GastoCampana queda como mejora OPCIONAL posterior; el gasto se concilia
por ahora directamente con GastosCampana y se muestran importes no atribuidos.
El costo por LEAD de cohorte no es automaticamente el gasto total del negocio
por LEAD del periodo cuando existen campanas sin contactos.

HISTORICOS:
El ETL conserva valores observados de Personas y los marca HISTORICO_OBSERVADO.
No demuestra que calidad/autorizacion tuvieran ese valor el dia de registro.
No reconstruye sede/servicio desde zona, preferencias posteriores ni solicitudes.
Los desconocidos pueden cambiar distribuciones del reporte: es ausencia de evidencia.
No cambiar los datos de prueba para forzar una coincidencia esperada.
El seed original no carga GastosCampana: B3 puede quedar NULL hasta cargar evidencia
real o un juego de pruebas etiquetado como sintetico.

FUTUROS REGISTROS:
El backend debe INSERTAR CaptacionesBuyer junto con Personas, capturando servicio,
sede, canal/fuente/campana y autorizacion declarados. Usar origen REGISTRO_DIRECTO.
La calidad de captacion y sus rectificaciones requieren gestion explicita; el ETL
no sobreescribe el historico automaticamente al cambiar Personas.
usp_ConvertirBuyerALead es una operacion transaccional futura y reintentable;
no implementa el clasificador de intencion del agente. Requiere motivo concreto,
servicio y registro utilizable. No invocarla por recibir solo una sugerencia IA.
DecisionesIA incorpora referencias opcionales; no se consulta ningun proveedor IA.

VERIFICACION:
Ejecutar 04_pruebas_reglas_buyer.sql para casos limite sin escribir datos permanentes.
Reejecutar ETL y comparar detalle y totales. Probar contacto sin conversion,
conversion a 14 dias exactos y despues, cronologia invalida, canal/sede desconocidos,
fuente con varias campanas, campana sin contactos, consentimiento ausente,
reintento de conversion, y confirmar que otros hechos no cambian.
Mantener reporte visual. Las consultas se corrigen para usar detalle, no promedio
sobre promedios de grupos.
*/
