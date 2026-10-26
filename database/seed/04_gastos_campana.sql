-- ============================================================================
-- SCRIPT DE SEED: GASTOS DE CAMPAÑA DE MARKETING
-- Base de Datos: NexoSaludDB
-- Objetivo: Poblar gastos reales/históricos para Septiembre 2026 en campañas de Meta Ads
-- ============================================================================

USE NexoSaludDB;
GO

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM GastosCampana)
BEGIN
    DECLARE @idCampWsp INT = (SELECT id_campana FROM Campanas WHERE id_campana = 1);
    DECLARE @idCampIg  INT = (SELECT id_campana FROM Campanas WHERE id_campana = 2);
    DECLARE @idCampFb  INT = (SELECT id_campana FROM Campanas WHERE id_campana = 3);

    -- Días 01 a 30 de septiembre 2026
    DECLARE @d INT = 1;
    WHILE @d <= 30
    BEGIN
        DECLARE @fecha DATE = DATEFROMPARTS(2026, 9, @d);

        -- Campaña 1: WhatsApp Ads (S/. 150.00/día)
        IF @idCampWsp IS NOT NULL
            INSERT INTO GastosCampana (id_campana, fecha, importe, descripcion)
            VALUES (@idCampWsp, @fecha, 150.00, CONCAT('Pauta Meta Ads WhatsApp - Trujillo Día ', @d));

        -- Campaña 2: Instagram Ads (S/. 100.00/día)
        IF @idCampIg IS NOT NULL
            INSERT INTO GastosCampana (id_campana, fecha, importe, descripcion)
            VALUES (@idCampIg, @fecha, 100.00, CONCAT('Pauta Meta Ads Instagram - Trujillo Día ', @d));

        -- Campaña 3: Facebook Ads (S/. 75.00/día)
        IF @idCampFb IS NOT NULL
            INSERT INTO GastosCampana (id_campana, fecha, importe, descripcion)
            VALUES (@idCampFb, @fecha, 75.00, CONCAT('Pauta Meta Ads Facebook - Trujillo Día ', @d));

        SET @d = @d + 1;
    END;

    PRINT 'GastosCampana poblados exitosamente para Septiembre 2026 (90 registros).';
END
ELSE
BEGIN
    PRINT 'GastosCampana ya contenía registros. No se duplicaron datos.';
END;
GO
