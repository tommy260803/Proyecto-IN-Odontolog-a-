:ON ERROR EXIT
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.PropuestasEconomicasLead','fecha_vigencia_hasta_utc_lead') IS NULL
  ALTER TABLE dbo.PropuestasEconomicasLead ADD fecha_vigencia_hasta_utc_lead DATETIME2(3) NULL;

IF OBJECT_ID('dbo.HistorialVigenciaPropuestasLead','U') IS NULL
BEGIN
  CREATE TABLE dbo.HistorialVigenciaPropuestasLead (
    id_historial BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HistVigenciaPropuestasLead PRIMARY KEY,
    id_propuesta INT NOT NULL,
    fecha_observacion_utc DATETIME2(7) NOT NULL CONSTRAINT DF_HistVigenciaPropuestasLead_Fecha DEFAULT SYSUTCDATETIME(),
    accion VARCHAR(10) NOT NULL,
    fecha_vigencia_hasta_utc_lead DATETIME2(3) NULL,
    CONSTRAINT CK_HistVigenciaPropuestasLead_Accion
      CHECK (accion IN ('BASELINE','INSERT','UPDATE','DELETE'))
  );
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_Lead_VigenciaPropuestas_Auditar
ON dbo.PropuestasEconomicasLead AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;

  -- Una cotización ya emitida conserva su vencimiento; para cambiarlo se crea versión.
  IF EXISTS (
    SELECT 1 FROM inserted i
    JOIN deleted d ON d.id_propuesta=i.id_propuesta
    WHERE ISNULL(i.fecha_vigencia_hasta_utc_lead, CONVERT(datetime2(3),'19000101'))
       <> ISNULL(d.fecha_vigencia_hasta_utc_lead, CONVERT(datetime2(3),'19000101'))
  )
    THROW 54201,'No se puede cambiar el vencimiento de una versión existente; crea una nueva versión.',1;

  IF EXISTS (SELECT 1 FROM inserted WHERE fecha_vigencia_hasta_utc_lead IS NOT NULL
             AND fecha_vigencia_hasta_utc_lead<=SYSUTCDATETIME())
    THROW 54202,'La vigencia de una propuesta nueva debe estar en el futuro UTC.',1;

  INSERT dbo.HistorialVigenciaPropuestasLead
    (id_propuesta,accion,fecha_vigencia_hasta_utc_lead)
  SELECT i.id_propuesta,CASE WHEN d.id_propuesta IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
         i.fecha_vigencia_hasta_utc_lead
  FROM inserted i LEFT JOIN deleted d ON d.id_propuesta=i.id_propuesta;

  INSERT dbo.HistorialVigenciaPropuestasLead
    (id_propuesta,accion,fecha_vigencia_hasta_utc_lead)
  SELECT d.id_propuesta,'DELETE',d.fecha_vigencia_hasta_utc_lead
  FROM deleted d LEFT JOIN inserted i ON i.id_propuesta=d.id_propuesta
  WHERE i.id_propuesta IS NULL;
END;
GO

-- No se inventan vencimientos para cotizaciones existentes: quedan como desconocidos (NULL).
INSERT dbo.HistorialVigenciaPropuestasLead
  (id_propuesta,accion,fecha_vigencia_hasta_utc_lead)
SELECT p.id_propuesta,'BASELINE',p.fecha_vigencia_hasta_utc_lead
FROM dbo.PropuestasEconomicasLead p
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.HistorialVigenciaPropuestasLead h WHERE h.id_propuesta=p.id_propuesta
);

IF COL_LENGTH('dbo.PropuestasEconomicasLead','fecha_vigencia_hasta_utc_lead') IS NULL
   OR OBJECT_ID('dbo.HistorialVigenciaPropuestasLead','U') IS NULL
   OR OBJECT_ID('dbo.trg_Lead_VigenciaPropuestas_Auditar','TR') IS NULL
  THROW 54203,'No quedó instalada la vigencia auditable de propuestas LEAD.',1;

COMMIT TRANSACTION;
GO
