-- Agenda de prueba para LEAD. @Aplicar = 0 verifica y revierte la carga.
USE [NexoSaludDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Aplicar bit = 0;
DECLARE @Hoy date = CONVERT(date, DATEADD(hour, -5, SYSUTCDATETIME()));

DECLARE @Equipo table (
    codigo varchar(50) PRIMARY KEY,
    nombres nvarchar(50), apellidos nvarchar(50), especialidad nvarchar(100),
    id_sede int, orden int, servicio_principal int, servicio_adicional int NULL
);
INSERT @Equipo VALUES
    ('COP-TRU-1001', N'Valeria', N'Mendoza', N'Odontología Preventiva y General', 1, 1, 1, 2),
    ('COP-TRU-1002', N'Diego', N'Salazar', N'Ortodoncia y Ortopedia Maxilar', 1, 2, 3, NULL),
    ('LEAD-PRUEBA-01', N'Paola', N'Reyes Castañeda', N'Rehabilitación Oral e Implantes', 1, 3, 4, NULL),
    ('LEAD-PRUEBA-02', N'Javier', N'Gutiérrez Vera', N'Odontología Restauradora', 1, 4, 5, 1),
    ('LEAD-PRUEBA-03', N'Andrea', N'Cueva Rojas', N'Odontología Estética', 1, 5, 6, 5),
    ('COP-TRU-1003', N'Lucía', N'Vásquez', N'Rehabilitación Oral e Implantes', 2, 1, 4, NULL),
    ('LEAD-PRUEBA-04', N'Mariana', N'Torres Alva', N'Odontología Preventiva y General', 2, 2, 1, 2),
    ('LEAD-PRUEBA-05', N'Fernando', N'Vargas León', N'Ortodoncia y Ortopedia Maxilar', 2, 3, 3, NULL),
    ('LEAD-PRUEBA-06', N'Camila', N'Flores Mendoza', N'Odontología Restauradora', 2, 4, 5, 1),
    ('LEAD-PRUEBA-07', N'Luis Alberto', N'Ramírez Córdova', N'Odontología Estética', 2, 5, 6, 2),
    ('COP-TRU-1004', N'Renzo', N'Alva', N'Periodoncia y Cirugía Oral', 3, 1, 2, 1),
    ('LEAD-PRUEBA-08', N'Daniela', N'Paredes Chávez', N'Ortodoncia y Ortopedia Maxilar', 3, 2, 3, NULL),
    ('LEAD-PRUEBA-09', N'Miguel Ángel', N'Campos Rivas', N'Rehabilitación Oral e Implantes', 3, 3, 4, NULL),
    ('LEAD-PRUEBA-10', N'Natalia', N'Aguilar Salinas', N'Odontología Restauradora', 3, 4, 5, 1),
    ('LEAD-PRUEBA-11', N'Ricardo', N'Villanueva Cruz', N'Odontología Estética', 3, 5, 6, 2);

BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @Bloqueo int;
    EXEC @Bloqueo = sys.sp_getapplock @Resource = 'AGENDA_PRUEBA_LEAD', @LockMode = 'Exclusive',
        @LockOwner = 'Transaction', @LockTimeout = 5000;
    IF @Bloqueo < 0
        THROW 55010, 'No se pudo bloquear la carga de agenda.', 1;

    IF EXISTS (
        SELECT 1 FROM @Equipo e
        LEFT JOIN dbo.Sedes s ON s.id_sede = e.id_sede AND s.activo = 1
        LEFT JOIN dbo.Servicios a ON a.id_servicio = e.servicio_principal AND a.activo = 1
        LEFT JOIN dbo.Servicios b ON b.id_servicio = e.servicio_adicional AND b.activo = 1
        WHERE s.id_sede IS NULL OR a.id_servicio IS NULL
            OR (e.servicio_adicional IS NOT NULL AND b.id_servicio IS NULL)
    )
        THROW 55011, 'Faltan sedes o tratamientos activos para la agenda de prueba.', 1;

    INSERT dbo.Profesionales (nombres, apellidos, numero_colegiatura, especialidad)
    SELECT e.nombres, e.apellidos, e.codigo, e.especialidad
    FROM @Equipo e
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Profesionales p WITH (UPDLOCK, HOLDLOCK)
                      WHERE p.numero_colegiatura = e.codigo);
    DECLARE @NuevosProfesionales int = @@ROWCOUNT;

    SELECT e.*, p.id_profesional INTO #Equipo
    FROM @Equipo e JOIN dbo.Profesionales p ON p.numero_colegiatura = e.codigo AND p.activo = 1;

    IF (SELECT COUNT(*) FROM #Equipo) <> 15
        OR (SELECT COUNT(DISTINCT id_profesional) FROM #Equipo) <> 15
        THROW 55012, 'La agenda requiere quince profesionales activos y distintos.', 1;

    INSERT dbo.ProfesionalServicio (id_profesional, id_servicio)
    SELECT e.id_profesional, servicios.id_servicio
    FROM #Equipo e CROSS APPLY (VALUES (e.servicio_principal), (e.servicio_adicional)) servicios(id_servicio)
    WHERE servicios.id_servicio IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.ProfesionalServicio ps WITH (UPDLOCK, HOLDLOCK)
                      WHERE ps.id_profesional = e.id_profesional AND ps.id_servicio = servicios.id_servicio);

    -- Tres días por profesional, con tres citas de 30 o 45 minutos en cada turno.
    -- Cada profesional rota por mañana, tarde y noche.
    INSERT dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
    SELECT e.id_profesional, e.id_sede, agenda.fecha, tramo.inicio, tramo.fin, 'Disponible'
    FROM #Equipo e
    CROSS JOIN (VALUES (0), (1), (2)) jornada(n)
    CROSS JOIN (VALUES (0), (1), (2)) cita(n)
    CROSS APPLY (VALUES (
        DATEADD(day, 1 + (e.orden + e.id_sede) % 3 + jornada.n * 3, @Hoy),
        CASE (e.orden + jornada.n) % 3
            WHEN 0 THEN 510 + 30 * (e.id_sede % 2)
            WHEN 1 THEN 840 + 30 * (e.id_sede % 2)
            ELSE 1080
        END,
        CASE WHEN e.servicio_principal IN (3,4) AND (e.orden + jornada.n) % 3 <> 2 THEN 45 ELSE 30 END
    )) agenda(fecha, minuto, duracion)
    CROSS APPLY (VALUES (
        CONVERT(time, DATEADD(minute, agenda.minuto + cita.n * agenda.duracion, CONVERT(datetime2, @Hoy))),
        CONVERT(time, DATEADD(minute, agenda.minuto + (cita.n + 1) * agenda.duracion, CONVERT(datetime2, @Hoy)))
    )) tramo(inicio, fin)
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.Disponibilidad d WITH (UPDLOCK, HOLDLOCK)
        WHERE d.id_profesional = e.id_profesional AND d.fecha = agenda.fecha
          AND d.hora_inicio < tramo.fin AND d.hora_fin > tramo.inicio
    );
    DECLARE @NuevosHorarios int = @@ROWCOUNT;

    SELECT e.id_sede, e.id_profesional, COUNT(*) AS horarios_futuros
    INTO #Agenda
    FROM #Equipo e
    JOIN dbo.Disponibilidad d ON d.id_profesional = e.id_profesional AND d.id_sede = e.id_sede
    WHERE d.fecha > @Hoy AND d.estado = 'Disponible'
      AND NOT EXISTS (
          SELECT 1 FROM dbo.Opciones o JOIN dbo.Reservas r ON r.id_opcion = o.id_opcion
          WHERE o.id_disponibilidad = d.id_disponibilidad AND r.estado NOT IN ('Cancelada','Vencida')
      )
    GROUP BY e.id_sede, e.id_profesional;

    IF (SELECT COUNT(*) FROM #Agenda) <> 15
        OR EXISTS (SELECT 1 FROM #Agenda WHERE horarios_futuros < 6)
        THROW 55013, 'Faltan profesionales o citas libres en la agenda futura.', 1;

    SELECT s.nombre AS sede, COUNT(*) AS especialistas, SUM(a.horarios_futuros) AS horarios_futuros
    FROM #Agenda a JOIN dbo.Sedes s ON s.id_sede = a.id_sede
    GROUP BY s.nombre ORDER BY s.nombre;
    SELECT @NuevosProfesionales AS profesionales_agregados, @NuevosHorarios AS horarios_agregados,
        DATEADD(day, 1, @Hoy) AS desde, DATEADD(day, 9, @Hoy) AS hasta;
    DROP TABLE #Agenda, #Equipo;

    IF @Aplicar = 1
    BEGIN
        COMMIT TRANSACTION;
        PRINT 'Agenda guardada.';
    END
    ELSE
    BEGIN
        ROLLBACK TRANSACTION;
        PRINT 'Prueba revertida.';
    END;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
