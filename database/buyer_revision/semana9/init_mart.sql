-- REVISION BUYER / BASE: archivos originales de Semana 9.
-- Solo crear desde cero en una instancia/copia de pruebas.
-- Para bases existentes usar migracion_buyer.sql; no repetir CREATE de tablas OLTP.
-- No ejecutar simultaneamente el syncBuyer antiguo del backend.

-- ====================================================================
-- NEXOSALUD — DATA MART DIMENSIONAL (MODELO ESTRELLA CONFORMADO)
-- Esquema: NexoSalud_Mart
-- Motor: Microsoft SQL Server 2019 / 2022
-- ====================================================================

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'NexoSalud_Mart')
BEGIN
    CREATE DATABASE NexoSalud_Mart;
END;
GO

USE NexoSalud_Mart;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ====================================================================
-- 1. CREACIÓN DE TABLAS DIMENSIONALES (CONFORMADAS Y DE CATÁLOGO)
-- ====================================================================

-- 1.1 Dimensión Tiempo (Conformada para las etapas analíticas)
IF OBJECT_ID('dbo.Dim_Tiempo', 'U') IS NULL
CREATE TABLE dbo.Dim_Tiempo (
    KeyTiempo INT PRIMARY KEY, 
    id_fecha DATE NOT NULL,
    Anio INT NOT NULL,
    Trimestre INT NOT NULL,
    Mes INT NOT NULL,
    Dia INT NOT NULL
);
GO

-- 1.2 Dimensión Hora (Para PAYER y CUSTOMER)
IF OBJECT_ID('dbo.Dim_Hora', 'U') IS NULL
CREATE TABLE dbo.Dim_Hora (
    KeyHora INT IDENTITY(1,1) PRIMARY KEY,
    id_hora INT NOT NULL,
    Turno VARCHAR(50),
    Hora INT,
    Minuto INT
);
GO

-- 1.3 Dimensión Sede (Conformada para las etapas clínicas y comerciales)
IF OBJECT_ID('dbo.Dim_Sede', 'U') IS NULL
CREATE TABLE dbo.Dim_Sede (
    KeySede INT IDENTITY(1,1) PRIMARY KEY,
    id_sede INT NULL,
    Sede VARCHAR(100),
    Distrito VARCHAR(100),
    Zona VARCHAR(100)
);
GO

-- 1.4 Dimensión Servicio (Conformada para las etapas analíticas)
IF OBJECT_ID('dbo.Dim_Servicio', 'U') IS NULL
CREATE TABLE dbo.Dim_Servicio (
    KeyServicio INT IDENTITY(1,1) PRIMARY KEY,
    id_servicio INT NULL,
    ServicioOdontologico VARCHAR(100),
    Categoria VARCHAR(100),
    Procedimiento VARCHAR(100)
);
GO

-- 1.5 Dimensión Canal (Para BUYER y SEGUIMIENTO)
IF OBJECT_ID('dbo.Dim_Canal', 'U') IS NULL
CREATE TABLE dbo.Dim_Canal (
    KeyCanal INT IDENTITY(1,1) PRIMARY KEY,
    id_canal INT NULL,
    NombreCanal VARCHAR(50),
    TipoMedio VARCHAR(50)
);
GO

-- 1.6 Dimensión Fuente / Campaña (Para BUYER)
IF OBJECT_ID('dbo.Dim_Fuente', 'U') IS NULL
CREATE TABLE dbo.Dim_Fuente (
    KeyFuente INT IDENTITY(1,1) PRIMARY KEY,
    id_fuente INT NULL,
    id_campana INT NULL,
    TipoOrigen VARCHAR(100),
    Campana VARCHAR(150)
);
GO

-- 1.7 Dimensión Estado del Registro (Para BUYER)
IF OBJECT_ID('dbo.Dim_EstadoRegistro', 'U') IS NULL
CREATE TABLE dbo.Dim_EstadoRegistro (
    KeyEstadoRegistro INT IDENTITY(1,1) PRIMARY KEY,
    EstadoCalidad VARCHAR(50),
    AutorizacionContacto VARCHAR(2)
);
GO

