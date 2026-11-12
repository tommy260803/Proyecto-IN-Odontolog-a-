-- Exclusivo QA, solo lectura. No USE/GO/DML/DDL/limpieza ni recuperacion.
SET NOCOUNT ON;
IF CAST(@@SERVERNAME AS nvarchar(128)) <> N'DANIELPC' OR DB_NAME() <> N'NexoSalud_LeadEnsayoFinal'
    THROW 54810, 'Destino incorrecto: requiere DANIELPC / NexoSalud_LeadEnsayoFinal.', 1;
DECLARE @prefijo nvarchar(80)=N'QA_BFC_20261112T200939Z_';
SELECT @@SERVERNAME servidor,DB_NAME() base,SYSUTCDATETIME() utc;
SELECT p.id_persona,p.nombres,p.email,e.nombre etapa
FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY p.id_persona;
SELECT c.* FROM dbo.CaptacionesBuyer c JOIN dbo.Personas p ON p.id_persona=c.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY c.id_captacion;
SELECT i.* FROM dbo.Interacciones i JOIN dbo.Personas p ON p.id_persona=i.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY i.id_interaccion;
SELECT d.*,JSON_VALUE(d.entrada,'$.idempotencyKey') idempotency_key,
JSON_VALUE(d.entrada,'$.contentHash') content_hash FROM dbo.DecisionesIA d
JOIN dbo.Personas p ON p.id_persona=d.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY d.id_decision;
SELECT s.* FROM dbo.Solicitudes s JOIN dbo.Personas p ON p.id_persona=s.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY s.id_solicitud;
SELECT e.* FROM dbo.EventosEtapa e JOIN dbo.Personas p ON p.id_persona=e.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY e.id_evento_etapa;
SELECT a.* FROM dbo.EntradasAgenteLead a JOIN dbo.Personas p ON p.id_persona=a.id_persona
WHERE LEFT(p.nombres,LEN(@prefijo))=@prefijo ORDER BY a.id_solicitud;
-- Columnas e indices efectivos relevantes para la identidad/idempotencia; sin datos historicos.
SELECT OBJECT_NAME(c.object_id) tabla,c.name columna,ty.name tipo,c.max_length,c.is_computed
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id IN(OBJECT_ID('dbo.DecisionesIA'),OBJECT_ID('dbo.Interacciones'))
ORDER BY tabla,c.column_id;
SELECT OBJECT_NAME(i.object_id) tabla,i.name indice,i.is_unique,i.is_primary_key,i.has_filter,i.filter_definition,
STRING_AGG(CONVERT(nvarchar(max),QUOTENAME(c.name)),',') WITHIN GROUP(ORDER BY ic.key_ordinal) columnas_clave
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE i.object_id IN(OBJECT_ID('dbo.DecisionesIA'),OBJECT_ID('dbo.Interacciones'),OBJECT_ID('dbo.EventosEtapa'),OBJECT_ID('dbo.EntradasAgenteLead'))
AND ic.key_ordinal>0
GROUP BY i.object_id,i.name,i.is_unique,i.is_primary_key,i.has_filter,i.filter_definition
ORDER BY tabla,indice;
