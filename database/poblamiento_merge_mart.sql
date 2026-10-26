

USE NexoSaludDB;
GO

-- ====================================================================
-- PARTE 1: PREPARACIÓN DE DATA - VISTA DE TIEMPO
-- ====================================================================
CREATE OR ALTER VIEW v_DatosDimTiempo AS
SELECT DISTINCT 
    Anio = YEAR(p.fecha_registro), 
    SEMESTRE = DATENAME(YY, p.fecha_registro) + '-S' + IIF(DATEPART(qq, p.fecha_registro) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, p.fecha_registro) + '-T' + CAST(DATEPART(qq, p.fecha_registro) AS VARCHAR(2)),
    MES = DATENAME(MM, p.fecha_registro),  
    DiaSemana = DATENAME(dw, p.fecha_registro),
    Dia = DAY(p.fecha_registro),
    idfecha = CAST(p.fecha_registro AS DATE)
FROM dbo.Personas p
WHERE p.fecha_registro IS NOT NULL
UNION
SELECT DISTINCT 
    Anio = YEAR(s.fecha_solicitud), 
    SEMESTRE = DATENAME(YY, s.fecha_solicitud) + '-S' + IIF(DATEPART(qq, s.fecha_solicitud) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, s.fecha_solicitud) + '-T' + CAST(DATEPART(qq, s.fecha_solicitud) AS VARCHAR(2)),
    MES = DATENAME(MM, s.fecha_solicitud),  
    DiaSemana = DATENAME(dw, s.fecha_solicitud),
    Dia = DAY(s.fecha_solicitud),
    idfecha = CAST(s.fecha_solicitud AS DATE)
FROM dbo.Solicitudes s
WHERE s.fecha_solicitud IS NOT NULL
UNION
SELECT DISTINCT 
    Anio = YEAR(r.fecha_reserva), 
    SEMESTRE = DATENAME(YY, r.fecha_reserva) + '-S' + IIF(DATEPART(qq, r.fecha_reserva) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, r.fecha_reserva) + '-T' + CAST(DATEPART(qq, r.fecha_reserva) AS VARCHAR(2)),
    MES = DATENAME(MM, r.fecha_reserva),  
    DiaSemana = DATENAME(dw, r.fecha_reserva),
    Dia = DAY(r.fecha_reserva),
    idfecha = CAST(r.fecha_reserva AS DATE)
FROM dbo.Reservas r
WHERE r.fecha_reserva IS NOT NULL
UNION
SELECT DISTINCT 
    Anio = YEAR(pg.fecha_registro), 
    SEMESTRE = DATENAME(YY, pg.fecha_registro) + '-S' + IIF(DATEPART(qq, pg.fecha_registro) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, pg.fecha_registro) + '-T' + CAST(DATEPART(qq, pg.fecha_registro) AS VARCHAR(2)),
    MES = DATENAME(MM, pg.fecha_registro),  
    DiaSemana = DATENAME(dw, pg.fecha_registro),
    Dia = DAY(pg.fecha_registro),
    idfecha = CAST(pg.fecha_registro AS DATE)
FROM dbo.Pagos pg
WHERE pg.fecha_registro IS NOT NULL
UNION
SELECT DISTINCT 
    Anio = YEAR(a.fecha_atencion), 
    SEMESTRE = DATENAME(YY, a.fecha_atencion) + '-S' + IIF(DATEPART(qq, a.fecha_atencion) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, a.fecha_atencion) + '-T' + CAST(DATEPART(qq, a.fecha_atencion) AS VARCHAR(2)),
    MES = DATENAME(MM, a.fecha_atencion),  
    DiaSemana = DATENAME(dw, a.fecha_atencion),
    Dia = DAY(a.fecha_atencion),
    idfecha = CAST(a.fecha_atencion AS DATE)
FROM dbo.Atenciones a
WHERE a.fecha_atencion IS NOT NULL
UNION
SELECT DISTINCT 
    Anio = YEAR(seg.fecha_hora), 
    SEMESTRE = DATENAME(YY, seg.fecha_hora) + '-S' + IIF(DATEPART(qq, seg.fecha_hora) < 3, '1', '2'),
    TRIMESTRE = DATENAME(YY, seg.fecha_hora) + '-T' + CAST(DATEPART(qq, seg.fecha_hora) AS VARCHAR(2)),
    MES = DATENAME(MM, seg.fecha_hora),  
    DiaSemana = DATENAME(dw, seg.fecha_hora),
    Dia = DAY(seg.fecha_hora),
    idfecha = CAST(seg.fecha_hora AS DATE)
FROM dbo.Seguimientos seg
WHERE seg.fecha_hora IS NOT NULL;
GO

