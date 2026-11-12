:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() NOT IN ('NexoSaludDB', 'NexoSalud_LeadPruebas')
  THROW 54812, 'Selecciona la base operativa LEAD o su copia de pruebas.', 1;
IF OBJECT_ID('dbo.AccesosPreReservaLead', 'U') IS NULL OR COL_LENGTH('dbo.Interacciones', 'id_solicitud') IS NULL
  THROW 54813, 'Instala primero el esquema operativo de LEAD y el incremento 11.', 1;

BEGIN TRANSACTION;
IF OBJECT_ID('dbo.MensajesWhatsAppLead', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MensajesWhatsAppLead (
    id_mensaje BIGINT IDENTITY PRIMARY KEY,
    id_sesion NVARCHAR(128) COLLATE Latin1_General_100_BIN2 NOT NULL,
    id_externo NVARCHAR(220) COLLATE Latin1_General_100_BIN2 NOT NULL,
    chat NVARCHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
    id_citado NVARCHAR(220) COLLATE Latin1_General_100_BIN2 NULL,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA','OFERTA','BOT')),
    estado VARCHAR(12) NOT NULL CHECK (estado IN ('PENDIENTE','PROCESANDO','FINALIZADO','REVISION')),
    id_persona INT NULL REFERENCES dbo.Personas(id_persona),
    id_solicitud INT NULL REFERENCES dbo.Solicitudes(id_solicitud),
    id_propuesta INT NULL REFERENCES dbo.PropuestasEconomicasLead(id_propuesta),
    id_opcion INT NULL REFERENCES dbo.Opciones(id_opcion),
    huella CHAR(64) NULL,
    id_interaccion INT NULL REFERENCES dbo.Interacciones(id_interaccion),
    texto NVARCHAR(4000) NULL,
    plan_respuesta NVARCHAR(MAX) NULL,
    decision VARCHAR(30) NULL,
    intentos TINYINT NOT NULL DEFAULT 0,
    fecha_utc DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    disponible_utc DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    toma_utc DATETIME2(3) NULL,
    CONSTRAINT UX_MensajesWhatsAppLead_Externo UNIQUE (id_sesion, id_externo, tipo)
  );
  CREATE INDEX IX_MensajesWhatsAppLead_Chat ON dbo.MensajesWhatsAppLead(id_sesion, chat, tipo, id_mensaje DESC);
  CREATE INDEX IX_MensajesWhatsAppLead_Trabajo ON dbo.MensajesWhatsAppLead(tipo, estado, disponible_utc, id_mensaje);
END;
COMMIT;
