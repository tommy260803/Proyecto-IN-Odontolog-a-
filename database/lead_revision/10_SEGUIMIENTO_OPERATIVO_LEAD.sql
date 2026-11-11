:ON ERROR EXIT
SET XACT_ABORT ON;
IF DB_NAME()<>'NexoSaludDB'
  THROW 54810,'Ejecutar exclusivamente en NexoSaludDB tras autorizar la instalación.',1;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.SeguimientoOperativoLead','U') IS NULL
CREATE TABLE dbo.SeguimientoOperativoLead (
  id_solicitud INT NOT NULL PRIMARY KEY REFERENCES dbo.Solicitudes(id_solicitud),
  estado VARCHAR(15) NOT NULL CHECK (estado IN ('PROGRAMADO','PAUSADO','CANCELADO','PREPARADO','ENVIADO','FALLIDO')),
  motivo NVARCHAR(400) NOT NULL,
  borrador NVARCHAR(2000) NULL,
  clave_envio UNIQUEIDENTIFIER NULL,
  id_externo NVARCHAR(200) NULL,
  ultimo_envio_utc DATETIME2(3) NULL,
  actualizado_utc DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  revision INT NOT NULL DEFAULT 1
);
IF OBJECT_ID('dbo.HistorialSeguimientoOperativoLead','U') IS NULL
CREATE TABLE dbo.HistorialSeguimientoOperativoLead (
  id_historial BIGINT IDENTITY PRIMARY KEY,
  id_solicitud INT NOT NULL REFERENCES dbo.Solicitudes(id_solicitud),
  estado VARCHAR(15) NOT NULL,
  motivo NVARCHAR(400) NOT NULL,
  borrador NVARCHAR(2000) NULL,
  revision INT NOT NULL,
  registrado_utc DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.SeguimientoOperativoLead') AND name='UX_SeguimientoLead_Clave')
CREATE UNIQUE INDEX UX_SeguimientoLead_Clave ON dbo.SeguimientoOperativoLead(clave_envio) WHERE clave_envio IS NOT NULL;
COMMIT;
