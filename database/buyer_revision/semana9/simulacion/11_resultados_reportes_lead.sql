-- Completa una muestra de las oportunidades sintéticas del script 10.
-- Ejecutar sobre NexoSaludDB. La carga dimensional se ejecuta aparte.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

IF DB_NAME() <> N'NexoSaludDB'
    THROW 55000, 'La muestra LEAD requiere NexoSaludDB.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @Ahora datetime2 = SYSDATETIME();
    DECLARE @Mes date = DATEFROMPARTS(YEAR(@Ahora), MONTH(@Ahora), 1);
    DECLARE @Lead int = (SELECT id_etapa FROM dbo.Etapas WHERE nombre = 'LEAD');

    -- El script se puede repetir después de un reinicio. Una repetición de la
    -- misma carga no añade otras negociaciones sobre las 350 oportunidades.
    IF EXISTS (
        SELECT 1 FROM dbo.PropuestasEconomicasLead p
        JOIN dbo.Solicitudes s ON s.id_solicitud = p.id_solicitud
        JOIN dbo.Personas a ON a.id_persona = s.id_persona
        WHERE a.email LIKE 'registro.%@nexosalud.invalid'
          AND p.promocion_aplicada = N'Descuento del 15 %'
          AND p.id_promocion_lead = (SELECT id_promocion FROM dbo.PromocionesLead
                                   WHERE nombre = N'Descuento del 15 %' AND id_servicio IS NULL)
    )
    BEGIN
        COMMIT TRANSACTION;
        PRINT 'La muestra de resultados LEAD ya está cargada.';
        RETURN;
    END;

    DECLARE @Casos table (
        id_solicitud int PRIMARY KEY, id_servicio int, id_sede int, caso int,
        presentacion datetime2, decision datetime2, precio decimal(10,2)
    );

    ;WITH Candidatas AS (
        SELECT s.id_solicitud, s.id_servicio, s.id_sede_interes_lead, s.fecha_ingreso_lead, t.precio,
            ROW_NUMBER() OVER (PARTITION BY s.id_servicio
                ORDER BY s.fecha_ingreso_lead, s.id_solicitud) AS numero
        FROM dbo.Solicitudes s WITH (UPDLOCK, HOLDLOCK)
        JOIN dbo.Personas p ON p.id_persona = s.id_persona
        CROSS APPLY (
            SELECT TOP (1) precio FROM dbo.Tarifas t
            WHERE t.id_servicio = s.id_servicio AND t.activo = 1
              AND t.fecha_inicio <= s.fecha_ingreso_lead
              AND (t.fecha_fin IS NULL OR t.fecha_fin >= s.fecha_ingreso_lead)
            ORDER BY t.fecha_inicio DESC, t.id_tarifa DESC
        ) t
        WHERE p.email LIKE 'registro.%@nexosalud.invalid'
          AND p.id_etapa_actual = @Lead
          AND s.resultado_comercial_lead = 'PENDIENTE'
          AND s.fecha_ingreso_lead BETWEEN @Mes AND DATEADD(hour, -12, @Ahora)
          AND NOT EXISTS (SELECT 1 FROM dbo.PropuestasEconomicasLead x WHERE x.id_solicitud = s.id_solicitud)
          AND NOT EXISTS (SELECT 1 FROM dbo.Opciones x WHERE x.id_solicitud = s.id_solicitud)
    )
    INSERT @Casos
    SELECT id_solicitud, id_servicio, id_sede_interes_lead, numero,
        DATEADD(minute, 30 + numero * 8, fecha_ingreso_lead),
        CASE WHEN numero <= 8 THEN DATEADD(minute, 240 + numero * 12, fecha_ingreso_lead) END,
        precio * CASE WHEN numero IN (1, 4, 6, 9) THEN 0.85
                      WHEN numero IN (2, 7) THEN 0.90 ELSE 1 END
    FROM Candidatas WHERE numero <= 10;

    IF (SELECT COUNT(*) FROM @Casos) <> 60
        THROW 55001, 'Se requieren 10 oportunidades sintéticas por tratamiento en el mes actual.', 1;

    INSERT dbo.MotivosRechazoLead (codigo, ambito, categoria, motivo)
    SELECT m.codigo, m.ambito, m.categoria, m.motivo
    FROM (VALUES
        ('PROP-PRECIO', 'PROPUESTA', 'ECONOMICO', N'Precio por encima del presupuesto'),
        ('PROP-CUOTAS', 'PROPUESTA', 'ECONOMICO', N'Condiciones de pago incompatibles'),
        ('PROP-POSTERGA', 'PROPUESTA', 'OTROS', N'Decidió postergar el tratamiento'),
        ('ALT-HORARIO', 'ALTERNATIVA', 'INCOMPATIBILIDAD', N'Horario incompatible con el trabajo'),
        ('ALT-SEDE', 'ALTERNATIVA', 'INCOMPATIBILIDAD', N'Sede de difícil acceso'),
        ('ALT-POSTERGA', 'ALTERNATIVA', 'OTROS', N'Prefiere retomar la atención más adelante')
    ) m(codigo, ambito, categoria, motivo)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.MotivosRechazoLead d WHERE d.codigo = m.codigo);

    INSERT dbo.PromocionesLead (nombre, tipo_promocion)
    SELECT p.nombre, 'Descuento'
    FROM (VALUES (N'Descuento del 15 %'), (N'Descuento del 10 %')) p(nombre)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.PromocionesLead d WHERE d.nombre = p.nombre AND d.id_servicio IS NULL);

    DECLARE @Propuestas table (id_solicitud int PRIMARY KEY, id_propuesta int);
    INSERT dbo.PropuestasEconomicasLead (id_solicitud, id_servicio, id_sede_lead, precio_cotizado,
        promocion_aplicada, id_promocion_lead, fecha_presentacion, estado, fecha_decision,
        id_motivo_rechazo_lead, motivo_rechazo, tipo_motivo_rechazo)
    OUTPUT inserted.id_solicitud, inserted.id_propuesta INTO @Propuestas
    SELECT c.id_solicitud, c.id_servicio, c.id_sede, c.precio,
        p.nombre, p.id_promocion, c.presentacion,
        CASE WHEN c.caso <= 5 THEN 'Aceptada' WHEN c.caso <= 8 THEN 'Rechazada' ELSE 'Pendiente' END,
        c.decision, m.id_motivo_rechazo, m.motivo,
        CASE m.categoria WHEN 'ECONOMICO' THEN 'Economico' WHEN 'OTROS' THEN 'Otro' END
    FROM @Casos c
    LEFT JOIN dbo.PromocionesLead p ON p.id_servicio IS NULL AND p.nombre = CASE
        WHEN c.caso IN (1, 4, 6, 9) THEN N'Descuento del 15 %'
        WHEN c.caso IN (2, 7) THEN N'Descuento del 10 %' END
    LEFT JOIN dbo.MotivosRechazoLead m ON m.codigo = CASE c.caso
        WHEN 6 THEN 'PROP-PRECIO' WHEN 7 THEN 'PROP-CUOTAS' WHEN 8 THEN 'PROP-POSTERGA' END;

    -- Se usan horarios existentes y únicamente profesionales habilitados para el servicio.
    INSERT dbo.Opciones (id_solicitud, id_disponibilidad, id_propuesta_lead, precio_ofrecido,
        fecha_ofrecida, estado_respuesta, fecha_respuesta, id_motivo_rechazo_lead,
        pref_dia_semana_lead, pref_turno_lead, pref_hora_inicio_lead, pref_hora_fin_lead, ofr_turno_lead)
    SELECT c.id_solicitud, d.id_disponibilidad, p.id_propuesta, c.precio,
        c.presentacion,
        CASE WHEN c.caso <= 5 THEN 'Aceptada' WHEN c.caso <= 8 THEN 'Rechazada' ELSE 'Pendiente' END,
        c.decision, m.id_motivo_rechazo,
        CASE WHEN c.caso = 6 THEN 6 ELSE DATEDIFF(day, CONVERT(date, '19000101'), d.fecha) % 7 + 1 END,
        CASE WHEN c.caso = 6 THEN N'Mañana' ELSE turno.nombre END,
        CASE WHEN c.caso = 6 THEN CONVERT(time, '10:00') ELSE d.hora_inicio END,
        CASE WHEN c.caso = 6 THEN CONVERT(time, '11:00') ELSE d.hora_fin END,
        turno.nombre
    FROM @Casos c
    JOIN @Propuestas p ON p.id_solicitud = c.id_solicitud
    CROSS APPLY (
        SELECT d.id_disponibilidad, d.fecha, d.hora_inicio, d.hora_fin
        FROM dbo.Disponibilidad d
        JOIN dbo.ProfesionalServicio ps ON ps.id_profesional = d.id_profesional AND ps.id_servicio = c.id_servicio
        WHERE d.estado = 'Disponible' AND d.fecha > CONVERT(date, c.presentacion)
        ORDER BY d.fecha, d.hora_inicio, d.id_disponibilidad
        OFFSET ((c.caso - 1) % 6) ROWS FETCH NEXT 1 ROW ONLY
    ) d
    CROSS APPLY (VALUES (CASE WHEN d.hora_inicio < '13:00' THEN N'Mañana'
        WHEN d.hora_inicio < '18:00' THEN N'Tarde' ELSE N'Noche' END)) turno(nombre)
    LEFT JOIN dbo.MotivosRechazoLead m ON m.codigo = CASE c.caso
        WHEN 6 THEN 'ALT-HORARIO' WHEN 7 THEN 'ALT-SEDE' WHEN 8 THEN 'ALT-POSTERGA' END;

    IF (SELECT COUNT(*) FROM dbo.Opciones o JOIN @Propuestas p ON p.id_propuesta = o.id_propuesta_lead) <> 10
        THROW 55002, 'La muestra requiere diez alternativas compatibles con los horarios instalados.', 1;

    UPDATE s SET
        resultado_comercial_lead = CASE WHEN c.caso <= 5 THEN 'ACEPTADA' ELSE 'CERRADA_SIN_ACUERDO' END,
        fecha_decision_comercial_lead = c.decision,
        valor_acordado_lead = CASE WHEN c.caso <= 5 THEN c.precio END,
        id_propuesta_aceptada_lead = CASE WHEN c.caso <= 5 THEN p.id_propuesta END,
        motivo_cierre_lead = CASE c.caso WHEN 6 THEN N'No se ajusta al presupuesto'
            WHEN 7 THEN N'No llegó a un acuerdo sobre las condiciones de pago'
            WHEN 8 THEN N'El paciente pospuso el tratamiento' END
    FROM dbo.Solicitudes s
    JOIN @Casos c ON c.id_solicitud = s.id_solicitud
    JOIN @Propuestas p ON p.id_solicitud = s.id_solicitud
    WHERE c.decision IS NOT NULL;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
