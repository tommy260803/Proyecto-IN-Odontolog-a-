-- ============================================================================
-- SCRIPT DDL PROPUESTO: DATA MART DIMENSIONAL PARA FASE BUYER
-- Base de Datos: NexoSalud_Mart
-- Estado: PROPUESTA DE REDISEÑO (NO APLICAR EN ETAPA DE AUDITORÍA)
-- ============================================================================

USE NexoSalud_Mart;
GO

-- 1. ASEGURAR REGISTROS 'NO ESPECIFICADO' (KEY = 0) EN TODAS LAS DIMENSIONES
SET IDENTITY_INSERT dbo.Dim_Canal ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Canal WHERE KeyCanal = 0)
    INSERT INTO dbo.Dim_Canal (KeyCanal, id_canal, NombreCanal, TipoMedio) VALUES (0, 0, 'No especificado', 'Desconocido');
SET IDENTITY_INSERT dbo.Dim_Canal OFF;

SET IDENTITY_INSERT dbo.Dim_Fuente ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Fuente WHERE KeyFuente = 0)
    INSERT INTO dbo.Dim_Fuente (KeyFuente, id_fuente, id_campana, TipoOrigen, Campana) VALUES (0, 0, 0, 'No especificado', 'Sin campaña');
SET IDENTITY_INSERT dbo.Dim_Fuente OFF;

SET IDENTITY_INSERT dbo.Dim_Sede ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Sede WHERE KeySede = 0)
    INSERT INTO dbo.Dim_Sede (KeySede, id_sede, Sede, Zona, CapacidadSillones) VALUES (0, 0, 'No especificada', 'Por definir', 0);
SET IDENTITY_INSERT dbo.Dim_Sede OFF;

SET IDENTITY_INSERT dbo.Dim_Servicio ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Servicio WHERE KeyServicio = 0)
    INSERT INTO dbo.Dim_Servicio (KeyServicio, id_servicio, ServicioOdontologico, Categoria, Procedimiento) VALUES (0, 0, 'Consulta General No Especificada', 'Odontología Preventiva', 'Orientación');
SET IDENTITY_INSERT dbo.Dim_Servicio OFF;

SET IDENTITY_INSERT dbo.Dim_TipoPersona ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_TipoPersona WHERE KeyTipoPersona = 0)
    INSERT INTO dbo.Dim_TipoPersona (KeyTipoPersona, id_persona, Ocupacion, RangoEdad) VALUES (0, 0, 'No especificado', '18-45 años');
SET IDENTITY_INSERT dbo.Dim_TipoPersona OFF;
GO

-- 2. REESTRUCTURACIÓN DE LA TABLA DE HECHOS: fact_captacion_buyer
-- Grano: Una fila por Oportunidad de Captación (id_oportunidad)
IF OBJECT_ID('dbo.fact_captacion_buyer_v2', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.fact_captacion_buyer_v2 (
        id_captacion_buyer          BIGINT IDENTITY(1,1) PRIMARY KEY, -- Surrogate Key
        id_oportunidad_origen       INT NOT NULL UNIQUE,              -- Clave Natural de Negocio
        
        -- Claves Foráneas a Dimensiones Conformadas
        KeyTiempoCaptacion          INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeyTiempoConversion         INT NULL FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeySede                     INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
        KeyCanal                    INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Canal(KeyCanal),
        KeyFuente                   INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Fuente(KeyFuente),
        KeyServicioInteres          INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
        KeyTipoPersona              INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_TipoPersona(KeyTipoPersona),
        KeyEstadoRegistro           INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_EstadoRegistro(KeyEstadoRegistro),
        
        -- Medidas Base del Negocio
        contacto_registrado         INT NOT NULL DEFAULT 1,
        contacto_utilizable         INT NOT NULL DEFAULT 0,
        conversion_lead             INT NOT NULL DEFAULT 0,
        tiempo_conversion_dia       INT NULL DEFAULT 0,
        costo_atribuido_captacion   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        
        -- Auditoría Dimensional
        FechaCargaETL               DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );

    CREATE INDEX IX_FactBuyer_TiempoCaptacion ON dbo.fact_captacion_buyer_v2(KeyTiempoCaptacion);
    CREATE INDEX IX_FactBuyer_Sede ON dbo.fact_captacion_buyer_v2(KeySede);
    CREATE INDEX IX_FactBuyer_Canal ON dbo.fact_captacion_buyer_v2(KeyCanal);
    CREATE INDEX IX_FactBuyer_Servicio ON dbo.fact_captacion_buyer_v2(KeyServicioInteres);
    PRINT 'Tabla dimensional fact_captacion_buyer_v2 creada exitosamente.';
END
GO