-- ====================================================================
-- PARTE 2: POBLAMIENTO DE DIMENSIONES (MERGE)
-- ====================================================================

-- 1. Dim_Tiempo (KeyTiempo YYYYMMDD explícito para PK)
MERGE [NexoSalud_Mart].[dbo].[Dim_Tiempo] AS dim USING 
(
    SELECT 
        KeyTiempo = CAST(FORMAT(V.idfecha, 'yyyyMMdd') AS INT),
        id_fecha = V.idfecha,
        V.Anio, 
        Trimestre = DATEPART(qq, V.idfecha), 
        Mes = MONTH(V.idfecha), 
        Dia = V.Dia
    FROM v_DatosDimTiempo V
) AS oltp
ON oltp.id_fecha = dim.id_fecha
WHEN NOT MATCHED THEN
    INSERT (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
    VALUES (oltp.KeyTiempo, oltp.id_fecha, oltp.Anio, oltp.Trimestre, oltp.Mes, oltp.Dia);
GO

-- 2. Dim_Hora
MERGE [NexoSalud_Mart].[dbo].[Dim_Hora] AS dim USING
(
    SELECT DISTINCT
        id_hora = DATEPART(HOUR, fecha) * 100 + DATEPART(MINUTE, fecha),
        Turno = CASE 
            WHEN DATEPART(HOUR, fecha) BETWEEN 0 AND 6 THEN 'Madrugada'
            WHEN DATEPART(HOUR, fecha) BETWEEN 7 AND 12 THEN 'Mañana'
            WHEN DATEPART(HOUR, fecha) BETWEEN 13 AND 18 THEN 'Tarde'
            ELSE 'Noche'
        END,
        Hora = DATEPART(HOUR, fecha),
        Minuto = DATEPART(MINUTE, fecha)
    FROM (
        SELECT fecha_registro AS fecha FROM dbo.Pagos WHERE fecha_registro IS NOT NULL
        UNION
        SELECT fecha_atencion AS fecha FROM dbo.Atenciones WHERE fecha_atencion IS NOT NULL
    ) AS H
) AS oltp
ON oltp.id_hora = dim.id_hora
WHEN NOT MATCHED THEN
    INSERT (id_hora, Turno, Hora, Minuto)
    VALUES (oltp.id_hora, oltp.Turno, oltp.Hora, oltp.Minuto);
GO

-- 3. Dim_Sede
MERGE [NexoSalud_Mart].[dbo].[Dim_Sede] AS dim USING
(
    SELECT 
        id_sede,
        nombre AS Sede,
        COALESCE(zona, 'Trujillo') AS Distrito,
        COALESCE(zona, 'Centro') AS Zona
    FROM dbo.Sedes
) AS oltp
ON oltp.id_sede = dim.id_sede
WHEN MATCHED THEN
    UPDATE SET dim.Sede = oltp.Sede, dim.Distrito = oltp.Distrito, dim.Zona = oltp.Zona
WHEN NOT MATCHED THEN
    INSERT (id_sede, Sede, Distrito, Zona)
    VALUES (oltp.id_sede, oltp.Sede, oltp.Distrito, oltp.Zona);
GO

-- 4. Dim_Servicio
MERGE [NexoSalud_Mart].[dbo].[Dim_Servicio] AS dim USING
(
    SELECT 
        id_servicio,
        nombre AS ServicioOdontologico,
        Categoria = CASE 
            WHEN nombre LIKE '%Implante%' THEN 'Implantología'
            WHEN nombre LIKE '%Ortodoncia%' OR nombre LIKE '%Brackets%' THEN 'Ortodoncia'
            WHEN nombre LIKE '%Profilaxis%' OR nombre LIKE '%Limpieza%' THEN 'Odontología Preventiva'
            WHEN nombre LIKE '%Curación%' OR nombre LIKE '%Restauración%' THEN 'Odontología Restauradora'
            ELSE 'Odontología General'
        END,
        COALESCE(descripcion, nombre) AS Procedimiento
    FROM dbo.Servicios
) AS oltp
ON oltp.id_servicio = dim.id_servicio
WHEN MATCHED THEN
    UPDATE SET dim.ServicioOdontologico = oltp.ServicioOdontologico, dim.Categoria = oltp.Categoria, dim.Procedimiento = oltp.Procedimiento
WHEN NOT MATCHED THEN
    INSERT (id_servicio, ServicioOdontologico, Categoria, Procedimiento)
    VALUES (oltp.id_servicio, oltp.ServicioOdontologico, oltp.Categoria, oltp.Procedimiento);
GO

-- 5. Dim_Canal
MERGE [NexoSalud_Mart].[dbo].[Dim_Canal] AS dim USING
(
    SELECT 
        id_canal,
        nombre AS NombreCanal,
        TipoMedio = CASE 
            WHEN nombre IN ('WhatsApp', 'Web', 'Facebook', 'Instagram') THEN 'Digital'
            WHEN nombre LIKE '%Llamada%' THEN 'Telefónico'
            ELSE 'Presencial / Físico'
        END
    FROM dbo.Canales
) AS oltp
ON oltp.id_canal = dim.id_canal
WHEN MATCHED THEN
    UPDATE SET dim.NombreCanal = oltp.NombreCanal, dim.TipoMedio = oltp.TipoMedio
WHEN NOT MATCHED THEN
    INSERT (id_canal, NombreCanal, TipoMedio)
    VALUES (oltp.id_canal, oltp.NombreCanal, oltp.TipoMedio);
GO

-- 6. Dim_Fuente
MERGE [NexoSalud_Mart].[dbo].[Dim_Fuente] AS dim USING
(
    SELECT 
        f.id_fuente,
        c.id_campana,
        f.nombre AS TipoOrigen,
        COALESCE(c.nombre, 'Sin Campaña') AS Campana
    FROM dbo.Fuentes f
    LEFT JOIN dbo.Campanas c ON f.id_fuente = c.id_fuente
) AS oltp
ON oltp.id_fuente = dim.id_fuente AND ISNULL(oltp.id_campana, 0) = ISNULL(dim.id_campana, 0)
WHEN MATCHED THEN
    UPDATE SET dim.TipoOrigen = oltp.TipoOrigen, dim.Campana = oltp.Campana
WHEN NOT MATCHED THEN
    INSERT (id_fuente, id_campana, TipoOrigen, Campana)
    VALUES (oltp.id_fuente, oltp.id_campana, oltp.TipoOrigen, oltp.Campana);
GO

-- 7. Dim_TipoPersona
MERGE [NexoSalud_Mart].[dbo].[Dim_TipoPersona] AS dim USING
(
    SELECT 
        id_persona,
        COALESCE(tipo_persona, 'Particular') AS Ocupacion,
        RangoEdad = CASE 
            WHEN fecha_nacimiento IS NULL THEN 'No Especificado'
            WHEN DATEDIFF(YEAR, fecha_nacimiento, GETDATE()) < 18 THEN 'Menor de 18'
            WHEN DATEDIFF(YEAR, fecha_nacimiento, GETDATE()) BETWEEN 18 AND 29 THEN '18 a 29 años'
            WHEN DATEDIFF(YEAR, fecha_nacimiento, GETDATE()) BETWEEN 30 AND 49 THEN '30 a 49 años'
            ELSE '50 años a más'
        END
    FROM dbo.Personas
) AS oltp
ON oltp.id_persona = dim.id_persona
WHEN MATCHED THEN
    UPDATE SET dim.Ocupacion = oltp.Ocupacion, dim.RangoEdad = oltp.RangoEdad
WHEN NOT MATCHED THEN
    INSERT (id_persona, Ocupacion, RangoEdad)
    VALUES (oltp.id_persona, oltp.Ocupacion, oltp.RangoEdad);
GO

-- 8. Dim_Pagador
MERGE [NexoSalud_Mart].[dbo].[Dim_Pagador] AS dim USING
(
    SELECT DISTINCT
        p.id_persona,
        COALESCE(p.tipo_persona, 'Particular') AS Ocupacion,
        RangoEdad = CASE 
            WHEN p.fecha_nacimiento IS NULL THEN 'No Especificado'
            WHEN DATEDIFF(YEAR, p.fecha_nacimiento, GETDATE()) < 30 THEN 'Joven'
            ELSE 'Adulto'
        END,
        'No Declarado' AS EstadoCivil,
        'Medio' AS NivelIngreso
    FROM dbo.Pagos pg
    INNER JOIN dbo.Personas p ON pg.id_persona = p.id_persona
) AS oltp
ON oltp.id_persona = dim.id_persona
WHEN MATCHED THEN
    UPDATE SET dim.Ocupacion = oltp.Ocupacion, dim.RangoEdad = oltp.RangoEdad, dim.EstadoCivil = oltp.EstadoCivil, dim.NivelIngreso = oltp.NivelIngreso
WHEN NOT MATCHED THEN
    INSERT (id_persona, Ocupacion, RangoEdad, EstadoCivil, NivelIngreso)
    VALUES (oltp.id_persona, oltp.Ocupacion, oltp.RangoEdad, oltp.EstadoCivil, oltp.NivelIngreso);
GO

-- 9. Dim_Profesional
MERGE [NexoSalud_Mart].[dbo].[Dim_Profesional] AS dim USING
(
    SELECT 
        id_profesional,
        nombres + ' ' + apellidos AS Odontologo,
        COALESCE(especialidad, 'Odontología General') AS EspecialidadPrincipal
    FROM dbo.Profesionales
) AS oltp
ON oltp.id_profesional = dim.id_profesional
WHEN MATCHED THEN
    UPDATE SET dim.Odontologo = oltp.Odontologo, dim.EspecialidadPrincipal = oltp.EspecialidadPrincipal
WHEN NOT MATCHED THEN
    INSERT (id_profesional, Odontologo, EspecialidadPrincipal)
    VALUES (oltp.id_profesional, oltp.Odontologo, oltp.EspecialidadPrincipal);
GO

-- 10. Dim_Negociador
MERGE [NexoSalud_Mart].[dbo].[Dim_Negociador] AS dim USING
(
    SELECT 
        id_usuario,
        nombres + ' ' + apellidos AS NombreNegociador
    FROM dbo.Usuarios
) AS oltp
ON oltp.id_usuario = dim.id_usuario
WHEN MATCHED THEN
    UPDATE SET dim.NombreNegociador = oltp.NombreNegociador
WHEN NOT MATCHED THEN
    INSERT (id_usuario, NombreNegociador)
    VALUES (oltp.id_usuario, oltp.NombreNegociador);
GO

-- 11. Dim_Pasarela
MERGE [NexoSalud_Mart].[dbo].[Dim_Pasarela] AS dim USING
(
    SELECT DISTINCT
        COALESCE(canal_pago, 'EFECTIVO') AS MetodoPago,
        EntidadFinanciera = CASE 
            WHEN canal_pago LIKE '%YAPE%' THEN 'BCP'
            WHEN canal_pago LIKE '%PLIN%' THEN 'Interbank/BBVA'
            WHEN canal_pago LIKE '%BCP%' THEN 'Banco de Crédito'
            ELSE 'Caja Luxedent'
        END,
        TipoMedio = CASE 
            WHEN canal_pago IN ('YAPE', 'PLIN') THEN 'Billetera Digital'
            WHEN canal_pago LIKE '%POS%' THEN 'POS Tarjeta'
            ELSE 'Presencial'
        END
    FROM dbo.Pagos
) AS oltp
ON oltp.MetodoPago = dim.MetodoPago AND oltp.EntidadFinanciera = dim.EntidadFinanciera
WHEN NOT MATCHED THEN
    INSERT (MetodoPago, EntidadFinanciera, TipoMedio)
    VALUES (oltp.MetodoPago, oltp.EntidadFinanciera, oltp.TipoMedio);
GO

-- 12. Dim_Cobro
MERGE [NexoSalud_Mart].[dbo].[Dim_Cobro] AS dim USING
(
    SELECT DISTINCT
        estado AS EstadoPago,
        CASE WHEN comprobante IS NOT NULL AND comprobante <> '' THEN 'SI' ELSE 'NO' END AS ComprobanteAdjunto
    FROM dbo.Pagos
) AS oltp
ON oltp.EstadoPago = dim.EstadoPago AND oltp.ComprobanteAdjunto = dim.ComprobanteAdjunto
WHEN NOT MATCHED THEN
    INSERT (EstadoPago, ComprobanteAdjunto)
    VALUES (oltp.EstadoPago, oltp.ComprobanteAdjunto);
GO

-- 13. Dim_EstadoAtencion
MERGE [NexoSalud_Mart].[dbo].[Dim_EstadoAtencion] AS dim USING
(
    SELECT DISTINCT
        estado_servicio AS EstadoFinal,
        asistencia AS Asistencia
    FROM dbo.Atenciones
) AS oltp
ON oltp.EstadoFinal = dim.EstadoFinal AND oltp.Asistencia = dim.Asistencia
WHEN NOT MATCHED THEN
    INSERT (EstadoFinal, Asistencia)
    VALUES (oltp.EstadoFinal, oltp.Asistencia);
GO

-- 14. Dim_EstadoRegistro
MERGE [NexoSalud_Mart].[dbo].[Dim_EstadoRegistro] AS dim USING
(
    SELECT DISTINCT
        estado_calidad AS EstadoCalidad,
        CASE WHEN autoriza_contacto = 1 THEN 'SI' ELSE 'NO' END AS AutorizacionContacto
    FROM dbo.Personas
) AS oltp
ON oltp.EstadoCalidad = dim.EstadoCalidad AND oltp.AutorizacionContacto = dim.AutorizacionContacto
WHEN NOT MATCHED THEN
    INSERT (EstadoCalidad, AutorizacionContacto)
    VALUES (oltp.EstadoCalidad, oltp.AutorizacionContacto);
GO

-- ====================================================================
-- PARTE 3: POBLAMIENTO DE TABLAS DE HECHOS (DELETE + INSERT)
-- Agrupados estrictamente al grano de la Primary Key para evitar duplicados
-- ====================================================================

-- 1. HECHO: CAPTACIÓN BUYER
-- Grano PK: (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro)
DELETE [NexoSalud_Mart].[dbo].fact_captacion_buyer;
GO

INSERT INTO [NexoSalud_Mart].[dbo].fact_captacion_buyer
(KeyTiempo, KeySede, KeyServicio, KeyCanal, KeyFuente, KeyTipoPersona, KeyEstadoRegistro,
 contacto_registrado, contacto_utilizable, conversion_lead, tiempo_conversion_dia, costo_atribuido_captacion)
SELECT 
    dt.KeyTiempo,
    COALESCE(ds.KeySede, 1) AS KeySede,
    MIN(COALESCE(dserv.KeyServicio, 1)) AS KeyServicio,
    COALESCE(dc.KeyCanal, 1) AS KeyCanal,
    COALESCE(df.KeyFuente, 1) AS KeyFuente,
    MIN(COALESCE(dtp.KeyTipoPersona, 1)) AS KeyTipoPersona,
    COALESCE(der.KeyEstadoRegistro, 1) AS KeyEstadoRegistro,
    contacto_registrado = COUNT(p.id_persona),
    contacto_utilizable = SUM(CASE WHEN p.estado_calidad LIKE '%Valid%' AND p.autoriza_contacto = 1 THEN 1 ELSE 0 END),
    conversion_lead    = SUM(CASE WHEN p.id_etapa_actual >= 2 THEN 1 ELSE 0 END),
    tiempo_conversion_dia = AVG(COALESCE(DATEDIFF(dd, p.fecha_registro, s.fecha_solicitud), 0)),
    costo_atribuido_captacion = 0.00
FROM NexoSaludDB.dbo.Personas p
OUTER APPLY (
    SELECT TOP 1 s.id_solicitud, s.id_servicio, s.fecha_solicitud 
    FROM NexoSaludDB.dbo.Solicitudes s 
    WHERE s.id_persona = p.id_persona 
    ORDER BY s.fecha_solicitud ASC
) s
INNER JOIN [NexoSalud_Mart].[dbo].Dim_Tiempo dt ON dt.id_fecha = CAST(p.fecha_registro AS DATE)
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Canal dc ON dc.id_canal = p.id_canal_origen
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Fuente df ON df.id_campana = p.id_campana_origen
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_TipoPersona dtp ON dtp.id_persona = p.id_persona
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_EstadoRegistro der ON (
    (p.estado_calidad LIKE '%Valid%' AND der.KeyEstadoRegistro = 1) OR
    (p.estado_calidad LIKE '%Incomplet%' AND der.KeyEstadoRegistro = 2) OR
    (p.estado_calidad LIKE '%Duplicad%' AND der.KeyEstadoRegistro = 3) OR
    (p.estado_calidad LIKE '%Rechazad%' AND der.KeyEstadoRegistro = 4)
)
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Servicio dserv ON dserv.id_servicio = s.id_servicio
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Sede ds ON ds.id_sede = CASE 
    WHEN p.zona IN ('Centro Histórico', 'Centro Historico', 'El Recreo', 'Florencia de Mora', 'La Esperanza', 'Moche', 'San Andrés', 'San Andres') THEN 1
    WHEN p.zona IN ('California', 'Víctor Larco Herrera', 'Victor Larco Herrera', 'Huanchaco') THEN 2
    WHEN p.zona IN ('El Golf') THEN 3
    ELSE 1
END
GROUP BY 
    dt.KeyTiempo, 
    COALESCE(ds.KeySede, 1), 
    COALESCE(dc.KeyCanal, 1), 
    COALESCE(df.KeyFuente, 1), 
    COALESCE(der.KeyEstadoRegistro, 1);
GO

-- 2. HECHO: NEGOCIACIÓN LEAD
-- Grano PK: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador)
DELETE [NexoSalud_Mart].[dbo].fact_negociacion_lead;
GO

