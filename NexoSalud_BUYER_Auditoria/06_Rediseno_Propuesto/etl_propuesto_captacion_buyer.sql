-- ============================================================================
-- PROCEDIMIENTO ALMACENADO ETL PROPUESTO: CARGA IDEMPOTENTE FACT_CAPTACION_BUYER
-- Sistema: NexoSalud (Data Mart Dimensional)
-- Procedimiento: sp_ETL_Carga_Fact_CaptacionBuyer
-- Estado: PROPUESTA DE REDISEÑO (NO EJECUTAR EN ETAPA DE AUDITORÍA)
-- ============================================================================

USE NexoSalud_Mart;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ETL_Carga_Fact_CaptacionBuyer
    @BatchId UNIQUEIDENTIFIER = NULL,
    @FechaCorte DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @BatchId IS NULL SET @BatchId = NEWID();
    IF @FechaCorte IS NULL SET @FechaCorte = CAST(GETDATE() AS DATE);

    DECLARE @StartTime DATETIME2 = SYSDATETIME();
    DECLARE @FilasInsertadas INT = 0;
    DECLARE @FilasActualizadas INT = 0;

    INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, FechaRegistro)
    VALUES (@BatchId, 'sp_ETL_Carga_Fact_CaptacionBuyer', 'INICIO', N'Iniciando carga de fact_captacion_buyer con grano por Oportunidad.', @StartTime);

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. CTE: Prorrateo Mensual de Gastos de Campaña
        ;WITH GastosProrrateados AS (
            SELECT 
                g.id_campana,
                FORMAT(g.fecha, 'yyyyMM') AS AnioMes,
                SUM(g.importe) AS TotalGastoMes
            FROM NexoSaludDB.dbo.GastosCampana g
            GROUP BY g.id_campana, FORMAT(g.fecha, 'yyyyMM')
        ),
        ConteoContactosCampana AS (
            SELECT 
                op.id_campana,
                FORMAT(op.fecha_captacion, 'yyyyMM') AS AnioMes,
                COUNT(*) AS CantidadContactosMes
            FROM NexoSaludDB.dbo.OportunidadesCaptacion op
            WHERE op.id_campana IS NOT NULL
            GROUP BY op.id_campana, FORMAT(op.fecha_captacion, 'yyyyMM')
        ),
        CostosUnitarios AS (
            SELECT 
                g.id_campana,
                g.AnioMes,
                CAST(ROUND(g.TotalGastoMes / NULLIF(c.CantidadContactosMes, 0), 2) AS DECIMAL(10,2)) AS CostoPorContacto
            FROM GastosProrrateados g
            INNER JOIN ConteoContactosCampana c ON g.id_campana = c.id_campana AND g.AnioMes = c.AnioMes
        ),

        -- 2. CTE: Transformación de Oportunidades y Lookup de Dimensiones Conformadas
        OportunidadesTransformadas AS (
            SELECT 
                op.id_oportunidad AS id_oportunidad_origen,
                
                -- Fecha Captación (Role-playing)
                CAST(FORMAT(op.fecha_captacion, 'yyyyMMdd') AS INT) AS KeyTiempoCaptacion,
                
                -- Fecha Conversión (Role-playing, null si no ha convertido)
                CASE 
                    WHEN op.fecha_conversion IS NOT NULL 
                    THEN CAST(FORMAT(op.fecha_conversion, 'yyyyMMdd') AS INT)
                    ELSE NULL 
                END AS KeyTiempoConversion,

                -- Dimensión Sede (Preferencia o fallback)
                ISNULL(ds.KeySede, 0) AS KeySede,

                -- Dimensión Canal
                ISNULL(dc.KeyCanal, 0) AS KeyCanal,

                -- Dimensión Fuente
                ISNULL(df.KeyFuente, 0) AS KeyFuente,

                -- Dimensión Servicio de Interés
                ISNULL(dserv.KeyServicio, 0) AS KeyServicioInteres,

                -- Dimensión Tipo Persona
                ISNULL(dtp.KeyTipoPersona, 0) AS KeyTipoPersona,

                -- Dimensión Estado Registro y Legalidad
                CASE 
                    WHEN p.autoriza_contacto = 1 AND p.estado_calidad = 'Valido' THEN 1 -- Valido con autorizacion
                    WHEN p.autoriza_contacto = 0 THEN 2                                 -- Sin autorizacion
                    WHEN p.estado_calidad = 'Duplicado' THEN 3                          -- Duplicado
                    ELSE 4                                                              -- Rechazado / Incompleto
                END AS KeyEstadoRegistro,

                -- Medidas Base
                1 AS contacto_registrado,
                
                -- Contacto Utilizable: Consentimiento estricto (Ley 29733) + Datos validos
                CASE 
                    WHEN p.autoriza_contacto = 1 
                         AND p.estado_calidad = 'Valido' 
                         AND LEN(RTRIM(LTRIM(ISNULL(p.numero, '')))) >= 9
                    THEN 1 
                    ELSE 0 
                END AS contacto_utilizable,

                -- Conversión a LEAD
                CASE 
                    WHEN op.estado_oportunidad = 'CONVERTIDO_LEAD' OR op.id_solicitud_lead IS NOT NULL 
                    THEN 1 
                    ELSE 0 
                END AS conversion_lead,

                -- Días transcurridos hasta la conversión
                CASE 
                    WHEN op.fecha_conversion IS NOT NULL 
                    THEN DATEDIFF(DAY, op.fecha_captacion, op.fecha_conversion)
                    ELSE NULL 
                END AS tiempo_conversion_dia,

                -- Costo atribuido financiero real
                ISNULL(cu.CostoPorContacto, 0.00) AS costo_atribuido_captacion

            FROM NexoSaludDB.dbo.OportunidadesCaptacion op
            INNER JOIN NexoSaludDB.dbo.Personas p ON op.id_persona = p.id_persona
            LEFT JOIN NexoSalud_Mart.dbo.Dim_Sede ds ON op.id_sede_preferida = ds.id_sede
            LEFT JOIN NexoSalud_Mart.dbo.Dim_Canal dc ON op.id_canal = dc.id_canal
            LEFT JOIN NexoSalud_Mart.dbo.Dim_Fuente df ON op.id_fuente = df.id_fuente
            LEFT JOIN NexoSalud_Mart.dbo.Dim_Servicio dserv ON op.id_servicio_interes = dserv.id_servicio
            LEFT JOIN NexoSalud_Mart.dbo.Dim_TipoPersona dtp ON p.id_persona = dtp.id_persona
            LEFT JOIN CostosUnitarios cu ON op.id_campana = cu.id_campana AND FORMAT(op.fecha_captacion, 'yyyyMM') = cu.AnioMes
        )

        -- 3. Carga Idempotente con MERGE sobre el grano natural id_oportunidad_origen
        MERGE NexoSalud_Mart.dbo.fact_captacion_buyer_v2 AS destino
        USING OportunidadesTransformadas AS origen
        ON destino.id_oportunidad_origen = origen.id_oportunidad_origen
        
        WHEN MATCHED AND (
            destino.conversion_lead <> origen.conversion_lead OR
            ISNULL(destino.KeyTiempoConversion, 0) <> ISNULL(origen.KeyTiempoConversion, 0) OR
            destino.contacto_utilizable <> origen.contacto_utilizable OR
            destino.costo_atribuido_captacion <> origen.costo_atribuido_captacion
        ) THEN
            UPDATE SET 
                destino.KeyTiempoConversion       = origen.KeyTiempoConversion,
                destino.KeyEstadoRegistro         = origen.KeyEstadoRegistro,
                destino.contacto_utilizable       = origen.contacto_utilizable,
                destino.conversion_lead           = origen.conversion_lead,
                destino.tiempo_conversion_dia     = origen.tiempo_conversion_dia,
                destino.costo_atribuido_captacion = origen.costo_atribuido_captacion,
                destino.FechaCargaETL             = SYSDATETIME()

        WHEN NOT MATCHED BY TARGET THEN
            INSERT (
                id_oportunidad_origen,
                KeyTiempoCaptacion,
                KeyTiempoConversion,
                KeySede,
                KeyCanal,
                KeyFuente,
                KeyServicioInteres,
                KeyTipoPersona,
                KeyEstadoRegistro,
                contacto_registrado,
                contacto_utilizable,
                conversion_lead,
                tiempo_conversion_dia,
                costo_atribuido_captacion,
                FechaCargaETL
            )
            VALUES (
                origen.id_oportunidad_origen,
                origen.KeyTiempoCaptacion,
                origen.KeyTiempoConversion,
                origen.KeySede,
                origen.KeyCanal,
                origen.KeyFuente,
                origen.KeyServicioInteres,
                origen.KeyTipoPersona,
                origen.KeyEstadoRegistro,
                origen.contacto_registrado,
                origen.contacto_utilizable,
                origen.conversion_lead,
                origen.tiempo_conversion_dia,
                origen.costo_atribuido_captacion,
                SYSDATETIME()
            );

        SET @FilasInsertadas = @@ROWCOUNT;

        COMMIT TRANSACTION;

        INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, FechaRegistro)
        VALUES (@BatchId, 'sp_ETL_Carga_Fact_CaptacionBuyer', 'EXITO', 
                CONCAT(N'Carga finalizada con éxito. Filas procesadas/afectadas: ', @FilasInsertadas), SYSDATETIME());

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        DECLARE @ErrorMsg NVARCHAR(4000) = ERROR_MESSAGE();
        INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, FechaRegistro)
        VALUES (@BatchId, 'sp_ETL_Carga_Fact_CaptacionBuyer', 'ERROR', @ErrorMsg, SYSDATETIME());

        THROW;
    END CATCH
END;
GO
PRINT 'Procedimiento sp_ETL_Carga_Fact_CaptacionBuyer creado exitosamente.';
GO
