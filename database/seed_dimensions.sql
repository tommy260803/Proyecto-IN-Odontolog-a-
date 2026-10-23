-- ====================================================================
-- NEXOSALUD — DATA MART DIMENSIONAL (NexoSalud_Mart)
-- POBLAMIENTO INICIAL, MIEMBROS CANÓNICOS (KEY=0) Y HOMOLOGACIÓN SCD TIPO 1
-- Motor: Microsoft SQL Server 2019 / 2022
-- ====================================================================

USE NexoSalud_Mart;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ====================================================================
-- 1. POBLAMIENTO INICIAL DIM_TIEMPO (CALENDARIO 2024 A 2030)
-- ====================================================================
IF (SELECT COUNT(*) FROM dbo.Dim_Tiempo WHERE KeyTiempo > 0) = 0
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
    INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
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
-- 3. HOMOLOGACIÓN Y POBLAMIENTO INICIAL SCD TIPO 1 (OLTP -> OLAP)
-- ====================================================================

-- 3.1 Homologación Dim_Sede
UPDATE dim
SET dim.Sede = oltp.Sede, dim.Distrito = oltp.Distrito, dim.Zona = oltp.Zona
FROM dbo.Dim_Sede dim
JOIN (
    SELECT id_sede, nombre AS Sede, zona AS Distrito, zona AS Zona 
    FROM [NexoSaludDB].dbo.[Sedes]
) oltp ON dim.id_sede = oltp.id_sede;

INSERT INTO dbo.Dim_Sede (id_sede, Sede, Distrito, Zona)
SELECT oltp.id_sede, oltp.Sede, oltp.Distrito, oltp.Zona
FROM (
    SELECT id_sede, nombre AS Sede, zona AS Distrito, zona AS Zona 
    FROM [NexoSaludDB].dbo.[Sedes]
) oltp
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_Sede dim WHERE dim.id_sede = oltp.id_sede
);
GO

-- 3.2 Homologación Dim_Servicio
UPDATE dim
SET dim.ServicioOdontologico = oltp.ServicioOdontologico, dim.Categoria = oltp.Categoria, dim.Procedimiento = oltp.Procedimiento
FROM dbo.Dim_Servicio dim
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

INSERT INTO dbo.Dim_Servicio (id_servicio, ServicioOdontologico, Categoria, Procedimiento)
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
    SELECT 1 FROM dbo.Dim_Servicio dim WHERE dim.id_servicio = oltp.id_servicio
);
GO

-- 3.3 Homologación Dim_Canal
UPDATE dim
SET dim.NombreCanal = oltp.NombreCanal, dim.TipoMedio = oltp.TipoMedio
FROM dbo.Dim_Canal dim
JOIN (
    SELECT id_canal, nombre AS NombreCanal, 'Digital' AS TipoMedio
    FROM [NexoSaludDB].dbo.[Canales]
) oltp ON dim.id_canal = oltp.id_canal;

INSERT INTO dbo.Dim_Canal (id_canal, NombreCanal, TipoMedio)
SELECT oltp.id_canal, oltp.NombreCanal, oltp.TipoMedio
FROM (
    SELECT id_canal, nombre AS NombreCanal, 'Digital' AS TipoMedio
    FROM [NexoSaludDB].dbo.[Canales]
) oltp
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_Canal dim WHERE dim.id_canal = oltp.id_canal
);
GO

-- 3.4 Homologación Dim_Fuente
UPDATE dim
SET dim.TipoOrigen = oltp.TipoOrigen, dim.Campana = oltp.Campana
FROM dbo.Dim_Fuente dim
JOIN (
    SELECT 
        c.id_fuente,
        c.id_campana,
        f.nombre AS TipoOrigen,
        c.nombre AS Campana
    FROM [NexoSaludDB].dbo.[Campanas] c
    JOIN [NexoSaludDB].dbo.[Fuentes] f ON c.id_fuente = f.id_fuente
) oltp ON dim.id_campana = oltp.id_campana;

INSERT INTO dbo.Dim_Fuente (id_fuente, id_campana, TipoOrigen, Campana)
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
    SELECT 1 FROM dbo.Dim_Fuente dim WHERE dim.id_campana = oltp.id_campana
);
GO

-- 3.5 Homologación Dim_Profesional
UPDATE dim
SET dim.Odontologo = oltp.Odontologo, dim.EspecialidadPrincipal = oltp.EspecialidadPrincipal
FROM dbo.Dim_Profesional dim
JOIN (
    SELECT id_profesional, CONCAT(nombres, ' ', apellidos) AS Odontologo, especialidad AS EspecialidadPrincipal
    FROM [NexoSaludDB].dbo.[Profesionales]
) oltp ON dim.id_profesional = oltp.id_profesional;

INSERT INTO dbo.Dim_Profesional (id_profesional, Odontologo, EspecialidadPrincipal)
SELECT oltp.id_profesional, oltp.Odontologo, oltp.EspecialidadPrincipal
FROM (
    SELECT id_profesional, CONCAT(nombres, ' ', apellidos) AS Odontologo, especialidad AS EspecialidadPrincipal
    FROM [NexoSaludDB].dbo.[Profesionales]
) oltp
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_Profesional dim WHERE dim.id_profesional = oltp.id_profesional
);
GO