INSERT INTO [NexoSalud_Mart].[dbo].fact_negociacion_lead
(KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador,
 cohorte_evaluable, conversion_payer_14_dia, solicitud_requiere_respuesta, respuesta_util_15_min, negociacion_finalizada, negociacion_abandonada, leads_en_negociacion)
SELECT 
    dt.KeyTiempo,
    COALESCE(ds.KeySede, 1) AS KeySede,
    COALESCE(dserv.KeyServicio, 1) AS KeyServicio,
    COALESCE(dp.KeyProfesional, 1) AS KeyProfesional,
    COALESCE(dn.KeyNegociador, 1) AS KeyNegociador,
    cohorte_evaluable = COUNT(s.id_solicitud),
    conversion_payer_14_dia = SUM(CASE WHEN r.id_reserva IS NOT NULL AND DATEDIFF(dd, s.fecha_solicitud, r.fecha_reserva) <= 14 THEN 1 ELSE 0 END),
    solicitud_requiere_respuesta = COUNT(s.id_solicitud),
    respuesta_util_15_min = SUM(CASE WHEN DATEDIFF(mi, s.fecha_solicitud, s.fecha_primera_respuesta) <= 15 THEN 1 ELSE 0 END),
    negociacion_finalizada = SUM(CASE WHEN s.estado = 'Convertida' THEN 1 ELSE 0 END),
    negociacion_abandonada    = SUM(CASE WHEN s.estado = 'Abandonada' THEN 1 ELSE 0 END),
    leads_en_negociacion  = SUM(CASE WHEN s.estado IN ('En Negociacion', 'En negociación', 'Pendiente') THEN 1 ELSE 0 END)
