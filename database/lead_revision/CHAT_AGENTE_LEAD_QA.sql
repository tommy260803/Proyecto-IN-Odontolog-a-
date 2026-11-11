:ON ERROR EXIT
IF DB_NAME() <> N'NexoSalud_LeadPruebas'
    THROW 54730, 'Instalacion permitida solo en NexoSalud_LeadPruebas.', 1;
IF OBJECT_ID(N'dbo.EntradasAgenteLead', N'U') IS NULL
    THROW 54731, 'Instale primero ENTRADA_AGENTE_LEAD_QA.sql.', 1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.AccesosChatLead', N'U') IS NULL
CREATE TABLE dbo.AccesosChatLead (
    id_solicitud INT NOT NULL PRIMARY KEY REFERENCES dbo.EntradasAgenteLead(id_solicitud),
    token_hash BINARY(32) NOT NULL UNIQUE,
    id_usuario INT NOT NULL REFERENCES dbo.Usuarios(id_usuario),
    vence_utc DATETIME2(7) NOT NULL
);

IF OBJECT_ID(N'dbo.MensajesChatLead', N'U') IS NULL
CREATE TABLE dbo.MensajesChatLead (
    id_mensaje INT IDENTITY PRIMARY KEY,
    id_solicitud INT NOT NULL REFERENCES dbo.AccesosChatLead(id_solicitud),
    clave UNIQUEIDENTIFIER NOT NULL,
    remitente VARCHAR(8) NOT NULL CHECK (remitente IN ('PACIENTE','PERSONAL')),
    id_usuario INT NULL REFERENCES dbo.Usuarios(id_usuario),
    texto NVARCHAR(2000) NOT NULL,
    publicado_utc DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    recibido_utc DATETIME2(7) NULL,
    CONSTRAINT UQ_MensajesChatLead_Envio UNIQUE (id_solicitud, remitente, clave),
    CONSTRAINT CK_MensajesChatLead_Usuario CHECK (
        (remitente = 'PACIENTE' AND id_usuario IS NULL) OR (remitente = 'PERSONAL' AND id_usuario IS NOT NULL)
    )
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.MensajesChatLead') AND name = N'IX_MensajesChatLead_Historial')
    CREATE INDEX IX_MensajesChatLead_Historial ON dbo.MensajesChatLead (id_solicitud, id_mensaje);
COMMIT;
