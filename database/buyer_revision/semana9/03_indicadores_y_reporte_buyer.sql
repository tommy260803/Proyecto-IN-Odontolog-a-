/* SOLO CONSULTAS. Conserva los 3 indicadores del informe y las 5 medidas originales.
   No agrega banderas ni contadores auxiliares almacenados al analisis dimensional.
   Los identificadores, fechas y procedencia son trazabilidad, no indicadores nuevos.
   B1 usa los contactos utilizables registrados del periodo, como dice el informe.
   La cantidad aun sin completar 14 dias se muestra aparte como control, no KPI nuevo.
   Para comparar cohortes maduras, filtrar tanto numerador como denominador con
   DATEADD(DAY,14,fecha_captacion)<=fecha_corte_etl. No filtrar solo el numerador.
*/
USE NexoSalud_Mart;
GO

-- B1. Conversion de contactos utilizables a LEAD dentro de 14 dias exactos.
SELECT
    SUM(CASE WHEN contacto_utilizable=1 AND conversion_lead=1
                  AND fecha_conversion<=DATEADD(DAY,14,fecha_captacion)
             THEN 1 ELSE 0 END) AS conversiones_utilizables_14_dias,
    SUM(contacto_utilizable) AS contactos_utilizables,
    100.0*SUM(CASE WHEN contacto_utilizable=1 AND conversion_lead=1
                       AND fecha_conversion<=DATEADD(DAY,14,fecha_captacion)
                  THEN 1 ELSE 0 END)/NULLIF(SUM(contacto_utilizable),0) AS B1_porcentaje
FROM dbo.fact_captacion_buyer;

-- B2. Calidad y autorizacion de contactos captados.
SELECT SUM(contacto_utilizable) AS utilizables,
       SUM(contacto_registrado) AS registrados,
       100.0*SUM(contacto_utilizable)/NULLIF(SUM(contacto_registrado),0) AS B2_porcentaje
FROM dbo.fact_captacion_buyer;

-- B3. Costo por LEAD atribuible. NULL si falta evidencia de costos en la cohorte.
-- Las campanas con gasto y ningun contacto se controlan en 02_validacion.sql;
-- no se deben atribuir artificialmente a contactos de otra campana.
SELECT SUM(costo_atribuido_captacion) AS costo_atribuido,
       SUM(conversion_lead) AS conversiones,
       SUM(CASE WHEN costo_atribuido_captacion IS NULL THEN 1 ELSE 0 END) AS costos_pendientes,
       CASE WHEN COUNT(*)>0 AND COUNT(costo_atribuido_captacion)=COUNT(*)
            THEN SUM(costo_atribuido_captacion)/NULLIF(SUM(conversion_lead),0) END AS B3_soles
FROM dbo.fact_captacion_buyer;

-- Control de interpretacion, no un cuarto indicador del informe.
SELECT SUM(CASE WHEN DATEADD(DAY,14,fecha_captacion)>fecha_corte_etl
                THEN 1 ELSE 0 END) AS contactos_aun_sin_ventana_completa
FROM dbo.fact_captacion_buyer;

-- Mismas 5 medidas. AVG se calcula sobre contactos, excluyendo duraciones NULL.
SELECT SUM(contacto_registrado) AS contacto_registrado,
       SUM(contacto_utilizable) AS contacto_utilizable,
       SUM(conversion_lead) AS conversion_lead,
       AVG(tiempo_conversion_dia) AS tiempo_promedio_conversion_dia,
       SUM(costo_atribuido_captacion) AS costo_atribuido_captacion
FROM dbo.fact_captacion_buyer;

-- Misma estructura de reporte: periodo / fuente / canal / sede.
-- El frontend puede pivotear las sedes sin modificar el diseno de la matriz.
SELECT t.Anio,t.Mes,fu.TipoOrigen AS fuente,c.NombreCanal AS canal,s.Sede,
       SUM(f.contacto_registrado) AS contacto_registrado
FROM dbo.fact_captacion_buyer f
JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo
JOIN dbo.Dim_Fuente fu ON fu.KeyFuente=f.KeyFuente
JOIN dbo.Dim_Canal c ON c.KeyCanal=f.KeyCanal
JOIN dbo.Dim_Sede s ON s.KeySede=f.KeySede
GROUP BY t.Anio,t.Mes,fu.TipoOrigen,c.NombreCanal,s.Sede
ORDER BY t.Anio,t.Mes,fu.TipoOrigen,c.NombreCanal,s.Sede;

/* Umbrales del informe principal, sin cambiarlos:
   B1 verde >=20%, ambar >=10% y <20%, rojo <10%.
   B2 verde >=80%, ambar >=60% y <80%, rojo <60%.
   B3 verde <=50, ambar >50 y <=100, rojo >100 soles.
   No clasificar como verde un indicador NULL/no calculable.
*/
