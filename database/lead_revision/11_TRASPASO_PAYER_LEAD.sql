:ON ERROR EXIT
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;
IF DB_NAME() NOT IN (N'NexoSaludDB',N'NexoSalud_LeadPruebas')
 THROW 54600,'Destino no autorizado para CAP-05.',1;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.AccesosPreReservaLead','U') IS NULL
 CREATE TABLE dbo.AccesosPreReservaLead (
  hash_token CHAR(64) NOT NULL CONSTRAINT PK_AccesosPreReservaLead PRIMARY KEY,
  id_persona INT NOT NULL REFERENCES dbo.Personas(id_persona),
  id_solicitud INT NOT NULL REFERENCES dbo.Solicitudes(id_solicitud),
  id_opcion INT NOT NULL REFERENCES dbo.Opciones(id_opcion),
  huella CHAR(64) NOT NULL,
  vence_utc DATETIME2(3) NOT NULL,
  creado_utc DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  id_usuario INT NULL REFERENCES dbo.Usuarios(id_usuario)
 );
IF OBJECT_ID('dbo.TraspasosPayerLead','U') IS NULL
 CREATE TABLE dbo.TraspasosPayerLead (
  id_solicitud INT NOT NULL CONSTRAINT PK_TraspasosPayerLead PRIMARY KEY REFERENCES dbo.Solicitudes(id_solicitud),
  id_persona INT NOT NULL REFERENCES dbo.Personas(id_persona),
  id_opcion INT NOT NULL REFERENCES dbo.Opciones(id_opcion),
  id_propuesta INT NOT NULL REFERENCES dbo.PropuestasEconomicasLead(id_propuesta),
  id_reserva INT NOT NULL CONSTRAINT UQ_TraspasosLead_Reserva UNIQUE REFERENCES dbo.Reservas(id_reserva),
  id_evento INT NOT NULL CONSTRAINT UQ_TraspasosLead_Evento UNIQUE REFERENCES dbo.EventosEtapa(id_evento_etapa),
  clave_operacion VARCHAR(80) NOT NULL CONSTRAINT UQ_TraspasosLead_Clave UNIQUE,
  huella CHAR(64) NOT NULL,
  origen VARCHAR(15) NOT NULL CHECK(origen IN ('ASESOR','PACIENTE')),
  evidencia NVARCHAR(300) NOT NULL,
  id_usuario INT NULL REFERENCES dbo.Usuarios(id_usuario),
  autoriza_contacto BIT NOT NULL,
  confirmado_utc DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
 );
COMMIT;
