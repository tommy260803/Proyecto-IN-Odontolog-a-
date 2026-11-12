/* QA BUYER SQL - captura de solo lectura antes/despues y sujetos sinteticos
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
SELECT CAST(@@SERVERNAME AS nvarchar(128)) servidor,DB_NAME() base_efectiva,SYSUTCDATETIME() utc,@prefijo prefijo;
SELECT 'PATRIMONIO' seccion,'Personas' tabla,(SELECT COUNT_BIG(*) FROM dbo.Personas) total,
 (SELECT COUNT_BIG(*) FROM dbo.Personas t WHERE LEFT(t.nombres,LEN(@prefijo))=@prefijo) sinteticos,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FROM dbo.Personas t WHERE LEFT(t.nombres,LEN(@prefijo))<>@prefijo ORDER BY t.id_persona FOR JSON PATH,INCLUDE_NULL_VALUES)),2) sha256_fuera_prefijo;
SELECT 'PATRIMONIO' seccion,'CaptacionesBuyer' tabla,(SELECT COUNT_BIG(*) FROM dbo.CaptacionesBuyer) total,
 (SELECT COUNT_BIG(*) FROM dbo.CaptacionesBuyer t WHERE EXISTS(SELECT 1 FROM dbo.Personas p WHERE p.id_persona=t.id_persona AND LEFT(p.nombres,LEN(@prefijo))=@prefijo)) sinteticos,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FROM dbo.CaptacionesBuyer t WHERE NOT EXISTS(SELECT 1 FROM dbo.Personas p WHERE p.id_persona=t.id_persona AND LEFT(p.nombres,LEN(@prefijo))=@prefijo) ORDER BY t.id_captacion FOR JSON PATH,INCLUDE_NULL_VALUES)),2) sha256_fuera_prefijo;
SELECT 'PATRIMONIO' seccion,'Solicitudes' tabla,(SELECT COUNT_BIG(*) FROM dbo.Solicitudes) total,
 (SELECT COUNT_BIG(*) FROM dbo.Solicitudes t WHERE EXISTS(SELECT 1 FROM dbo.Personas p WHERE p.id_persona=t.id_persona AND LEFT(p.nombres,LEN(@prefijo))=@prefijo)) sinteticos,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FROM dbo.Solicitudes t WHERE NOT EXISTS(SELECT 1 FROM dbo.Personas p WHERE p.id_persona=t.id_persona AND LEFT(p.nombres,LEN(@prefijo))=@prefijo) ORDER BY t.id_solicitud FOR JSON PATH,INCLUDE_NULL_VALUES)),2) sha256_fuera_prefijo;
SELECT 'PATRIMONIO' seccion,'EventosEtapa' tabla,(SELECT COUNT_BIG(*) FROM dbo.EventosEtapa) total,
 (SELECT COUNT_BIG(*) FROM dbo.EventosEtapa t WHERE EXISTS(SELECT 1 FROM dbo.Personas p WHERE p.id_persona=t.id_persona AND LEFT(p.nombres,LEN(@prefijo))=@prefijo)) sinteticos,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FROM dbo.EventosEtapa t WHERE NOT EXISTS(SELECT 1 FROM dbo.Personas p WHERE p.id_persona=t.id_persona AND LEFT(p.nombres,LEN(@prefijo))=@prefijo) ORDER BY t.id_evento_etapa FOR JSON PATH,INCLUDE_NULL_VALUES)),2) sha256_fuera_prefijo;
SELECT 'PATRIMONIO' seccion,'EntradasAgenteLead' tabla,(SELECT COUNT_BIG(*) FROM dbo.EntradasAgenteLead) total,
 (SELECT COUNT_BIG(*) FROM dbo.EntradasAgenteLead t WHERE EXISTS(SELECT 1 FROM dbo.Personas p WHERE p.id_persona=t.id_persona AND LEFT(p.nombres,LEN(@prefijo))=@prefijo)) sinteticos,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FROM dbo.EntradasAgenteLead t WHERE NOT EXISTS(SELECT 1 FROM dbo.Personas p WHERE p.id_persona=t.id_persona AND LEFT(p.nombres,LEN(@prefijo))=@prefijo) ORDER BY t.id_solicitud FOR JSON PATH,INCLUDE_NULL_VALUES)),2) sha256_fuera_prefijo;
SELECT 'OTROS_CONTEOS' seccion,(SELECT COUNT_BIG(*) FROM dbo.Opciones) opciones,(SELECT COUNT_BIG(*) FROM dbo.Reservas) reservas,
 (SELECT COUNT_BIG(*) FROM dbo.PropuestasEconomicasLead) propuestas,(SELECT COUNT_BIG(*) FROM dbo.Interacciones) interacciones,(SELECT COUNT_BIG(*) FROM dbo.DecisionesIA) decisiones;
SELECT 'SUJETOS' seccion,p.nombres,p.id_persona,c.id_captacion,s.id_solicitud,e.id_evento_etapa,e.clave_operacion_buyer,et.nombre etapa,
 CASE WHEN a.id_solicitud IS NULL THEN 0 ELSE 1 END entrada,a.fecha_registro_utc
FROM dbo.Personas p LEFT JOIN dbo.CaptacionesBuyer c ON c.id_persona=p.id_persona
LEFT JOIN dbo.Solicitudes s ON s.id_persona=p.id_persona LEFT JOIN dbo.EventosEtapa e ON e.id_solicitud=s.id_solicitud AND e.id_captacion=c.id_captacion
LEFT JOIN dbo.EntradasAgenteLead a ON a.id_solicitud=s.id_solicitud LEFT JOIN dbo.Etapas et ON et.id_etapa=p.id_etapa_actual
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY p.id_persona;
SELECT 'MODULO' seccion,OBJECT_NAME(m.object_id) nombre,CONVERT(varchar(64),HASHBYTES('SHA2_256',m.definition),2) sha256
FROM sys.sql_modules m WHERE m.object_id IN(OBJECT_ID('dbo.usp_ConvertirBuyerALead'),OBJECT_ID('dbo.usp_RegistrarEntradaAgenteLead'),OBJECT_ID('dbo.v_DatosCaptacionBuyer')) ORDER BY nombre;
SELECT 'CATALOGO' seccion,COUNT(*) objetos FROM sys.objects WHERE is_ms_shipped=0;
