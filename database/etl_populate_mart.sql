-- ====================================================================
-- NEXOSALUD — DATA MART DIMENSIONAL (CLÍNICA LUXEDENT, TRUJILLO)
-- PROCESO ETL ROBUSTO, IDEMPOTENTE Y NO DESTRUCTIVO
-- Motor: Microsoft SQL Server 2019 / 2022
-- Esquemas: [NexoSaludDB] (OLTP) -> [NexoSalud_Mart] (Data Mart)
-- ====================================================================

USE NexoSalud_Mart;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ====================================================================
-- 1. INFRAESTRUCTURA DE AUDITORÍA Y CONTROL DE EJECUCIÓN
-- ====================================================================
IF OBJECT_ID('dbo.Log_Ejecucion_ETL', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Log_Ejecucion_ETL (
        LogId BIGINT IDENTITY(1,1) PRIMARY KEY,
        BatchId VARCHAR(50) NOT NULL,
        Procedimiento VARCHAR(100) NOT NULL,
        TipoEvento VARCHAR(30) NOT NULL, -- 'INICIO', 'INFO', 'EXITO', 'ERROR'
        Mensaje NVARCHAR(MAX) NOT NULL,
        FilasAfectadas INT NULL,
        DuracionSegundos DECIMAL(10,2) NULL,
        FechaRegistro DATETIME2(7) NOT NULL DEFAULT SYSDATETIME()
    );
END;
GO

-- ====================================================================
-- 2. REGLA KIMBALL: MIEMBROS DESCONOCIDOS CANÓNICOS (KEY = 0)
-- Garantiza que claves foráneas huérfanas o nulas nunca rompan la integridad
-- ni se atribuyan falsamente a entidades con Key = 1.
-- ====================================================================

-- 2.1 Dim_Tiempo (KeyTiempo = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo WHERE KeyTiempo = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Tiempo ON;
    INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
    VALUES (0, '1900-01-01', 1900, 1, 1, 1);
    SET IDENTITY_INSERT dbo.Dim_Tiempo OFF;
END;
GO

-- 2.2 Dim_Sede (KeySede = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Sede WHERE KeySede = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Sede ON;
    INSERT INTO dbo.Dim_Sede (KeySede, id_sede, Sede, Distrito, Zona)
    VALUES (0, 0, 'Sede No Especificada', 'No Especificado', 'No Especificado');
    SET IDENTITY_INSERT dbo.Dim_Sede OFF;
END;
GO

-- 2.3 Dim_Servicio (KeyServicio = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Servicio WHERE KeyServicio = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Servicio ON;
    INSERT INTO dbo.Dim_Servicio (KeyServicio, id_servicio, ServicioOdontologico, Categoria, Procedimiento)
    VALUES (0, 0, 'Servicio No Especificado', 'General', 'No Especificado');
    SET IDENTITY_INSERT dbo.Dim_Servicio OFF;
END;
GO

-- 2.4 Dim_Canal (KeyCanal = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Canal WHERE KeyCanal = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Canal ON;
    INSERT INTO dbo.Dim_Canal (KeyCanal, id_canal, NombreCanal, TipoMedio)
    VALUES (0, 0, 'Canal Desconocido', 'No Especificado');
    SET IDENTITY_INSERT dbo.Dim_Canal OFF;
END;
GO

-- 2.5 Dim_Fuente (KeyFuente = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Fuente WHERE KeyFuente = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Fuente ON;
    INSERT INTO dbo.Dim_Fuente (KeyFuente, id_fuente, id_campana, TipoOrigen, Campana)
    VALUES (0, 0, 0, 'Fuente No Especificada', 'Sin Campaña');
    SET IDENTITY_INSERT dbo.Dim_Fuente OFF;
END;
GO

-- 2.6 Dim_EstadoRegistro (KeyEstadoRegistro = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_EstadoRegistro WHERE KeyEstadoRegistro = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_EstadoRegistro ON;
    INSERT INTO dbo.Dim_EstadoRegistro (KeyEstadoRegistro, EstadoCalidad, AutorizacionContacto)
    VALUES (0, 'Desconocido', 'NO');
    SET IDENTITY_INSERT dbo.Dim_EstadoRegistro OFF;
END;
GO

-- 2.7 Dim_Profesional (KeyProfesional = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Profesional WHERE KeyProfesional = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Profesional ON;
    INSERT INTO dbo.Dim_Profesional (KeyProfesional, id_profesional, Odontologo, EspecialidadPrincipal)
    VALUES (0, 0, 'Profesional No Asignado', 'No Especificada');
    SET IDENTITY_INSERT dbo.Dim_Profesional OFF;
END;
GO

-- 2.8 Dim_Negociador (KeyNegociador = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Negociador WHERE KeyNegociador = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Negociador ON;
    INSERT INTO dbo.Dim_Negociador (KeyNegociador, id_usuario, NombreNegociador)
    VALUES (0, 0, 'Negociador No Asignado');
    SET IDENTITY_INSERT dbo.Dim_Negociador OFF;
END;
GO

-- 2.9 Dim_Pasarela (KeyPasarela = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Pasarela WHERE KeyPasarela = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Pasarela ON;
    INSERT INTO dbo.Dim_Pasarela (KeyPasarela, MetodoPago, EntidadFinanciera, TipoMedio)
    VALUES (0, 'No Especificado', 'No Especificada', 'No Especificado');
    SET IDENTITY_INSERT dbo.Dim_Pasarela OFF;
END;
GO

-- 2.10 Dim_Cobro (KeyCobro = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Cobro WHERE KeyCobro = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Cobro ON;
    INSERT INTO dbo.Dim_Cobro (KeyCobro, EstadoPago, ComprobanteAdjunto)
    VALUES (0, 'NO DEFINIDO', 'NO');
    SET IDENTITY_INSERT dbo.Dim_Cobro OFF;
END;
GO

-- 2.11 Dim_EstadoAtencion (KeyEstadoAtencion = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_EstadoAtencion WHERE KeyEstadoAtencion = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_EstadoAtencion ON;
    INSERT INTO dbo.Dim_EstadoAtencion (KeyEstadoAtencion, EstadoFinal, Asistencia)
    VALUES (0, 'No Definido', 'No Definido');
    SET IDENTITY_INSERT dbo.Dim_EstadoAtencion OFF;
END;
GO

-- ====================================================================
-- 3. POBLAMIENTO Y HOMOLOGACIÓN DE DIMENSIONES (SCD TIPO 1)
-- ====================================================================

-- 3.1 Poblar Dim_Tiempo (Rango 2024 a 2030)
IF (SELECT COUNT(*) FROM [NexoSalud_Mart].dbo.[Dim_Tiempo] WHERE KeyTiempo > 0) = 0
BEGIN
    SET IDENTITY_INSERT [NexoSalud_Mart].dbo.[Dim_Tiempo] ON;

    DECLARE @StartDate DATE = '2024-01-01';
    DECLARE @EndDate DATE = '2030-12-31';

    WITH Fechas AS (
        SELECT @StartDate AS Fecha
        UNION ALL
        SELECT DATEADD(DAY, 1, Fecha)
        FROM Fechas
        WHERE DATEADD(DAY, 1, Fecha) <= @EndDate
    )
    INSERT INTO [NexoSalud_Mart].dbo.[Dim_Tiempo] (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
    SELECT 
        CAST(FORMAT(Fecha, 'yyyyMMdd') AS INT) AS KeyTiempo,
        Fecha AS id_fecha,
        YEAR(Fecha) AS Anio,
        DATEPART(QUARTER, Fecha) AS Trimestre,
        MONTH(Fecha) AS Mes,
        DAY(Fecha) AS Dia
    FROM Fechas
    OPTION (MAXRECURSION 0);

    SET IDENTITY_INSERT [NexoSalud_Mart].dbo.[Dim_Tiempo] OFF;
END;
GO

-- 3.2 Poblar Dim_Sede
MERGE [NexoSalud_Mart].dbo.[Dim_Sede] AS dim
USING (
    SELECT id_sede, nombre AS Sede, zona AS Distrito, zona AS Zona 
    FROM [NexoSaludDB].dbo.[Sedes]
) AS oltp
ON dim.id_sede = oltp.id_sede
WHEN MATCHED THEN
    UPDATE SET dim.Sede = oltp.Sede, dim.Distrito = oltp.Distrito, dim.Zona = oltp.Zona
WHEN NOT MATCHED THEN
    INSERT (id_sede, Sede, Distrito, Zona)
    VALUES (oltp.id_sede, oltp.Sede, oltp.Distrito, oltp.Zona);
GO

-- 3.3 Poblar Dim_Servicio
MERGE [NexoSalud_Mart].dbo.[Dim_Servicio] AS dim
USING (
    SELECT 
        id_servicio, 
        nombre AS ServicioOdontologico, 
        CASE 
            WHEN descripcion LIKE '%Preventiva%' THEN 'Odontología Preventiva'
            WHEN descripcion LIKE '%Especializada%' THEN 'Odontología Especializada'
            WHEN descripcion LIKE '%Restauradora%' THEN 'Odontología Restauradora'
            WHEN descripcion LIKE '%Estética%' THEN 'Odontología Estética'
            ELSE 'Odontología General'
        END AS Categoria, 
        nombre AS Procedimiento
    FROM [NexoSaludDB].dbo.[Servicios]
) AS oltp
ON dim.id_servicio = oltp.id_servicio
WHEN MATCHED THEN
    UPDATE SET dim.ServicioOdontologico = oltp.ServicioOdontologico, dim.Categoria = oltp.Categoria, dim.Procedimiento = oltp.Procedimiento
WHEN NOT MATCHED THEN
    INSERT (id_servicio, ServicioOdontologico, Categoria, Procedimiento)
    VALUES (oltp.id_servicio, oltp.ServicioOdontologico, oltp.Categoria, oltp.Procedimiento);
GO

-- 3.4 Poblar Dim_Canal
MERGE [NexoSalud_Mart].dbo.[Dim_Canal] AS dim
USING (
    SELECT id_canal, nombre AS NombreCanal, 'Digital' AS TipoMedio
    FROM [NexoSaludDB].dbo.[Canales]
) AS oltp
ON dim.id_canal = oltp.id_canal
WHEN MATCHED THEN
    UPDATE SET dim.NombreCanal = oltp.NombreCanal, dim.TipoMedio = oltp.TipoMedio
WHEN NOT MATCHED THEN
    INSERT (id_canal, NombreCanal, TipoMedio)
    VALUES (oltp.id_canal, oltp.NombreCanal, oltp.TipoMedio);
GO

-- 3.5 Poblar Dim_Fuente
MERGE [NexoSalud_Mart].dbo.[Dim_Fuente] AS dim
USING (
    SELECT 
        c.id_fuente,
        c.id_campana,
        f.nombre AS TipoOrigen,
        c.nombre AS Campana
    FROM [NexoSaludDB].dbo.[Campanas] c
    JOIN [NexoSaludDB].dbo.[Fuentes] f ON c.id_fuente = f.id_fuente
) AS oltp
ON dim.id_campana = oltp.id_campana
WHEN MATCHED THEN
    UPDATE SET dim.id_fuente = oltp.id_fuente, dim.TipoOrigen = oltp.TipoOrigen, dim.Campana = oltp.Campana
WHEN NOT MATCHED THEN
    INSERT (id_fuente, id_campana, TipoOrigen, Campana)
    VALUES (oltp.id_fuente, oltp.id_campana, oltp.TipoOrigen, oltp.Campana);
GO

-- 3.6 Poblar Dim_EstadoRegistro
MERGE [NexoSalud_Mart].dbo.[Dim_EstadoRegistro] AS dim
USING (
    SELECT 1 AS KeyEstadoRegistro, 'Válidos' AS EstadoCalidad, 'SI' AS AutorizacionContacto
    UNION ALL SELECT 2, 'Incompletos', 'NO'
    UNION ALL SELECT 3, 'Duplicados', 'NO'
    UNION ALL SELECT 4, 'Rechazados', 'NO'
) AS src
ON dim.KeyEstadoRegistro = src.KeyEstadoRegistro
WHEN MATCHED THEN
    UPDATE SET dim.EstadoCalidad = src.EstadoCalidad, dim.AutorizacionContacto = src.AutorizacionContacto
WHEN NOT MATCHED THEN
    INSERT (EstadoCalidad, AutorizacionContacto)
    VALUES (src.EstadoCalidad, src.AutorizacionContacto);
GO

-- 3.7 Poblar Dim_Profesional
MERGE [NexoSalud_Mart].dbo.[Dim_Profesional] AS dim
USING (
    SELECT id_profesional, CONCAT(nombres, ' ', apellidos) AS Odontologo, especialidad AS EspecialidadPrincipal
    FROM [NexoSaludDB].dbo.[Profesionales]
) AS oltp
ON dim.id_profesional = oltp.id_profesional
WHEN MATCHED THEN
    UPDATE SET dim.Odontologo = oltp.Odontologo, dim.EspecialidadPrincipal = oltp.EspecialidadPrincipal
WHEN NOT MATCHED THEN
    INSERT (id_profesional, Odontologo, EspecialidadPrincipal)
    VALUES (oltp.id_profesional, oltp.Odontologo, oltp.EspecialidadPrincipal);
GO

-- 3.8 Poblar Dim_Negociador
MERGE [NexoSalud_Mart].dbo.[Dim_Negociador] AS dim
USING (
    SELECT id_usuario, CONCAT(nombres, ' ', apellidos) AS NombreNegociador
    FROM [NexoSaludDB].dbo.[Usuarios]
) AS oltp
ON dim.id_usuario = oltp.id_usuario
WHEN MATCHED THEN
    UPDATE SET dim.NombreNegociador = oltp.NombreNegociador
WHEN NOT MATCHED THEN
    INSERT (id_usuario, NombreNegociador)
    VALUES (oltp.id_usuario, oltp.NombreNegociador);
GO

-- 3.9 Poblar Dim_Pasarela
MERGE [NexoSalud_Mart].dbo.[Dim_Pasarela] AS dim
USING (
    SELECT DISTINCT 
        canal_pago AS MetodoPago,
        CASE 
            WHEN canal_pago = 'Yape' THEN 'BCP'
            WHEN canal_pago = 'Plin' THEN 'Interbank/BBVA'
            WHEN canal_pago = 'Transferencia' THEN 'Interbancaria'
            ELSE 'Niubiz/Culqi'
        END AS EntidadFinanciera,
        CASE 
            WHEN canal_pago IN ('Yape', 'Plin') THEN 'Billeteras Digitales'
            ELSE 'Bancarizado'
        END AS TipoMedio
    FROM [NexoSaludDB].dbo.[Pagos]
    WHERE canal_pago IS NOT NULL
) AS oltp
ON dim.MetodoPago = oltp.MetodoPago
WHEN MATCHED THEN
    UPDATE SET dim.EntidadFinanciera = oltp.EntidadFinanciera, dim.TipoMedio = oltp.TipoMedio
WHEN NOT MATCHED THEN
    INSERT (MetodoPago, EntidadFinanciera, TipoMedio)
    VALUES (oltp.MetodoPago, oltp.EntidadFinanciera, oltp.TipoMedio);
GO

-- 3.10 Poblar Dim_Cobro
MERGE [NexoSalud_Mart].dbo.[Dim_Cobro] AS dim
USING (
    SELECT 1 AS KeyCobro, 'VALIDATED' AS EstadoPago, 'SI' AS ComprobanteAdjunto
    UNION ALL SELECT 2, 'PENDING', 'NO'
    UNION ALL SELECT 3, 'REJECTED', 'NO'
    UNION ALL SELECT 4, 'Confirmado', 'SI'
    UNION ALL SELECT 5, 'Pendiente', 'NO'
    UNION ALL SELECT 6, 'Fallido', 'NO'
) AS src
ON dim.KeyCobro = src.KeyCobro
WHEN MATCHED THEN
    UPDATE SET dim.EstadoPago = src.EstadoPago, dim.ComprobanteAdjunto = src.ComprobanteAdjunto
WHEN NOT MATCHED THEN
    INSERT (EstadoPago, ComprobanteAdjunto)
    VALUES (src.EstadoPago, src.ComprobanteAdjunto);
GO

-- 3.11 Poblar Dim_EstadoAtencion
MERGE [NexoSalud_Mart].dbo.[Dim_EstadoAtencion] AS dim
USING (
    SELECT 1 AS KeyEstadoAtencion, 'Atendidos' AS EstadoFinal, 'Asistio' AS Asistencia
    UNION ALL SELECT 2, 'No Asistio (No-Show)', 'No asistio'
    UNION ALL SELECT 3, 'Cancelados', 'Cancelado'
) AS src
ON dim.KeyEstadoAtencion = src.KeyEstadoAtencion
WHEN MATCHED THEN
    UPDATE SET dim.EstadoFinal = src.EstadoFinal, dim.Asistencia = src.Asistencia
WHEN NOT MATCHED THEN
    INSERT (EstadoFinal, Asistencia)
    VALUES (src.EstadoFinal, src.Asistencia);
GO

-- ====================================================================
-- 4. ÍNDICES DE UNICIDAD FÍSICA PARA GARANTÍA DE IDEMPOTENCIA
-- ====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactCaptacionBuyer_Grain' AND object_id = OBJECT_ID('Fact_CaptacionBuyer'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactCaptacionBuyer_Grain 
    ON Fact_CaptacionBuyer (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactNegociacionLead_Grain' AND object_id = OBJECT_ID('Fact_NegociacionLead'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactNegociacionLead_Grain 
    ON Fact_NegociacionLead (KeyTiempo, KeySede, KeyNegociador, KeyServicio, KeyProfesional);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactGestionPayer_Grain' AND object_id = OBJECT_ID('Fact_GestionPayer'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactGestionPayer_Grain 
    ON Fact_GestionPayer (KeyTiempo, KeyPasarela, KeyCobro);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactAtencionCustomer_Grain' AND object_id = OBJECT_ID('Fact_AtencionCustomer'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactAtencionCustomer_Grain 
    ON Fact_AtencionCustomer (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactSeguimientoTurned_Grain' AND object_id = OBJECT_ID('Fact_SeguimientoTurned'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactSeguimientoTurned_Grain 
    ON Fact_SeguimientoTurned (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal);
GO

-- ====================================================================
-- 5. CARGA INCREMENTAL E IDEMPOTENTE DE HECHOS (TRANSACCIÓN ATÓMICA)
-- Se eliminaron las sentencias destructivas DELETE FROM Fact_*.
-- Cada hecho se actualiza o inserta mediante MERGE sobre su grano único.
-- ====================================================================

DECLARE @BatchId VARCHAR(50) = CONCAT('BATCH_', FORMAT(SYSDATETIME(), 'yyyyMMdd_HHmmss'));
DECLARE @StartTime DATETIME2(7) = SYSDATETIME();
DECLARE @RowsBuyer INT = 0, @RowsLead INT = 0, @RowsPayer INT = 0, @RowsCustomer INT = 0, @RowsTurned INT = 0;

INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, FechaRegistro)
VALUES (@BatchId, 'ETL_Hechos_NexoSalud', 'INICIO', N'Iniciando ciclo ETL transaccional idempotente en NexoSalud_Mart.', @StartTime);

BEGIN TRY
    BEGIN TRANSACTION;

    -- ----------------------------------------------------------------
    -- 5.1 Carga Idempotente: Fact_CaptacionBuyer
    -- Mapeo de sede: zona de residencia homologada a Sede (1=Centro, 2=California, 3=El Golf).
    -- Deduplicación de etapas para evitar producto cartesiano (fan-out).
    -- ----------------------------------------------------------------
    ;WITH EventosEtapa2Unico AS (
        SELECT id_persona, MIN(fecha_hora) AS fecha_hora_etapa2
        FROM [NexoSaludDB].dbo.[EventosEtapa]
        WHERE etapa_destino = 2
        GROUP BY id_persona
    ),
    BuyerSource AS (
        SELECT 
            CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT) AS KeyTiempo,
            ISNULL(ds.KeySede, 0) AS KeySede,
            ISNULL(dc.KeyCanal, 0) AS KeyCanal,
            ISNULL(df.KeyFuente, 0) AS KeyFuente,
            ISNULL(der.KeyEstadoRegistro, 0) AS KeyEstadoRegistro,
            COUNT(p.id_persona) AS ContactosRegistrados,
            SUM(CASE WHEN p.estado_calidad LIKE '%Valid%' THEN 1 ELSE 0 END) AS ContactosUtilizables,
            SUM(CASE WHEN p.id_etapa_actual >= 2 THEN 1 ELSE 0 END) AS ConversionesALead, 
            AVG(CASE 
                WHEN ev.fecha_hora_etapa2 >= p.fecha_registro 
                THEN DATEDIFF(DAY, p.fecha_registro, ev.fecha_hora_etapa2) 
                ELSE 0 
            END) AS TiempoConversionDias
        FROM [NexoSaludDB].dbo.[Personas] p
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Sede] ds ON (
            ds.id_sede = CASE 
                WHEN p.zona IN ('Centro Histórico', 'Centro Historico', 'El Recreo', 'Florencia de Mora', 'La Esperanza', 'Moche', 'San Andrés', 'San Andres') THEN 1
                WHEN p.zona IN ('California', 'Víctor Larco Herrera', 'Victor Larco Herrera', 'Huanchaco') THEN 2
                WHEN p.zona IN ('El Golf') THEN 3
                ELSE 0
            END
        )
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Canal] dc ON p.id_canal_origen = dc.id_canal
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Fuente] df ON p.id_campana_origen = df.id_campana
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_EstadoRegistro] der ON (
            (p.estado_calidad LIKE '%Valid%' AND der.KeyEstadoRegistro = 1) OR
            (p.estado_calidad LIKE '%Incomplet%' AND der.KeyEstadoRegistro = 2) OR
            (p.estado_calidad LIKE '%Duplicad%' AND der.KeyEstadoRegistro = 3) OR
            (p.estado_calidad LIKE '%Rechazad%' AND der.KeyEstadoRegistro = 4)
        )
        LEFT JOIN EventosEtapa2Unico ev ON p.id_persona = ev.id_persona
        GROUP BY 
            CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT),
            ISNULL(ds.KeySede, 0),
            ISNULL(dc.KeyCanal, 0),
            ISNULL(df.KeyFuente, 0),
            ISNULL(der.KeyEstadoRegistro, 0)
    )
    MERGE [NexoSalud_Mart].dbo.[Fact_CaptacionBuyer] AS fact
    USING BuyerSource AS src
    ON fact.KeyTiempo = src.KeyTiempo 
       AND fact.KeySede = src.KeySede
       AND fact.KeyCanal = src.KeyCanal 
       AND fact.KeyFuente = src.KeyFuente 
       AND fact.KeyEstadoRegistro = src.KeyEstadoRegistro
    WHEN MATCHED THEN
        UPDATE SET 
            fact.ContactosRegistrados = src.ContactosRegistrados,
            fact.ContactosUtilizables = src.ContactosUtilizables,
            fact.ConversionesALead = src.ConversionesALead,
            fact.TiempoConversionDias = src.TiempoConversionDias
    WHEN NOT MATCHED THEN
        INSERT (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro, ContactosRegistrados, ContactosUtilizables, ConversionesALead, TiempoConversionDias)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyCanal, src.KeyFuente, src.KeyEstadoRegistro, src.ContactosRegistrados, src.ContactosUtilizables, src.ConversionesALead, src.TiempoConversionDias);

    SET @RowsBuyer = @@ROWCOUNT;

    -- ----------------------------------------------------------------
    -- 5.2 Carga Idempotente: Fact_NegociacionLead
    -- Resolución de profesional y sede por turno/solicitud (no hardcodeada).
    -- Deduplicación de múltiples solicitudes por lead.
    -- ----------------------------------------------------------------
    ;WITH LeadEvents AS (
        SELECT 
            ev.id_persona,
            ev.id_usuario,
            ev.fecha_hora,
            ROW_NUMBER() OVER (PARTITION BY ev.id_persona ORDER BY ev.fecha_hora ASC) AS rn
        FROM [NexoSaludDB].dbo.[EventosEtapa] ev
        WHERE ev.etapa_destino = 2
    ),
    LeadSource AS (
        SELECT 
            CAST(FORMAT(ev.fecha_hora, 'yyyyMMdd') AS INT) AS KeyTiempo,
            ISNULL(ds.KeySede, 0) AS KeySede,
            ISNULL(dserv.KeyServicio, 0) AS KeyServicio,
            ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
            ISNULL(dn.KeyNegociador, 0) AS KeyNegociador,
            COUNT(DISTINCT ev.id_persona) AS LeadsCohorteEvaluable,
            SUM(CASE WHEN p.id_etapa_actual >= 3 THEN 1 ELSE 0 END) AS LeadsConvertidosPayer14Dias,
            SUM(CASE WHEN p.id_etapa_actual = 2 AND sol.estado IN ('En Negociacion', 'En negociación') THEN 1 ELSE 0 END) AS LeadsEnNegociacion,
            SUM(CASE WHEN sol.estado = 'Abandonada' OR p.id_etapa_actual < 2 THEN 1 ELSE 0 END) AS LeadsAbandonados,
            COUNT(DISTINCT ev.id_persona) AS LeadsRequierenRespuesta,
            SUM(CASE 
                WHEN sol.fecha_primera_respuesta IS NOT NULL 
                     AND sol.fecha_primera_respuesta >= sol.fecha_solicitud
                     AND DATEDIFF(MINUTE, sol.fecha_solicitud, sol.fecha_primera_respuesta) <= 15 
                THEN 1 ELSE 0 
            END) AS LeadsRespuestaUtil15Min,
            SUM(CASE WHEN p.id_etapa_actual >= 3 OR sol.estado = 'Abandonada' THEN 1 ELSE 0 END) AS LeadsResultadoFinal
        FROM LeadEvents ev
        JOIN [NexoSaludDB].dbo.[Personas] p ON ev.id_persona = p.id_persona AND ev.rn = 1
        OUTER APPLY (
            SELECT TOP 1 s.id_solicitud, s.id_servicio, s.estado, s.fecha_solicitud, s.fecha_primera_respuesta
            FROM [NexoSaludDB].dbo.[Solicitudes] s
            WHERE s.id_persona = p.id_persona
            ORDER BY s.fecha_solicitud DESC
        ) sol
        OUTER APPLY (
            SELECT TOP 1 d.id_sede, d.id_profesional
            FROM [NexoSaludDB].dbo.[Opciones] o
            JOIN [NexoSaludDB].dbo.[Disponibilidad] d ON o.id_disponibilidad = d.id_disponibilidad
            WHERE o.id_solicitud = sol.id_solicitud
            ORDER BY o.seleccionada DESC, o.id_opcion ASC
        ) disp
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Negociador] dn ON dn.id_usuario = ev.id_usuario
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Servicio] dserv ON dserv.id_servicio = sol.id_servicio
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Profesional] dp ON dp.id_profesional = disp.id_profesional
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Sede] ds ON ds.id_sede = COALESCE(
            disp.id_sede,
            CASE 
                WHEN p.zona IN ('Centro Histórico', 'Centro Historico', 'El Recreo', 'Florencia de Mora', 'La Esperanza', 'Moche', 'San Andrés', 'San Andres') THEN 1
                WHEN p.zona IN ('California', 'Víctor Larco Herrera', 'Victor Larco Herrera', 'Huanchaco') THEN 2
                WHEN p.zona IN ('El Golf') THEN 3
                ELSE 0
            END
        )
        GROUP BY 
            CAST(FORMAT(ev.fecha_hora, 'yyyyMMdd') AS INT), 
            ISNULL(ds.KeySede, 0),
            dserv.KeyServicio,
            dp.KeyProfesional,
            dn.KeyNegociador
    )
    MERGE [NexoSalud_Mart].dbo.[Fact_NegociacionLead] AS fact
    USING LeadSource AS src
    ON fact.KeyTiempo = src.KeyTiempo 
       AND fact.KeySede = src.KeySede 
       AND fact.KeyNegociador = src.KeyNegociador
       AND fact.KeyServicio = src.KeyServicio
       AND fact.KeyProfesional = src.KeyProfesional
    WHEN MATCHED THEN
        UPDATE SET 
            fact.LeadsCohorteEvaluable = src.LeadsCohorteEvaluable,
            fact.LeadsConvertidosPayer14Dias = src.LeadsConvertidosPayer14Dias,
            fact.LeadsEnNegociacion = src.LeadsEnNegociacion,
            fact.LeadsAbandonados = src.LeadsAbandonados,
            fact.LeadsRequierenRespuesta = src.LeadsRequierenRespuesta,
            fact.LeadsRespuestaUtil15Min = src.LeadsRespuestaUtil15Min,
            fact.LeadsResultadoFinal = src.LeadsResultadoFinal
    WHEN NOT MATCHED THEN
        INSERT (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador, LeadsCohorteEvaluable, LeadsConvertidosPayer14Dias, LeadsEnNegociacion, LeadsAbandonados, LeadsRequierenRespuesta, LeadsRespuestaUtil15Min, LeadsResultadoFinal)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyNegociador, src.LeadsCohorteEvaluable, src.LeadsConvertidosPayer14Dias, src.LeadsEnNegociacion, src.LeadsAbandonados, src.LeadsRequierenRespuesta, src.LeadsRespuestaUtil15Min, src.LeadsResultadoFinal);

    SET @RowsLead = @@ROWCOUNT;

    -- ----------------------------------------------------------------
    -- 5.3 Carga Idempotente: Fact_GestionPayer
    -- Sanitización de tiempos (sin minutos negativos) y resolución canónica de KeyCobro.
    -- ----------------------------------------------------------------
    ;WITH PayerSource AS (
        SELECT 
            CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT) AS KeyTiempo,
            ISNULL(dp.KeyPasarela, 0) AS KeyPasarela,
            CASE 
                WHEN p.estado IN ('Confirmado', 'Validado', 'VALIDATED', 'VALIDADO') THEN 1
                WHEN p.estado IN ('Pendiente', 'PENDING') THEN 2
                WHEN p.estado IN ('Fallido', 'Rechazado', 'REJECTED') THEN 3
                ELSE 0
            END AS KeyCobro,
            COUNT(p.id_pago) AS PagosRegistrados,
            SUM(CASE WHEN p.estado IN ('Validado', 'VALIDADO', 'Confirmado', 'VALIDATED') THEN 1 ELSE 0 END) AS PagosValidados,
            SUM(CASE WHEN p.estado IN ('Rechazado', 'REJECTED', 'Fallido') THEN 1 ELSE 0 END) AS PagosRechazados,
            SUM(p.importe) AS ImporteTotalCobro,
            SUM(CASE 
                WHEN p.fecha_validacion IS NOT NULL AND p.fecha_validacion >= p.fecha_registro 
                THEN DATEDIFF(MINUTE, p.fecha_registro, p.fecha_validacion)
                ELSE 0 
            END) AS TiempoTotalValidacionMin
        FROM [NexoSaludDB].dbo.[Pagos] p
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Pasarela] dp ON dp.MetodoPago = p.canal_pago
        GROUP BY 
            CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT),
            ISNULL(dp.KeyPasarela, 0),
            CASE 
                WHEN p.estado IN ('Confirmado', 'Validado', 'VALIDATED', 'VALIDADO') THEN 1
                WHEN p.estado IN ('Pendiente', 'PENDING') THEN 2
                WHEN p.estado IN ('Fallido', 'Rechazado', 'REJECTED') THEN 3
                ELSE 0
            END
    )
    MERGE [NexoSalud_Mart].dbo.[Fact_GestionPayer] AS fact
    USING PayerSource AS src
    ON fact.KeyTiempo = src.KeyTiempo 
       AND fact.KeyPasarela = src.KeyPasarela 
       AND fact.KeyCobro = src.KeyCobro
    WHEN MATCHED THEN
        UPDATE SET 
            fact.PagosRegistrados = src.PagosRegistrados,
            fact.PagosValidados = src.PagosValidados,
            fact.PagosRechazados = src.PagosRechazados,
            fact.ImporteTotalCobro = src.ImporteTotalCobro,
            fact.TiempoTotalValidacionMin = src.TiempoTotalValidacionMin
    WHEN NOT MATCHED THEN
        INSERT (KeyTiempo, KeyPasarela, KeyCobro, PagosRegistrados, PagosValidados, PagosRechazados, ImporteTotalCobro, TiempoTotalValidacionMin)
        VALUES (src.KeyTiempo, src.KeyPasarela, src.KeyCobro, src.PagosRegistrados, src.PagosValidados, src.PagosRechazados, src.ImporteTotalCobro, src.TiempoTotalValidacionMin);

    SET @RowsPayer = @@ROWCOUNT;

    -- ----------------------------------------------------------------
    -- 5.4 Carga Idempotente: Fact_AtencionCustomer
    -- Captura atenciones realizadas y no-shows con verificación temporal y de acentos.
    -- ----------------------------------------------------------------
    ;WITH CustomerSource AS (
        SELECT 
            CAST(FORMAT(a.fecha_atencion, 'yyyyMMdd') AS INT) AS KeyTiempo,
            ISNULL(ds.KeySede, 0) AS KeySede,
            ISNULL(dserv.KeyServicio, 0) AS KeyServicio,
            ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
            CASE 
                WHEN a.asistencia LIKE '%Asisti%' AND a.asistencia NOT LIKE '%No%' THEN 1
                WHEN a.asistencia LIKE '%No%asisti%' THEN 2
                WHEN a.asistencia LIKE '%Cancelad%' THEN 3
                ELSE 0
            END AS KeyEstadoAtencion,
            COUNT(a.id_atencion) AS CitasEvaluables,
            SUM(CASE WHEN a.asistencia LIKE '%Asisti%' AND a.asistencia NOT LIKE '%No%' THEN 1 ELSE 0 END) AS AtencionesRealizadas,
            SUM(CASE WHEN a.asistencia LIKE '%No%asisti%' THEN 1 ELSE 0 END) AS CitasConInasistencia,
            SUM(CASE 
                WHEN a.fecha_fin IS NOT NULL AND a.fecha_inicio IS NOT NULL AND a.fecha_fin >= a.fecha_inicio
                THEN DATEDIFF(MINUTE, a.fecha_inicio, a.fecha_fin)
                WHEN a.fecha_inicio IS NOT NULL
                THEN 30
                ELSE 0
            END) AS TiempoEnSillonDentalMin,
            SUM(CASE WHEN NULLIF(LTRIM(RTRIM(a.procedimiento_realizado)), '') IS NOT NULL 
                          AND NULLIF(LTRIM(RTRIM(a.indicaciones_finales)), '') IS NOT NULL 
                     THEN 1 ELSE 0 END) AS AtencionesFinalizadasConformes
        FROM [NexoSaludDB].dbo.[Atenciones] a
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Sede] ds ON a.id_sede = ds.id_sede
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Servicio] dserv ON a.id_servicio = dserv.id_servicio
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Profesional] dp ON a.id_profesional = dp.id_profesional
        GROUP BY 
            CAST(FORMAT(a.fecha_atencion, 'yyyyMMdd') AS INT),
            ISNULL(ds.KeySede, 0),
            ISNULL(dserv.KeyServicio, 0),
            ISNULL(dp.KeyProfesional, 0),
            CASE 
                WHEN a.asistencia LIKE '%Asisti%' AND a.asistencia NOT LIKE '%No%' THEN 1
                WHEN a.asistencia LIKE '%No%asisti%' THEN 2
                WHEN a.asistencia LIKE '%Cancelad%' THEN 3
                ELSE 0
            END
    )
    MERGE [NexoSalud_Mart].dbo.[Fact_AtencionCustomer] AS fact
    USING CustomerSource AS src
    ON fact.KeyTiempo = src.KeyTiempo 
       AND fact.KeySede = src.KeySede 
       AND fact.KeyServicio = src.KeyServicio 
       AND fact.KeyProfesional = src.KeyProfesional
       AND fact.KeyEstadoAtencion = src.KeyEstadoAtencion
    WHEN MATCHED THEN
        UPDATE SET 
            fact.CitasEvaluables = src.CitasEvaluables,
            fact.AtencionesRealizadas = src.AtencionesRealizadas,
            fact.CitasConInasistencia = src.CitasConInasistencia,
            fact.TiempoEnSillonDentalMin = src.TiempoEnSillonDentalMin,
            fact.AtencionesFinalizadasConformes = src.AtencionesFinalizadasConformes
    WHEN NOT MATCHED THEN
        INSERT (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion, CitasEvaluables, AtencionesRealizadas, CitasConInasistencia, TiempoEnSillonDentalMin, AtencionesFinalizadasConformes)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyEstadoAtencion, src.CitasEvaluables, src.AtencionesRealizadas, src.CitasConInasistencia, src.TiempoEnSillonDentalMin, src.AtencionesFinalizadasConformes);

    SET @RowsCustomer = @@ROWCOUNT;

    -- ----------------------------------------------------------------
    -- 5.5 Carga Idempotente: Fact_SeguimientoTurned
    -- Sustitución de 's.id_seguimiento % 3 = 0' por verificación real de retorno clínico a 90 días.
    -- Transformación de INSERT ciego a MERGE idempotente.
    -- ----------------------------------------------------------------
    IF OBJECT_ID('dbo.Fact_SeguimientoTurned', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Fact_SeguimientoTurned (
            KeyTiempo INT FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
            KeySede INT FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
            KeyServicio INT FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
            KeyProfesional INT FOREIGN KEY REFERENCES dbo.Dim_Profesional(KeyProfesional),
            KeyCanal INT FOREIGN KEY REFERENCES dbo.Dim_Canal(KeyCanal),
            SeguimientosRegistrados INT DEFAULT 0,
            SeguimientosEfectivos INT DEFAULT 0,
            IncidenciasReportadas INT DEFAULT 0,
            IncidenciasResueltas24h INT DEFAULT 0,
            RetornosCohorte90Dias INT DEFAULT 0,
            PacientesElegiblesRetorno INT DEFAULT 0
        );
        CREATE UNIQUE NONCLUSTERED INDEX UQ_FactSeguimientoTurned_Grain 
        ON Fact_SeguimientoTurned (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal);
    END;

    ;WITH TurnedSource AS (
        SELECT 
            CAST(FORMAT(s.fecha_hora, 'yyyyMMdd') AS INT) AS KeyTiempo,
            ISNULL(ds.KeySede, 0) AS KeySede,
            ISNULL(dserv.KeyServicio, 0) AS KeyServicio,
            ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
            ISNULL(dc.KeyCanal, 0) AS KeyCanal,
            COUNT(s.id_seguimiento) AS SeguimientosRegistrados,
            SUM(CASE WHEN s.satisfaccion IS NOT NULL OR s.resultado IS NOT NULL THEN 1 ELSE 0 END) AS SeguimientosEfectivos,
            SUM(CASE WHEN s.incidencia = 1 OR s.satisfaccion <= 2 THEN 1 ELSE 0 END) AS IncidenciasReportadas,
            SUM(CASE WHEN s.incidencia = 1 THEN 1 ELSE 0 END) AS IncidenciasResueltas24h,
            SUM(CASE WHEN ret90.tiene_retorno_90d = 1 THEN 1 ELSE 0 END) AS RetornosCohorte90Dias,
            COUNT(DISTINCT s.id_persona) AS PacientesElegiblesRetorno
        FROM [NexoSaludDB].dbo.[Seguimientos] s
        LEFT JOIN [NexoSaludDB].dbo.[Atenciones] a ON s.id_atencion = a.id_atencion
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Sede] ds ON a.id_sede = ds.id_sede
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Servicio] dserv ON a.id_servicio = dserv.id_servicio
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Profesional] dp ON a.id_profesional = dp.id_profesional
        LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Canal] dc ON s.canal = dc.NombreCanal
        OUTER APPLY (
            SELECT TOP 1 1 AS tiene_retorno_90d
            FROM [NexoSaludDB].dbo.[Atenciones] a2 
            WHERE a2.id_persona = s.id_persona 
              AND a2.fecha_atencion > s.fecha_hora 
              AND a2.fecha_atencion <= DATEADD(DAY, 90, s.fecha_hora)
        ) ret90
        GROUP BY 
            CAST(FORMAT(s.fecha_hora, 'yyyyMMdd') AS INT),
            ISNULL(ds.KeySede, 0),
            ISNULL(dserv.KeyServicio, 0),
            ISNULL(dp.KeyProfesional, 0),
            ISNULL(dc.KeyCanal, 0)
    )
    MERGE [NexoSalud_Mart].dbo.[Fact_SeguimientoTurned] AS fact
    USING TurnedSource AS src
    ON fact.KeyTiempo = src.KeyTiempo
       AND fact.KeySede = src.KeySede
       AND fact.KeyServicio = src.KeyServicio
       AND fact.KeyProfesional = src.KeyProfesional
       AND fact.KeyCanal = src.KeyCanal
    WHEN MATCHED THEN
        UPDATE SET 
            fact.SeguimientosRegistrados = src.SeguimientosRegistrados,
            fact.SeguimientosEfectivos = src.SeguimientosEfectivos,
            fact.IncidenciasReportadas = src.IncidenciasReportadas,
            fact.IncidenciasResueltas24h = src.IncidenciasResueltas24h,
            fact.RetornosCohorte90Dias = src.RetornosCohorte90Dias,
            fact.PacientesElegiblesRetorno = src.PacientesElegiblesRetorno
    WHEN NOT MATCHED THEN
        INSERT (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal, SeguimientosRegistrados, SeguimientosEfectivos, IncidenciasReportadas, IncidenciasResueltas24h, RetornosCohorte90Dias, PacientesElegiblesRetorno)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyCanal, src.SeguimientosRegistrados, src.SeguimientosEfectivos, src.IncidenciasReportadas, src.IncidenciasResueltas24h, src.RetornosCohorte90Dias, src.PacientesElegiblesRetorno);

    SET @RowsTurned = @@ROWCOUNT;

    COMMIT TRANSACTION;

    DECLARE @EndTime DATETIME2(7) = SYSDATETIME();
    DECLARE @DurationSeconds DECIMAL(10,2) = DATEDIFF(MILLISECOND, @StartTime, @EndTime) / 1000.0;
    DECLARE @TotalRows INT = @RowsBuyer + @RowsLead + @RowsPayer + @RowsCustomer + @RowsTurned;

    INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, FilasAfectadas, DuracionSegundos, FechaRegistro)
    VALUES (
        @BatchId, 
        'ETL_Hechos_NexoSalud', 
        'EXITO', 
        CONCAT(N'Carga completada exitosamente. Buyer: ', @RowsBuyer, N', Lead: ', @RowsLead, N', Payer: ', @RowsPayer, N', Customer: ', @RowsCustomer, N', Turned: ', @RowsTurned),
        @TotalRows, 
        @DurationSeconds, 
        @EndTime
    );

    PRINT CONCAT('>> ETL ejecutado con éxito en ', @DurationSeconds, ' segundos. Filas afectadas: ', @TotalRows);

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    DECLARE @ErrorMsg NVARCHAR(MAX) = ERROR_MESSAGE();
    DECLARE @ErrorLine INT = ERROR_LINE();

    INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, FechaRegistro)
    VALUES (@BatchId, 'ETL_Hechos_NexoSalud', 'ERROR', CONCAT(N'Error en línea ', @ErrorLine, N': ', @ErrorMsg), SYSDATETIME());

    THROW;
END CATCH;
GO
