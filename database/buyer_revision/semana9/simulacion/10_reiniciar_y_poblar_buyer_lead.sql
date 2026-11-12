-- Ejecutar en NexoSaludDB. Crear un respaldo antes de cambiar @Aplicar a 1.
-- 0 valida la carga y revierte los cambios. 1 reemplaza los datos operativos.
-- Conserva la estructura, los catálogos, los usuarios y la disponibilidad.
USE [NexoSaludDB];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 15000;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

DECLARE @Aplicar bit = 0;
DECLARE @Buyer int = (SELECT id_etapa FROM dbo.Etapas WHERE nombre = 'BUYER');
DECLARE @Lead int = (SELECT id_etapa FROM dbo.Etapas WHERE nombre = 'LEAD');
DECLARE @Ahora datetime2 = SYSDATETIME();
DECLARE @Hoy datetime2 = CONVERT(date, @Ahora);

IF @Buyer IS NULL OR @Lead IS NULL
    THROW 51000, 'Faltan las etapas BUYER y LEAD.', 1;

DECLARE @Nombres table (id int IDENTITY PRIMARY KEY, nombre nvarchar(50));
INSERT @Nombres (nombre) VALUES
    (N'Andrea'), (N'Valeria'), (N'Camila'), (N'Daniela'), (N'Mariana'),
    (N'Lucía'), (N'Natalia'), (N'Gabriela'), (N'Fernanda'), (N'Claudia'),
    (N'Rocío'), (N'Elena'), (N'Adriana'), (N'Patricia'), (N'Rosa'),
    (N'Diana'), (N'Fiorella'), (N'Isabel'), (N'Milagros'), (N'Carolina'),
    (N'Diego'), (N'Luis Alberto'), (N'José Miguel'), (N'Mateo'), (N'Javier'),
    (N'Carlos Eduardo'), (N'Andrés'), (N'Gabriel'), (N'Miguel Ángel'), (N'Renato'),
    (N'Fernando'), (N'Jorge'), (N'Sergio'), (N'Manuel'), (N'Alonso'),
    (N'Ricardo'), (N'Víctor'), (N'Christian'), (N'Joaquín'), (N'Pedro');

DECLARE @Apellidos table (id int IDENTITY PRIMARY KEY, apellido nvarchar(25));
INSERT @Apellidos (apellido) VALUES
    (N'Vigo'), (N'Chávez'), (N'Quispe'), (N'Torres'), (N'Salazar'),
    (N'Castañeda'), (N'Rojas'), (N'Gutiérrez'), (N'Reyes'), (N'Vargas'),
    (N'Huamán'), (N'Aguilar'), (N'Cueva'), (N'Díaz'), (N'Villanueva'),
    (N'Rodríguez'), (N'Campos'), (N'Vera'), (N'Ramírez'), (N'Cruz'),
    (N'Flores'), (N'Mendoza'), (N'Paredes'), (N'García'), (N'Espinoza');

DECLARE @Zonas table (id int PRIMARY KEY, zona nvarchar(100), id_sede int);
INSERT @Zonas VALUES
    (1, N'Centro Histórico', 1), (2, N'El Recreo', 1), (3, N'La Esperanza', 1),
    (4, N'California', 2), (5, N'Huanchaco', 2), (6, N'Víctor Larco Herrera', 2),
    (7, N'El Golf', 3), (8, N'San Andrés', 1);

DECLARE @Motivos table (id_servicio int PRIMARY KEY, motivo nvarchar(200));
INSERT @Motivos VALUES
    (1, N'Solicitó una evaluación general para conocer sus opciones de atención.'),
    (2, N'Pidió información para programar una limpieza dental.'),
    (3, N'Desea consultar si puede iniciar un tratamiento de ortodoncia.'),
    (4, N'Pidió una evaluación para reponer una pieza dental.'),
    (5, N'Desea conocer las opciones para una restauración estética.'),
    (6, N'Consultó por un tratamiento de blanqueamiento dental.');