FROM NexoSaludDB.dbo.Solicitudes s
LEFT JOIN NexoSaludDB.dbo.Reservas r ON s.id_solicitud = r.id_solicitud
LEFT JOIN NexoSaludDB.dbo.Opciones o ON r.id_opcion = o.id_opcion
LEFT JOIN NexoSaludDB.dbo.Disponibilidad disp ON o.id_disponibilidad = disp.id_disponibilidad
INNER JOIN [NexoSalud_Mart].[dbo].Dim_Tiempo dt ON dt.id_fecha = CAST(s.fecha_solicitud AS DATE)
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Servicio dserv ON dserv.id_servicio = s.id_servicio
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Sede ds ON ds.id_sede = disp.id_sede
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Profesional dp ON dp.id_profesional = disp.id_profesional
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Negociador dn ON dn.id_usuario = 1
GROUP BY 
    dt.KeyTiempo, 
    COALESCE(ds.KeySede, 1), 
    COALESCE(dserv.KeyServicio, 1), 
    COALESCE(dp.KeyProfesional, 1), 
    COALESCE(dn.KeyNegociador, 1);
GO

-- 3. HECHO: GESTIÓN PAYER
-- Grano PK: (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio)
DELETE [NexoSalud_Mart].[dbo].fact_gestion_payer;
GO

