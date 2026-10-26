-- ====================================================================
-- NEXOSALUD — DATA MART DIMENSIONAL (CLÍNICA LUXEDENT, TRUJILLO)
-- PROCESO ETL INCREMENTAL BASADO EN UPDATE + INSERT (WHERE NOT EXISTS)
-- Motor: Microsoft SQL Server 2019 / 2022
-- Esquemas: [NexoSaludDB] (OLTP) -> [NexoSalud_Mart] (Data Mart)
-- Estrategia: Actualización in-place, inserción explícita sin duplicados
-- y reconciliación selectiva de agregados obsoletos sin borrado global.
-- ====================================================================

USE NexoSalud_Mart;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
SET XACT_ABORT ON;
GO

-- ====================================================================
-- 0. GARANTIA DE COMPATIBILIDAD DE ESQUEMA EN [NexoSaludDB]
-- Asegurar columnas clinicas en Atenciones si la tabla fue creada previamente
-- ====================================================================
IF COL_LENGTH('[NexoSaludDB].dbo.[Atenciones]', 'fecha_inicio') IS NULL
    ALTER TABLE [NexoSaludDB].dbo.[Atenciones] ADD [fecha_inicio] DATETIME2 NULL;
GO
IF COL_LENGTH('[NexoSaludDB].dbo.[Atenciones]', 'fecha_fin') IS NULL
    ALTER TABLE [NexoSaludDB].dbo.[Atenciones] ADD [fecha_fin] DATETIME2 NULL;
GO
IF COL_LENGTH('[NexoSaludDB].dbo.[Atenciones]', 'motivo_consulta') IS NULL
    ALTER TABLE [NexoSaludDB].dbo.[Atenciones] ADD [motivo_consulta] VARCHAR(300) NULL;
GO
IF COL_LENGTH('[NexoSaludDB].dbo.[Atenciones]', 'antecedentes') IS NULL
    ALTER TABLE [NexoSaludDB].dbo.[Atenciones] ADD [antecedentes] VARCHAR(500) NULL;
GO
IF COL_LENGTH('[NexoSaludDB].dbo.[Atenciones]', 'alergias') IS NULL
    ALTER TABLE [NexoSaludDB].dbo.[Atenciones] ADD [alergias] VARCHAR(300) NULL;
GO
IF COL_LENGTH('[NexoSaludDB].dbo.[Atenciones]', 'evaluacion') IS NULL
    ALTER TABLE [NexoSaludDB].dbo.[Atenciones] ADD [evaluacion] VARCHAR(500) NULL;
GO
IF COL_LENGTH('[NexoSaludDB].dbo.[Atenciones]', 'procedimiento') IS NULL
    ALTER TABLE [NexoSaludDB].dbo.[Atenciones] ADD [procedimiento] VARCHAR(500) NULL;
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
-- 3. HOMOLOGACIÓN DE DIMENSIONES (SCD TIPO 1)
-- ====================================================================

-- 3.1 Poblar Dim_Tiempo
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

-- 3.2 Homologación Dim_Sede
UPDATE dim
SET dim.Sede = oltp.Sede, dim.Distrito = oltp.Distrito, dim.Zona = oltp.Zona
FROM [NexoSalud_Mart].dbo.[Dim_Sede] dim
JOIN (
    SELECT id_sede, nombre AS Sede, zona AS Distrito, zona AS Zona 
    FROM [NexoSaludDB].dbo.[Sedes]
) oltp ON dim.id_sede = oltp.id_sede;

INSERT INTO [NexoSalud_Mart].dbo.[Dim_Sede] (id_sede, Sede, Distrito, Zona)
SELECT oltp.id_sede, oltp.Sede, oltp.Distrito, oltp.Zona
FROM (
    SELECT id_sede, nombre AS Sede, zona AS Distrito, zona AS Zona 
    FROM [NexoSaludDB].dbo.[Sedes]
) oltp
WHERE NOT EXISTS (
    SELECT 1 FROM [NexoSalud_Mart].dbo.[Dim_Sede] dim WHERE dim.id_sede = oltp.id_sede
);
GO

-- 3.3 Homologación Dim_Servicio
UPDATE dim
SET dim.ServicioOdontologico = oltp.ServicioOdontologico, dim.Categoria = oltp.Categoria, dim.Procedimiento = oltp.Procedimiento
FROM [NexoSalud_Mart].dbo.[Dim_Servicio] dim
JOIN (
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
) oltp ON dim.id_servicio = oltp.id_servicio;

INSERT INTO [NexoSalud_Mart].dbo.[Dim_Servicio] (id_servicio, ServicioOdontologico, Categoria, Procedimiento)
SELECT oltp.id_servicio, oltp.ServicioOdontologico, oltp.Categoria, oltp.Procedimiento
FROM (
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
) oltp
WHERE NOT EXISTS (
    SELECT 1 FROM [NexoSalud_Mart].dbo.[Dim_Servicio] dim WHERE dim.id_servicio = oltp.id_servicio
);
GO

-- 3.4 Homologación Dim_Canal
UPDATE dim
SET dim.NombreCanal = oltp.NombreCanal, dim.TipoMedio = oltp.TipoMedio
FROM [NexoSalud_Mart].dbo.[Dim_Canal] dim
JOIN (
    SELECT id_canal, nombre AS NombreCanal, 'Digital' AS TipoMedio
    FROM [NexoSaludDB].dbo.[Canales]
) oltp ON dim.id_canal = oltp.id_canal;

INSERT INTO [NexoSalud_Mart].dbo.[Dim_Canal] (id_canal, NombreCanal, TipoMedio)
SELECT oltp.id_canal, oltp.NombreCanal, oltp.TipoMedio
FROM (
    SELECT id_canal, nombre AS NombreCanal, 'Digital' AS TipoMedio
    FROM [NexoSaludDB].dbo.[Canales]
) oltp
WHERE NOT EXISTS (
    SELECT 1 FROM [NexoSalud_Mart].dbo.[Dim_Canal] dim WHERE dim.id_canal = oltp.id_canal
);
GO

-- 3.5 Homologación Dim_Fuente
UPDATE dim
SET dim.TipoOrigen = oltp.TipoOrigen, dim.Campana = oltp.Campana
FROM [NexoSalud_Mart].dbo.[Dim_Fuente] dim
JOIN (
    SELECT 
        c.id_fuente,
        c.id_campana,
        f.nombre AS TipoOrigen,
        c.nombre AS Campana
    FROM [NexoSaludDB].dbo.[Campanas] c
    JOIN [NexoSaludDB].dbo.[Fuentes] f ON c.id_fuente = f.id_fuente
) oltp ON dim.id_campana = oltp.id_campana;

INSERT INTO [NexoSalud_Mart].dbo.[Dim_Fuente] (id_fuente, id_campana, TipoOrigen, Campana)
SELECT oltp.id_fuente, oltp.id_campana, oltp.TipoOrigen, oltp.Campana
FROM (
    SELECT 
        c.id_fuente,
        c.id_campana,
        f.nombre AS TipoOrigen,
        c.nombre AS Campana
    FROM [NexoSaludDB].dbo.[Campanas] c
    JOIN [NexoSaludDB].dbo.[Fuentes] f ON c.id_fuente = f.id_fuente
) oltp
WHERE NOT EXISTS (
    SELECT 1 FROM [NexoSalud_Mart].dbo.[Dim_Fuente] dim WHERE dim.id_campana = oltp.id_campana
);
GO

