-- ====================================================================
-- PROCESO ETL: POBLAMIENTO DE DIMENSIONES (DATOS MAESTROS)
-- ====================================================================
USE NexoSalud_Mart;
GO

-- 1. Poblar Dim_Tiempo (Rango 2024 a 2030)
DECLARE @StartDate DATE = '2024-01-01';
DECLARE @EndDate DATE = '2030-12-31';

WITH Fechas AS (
    SELECT @StartDate AS Fecha
    UNION ALL
    SELECT DATEADD(DAY, 1, Fecha)
    FROM Fechas
    WHERE DATEADD(DAY, 1, Fecha) <= @EndDate
)
MERGE [NexoSalud_Mart].dbo.[Dim_Tiempo] AS dim
USING (
    SELECT 
        CAST(FORMAT(Fecha, 'yyyyMMdd') AS INT) AS KeyTiempo,
        Fecha,
        YEAR(Fecha) AS Año,
        DATEPART(QUARTER, Fecha) AS Trimestre,
        MONTH(Fecha) AS Mes,
        DAY(Fecha) AS Dia
    FROM Fechas
) AS origen
ON dim.KeyTiempo = origen.KeyTiempo
WHEN NOT MATCHED THEN
    INSERT (KeyTiempo, Fecha, Año, Trimestre, Mes, Dia)
    VALUES (origen.KeyTiempo, origen.Fecha, origen.Año, origen.Trimestre, origen.Mes, origen.Dia)
OPTION (MAXRECURSION 0);
GO

-- 2. Poblar Dim_Sede
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

-- 3. Poblar Dim_Servicio (Categorización Preventiva y Especializada)
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

-- 4. Poblar Dim_Canal
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

-- 5. Poblar Dim_Fuente (Desde Campañas y Fuentes)
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

-- 6. Poblar Dim_EstadoRegistro (Calidad del Registro)
MERGE [NexoSalud_Mart].dbo.[Dim_EstadoRegistro] AS dim
USING (
    SELECT 'Válidos' AS EstadoCalidad, 'Sí' AS AutorizacionContacto
    UNION ALL SELECT 'Incompletos', 'No'
    UNION ALL SELECT 'Duplicados', 'No'
    UNION ALL SELECT 'Rechazados', 'No'
) AS src
ON dim.EstadoCalidad = src.EstadoCalidad
WHEN MATCHED THEN
    UPDATE SET dim.AutorizacionContacto = src.AutorizacionContacto
WHEN NOT MATCHED THEN
    INSERT (EstadoCalidad, AutorizacionContacto)
    VALUES (src.EstadoCalidad, src.AutorizacionContacto);
GO

-- 7. Poblar Dim_Profesional
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

-- 8. Poblar Dim_Negociador
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

-- 9. Poblar Dim_Pasarela
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

-- 10. Poblar Dim_Cobro
MERGE [NexoSalud_Mart].dbo.[Dim_Cobro] AS dim
USING (
    SELECT 'VALIDATED' AS EstadoPago, 'Sí' AS ComprobanteAdjunto
    UNION ALL SELECT 'PENDING', 'No'
    UNION ALL SELECT 'REJECTED', 'No'
) AS src
ON dim.EstadoPago = src.EstadoPago
WHEN NOT MATCHED THEN
    INSERT (EstadoPago, ComprobanteAdjunto)
    VALUES (src.EstadoPago, src.ComprobanteAdjunto);
GO

-- 11. Poblar Dim_EstadoAtencion
MERGE [NexoSalud_Mart].dbo.[Dim_EstadoAtencion] AS dim
USING (
    SELECT 'Atendidos' AS EstadoFinal, 'Asistió' AS Asistencia
    UNION ALL SELECT 'No Asistió (No-Show)', 'No asistió'
    UNION ALL SELECT 'Cancelados', 'Cancelado'
) AS src
ON dim.Asistencia = src.Asistencia
WHEN MATCHED THEN
    UPDATE SET dim.EstadoFinal = src.EstadoFinal
WHEN NOT MATCHED THEN
    INSERT (EstadoFinal, Asistencia)
    VALUES (src.EstadoFinal, src.Asistencia);
GO


-- ====================================================================
-- PROCESO ETL: POBLAMIENTO DE TABLAS DE HECHOS (FACT TABLES)
-- ====================================================================

-- Limpieza de hechos previa para asegurar idoneidad de agregación
DELETE FROM Fact_CaptacionBuyer;
DELETE FROM Fact_NegociacionLead;
DELETE FROM Fact_GestionPayer;
DELETE FROM Fact_AtencionCustomer;
GO