INSERT INTO [NexoSalud_Mart].[dbo].fact_gestion_payer
(KeyTiempo, KeyHora, KeySede, KeyServicio, KeyFuente, KeyPasarela, KeyPagador, KeyCobro,
 pago_registrado, pago_validado, pago_rechazado, conversion_customer, importe_total_cobro, costo_transaccion, tiempo_validacion_minuto)
SELECT 
    dt.KeyTiempo,
    MIN(dh.KeyHora) AS KeyHora,
    COALESCE(ds.KeySede, 1) AS KeySede,
    COALESCE(dserv.KeyServicio, 1) AS KeyServicio,
    MIN(df.KeyFuente) AS KeyFuente,
    COALESCE(dpas.KeyPasarela, 1) AS KeyPasarela,
    MIN(dpag.KeyPagador) AS KeyPagador,
    COALESCE(dc.KeyCobro, 1) AS KeyCobro,
    pago_registrado = COUNT(p.id_pago),
    pago_validado   = SUM(CASE WHEN UPPER(p.estado) IN ('VALIDATED', 'VALIDADO', 'CONFIRMADO') THEN 1 ELSE 0 END),
    pago_rechazado  = SUM(CASE WHEN UPPER(p.estado) IN ('REJECTED', 'RECHAZADO', 'FALLIDO') THEN 1 ELSE 0 END),
    conversion_customer = SUM(CASE WHEN UPPER(p.estado) IN ('VALIDATED', 'VALIDADO', 'CONFIRMADO') THEN 1 ELSE 0 END),
    importe_total_cobro = SUM(CASE WHEN UPPER(p.estado) IN ('VALIDATED', 'VALIDADO', 'CONFIRMADO') THEN p.importe ELSE 0.00 END),
    costo_transaccion = SUM(p.importe * 0.03),
    tiempo_validacion_minuto = SUM(ISNULL(DATEDIFF(mi, p.fecha_registro, p.fecha_validacion), 0))