-- 3.6 Homologación Dim_Profesional
UPDATE dim
SET dim.Odontologo = oltp.Odontologo, dim.EspecialidadPrincipal = oltp.EspecialidadPrincipal
FROM [NexoSalud_Mart].dbo.[Dim_Profesional] dim
JOIN (
    SELECT id_profesional, CONCAT(nombres, ' ', apellidos) AS Odontologo, especialidad AS EspecialidadPrincipal
    FROM [NexoSaludDB].dbo.[Profesionales]
) oltp ON dim.id_profesional = oltp.id_profesional;

INSERT INTO [NexoSalud_Mart].dbo.[Dim_Profesional] (id_profesional, Odontologo, EspecialidadPrincipal)
SELECT oltp.id_profesional, oltp.Odontologo, oltp.EspecialidadPrincipal
FROM (
    SELECT id_profesional, CONCAT(nombres, ' ', apellidos) AS Odontologo, especialidad AS EspecialidadPrincipal
    FROM [NexoSaludDB].dbo.[Profesionales]
) oltp
WHERE NOT EXISTS (
    SELECT 1 FROM [NexoSalud_Mart].dbo.[Dim_Profesional] dim WHERE dim.id_profesional = oltp.id_profesional
);
GO

-- 3.7 Homologación Dim_Negociador
UPDATE dim
SET dim.NombreNegociador = oltp.NombreNegociador
FROM [NexoSalud_Mart].dbo.[Dim_Negociador] dim
JOIN (
    SELECT id_usuario, CONCAT(nombres, ' ', apellidos) AS NombreNegociador
    FROM [NexoSaludDB].dbo.[Usuarios]
) oltp ON dim.id_usuario = oltp.id_usuario;

INSERT INTO [NexoSalud_Mart].dbo.[Dim_Negociador] (id_usuario, NombreNegociador)
SELECT oltp.id_usuario, oltp.NombreNegociador
FROM (
    SELECT id_usuario, CONCAT(nombres, ' ', apellidos) AS NombreNegociador
    FROM [NexoSaludDB].dbo.[Usuarios]
) oltp
WHERE NOT EXISTS (
    SELECT 1 FROM [NexoSalud_Mart].dbo.[Dim_Negociador] dim WHERE dim.id_usuario = oltp.id_usuario
);
GO

-- 3.8 Homologación Dim_Pasarela
UPDATE dim
SET dim.EntidadFinanciera = src.EntidadFinanciera, dim.TipoMedio = src.TipoMedio
FROM [NexoSalud_Mart].dbo.[Dim_Pasarela] dim
JOIN (
    SELECT 1 AS KeyPasarela, 'Plin' AS MetodoPago, 'Interbank/BBVA' AS EntidadFinanciera, 'Billeteras Digitales' AS TipoMedio
    UNION ALL SELECT 2, 'Tarjeta (Web)', 'Niubiz/Culqi', 'Bancarizado'
    UNION ALL SELECT 3, 'Transferencia', 'Interbancaria', 'Bancarizado'
    UNION ALL SELECT 4, 'Yape', 'BCP', 'Billeteras Digitales'
) src ON dim.KeyPasarela = src.KeyPasarela;

INSERT INTO [NexoSalud_Mart].dbo.[Dim_Pasarela] (MetodoPago, EntidadFinanciera, TipoMedio)
SELECT src.MetodoPago, src.EntidadFinanciera, src.TipoMedio
FROM (
    SELECT 1 AS KeyPasarela, 'Plin' AS MetodoPago, 'Interbank/BBVA' AS EntidadFinanciera, 'Billeteras Digitales' AS TipoMedio
    UNION ALL SELECT 2, 'Tarjeta (Web)', 'Niubiz/Culqi', 'Bancarizado'
    UNION ALL SELECT 3, 'Transferencia', 'Interbancaria', 'Bancarizado'
    UNION ALL SELECT 4, 'Yape', 'BCP', 'Billeteras Digitales'
) src
WHERE NOT EXISTS (
    SELECT 1 FROM [NexoSalud_Mart].dbo.[Dim_Pasarela] dim WHERE dim.MetodoPago = src.MetodoPago
);
GO

-- 3.9 Homologación Dim_Cobro
UPDATE dim
SET dim.EstadoPago = src.EstadoPago, dim.ComprobanteAdjunto = src.ComprobanteAdjunto
FROM [NexoSalud_Mart].dbo.[Dim_Cobro] dim
JOIN (
    SELECT 1 AS KeyCobro, 'Validado' AS EstadoPago, 'SI' AS ComprobanteAdjunto
    UNION ALL SELECT 2, 'Pendiente', 'NO'
    UNION ALL SELECT 3, 'Rechazado', 'NO'
) src ON dim.KeyCobro = src.KeyCobro;

INSERT INTO [NexoSalud_Mart].dbo.[Dim_Cobro] (EstadoPago, ComprobanteAdjunto)
SELECT src.EstadoPago, src.ComprobanteAdjunto
FROM (
    SELECT 1 AS KeyCobro, 'Validado' AS EstadoPago, 'SI' AS ComprobanteAdjunto
    UNION ALL SELECT 2, 'Pendiente', 'NO'
    UNION ALL SELECT 3, 'Rechazado', 'NO'
) src
WHERE NOT EXISTS (
    SELECT 1 FROM [NexoSalud_Mart].dbo.[Dim_Cobro] dim WHERE dim.EstadoPago = src.EstadoPago
);
GO

-- 3.10 Homologación Dim_EstadoAtencion
UPDATE dim
SET dim.EstadoFinal = src.EstadoFinal, dim.Asistencia = src.Asistencia
FROM [NexoSalud_Mart].dbo.[Dim_EstadoAtencion] dim
JOIN (
    SELECT 1 AS KeyEstadoAtencion, 'Completada' AS EstadoFinal, 'Asistió' AS Asistencia
    UNION ALL SELECT 2, 'No Asistió', 'Inasistencia'
    UNION ALL SELECT 3, 'Cancelados', 'Cancelado'
) src ON dim.KeyEstadoAtencion = src.KeyEstadoAtencion;

INSERT INTO [NexoSalud_Mart].dbo.[Dim_EstadoAtencion] (EstadoFinal, Asistencia)
SELECT src.EstadoFinal, src.Asistencia
FROM (
    SELECT 1 AS KeyEstadoAtencion, 'Completada' AS EstadoFinal, 'Asistió' AS Asistencia
    UNION ALL SELECT 2, 'No Asistió', 'Inasistencia'
    UNION ALL SELECT 3, 'Cancelados', 'Cancelado'
) src
WHERE NOT EXISTS (
    SELECT 1 FROM [NexoSalud_Mart].dbo.[Dim_EstadoAtencion] dim WHERE dim.EstadoFinal = src.EstadoFinal
);
GO