-- 1.8 Dimensión Tipo Persona / Perfil Buyer
IF OBJECT_ID('dbo.Dim_TipoPersona', 'U') IS NULL
CREATE TABLE dbo.Dim_TipoPersona (
    KeyTipoPersona INT IDENTITY(1,1) PRIMARY KEY,
    id_persona INT NULL,
    Ocupacion VARCHAR(100),
    RangoEdad VARCHAR(50)
);
GO

-- 1.9 Dimensión Pagador (Para PAYER)
IF OBJECT_ID('dbo.Dim_Pagador', 'U') IS NULL
CREATE TABLE dbo.Dim_Pagador (
    KeyPagador INT IDENTITY(1,1) PRIMARY KEY,
    id_persona INT NULL,
    Ocupacion VARCHAR(100),
    RangoEdad VARCHAR(50),
    EstadoCivil VARCHAR(50),
    NivelIngreso VARCHAR(50)
);
GO

-- 1.10 Dimensión Profesional (Para LEAD, CUSTOMER y TURNED)
IF OBJECT_ID('dbo.Dim_Profesional', 'U') IS NULL
CREATE TABLE dbo.Dim_Profesional (
    KeyProfesional INT IDENTITY(1,1) PRIMARY KEY,
    id_profesional INT NULL,
    Odontologo VARCHAR(100),
    EspecialidadPrincipal VARCHAR(100)
);
GO

-- 1.11 Dimensión Negociador (Para LEAD)
IF OBJECT_ID('dbo.Dim_Negociador', 'U') IS NULL
CREATE TABLE dbo.Dim_Negociador (
    KeyNegociador INT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT NULL,
    NombreNegociador VARCHAR(100)
);
GO

-- 1.12 Dimensión Pasarela (Para PAYER)
IF OBJECT_ID('dbo.Dim_Pasarela', 'U') IS NULL
CREATE TABLE dbo.Dim_Pasarela (
    KeyPasarela INT IDENTITY(1,1) PRIMARY KEY,
    MetodoPago VARCHAR(50),
    EntidadFinanciera VARCHAR(100),
    TipoMedio VARCHAR(50)
);
GO

-- 1.13 Dimensión Cobro (Para PAYER)
IF OBJECT_ID('dbo.Dim_Cobro', 'U') IS NULL
CREATE TABLE dbo.Dim_Cobro (
    KeyCobro INT IDENTITY(1,1) PRIMARY KEY,
    EstadoPago VARCHAR(50),
    ComprobanteAdjunto VARCHAR(2)
);
GO

-- 1.14 Dimensión Estado Atención (Para CUSTOMER)
IF OBJECT_ID('dbo.Dim_EstadoAtencion', 'U') IS NULL
CREATE TABLE dbo.Dim_EstadoAtencion (
    KeyEstadoAtencion INT IDENTITY(1,1) PRIMARY KEY,
    EstadoFinal VARCHAR(50),
    Asistencia VARCHAR(50)
);
GO

-- ====================================================================
-- 2. CREACIÓN DE TABLAS DE HECHOS (FACT TABLES CON LLAVE PRIMARIA COMPUESTA)
-- ====================================================================

