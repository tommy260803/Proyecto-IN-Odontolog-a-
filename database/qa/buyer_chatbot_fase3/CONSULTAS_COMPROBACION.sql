-- Lectura manual antes/después. No ejecuta procedimientos ni cambia datos.
SET NOCOUNT ON;
IF CAST(@@SERVERNAME AS nvarchar(128)) <> N'DANIELPC' OR DB_NAME() <> N'NexoSalud_LeadEnsayoFinal'
    THROW 51101, 'Destino QA incorrecto.', 1;
SELECT @@SERVERNAME servidor,DB_NAME() base,SYSUTCDATETIME() utc;

-- IDs sintéticos preexistentes verificados; añadir otro ID solo tras identificarlo.
SELECT p.id_persona,e.nombre etapa,p.autoriza_contacto,p.estado_calidad
FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual
WHERE p.id_persona IN(11000,11001,11002,11007) AND p.nombres LIKE 'QA[_]%';

SELECT p.id_persona,
 (SELECT COUNT(*) FROM dbo.Interacciones i WHERE i.id_persona=p.id_persona) interacciones,
 (SELECT COUNT(*) FROM dbo.DecisionesIA d WHERE d.id_persona=p.id_persona AND d.agente='BUYER_CHAT') decisiones_chat,
 (SELECT COUNT(*) FROM dbo.Solicitudes s WHERE s.id_persona=p.id_persona) solicitudes,
 (SELECT COUNT(*) FROM dbo.EventosEtapa e WHERE e.id_persona=p.id_persona) eventos,
 (SELECT COUNT(*) FROM dbo.EntradasAgenteLead l WHERE l.id_persona=p.id_persona) entradas
FROM dbo.Personas p WHERE p.id_persona IN(11000,11001,11002,11007) AND p.nombres LIKE 'QA[_]%';

SELECT d.id_decision,d.id_persona,d.id_interaccion,d.id_captacion,d.agente,d.accion,
 JSON_VALUE(d.entrada,'$.conversationId') conversationId,JSON_VALUE(d.entrada,'$.status') estado_chat,
 JSON_VALUE(d.entrada,'$.evaluation.id_solicitud') solicitud_chat,
 JSON_VALUE(d.entrada,'$.evaluation.id_evento_etapa') evento_chat
FROM dbo.DecisionesIA d JOIN dbo.Personas p ON p.id_persona=d.id_persona
WHERE p.id_persona IN(11000,11001,11002,11007) AND p.nombres LIKE 'QA[_]%' AND d.agente='BUYER_CHAT'
ORDER BY d.id_decision;

SELECT i.id_interaccion,i.id_persona,i.id_solicitud,i.tipo,e.id_evento_etapa,e.id_captacion,
 s.id_servicio,eo.nombre etapa_origen,ed.nombre etapa_destino,l.id_solicitud recepcion_solicitud
FROM dbo.Interacciones i JOIN dbo.Personas p ON p.id_persona=i.id_persona
LEFT JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud AND s.id_persona=i.id_persona
LEFT JOIN dbo.EventosEtapa e ON e.id_solicitud=s.id_solicitud AND e.id_persona=i.id_persona
LEFT JOIN dbo.Etapas eo ON eo.id_etapa=e.etapa_origen LEFT JOIN dbo.Etapas ed ON ed.id_etapa=e.etapa_destino
LEFT JOIN dbo.EntradasAgenteLead l ON l.id_solicitud=s.id_solicitud
WHERE p.id_persona IN(11000,11001,11002,11007) AND p.nombres LIKE 'QA[_]%'
ORDER BY i.id_interaccion,e.id_evento_etapa;

-- No exportar sesión Bearer, contraseña, hash ni datos personales del operador.