-- ====================================================================
-- 4. ÍNDICES DE UNICIDAD FÍSICA PARA GARANTÍA DE IDEMPOTENCIA
-- ====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactCaptacionBuyer_Grain' AND object_id = OBJECT_ID('fact_captacion_buyer'))
   AND NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('fact_captacion_buyer') AND type = 'PK')
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactCaptacionBuyer_Grain 
    ON fact_captacion_buyer (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactNegociacionLead_Grain' AND object_id = OBJECT_ID('fact_negociacion_lead'))
   AND NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('fact_negociacion_lead') AND type = 'PK')
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactNegociacionLead_Grain 
    ON fact_negociacion_lead (KeyTiempo, KeySede, KeyNegociador, KeyServicio, KeyProfesional);

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactGestionPayer_Grain' AND object_id = OBJECT_ID('fact_gestion_payer'))
    DROP INDEX UQ_FactGestionPayer_Grain ON fact_gestion_payer;

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('fact_gestion_payer') AND type = 'PK')
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactGestionPayer_Grain 
    ON fact_gestion_payer (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactAtencionCustomer_Grain' AND object_id = OBJECT_ID('fact_atencion_customer'))
   AND NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('fact_atencion_customer') AND type = 'PK')
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactAtencionCustomer_Grain 
    ON fact_atencion_customer (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactSeguimientoTurned_Grain' AND object_id = OBJECT_ID('fact_seguimiento_turned'))
   AND NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('fact_seguimiento_turned') AND type = 'PK')
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactSeguimientoTurned_Grain 
    ON fact_seguimiento_turned (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal);
GO

-- ====================================================================
-- 5. CARGA INCREMENTAL BASADA EN UPDATE + INSERT (WHERE NOT EXISTS)
-- Y RECONCILIACIÓN SELECTIVA DE OBSOLETOS SIN BORRADO GLOBAL
-- ====================================================================

-- 5.0 Adquisición de Candado de Aplicación
DECLARE @AppLockResult INT;
EXEC @AppLockResult = sp_getapplock 
    @Resource = 'ETL_NexoSalud_Lock', 
    @LockMode = 'Exclusive', 
    @LockOwner = 'Session', 
    @LockTimeout = 5000;

IF @AppLockResult < 0
BEGIN
    RAISERROR('Bloqueo de Concurrencia: El proceso ETL ya se encuentra en ejecución por otra sesión o proceso.', 16, 1);
    RETURN;
END;

DECLARE @BatchId VARCHAR(50) = CONCAT('BATCH_INS_', FORMAT(SYSDATETIME(), 'yyyyMMdd_HHmmss'));
DECLARE @StartTime DATETIME2(7) = SYSDATETIME();
DECLARE @RowsBuyerU INT = 0, @RowsBuyerI INT = 0, @RowsBuyerD INT = 0;
DECLARE @RowsLeadU INT = 0, @RowsLeadI INT = 0, @RowsLeadD INT = 0;
DECLARE @RowsPayerU INT = 0, @RowsPayerI INT = 0, @RowsPayerD INT = 0;
DECLARE @RowsCustU INT = 0, @RowsCustI INT = 0, @RowsCustD INT = 0;
DECLARE @RowsTurnU INT = 0, @RowsTurnI INT = 0, @RowsTurnD INT = 0;

INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, FechaRegistro)
VALUES (@BatchId, 'ETL_Hechos_InsertStrategy', 'INICIO', N'Iniciando ciclo ETL incremental basado en UPDATE + INSERT (WHERE NOT EXISTS) en NexoSalud_Mart.', @StartTime);

