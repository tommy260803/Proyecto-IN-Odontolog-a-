:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() NOT IN ('NexoSaludDB', 'NexoSalud_LeadPruebas')
  THROW 54814, 'Selecciona la base operativa LEAD o su copia de pruebas.', 1;
IF COL_LENGTH('dbo.Interacciones', 'id_solicitud') IS NULL
  THROW 54815, 'Instala primero el esquema de interacciones LEAD.', 1;

BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM dbo.Canales WITH (UPDLOCK,HOLDLOCK) WHERE nombre='Presencial')
  INSERT dbo.Canales(nombre,activo) VALUES ('Presencial',1);
IF OBJECT_ID('dbo.AnalisisInteraccionesLead', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AnalisisInteraccionesLead (
    id_analisis BIGINT IDENTITY PRIMARY KEY,
    id_interaccion INT NOT NULL REFERENCES dbo.Interacciones(id_interaccion),
    huella_contexto CHAR(64) NOT NULL,
    analisis NVARCHAR(MAX) NOT NULL CHECK (ISJSON(analisis)=1),
    fecha_utc DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_AnalisisInteraccionesLead_Contexto UNIQUE (id_interaccion,huella_contexto)
  );
  CREATE INDEX IX_AnalisisInteraccionesLead_Ultimo
    ON dbo.AnalisisInteraccionesLead(id_interaccion,id_analisis DESC);
END;
COMMIT;