DECLARE @Canales table (id int PRIMARY KEY, id_canal int, id_fuente int);
INSERT @Canales VALUES (1, 1, 2), (2, 2, 1), (3, 3, 1), (4, 4, 2), (5, 5, 2), (6, 6, 2);

IF EXISTS (SELECT 1 FROM @Zonas z LEFT JOIN dbo.Sedes s ON s.id_sede = z.id_sede WHERE s.id_sede IS NULL)
    OR EXISTS (SELECT 1 FROM @Motivos m LEFT JOIN dbo.Servicios s ON s.id_servicio = m.id_servicio
               WHERE s.id_servicio IS NULL OR s.activo <> 1)
    OR EXISTS (SELECT 1 FROM @Canales o LEFT JOIN dbo.Canales c ON c.id_canal = o.id_canal
               LEFT JOIN dbo.Fuentes f ON f.id_fuente = o.id_fuente
               WHERE c.id_canal IS NULL OR f.id_fuente IS NULL)
    THROW 51001, 'Faltan sedes, servicios activos, canales o fuentes del catálogo local.', 1;

DECLARE @PersonasCarga table (
    nombres nvarchar(50), apellidos nvarchar(50), email varchar(100) PRIMARY KEY,
    nacimiento date, zona nvarchar(100), tipo varchar(30), autorizacion bit,
    calidad varchar(20), fecha_registro datetime2, fecha_conversion datetime2 NULL,
    id_canal int, id_fuente int, id_sede int, id_servicio int, motivo nvarchar(200)
);

;WITH Combinaciones AS (
    SELECT n.nombre, a.apellido, a.id AS id_apellido,
        CONVERT(int, ROW_NUMBER() OVER (ORDER BY a.id, n.id)) AS numero
    FROM @Nombres n CROSS JOIN @Apellidos a
)
INSERT @PersonasCarga
SELECT c.nombre, CONCAT(c.apellido, ' ', segundo.apellido),
    CONCAT('registro.', c.numero, '@nexosalud.invalid'),
    DATEADD(day, -((c.numero * 53) % 365), DATEFROMPARTS(YEAR(@Hoy) - (18 + (c.numero * 13) % 57), 12, 31)),
    z.zona,
    CASE WHEN (c.numero * 13) % 57 >= 47 THEN 'Adulto Mayor' ELSE 'Adulto General' END,
    CASE WHEN decision.convierte = 1 OR c.numero % 9 <> 0 THEN 1 ELSE 0 END,
    CASE WHEN decision.convierte = 0 AND c.numero % 11 = 0 THEN 'Incompleto' ELSE 'Valido' END,
    registro.fecha,
    CASE WHEN decision.convierte = 1
         THEN DATEADD(hour, 1 + (c.numero * 5) % 36, registro.fecha) END,
    o.id_canal, o.id_fuente, z.id_sede, m.id_servicio, m.motivo
FROM Combinaciones c
JOIN @Apellidos segundo ON segundo.id = 1 + (c.id_apellido - 1 + 1 + c.numero % 24) % 25
JOIN @Zonas z ON z.id = 1 + (c.numero * 3) % 8
JOIN @Canales o ON o.id = 1 + ((c.numero * 5) / 11) % 6
JOIN @Motivos m ON m.id_servicio = 1 + ((c.numero * 7) / 13) % 6
CROSS APPLY (VALUES (CASE WHEN (c.numero * 37) % 100 < 35 THEN 1 ELSE 0 END)) decision(convierte)
CROSS APPLY (VALUES (DATEADD(minute, 480 + (c.numero * 23) % 600,
    DATEADD(day, -(2 + (c.numero * 17) % 28), @Hoy)))) registro(fecha);