BEGIN TRY
    BEGIN TRANSACTION;

    -- ================================================================
    -- 5.1 Fact_OportunidadCaptacion & Fact_CaptacionBuyer
    -- Grano Atómico: (id_oportunidad)
    -- Grano Agregado: (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro)
    -- ================================================================
    IF OBJECT_ID('tempdb..#OportunidadesTransformadas') IS NOT NULL DROP TABLE #OportunidadesTransformadas;
    IF OBJECT_ID('tempdb..#BuyerAgregado') IS NOT NULL DROP TABLE #BuyerAgregado;

    -- A. Prorrateo mensual de Gastos de Campaña y Transformación Atómica
    ;WITH GastosProrrateados AS (
        SELECT 
            g.id_campana,
            YEAR(g.fecha) * 100 + MONTH(g.fecha) AS AnioMes,
            SUM(g.importe) AS TotalGastoMes
        FROM [NexoSaludDB].dbo.[GastosCampana] g
        GROUP BY g.id_campana, YEAR(g.fecha) * 100 + MONTH(g.fecha)
    ),
    ConteoContactosCampana AS (
        SELECT 
            op.id_campana,
            YEAR(op.fecha_registro) * 100 + MONTH(op.fecha_registro) AS AnioMes,
            COUNT(*) AS CantidadContactosMes
        FROM [NexoSaludDB].dbo.[OportunidadesCaptacion] op
        WHERE op.id_campana IS NOT NULL
        GROUP BY op.id_campana, YEAR(op.fecha_registro) * 100 + MONTH(op.fecha_registro)
    ),
    CostosUnitarios AS (
        SELECT 
            g.id_campana,
            g.AnioMes,
            CAST(ROUND(g.TotalGastoMes / NULLIF(c.CantidadContactosMes, 0), 2) AS DECIMAL(10,2)) AS CostoPorContacto
        FROM GastosProrrateados g
        INNER JOIN ConteoContactosCampana c ON g.id_campana = c.id_campana AND g.AnioMes = c.AnioMes
    )
    SELECT 
        op.id_oportunidad,
        YEAR(op.fecha_registro) * 10000 + MONTH(op.fecha_registro) * 100 + DAY(op.fecha_registro) AS KeyTiempoCaptacion,
        CASE 
            WHEN op.fecha_conversion IS NOT NULL 
            THEN YEAR(op.fecha_conversion) * 10000 + MONTH(op.fecha_conversion) * 100 + DAY(op.fecha_conversion)
            ELSE NULL 
        END AS KeyTiempoConversion,
        ISNULL(ds.KeySede, 0) AS KeySede,
        ISNULL(dc.KeyCanal, 0) AS KeyCanal,
        COALESCE(df_camp.KeyFuente, df_fuen.KeyFuente, 0) AS KeyFuente,
        ISNULL(dserv.KeyServicio, 0) AS KeyServicio,
        ISNULL(dtp.KeyTipoPersona, 0) AS KeyTipoPersona,
        CASE 
            WHEN p.estado_calidad = 'Valido' THEN 4
            WHEN p.estado_calidad = 'Duplicado' THEN 2
            WHEN p.estado_calidad = 'Rechazado' THEN 3
            WHEN p.estado_calidad = 'Incompleto' THEN 1
            ELSE 0
        END AS KeyEstadoRegistro,
        1 AS contacto_registrado,
        CASE 
            WHEN (p.consentimiento_atencion = 1 OR p.autoriza_contacto = 1)
                 AND p.estado_calidad = 'Valido'
                 AND LEN(RTRIM(LTRIM(ISNULL(p.telefono_normalizado, p.numero)))) >= 9
                 AND op.estado_oportunidad NOT IN ('INCOMPLETO', 'DESCARTADO')
            THEN 1
            ELSE 0
        END AS contacto_utilizable,
        CASE 
            WHEN op.estado_oportunidad = 'CONVERTIDO_LEAD' 
                 OR op.id_solicitud IS NOT NULL 
                 OR p.id_etapa_actual >= 2
            THEN 1 
            ELSE 0 
        END AS conversion_lead,
        CASE 
            WHEN op.fecha_conversion IS NOT NULL AND op.fecha_conversion >= op.fecha_registro 
            THEN DATEDIFF(DAY, op.fecha_registro, op.fecha_conversion)
            ELSE 0 
        END AS tiempo_conversion_dia,
        ISNULL(cu.CostoPorContacto, 0.00) AS costo_atribuido_captacion
    INTO #OportunidadesTransformadas
    FROM [NexoSaludDB].dbo.[OportunidadesCaptacion] op
    INNER JOIN [NexoSaludDB].dbo.[Personas] p ON op.id_persona = p.id_persona
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Sede] ds ON (
        ds.id_sede = ISNULL(op.id_sede_preferida, 
            CASE 
                WHEN p.zona IN ('Centro Histórico', 'Centro Historico', 'El Recreo', 'Florencia de Mora', 'La Esperanza', 'Moche', 'San Andrés', 'San Andres') THEN 1
                WHEN p.zona IN ('California', 'Víctor Larco Herrera', 'Victor Larco Herrera', 'Huanchaco') THEN 2
                WHEN p.zona IN ('El Golf') THEN 3
                ELSE 0
            END)
    )
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Canal] dc ON op.id_canal = dc.id_canal
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Fuente] df_camp ON op.id_campana = df_camp.id_campana
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Fuente] df_fuen ON op.id_campana IS NULL AND op.id_fuente = df_fuen.id_fuente AND df_fuen.KeyFuente = (
        SELECT MIN(df_sub.KeyFuente) FROM [NexoSalud_Mart].dbo.[Dim_Fuente] df_sub WHERE df_sub.id_fuente = op.id_fuente
    )
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Servicio] dserv ON op.id_servicio_interes = dserv.id_servicio
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_TipoPersona] dtp ON p.id_persona = dtp.id_persona
    LEFT JOIN CostosUnitarios cu ON op.id_campana = cu.id_campana AND (YEAR(op.fecha_registro) * 100 + MONTH(op.fecha_registro)) = cu.AnioMes;

    CREATE UNIQUE CLUSTERED INDEX IX_Temp_Op ON #OportunidadesTransformadas(id_oportunidad);

    -- B. Carga Atómica a Fact_OportunidadCaptacion (UPDATE + INSERT + DELETE)
    UPDATE f
    SET 
        f.KeyTiempoCaptacion        = s.KeyTiempoCaptacion,
        f.KeyTiempoConversion       = s.KeyTiempoConversion,
        f.KeySede                   = s.KeySede,
        f.KeyCanal                  = s.KeyCanal,
        f.KeyFuente                 = s.KeyFuente,
        f.KeyServicio               = s.KeyServicio,
        f.KeyTipoPersona            = s.KeyTipoPersona,
        f.KeyEstadoRegistro         = s.KeyEstadoRegistro,
        f.contacto_registrado       = s.contacto_registrado,
        f.contacto_utilizable       = s.contacto_utilizable,
        f.conversion_lead           = s.conversion_lead,
        f.tiempo_conversion_dia     = s.tiempo_conversion_dia,
        f.costo_atribuido_captacion = s.costo_atribuido_captacion,
        f.FechaCargaETL             = SYSDATETIME()
    FROM [NexoSalud_Mart].dbo.[Fact_OportunidadCaptacion] f
    JOIN #OportunidadesTransformadas s ON f.id_oportunidad = s.id_oportunidad;

    INSERT INTO [NexoSalud_Mart].dbo.[Fact_OportunidadCaptacion] (
        id_oportunidad, KeyTiempoCaptacion, KeyTiempoConversion, KeySede, KeyCanal, 
        KeyFuente, KeyServicio, KeyTipoPersona, KeyEstadoRegistro, contacto_registrado, 
        contacto_utilizable, conversion_lead, tiempo_conversion_dia, costo_atribuido_captacion, FechaCargaETL
    )
    SELECT 
        s.id_oportunidad, s.KeyTiempoCaptacion, s.KeyTiempoConversion, s.KeySede, s.KeyCanal,
        s.KeyFuente, s.KeyServicio, s.KeyTipoPersona, s.KeyEstadoRegistro, s.contacto_registrado,
        s.contacto_utilizable, s.conversion_lead, s.tiempo_conversion_dia, s.costo_atribuido_captacion, SYSDATETIME()
    FROM #OportunidadesTransformadas s
    WHERE NOT EXISTS (
        SELECT 1 FROM [NexoSalud_Mart].dbo.[Fact_OportunidadCaptacion] f WHERE f.id_oportunidad = s.id_oportunidad
    );

    DELETE f
    FROM [NexoSalud_Mart].dbo.[Fact_OportunidadCaptacion] f
    WHERE NOT EXISTS (
        SELECT 1 FROM #OportunidadesTransformadas s WHERE f.id_oportunidad = s.id_oportunidad
    );

    -- C. Carga Agregada a Fact_CaptacionBuyer
    SELECT 
        KeyTiempoCaptacion AS KeyTiempo,
        KeySede,
        KeyCanal,
        KeyFuente,
        KeyEstadoRegistro,
        MIN(KeyServicio) AS KeyServicio,
        MIN(KeyTipoPersona) AS KeyTipoPersona,
        COUNT(*) AS contacto_registrado,
        SUM(contacto_utilizable) AS contacto_utilizable,
        SUM(conversion_lead) AS conversion_lead,
        ISNULL(ROUND(AVG(CAST(tiempo_conversion_dia AS FLOAT)), 0), 0) AS tiempo_conversion_dia,
        SUM(costo_atribuido_captacion) AS costo_atribuido_captacion
    INTO #BuyerAgregado
    FROM #OportunidadesTransformadas
    GROUP BY 
        KeyTiempoCaptacion,
        KeySede,
        KeyCanal,
        KeyFuente,
        KeyEstadoRegistro;

    CREATE UNIQUE CLUSTERED INDEX IX_Temp_Aggr ON #BuyerAgregado(KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro);

    -- UPDATE combinaciones existentes
    UPDATE f
    SET 
        f.KeyServicio = s.KeyServicio,
        f.KeyTipoPersona = s.KeyTipoPersona,
        f.contacto_registrado = s.contacto_registrado,
        f.contacto_utilizable = s.contacto_utilizable,
        f.conversion_lead = s.conversion_lead,
        f.tiempo_conversion_dia = s.tiempo_conversion_dia,
        f.costo_atribuido_captacion = s.costo_atribuido_captacion
    FROM [NexoSalud_Mart].dbo.[Fact_CaptacionBuyer] f
    JOIN #BuyerAgregado s ON f.KeyTiempo = s.KeyTiempo
                         AND f.KeySede = s.KeySede
                         AND f.KeyCanal = s.KeyCanal
                         AND f.KeyFuente = s.KeyFuente
                         AND f.KeyEstadoRegistro = s.KeyEstadoRegistro;

    SET @RowsBuyerU = @@ROWCOUNT;

    -- INSERT combinaciones nuevas
    INSERT INTO [NexoSalud_Mart].dbo.[Fact_CaptacionBuyer] (
        KeyTiempo, KeySede, KeyServicio, KeyCanal, KeyFuente, KeyTipoPersona, KeyEstadoRegistro,
        contacto_registrado, contacto_utilizable, conversion_lead, tiempo_conversion_dia, costo_atribuido_captacion
    )
    SELECT 
        s.KeyTiempo, s.KeySede, s.KeyServicio, s.KeyCanal, s.KeyFuente, s.KeyTipoPersona, s.KeyEstadoRegistro,
        s.contacto_registrado, s.contacto_utilizable, s.conversion_lead, s.tiempo_conversion_dia, s.costo_atribuido_captacion
    FROM #BuyerAgregado s
    WHERE NOT EXISTS (
        SELECT 1 
        FROM [NexoSalud_Mart].dbo.[Fact_CaptacionBuyer] f
        WHERE f.KeyTiempo = s.KeyTiempo
          AND f.KeySede = s.KeySede
          AND f.KeyCanal = s.KeyCanal
          AND f.KeyFuente = s.KeyFuente
          AND f.KeyEstadoRegistro = s.KeyEstadoRegistro
    );

    SET @RowsBuyerI = @@ROWCOUNT;

    -- RECONCILIACIÓN (DELETE)
    DELETE f
    FROM [NexoSalud_Mart].dbo.[Fact_CaptacionBuyer] f
    WHERE NOT EXISTS (
        SELECT 1 
        FROM #BuyerAgregado s
        WHERE f.KeyTiempo = s.KeyTiempo
          AND f.KeySede = s.KeySede
          AND f.KeyCanal = s.KeyCanal
          AND f.KeyFuente = s.KeyFuente
          AND f.KeyEstadoRegistro = s.KeyEstadoRegistro
    );

    SET @RowsBuyerD = @@ROWCOUNT;
    DROP TABLE #OportunidadesTransformadas;
    DROP TABLE #BuyerAgregado;

    -- ================================================================
    -- 5.2 Fact_NegociacionLead
    -- Grano: (KeyTiempo, KeySede, KeyNegociador, KeyServicio, KeyProfesional)
    -- ================================================================
    CREATE TABLE #Staging_Lead (
        KeyTiempo INT NOT NULL,
        KeySede INT NOT NULL,
        KeyServicio INT NOT NULL,
        KeyProfesional INT NOT NULL,
        KeyNegociador INT NOT NULL,
        cohorte_evaluable INT NOT NULL,
        conversion_payer_14_dia INT NOT NULL,
        leads_en_negociacion INT NOT NULL,
        negociacion_abandonada INT NOT NULL,
        solicitud_requiere_respuesta INT NOT NULL,
        respuesta_util_15_min INT NOT NULL,
        negociacion_finalizada INT NOT NULL,
        PRIMARY KEY (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador)
    );

    ;WITH LeadEvents AS (
        SELECT 
            ev.id_persona,
            ev.id_usuario,
            ev.fecha_hora,
            ROW_NUMBER() OVER (PARTITION BY ev.id_persona ORDER BY ev.fecha_hora ASC) AS rn
        FROM [NexoSaludDB].dbo.[EventosEtapa] ev
        WHERE ev.etapa_destino = 2
    )
    INSERT INTO #Staging_Lead (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador, cohorte_evaluable, conversion_payer_14_dia, leads_en_negociacion, negociacion_abandonada, solicitud_requiere_respuesta, respuesta_util_15_min, negociacion_finalizada)
    SELECT 
        CAST(FORMAT(ev.fecha_hora, 'yyyyMMdd') AS INT) AS KeyTiempo,
        ISNULL(ds.KeySede, 0) AS KeySede,
        ISNULL(dserv.KeyServicio, 0) AS KeyServicio,
        ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
        ISNULL(dn.KeyNegociador, 0) AS KeyNegociador,
        COUNT(DISTINCT ev.id_persona) AS cohorte_evaluable,
        SUM(CASE WHEN p.id_etapa_actual >= 3 THEN 1 ELSE 0 END) AS conversion_payer_14_dia,
        SUM(CASE WHEN p.id_etapa_actual = 2 AND sol.estado IN ('En Negociacion', 'En negociación') THEN 1 ELSE 0 END) AS leads_en_negociacion,
        SUM(CASE WHEN sol.estado = 'Abandonada' OR p.id_etapa_actual < 2 THEN 1 ELSE 0 END) AS negociacion_abandonada,
        COUNT(DISTINCT ev.id_persona) AS solicitud_requiere_respuesta,
        SUM(CASE 
            WHEN sol.fecha_primera_respuesta IS NOT NULL 
                 AND sol.fecha_primera_respuesta >= sol.fecha_solicitud
                 AND DATEDIFF(MINUTE, sol.fecha_solicitud, sol.fecha_primera_respuesta) <= 15 
            THEN 1 ELSE 0 
        END) AS respuesta_util_15_min,
        SUM(CASE WHEN p.id_etapa_actual >= 3 OR sol.estado = 'Abandonada' THEN 1 ELSE 0 END) AS negociacion_finalizada
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
        dn.KeyNegociador;

    -- 5.2.B UPDATE combinaciones existentes
    UPDATE f
    SET 
        f.cohorte_evaluable = s.cohorte_evaluable,
        f.conversion_payer_14_dia = s.conversion_payer_14_dia,
        f.leads_en_negociacion = s.leads_en_negociacion,
        f.negociacion_abandonada = s.negociacion_abandonada,
        f.solicitud_requiere_respuesta = s.solicitud_requiere_respuesta,
        f.respuesta_util_15_min = s.respuesta_util_15_min,
        f.negociacion_finalizada = s.negociacion_finalizada
    FROM [NexoSalud_Mart].dbo.[Fact_NegociacionLead] f
    JOIN #Staging_Lead s ON f.KeyTiempo = s.KeyTiempo
                       AND f.KeySede = s.KeySede
                       AND f.KeyNegociador = s.KeyNegociador
                       AND f.KeyServicio = s.KeyServicio
                       AND f.KeyProfesional = s.KeyProfesional
    WHERE f.cohorte_evaluable <> s.cohorte_evaluable
       OR f.conversion_payer_14_dia <> s.conversion_payer_14_dia
       OR f.leads_en_negociacion <> s.leads_en_negociacion
       OR f.negociacion_abandonada <> s.negociacion_abandonada
       OR f.solicitud_requiere_respuesta <> s.solicitud_requiere_respuesta
       OR f.respuesta_util_15_min <> s.respuesta_util_15_min
       OR f.negociacion_finalizada <> s.negociacion_finalizada;

    SET @RowsLeadU = @@ROWCOUNT;

    -- 5.2.C INSERT combinaciones nuevas con WHERE NOT EXISTS
    INSERT INTO [NexoSalud_Mart].dbo.[Fact_NegociacionLead] (
        KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador,
        cohorte_evaluable, conversion_payer_14_dia, leads_en_negociacion, negociacion_abandonada,
        solicitud_requiere_respuesta, respuesta_util_15_min, negociacion_finalizada
    )
    SELECT 
        s.KeyTiempo, s.KeySede, s.KeyServicio, s.KeyProfesional, s.KeyNegociador,
        s.cohorte_evaluable, s.conversion_payer_14_dia, s.leads_en_negociacion, s.negociacion_abandonada,
        s.solicitud_requiere_respuesta, s.respuesta_util_15_min, s.negociacion_finalizada
    FROM #Staging_Lead s
    WHERE NOT EXISTS (
        SELECT 1 
        FROM [NexoSalud_Mart].dbo.[Fact_NegociacionLead] f
        WHERE f.KeyTiempo = s.KeyTiempo
          AND f.KeySede = s.KeySede
          AND f.KeyNegociador = s.KeyNegociador
          AND f.KeyServicio = s.KeyServicio
          AND f.KeyProfesional = s.KeyProfesional
    );

    SET @RowsLeadI = @@ROWCOUNT;

    -- 5.2.D RECONCILIACIÓN de obsoletos
    DELETE f
    FROM [NexoSalud_Mart].dbo.[Fact_NegociacionLead] f
    WHERE NOT EXISTS (
        SELECT 1 
        FROM #Staging_Lead s
        WHERE f.KeyTiempo = s.KeyTiempo
          AND f.KeySede = s.KeySede
          AND f.KeyNegociador = s.KeyNegociador
          AND f.KeyServicio = s.KeyServicio
          AND f.KeyProfesional = s.KeyProfesional
    );

    SET @RowsLeadD = @@ROWCOUNT;
    DROP TABLE #Staging_Lead;

    -- ================================================================
    -- 5.3 Fact_GestionPayer
    -- Grano: (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio)
    -- ================================================================
    CREATE TABLE #Staging_Payer (
        KeyTiempo INT NOT NULL,
        KeyPasarela INT NOT NULL,
        KeyCobro INT NOT NULL,
        KeySede INT NOT NULL,
        KeyServicio INT NOT NULL,
        pago_registrado INT NOT NULL,
        pago_validado INT NOT NULL,
        pago_rechazado INT NOT NULL,
        importe_total_cobro DECIMAL(12,2) NOT NULL,
        tiempo_validacion_minuto INT NOT NULL,
        PRIMARY KEY (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio)
    );

    INSERT INTO #Staging_Payer (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio, pago_registrado, pago_validado, pago_rechazado, importe_total_cobro, tiempo_validacion_minuto)
    SELECT 
        CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT) AS KeyTiempo,
        ISNULL(dp.KeyPasarela, 0) AS KeyPasarela,
        CASE 
            WHEN p.estado IN ('Confirmado', 'Validado', 'VALIDATED', 'VALIDADO') THEN 1
            WHEN p.estado IN ('Pendiente', 'PENDING') THEN 2
            WHEN p.estado IN ('Fallido', 'Rechazado', 'REJECTED') THEN 3
            ELSE 0
        END AS KeyCobro,
        ISNULL(ds.KeySede, 0) AS KeySede,
        ISNULL(dserv.KeyServicio, 0) AS KeyServicio,
        COUNT(p.id_pago) AS pago_registrado,
        SUM(CASE WHEN p.estado IN ('Validado', 'VALIDADO', 'Confirmado', 'VALIDATED') THEN 1 ELSE 0 END) AS pago_validado,
        SUM(CASE WHEN p.estado IN ('Rechazado', 'REJECTED', 'Fallido') THEN 1 ELSE 0 END) AS pago_rechazado,
        SUM(p.importe) AS importe_total_cobro,
        SUM(CASE 
            WHEN p.fecha_validacion IS NOT NULL AND p.fecha_validacion >= p.fecha_registro 
            THEN DATEDIFF(MINUTE, p.fecha_registro, p.fecha_validacion)
            ELSE 0 
        END) AS tiempo_validacion_minuto
    FROM [NexoSaludDB].dbo.[Pagos] p
    LEFT JOIN [NexoSaludDB].dbo.[Reservas] r ON p.id_reserva = r.id_reserva
    LEFT JOIN [NexoSaludDB].dbo.[Opciones] o ON r.id_opcion = o.id_opcion
    LEFT JOIN [NexoSaludDB].dbo.[Disponibilidad] d ON o.id_disponibilidad = d.id_disponibilidad
    LEFT JOIN [NexoSaludDB].dbo.[Solicitudes] sol ON r.id_solicitud = sol.id_solicitud
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Pasarela] dp ON dp.MetodoPago = p.canal_pago
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Sede] ds ON ds.id_sede = d.id_sede
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Servicio] dserv ON dserv.id_servicio = sol.id_servicio
    GROUP BY 
        CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT),
        ISNULL(dp.KeyPasarela, 0),
        CASE 
            WHEN p.estado IN ('Confirmado', 'Validado', 'VALIDATED', 'VALIDADO') THEN 1
            WHEN p.estado IN ('Pendiente', 'PENDING') THEN 2
            WHEN p.estado IN ('Fallido', 'Rechazado', 'REJECTED') THEN 3
            ELSE 0
        END,
        ISNULL(ds.KeySede, 0),
        ISNULL(dserv.KeyServicio, 0);

    -- 5.3.B UPDATE combinaciones existentes
    UPDATE f
    SET 
        f.pago_registrado = s.pago_registrado,
        f.pago_validado = s.pago_validado,
        f.pago_rechazado = s.pago_rechazado,
        f.importe_total_cobro = s.importe_total_cobro,
        f.tiempo_validacion_minuto = s.tiempo_validacion_minuto
    FROM [NexoSalud_Mart].dbo.[Fact_GestionPayer] f
    JOIN #Staging_Payer s ON f.KeyTiempo = s.KeyTiempo
                         AND f.KeyPasarela = s.KeyPasarela
                         AND f.KeyCobro = s.KeyCobro
                         AND f.KeySede = s.KeySede
                         AND f.KeyServicio = s.KeyServicio
    WHERE f.pago_registrado <> s.pago_registrado
       OR f.pago_validado <> s.pago_validado
       OR f.pago_rechazado <> s.pago_rechazado
       OR f.importe_total_cobro <> s.importe_total_cobro
       OR f.tiempo_validacion_minuto <> s.tiempo_validacion_minuto;

    SET @RowsPayerU = @@ROWCOUNT;

    -- 5.3.C INSERT combinaciones nuevas con WHERE NOT EXISTS
    INSERT INTO [NexoSalud_Mart].dbo.[Fact_GestionPayer] (
        KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio,
        pago_registrado, pago_validado, pago_rechazado, importe_total_cobro, tiempo_validacion_minuto
    )
    SELECT 
        s.KeyTiempo, s.KeyPasarela, s.KeyCobro, s.KeySede, s.KeyServicio,
        s.pago_registrado, s.pago_validado, s.pago_rechazado, s.importe_total_cobro, s.tiempo_validacion_minuto
    FROM #Staging_Payer s
    WHERE NOT EXISTS (
        SELECT 1 
        FROM [NexoSalud_Mart].dbo.[Fact_GestionPayer] f
        WHERE f.KeyTiempo = s.KeyTiempo
          AND f.KeyPasarela = s.KeyPasarela
          AND f.KeyCobro = s.KeyCobro
          AND f.KeySede = s.KeySede
          AND f.KeyServicio = s.KeyServicio
    );

    SET @RowsPayerI = @@ROWCOUNT;

    -- 5.3.D RECONCILIACIÓN de obsoletos
    DELETE f
    FROM [NexoSalud_Mart].dbo.[Fact_GestionPayer] f
    WHERE NOT EXISTS (
        SELECT 1 
        FROM #Staging_Payer s
        WHERE f.KeyTiempo = s.KeyTiempo
          AND f.KeyPasarela = s.KeyPasarela
          AND f.KeyCobro = s.KeyCobro
          AND f.KeySede = s.KeySede
          AND f.KeyServicio = s.KeyServicio
    );

    SET @RowsPayerD = @@ROWCOUNT;
    DROP TABLE #Staging_Payer;

    -- ================================================================
    -- 5.4 Fact_AtencionCustomer
    -- Grano: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion)
    -- ================================================================
    CREATE TABLE #Staging_Customer (
        KeyTiempo INT NOT NULL,
        KeySede INT NOT NULL,
        KeyServicio INT NOT NULL,
        KeyProfesional INT NOT NULL,
        KeyEstadoAtencion INT NOT NULL,
        cita_evaluable INT NOT NULL,
        atencion_realizada INT NOT NULL,
        cita_inasistencia INT NOT NULL,
        tiempo_sillon_dental_minuto INT NOT NULL,
        atencion_finalizada_conforme INT NOT NULL,
        PRIMARY KEY (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion)
    );

    INSERT INTO #Staging_Customer (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion, cita_evaluable, atencion_realizada, cita_inasistencia, tiempo_sillon_dental_minuto, atencion_finalizada_conforme)
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
        COUNT(a.id_atencion) AS cita_evaluable,
        SUM(CASE WHEN a.asistencia LIKE '%Asisti%' AND a.asistencia NOT LIKE '%No%' THEN 1 ELSE 0 END) AS atencion_realizada,
        SUM(CASE WHEN a.asistencia LIKE '%No%asisti%' THEN 1 ELSE 0 END) AS cita_inasistencia,
        SUM(CASE 
            WHEN a.fecha_fin IS NOT NULL AND a.fecha_inicio IS NOT NULL AND a.fecha_fin >= a.fecha_inicio
            THEN DATEDIFF(MINUTE, a.fecha_inicio, a.fecha_fin)
            WHEN a.fecha_inicio IS NOT NULL
            THEN 30
            ELSE 0
        END) AS tiempo_sillon_dental_minuto,
        SUM(CASE WHEN NULLIF(LTRIM(RTRIM(a.procedimiento_realizado)), '') IS NOT NULL 
                      AND NULLIF(LTRIM(RTRIM(a.indicaciones_finales)), '') IS NOT NULL 
                 THEN 1 ELSE 0 END) AS atencion_finalizada_conforme
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
        END;

    -- 5.4.B UPDATE combinaciones existentes
    UPDATE f
    SET 
        f.cita_evaluable = s.cita_evaluable,
        f.atencion_realizada = s.atencion_realizada,
        f.cita_inasistencia = s.cita_inasistencia,
        f.tiempo_sillon_dental_minuto = s.tiempo_sillon_dental_minuto,
        f.atencion_finalizada_conforme = s.atencion_finalizada_conforme
    FROM [NexoSalud_Mart].dbo.[Fact_AtencionCustomer] f
    JOIN #Staging_Customer s ON f.KeyTiempo = s.KeyTiempo
                            AND f.KeySede = s.KeySede
                            AND f.KeyServicio = s.KeyServicio
                            AND f.KeyProfesional = s.KeyProfesional
                            AND f.KeyEstadoAtencion = s.KeyEstadoAtencion
    WHERE f.cita_evaluable <> s.cita_evaluable
       OR f.atencion_realizada <> s.atencion_realizada
       OR f.cita_inasistencia <> s.cita_inasistencia
       OR f.tiempo_sillon_dental_minuto <> s.tiempo_sillon_dental_minuto
       OR f.atencion_finalizada_conforme <> s.atencion_finalizada_conforme;

    SET @RowsCustU = @@ROWCOUNT;

    -- 5.4.C INSERT combinaciones nuevas con WHERE NOT EXISTS
    INSERT INTO [NexoSalud_Mart].dbo.[Fact_AtencionCustomer] (
        KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion,
        cita_evaluable, atencion_realizada, cita_inasistencia, tiempo_sillon_dental_minuto, atencion_finalizada_conforme
    )
    SELECT 
        s.KeyTiempo, s.KeySede, s.KeyServicio, s.KeyProfesional, s.KeyEstadoAtencion,
        s.cita_evaluable, s.atencion_realizada, s.cita_inasistencia, s.tiempo_sillon_dental_minuto, s.atencion_finalizada_conforme
    FROM #Staging_Customer s
    WHERE NOT EXISTS (
        SELECT 1 
        FROM [NexoSalud_Mart].dbo.[Fact_AtencionCustomer] f
        WHERE f.KeyTiempo = s.KeyTiempo
          AND f.KeySede = s.KeySede
          AND f.KeyServicio = s.KeyServicio
          AND f.KeyProfesional = s.KeyProfesional
          AND f.KeyEstadoAtencion = s.KeyEstadoAtencion
    );

    SET @RowsCustI = @@ROWCOUNT;

    -- 5.4.D RECONCILIACIÓN de obsoletos
    DELETE f
    FROM [NexoSalud_Mart].dbo.[Fact_AtencionCustomer] f
    WHERE NOT EXISTS (
        SELECT 1 
        FROM #Staging_Customer s
        WHERE f.KeyTiempo = s.KeyTiempo
          AND f.KeySede = s.KeySede
          AND f.KeyServicio = s.KeyServicio
          AND f.KeyProfesional = s.KeyProfesional
          AND f.KeyEstadoAtencion = s.KeyEstadoAtencion
    );

    SET @RowsCustD = @@ROWCOUNT;
    DROP TABLE #Staging_Customer;

    -- ================================================================
    -- 5.5 Fact_SeguimientoTurned
    -- Grano: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal)
    -- ================================================================
    CREATE TABLE #Staging_Turned (
        KeyTiempo INT NOT NULL,
        KeySede INT NOT NULL,
        KeyServicio INT NOT NULL,
        KeyProfesional INT NOT NULL,
        KeyCanal INT NOT NULL,
        seguimiento_registrado INT NOT NULL,
        seguimiento_efectivo INT NOT NULL,
        incidencia_reportada INT NOT NULL,
        incidencia_resuelta_24_hora INT NOT NULL,
        retorno_cohorte_90_dia INT NOT NULL,
        paciente_elegible_retorno INT NOT NULL,
        PRIMARY KEY (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal)
    );

    INSERT INTO #Staging_Turned (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal, seguimiento_registrado, seguimiento_efectivo, incidencia_reportada, incidencia_resuelta_24_hora, retorno_cohorte_90_dia, paciente_elegible_retorno)
    SELECT 
        CAST(FORMAT(s.fecha_hora, 'yyyyMMdd') AS INT) AS KeyTiempo,
        ISNULL(ds.KeySede, 0) AS KeySede,
        ISNULL(dserv.KeyServicio, 0) AS KeyServicio,
        ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
        ISNULL(dc.KeyCanal, 0) AS KeyCanal,
        COUNT(s.id_seguimiento) AS seguimiento_registrado,
        SUM(CASE WHEN s.satisfaccion IS NOT NULL OR s.resultado IS NOT NULL THEN 1 ELSE 0 END) AS seguimiento_efectivo,
        SUM(CASE WHEN s.incidencia = 1 OR s.satisfaccion <= 2 THEN 1 ELSE 0 END) AS incidencia_reportada,
        SUM(CASE WHEN s.incidencia = 1 THEN 1 ELSE 0 END) AS incidencia_resuelta_24_hora,
        SUM(CASE WHEN ret90.tiene_retorno_90d = 1 THEN 1 ELSE 0 END) AS retorno_cohorte_90_dia,
        COUNT(DISTINCT s.id_persona) AS paciente_elegible_retorno
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
          AND a2.asistencia LIKE '%Asisti%' AND a2.asistencia NOT LIKE '%No%'
    ) ret90
    GROUP BY 
        CAST(FORMAT(s.fecha_hora, 'yyyyMMdd') AS INT),
        ISNULL(ds.KeySede, 0),
        ISNULL(dserv.KeyServicio, 0),
        ISNULL(dp.KeyProfesional, 0),
        ISNULL(dc.KeyCanal, 0);

    -- 5.5.B UPDATE combinaciones existentes
    UPDATE f
    SET 
        f.seguimiento_registrado = s.seguimiento_registrado,
        f.seguimiento_efectivo = s.seguimiento_efectivo,
        f.incidencia_reportada = s.incidencia_reportada,
        f.incidencia_resuelta_24_hora = s.incidencia_resuelta_24_hora,
        f.retorno_cohorte_90_dia = s.retorno_cohorte_90_dia,
        f.paciente_elegible_retorno = s.paciente_elegible_retorno
    FROM [NexoSalud_Mart].dbo.[Fact_SeguimientoTurned] f
    JOIN #Staging_Turned s ON f.KeyTiempo = s.KeyTiempo
                          AND f.KeySede = s.KeySede
                          AND f.KeyServicio = s.KeyServicio
                          AND f.KeyProfesional = s.KeyProfesional
                          AND f.KeyCanal = s.KeyCanal
    WHERE f.seguimiento_registrado <> s.seguimiento_registrado
       OR f.seguimiento_efectivo <> s.seguimiento_efectivo
       OR f.incidencia_reportada <> s.incidencia_reportada
       OR f.incidencia_resuelta_24_hora <> s.incidencia_resuelta_24_hora
       OR f.retorno_cohorte_90_dia <> s.retorno_cohorte_90_dia
       OR f.paciente_elegible_retorno <> s.paciente_elegible_retorno;

    SET @RowsTurnU = @@ROWCOUNT;

    -- 5.5.C INSERT combinaciones nuevas con WHERE NOT EXISTS
    INSERT INTO [NexoSalud_Mart].dbo.[Fact_SeguimientoTurned] (
        KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal,
        seguimiento_registrado, seguimiento_efectivo, incidencia_reportada, incidencia_resuelta_24_hora,
        retorno_cohorte_90_dia, paciente_elegible_retorno
    )
    SELECT 
        s.KeyTiempo, s.KeySede, s.KeyServicio, s.KeyProfesional, s.KeyCanal,
        s.seguimiento_registrado, s.seguimiento_efectivo, s.incidencia_reportada, s.incidencia_resuelta_24_hora,
        s.retorno_cohorte_90_dia, s.paciente_elegible_retorno
    FROM #Staging_Turned s
    WHERE NOT EXISTS (
        SELECT 1 
        FROM [NexoSalud_Mart].dbo.[Fact_SeguimientoTurned] f
        WHERE f.KeyTiempo = s.KeyTiempo
          AND f.KeySede = s.KeySede
          AND f.KeyServicio = s.KeyServicio
          AND f.KeyProfesional = s.KeyProfesional
          AND f.KeyCanal = s.KeyCanal
    );

    SET @RowsTurnI = @@ROWCOUNT;

    -- 5.5.D RECONCILIACIÓN de obsoletos
    DELETE f
    FROM [NexoSalud_Mart].dbo.[Fact_SeguimientoTurned] f
    WHERE NOT EXISTS (
        SELECT 1 
        FROM #Staging_Turned s
        WHERE f.KeyTiempo = s.KeyTiempo
          AND f.KeySede = s.KeySede
          AND f.KeyServicio = s.KeyServicio
          AND f.KeyProfesional = s.KeyProfesional
          AND f.KeyCanal = s.KeyCanal
    );

    SET @RowsTurnD = @@ROWCOUNT;
    DROP TABLE #Staging_Turned;

    COMMIT TRANSACTION;

    DECLARE @EndTime DATETIME2(7) = SYSDATETIME();
    DECLARE @DurationSeconds DECIMAL(10,2) = DATEDIFF(MILLISECOND, @StartTime, @EndTime) / 1000.0;
    DECLARE @TotalRowsModified INT = (@RowsBuyerU + @RowsBuyerI + @RowsBuyerD)
                                  + (@RowsLeadU + @RowsLeadI + @RowsLeadD)
                                  + (@RowsPayerU + @RowsPayerI + @RowsPayerD)
                                  + (@RowsCustU + @RowsCustI + @RowsCustD)
                                  + (@RowsTurnU + @RowsTurnI + @RowsTurnD);

    -- Liberar candado exclusivo de sesión
    EXEC sp_releaseapplock @Resource = 'ETL_NexoSalud_Lock', @LockOwner = 'Session';

    INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, FilasAfectadas, DuracionSegundos, FechaRegistro)
    VALUES (
        @BatchId, 
        'ETL_Hechos_InsertStrategy', 
        'EXITO', 
        CONCAT(
            'Carga incremental UPDATE+INSERT completada. ',
            'Buyer (U:', @RowsBuyerU, ', I:', @RowsBuyerI, ', D:', @RowsBuyerD, '), ',
            'Lead (U:', @RowsLeadU, ', I:', @RowsLeadI, ', D:', @RowsLeadD, '), ',
            'Payer (U:', @RowsPayerU, ', I:', @RowsPayerI, ', D:', @RowsPayerD, '), ',
            'Customer (U:', @RowsCustU, ', I:', @RowsCustI, ', D:', @RowsCustD, '), ',
            'Turned (U:', @RowsTurnU, ', I:', @RowsTurnI, ', D:', @RowsTurnD, ')'
        ),
        @TotalRowsModified, 
        @DurationSeconds, 
        @EndTime
    );

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();
    DECLARE @ErrorLine INT = ERROR_LINE();

    -- Liberar candado en caso de error
    EXEC sp_releaseapplock @Resource = 'ETL_NexoSalud_Lock', @LockOwner = 'Session';

    -- Registrar el error en la auditoría (persistido tras el rollback)
    INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, DuracionSegundos, FechaRegistro)
    VALUES (
        @BatchId, 
        'ETL_Hechos_InsertStrategy', 
        'ERROR', 
        CONCAT('Fallo en la línea ', @ErrorLine, ': ', @ErrorMessage),
        DATEDIFF(MILLISECOND, @StartTime, SYSDATETIME()) / 1000.0,
        SYSDATETIME()
    );

    THROW @ErrorSeverity, @ErrorMessage, @ErrorState;
END CATCH;
GO
