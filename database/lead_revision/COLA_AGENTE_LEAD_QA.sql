:ON ERROR EXIT
IF DB_NAME() <> N'NexoSalud_LeadPruebas'
    THROW 54710, 'Instalacion permitida solo en NexoSalud_LeadPruebas.', 1;
IF OBJECT_ID(N'dbo.EntradasAgenteLead', N'U') IS NULL
    THROW 54711, 'Instale primero ENTRADA_AGENTE_LEAD_QA.sql.', 1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO

IF OBJECT_ID(N'dbo.TrabajosAgenteLead', N'U') IS NULL
CREATE TABLE dbo.TrabajosAgenteLead (
    id_solicitud INT NOT NULL PRIMARY KEY REFERENCES dbo.EntradasAgenteLead(id_solicitud),
    creado_utc DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    disponible_utc DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    estado VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
    vence_utc DATETIME2(7) NULL,
    token UNIQUEIDENTIFIER NULL,
    intentos INT NOT NULL DEFAULT 0,
    CONSTRAINT CK_TrabajosAgenteLead_Estado CHECK (
        (estado = 'EN_CURSO' AND vence_utc IS NOT NULL AND token IS NOT NULL)
        OR (estado IN ('PENDIENTE','COMPLETADO','REVISION') AND vence_utc IS NULL AND token IS NULL)
    )
);

IF OBJECT_ID(N'dbo.AuditoriaTrabajosAgenteLead', N'U') IS NULL
CREATE TABLE dbo.AuditoriaTrabajosAgenteLead (
    id_auditoria BIGINT IDENTITY PRIMARY KEY,
    id_solicitud INT NOT NULL REFERENCES dbo.TrabajosAgenteLead(id_solicitud),
    intento INT NOT NULL,
    accion VARCHAR(12) NOT NULL,
    actor SYSNAME NOT NULL DEFAULT ORIGINAL_LOGIN(),
    registrado_utc DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_AuditoriaTrabajosAgenteLead UNIQUE (id_solicitud, intento, accion)
);
GO

CREATE OR ALTER TRIGGER dbo.tr_EntradaAgenteLead_Encolar
ON dbo.EntradasAgenteLead AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT dbo.TrabajosAgenteLead (id_solicitud)
    SELECT id_solicitud FROM inserted;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_TomarTrabajoAgenteLead
    @segundos INT = 60,
    @id_solicitud INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @segundos IS NULL OR @segundos NOT BETWEEN 1 AND 300 OR @@TRANCOUNT <> 0
        THROW 54712, 'Plazo invalido o transaccion externa.', 1;

    DECLARE @trabajo TABLE (id_solicitud INT, token UNIQUEIDENTIFIER, intentos INT);
    BEGIN TRANSACTION;
    DECLARE @ahora DATETIME2(7) = SYSUTCDATETIME();
    ;WITH siguiente AS (
        SELECT TOP (1) *
        FROM dbo.TrabajosAgenteLead WITH (UPDLOCK, READPAST, READCOMMITTEDLOCK)
        WHERE (@id_solicitud IS NULL OR id_solicitud = @id_solicitud)
          AND ((estado = 'PENDIENTE' AND disponible_utc <= @ahora)
           OR (estado = 'EN_CURSO' AND vence_utc <= @ahora))
        ORDER BY disponible_utc, id_solicitud
    )
    UPDATE siguiente
    SET estado = CASE WHEN intentos >= 5 THEN 'REVISION' ELSE 'EN_CURSO' END,
        token = CASE WHEN intentos < 5 THEN NEWID() END,
        vence_utc = CASE WHEN intentos < 5 THEN DATEADD(SECOND, @segundos, @ahora) END,
        intentos = CASE WHEN intentos < 5 THEN intentos + 1 ELSE intentos END
    OUTPUT inserted.id_solicitud, inserted.token, inserted.intentos INTO @trabajo;

    INSERT dbo.AuditoriaTrabajosAgenteLead (id_solicitud, intento, accion)
    SELECT id_solicitud, intentos, CASE WHEN token IS NULL THEN 'REVISION' ELSE 'TOMADO' END
    FROM @trabajo;
    COMMIT;

    SELECT t.id_solicitud, t.token, t.intentos, e.id_evento_etapa
    FROM @trabajo t
    JOIN dbo.EntradasAgenteLead e ON e.id_solicitud = t.id_solicitud
    WHERE t.token IS NOT NULL;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_ResolverTrabajoAgenteLead
    @id_solicitud INT,
    @token UNIQUEIDENTIFIER,
    @resultado VARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @resultado IS NULL OR @resultado NOT IN ('COMPLETADO','REINTENTO','REVISION') OR @@TRANCOUNT <> 0
        THROW 54713, 'Resultado invalido o transaccion externa.', 1;

    DECLARE @resuelto TABLE (intento INT, accion VARCHAR(12));
    BEGIN TRANSACTION;
    UPDATE dbo.TrabajosAgenteLead
    SET estado = CASE WHEN @resultado = 'REINTENTO'
                      THEN CASE WHEN intentos >= 5 THEN 'REVISION' ELSE 'PENDIENTE' END
                      ELSE @resultado END,
        disponible_utc = DATEADD(SECOND, 30 * intentos, SYSUTCDATETIME()),
        vence_utc = NULL, token = NULL
    OUTPUT inserted.intentos, inserted.estado INTO @resuelto
    WHERE id_solicitud = @id_solicitud AND estado = 'EN_CURSO'
      AND token = @token AND vence_utc > SYSUTCDATETIME();

    INSERT dbo.AuditoriaTrabajosAgenteLead (id_solicitud, intento, accion)
    SELECT @id_solicitud, intento, accion FROM @resuelto;
    COMMIT;

    SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM @resuelto) THEN 1 ELSE 0 END AS BIT) AS aplicado;
END;
GO

IF DATABASE_PRINCIPAL_ID(N'rol_ejecutor_agente_lead') IS NULL
    CREATE ROLE rol_ejecutor_agente_lead AUTHORIZATION dbo;
GRANT EXECUTE ON dbo.usp_TomarTrabajoAgenteLead TO rol_ejecutor_agente_lead;
GRANT EXECUTE ON dbo.usp_ResolverTrabajoAgenteLead TO rol_ejecutor_agente_lead;
COMMIT;
GO