-- 12. Poblar Fact_CaptacionBuyer
MERGE [NexoSalud_Mart].dbo.[Fact_CaptacionBuyer] AS fact
USING (
    SELECT 
        CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT) AS KeyTiempo,
        ISNULL(dc.KeyCanal, 1) AS KeyCanal,
        ISNULL(df.KeyFuente, 1) AS KeyFuente,
        ISNULL(der.KeyEstadoRegistro, 1) AS KeyEstadoRegistro,
        COUNT(p.id_persona) AS ContactosRegistrados,
        SUM(CASE WHEN p.estado_calidad = 'Valido' THEN 1 ELSE 0 END) AS ContactosUtilizables,
        SUM(CASE WHEN p.id_etapa_actual >= 2 THEN 1 ELSE 0 END) AS ConversionesALead, 
        AVG(DATEDIFF(DAY, p.fecha_registro, ISNULL(ev.fecha_hora, p.fecha_registro))) AS TiempoConversionDias
    FROM [NexoSaludDB].dbo.[Personas] p
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Canal] dc ON p.id_canal_origen = dc.id_canal
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Fuente] df ON p.id_campana_origen = df.id_campana
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_EstadoRegistro] der ON (
        (p.estado_calidad = 'Valido' AND der.EstadoCalidad = 'Válidos') OR
        (p.estado_calidad = 'Incompleto' AND der.EstadoCalidad = 'Incompletos') OR
        (p.estado_calidad = 'Duplicado' AND der.EstadoCalidad = 'Duplicados') OR
        (p.estado_calidad = 'Rechazado' AND der.EstadoCalidad = 'Rechazados')
    )
    LEFT JOIN [NexoSaludDB].dbo.[EventosEtapa] ev ON p.id_persona = ev.id_persona AND ev.etapa_destino = 2
    GROUP BY 
        CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT),
        dc.KeyCanal,
        df.KeyFuente,
        der.KeyEstadoRegistro
) AS oltp
ON fact.KeyTiempo = oltp.KeyTiempo 
   AND fact.KeyCanal = oltp.KeyCanal 
   AND fact.KeyFuente = oltp.KeyFuente 
   AND fact.KeyEstadoRegistro = oltp.KeyEstadoRegistro
WHEN MATCHED THEN
    UPDATE SET 
        fact.ContactosRegistrados = oltp.ContactosRegistrados,
        fact.ContactosUtilizables = oltp.ContactosUtilizables,
        fact.ConversionesALead = oltp.ConversionesALead,
        fact.TiempoConversionDias = oltp.TiempoConversionDias
WHEN NOT MATCHED THEN
    INSERT (KeyTiempo, KeyCanal, KeyFuente, KeyEstadoRegistro, ContactosRegistrados, ContactosUtilizables, ConversionesALead, TiempoConversionDias)
    VALUES (oltp.KeyTiempo, oltp.KeyCanal, oltp.KeyFuente, oltp.KeyEstadoRegistro, oltp.ContactosRegistrados, oltp.ContactosUtilizables, oltp.ConversionesALead, oltp.TiempoConversionDias);
GO

