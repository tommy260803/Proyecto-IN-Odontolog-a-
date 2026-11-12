-- Solo lectura de datos de aplicacion. Ejecutar despues de 05 y 06.
:ON ERROR EXIT
USE [NexoSalud_InstalacionValidacion];
GO
SET NOCOUNT ON;
IF DB_NAME()<>'NexoSalud_InstalacionValidacion' THROW 55330,'Destino incorrecto.',1;
IF (SELECT COUNT(*) FROM dbo.Personas)<>500 OR (SELECT COUNT(*) FROM dbo.CaptacionesBuyer)<>500
 OR (SELECT COUNT(*) FROM dbo.Solicitudes)<>403 OR (SELECT COUNT(*) FROM dbo.EventosEtapa)<>403
 OR (SELECT COUNT(*) FROM dbo.PropuestasEconomicasLead WHERE id_propuesta_raiz IS NULL)<>400
 OR (SELECT COUNT(*) FROM dbo.PropuestasEconomicasLead WHERE id_propuesta_raiz IS NOT NULL)<>80
 OR (SELECT COUNT(*) FROM dbo.Opciones)<>400 OR (SELECT COUNT(*) FROM dbo.PersonaPreferencias)<>400
 OR (SELECT COUNT(*) FROM dbo.CambiosOpcionLead)<>40 OR (SELECT COUNT(*) FROM dbo.Interacciones)<>900
 THROW 55331,'Conteos de cohorte inesperados.',1;
IF EXISTS(SELECT 1 FROM dbo.CaptacionesBuyer c JOIN dbo.Personas p ON p.id_persona=c.id_persona
 WHERE c.motivo_consulta=N'No autorizo que me contacten' AND (c.autoriza_contacto<>0 OR p.autoriza_contacto<>0))
 OR EXISTS(SELECT 1 FROM dbo.CaptacionesBuyer WHERE motivo_consulta=N'Aun no se que tratamiento necesito' AND id_servicio IS NOT NULL)
 THROW 55332,'Texto y datos estructurados contradictorios.',1;
IF EXISTS(SELECT 1 FROM dbo.EventosEtapa e JOIN dbo.Solicitudes s ON s.id_solicitud=e.id_solicitud
 JOIN dbo.CaptacionesBuyer c ON c.id_captacion=e.id_captacion
 WHERE s.id_persona<>e.id_persona OR c.id_persona<>e.id_persona OR c.autoriza_contacto<>1 OR c.id_servicio<>s.id_servicio)
 OR EXISTS(SELECT id_captacion FROM dbo.EventosEtapa GROUP BY id_captacion HAVING COUNT(*)<>1)
 THROW 55333,'Conversion inconsistente o duplicada.',1;
IF EXISTS(SELECT 1 FROM dbo.Opciones o JOIN dbo.Solicitudes s ON s.id_solicitud=o.id_solicitud
 JOIN dbo.Disponibilidad d ON d.id_disponibilidad=o.id_disponibilidad
 LEFT JOIN dbo.ProfesionalServicio ps ON ps.id_profesional=d.id_profesional AND ps.id_servicio=s.id_servicio
 JOIN dbo.PropuestasEconomicasLead p ON p.id_propuesta=o.id_propuesta_lead
 JOIN dbo.PersonaPreferencias pp ON pp.id_preferencia=o.id_preferencia_lead
 WHERE ps.id_servicio IS NULL OR p.id_solicitud<>o.id_solicitud OR pp.id_persona<>s.id_persona OR p.precio_cotizado<>o.precio_ofrecido)
 THROW 55334,'Alternativa incompatible con propuesta, servicio o persona.',1;
IF EXISTS(SELECT 1 FROM dbo.Disponibilidad a JOIN dbo.Disponibilidad b ON a.id_profesional=b.id_profesional
 AND a.fecha=b.fecha AND a.id_disponibilidad<b.id_disponibilidad AND a.hora_inicio<b.hora_fin AND b.hora_inicio<a.hora_fin)
 THROW 55335,'Agenda superpuesta.',1;
IF EXISTS(SELECT 1 FROM dbo.Reservas) OR EXISTS(SELECT 1 FROM dbo.Pagos) OR EXISTS(SELECT 1 FROM dbo.Atenciones)
 OR EXISTS(SELECT 1 FROM dbo.Seguimientos) OR EXISTS(SELECT 1 FROM dbo.TraspasosPayerLead)
 THROW 55336,'Datos fuera del alcance.',1;
DECLARE @inicio date=DATEFROMPARTS(YEAR(SYSDATETIME()),MONTH(SYSDATETIME()),1),@fin date=DATEADD(month,1,DATEFROMPARTS(YEAR(SYSDATETIME()),MONTH(SYSDATETIME()),1));
EXEC dbo.usp_Lead_ReporteR1 @inicio,@fin;
EXEC dbo.usp_Lead_ReporteR2 @inicio,@fin,@seccion='resumen';
EXEC dbo.usp_Lead_ReporteR3 @inicio,@fin,@seccion='resumen';
DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;
SELECT 'OK' resultado,'500 personas; coherencia de captacion, conversion, propuestas, preferencias y agenda' comprobacion;
