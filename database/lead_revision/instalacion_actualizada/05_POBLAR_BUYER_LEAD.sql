-- Cohorte ficticia BUYER/LEAD: primera entrega, captaciones y conversiones.
-- Destino aislado exclusivo. No usar en la principal.
:ON ERROR EXIT
USE [NexoSalud_InstalacionValidacion];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>'NexoSalud_InstalacionValidacion' THROW 55300,'Destino no autorizado.',1;
IF EXISTS(SELECT 1 FROM dbo.Personas) THROW 55301,'Requiere fuente vacia; no mezclar ni borrar datos.',1;
BEGIN TRY
 BEGIN TRAN;
 DECLARE @buyer int=(SELECT id_etapa FROM dbo.Etapas WHERE nombre='BUYER');
 DECLARE @canal int=(SELECT MIN(id_canal) FROM dbo.Canales WHERE nombre='Formulario Web');
 IF @buyer IS NULL OR @canal IS NULL THROW 55302,'Faltan catalogos estructurales.',1;
 INSERT dbo.Servicios(nombre,descripcion) VALUES('Evaluacion DEMO','Servicio ficticio de presentacion');
 DECLARE @servicio int=SCOPE_IDENTITY(),@persona int,@captacion int;
 DECLARE @ahora datetime2=SYSDATETIME();

 -- 1. Consulta informativa. Identidad ficticia; correo no entregable.
 INSERT dbo.Personas(nombres,apellidos,email,id_etapa_actual,autoriza_contacto,fecha_autorizacion,id_canal_origen)
 VALUES('Ana','DEMO','caso1@example.invalid',@buyer,1,@ahora,@canal);
 SET @persona=SCOPE_IDENTITY();
 INSERT dbo.CaptacionesBuyer(id_persona,fecha_captacion,id_canal,id_servicio,motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
 VALUES(@persona,@ahora,@canal,@servicio,N'Solo deseo conocer el precio','Valido',1,@ahora,'REGISTRO_DIRECTO');
 SET @captacion=SCOPE_IDENTITY();
 INSERT dbo.Interacciones(id_persona,id_canal,fecha_hora,tipo,mensaje)
 VALUES(@persona,@canal,@ahora,'Consulta inicial','Solo deseo conocer el precio');

 -- 2. Sin autorizacion. Identidad ficticia; correo no entregable.
 INSERT dbo.Personas(nombres,apellidos,email,id_etapa_actual,autoriza_contacto,fecha_autorizacion,id_canal_origen)
 VALUES('Bruno','DEMO','caso2@example.invalid',@buyer,0,NULL,@canal);
 SET @persona=SCOPE_IDENTITY();
 INSERT dbo.CaptacionesBuyer(id_persona,fecha_captacion,id_canal,id_servicio,motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
 VALUES(@persona,@ahora,@canal,@servicio,N'Quiero una evaluacion pero no autorizo contacto','Valido',0,NULL,'REGISTRO_DIRECTO');
 SET @captacion=SCOPE_IDENTITY();
 INSERT dbo.Interacciones(id_persona,id_canal,fecha_hora,tipo,mensaje)
 VALUES(@persona,@canal,@ahora,'Consulta inicial','Quiero una evaluacion pero no autorizo contacto');

 -- 3. Aclaracion pendiente. Identidad ficticia; correo no entregable.
 INSERT dbo.Personas(nombres,apellidos,email,id_etapa_actual,autoriza_contacto,fecha_autorizacion,id_canal_origen)
 VALUES('Carla','DEMO','caso3@example.invalid',@buyer,1,@ahora,@canal);
 SET @persona=SCOPE_IDENTITY();
 INSERT dbo.CaptacionesBuyer(id_persona,fecha_captacion,id_canal,id_servicio,motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
 VALUES(@persona,@ahora,@canal,NULL,N'Deseo informacion, aun no decido el servicio','Valido',1,@ahora,'REGISTRO_DIRECTO');
 SET @captacion=SCOPE_IDENTITY();
 INSERT dbo.Interacciones(id_persona,id_canal,fecha_hora,tipo,mensaje)
 VALUES(@persona,@canal,@ahora,'Consulta inicial','Deseo informacion, aun no decido el servicio');

 -- 4. Negociacion inicial. Identidad ficticia; correo no entregable.
 INSERT dbo.Personas(nombres,apellidos,email,id_etapa_actual,autoriza_contacto,fecha_autorizacion,id_canal_origen)
 VALUES('Diego','DEMO','caso4@example.invalid',@buyer,1,@ahora,@canal);
 SET @persona=SCOPE_IDENTITY();
 INSERT dbo.CaptacionesBuyer(id_persona,fecha_captacion,id_canal,id_servicio,motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
 VALUES(@persona,@ahora,@canal,@servicio,N'Quiero reservar una evaluacion','Valido',1,@ahora,'REGISTRO_DIRECTO');
 SET @captacion=SCOPE_IDENTITY();
 INSERT dbo.Interacciones(id_persona,id_canal,fecha_hora,tipo,mensaje)
 VALUES(@persona,@canal,@ahora,'Consulta inicial','Quiero reservar una evaluacion');
EXEC dbo.usp_ConvertirBuyerALead @captacion,@servicio,N'Quiero reservar una evaluacion';
UPDATE dbo.Solicitudes SET resultado_comercial_lead='PENDIENTE',estado='En negociación' WHERE id_persona=@persona;

 -- 5. Presupuesto pendiente. Identidad ficticia; correo no entregable.
 INSERT dbo.Personas(nombres,apellidos,email,id_etapa_actual,autoriza_contacto,fecha_autorizacion,id_canal_origen)
 VALUES('Elena','DEMO','caso5@example.invalid',@buyer,1,@ahora,@canal);
 SET @persona=SCOPE_IDENTITY();
 INSERT dbo.CaptacionesBuyer(id_persona,fecha_captacion,id_canal,id_servicio,motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
 VALUES(@persona,@ahora,@canal,@servicio,N'Quiero reservar y revisar el presupuesto','Valido',1,@ahora,'REGISTRO_DIRECTO');
 SET @captacion=SCOPE_IDENTITY();
 INSERT dbo.Interacciones(id_persona,id_canal,fecha_hora,tipo,mensaje)
 VALUES(@persona,@canal,@ahora,'Consulta inicial','Quiero reservar y revisar el presupuesto');
EXEC dbo.usp_ConvertirBuyerALead @captacion,@servicio,N'Quiero reservar y revisar el presupuesto';
UPDATE dbo.Solicitudes SET resultado_comercial_lead='PENDIENTE',estado='En negociación' WHERE id_persona=@persona;

 -- 6. Horario pendiente. Identidad ficticia; correo no entregable.
 INSERT dbo.Personas(nombres,apellidos,email,id_etapa_actual,autoriza_contacto,fecha_autorizacion,id_canal_origen)
 VALUES('Fabio','DEMO','caso6@example.invalid',@buyer,1,@ahora,@canal);
 SET @persona=SCOPE_IDENTITY();
 INSERT dbo.CaptacionesBuyer(id_persona,fecha_captacion,id_canal,id_servicio,motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
 VALUES(@persona,@ahora,@canal,@servicio,N'Quiero reservar y consultar horarios','Valido',1,@ahora,'REGISTRO_DIRECTO');
 SET @captacion=SCOPE_IDENTITY();
 INSERT dbo.Interacciones(id_persona,id_canal,fecha_hora,tipo,mensaje)
 VALUES(@persona,@canal,@ahora,'Consulta inicial','Quiero reservar y consultar horarios');
EXEC dbo.usp_ConvertirBuyerALead @captacion,@servicio,N'Quiero reservar y consultar horarios';
UPDATE dbo.Solicitudes SET resultado_comercial_lead='PENDIENTE',estado='En negociación' WHERE id_persona=@persona;

 IF (SELECT COUNT(*) FROM dbo.Personas)<>6 OR (SELECT COUNT(*) FROM dbo.CaptacionesBuyer)<>6
 OR (SELECT COUNT(*) FROM dbo.Solicitudes)<>3 OR (SELECT COUNT(*) FROM dbo.EventosEtapa)<>3
 THROW 55303,'Conteos inesperados: revertir cohorte.',1;
 -- Por ahora ninguna decision comercial: no inventar M1-M8.
 COMMIT;
 SELECT 'Cohorte inicial instalada: 6 captaciones, 3 conversiones, 3 pendientes' resultado;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