-- 13. Poblar Fact_NegociacionLead
MERGE [NexoSalud_Mart].dbo.[Fact_NegociacionLead] AS fact
USING (
    SELECT 
        CAST(FORMAT(ev.fecha_hora, 'yyyyMMdd') AS INT) AS KeyTiempo,
        ISNULL(ds.KeySede, 1) AS KeySede,
        ISNULL(dn.KeyNegociador, 1) AS KeyNegociador,
        COUNT(DISTINCT ev.id_persona) AS LeadsCohorteEvaluable,
        SUM(CASE WHEN p.id_etapa_actual >= 3 THEN 1 ELSE 0 END) AS LeadsConvertidosPayer14Dias,
        SUM(CASE WHEN p.id_etapa_actual = 2 AND sol.estado = 'En Negociacion' THEN 1 ELSE 0 END) AS LeadsEnNegociacion,
        SUM(CASE WHEN sol.estado = 'Abandonada' OR p.id_etapa_actual < 2 THEN 1 ELSE 0 END) AS LeadsAbandonados,
        COUNT(DISTINCT ev.id_persona) AS LeadsRequierenRespuesta,
        SUM(CASE WHEN sol.fecha_primera_respuesta IS NOT NULL AND DATEDIFF(MINUTE, sol.fecha_solicitud, sol.fecha_primera_respuesta) <= 15 THEN 1 ELSE 0 END) AS LeadsRespuestaUtil15Min,
        SUM(CASE WHEN p.id_etapa_actual >= 3 OR sol.estado = 'Abandonada' THEN 1 ELSE 0 END) AS LeadsResultadoFinal
    FROM [NexoSaludDB].dbo.[EventosEtapa] ev
    JOIN [NexoSaludDB].dbo.[Personas] p ON ev.id_persona = p.id_persona
    LEFT JOIN [NexoSaludDB].dbo.[Solicitudes] sol ON sol.id_persona = p.id_persona
    LEFT JOIN [NexoSaludDB].dbo.[Opciones] opc ON opc.id_solicitud = sol.id_solicitud AND opc.seleccionada = 1
    LEFT JOIN [NexoSaludDB].dbo.[Disponibilidad] disp ON disp.id_disponibilidad = opc.id_disponibilidad
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Sede] ds ON ds.id_sede = disp.id_sede
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Negociador] dn ON dn.id_usuario = ev.id_usuario
    WHERE ev.etapa_destino = 2
    GROUP BY 
        CAST(FORMAT(ev.fecha_hora, 'yyyyMMdd') AS INT), 
        ds.KeySede, 
        dn.KeyNegociador
) AS oltp
ON fact.KeyTiempo = oltp.KeyTiempo AND fact.KeySede = oltp.KeySede AND fact.KeyNegociador = oltp.KeyNegociador
WHEN MATCHED THEN
    UPDATE SET 
        fact.LeadsCohorteEvaluable = oltp.LeadsCohorteEvaluable,
        fact.LeadsConvertidosPayer14Dias = oltp.LeadsConvertidosPayer14Dias,
        fact.LeadsEnNegociacion = oltp.LeadsEnNegociacion,
        fact.LeadsAbandonados = oltp.LeadsAbandonados,
        fact.LeadsRequierenRespuesta = oltp.LeadsRequierenRespuesta,
        fact.LeadsRespuestaUtil15Min = oltp.LeadsRespuestaUtil15Min,
        fact.LeadsResultadoFinal = oltp.LeadsResultadoFinal
WHEN NOT MATCHED THEN
    INSERT (KeyTiempo, KeySede, KeyNegociador, LeadsCohorteEvaluable, LeadsConvertidosPayer14Dias, LeadsEnNegociacion, LeadsAbandonados, LeadsRequierenRespuesta, LeadsRespuestaUtil15Min, LeadsResultadoFinal)
    VALUES (oltp.KeyTiempo, oltp.KeySede, oltp.KeyNegociador, oltp.LeadsCohorteEvaluable, oltp.LeadsConvertidosPayer14Dias, oltp.LeadsEnNegociacion, oltp.LeadsAbandonados, oltp.LeadsRequierenRespuesta, oltp.LeadsRespuestaUtil15Min, oltp.LeadsResultadoFinal);
GO

-- 14. Poblar Fact_GestionPayer
MERGE [NexoSalud_Mart].dbo.[Fact_GestionPayer] AS fact
USING (
    SELECT 
        CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT) AS KeyTiempo,
        ISNULL(dp.KeyPasarela, 1) AS KeyPasarela,
        ISNULL(dc.KeyCobro, 1) AS KeyCobro,
        COUNT(p.id_pago) AS PagosRegistrados,
        SUM(CASE WHEN p.estado IN ('Validado', 'VALIDATED') THEN 1 ELSE 0 END) AS PagosValidados,
        SUM(CASE WHEN p.estado IN ('Rechazado', 'REJECTED') THEN 1 ELSE 0 END) AS PagosRechazados,
        SUM(p.importe) AS ImporteTotalCobro,
        SUM(DATEDIFF(MINUTE, p.fecha_registro, ISNULL(p.fecha_validacion, p.fecha_registro))) AS TiempoTotalValidacionMin
    FROM [NexoSaludDB].dbo.[Pagos] p
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Pasarela] dp ON dp.MetodoPago = p.canal_pago
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Cobro] dc ON (
        (p.estado IN ('Validado', 'VALIDATED') AND dc.EstadoPago = 'VALIDATED') OR
        (p.estado IN ('Pendiente', 'PENDING') AND dc.EstadoPago = 'PENDING') OR
        (p.estado IN ('Rechazado', 'REJECTED') AND dc.EstadoPago = 'REJECTED')
    )
    GROUP BY 
        CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT),
        dp.KeyPasarela,
        dc.KeyCobro
) AS oltp
ON fact.KeyTiempo = oltp.KeyTiempo 
   AND fact.KeyPasarela = oltp.KeyPasarela 
   AND fact.KeyCobro = oltp.KeyCobro
