-- QA_RESULT: destino
SELECT @@SERVERNAME servidor,DB_NAME() base,SYSUTCDATETIME() utc;
-- QA_RESULT: sujetos
SELECT p.id_persona,e.nombre etapa,
 (SELECT COUNT(*) FROM dbo.CaptacionesBuyer c WHERE c.id_persona=p.id_persona) captaciones,
 (SELECT COUNT(*) FROM dbo.Interacciones i WHERE i.id_persona=p.id_persona) interacciones,
 (SELECT COUNT(*) FROM dbo.Solicitudes s WHERE s.id_persona=p.id_persona) solicitudes,
 (SELECT COUNT(*) FROM dbo.EventosEtapa v WHERE v.id_persona=p.id_persona) eventos,
 (SELECT COUNT(*) FROM dbo.EntradasAgenteLead l WHERE l.id_persona=p.id_persona) entradas
FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual
WHERE p.id_persona IN(11000,11007,11011,11012) AND p.nombres LIKE 'QA[_]%' ORDER BY p.id_persona;
-- QA_RESULT: turnos
SELECT d.id_decision turnId,d.id_persona,d.id_interaccion,
 JSON_VALUE(d.entrada,'$.conversationId') conversationId,
 JSON_VALUE(d.entrada,'$.status') estado,
 JSON_VALUE(d.entrada,'$.evaluation.accion') accion,
 JSON_VALUE(d.entrada,'$.evaluation.entregaLeadEstado') entrega,
 JSON_VALUE(d.entrada,'$.evaluation.intentosRealizados') intentos_clasificacion,
 (SELECT COUNT(*) FROM OPENJSON(d.entrada,'$.attempts')) intentos_chat,
 (SELECT COUNT(*) FROM OPENJSON(d.entrada,'$.messages') WITH(role varchar(30) '$.role') WHERE role='asistente') respuestas_asistente
FROM dbo.DecisionesIA d WHERE d.id_persona IN(11000,11007,11011,11012)
 AND d.agente='BUYER_CHAT' AND JSON_VALUE(d.entrada,'$.kind')='turn' ORDER BY d.id_decision;
-- QA_RESULT: vinculos
SELECT i.id_persona,i.id_interaccion,i.id_solicitud,s.id_servicio,e.id_evento_etapa,e.id_captacion,
 l.id_solicitud recepcion_solicitud,l.id_evento_etapa recepcion_evento
FROM dbo.Interacciones i JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud AND s.id_persona=i.id_persona
JOIN dbo.EventosEtapa e ON e.id_solicitud=s.id_solicitud AND e.id_persona=i.id_persona
LEFT JOIN dbo.EntradasAgenteLead l ON l.id_solicitud=s.id_solicitud
WHERE i.id_persona IN(11000,11011) AND i.tipo='BUYER_CHAT_ENTRADA' ORDER BY i.id_interaccion;
-- QA_RESULT: personal_sin_credenciales
SELECT u.id_usuario,u.activo,r.nombre rol FROM dbo.Usuarios u JOIN dbo.Roles r ON r.id_rol=u.id_rol ORDER BY u.id_usuario;
