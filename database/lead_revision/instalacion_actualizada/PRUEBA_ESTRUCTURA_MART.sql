:ON ERROR EXIT
-- Prueba de estructura en una instalacion nueva/vacia. No es ETL ni poblamiento de presentacion.
-- Todos los miembros y hechos temporales se revierten. No consulta ni escribe OLTP.
-- sqlcmd -S "SU_INSTANCIA" -E -C -I -b -t 120 -f 65001 -d NexoSalud_Mart_InstalacionValidacion -v MartEsperado=NexoSalud_Mart_InstalacionValidacion -i database/lead_revision/instalacion_actualizada/PRUEBA_ESTRUCTURA_MART.sql
SET NOCOUNT ON;
SET XACT_ABORT OFF; -- Las infracciones intencionales deben permitir continuar y revertir el caso.
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
IF DB_NAME()<>N'$(MartEsperado)' OR DB_NAME() IN ('NexoSaludDB','NexoSalud_Mart','master','model','msdb','tempdb')
 THROW 55120,'Destino de prueba no permitido.',1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='NexoSaludPaquete'
 AND CONVERT(nvarchar(100),value)='LEAD-MART-2026-11-BUYER-REVISADO')
 THROW 55121,'Falta la marca de instalacion del paquete.',1;
IF EXISTS (SELECT 1 FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id
 WHERE t.is_ms_shipped=0 AND p.index_id IN (0,1) AND p.rows>0)
 THROW 55122,'La prueba requiere un Mart sin datos.',1;

DECLARE @claves TABLE(tabla sysname,orden int,columna sysname);
INSERT @claves VALUES
 ('fact_oportunidades_lead',1,'KeyTiempo'),('fact_oportunidades_lead',2,'KeyServicio'),
 ('fact_oportunidades_lead',3,'KeyCanal'),('fact_oportunidades_lead',4,'KeySede'),('fact_oportunidades_lead',5,'KeyNegociador'),
 ('fact_propuestas_aceptadas_lead',1,'KeyTiempo'),('fact_propuestas_aceptadas_lead',2,'KeyServicio'),('fact_propuestas_aceptadas_lead',3,'KeyPromocion'),
 ('fact_propuestas_rechazadas_lead',1,'KeyTiempo'),('fact_propuestas_rechazadas_lead',2,'KeyServicio'),
 ('fact_propuestas_rechazadas_lead',3,'KeyPromocion'),('fact_propuestas_rechazadas_lead',4,'KeyMotivoRechazo'),
 ('fact_alternativas_aceptadas_lead',1,'KeyTiempo'),('fact_alternativas_aceptadas_lead',2,'KeyServicio'),
 ('fact_alternativas_aceptadas_lead',3,'KeySede'),('fact_alternativas_aceptadas_lead',4,'KeyProfesional'),
 ('fact_alternativas_aceptadas_lead',5,'KeyHorarioPreferido'),('fact_alternativas_aceptadas_lead',6,'KeyHorarioOfrecido'),
 ('fact_alternativas_rechazadas_lead',1,'KeyTiempo'),('fact_alternativas_rechazadas_lead',2,'KeyServicio'),
 ('fact_alternativas_rechazadas_lead',3,'KeySede'),('fact_alternativas_rechazadas_lead',4,'KeyProfesional'),
 ('fact_alternativas_rechazadas_lead',5,'KeyHorarioPreferido'),('fact_alternativas_rechazadas_lead',6,'KeyHorarioOfrecido'),
 ('fact_alternativas_rechazadas_lead',7,'KeyMotivoRechazo');
DECLARE @reales TABLE(tabla sysname,orden int,columna sysname);
INSERT @reales SELECT OBJECT_NAME(i.object_id),c.key_ordinal,COL_NAME(c.object_id,c.column_id)
 FROM sys.indexes i JOIN sys.index_columns c ON c.object_id=i.object_id AND c.index_id=i.index_id
 WHERE i.is_primary_key=1 AND OBJECT_NAME(i.object_id) IN (SELECT tabla FROM @claves);
IF EXISTS (SELECT * FROM @claves EXCEPT SELECT * FROM @reales)
 OR EXISTS (SELECT * FROM @reales EXCEPT SELECT * FROM @claves)
 THROW 55123,'Las PK de LEAD no respetan el grano dimensional aprobado.',1;
