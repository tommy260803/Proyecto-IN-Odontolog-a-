:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN ('NexoSaludDB', 'NexoSalud_LeadPruebas')
  THROW 54816, 'Selecciona la base operativa LEAD o su copia de pruebas.', 1;
IF OBJECT_ID('dbo.MensajesWhatsAppLead', 'U') IS NULL
  THROW 54817, 'Instala primero 12_CHATBOT_WHATSAPP_LEAD.sql.', 1;

BEGIN TRANSACTION;
IF OBJECT_ID('dbo.ConfirmacionesWhatsAppLead', 'U') IS NULL
BEGIN
  -- El recibo puede llegar antes de que se registre la salida en MensajesWhatsAppLead.
  CREATE TABLE dbo.ConfirmacionesWhatsAppLead (
    id_sesion NVARCHAR(128) COLLATE Latin1_General_100_BIN2 NOT NULL,
    id_externo NVARCHAR(220) COLLATE Latin1_General_100_BIN2 NOT NULL,
    entrega_detectada_utc DATETIME2(3) NULL,
    lectura_detectada_utc DATETIME2(3) NULL,
    CONSTRAINT PK_ConfirmacionesWhatsAppLead PRIMARY KEY (id_sesion,id_externo)
  );
END;
COMMIT;
