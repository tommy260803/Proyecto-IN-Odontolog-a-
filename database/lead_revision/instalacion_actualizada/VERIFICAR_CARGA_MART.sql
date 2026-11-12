-- Verificacion independiente, solo lectura de datos de negocio. Ejecutar con fuentes estables.
-- sqlcmd -S "SU_INSTANCIA" -E -C -I -b -t 120 -f 65001 -d master -v Origen=NexoSaludDB Mart=NexoSalud_Mart -i database/lead_revision/instalacion_actualizada/VERIFICAR_CARGA_MART.sql
:ON ERROR EXIT
USE [master];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
IF DB_ID(N'$(Origen)') IS NULL OR DB_ID(N'$(Mart)') IS NULL OR N'$(Origen)'=N'$(Mart)'
 OR N'$(Origen)' NOT LIKE N'NexoSalud%' OR N'$(Mart)' NOT LIKE N'NexoSalud[_]Mart%'
 OR N'$(Origen)' COLLATE Latin1_General_100_BIN2 LIKE N'%[^A-Za-z0-9_]%'
 OR N'$(Mart)' COLLATE Latin1_General_100_BIN2 LIKE N'%[^A-Za-z0-9_]%'
 THROW 55200,'Par de bases inexistente o nombre de destino no permitido.',1;
IF NOT EXISTS (SELECT 1 FROM [$(Origen)].sys.extended_properties WHERE class=0 AND name=N'NexoSaludPaquete'
 AND CONVERT(nvarchar(100),value)=N'LEAD-OLTP-2026-11')
 OR NOT EXISTS (SELECT 1 FROM [$(Mart)].sys.extended_properties WHERE class=0 AND name=N'NexoSaludPaquete'
 AND CONVERT(nvarchar(100),value)=N'LEAD-MART-2026-11-BUYER-REVISADO')
 THROW 55201,'El par no pertenece al nuevo paquete validado; no cargar bases principales anteriores.',1;
IF COL_LENGTH(N'[$(Mart)].dbo.fact_captacion_buyer','id_persona') IS NULL
 OR COL_LENGTH(N'[$(Mart)].dbo.fact_inversion_campana_buyer','id_gasto') IS NULL
 THROW 55202,'Falta la estructura BUYER publicada.',1;
GO
USE [$(Mart)];
GO
DECLARE @nivelVerificacion int=@@TRANCOUNT;
BEGIN TRANSACTION;
DECLARE @lockVerificacion int,@corte datetime2(7)=SYSUTCDATETIME();
EXEC @lockVerificacion=[$(Origen)].sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
 @LockMode='Shared',@LockOwner='Transaction',@LockTimeout=5000;
IF @lockVerificacion<0 THROW 55210,'Otra carga esta en curso.',1;
-- Conteos OLTP independientes del mapeo dimensional y de las banderas del ETL.
-- Las funciones OLTP existentes resuelven las identidades e historiales aprobados.
SELECT COUNT_BIG(CASE WHEN resultado_comercial_lead='ACEPTADA' THEN 1 END) M1,
       COUNT_BIG(CASE WHEN resultado_comercial_lead='CERRADA_SIN_ACUERDO' THEN 1 END) M2
INTO #ControlO
FROM [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corte);

SELECT COUNT_BIG(CASE WHEN estado='Aceptada' THEN 1 END) M3,
       COUNT_BIG(CASE WHEN estado='Rechazada' THEN 1 END) M4,
       COUNT_BIG(CASE WHEN estado='Rechazada' AND categoria_motivo='ECONOMICO' THEN 1 END) M5
INTO #ControlP
FROM [$(Origen)].dbo.fn_Lead_Propuestas_Corte(@corte);

SELECT COUNT_BIG(CASE WHEN a.estado_respuesta='Aceptada' THEN 1 END) M6,
       COUNT_BIG(CASE WHEN a.estado_respuesta='Rechazada' THEN 1 END) M7,
       COUNT_BIG(CASE WHEN a.estado_respuesta='Rechazada' AND a.categoria_motivo='INCOMPATIBILIDAD' THEN 1 END) M8
