-- ============================================================================
-- MIGRACIÓN DE REDISEÑO: DATA MART DIMENSIONAL BUYER (NexoSalud_Mart)
-- Fecha: 2026-10-26
-- Objetivo:
-- 1. Incorporar miembros desconocidos (Key = 0) en todas las dimensiones vinculadas.
-- 2. Crear tabla de hechos atómica Fact_OportunidadCaptacion para granularidad exacta.
-- 3. Mantener compatibilidad absoluta con Fact_CaptacionBuyer agregada.
-- ============================================================================

USE NexoSalud_Mart;
GO

-- 1. MIEMBROS DESCONOCIDOS / NO APLICA (KEY = 0) EN DIMENSIONES CONFORMADAS

-- 1.1 Dim_Tiempo
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo WHERE KeyTiempo = 0)
BEGIN
    INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
    VALUES (0, '1900-01-01', 1900, 1, 1, 1);
    PRINT 'Dim_Tiempo: Miembro 0 insertado.';
END;
GO

-- 1.2 Dim_Sede
SET IDENTITY_INSERT dbo.Dim_Sede ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Sede WHERE KeySede = 0)
BEGIN
    INSERT INTO dbo.Dim_Sede (KeySede, id_sede, Sede, Distrito, Zona)
    VALUES (0, 0, 'Sede No Asignada', 'No Asignado', 'No Asignado');
    PRINT 'Dim_Sede: Miembro 0 insertado.';
END;
SET IDENTITY_INSERT dbo.Dim_Sede OFF;
GO

-- 1.3 Dim_Canal
SET IDENTITY_INSERT dbo.Dim_Canal ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Canal WHERE KeyCanal = 0)
BEGIN
    INSERT INTO dbo.Dim_Canal (KeyCanal, id_canal, NombreCanal, TipoMedio)
    VALUES (0, 0, 'Canal Desconocido', 'No Aplica');
    PRINT 'Dim_Canal: Miembro 0 insertado.';
END;
SET IDENTITY_INSERT dbo.Dim_Canal OFF;
GO

-- 1.4 Dim_Fuente
SET IDENTITY_INSERT dbo.Dim_Fuente ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Fuente WHERE KeyFuente = 0)
BEGIN
    INSERT INTO dbo.Dim_Fuente (KeyFuente, id_fuente, id_campana, TipoOrigen, Campana)
    VALUES (0, 0, 0, 'Directo / No Identificado', 'Sin Campaña');
    PRINT 'Dim_Fuente: Miembro 0 insertado.';
END;
SET IDENTITY_INSERT dbo.Dim_Fuente OFF;
GO

-- 1.5 Dim_Servicio
SET IDENTITY_INSERT dbo.Dim_Servicio ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Servicio WHERE KeyServicio = 0)
BEGIN
    INSERT INTO dbo.Dim_Servicio (KeyServicio, id_servicio, ServicioOdontologico, Categoria, Procedimiento)
    VALUES (0, 0, 'Consulta General No Especificada', 'Odontología General', 'Orientación General');
    PRINT 'Dim_Servicio: Miembro 0 insertado.';
END;
SET IDENTITY_INSERT dbo.Dim_Servicio OFF;
GO

-- 1.6 Dim_EstadoRegistro
SET IDENTITY_INSERT dbo.Dim_EstadoRegistro ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_EstadoRegistro WHERE KeyEstadoRegistro = 0)
BEGIN
    INSERT INTO dbo.Dim_EstadoRegistro (KeyEstadoRegistro, EstadoCalidad, AutorizacionContacto)
    VALUES (0, 'No Definido', 'NO');
    PRINT 'Dim_EstadoRegistro: Miembro 0 insertado.';
END;
SET IDENTITY_INSERT dbo.Dim_EstadoRegistro OFF;
GO

-- 1.7 Dim_TipoPersona
SET IDENTITY_INSERT dbo.Dim_TipoPersona ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_TipoPersona WHERE KeyTipoPersona = 0)
BEGIN
    INSERT INTO dbo.Dim_TipoPersona (KeyTipoPersona, id_persona, Ocupacion, RangoEdad)
    VALUES (0, 0, 'No Especificado', 'No Especificado');
    PRINT 'Dim_TipoPersona: Miembro 0 insertado.';
END;
SET IDENTITY_INSERT dbo.Dim_TipoPersona OFF;
GO

-- 2. TABLA DE HECHOS ATÓMICA: Fact_OportunidadCaptacion (Grano Oportunidad)
IF OBJECT_ID('dbo.Fact_OportunidadCaptacion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Fact_OportunidadCaptacion (
        id_captacion_buyer          BIGINT IDENTITY(1,1) PRIMARY KEY,
        id_oportunidad              INT NOT NULL UNIQUE,
        
        -- Claves Dimensionales
        KeyTiempoCaptacion          INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeyTiempoConversion         INT NULL FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeySede                     INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
        KeyCanal                    INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Canal(KeyCanal),
        KeyFuente                   INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Fuente(KeyFuente),
        KeyServicio                 INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
        KeyTipoPersona              INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_TipoPersona(KeyTipoPersona),
        KeyEstadoRegistro           INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_EstadoRegistro(KeyEstadoRegistro),
        
        -- Medidas de Rendimiento
        contacto_registrado         INT NOT NULL DEFAULT 1,
        contacto_utilizable         INT NOT NULL DEFAULT 0,
        conversion_lead             INT NOT NULL DEFAULT 0,
        tiempo_conversion_dia       INT NULL DEFAULT 0,
        costo_atribuido_captacion   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        
        -- Auditoría
        FechaCargaETL               DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );

    CREATE NONCLUSTERED INDEX IX_FactOportunidadCaptacion_Tiempo ON dbo.Fact_OportunidadCaptacion(KeyTiempoCaptacion);
    CREATE NONCLUSTERED INDEX IX_FactOportunidadCaptacion_Sede ON dbo.Fact_OportunidadCaptacion(KeySede);
    CREATE NONCLUSTERED INDEX IX_FactOportunidadCaptacion_Canal ON dbo.Fact_OportunidadCaptacion(KeyCanal);
    CREATE NONCLUSTERED INDEX IX_FactOportunidadCaptacion_Fuente ON dbo.Fact_OportunidadCaptacion(KeyFuente);
    CREATE NONCLUSTERED INDEX IX_FactOportunidadCaptacion_Servicio ON dbo.Fact_OportunidadCaptacion(KeyServicio);

    PRINT 'Fact_OportunidadCaptacion: Creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'Fact_OportunidadCaptacion: Ya existe.';
END;
GO
