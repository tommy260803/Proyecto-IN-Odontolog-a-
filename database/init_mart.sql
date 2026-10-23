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
-- 2. CREACIÓN DE TABLAS DE HECHOS (FACT TABLES)
-- ====================================================================

-- 2.1 Hecho: CAPTACIÓN BUYER
IF OBJECT_ID('dbo.Fact_CaptacionBuyer', 'U') IS NULL
CREATE TABLE dbo.Fact_CaptacionBuyer (
    KeyTiempo INT FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeySede INT FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyCanal INT FOREIGN KEY REFERENCES dbo.Dim_Canal(KeyCanal),
    KeyFuente INT FOREIGN KEY REFERENCES dbo.Dim_Fuente(KeyFuente),
    KeyTipoPersona INT FOREIGN KEY REFERENCES dbo.Dim_TipoPersona(KeyTipoPersona),
    KeyEstadoRegistro INT FOREIGN KEY REFERENCES dbo.Dim_EstadoRegistro(KeyEstadoRegistro),
    
    -- Medidas
    ContactosRegistrados INT DEFAULT 0,
    ContactosUtilizables INT DEFAULT 0,
    ConversionesALead INT DEFAULT 0,
    TiempoConversionDias INT DEFAULT 0,
    CostoAtribuidoCaptacion DECIMAL(10,2) DEFAULT 0.00
);
GO

-- 2.2 Hecho: NEGOCIACIÓN LEAD
IF OBJECT_ID('dbo.Fact_NegociacionLead', 'U') IS NULL
CREATE TABLE dbo.Fact_NegociacionLead (
    KeyTiempo INT FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeySede INT FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyProfesional INT FOREIGN KEY REFERENCES dbo.Dim_Profesional(KeyProfesional),
    KeyNegociador INT FOREIGN KEY REFERENCES dbo.Dim_Negociador(KeyNegociador),
    
    -- Medidas
    LeadsCohorteEvaluable INT DEFAULT 0,
    LeadsConvertidosPayer14Dias INT DEFAULT 0,
    LeadsRequierenRespuesta INT DEFAULT 0,
    LeadsRespuestaUtil15Min INT DEFAULT 0,
    LeadsResultadoFinal INT DEFAULT 0,
    LeadsAbandonados INT DEFAULT 0,
    LeadsEnNegociacion INT DEFAULT 0
);
GO

-- 2.3 Hecho: GESTIÓN PAYER
IF OBJECT_ID('dbo.Fact_GestionPayer', 'U') IS NULL
CREATE TABLE dbo.Fact_GestionPayer (
    KeyTiempo INT FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeyHora INT FOREIGN KEY REFERENCES dbo.Dim_Hora(KeyHora),
    KeySede INT FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyFuente INT FOREIGN KEY REFERENCES dbo.Dim_Fuente(KeyFuente),
    KeyPasarela INT FOREIGN KEY REFERENCES dbo.Dim_Pasarela(KeyPasarela),
    KeyPagador INT FOREIGN KEY REFERENCES dbo.Dim_Pagador(KeyPagador),
    KeyCobro INT FOREIGN KEY REFERENCES dbo.Dim_Cobro(KeyCobro),
    
    -- Medidas
    PagosRegistrados INT DEFAULT 0,
    PagosValidados INT DEFAULT 0,
    PagosRechazados INT DEFAULT 0,
    ConversionesACustomer INT DEFAULT 0,
    ImporteTotalCobro DECIMAL(12,2) DEFAULT 0.00,
    CostoTotalTransacciones DECIMAL(10,2) DEFAULT 0.00,
    TiempoTotalValidacionMin INT DEFAULT 0
);
GO

-- 2.4 Hecho: ATENCIÓN CUSTOMER
IF OBJECT_ID('dbo.Fact_AtencionCustomer', 'U') IS NULL
CREATE TABLE dbo.Fact_AtencionCustomer (
    KeyTiempo INT FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeyHora INT FOREIGN KEY REFERENCES dbo.Dim_Hora(KeyHora),
    KeySede INT FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyProfesional INT FOREIGN KEY REFERENCES dbo.Dim_Profesional(KeyProfesional),
    KeyEstadoAtencion INT FOREIGN KEY REFERENCES dbo.Dim_EstadoAtencion(KeyEstadoAtencion),
    
    -- Medidas
    CitasEvaluables INT DEFAULT 0,
    AtencionesRealizadas INT DEFAULT 0,
    CitasConInasistencia INT DEFAULT 0,
    TiempoEnSillonDentalMin INT DEFAULT 0,
    AtencionesFinalizadasConformes INT DEFAULT 0
);
GO

-- 2.5 Hecho: SEGUIMIENTO TURNED
IF OBJECT_ID('dbo.Fact_SeguimientoTurned', 'U') IS NULL
CREATE TABLE dbo.Fact_SeguimientoTurned (
    KeyTiempo INT FOREIGN KEY REFERENCES dbo.Dim_Tiempo(KeyTiempo),
    KeySede INT FOREIGN KEY REFERENCES dbo.Dim_Sede(KeySede),
    KeyServicio INT FOREIGN KEY REFERENCES dbo.Dim_Servicio(KeyServicio),
    KeyProfesional INT FOREIGN KEY REFERENCES dbo.Dim_Profesional(KeyProfesional),
    KeyCanal INT FOREIGN KEY REFERENCES dbo.Dim_Canal(KeyCanal),
    
    -- Medidas
    SeguimientosRegistrados INT DEFAULT 0,
    SeguimientosEfectivos INT DEFAULT 0,
    IncidenciasReportadas INT DEFAULT 0,
    IncidenciasResueltas24h INT DEFAULT 0,
    RetornosCohorte90Dias INT DEFAULT 0,
    PacientesElegiblesRetorno INT DEFAULT 0
);
GO

-- ====================================================================
-- 3. ÍNDICES DE UNICIDAD FÍSICA PARA EL GRANO ANALÍTICO
-- ====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactCaptacionBuyer_Grain' AND object_id = OBJECT_ID('Fact_CaptacionBuyer'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactCaptacionBuyer_Grain 
    ON Fact_CaptacionBuyer (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactNegociacionLead_Grain' AND object_id = OBJECT_ID('Fact_NegociacionLead'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactNegociacionLead_Grain 
    ON Fact_NegociacionLead (KeyTiempo, KeySede, KeyNegociador, KeyServicio, KeyProfesional);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactGestionPayer_Grain' AND object_id = OBJECT_ID('Fact_GestionPayer'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactGestionPayer_Grain 
    ON Fact_GestionPayer (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactAtencionCustomer_Grain' AND object_id = OBJECT_ID('Fact_AtencionCustomer'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactAtencionCustomer_Grain 
    ON Fact_AtencionCustomer (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_FactSeguimientoTurned_Grain' AND object_id = OBJECT_ID('Fact_SeguimientoTurned'))
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FactSeguimientoTurned_Grain 
    ON Fact_SeguimientoTurned (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal);
GO