BEGIN TRY
    BEGIN TRANSACTION;

    DELETE FROM dbo.ConfirmacionesWhatsAppLead;
    DELETE FROM dbo.MensajesWhatsAppLead;
    DELETE FROM dbo.AnalisisInteraccionesLead;
    DELETE FROM dbo.TraspasosPayerLead;
    DELETE FROM dbo.AccesosPreReservaLead;
    DELETE FROM dbo.Incidencias;
    DELETE FROM dbo.Seguimientos;
    DELETE FROM dbo.Atenciones;
    DELETE FROM dbo.Pagos;
    DELETE FROM dbo.Reservas;
    DELETE FROM dbo.CambiosOpcionLead;
    DELETE FROM dbo.Opciones;
    DELETE FROM dbo.HistorialSeguimientoOperativoLead;
    DELETE FROM dbo.SeguimientoOperativoLead;
    DELETE FROM dbo.DecisionesIA;
    DELETE FROM dbo.Interacciones;
    DELETE FROM dbo.EventosEtapa;

    -- Romper el vínculo circular con la propuesta aceptada antes de borrar ambas tablas.
    UPDATE dbo.Solicitudes
    SET id_propuesta_aceptada_lead = NULL, resultado_comercial_lead = NULL,
        fecha_decision_comercial_lead = NULL, valor_acordado_lead = NULL
    WHERE id_propuesta_aceptada_lead IS NOT NULL;

    DELETE FROM dbo.PropuestasEconomicasLead;
    DELETE FROM dbo.Solicitudes;
    DELETE FROM dbo.CaptacionesBuyer;
    DELETE FROM dbo.DatosAcademicos;
    DELETE FROM dbo.DatosLaborales;
    DELETE FROM dbo.PersonaPreferencias;
    DELETE FROM dbo.PersonaSaludOdontologica;
    DELETE FROM dbo.Personas;
    DELETE FROM dbo.GastosCampana;

    -- Limpiar las auditorías antiguas después de los disparadores de borrado.
    DELETE FROM dbo.HistorialOpcionesLead;
    DELETE FROM dbo.HistorialPropuestasLead;
    DELETE FROM dbo.HistorialVigenciaPropuestasLead;
    DELETE FROM dbo.HistorialSolicitudesLead;

    INSERT dbo.Personas (nombres, apellidos, email, fecha_nacimiento, zona, tipo_persona,
        autoriza_contacto, fecha_autorizacion, estado_calidad, id_canal_origen, id_etapa_actual, fecha_registro)
    SELECT nombres, apellidos, email, nacimiento, zona, tipo, autorizacion,
        CASE WHEN autorizacion = 1 THEN fecha_registro END, calidad, id_canal, @Buyer, fecha_registro
    FROM @PersonasCarga;

    INSERT dbo.CaptacionesBuyer (id_persona, fecha_captacion, id_canal, id_fuente, id_sede, id_servicio,
        motivo_consulta, estado_calidad, autoriza_contacto, fecha_autorizacion, origen_datos)
    SELECT p.id_persona, d.fecha_registro, d.id_canal, d.id_fuente, d.id_sede, d.id_servicio,
        d.motivo, d.calidad, d.autorizacion, p.fecha_autorizacion, 'REGISTRO_DIRECTO'
    FROM @PersonasCarga d JOIN dbo.Personas p ON p.email = d.email;

    INSERT dbo.EventosEtapa (id_persona, etapa_origen, etapa_destino, fecha_hora, motivo, id_captacion)
    SELECT id_persona, NULL, @Buyer, fecha_captacion, 'Registro de captación', id_captacion
    FROM dbo.CaptacionesBuyer;

    INSERT dbo.Solicitudes (id_persona, id_servicio, fecha_solicitud, motivo, estado,
        id_canal_origen, id_fuente_origen, fecha_ingreso_lead, id_sede_interes_lead, resultado_comercial_lead)
    SELECT p.id_persona, d.id_servicio, d.fecha_conversion, d.motivo, 'Abierta',
        d.id_canal, d.id_fuente, d.fecha_conversion, d.id_sede, 'PENDIENTE'
    FROM @PersonasCarga d JOIN dbo.Personas p ON p.email = d.email
    WHERE d.fecha_conversion IS NOT NULL;

    INSERT dbo.EventosEtapa (id_persona, etapa_origen, etapa_destino, fecha_hora, motivo, evidencia,
        id_captacion, id_solicitud, clave_operacion_buyer)
    SELECT s.id_persona, @Buyer, @Lead, s.fecha_ingreso_lead, s.motivo,
        'Conversión de datos sintéticos', c.id_captacion, s.id_solicitud, CONCAT('BUYER_LEAD:', c.id_captacion)
    FROM dbo.Solicitudes s JOIN dbo.CaptacionesBuyer c ON c.id_persona = s.id_persona;

    UPDATE p SET id_etapa_actual = @Lead, fecha_actualizacion = s.fecha_ingreso_lead
    FROM dbo.Personas p JOIN dbo.Solicitudes s ON s.id_persona = p.id_persona;

    IF (SELECT COUNT(*) FROM dbo.Personas) <> 1000
        OR (SELECT COUNT(*) FROM dbo.CaptacionesBuyer) <> 1000
        OR (SELECT COUNT(*) FROM dbo.Personas WHERE id_etapa_actual = @Buyer) <> 650
        OR (SELECT COUNT(*) FROM dbo.Personas WHERE id_etapa_actual = @Lead) <> 350
        OR (SELECT COUNT(*) FROM dbo.EventosEtapa) <> 1350
        OR (SELECT COUNT(DISTINCT id_persona) FROM dbo.EventosEtapa WHERE etapa_origen IS NULL AND etapa_destino = @Buyer) <> 1000
        OR (SELECT COUNT(DISTINCT id_persona) FROM dbo.EventosEtapa WHERE etapa_origen = @Buyer AND etapa_destino = @Lead) <> 350
        OR (SELECT COUNT(*) FROM dbo.v_DatosCaptacionBuyer
            WHERE contacto_utilizable = 1 AND fecha_conversion BETWEEN fecha_captacion AND @Ahora) <> 350
        OR (SELECT COUNT(*) FROM dbo.Solicitudes) <> 350
        OR (SELECT COUNT(*) FROM dbo.fn_Lead_Oportunidades_Corte(SYSUTCDATETIME())
            WHERE resultado_comercial_lead = 'PENDIENTE') <> 350
        THROW 51002, 'Los conteos de captación o conversión no cuadran.', 1;

    IF EXISTS (SELECT 1 FROM dbo.PropuestasEconomicasLead)
        OR EXISTS (SELECT 1 FROM dbo.Opciones)
        OR EXISTS (SELECT 1 FROM dbo.Interacciones)
        OR EXISTS (SELECT 1 FROM dbo.MensajesWhatsAppLead)
        OR EXISTS (SELECT 1 FROM dbo.Reservas)
        OR EXISTS (SELECT 1 FROM dbo.Pagos)
        OR EXISTS (SELECT 1 FROM dbo.Atenciones)
        THROW 51003, 'Quedaron registros fuera del alcance de la carga.', 1;

    SELECT e.nombre AS etapa_actual, COUNT(*) AS personas
    FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa = p.id_etapa_actual
    GROUP BY e.nombre;

    SELECT (SELECT COUNT(*) FROM dbo.CaptacionesBuyer) AS captaciones,
        (SELECT COUNT(*) FROM dbo.EventosEtapa WHERE etapa_origen = @Buyer AND etapa_destino = @Lead) AS conversiones,
        (SELECT COUNT(*) FROM dbo.Solicitudes) AS oportunidades_pendientes,
        (SELECT COUNT(*) FROM dbo.PropuestasEconomicasLead) AS propuestas,
        (SELECT COUNT(*) FROM dbo.Opciones) AS alternativas,
        (SELECT COUNT(*) FROM dbo.Interacciones) AS interacciones;

    IF @Aplicar = 1
    BEGIN
        COMMIT TRANSACTION;
        PRINT 'Carga guardada en NexoSaludDB.';
    END
    ELSE
    BEGIN
        ROLLBACK TRANSACTION;
        PRINT 'Prueba completada. Cambios revertidos.';
    END;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