IF (SELECT COUNT(*) FROM sys.foreign_keys f JOIN sys.foreign_key_columns c ON c.constraint_object_id=f.object_id
 WHERE OBJECT_NAME(f.parent_object_id) IN ('fact_alternativas_aceptadas_lead','fact_alternativas_rechazadas_lead')
 AND COL_NAME(c.parent_object_id,c.parent_column_id) IN ('KeyHorarioPreferido','KeyHorarioOfrecido')
 AND OBJECT_NAME(f.referenced_object_id)='Dim_Horario')<>4
 THROW 55124,'Los dos roles de horario no comparten la dimension aprobada.',1;
IF COL_LENGTH('dbo.fact_captacion_buyer','id_persona') IS NULL
 OR COL_LENGTH('dbo.fact_inversion_campana_buyer','id_gasto') IS NULL
 THROW 55125,'No se instalo la version publicada de las tablas BUYER.',1;

BEGIN TRANSACTION;
DECLARE @fecha date=DATEFROMPARTS(2099,1,15),@tiempo int,@servicio int,@canal int,@sede int,@negociador int,
 @profesional int,@promocion int,@economico int,@incompatible int,@preferido int,@ofrecido int,@rechazada bit;
SET @tiempo=YEAR(@fecha)*10000+MONTH(@fecha)*100+DAY(@fecha);
INSERT dbo.Dim_Tiempo(KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia)
 VALUES (@tiempo,@fecha,YEAR(@fecha),DATEPART(quarter,@fecha),MONTH(@fecha),DAY(@fecha));
INSERT dbo.Dim_Servicio(ServicioOdontologico) VALUES ('Temporal de estructura'); SET @servicio=SCOPE_IDENTITY();
INSERT dbo.Dim_Canal(NombreCanal) VALUES ('Temporal'); SET @canal=SCOPE_IDENTITY();
INSERT dbo.Dim_Sede(Sede) VALUES ('Temporal'); SET @sede=SCOPE_IDENTITY();
INSERT dbo.Dim_Negociador(NombreNegociador) VALUES ('Temporal'); SET @negociador=SCOPE_IDENTITY();
INSERT dbo.Dim_Profesional(Odontologo) VALUES ('Temporal'); SET @profesional=SCOPE_IDENTITY();
INSERT dbo.Dim_Promocion(Origen,PromocionAplicada) VALUES ('TEXTO',N'Temporal'); SET @promocion=SCOPE_IDENTITY();
-- IDs naturales ficticios de prueba; las claves sustitutas se recuperan de cada INSERT.
INSERT dbo.Dim_MotivoRechazo(id_motivo_rechazo,Ambito,TipoMotivoRechazo,MotivoRechazo)
 VALUES (901,'PROPUESTA','ECONOMICO',N'Temporal economico'); SET @economico=SCOPE_IDENTITY();
INSERT dbo.Dim_MotivoRechazo(id_motivo_rechazo,Ambito,TipoMotivoRechazo,MotivoRechazo)
 VALUES (902,'ALTERNATIVA','INCOMPATIBILIDAD',N'Temporal incompatible'); SET @incompatible=SCOPE_IDENTITY();
INSERT dbo.Dim_Horario(TipoMiembro,NumeroDiaSemana,Turno,HoraInicio,HoraFin)
 VALUES ('OBSERVADO',3,N'Mañana','09:00','10:00'); SET @preferido=SCOPE_IDENTITY();
INSERT dbo.Dim_Horario(TipoMiembro,NumeroDiaSemana,Turno,HoraInicio,HoraFin)
 VALUES ('OBSERVADO',3,N'Tarde','14:00','15:00'); SET @ofrecido=SCOPE_IDENTITY();
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Horario WHERE KeyHorario=@preferido AND DiaSemana=N'Miércoles'
 AND CHARINDEX(N'–',CONVERT(nvarchar(50),IntervaloHorario))>0)
 THROW 55126,'Las columnas calculadas de horario o su codificacion no coinciden.',1;

INSERT dbo.fact_oportunidades_lead(KeyTiempo,KeyServicio,KeyCanal,KeySede,KeyNegociador,oportunidad_aceptada,oportunidad_cerrada_sin_acuerdo)
 VALUES (@tiempo,@servicio,@canal,@sede,@negociador,5,2);
INSERT dbo.fact_propuestas_aceptadas_lead(KeyTiempo,KeyServicio,KeyPromocion,propuesta_aceptada)
 VALUES (@tiempo,@servicio,@promocion,4);
INSERT dbo.fact_propuestas_rechazadas_lead(KeyTiempo,KeyServicio,KeyPromocion,KeyMotivoRechazo,propuesta_rechazada,propuesta_rechazada_economica)
 VALUES (@tiempo,@servicio,@promocion,@economico,3,2);