-- 2.1 Hecho BUYER: UNA fila por captacion inicial/persona.
IF OBJECT_ID('dbo.fact_captacion_buyer','U') IS NULL
CREATE TABLE dbo.fact_captacion_buyer (
    id_persona INT NOT NULL CONSTRAINT PK_FactBuyer_Atomico PRIMARY KEY,
    id_captacion INT NOT NULL CONSTRAINT UQ_FactBuyer_Captacion UNIQUE,
    KeyTiempo INT NOT NULL REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeyTiempoConversion INT NULL REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeySede INT NOT NULL REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT NOT NULL REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyCanal INT NOT NULL REFERENCES dbo.Dim_Canal(KeyCanal),
    KeyFuente INT NOT NULL REFERENCES dbo.Dim_Fuente(KeyFuente),
    KeyTipoPersona INT NOT NULL REFERENCES dbo.Dim_TipoPersona(KeyTipoPersona),
    KeyEstadoRegistro INT NOT NULL REFERENCES dbo.Dim_EstadoRegistro(KeyEstadoRegistro),
    contacto_registrado INT NOT NULL CONSTRAINT CK_FactBuyer_Registrado CHECK (contacto_registrado=1),
    contacto_utilizable INT NOT NULL CONSTRAINT CK_FactBuyer_Utilizable CHECK (contacto_utilizable IN (0,1)),
    conversion_lead INT NOT NULL CONSTRAINT CK_FactBuyer_Conversion CHECK (conversion_lead IN (0,1)),
    tiempo_conversion_dia DECIMAL(18,6) NULL,
    costo_atribuido_captacion DECIMAL(14,2) NULL,
    fecha_captacion DATETIME2 NOT NULL,
    fecha_conversion DATETIME2 NULL,
    id_evento_conversion INT NULL,
    origen_datos VARCHAR(30) NOT NULL,
    fecha_corte_etl DATETIME2 NOT NULL,
    CONSTRAINT CK_FactBuyer_Evidencia CHECK (
        (conversion_lead=0 AND fecha_conversion IS NULL AND id_evento_conversion IS NULL
         AND tiempo_conversion_dia IS NULL AND KeyTiempoConversion IS NULL)
        OR (conversion_lead=1 AND fecha_conversion IS NOT NULL
            AND tiempo_conversion_dia IS NOT NULL AND fecha_conversion>=fecha_captacion
            AND id_evento_conversion IS NOT NULL AND tiempo_conversion_dia>=0
            AND KeyTiempoConversion IS NOT NULL)
    )
);
GO
IF COL_LENGTH('dbo.fact_captacion_buyer','id_persona') IS NULL
    THROW 51100,'Existe el hecho agregado antiguo: ejecutar migracion_buyer.sql primero.',1;
GO

-- 2.2 Hecho: NEGOCIACIÓN LEAD (Grano: Día, Sede, Servicio, Profesional, Negociador)
IF OBJECT_ID('dbo.fact_negociacion_lead', 'U') IS NULL
CREATE TABLE dbo.fact_negociacion_lead (
    KeyTiempo INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeySede INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyProfesional INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Profesional(KeyProfesional),
    KeyNegociador INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Negociador(KeyNegociador),
    
    -- Medidas
    cohorte_evaluable INT DEFAULT 0,
    conversion_payer_14_dia INT DEFAULT 0,
    solicitud_requiere_respuesta INT DEFAULT 0,
    respuesta_util_15_min INT DEFAULT 0,
    negociacion_finalizada INT DEFAULT 0,
    negociacion_abandonada INT DEFAULT 0,
    leads_en_negociacion INT DEFAULT 0,

    CONSTRAINT PK_Fact_NegociacionLead PRIMARY KEY (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador)
);
GO

-- 2.3 Hecho: GESTIÓN PAYER (Grano: Día, Pasarela, Cobro, Sede, Servicio)
IF OBJECT_ID('dbo.fact_gestion_payer', 'U') IS NULL
CREATE TABLE dbo.fact_gestion_payer (
    KeyTiempo INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeyHora INT NULL FOREIGN KEY REFERENCES dbo.Dim_Hora(KeyHora),
    KeySede INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyFuente INT NULL FOREIGN KEY REFERENCES dbo.Dim_Fuente(KeyFuente),
    KeyPasarela INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Pasarela(KeyPasarela),
    KeyPagador INT NULL FOREIGN KEY REFERENCES dbo.Dim_Pagador(KeyPagador),
    KeyCobro INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Cobro(KeyCobro),
    
    -- Medidas
    pago_registrado INT DEFAULT 0,
    pago_validado INT DEFAULT 0,
    pago_rechazado INT DEFAULT 0,
    conversion_customer INT DEFAULT 0,
    importe_total_cobro DECIMAL(12,2) DEFAULT 0.00,
    costo_transaccion DECIMAL(10,2) DEFAULT 0.00,
    tiempo_validacion_minuto INT DEFAULT 0,

    CONSTRAINT PK_Fact_GestionPayer PRIMARY KEY (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio)
);
GO