FROM NexoSaludDB.dbo.Pagos p
LEFT JOIN NexoSaludDB.dbo.Reservas r ON p.id_reserva = r.id_reserva
LEFT JOIN NexoSaludDB.dbo.Opciones o ON r.id_opcion = o.id_opcion
LEFT JOIN NexoSaludDB.dbo.Solicitudes s ON r.id_solicitud = s.id_solicitud
LEFT JOIN NexoSaludDB.dbo.Disponibilidad disp ON o.id_disponibilidad = disp.id_disponibilidad
INNER JOIN [NexoSalud_Mart].[dbo].Dim_Tiempo dt ON dt.id_fecha = CAST(p.fecha_registro AS DATE)
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Hora dh ON dh.id_hora = (DATEPART(HOUR, p.fecha_registro) * 100 + DATEPART(MINUTE, p.fecha_registro))
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Sede ds ON ds.id_sede = disp.id_sede
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Servicio dserv ON dserv.id_servicio = s.id_servicio
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Fuente df ON df.id_fuente = 1
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Pasarela dpas ON dpas.MetodoPago = p.canal_pago
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Pagador dpag ON dpag.id_persona = p.id_persona
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Cobro dc ON dc.EstadoPago = p.estado 
    AND dc.ComprobanteAdjunto = CASE WHEN p.comprobante IS NOT NULL AND p.comprobante <> '' THEN 'SI' ELSE 'NO' END
