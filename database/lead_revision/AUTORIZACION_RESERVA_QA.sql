SET XACT_ABORT ON;
IF DB_NAME() <> N'NexoSalud_LeadPruebas'
    THROW 54500, 'Este script solo se instala en NexoSalud_LeadPruebas.', 1;

IF OBJECT_ID(N'dbo.AutorizacionesReservaLead', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AutorizacionesReservaLead (
        id_autorizacion INT IDENTITY(1,1) PRIMARY KEY,
        id_solicitud INT NOT NULL REFERENCES dbo.Solicitudes(id_solicitud),
        id_opcion INT NOT NULL REFERENCES dbo.Opciones(id_opcion),
        id_propuesta INT NOT NULL REFERENCES dbo.PropuestasEconomicasLead(id_propuesta),
        id_historial_opcion BIGINT NOT NULL REFERENCES dbo.HistorialOpcionesLead(id_historial),
        id_usuario INT NOT NULL REFERENCES dbo.Usuarios(id_usuario),
        id_canal INT NOT NULL REFERENCES dbo.Canales(id_canal),
        referencia_evidencia NVARCHAR(300) NOT NULL,
        registrada_utc DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_AutorizacionesReservaLead_Condiciones
            UNIQUE (id_solicitud, id_opcion, id_propuesta, id_historial_opcion)
    );
END;
