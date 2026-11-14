SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('dbo.SeguimientoOperativoLead','U') IS NULL
   OR OBJECT_ID('dbo.MensajesWhatsAppLead','U') IS NULL
   OR OBJECT_ID('dbo.ConfirmacionesWhatsAppLead','U') IS NULL
  THROW 54815, 'Instala primero el seguimiento operativo, el buzón y las confirmaciones de WhatsApp LEAD.', 1;

BEGIN TRANSACTION;

IF COL_LENGTH('dbo.MensajesWhatsAppLead','habilita_seguimiento_automatico') IS NULL
  ALTER TABLE dbo.MensajesWhatsAppLead ADD habilita_seguimiento_automatico bit NULL
    CONSTRAINT DF_MensajesWhatsAppLead_SeguimientoAutomatico DEFAULT (1);

IF COL_LENGTH('dbo.SeguimientoOperativoLead','origen_whatsapp') IS NULL
  ALTER TABLE dbo.SeguimientoOperativoLead ADD origen_whatsapp varchar(12) NULL,
    id_mensaje_origen_whatsapp bigint NULL, turno_whatsapp varchar(8) NULL;

COMMIT;
