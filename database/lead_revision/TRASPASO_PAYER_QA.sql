SET XACT_ABORT ON;
IF DB_NAME() <> N'NexoSalud_LeadPruebas'
    THROW 54501, 'Este script solo se instala en NexoSalud_LeadPruebas.', 1;
IF OBJECT_ID(N'dbo.AutorizacionesReservaLead', N'U') IS NULL
    THROW 54502, 'Primero instala AUTORIZACION_RESERVA_QA.sql.', 1;

IF COL_LENGTH('dbo.AutorizacionesReservaLead', 'id_reserva') IS NULL
    ALTER TABLE dbo.AutorizacionesReservaLead ADD id_reserva INT NULL
        CONSTRAINT FK_AutorizacionLead_Reserva FOREIGN KEY REFERENCES dbo.Reservas(id_reserva);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.AutorizacionesReservaLead')
    AND name = N'UX_AutorizacionLead_Reserva')
    EXEC(N'CREATE UNIQUE INDEX UX_AutorizacionLead_Reserva ON dbo.AutorizacionesReservaLead(id_reserva)
        WHERE id_reserva IS NOT NULL;');
