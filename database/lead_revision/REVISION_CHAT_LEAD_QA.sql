:ON ERROR EXIT
IF DB_NAME() <> N'NexoSalud_LeadPruebas'
    THROW 54750, 'Instalacion permitida solo en NexoSalud_LeadPruebas.', 1;
IF OBJECT_ID(N'dbo.AccesosChatLead', N'U') IS NULL
    THROW 54751, 'Instale primero CHAT_AGENTE_LEAD_QA.sql.', 1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.RevisionesChatLead', N'U') IS NULL
CREATE TABLE dbo.RevisionesChatLead (
    id_revision INT IDENTITY NOT NULL PRIMARY KEY,
    id_solicitud INT NOT NULL REFERENCES dbo.AccesosChatLead(id_solicitud),
    id_usuario INT NOT NULL REFERENCES dbo.Usuarios(id_usuario),
    pausado BIT NOT NULL,
    motivo NVARCHAR(400) NOT NULL,
    registrado_utc DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.RevisionesChatLead') AND name = N'IX_RevisionesChatLead_Solicitud')
    CREATE INDEX IX_RevisionesChatLead_Solicitud ON dbo.RevisionesChatLead (id_solicitud, id_revision DESC);
COMMIT;
