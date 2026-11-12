/* QA BUYER SQL - D2 recepcion posterior desde sesion nueva; no es caida de backend
 Destino exclusivo: DANIELPC / NexoSalud_LeadEnsayoFinal.
 Prefijo exclusivo QA_BCV_20261112T193315Z_. HEAD 19613358530e899bfc68d5e6b3c33b6336ab9ce4.
 No modifica procedimientos, Prisma ni agente. No invoca Gemini/Mart.
 Ejecutar cada archivo entero con SQLCMD -b -I en sesion nueva. Sin GO.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET IMPLICIT_TRANSACTIONS OFF;
IF ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') COLLATE Latin1_General_100_BIN2<>N'DANIELPC'
 OR ISNULL(DB_NAME(),N'') COLLATE Latin1_General_100_BIN2<>N'NexoSalud_LeadEnsayoFinal'
 THROW 55100,'Destino QA incorrecto.',1;
IF @@TRANCOUNT<>0 THROW 55101,'Se requiere sesion nueva sin transaccion externa.',1;
IF ISNULL(HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION'),0)<>1 THROW 55102,'Falta VIEW DEFINITION.',1;
IF EXISTS(SELECT 1 FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_tran_database_transactions d JOIN sys.dm_tran_session_transactions s ON s.transaction_id=d.transaction_id WHERE d.database_id=DB_ID() AND s.session_id<>@@SPID)
 THROW 55103,'Otra peticion o transaccion QA activa. Detener escritores.',1;
IF ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID('dbo.usp_ConvertirBuyerALead'))),2),'')<>'6A42F2ADD1BE9F827074A50A6DCB579C6341F71C35E8F0216E4E04A70DC634A5'
 OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID('dbo.usp_RegistrarEntradaAgenteLead'))),2),'')<>'280708E81E3BE607A3772F082961EBE6E8371C1698414F3FDAC8B82D8A0C087E'
 OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID('dbo.v_DatosCaptacionBuyer'))),2),'')<>'BAC8AB4A8AF43E8FB98BFABFE29FA8DC4F4D17F42CB5389EDEF23844EE85665D'
 THROW 55104,'Definicion instalada distinta de la inspeccionada. No ejecutar pruebas.',1;
IF EXISTS(SELECT 1 FROM sys.triggers WHERE parent_id IN(OBJECT_ID('dbo.Personas'),OBJECT_ID('dbo.CaptacionesBuyer'),OBJECT_ID('dbo.Solicitudes'),OBJECT_ID('dbo.EventosEtapa'),OBJECT_ID('dbo.EntradasAgenteLead')) AND is_disabled=0)
 THROW 55105,'Hay triggers adicionales que requieren inspeccion antes de escribir.',1;
IF EXISTS(SELECT 1 FROM sys.foreign_keys WHERE parent_object_id IN(OBJECT_ID('dbo.Personas'),OBJECT_ID('dbo.CaptacionesBuyer'),OBJECT_ID('dbo.Solicitudes'),OBJECT_ID('dbo.EventosEtapa'),OBJECT_ID('dbo.EntradasAgenteLead')) AND (is_disabled=1 OR is_not_trusted=1))
 OR EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id IN(OBJECT_ID('dbo.Personas'),OBJECT_ID('dbo.CaptacionesBuyer'),OBJECT_ID('dbo.Solicitudes'),OBJECT_ID('dbo.EventosEtapa'),OBJECT_ID('dbo.EntradasAgenteLead')) AND (is_disabled=1 OR is_not_trusted=1))
 THROW 55106,'Restriccion deshabilitada o no confiable.',1;
DECLARE @prefijo varchar(50)='QA_BCV_20261112T193315Z_';
DECLARE @buyer int=(SELECT id_etapa FROM dbo.Etapas WHERE nombre='BUYER'),@lead int=(SELECT id_etapa FROM dbo.Etapas WHERE nombre='LEAD');
DECLARE @servicio int=(SELECT TOP(1) id_servicio FROM dbo.Servicios WHERE activo=1 ORDER BY id_servicio);
IF @buyer IS NULL OR @lead IS NULL OR @servicio IS NULL THROW 55107,'Faltan catalogos minimos.',1;
DECLARE @persona int,@captacion int,@solicitud int,@evento int,@motivo nvarchar(200),@nombre varchar(50),@email varchar(100);
BEGIN TRY
SET @nombre=@prefijo+'D'; SET @email=@nombre+'@example.invalid'; SET @motivo=@nombre+' reserva sintetica SQL';
IF (SELECT COUNT(*) FROM dbo.Personas WHERE nombres=@nombre AND apellidos='QA SINTETICO' AND email=@email)<>1
 THROW 55120,'D2: no existe exactamente el fixture exclusivo de D1.',1;
SELECT @persona=id_persona FROM dbo.Personas WHERE nombres=@nombre AND apellidos='QA SINTETICO' AND email=@email;
IF (SELECT COUNT(*) FROM dbo.CaptacionesBuyer WHERE id_persona=@persona)<>1 THROW 55121,'D2: captacion ambigua.',1;
SELECT @captacion=id_captacion FROM dbo.CaptacionesBuyer WHERE id_persona=@persona;
SELECT @solicitud=s.id_solicitud,@evento=e.id_evento_etapa
FROM dbo.Solicitudes s JOIN dbo.EventosEtapa e ON e.id_solicitud=s.id_solicitud AND e.id_persona=s.id_persona
WHERE s.id_persona=@persona AND e.id_captacion=@captacion AND e.etapa_origen=@buyer AND e.etapa_destino=@lead
 AND e.clave_operacion_buyer=CONCAT('BUYER_LEAD:',@captacion);
IF @solicitud IS NULL OR @evento IS NULL OR (SELECT COUNT(*) FROM dbo.Solicitudes WHERE id_persona=@persona)<>1
 OR (SELECT COUNT(*) FROM dbo.EventosEtapa WHERE id_persona=@persona)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.Personas WHERE id_persona=@persona AND id_etapa_actual=@lead)
 THROW 55110,'Conversion: vinculos, cantidades o etapa incorrectos.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.Solicitudes s JOIN dbo.EventosEtapa e ON e.id_solicitud=s.id_solicitud
 JOIN dbo.CaptacionesBuyer c ON c.id_captacion=e.id_captacion AND c.id_persona=s.id_persona
 WHERE s.id_solicitud=@solicitud AND e.id_evento_etapa=@evento AND s.id_servicio=@servicio
 AND s.motivo=@motivo AND e.fecha_hora>=c.fecha_captacion AND e.clave_operacion_buyer=CONCAT('BUYER_LEAD:',c.id_captacion))
 THROW 55111,'Conversion: contenido comercial o clave de operacion incorrectos.',1;

IF EXISTS(SELECT 1 FROM dbo.EntradasAgenteLead WHERE id_solicitud=@solicitud) THROW 55122,'D2: ya hay entrada; no repetir este caso confirmado.',1;
DECLARE @s_original int=@solicitud,@e_original int=@evento;
SELECT 'D2_ANTES_RECEPCION' bloque,@persona id_persona,@captacion id_captacion,@solicitud id_solicitud,@evento id_evento_etapa,0 entradas,@@TRANCOUNT trancount;
EXEC dbo.usp_RegistrarEntradaAgenteLead @id_solicitud=@solicitud;
IF (SELECT COUNT(*) FROM dbo.EntradasAgenteLead WHERE id_solicitud=@solicitud)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.EntradasAgenteLead WHERE id_solicitud=@solicitud AND id_evento_etapa=@evento AND id_captacion=@captacion AND id_persona=@persona)
 THROW 55115,'Recepcion: cantidad o vinculos incorrectos.',1;
IF @@TRANCOUNT<>0 THROW 55116,'El receptor dejo una transaccion abierta.',1;

SELECT @solicitud=s.id_solicitud,@evento=e.id_evento_etapa
FROM dbo.Solicitudes s JOIN dbo.EventosEtapa e ON e.id_solicitud=s.id_solicitud AND e.id_persona=s.id_persona
WHERE s.id_persona=@persona AND e.id_captacion=@captacion AND e.etapa_origen=@buyer AND e.etapa_destino=@lead
 AND e.clave_operacion_buyer=CONCAT('BUYER_LEAD:',@captacion);
IF @solicitud IS NULL OR @evento IS NULL OR (SELECT COUNT(*) FROM dbo.Solicitudes WHERE id_persona=@persona)<>1
 OR (SELECT COUNT(*) FROM dbo.EventosEtapa WHERE id_persona=@persona)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.Personas WHERE id_persona=@persona AND id_etapa_actual=@lead)
 THROW 55110,'Conversion: vinculos, cantidades o etapa incorrectos.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.Solicitudes s JOIN dbo.EventosEtapa e ON e.id_solicitud=s.id_solicitud
 JOIN dbo.CaptacionesBuyer c ON c.id_captacion=e.id_captacion AND c.id_persona=s.id_persona
 WHERE s.id_solicitud=@solicitud AND e.id_evento_etapa=@evento AND s.id_servicio=@servicio
 AND s.motivo=@motivo AND e.fecha_hora>=c.fecha_captacion AND e.clave_operacion_buyer=CONCAT('BUYER_LEAD:',c.id_captacion))
 THROW 55111,'Conversion: contenido comercial o clave de operacion incorrectos.',1;

IF @solicitud<>@s_original OR @evento<>@e_original THROW 55123,'D2 cambio identidad de conversion.',1;
SELECT 'D2_OK_ENTREGA_SQL' bloque,@nombre nombre_sintetico,@persona id_persona,@captacion id_captacion,@solicitud id_solicitud,@evento id_evento_etapa,1 entradas,@@TRANCOUNT trancount,SYSUTCDATETIME() utc;
END TRY
BEGIN CATCH
 DECLARE @err int=ERROR_NUMBER(),@msg nvarchar(4000)=ERROR_MESSAGE();
 IF XACT_STATE()<>0 ROLLBACK;
 SELECT 'ERROR_PRUEBA' bloque,@err numero,@msg mensaje,@persona id_persona_sintetica,@captacion id_captacion_sintetica,@solicitud id_solicitud_sintetica,@evento id_evento_sintetico;
 THROW;
END CATCH;