-- 3.6 Homologación Dim_Negociador
UPDATE dim
SET dim.NombreNegociador = oltp.NombreNegociador
FROM dbo.Dim_Negociador dim
JOIN (
    SELECT id_usuario, CONCAT(nombres, ' ', apellidos) AS NombreNegociador
    FROM [NexoSaludDB].dbo.[Usuarios]
) oltp ON dim.id_usuario = oltp.id_usuario;

INSERT INTO dbo.Dim_Negociador (id_usuario, NombreNegociador)
SELECT oltp.id_usuario, oltp.NombreNegociador
FROM (
    SELECT id_usuario, CONCAT(nombres, ' ', apellidos) AS NombreNegociador
    FROM [NexoSaludDB].dbo.[Usuarios]
) oltp
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_Negociador dim WHERE dim.id_usuario = oltp.id_usuario
);
GO

-- 3.7 Homologación Dim_Pasarela
UPDATE dim
SET dim.EntidadFinanciera = src.EntidadFinanciera, dim.TipoMedio = src.TipoMedio
FROM dbo.Dim_Pasarela dim
JOIN (
    SELECT 1 AS KeyPasarela, 'Plin' AS MetodoPago, 'Interbank/BBVA' AS EntidadFinanciera, 'Billeteras Digitales' AS TipoMedio
    UNION ALL SELECT 2, 'Tarjeta (Web)', 'Niubiz/Culqi', 'Bancarizado'
    UNION ALL SELECT 3, 'Transferencia', 'Interbancaria', 'Bancarizado'
    UNION ALL SELECT 4, 'Yape', 'BCP', 'Billeteras Digitales'
) src ON dim.KeyPasarela = src.KeyPasarela;

INSERT INTO dbo.Dim_Pasarela (MetodoPago, EntidadFinanciera, TipoMedio)
SELECT src.MetodoPago, src.EntidadFinanciera, src.TipoMedio
FROM (
    SELECT 1 AS KeyPasarela, 'Plin' AS MetodoPago, 'Interbank/BBVA' AS EntidadFinanciera, 'Billeteras Digitales' AS TipoMedio
    UNION ALL SELECT 2, 'Tarjeta (Web)', 'Niubiz/Culqi', 'Bancarizado'
    UNION ALL SELECT 3, 'Transferencia', 'Interbancaria', 'Bancarizado'
    UNION ALL SELECT 4, 'Yape', 'BCP', 'Billeteras Digitales'
) src
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_Pasarela dim WHERE dim.MetodoPago = src.MetodoPago
);
GO

-- 3.8 Homologación Dim_Cobro
UPDATE dim
SET dim.EstadoPago = src.EstadoPago, dim.ComprobanteAdjunto = src.ComprobanteAdjunto
FROM dbo.Dim_Cobro dim
JOIN (
    SELECT 1 AS KeyCobro, 'Validado' AS EstadoPago, 'SI' AS ComprobanteAdjunto
    UNION ALL SELECT 2, 'Pendiente', 'NO'
    UNION ALL SELECT 3, 'Rechazado', 'NO'
) src ON dim.KeyCobro = src.KeyCobro;

INSERT INTO dbo.Dim_Cobro (EstadoPago, ComprobanteAdjunto)
SELECT src.EstadoPago, src.ComprobanteAdjunto
FROM (
    SELECT 1 AS KeyCobro, 'Validado' AS EstadoPago, 'SI' AS ComprobanteAdjunto
    UNION ALL SELECT 2, 'Pendiente', 'NO'
    UNION ALL SELECT 3, 'Rechazado', 'NO'
) src
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_Cobro dim WHERE dim.EstadoPago = src.EstadoPago
);
GO

-- 3.9 Homologación Dim_EstadoAtencion
UPDATE dim
SET dim.EstadoFinal = src.EstadoFinal, dim.Asistencia = src.Asistencia
FROM dbo.Dim_EstadoAtencion dim
JOIN (
    SELECT 1 AS KeyEstadoAtencion, 'Completada' AS EstadoFinal, 'Asistió' AS Asistencia
    UNION ALL SELECT 2, 'No Asistió', 'Inasistencia'
    UNION ALL SELECT 3, 'Cancelados', 'Cancelado'
) src ON dim.KeyEstadoAtencion = src.KeyEstadoAtencion;

INSERT INTO dbo.Dim_EstadoAtencion (EstadoFinal, Asistencia)
SELECT src.EstadoFinal, src.Asistencia
FROM (
    SELECT 1 AS KeyEstadoAtencion, 'Completada' AS EstadoFinal, 'Asistió' AS Asistencia
    UNION ALL SELECT 2, 'No Asistió', 'Inasistencia'
    UNION ALL SELECT 3, 'Cancelados', 'Cancelado'
) src
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_EstadoAtencion dim WHERE dim.EstadoFinal = src.EstadoFinal
);
GO
