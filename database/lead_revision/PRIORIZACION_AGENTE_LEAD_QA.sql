:ON ERROR EXIT
IF DB_NAME() <> N'NexoSalud_LeadPruebas'
    THROW 54720, 'Instalacion permitida solo en NexoSalud_LeadPruebas.', 1;
IF OBJECT_ID(N'dbo.TrabajosAgenteLead', N'U') IS NULL
    THROW 54721, 'Instale primero COLA_AGENTE_LEAD_QA.sql.', 1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO

IF OBJECT_ID(N'dbo.PriorizacionesAgenteLead', N'U') IS NULL
CREATE TABLE dbo.PriorizacionesAgenteLead (
    id_solicitud INT NOT NULL PRIMARY KEY REFERENCES dbo.TrabajosAgenteLead(id_solicitud),
    intento INT NOT NULL,
    prioridad TINYINT NULL,
    motivo VARCHAR(32) NOT NULL,
    siguiente_accion VARCHAR(32) NOT NULL,
    evaluada_utc DATETIME2(7) NOT NULL
);
GO

CREATE OR ALTER PROCEDURE dbo.usp_PriorizarTrabajoAgenteLead
    @id_solicitud INT,
    @token UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF DB_NAME() <> N'NexoSalud_LeadPruebas' OR @@TRANCOUNT <> 0
        THROW 54722, 'Se requiere una sesion independiente en QA.', 1;

    BEGIN TRANSACTION;
    DECLARE @intento INT, @vence DATETIME2(7);
    SELECT @intento = intentos, @vence = vence_utc
    FROM dbo.TrabajosAgenteLead WITH (UPDLOCK, HOLDLOCK)
    WHERE id_solicitud = @id_solicitud AND estado = 'EN_CURSO' AND token = @token;

    DECLARE @ahora DATETIME2(7) = SYSUTCDATETIME();
    IF @intento IS NULL OR @vence <= @ahora
    BEGIN
        COMMIT;
        RETURN;
    END;

    DECLARE @motivo VARCHAR(32), @accion VARCHAR(32), @prioridad TINYINT;
    SELECT @motivo = CASE
        WHEN etapa.nombre IS NULL OR etapa.nombre <> 'LEAD' OR s.archivada_lead_en IS NOT NULL
          OR s.resultado_comercial_lead IN ('ACEPTADA', 'CERRADA_SIN_ACUERDO') THEN 'OPORTUNIDAD_INACTIVA'
        WHEN s.fecha_proximo_seguimiento < @ahora THEN 'SEGUIMIENTO_VENCIDO'
        WHEN CONVERT(date, DATEADD(hour, -5, s.fecha_proximo_seguimiento))
          = CONVERT(date, DATEADD(hour, -5, @ahora)) THEN 'SEGUIMIENTO_HOY'
        WHEN s.fecha_primera_respuesta IS NULL THEN 'SIN_PRIMERA_RESPUESTA'
        ELSE 'SIN_ACCION_INMEDIATA' END
    FROM dbo.EntradasAgenteLead e
    JOIN dbo.Solicitudes s WITH (HOLDLOCK) ON s.id_solicitud = e.id_solicitud AND s.id_persona = e.id_persona
    JOIN dbo.Personas p WITH (HOLDLOCK) ON p.id_persona = e.id_persona
    LEFT JOIN dbo.Etapas etapa ON etapa.id_etapa = p.id_etapa_actual
    WHERE e.id_solicitud = @id_solicitud;

    SELECT @motivo = COALESCE(@motivo, 'VINCULO_INCONSISTENTE');
    SELECT @prioridad = CASE @motivo WHEN 'SEGUIMIENTO_VENCIDO' THEN 1 WHEN 'SEGUIMIENTO_HOY' THEN 2
        WHEN 'SIN_PRIMERA_RESPUESTA' THEN 3 WHEN 'SIN_ACCION_INMEDIATA' THEN 4 END,
        @accion = CASE @motivo WHEN 'SEGUIMIENTO_VENCIDO' THEN 'REVISAR_SEGUIMIENTO'
        WHEN 'SEGUIMIENTO_HOY' THEN 'REVISAR_SEGUIMIENTO'
        WHEN 'SIN_PRIMERA_RESPUESTA' THEN 'REVISAR_CONTEXTO'
        WHEN 'VINCULO_INCONSISTENTE' THEN 'REVISION_HUMANA'
        WHEN 'OPORTUNIDAD_INACTIVA' THEN 'FINALIZAR'
        ELSE 'ESPERAR_EVENTO' END;

    SET @ahora = SYSUTCDATETIME();
    IF @vence <= @ahora
    BEGIN
        COMMIT;
        RETURN;
    END;

    DECLARE @estado VARCHAR(12) = CASE WHEN @accion = 'REVISION_HUMANA' THEN 'REVISION' ELSE 'COMPLETADO' END;
    INSERT dbo.PriorizacionesAgenteLead (id_solicitud, intento, prioridad, motivo, siguiente_accion, evaluada_utc)
    VALUES (@id_solicitud, @intento, @prioridad, @motivo, @accion, @ahora);
    UPDATE dbo.TrabajosAgenteLead
    SET estado = @estado, token = NULL, vence_utc = NULL
    WHERE id_solicitud = @id_solicitud;
    INSERT dbo.AuditoriaTrabajosAgenteLead (id_solicitud, intento, accion)
    VALUES (@id_solicitud, @intento, @estado);
    COMMIT;

    SELECT @id_solicitud AS id_solicitud, @prioridad AS prioridad, @motivo AS motivo, @accion AS siguiente_accion;
END;
GO

GRANT EXECUTE ON dbo.usp_PriorizarTrabajoAgenteLead TO rol_ejecutor_agente_lead;
COMMIT;
GO