GROUP BY 
    dt.KeyTiempo, 
    COALESCE(dpas.KeyPasarela, 1), 
    COALESCE(dc.KeyCobro, 1), 
    COALESCE(ds.KeySede, 1), 
    COALESCE(dserv.KeyServicio, 1);
GO

-- 4. HECHO: ATENCIÓN CUSTOMER
-- Grano PK: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion)
DELETE [NexoSalud_Mart].[dbo].fact_atencion_customer;
GO

INSERT INTO [NexoSalud_Mart].[dbo].fact_atencion_customer
(KeyTiempo, KeyHora, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion,
 cita_evaluable, atencion_realizada, cita_inasistencia, tiempo_sillon_dental_minuto, atencion_finalizada_conforme)
SELECT 
    dt.KeyTiempo,
    MIN(dh.KeyHora) AS KeyHora,
    COALESCE(ds.KeySede, 1) AS KeySede,
    COALESCE(dserv.KeyServicio, 1) AS KeyServicio,
    COALESCE(dp.KeyProfesional, 1) AS KeyProfesional,
    COALESCE(dea.KeyEstadoAtencion, 1) AS KeyEstadoAtencion,
    cita_evaluable = COUNT(a.id_atencion),
    atencion_realizada = SUM(CASE WHEN a.asistencia = 'Asistió' THEN 1 ELSE 0 END),
    cita_inasistencia = SUM(CASE WHEN a.asistencia = 'No asistió' THEN 1 ELSE 0 END),
    tiempo_sillon_dental_minuto = SUM(ISNULL(DATEDIFF(mi, a.fecha_inicio, a.fecha_fin), 0)),
    atencion_finalizada_conforme = SUM(CASE WHEN a.estado_servicio = 'Realizado' THEN 1 ELSE 0 END)
FROM NexoSaludDB.dbo.Atenciones a
INNER JOIN [NexoSalud_Mart].[dbo].Dim_Tiempo dt ON dt.id_fecha = CAST(a.fecha_atencion AS DATE)
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Hora dh ON dh.id_hora = (DATEPART(HOUR, a.fecha_atencion) * 100 + DATEPART(MINUTE, a.fecha_atencion))
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Sede ds ON ds.id_sede = a.id_sede
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Servicio dserv ON dserv.id_servicio = a.id_servicio
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Profesional dp ON dp.id_profesional = a.id_profesional
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_EstadoAtencion dea ON dea.EstadoFinal = a.estado_servicio AND dea.Asistencia = a.asistencia
GROUP BY 
    dt.KeyTiempo, 
    COALESCE(ds.KeySede, 1), 
    COALESCE(dserv.KeyServicio, 1), 
    COALESCE(dp.KeyProfesional, 1), 
    COALESCE(dea.KeyEstadoAtencion, 1);
GO

-- 5. HECHO: SEGUIMIENTO TURNED
-- Grano PK: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal)
DELETE [NexoSalud_Mart].[dbo].fact_seguimiento_turned;
GO

INSERT INTO [NexoSalud_Mart].[dbo].fact_seguimiento_turned
(KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal,
 seguimiento_registrado, seguimiento_efectivo, incidencia_reportada, incidencia_resuelta_24_hora, retorno_cohorte_90_dia, paciente_elegible_retorno)
