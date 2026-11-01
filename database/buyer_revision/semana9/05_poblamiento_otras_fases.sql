/* COMPLEMENTO SEMANA 9: LEAD, PAYER, CUSTOMER Y TURNED.
   Puede ejecutarse despues de haber cargado Buyer, sin recrear ni borrar bases.
   No modifica el hecho Buyer ni CaptacionesBuyer.
   Conserva calculos originales de estas fases (incluidos limites heredados:
   costo_transaccion=3%, MIN de dimensiones, definiciones de estados y seguimiento).
   Unica correccion de integracion: JOIN de fuente en PAYER previamente validado.
   No debe interpretarse como auditoria o rediseno de los otros cuatro indicadores/fases.
*/
USE NexoSaludDB;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @bloqueo_otras INT;
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC @bloqueo_otras=sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
         @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
    IF @bloqueo_otras<0 THROW 51400,'Otro ETL esta en ejecucion.',1;
    IF COL_LENGTH('NexoSalud_Mart.dbo.fact_captacion_buyer','id_persona') IS NULL
        THROW 51401,'Este complemento corresponde al esquema revisado de Semana 9.',1;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Sede WHERE KeySede=0)
        THROW 51411,'Ejecutar primero la carga Buyer para preparar dimensiones compartidas.',1;

    -- Completar el calendario con las fechas de las demas operaciones.
    MERGE NexoSalud_Mart.dbo.Dim_Tiempo AS dim USING (
        SELECT CAST(fecha_solicitud AS DATE) AS id_fecha FROM dbo.Solicitudes
        WHERE fecha_solicitud IS NOT NULL
        UNION SELECT CAST(fecha_reserva AS DATE) FROM dbo.Reservas WHERE fecha_reserva IS NOT NULL
        UNION SELECT CAST(fecha_registro AS DATE) FROM dbo.Pagos WHERE fecha_registro IS NOT NULL
        UNION SELECT CAST(fecha_atencion AS DATE) FROM dbo.Atenciones WHERE fecha_atencion IS NOT NULL
        UNION SELECT CAST(fecha_hora AS DATE) FROM dbo.Seguimientos WHERE fecha_hora IS NOT NULL
    ) AS origen ON origen.id_fecha=dim.id_fecha
    WHEN NOT MATCHED THEN INSERT (KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia)
        VALUES (YEAR(origen.id_fecha)*10000+MONTH(origen.id_fecha)*100+DAY(origen.id_fecha),
                origen.id_fecha,YEAR(origen.id_fecha),DATEPART(QUARTER,origen.id_fecha),
                MONTH(origen.id_fecha),DAY(origen.id_fecha));

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

    -- Detener la carga si un lookup existente multiplicaria registros.
    IF EXISTS (SELECT id_fecha FROM NexoSalud_Mart.dbo.Dim_Tiempo
               GROUP BY id_fecha HAVING COUNT(*)>1)
        THROW 51402,'Fechas duplicadas en Dim_Tiempo.',1;
    IF EXISTS (SELECT id_hora FROM NexoSalud_Mart.dbo.Dim_Hora
               WHERE id_hora IS NOT NULL GROUP BY id_hora HAVING COUNT(*)>1)
        THROW 51403,'Horas duplicadas en Dim_Hora.',1;
    IF EXISTS (SELECT id_persona FROM NexoSalud_Mart.dbo.Dim_Pagador
               WHERE id_persona IS NOT NULL GROUP BY id_persona HAVING COUNT(*)>1)
        THROW 51404,'Pagadores duplicados.',1;
    IF EXISTS (SELECT id_profesional FROM NexoSalud_Mart.dbo.Dim_Profesional
               WHERE id_profesional IS NOT NULL GROUP BY id_profesional HAVING COUNT(*)>1)
        THROW 51405,'Profesionales duplicados.',1;
    IF EXISTS (SELECT id_usuario FROM NexoSalud_Mart.dbo.Dim_Negociador
               WHERE id_usuario IS NOT NULL GROUP BY id_usuario HAVING COUNT(*)>1)
        THROW 51406,'Negociadores duplicados.',1;
    IF EXISTS (SELECT MetodoPago FROM NexoSalud_Mart.dbo.Dim_Pasarela
               GROUP BY MetodoPago HAVING COUNT(*)>1)
        THROW 51407,'Mas de una pasarela por metodo: revisar lookup original.',1;
    IF EXISTS (SELECT EstadoPago,ComprobanteAdjunto FROM NexoSalud_Mart.dbo.Dim_Cobro
               GROUP BY EstadoPago,ComprobanteAdjunto HAVING COUNT(*)>1)
        THROW 51408,'Estados de cobro duplicados.',1;
    IF EXISTS (SELECT EstadoFinal,Asistencia FROM NexoSalud_Mart.dbo.Dim_EstadoAtencion
               GROUP BY EstadoFinal,Asistencia HAVING COUNT(*)>1)
        THROW 51409,'Estados de atencion duplicados.',1;
    IF EXISTS (SELECT id_campana FROM NexoSalud_Mart.dbo.Dim_Fuente WHERE id_campana>0
               GROUP BY id_campana HAVING COUNT(*)>1)
        THROW 51410,'Campanas duplicadas en Dim_Fuente.',1;

-- 2. HECHO: NEGOCIACIÓN LEAD
-- Grano PK: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador)
DELETE [NexoSalud_Mart].[dbo].fact_negociacion_lead;

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

-- 3. HECHO: GESTIÓN PAYER
-- Grano PK: (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio)
DELETE [NexoSalud_Mart].[dbo].fact_gestion_payer;

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
-- Correccion puntual ya comprobada: no multiplicar cada pago por las campanas de la fuente 1.
LEFT JOIN NexoSaludDB.dbo.Personas persona ON persona.id_persona = p.id_persona
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Fuente df ON df.id_campana = persona.id_campana_origen
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

-- 4. HECHO: ATENCIÓN CUSTOMER
-- Grano PK: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion)
DELETE [NexoSalud_Mart].[dbo].fact_atencion_customer;

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

-- 5. HECHO: SEGUIMIENTO TURNED
-- Grano PK: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal)
DELETE [NexoSalud_Mart].[dbo].fact_seguimiento_turned;

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

    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK;
    THROW;
END CATCH;
GO
