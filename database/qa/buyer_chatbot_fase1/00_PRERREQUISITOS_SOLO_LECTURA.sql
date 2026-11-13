-- Preparado para la siguiente fase. NO ejecutado durante el desarrollo de fase 1.
-- Sin DDL/DML: no es una migración ni registra instalación de módulos.
SET NOCOUNT ON;
IF CAST(@@SERVERNAME AS nvarchar(128)) <> N'DANIELPC' OR DB_NAME() <> N'NexoSalud_LeadEnsayoFinal'
    THROW 51101, 'Destino QA incorrecto. Se requiere DANIELPC / NexoSalud_LeadEnsayoFinal.', 1;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.DecisionesIA') AND name=N'entrada' AND max_length=-1)
    THROW 51102, 'Falta DecisionesIA.entrada MAX. No aplicar cambios implícitos.', 1;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Interacciones') AND name=N'mensaje' AND max_length=-1)
    THROW 51103, 'Falta Interacciones.mensaje MAX.', 1;
IF OBJECT_ID(N'dbo.usp_ConvertirBuyerALead',N'P') IS NULL OR OBJECT_ID(N'dbo.usp_RegistrarEntradaAgenteLead',N'P') IS NULL
    THROW 51104, 'Faltan los procedimientos originales de conversión/recepción.', 1;
SELECT @@SERVERNAME servidor, DB_NAME() base, N'Solo prerrequisitos; no valida el flujo SQL ni la concurrencia' alcance;
SELECT OBJECT_NAME(c.object_id) tabla,c.name columna,t.name tipo,c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id IN (OBJECT_ID(N'dbo.DecisionesIA'),OBJECT_ID(N'dbo.Interacciones'))
ORDER BY tabla,c.column_id;
SELECT OBJECT_NAME(parent_object_id) tabla,name,definition
FROM sys.check_constraints WHERE parent_object_id IN (OBJECT_ID(N'dbo.DecisionesIA'),OBJECT_ID(N'dbo.Interacciones'));