-- 2.4 Hecho: ATENCIÓN CUSTOMER (Grano: Día, Sede, Servicio, Profesional, Estado Atención)
IF OBJECT_ID('dbo.fact_atencion_customer', 'U') IS NULL
CREATE TABLE dbo.fact_atencion_customer (
    KeyTiempo INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeyHora INT NULL FOREIGN KEY REFERENCES dbo.Dim_Hora(KeyHora),
    KeySede INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyProfesional INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Profesional(KeyProfesional),
    KeyEstadoAtencion INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_EstadoAtencion(KeyEstadoAtencion),
    
    -- Medidas
    cita_evaluable INT DEFAULT 0,
    atencion_realizada INT DEFAULT 0,
    cita_inasistencia INT DEFAULT 0,
    tiempo_sillon_dental_minuto INT DEFAULT 0,
    atencion_finalizada_conforme INT DEFAULT 0,

    CONSTRAINT PK_Fact_AtencionCustomer PRIMARY KEY (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion)
);
GO

-- 2.5 Hecho: SEGUIMIENTO TURNED (Grano: Día, Sede, Servicio, Profesional, Canal)
IF OBJECT_ID('dbo.fact_seguimiento_turned', 'U') IS NULL
CREATE TABLE dbo.fact_seguimiento_turned (
    KeyTiempo INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeySede INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyProfesional INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Profesional(KeyProfesional),
    KeyCanal INT NOT NULL FOREIGN KEY REFERENCES dbo.Dim_Canal(KeyCanal),
    
    -- Medidas
    seguimiento_registrado INT DEFAULT 0,
    seguimiento_efectivo INT DEFAULT 0,
    incidencia_reportada INT DEFAULT 0,
    incidencia_resuelta_24_hora INT DEFAULT 0,
    retorno_cohorte_90_dia INT DEFAULT 0,
    paciente_elegible_retorno INT DEFAULT 0,

    CONSTRAINT PK_Fact_SeguimientoTurned PRIMARY KEY (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal)
);
GO

-- ====================================================================
-- 3. SINÓNIMOS DE COMPATIBILIDAD (SOPORTE TANTO snake_case COMO PascalCase)
-- ====================================================================
IF OBJECT_ID('dbo.Fact_CaptacionBuyer', 'SN') IS NULL AND OBJECT_ID('dbo.Fact_CaptacionBuyer', 'U') IS NULL
    CREATE SYNONYM dbo.Fact_CaptacionBuyer FOR dbo.fact_captacion_buyer;
IF OBJECT_ID('dbo.Fact_NegociacionLead', 'SN') IS NULL AND OBJECT_ID('dbo.Fact_NegociacionLead', 'U') IS NULL
    CREATE SYNONYM dbo.Fact_NegociacionLead FOR dbo.fact_negociacion_lead;
IF OBJECT_ID('dbo.Fact_GestionPayer', 'SN') IS NULL AND OBJECT_ID('dbo.Fact_GestionPayer', 'U') IS NULL
    CREATE SYNONYM dbo.Fact_GestionPayer FOR dbo.fact_gestion_payer;
IF OBJECT_ID('dbo.Fact_AtencionCustomer', 'SN') IS NULL AND OBJECT_ID('dbo.Fact_AtencionCustomer', 'U') IS NULL
    CREATE SYNONYM dbo.Fact_AtencionCustomer FOR dbo.fact_atencion_customer;
IF OBJECT_ID('dbo.Fact_SeguimientoTurned', 'SN') IS NULL AND OBJECT_ID('dbo.Fact_SeguimientoTurned', 'U') IS NULL
    CREATE SYNONYM dbo.Fact_SeguimientoTurned FOR dbo.fact_seguimiento_turned;
GO