INSERT dbo.fact_alternativas_aceptadas_lead(KeyTiempo,KeyServicio,KeySede,KeyProfesional,KeyHorarioPreferido,KeyHorarioOfrecido,alternativa_aceptada)
 VALUES (@tiempo,@servicio,@sede,@profesional,@preferido,@ofrecido,6);
INSERT dbo.fact_alternativas_rechazadas_lead(KeyTiempo,KeyServicio,KeySede,KeyProfesional,KeyHorarioPreferido,KeyHorarioOfrecido,KeyMotivoRechazo,alternativa_rechazada,alternativa_rechazada_incompatibilidad)
 VALUES (@tiempo,@servicio,@sede,@profesional,@preferido,@ofrecido,@incompatible,4,3);
IF (SELECT COUNT(*) FROM dbo.fact_oportunidades_lead)<>1
 OR (SELECT SUM(oportunidad_aceptada) FROM dbo.fact_oportunidades_lead)<>5
 THROW 55127,'Una fila agregada no conserva la cantidad de oportunidades.',1;

SET @rechazada=0;
BEGIN TRY
 INSERT dbo.fact_oportunidades_lead(KeyTiempo,KeyServicio,KeyCanal,KeySede,KeyNegociador,oportunidad_aceptada,oportunidad_cerrada_sin_acuerdo)
 VALUES (@tiempo,@servicio,@canal,@sede,@negociador,1,0);
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>2627 THROW;
 SET @rechazada=1;
END CATCH;
IF @rechazada=0 THROW 55128,'La PK permitio una combinacion dimensional duplicada.',1;

SET @rechazada=0;
BEGIN TRY
 UPDATE dbo.fact_propuestas_rechazadas_lead SET propuesta_rechazada_economica=4;
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>547 THROW;
 SET @rechazada=1;
END CATCH;
IF @rechazada=0 THROW 55129,'Se permitio M5 mayor que M4.',1;

SET @rechazada=0;
BEGIN TRY
 UPDATE dbo.fact_alternativas_rechazadas_lead SET alternativa_rechazada_incompatibilidad=5;
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>547 THROW;
 SET @rechazada=1;
END CATCH;
IF @rechazada=0 THROW 55130,'Se permitio M8 mayor que M7.',1;

SET @rechazada=0;
BEGIN TRY
 UPDATE dbo.fact_oportunidades_lead SET oportunidad_aceptada=-1;
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>547 THROW;
 SET @rechazada=1;
END CATCH;
IF @rechazada=0 THROW 55131,'Se permitieron medidas negativas.',1;

SET @rechazada=0;
BEGIN TRY
 INSERT dbo.fact_propuestas_aceptadas_lead(KeyTiempo,KeyServicio,KeyPromocion,propuesta_aceptada)
 VALUES (@tiempo,-2147483648,@promocion,1);
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>547 THROW;
 SET @rechazada=1;
END CATCH;
IF @rechazada=0 THROW 55132,'Se permitio una clave dimensional inexistente.',1;

SELECT 'TEMPORAL; SE REVIERTE' escenario,
 (SELECT SUM(oportunidad_aceptada) FROM dbo.fact_oportunidades_lead) M1,
 (SELECT SUM(oportunidad_cerrada_sin_acuerdo) FROM dbo.fact_oportunidades_lead) M2,
 (SELECT SUM(propuesta_aceptada) FROM dbo.fact_propuestas_aceptadas_lead) M3,
 (SELECT SUM(propuesta_rechazada) FROM dbo.fact_propuestas_rechazadas_lead) M4,
 (SELECT SUM(propuesta_rechazada_economica) FROM dbo.fact_propuestas_rechazadas_lead) M5,
 (SELECT SUM(alternativa_aceptada) FROM dbo.fact_alternativas_aceptadas_lead) M6,
 (SELECT SUM(alternativa_rechazada) FROM dbo.fact_alternativas_rechazadas_lead) M7,
 (SELECT SUM(alternativa_rechazada_incompatibilidad) FROM dbo.fact_alternativas_rechazadas_lead) M8;
ROLLBACK TRANSACTION;
IF EXISTS (SELECT 1 FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id
 WHERE t.is_ms_shipped=0 AND p.index_id IN (0,1) AND p.rows>0)
 THROW 55133,'Persistieron filas de la prueba.',1;
DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;
DBCC CHECKDB WITH NO_INFOMSGS;
SELECT 'OK' resultado,'PK agregadas, roles de horario, limites de medidas, FK y rollback' comprobacion;
-- Las secuencias IDENTITY pueden avanzar aunque se reviertan sus filas.
