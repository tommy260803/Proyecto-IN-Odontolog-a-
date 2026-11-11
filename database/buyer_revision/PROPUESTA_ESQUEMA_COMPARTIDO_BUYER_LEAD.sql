-- ============================================================================
-- PROPUESTA DE CAMBIOS COMPARTIDOS DE ESQUEMA: BUYER <-> LEAD
-- Base de datos destino QA: NexoSalud_LeadEnsayoFinal / NexoSalud_LeadPruebas
-- ============================================================================
:ON ERROR EXIT

IF DB_NAME() NOT IN (N'NexoSalud_LeadEnsayoFinal', N'NexoSalud_LeadPruebas')
    THROW 54700, 'Instalacion permitida unicamente en NexoSalud_LeadEnsayoFinal o NexoSalud_LeadPruebas.', 1;

IF OBJECT_ID(N'dbo.usp_ConvertirBuyerALead', N'P') IS NULL
   OR COL_LENGTH(N'dbo.EventosEtapa', N'clave_operacion_buyer') IS NULL
    THROW 54701, 'Se requiere la instalacion previa del paquete OLTP BUYER y LEAD.', 1;

SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO

-- 1. Asegurar columna id_solicitud en dbo.Interacciones
IF COL_LENGTH(N'dbo.Interacciones', N'id_solicitud') IS NULL
BEGIN
    ALTER TABLE dbo.Interacciones ADD id_solicitud INT NULL;
END;
GO

-- 2. Asegurar columnas de enlace en dbo.DecisionesIA
IF COL_LENGTH(N'dbo.DecisionesIA', N'id_captacion') IS NULL
BEGIN
    ALTER TABLE dbo.DecisionesIA ADD id_captacion INT NULL;
END;
GO

IF COL_LENGTH(N'dbo.DecisionesIA', N'id_interaccion') IS NULL
BEGIN
    ALTER TABLE dbo.DecisionesIA ADD id_interaccion INT NULL;
END;
GO

-- 3. Tabla dbo.EntradasAgenteLead (Recepción formal e idempotente para el agente LEAD)
IF OBJECT_ID(N'dbo.EntradasAgenteLead', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EntradasAgenteLead (
        id_solicitud INT NOT NULL PRIMARY KEY REFERENCES dbo.Solicitudes(id_solicitud),
        id_evento_etapa INT NOT NULL UNIQUE REFERENCES dbo.EventosEtapa(id_evento_etapa),
        id_captacion INT NOT NULL REFERENCES dbo.CaptacionesBuyer(id_captacion),
        id_persona INT NOT NULL REFERENCES dbo.Personas(id_persona),
        fecha_registro_utc DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- 4. Procedimiento almacenado dbo.usp_RegistrarEntradaAgenteLead
CREATE OR ALTER PROCEDURE dbo.usp_RegistrarEntradaAgenteLead
    @id_solicitud INT
AS
BEGIN
    SET NOCOUNT ON;
    IF @@TRANCOUNT <> 0 OR (@@OPTIONS & 2) = 2
        THROW 54702, 'La entrada requiere una sesion sin transaccion de conversion abierta.', 1;
    SET XACT_ABORT ON;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Bloqueo con UPDLOCK, HOLDLOCK para serializar concurrencia de entregas
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
