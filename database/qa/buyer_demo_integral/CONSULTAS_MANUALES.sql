-- Solo lectura. Ejecutar sobre la conexión QA indicada, después de cada hito manual.
-- Sin GO: la guarda protege todas las consultas del lote.
IF UPPER(CONVERT(nvarchar(128),@@SERVERNAME))<>N'DANIELPC'
 OR DB_NAME()<>N'NexoSalud_LeadEnsayoFinal'
 THROW 54901,'Destino QA incorrecto; no continuar.',1;

SELECT @@SERVERNAME servidor,DB_NAME() base,SYSUTCDATETIME() hora_utc;
DECLARE @prefijo nvarchar(100)=N'QA_DEMO_UI_20261113';
SELECT p.id_persona,p.nombres,p.apellidos,e.nombre etapa,p.autoriza_contacto,
 (SELECT COUNT(*) FROM dbo.CaptacionesBuyer c WHERE c.id_persona=p.id_persona) captaciones,
 (SELECT COUNT(*) FROM dbo.Interacciones i WHERE i.id_persona=p.id_persona) interacciones,
 (SELECT COUNT(*) FROM dbo.Solicitudes s WHERE s.id_persona=p.id_persona) solicitudes,
 (SELECT COUNT(*) FROM dbo.EventosEtapa ev WHERE ev.id_persona=p.id_persona) eventos,
 (SELECT COUNT(*) FROM dbo.EntradasAgenteLead en WHERE en.id_persona=p.id_persona) entradas
FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual
WHERE p.nombres LIKE @prefijo+N'%' ORDER BY p.id_persona;

SELECT c.id_captacion,c.id_persona,c.id_servicio,c.fecha_captacion
FROM dbo.CaptacionesBuyer c JOIN dbo.Personas p ON p.id_persona=c.id_persona
WHERE p.nombres LIKE @prefijo+N'%';
SELECT i.id_interaccion,i.id_persona,i.id_usuario,i.tipo,i.mensaje,i.id_solicitud,i.fecha_hora
FROM dbo.Interacciones i JOIN dbo.Personas p ON p.id_persona=i.id_persona
WHERE p.nombres LIKE @prefijo+N'%' ORDER BY i.id_interaccion;
SELECT d.id_decision,d.id_persona,d.id_interaccion,d.agente,d.accion,d.entrada
FROM dbo.DecisionesIA d JOIN dbo.Personas p ON p.id_persona=d.id_persona
WHERE p.nombres LIKE @prefijo+N'%' ORDER BY d.id_decision;
SELECT s.id_persona,s.id_solicitud,s.id_servicio,s.estado,s.fecha_ingreso_lead,
 ev.id_evento_etapa,ev.id_captacion,ev.etapa_origen,ev.etapa_destino,
 en.id_solicitud solicitud_recibida,en.id_evento_etapa evento_recibido
FROM dbo.Solicitudes s JOIN dbo.Personas p ON p.id_persona=s.id_persona
LEFT JOIN dbo.EventosEtapa ev ON ev.id_solicitud=s.id_solicitud AND ev.id_persona=s.id_persona
LEFT JOIN dbo.EntradasAgenteLead en ON en.id_solicitud=s.id_solicitud AND en.id_persona=s.id_persona
WHERE p.nombres LIKE @prefijo+N'%' ORDER BY s.id_solicitud;
