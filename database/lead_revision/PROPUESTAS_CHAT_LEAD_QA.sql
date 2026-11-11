:ON ERROR EXIT
IF DB_NAME() <> N'NexoSalud_LeadPruebas'
    THROW 54740, 'Instalacion permitida solo en NexoSalud_LeadPruebas.', 1;
IF OBJECT_ID(N'dbo.AccesosChatLead', N'U') IS NULL
    THROW 54741, 'Instale primero CHAT_AGENTE_LEAD_QA.sql.', 1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.PropuestasChatLead', N'U') IS NULL
CREATE TABLE dbo.PropuestasChatLead (
    id_propuesta INT NOT NULL PRIMARY KEY REFERENCES dbo.PropuestasEconomicasLead(id_propuesta),
    id_solicitud INT NOT NULL REFERENCES dbo.AccesosChatLead(id_solicitud),
    id_usuario INT NOT NULL REFERENCES dbo.Usuarios(id_usuario),
    precio DECIMAL(10,2) NOT NULL,
    promocion NVARCHAR(150) NULL,
    publicada_utc DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    aceptada_utc DATETIME2(7) NULL
);
COMMIT;
