:ON ERROR EXIT
IF DB_NAME() <> N'NexoSalud_LeadPruebas'
 THROW 54700, 'Instalacion permitida solo en NexoSalud_LeadPruebas.', 1;
IF OBJECT_ID(N'dbo.usp_ConvertirBuyerALead', N'P') IS NULL
 OR COL_LENGTH(N'dbo.EventosEtapa', N'clave_operacion_buyer') IS NULL
 THROW 54701, 'Primero instale el paquete OLTP BUYER y LEAD.', 1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO

IF OBJECT_ID(N'dbo.EntradasAgenteLead', N'U') IS NULL
CREATE TABLE dbo.EntradasAgenteLead (
    id_solicitud INT NOT NULL PRIMARY KEY REFERENCES dbo.Solicitudes(id_solicitud),
    id_evento_etapa INT NOT NULL UNIQUE REFERENCES dbo.EventosEtapa(id_evento_etapa),
    id_captacion INT NOT NULL REFERENCES dbo.CaptacionesBuyer(id_captacion),
    id_persona INT NOT NULL REFERENCES dbo.Personas(id_persona),
    fecha_registro_utc DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE OR ALTER PROCEDURE dbo.usp_RegistrarEntradaAgenteLead
    @id_solicitud INT
AS
BEGIN
    SET NOCOUNT ON;
    IF @@TRANCOUNT <> 0 OR (@@OPTIONS & 2) = 2
        THROW 54702, 'La entrada requiere una sesion sin transaccion de conversion.', 1;
    SET XACT_ABORT ON;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Bloquea la clave incluso si todavia no existe y serializa avisos repetidos.
        IF NOT EXISTS (
            SELECT 1 FROM dbo.EntradasAgenteLead WITH (UPDLOCK, HOLDLOCK)
            WHERE id_solicitud = @id_solicitud
        )
        BEGIN
            INSERT dbo.EntradasAgenteLead (id_solicitud, id_evento_etapa, id_captacion, id_persona)
            SELECT s.id_solicitud, e.id_evento_etapa, c.id_captacion, s.id_persona
            FROM dbo.Solicitudes s
            JOIN dbo.EventosEtapa e ON e.id_solicitud = s.id_solicitud AND e.id_persona = s.id_persona
            JOIN dbo.CaptacionesBuyer c ON c.id_captacion = e.id_captacion AND c.id_persona = s.id_persona
            JOIN dbo.Etapas origen ON origen.id_etapa = e.etapa_origen AND origen.nombre = 'BUYER'
            JOIN dbo.Etapas destino ON destino.id_etapa = e.etapa_destino AND destino.nombre = 'LEAD'
            WHERE s.id_solicitud = @id_solicitud
              AND e.clave_operacion_buyer = CONCAT('BUYER_LEAD:', c.id_captacion);

            IF @@ROWCOUNT = 0
                THROW 54703, 'La solicitud no tiene una conversion BUYER a LEAD vinculada.', 1;
        END;

        COMMIT;
        SELECT id_solicitud, id_evento_etapa, id_captacion, id_persona
        FROM dbo.EntradasAgenteLead
        WHERE id_solicitud = @id_solicitud;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO
COMMIT;
GO