WHEN MATCHED THEN
    UPDATE SET 
        fact.PagosRegistrados = oltp.PagosRegistrados,
        fact.PagosValidados = oltp.PagosValidados,
        fact.PagosRechazados = oltp.PagosRechazados,
        fact.ImporteTotalCobro = oltp.ImporteTotalCobro,
        fact.TiempoTotalValidacionMin = oltp.TiempoTotalValidacionMin
WHEN NOT MATCHED THEN
    INSERT (KeyTiempo, KeyPasarela, KeyCobro, PagosRegistrados, PagosValidados, PagosRechazados, ImporteTotalCobro, TiempoTotalValidacionMin)
    VALUES (oltp.KeyTiempo, oltp.KeyPasarela, oltp.KeyCobro, oltp.PagosRegistrados, oltp.PagosValidados, oltp.PagosRechazados, oltp.ImporteTotalCobro, oltp.TiempoTotalValidacionMin);
GO

-- 15. Poblar Fact_AtencionCustomer
MERGE [NexoSalud_Mart].dbo.[Fact_AtencionCustomer] AS fact
USING (
    SELECT 
        CAST(FORMAT(a.fecha_atencion, 'yyyyMMdd') AS INT) AS KeyTiempo,
        ISNULL(ds.KeySede, 1) AS KeySede,
        ISNULL(dserv.KeyServicio, 1) AS KeyServicio,
        ISNULL(dp.KeyProfesional, 1) AS KeyProfesional,
        ISNULL(dea.KeyEstadoAtencion, 1) AS KeyEstadoAtencion,
        COUNT(a.id_atencion) AS CitasEvaluables,
        SUM(CASE WHEN a.asistencia = 'Asistió' THEN 1 ELSE 0 END) AS AtencionesRealizadas,
        SUM(CASE WHEN a.asistencia = 'No asistió' THEN 1 ELSE 0 END) AS CitasConInasistencia,
        SUM(DATEDIFF(MINUTE, a.fecha_inicio, ISNULL(a.fecha_fin, DATEADD(MINUTE, 30, a.fecha_inicio)))) AS TiempoEnSillonDentalMin,
        SUM(CASE WHEN a.procedimiento_realizado IS NOT NULL AND a.indicaciones_finales IS NOT NULL THEN 1 ELSE 0 END) AS AtencionesFinalizadasConformes
    FROM [NexoSaludDB].dbo.[Atenciones] a
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Sede] ds ON a.id_sede = ds.id_sede
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Servicio] dserv ON a.id_servicio = dserv.id_servicio
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Profesional] dp ON a.id_profesional = dp.id_profesional
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_EstadoAtencion] dea ON dea.Asistencia = a.asistencia
    GROUP BY 
        CAST(FORMAT(a.fecha_atencion, 'yyyyMMdd') AS INT),
        ds.KeySede,
        dserv.KeyServicio,
        dp.KeyProfesional,
        dea.KeyEstadoAtencion
) AS oltp
ON fact.KeyTiempo = oltp.KeyTiempo 
   AND fact.KeySede = oltp.KeySede 
   AND fact.KeyServicio = oltp.KeyServicio 
   AND fact.KeyProfesional = oltp.KeyProfesional
   AND fact.KeyEstadoAtencion = oltp.KeyEstadoAtencion
WHEN MATCHED THEN
    UPDATE SET 
        fact.CitasEvaluables = oltp.CitasEvaluables,
        fact.AtencionesRealizadas = oltp.AtencionesRealizadas,
        fact.CitasConInasistencia = oltp.CitasConInasistencia,
        fact.TiempoEnSillonDentalMin = oltp.TiempoEnSillonDentalMin,
        fact.AtencionesFinalizadasConformes = oltp.AtencionesFinalizadasConformes
    WHEN NOT MATCHED THEN
        INSERT (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion, CitasEvaluables, AtencionesRealizadas, CitasConInasistencia, TiempoEnSillonDentalMin, AtencionesFinalizadasConformes)
        VALUES (oltp.KeyTiempo, oltp.KeySede, oltp.KeyServicio, oltp.KeyProfesional, oltp.KeyEstadoAtencion, oltp.CitasEvaluables, oltp.AtencionesRealizadas, oltp.CitasConInasistencia, oltp.TiempoEnSillonDentalMin, oltp.AtencionesFinalizadasConformes);
GO
