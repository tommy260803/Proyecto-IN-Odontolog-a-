-- SSMS: conectarse exclusivamente a DANIELPC / NexoSalud_LeadEnsayoFinal.
-- Solo lectura. Sin GO, USE, procedimientos ni limpieza.
SET NOCOUNT ON;
IF CAST(@@SERVERNAME AS nvarchar(128)) <> N'DANIELPC'
   OR DB_NAME() <> N'NexoSalud_LeadEnsayoFinal'
    THROW 54800, 'Destino incorrecto: QA Buyer requiere DANIELPC / NexoSalud_LeadEnsayoFinal.', 1;

DECLARE @prefijo nvarchar(80) = N'QA_BBE_20261112T195045Z_';
SELECT @@SERVERNAME servidor, DB_NAME() base, SYSUTCDATETIME() utc;
SELECT p.id_persona,p.nombres,p.email,e.nombre etapa
FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY p.id_persona;
SELECT c.* FROM dbo.CaptacionesBuyer c JOIN dbo.Personas p ON p.id_persona=c.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY c.id_captacion;
SELECT i.* FROM dbo.Interacciones i JOIN dbo.Personas p ON p.id_persona=i.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY i.id_interaccion;
SELECT d.* FROM dbo.DecisionesIA d JOIN dbo.Personas p ON p.id_persona=d.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY d.id_decision;
SELECT s.* FROM dbo.Solicitudes s JOIN dbo.Personas p ON p.id_persona=s.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY s.id_solicitud;
SELECT e.* FROM dbo.EventosEtapa e JOIN dbo.Personas p ON p.id_persona=e.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY e.id_evento_etapa;
SELECT a.* FROM dbo.EntradasAgenteLead a JOIN dbo.Personas p ON p.id_persona=a.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY a.id_solicitud;
