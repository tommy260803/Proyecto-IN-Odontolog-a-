:ON ERROR EXIT
-- Solo para una instalacion nueva y vacia del archivo 01. Datos temporales con ROLLBACK.
-- No es el poblamiento persistente de presentacion (fase 5).
-- sqlcmd -S "SU_INSTANCIA" -E -C -I -b -t 120 -f 65001 -d NexoSalud_InstalacionValidacion -v BaseEsperada=NexoSalud_InstalacionValidacion -i database/lead_revision/instalacion_actualizada/PRUEBA_INSTALACION_OLTP.sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
IF DB_NAME()<>N'$(BaseEsperada)' OR DB_NAME() IN ('NexoSaludDB','NexoSalud_Mart','master','model','msdb','tempdb')
 THROW 55020,'Destino de prueba no permitido.',1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0
 AND name=N'NexoSaludPaquete' AND CONVERT(nvarchar(100),value)=N'LEAD-OLTP-2026-11')
 THROW 55021,'Falta la marca del paquete de instalacion.',1;
IF EXISTS(SELECT 1 FROM dbo.Personas) OR EXISTS(SELECT 1 FROM dbo.Servicios)
 OR EXISTS(SELECT 1 FROM dbo.Solicitudes) OR EXISTS(SELECT 1 FROM dbo.EventosEtapa)
 THROW 55022,'Esta prueba requiere una instalacion sin datos operativos.',1;

BEGIN TRANSACTION;
PRINT 'Prueba: creando caso temporal BUYER';
DECLARE @buyer int=(SELECT id_etapa FROM dbo.Etapas WHERE nombre='BUYER'),
 @lead int=(SELECT id_etapa FROM dbo.Etapas WHERE nombre='LEAD'),
 @canal int=(SELECT id_canal FROM dbo.Canales WHERE nombre='Formulario Web'),
 @persona int,@servicio int,@captacion int,@solicitud int,@evento int;
INSERT dbo.Servicios(nombre,descripcion) VALUES ('Caso temporal de instalacion','Se revierte al terminar');
SET @servicio=SCOPE_IDENTITY();
INSERT dbo.Personas(nombres,apellidos,numero,id_etapa_actual,autoriza_contacto,fecha_autorizacion)
 VALUES ('Prueba','Instalacion','999000111',@buyer,1,SYSDATETIME());
SET @persona=SCOPE_IDENTITY();
INSERT dbo.CaptacionesBuyer(id_persona,fecha_captacion,id_canal,id_servicio,
 motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
 VALUES (@persona,SYSDATETIME(),@canal,@servicio,N'Quiero reservar el servicio de prueba',
 'Valido',1,SYSDATETIME(),'REGISTRO_DIRECTO');
SET @captacion=SCOPE_IDENTITY();

PRINT 'Prueba: primera conversion';
EXEC dbo.usp_ConvertirBuyerALead @id_captacion=@captacion,@id_servicio=@servicio,
 @motivo=N'Intencion expresa del caso temporal',@id_usuario=NULL;
SELECT @solicitud=id_solicitud,@evento=id_evento_etapa FROM dbo.EventosEtapa
 WHERE id_captacion=@captacion AND etapa_origen=@buyer AND etapa_destino=@lead;
IF @solicitud IS NULL OR @evento IS NULL
 THROW 55023,'La conversion no vinculo captacion, solicitud y evento.',1;
PRINT 'Prueba: reintento de conversion';
EXEC dbo.usp_ConvertirBuyerALead @id_captacion=@captacion,@id_servicio=@servicio,
 @motivo=N'Reintento del mismo caso temporal',@id_usuario=NULL;
IF (SELECT COUNT(*) FROM dbo.Solicitudes WHERE id_persona=@persona)<>1
 OR (SELECT COUNT(*) FROM dbo.EventosEtapa WHERE id_captacion=@captacion)<>1
 OR NOT EXISTS (SELECT 1 FROM dbo.Personas WHERE id_persona=@persona AND id_etapa_actual=@lead)
 THROW 55024,'El reintento duplico o desvinculo la conversion.',1;
DECLARE @corte datetime2(7)=SYSUTCDATETIME();
PRINT 'Prueba: consulta de oportunidades al corte';
IF (SELECT COUNT(*) FROM dbo.fn_Lead_Oportunidades_Corte(@corte) WHERE id_solicitud=@solicitud)<>1
 OR EXISTS (SELECT 1 FROM dbo.fn_Lead_Oportunidades_Corte(@corte)
   WHERE oportunidad_aceptada<>0 OR oportunidad_cerrada_sin_acuerdo<>0)
 THROW 55025,'El ingreso no aparece una vez o se invento un resultado comercial.',1;
IF EXISTS(SELECT 1 FROM dbo.Reservas) OR EXISTS(SELECT 1 FROM dbo.Pagos)
 THROW 55026,'Convertir BUYER a LEAD no debe crear reservas ni pagos.',1;
DECLARE @inicio date=DATEFROMPARTS(YEAR(SYSDATETIME()),MONTH(SYSDATETIME()),1),@fin date;
SET @fin=DATEADD(month,1,@inicio);
PRINT 'Prueba: R1';
EXEC dbo.usp_Lead_ReporteR1 @periodo_inicio=@inicio,@periodo_fin_exclusivo=@fin,@corte_utc=@corte;
PRINT 'Prueba: R2';
EXEC dbo.usp_Lead_ReporteR2 @periodo_inicio=@inicio,@periodo_fin_exclusivo=@fin,@corte_utc=@corte;
PRINT 'Prueba: R3';
EXEC dbo.usp_Lead_ReporteR3 @periodo_inicio=@inicio,@periodo_fin_exclusivo=@fin,@corte_utc=@corte;
PRINT 'Prueba: revirtiendo datos';
ROLLBACK TRANSACTION;

IF EXISTS(SELECT 1 FROM dbo.Personas) OR EXISTS(SELECT 1 FROM dbo.Servicios)
 OR EXISTS(SELECT 1 FROM dbo.Solicitudes) OR EXISTS(SELECT 1 FROM dbo.CaptacionesBuyer)
 OR EXISTS(SELECT 1 FROM dbo.EventosEtapa) OR EXISTS(SELECT 1 FROM dbo.HistorialSolicitudesLead)
 THROW 55027,'Persistieron datos de la prueba despues del rollback.',1;
DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;
DBCC CHECKDB WITH NO_INFOMSGS;
SELECT 'OK' resultado,'Conversion idempotente, funciones y reportes ejecutados; datos revertidos' comprobacion;
-- Las secuencias IDENTITY pueden avanzar aunque se reviertan las filas.
