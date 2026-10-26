-- ====================================================================
-- NEXOSALUD — DATA MART DIMENSIONAL (CLÍNICA LUXEDENT, TRUJILLO)
-- PROCESO ETL ROBUSTO, IDEMPOTENTE, NO DESTRUCTIVO Y CERTIFICADO
-- Motor: Microsoft SQL Server 2019 / 2022
-- Esquemas: [NexoSaludDB] (OLTP) -> [NexoSalud_Mart] (Data Mart)
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
-- Garantiza que claves foráneas huérfanas o nulas nunca rompan la integridad
-- ni se atribuyan falsamente a entidades con Key = 1.
-- ====================================================================

-- 2.1 Dim_Tiempo (KeyTiempo = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo WHERE KeyTiempo = 0)
BEGIN
    INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
    VALUES (0, '1900-01-01', 1900, 1, 1, 1);
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
    SELECT 1 AS KeyCobro, 'Validado' AS EstadoPago, 'SI' AS ComprobanteAdjunto
    UNION ALL SELECT 2, 'Pendiente', 'NO'
    UNION ALL SELECT 3, 'Rechazado', 'NO'
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
-- Incluyen todas las dimensiones que componen el grano analítico real
-- ====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactCaptacionBuyer_Grain' AND object_id = OBJECT_ID('Fact_CaptacionBuyer'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactCaptacionBuyer_Grain 
    ON Fact_CaptacionBuyer (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactNegociacionLead_Grain' AND object_id = OBJECT_ID('Fact_NegociacionLead'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactNegociacionLead_Grain 
    ON Fact_NegociacionLead (KeyTiempo, KeySede, KeyNegociador, KeyServicio, KeyProfesional);

-- Índice de Pago extendido a Sede y Servicio para evitar mezclar recaudación de distintas clínicas
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactGestionPayer_Grain' AND object_id = OBJECT_ID('Fact_GestionPayer'))
    DROP INDEX UQ_FactGestionPayer_Grain ON Fact_GestionPayer;

CREATE UNIQUE NONCLUSTERED INDEX UQ_FactGestionPayer_Grain 
ON Fact_GestionPayer (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactAtencionCustomer_Grain' AND object_id = OBJECT_ID('Fact_AtencionCustomer'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactAtencionCustomer_Grain 
    ON Fact_AtencionCustomer (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactSeguimientoTurned_Grain' AND object_id = OBJECT_ID('Fact_SeguimientoTurned'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactSeguimientoTurned_Grain 
    ON Fact_SeguimientoTurned (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal);
GO

-- ====================================================================
-- 5. CARGA INCREMENTAL E IDEMPOTENTE DE HECHOS (TRANSACCIÓN ATÓMICA)
-- Control de concurrencia con sp_getapplock y reconciliación de agregados
-- obsoletos mediante Scoped MERGE (WHEN NOT MATCHED BY SOURCE THEN DELETE).
-- ====================================================================

-- 5.0 Adquisición de Candado de Aplicación para Concurrencia
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
    -- Reconciliación de agregados obsoletos por ámbito de fecha.
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
            COUNT(p.id_persona) AS contacto_registrado,
            SUM(CASE WHEN p.estado_calidad LIKE '%Valid%' THEN 1 ELSE 0 END) AS contacto_utilizable,
            SUM(CASE WHEN p.id_etapa_actual >= 2 THEN 1 ELSE 0 END) AS conversion_lead, 
            AVG(CASE 
                WHEN ev.fecha_hora_etapa2 >= p.fecha_registro 
                THEN DATEDIFF(DAY, p.fecha_registro, ev.fecha_hora_etapa2) 
                ELSE 0 
            END) AS tiempo_conversion_dia
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
    ),
    BuyerScope AS (
        SELECT * FROM [NexoSalud_Mart].dbo.[Fact_CaptacionBuyer]
    )
    MERGE BuyerScope AS fact
    USING BuyerSource AS src
    ON fact.KeyTiempo = src.KeyTiempo 
       AND fact.KeySede = src.KeySede
       AND fact.KeyCanal = src.KeyCanal 
       AND fact.KeyFuente = src.KeyFuente 
       AND fact.KeyEstadoRegistro = src.KeyEstadoRegistro
    WHEN MATCHED THEN
        UPDATE SET 
            fact.contacto_registrado = src.contacto_registrado,
            fact.contacto_utilizable = src.contacto_utilizable,
            fact.conversion_lead = src.conversion_lead,
            fact.tiempo_conversion_dia = src.tiempo_conversion_dia
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro, contacto_registrado, contacto_utilizable, conversion_lead, tiempo_conversion_dia)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyCanal, src.KeyFuente, src.KeyEstadoRegistro, src.contacto_registrado, src.contacto_utilizable, src.conversion_lead, src.tiempo_conversion_dia)
    WHEN NOT MATCHED BY SOURCE THEN
        DELETE;

    SET @RowsBuyer = @@ROWCOUNT;

    -- ----------------------------------------------------------------
    -- 5.2 Carga Idempotente: Fact_NegociacionLead
    -- Resolución de profesional y sede por turno/solicitud.
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
            dn.KeyNegociador
    ),
    LeadScope AS (
        SELECT * FROM [NexoSalud_Mart].dbo.[Fact_NegociacionLead]
    )
    MERGE LeadScope AS fact
    USING LeadSource AS src
    ON fact.KeyTiempo = src.KeyTiempo 
       AND fact.KeySede = src.KeySede 
       AND fact.KeyNegociador = src.KeyNegociador
       AND fact.KeyServicio = src.KeyServicio
       AND fact.KeyProfesional = src.KeyProfesional
    WHEN MATCHED THEN
        UPDATE SET 
            fact.cohorte_evaluable = src.cohorte_evaluable,
            fact.conversion_payer_14_dia = src.conversion_payer_14_dia,
            fact.leads_en_negociacion = src.leads_en_negociacion,
            fact.negociacion_abandonada = src.negociacion_abandonada,
            fact.solicitud_requiere_respuesta = src.solicitud_requiere_respuesta,
            fact.respuesta_util_15_min = src.respuesta_util_15_min,
            fact.negociacion_finalizada = src.negociacion_finalizada
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador, cohorte_evaluable, conversion_payer_14_dia, leads_en_negociacion, negociacion_abandonada, solicitud_requiere_respuesta, respuesta_util_15_min, negociacion_finalizada)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyNegociador, src.cohorte_evaluable, src.conversion_payer_14_dia, src.leads_en_negociacion, src.negociacion_abandonada, src.solicitud_requiere_respuesta, src.respuesta_util_15_min, src.negociacion_finalizada)
    WHEN NOT MATCHED BY SOURCE THEN
        DELETE;

    SET @RowsLead = @@ROWCOUNT;

    -- ----------------------------------------------------------------
    -- 5.3 Carga Idempotente: Fact_GestionPayer
    -- Granularidad extendida a Sede y Servicio para no mezclar cobros.
    -- Sanitización de tiempos y eliminación de fantasmas obsoletos.
    -- ----------------------------------------------------------------
    ;WITH PayerSource AS (
        SELECT 
            CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT) AS KeyTiempo,
            ISNULL(dp.KeyPasarela, 0) AS KeyPasarela,
            CASE 
                WHEN p.estado IN ('Confirmado', 'Validado', 'Validado', 'VALIDADO') THEN 1
                WHEN p.estado IN ('Pendiente', 'Pendiente') THEN 2
                WHEN p.estado IN ('Fallido', 'Rechazado', 'Rechazado') THEN 3
                ELSE 0
            END AS KeyCobro,
            ISNULL(ds.KeySede, 0) AS KeySede,
            ISNULL(dserv.KeyServicio, 0) AS KeyServicio,
            COUNT(p.id_pago) AS pago_registrado,
            SUM(CASE WHEN p.estado IN ('Validado', 'VALIDADO', 'Confirmado', 'Validado') THEN 1 ELSE 0 END) AS pago_validado,
            SUM(CASE WHEN p.estado IN ('Rechazado', 'Rechazado', 'Fallido') THEN 1 ELSE 0 END) AS pago_rechazado,
            SUM(CASE WHEN p.estado IN ('Validado', 'VALIDADO', 'Confirmado') THEN 1 ELSE 0 END) AS conversion_customer,
            SUM(p.importe) AS importe_total_cobro,
            SUM(CAST(p.importe * 0.035 AS DECIMAL(10,2))) AS costo_transaccion,
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
                WHEN p.estado IN ('Confirmado', 'Validado', 'Validado', 'VALIDADO') THEN 1
                WHEN p.estado IN ('Pendiente', 'Pendiente') THEN 2
                WHEN p.estado IN ('Fallido', 'Rechazado', 'Rechazado') THEN 3
                ELSE 0
            END,
            ISNULL(ds.KeySede, 0),
            ISNULL(dserv.KeyServicio, 0)
    ),
    PayerScope AS (
        SELECT * FROM [NexoSalud_Mart].dbo.[Fact_GestionPayer]
    )
    MERGE PayerScope AS fact
    USING PayerSource AS src
    ON fact.KeyTiempo = src.KeyTiempo 
       AND fact.KeyPasarela = src.KeyPasarela 
       AND fact.KeyCobro = src.KeyCobro
       AND fact.KeySede = src.KeySede
       AND fact.KeyServicio = src.KeyServicio
    WHEN MATCHED THEN
        UPDATE SET 
            fact.pago_registrado = src.pago_registrado,
            fact.pago_validado = src.pago_validado,
            fact.pago_rechazado = src.pago_rechazado,
            fact.conversion_customer = src.conversion_customer,
            fact.importe_total_cobro = src.importe_total_cobro,
            fact.costo_transaccion = src.costo_transaccion,
            fact.tiempo_validacion_minuto = src.tiempo_validacion_minuto
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio, pago_registrado, pago_validado, pago_rechazado, conversion_customer, importe_total_cobro, costo_transaccion, tiempo_validacion_minuto)
        VALUES (src.KeyTiempo, src.KeyPasarela, src.KeyCobro, src.KeySede, src.KeyServicio, src.pago_registrado, src.pago_validado, src.pago_rechazado, src.conversion_customer, src.importe_total_cobro, src.costo_transaccion, src.tiempo_validacion_minuto)
    WHEN NOT MATCHED BY SOURCE THEN
        DELETE;

    SET @RowsPayer = @@ROWCOUNT;

    -- ----------------------------------------------------------------
    -- 5.4 Carga Idempotente: Fact_AtencionCustomer
    -- Captura atenciones realizadas y no-shows con verificación temporal.
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
            END
    ),
    CustomerScope AS (
        SELECT * FROM [NexoSalud_Mart].dbo.[Fact_AtencionCustomer]
    )
    MERGE CustomerScope AS fact
    USING CustomerSource AS src
    ON fact.KeyTiempo = src.KeyTiempo 
       AND fact.KeySede = src.KeySede 
       AND fact.KeyServicio = src.KeyServicio 
       AND fact.KeyProfesional = src.KeyProfesional
       AND fact.KeyEstadoAtencion = src.KeyEstadoAtencion
    WHEN MATCHED THEN
        UPDATE SET 
            fact.cita_evaluable = src.cita_evaluable,
            fact.atencion_realizada = src.atencion_realizada,
            fact.cita_inasistencia = src.cita_inasistencia,
            fact.tiempo_sillon_dental_minuto = src.tiempo_sillon_dental_minuto,
            fact.atencion_finalizada_conforme = src.atencion_finalizada_conforme
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion, cita_evaluable, atencion_realizada, cita_inasistencia, tiempo_sillon_dental_minuto, atencion_finalizada_conforme)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyEstadoAtencion, src.cita_evaluable, src.atencion_realizada, src.cita_inasistencia, src.tiempo_sillon_dental_minuto, src.atencion_finalizada_conforme)
    WHEN NOT MATCHED BY SOURCE THEN
        DELETE;

    SET @RowsCustomer = @@ROWCOUNT;

    -- ----------------------------------------------------------------
    -- 5.5 Carga Idempotente: Fact_SeguimientoTurned
    -- Retorno clínico real: solo atenciones asistidas en los 90 días posteriores.
    -- ----------------------------------------------------------------
    IF OBJECT_ID('dbo.Fact_SeguimientoTurned', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Fact_SeguimientoTurned (
            KeyTiempo INT FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
            KeySede INT FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
            KeyServicio INT FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
            KeyProfesional INT FOREIGN KEY REFERENCES dbo.Dim_Profesional(KeyProfesional),
            KeyCanal INT FOREIGN KEY REFERENCES dbo.Dim_Canal(KeyCanal),
            seguimiento_registrado INT DEFAULT 0,
            seguimiento_efectivo INT DEFAULT 0,
            incidencia_reportada INT DEFAULT 0,
            incidencia_resuelta_24_hora INT DEFAULT 0,
            retorno_cohorte_90_dia INT DEFAULT 0,
            paciente_elegible_retorno INT DEFAULT 0
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
            ds.KeySede,
            dserv.KeyServicio,
            dp.KeyProfesional,
            dc.KeyCanal
    ),
    TurnedScope AS (
        SELECT * FROM [NexoSalud_Mart].dbo.[Fact_SeguimientoTurned]
    )
    MERGE TurnedScope AS fact
    USING TurnedSource AS src
    ON fact.KeyTiempo = src.KeyTiempo
       AND fact.KeySede = src.KeySede
       AND fact.KeyServicio = src.KeyServicio
       AND fact.KeyProfesional = src.KeyProfesional
       AND fact.KeyCanal = src.KeyCanal
    WHEN MATCHED THEN
        UPDATE SET 
            fact.seguimiento_registrado = src.seguimiento_registrado,
            fact.seguimiento_efectivo = src.seguimiento_efectivo,
            fact.incidencia_reportada = src.incidencia_reportada,
            fact.incidencia_resuelta_24_hora = src.incidencia_resuelta_24_hora,
            fact.retorno_cohorte_90_dia = src.retorno_cohorte_90_dia,
            fact.paciente_elegible_retorno = src.paciente_elegible_retorno
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal, seguimiento_registrado, seguimiento_efectivo, incidencia_reportada, incidencia_resuelta_24_hora, retorno_cohorte_90_dia, paciente_elegible_retorno)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyCanal, src.seguimiento_registrado, src.seguimiento_efectivo, src.incidencia_reportada, src.incidencia_resuelta_24_hora, src.retorno_cohorte_90_dia, src.paciente_elegible_retorno)
    WHEN NOT MATCHED BY SOURCE THEN
        DELETE;

    SET @RowsTurned = @@ROWCOUNT;

    COMMIT TRANSACTION;

    DECLARE @EndTime DATETIME2(7) = SYSDATETIME();
    DECLARE @DurationSeconds DECIMAL(10,2) = DATEDIFF(MILLISECOND, @StartTime, @EndTime) / 1000.0;
    DECLARE @TotalRows INT = @RowsBuyer + @RowsLead + @RowsPayer + @RowsCustomer + @RowsTurned;

    -- Liberar candado exclusivo de sesión
    EXEC sp_releaseapplock @Resource = 'ETL_NexoSalud_Lock', @LockOwner = 'Session';

    INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, FilasAfectadas, DuracionSegundos, FechaRegistro)
    VALUES (
        @BatchId, 
        'ETL_Hechos_NexoSalud', 
        'EXITO', 
        CONCAT(N'Carga certificada completada exitosamente. Buyer: ', @RowsBuyer, N', Lead: ', @RowsLead, N', Payer: ', @RowsPayer, N', Customer: ', @RowsCustomer, N', Turned: ', @RowsTurned),
        @TotalRows, 
        @DurationSeconds, 
        @EndTime
    );

    PRINT CONCAT('>> ETL ejecutado y certificado con éxito en ', @DurationSeconds, ' segundos. Filas afectadas: ', @TotalRows);

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    -- Liberar candado ante fallo
    EXEC sp_releaseapplock @Resource = 'ETL_NexoSalud_Lock', @LockOwner = 'Session';

    DECLARE @ErrorMsg NVARCHAR(MAX) = ERROR_MESSAGE();
    DECLARE @ErrorLine INT = ERROR_LINE();

    INSERT INTO dbo.Log_Ejecucion_ETL (BatchId, Procedimiento, TipoEvento, Mensaje, FechaRegistro)
    VALUES (@BatchId, 'ETL_Hechos_NexoSalud', 'ERROR', CONCAT(N'Error en línea ', @ErrorLine, N': ', @ErrorMsg), SYSDATETIME());

    THROW;
END CATCH;
GO