SELECT 
    dt.KeyTiempo,
    COALESCE(ds.KeySede, 1) AS KeySede,
    COALESCE(dserv.KeyServicio, 1) AS KeyServicio,
    COALESCE(dp.KeyProfesional, 1) AS KeyProfesional,
    COALESCE(dc.KeyCanal, 1) AS KeyCanal,
    seguimiento_registrado = COUNT(s.id_seguimiento),
    seguimiento_efectivo   = SUM(CASE WHEN s.satisfaccion IS NOT NULL OR s.resultado IS NOT NULL THEN 1 ELSE 0 END),
    incidencia_reportada   = SUM(CASE WHEN s.incidencia = 1 OR s.satisfaccion <= 2 THEN 1 ELSE 0 END),
    incidencia_resuelta_24_hora = SUM(CASE WHEN s.incidencia = 1 THEN 1 ELSE 0 END),
    retorno_cohorte_90_dia   = SUM(CASE WHEN ret90.tiene_retorno_90d = 1 THEN 1 ELSE 0 END),
    paciente_elegible_retorno = COUNT(DISTINCT s.id_persona)
FROM NexoSaludDB.dbo.Seguimientos s
LEFT JOIN NexoSaludDB.dbo.Atenciones a ON s.id_atencion = a.id_atencion
INNER JOIN [NexoSalud_Mart].[dbo].Dim_Tiempo dt ON dt.id_fecha = CAST(s.fecha_hora AS DATE)
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Sede ds ON ds.id_sede = a.id_sede
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Servicio dserv ON dserv.id_servicio = a.id_servicio
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Profesional dp ON dp.id_profesional = a.id_profesional
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Canal dc ON dc.NombreCanal = s.canal
OUTER APPLY (
    SELECT TOP 1 1 AS tiene_retorno_90d
    FROM NexoSaludDB.dbo.Atenciones a2 
    WHERE a2.id_persona = s.id_persona 
      AND a2.asistencia = 'Asistió'
      AND a2.fecha_atencion > a.fecha_atencion 
      AND a2.fecha_atencion <= DATEADD(DAY, 90, a.fecha_atencion)
) ret90
GROUP BY 
    dt.KeyTiempo, 
    COALESCE(ds.KeySede, 1), 
    COALESCE(dserv.KeyServicio, 1), 
    COALESCE(dp.KeyProfesional, 1), 
    COALESCE(dc.KeyCanal, 1);
GO

-- ====================================================================
-- VERIFICACIÓN FINAL DE REGISTROS POBLADOS EN EL DATA MART
-- ====================================================================
SELECT 'Dim_Tiempo' AS Tabla, COUNT(*) AS TotalRegistros FROM [NexoSalud_Mart].[dbo].Dim_Tiempo
UNION ALL SELECT 'Dim_Hora', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_Hora
UNION ALL SELECT 'Dim_Sede', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_Sede
UNION ALL SELECT 'Dim_Servicio', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_Servicio
UNION ALL SELECT 'Dim_Canal', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_Canal
UNION ALL SELECT 'Dim_Fuente', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_Fuente
UNION ALL SELECT 'Dim_TipoPersona', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_TipoPersona
UNION ALL SELECT 'Dim_Pagador', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_Pagador
UNION ALL SELECT 'Dim_Profesional', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_Profesional
UNION ALL SELECT 'Dim_Negociador', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_Negociador
UNION ALL SELECT 'Dim_Pasarela', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_Pasarela
UNION ALL SELECT 'Dim_Cobro', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_Cobro
UNION ALL SELECT 'Dim_EstadoAtencion', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_EstadoAtencion
UNION ALL SELECT 'Dim_EstadoRegistro', COUNT(*) FROM [NexoSalud_Mart].[dbo].Dim_EstadoRegistro
UNION ALL SELECT 'fact_captacion_buyer', COUNT(*) FROM [NexoSalud_Mart].[dbo].fact_captacion_buyer
UNION ALL SELECT 'fact_negociacion_lead', COUNT(*) FROM [NexoSalud_Mart].[dbo].fact_negociacion_lead
UNION ALL SELECT 'fact_gestion_payer', COUNT(*) FROM [NexoSalud_Mart].[dbo].fact_gestion_payer
UNION ALL SELECT 'fact_atencion_customer', COUNT(*) FROM [NexoSalud_Mart].[dbo].fact_atencion_customer
UNION ALL SELECT 'fact_seguimiento_turned', COUNT(*) FROM [NexoSalud_Mart].[dbo].fact_seguimiento_turned;
GO