INTO #ControlA
FROM [$(Origen)].dbo.fn_Lead_Alternativas_Corte(@corte) a
JOIN [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corte) s ON s.id_solicitud=a.id_solicitud;

SELECT o.M1,o.M2,p.M3,p.M4,p.M5,a.M6,a.M7,a.M8 INTO #ControlOLTP
FROM #ControlO o CROSS JOIN #ControlP p CROSS JOIN #ControlA a;

-- Sumas Mart. Un hecho sin grupos produce cero.
SELECT
 (SELECT ISNULL(SUM(oportunidad_aceptada),0) FROM dbo.fact_oportunidades_lead) M1,
 (SELECT ISNULL(SUM(oportunidad_cerrada_sin_acuerdo),0) FROM dbo.fact_oportunidades_lead) M2,
 (SELECT ISNULL(SUM(propuesta_aceptada),0) FROM dbo.fact_propuestas_aceptadas_lead) M3,
 (SELECT ISNULL(SUM(propuesta_rechazada),0) FROM dbo.fact_propuestas_rechazadas_lead) M4,
 (SELECT ISNULL(SUM(propuesta_rechazada_economica),0) FROM dbo.fact_propuestas_rechazadas_lead) M5,
 (SELECT ISNULL(SUM(alternativa_aceptada),0) FROM dbo.fact_alternativas_aceptadas_lead) M6,
 (SELECT ISNULL(SUM(alternativa_rechazada),0) FROM dbo.fact_alternativas_rechazadas_lead) M7,
 (SELECT ISNULL(SUM(alternativa_rechazada_incompatibilidad),0) FROM dbo.fact_alternativas_rechazadas_lead) M8
INTO #ControlMart;

SELECT 'OLTP' AS Fuente,* FROM #ControlOLTP
UNION ALL
SELECT 'Mart',* FROM #ControlMart;
IF EXISTS (SELECT * FROM #ControlOLTP EXCEPT SELECT * FROM #ControlMart)
 THROW 54908,'Las sumas de los hechos no coinciden con los conteos OLTP.',1;
SELECT 'OLTP' Fuente,CONVERT(decimal(18,4),100.0*M1/NULLIF(M1+M2,0)) L1,
 CONVERT(decimal(18,4),100.0*M5/NULLIF(M3+M4,0)) L2,
 CONVERT(decimal(18,4),100.0*M8/NULLIF(M6+M7,0)) L3 FROM #ControlOLTP
UNION ALL
SELECT 'Mart',CONVERT(decimal(18,4),100.0*M1/NULLIF(M1+M2,0)),
 CONVERT(decimal(18,4),100.0*M5/NULLIF(M3+M4,0)),
 CONVERT(decimal(18,4),100.0*M8/NULLIF(M6+M7,0)) FROM #ControlMart;
-- NULL corresponde a No calculable; nunca se sustituye por 0%.
DROP TABLE #ControlO,#ControlP,#ControlA,#ControlOLTP,#ControlMart;

-- BUYER: contrastar las identidades y las cinco medidas sin reutilizar el JOIN dimensional del ETL.
DECLARE @corteBuyer datetime2=COALESCE((SELECT MAX(fecha_corte_etl) FROM dbo.fact_captacion_buyer),SYSDATETIME());
IF EXISTS (SELECT id_persona,id_captacion FROM [$(Origen)].dbo.v_DatosCaptacionBuyer WHERE fecha_captacion<=@corteBuyer
 EXCEPT SELECT id_persona,id_captacion FROM dbo.fact_captacion_buyer)
 OR EXISTS (SELECT id_persona,id_captacion FROM dbo.fact_captacion_buyer
 EXCEPT SELECT id_persona,id_captacion FROM [$(Origen)].dbo.v_DatosCaptacionBuyer WHERE fecha_captacion<=@corteBuyer)
 THROW 55211,'Las identidades BUYER no coinciden entre OLTP y Mart.',1;
SELECT COUNT_BIG(*) contactos,COALESCE(SUM(CONVERT(bigint,contacto_utilizable)),0) utilizables,
 COUNT_BIG(CASE WHEN fecha_conversion<=@corteBuyer THEN 1 END) conversiones,
 COALESCE(SUM(CASE WHEN fecha_conversion<=@corteBuyer
 THEN CONVERT(decimal(18,6),DATEDIFF_BIG(second,fecha_captacion,fecha_conversion)/86400.0) END),0) tiempo_dias
INTO #BuyerOrigen FROM [$(Origen)].dbo.v_DatosCaptacionBuyer WHERE fecha_captacion<=@corteBuyer;
SELECT COUNT_BIG(*) contactos,COALESCE(SUM(CONVERT(bigint,contacto_utilizable)),0) utilizables,
 COALESCE(SUM(CONVERT(bigint,conversion_lead)),0) conversiones,
 COALESCE(SUM(tiempo_conversion_dia),0) tiempo_dias
INTO #BuyerMart FROM dbo.fact_captacion_buyer;
IF EXISTS (SELECT * FROM #BuyerOrigen EXCEPT SELECT * FROM #BuyerMart)
 THROW 55212,'No concilian las medidas de captacion BUYER.',1;
DECLARE @costoEsperado decimal(38,2)=(SELECT COALESCE(SUM(CONVERT(decimal(38,2),g.importe)),0)
 FROM [$(Origen)].dbo.GastosCampana g WHERE g.fecha<=CONVERT(date,@corteBuyer) AND EXISTS
 (SELECT 1 FROM [$(Origen)].dbo.CaptacionesBuyer c WHERE c.id_campana=g.id_campana
 AND c.fecha_captacion<=@corteBuyer AND YEAR(c.fecha_captacion)=YEAR(g.fecha) AND MONTH(c.fecha_captacion)=MONTH(g.fecha)));
IF @costoEsperado<>(SELECT COALESCE(SUM(costo_atribuido_captacion),0) FROM dbo.fact_captacion_buyer)
 THROW 55213,'No concilia el costo atribuible BUYER por campana y mes.',1;
IF (SELECT COUNT_BIG(*) FROM [$(Origen)].dbo.GastosCampana)<>(SELECT COUNT_BIG(*) FROM dbo.fact_inversion_campana_buyer)
 OR (SELECT COALESCE(SUM(CONVERT(decimal(38,2),importe)),0) FROM [$(Origen)].dbo.GastosCampana)<>
    (SELECT COALESCE(SUM(monto_inversion),0) FROM dbo.fact_inversion_campana_buyer)
 THROW 55214,'No concilian gastos e inversion BUYER.',1;
SELECT 'OLTP' Fuente,* FROM #BuyerOrigen UNION ALL SELECT 'Mart',* FROM #BuyerMart;
SELECT @costoEsperado costo_atribuible_esperado,
 (SELECT COALESCE(SUM(costo_atribuido_captacion),0) FROM dbo.fact_captacion_buyer) costo_atribuido_mart,
 (SELECT COALESCE(SUM(monto_inversion),0) FROM dbo.fact_inversion_campana_buyer) inversion_total;
DROP TABLE #BuyerOrigen,#BuyerMart;
IF EXISTS(SELECT 1 FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1)
 OR EXISTS(SELECT 1 FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1)
 THROW 55215,'Restricciones deshabilitadas o no confiables.',1;
IF @@TRANCOUNT<>@nivelVerificacion+1 THROW 55216,'Estado de transaccion inesperado.',1;
COMMIT;
SELECT 'OK' resultado,'Conciliacion independiente BUYER y LEAD; denominador cero = NULL' comprobacion;
GO
