-- ====================================================================
-- ARCHIVO: 07_poblamiento_historico_multi_anio.sql
-- FASE: PAYER (Generador de Datos Históricos Multi-Año 2024 - 2026)
-- AUTORES: Mario y Marck
-- DESCRIPCIÓN: Inserta datos transaccionales realistas a lo largo de
-- múltiples años (2024, 2025 y 2026) y todos sus meses para permitir
-- análisis de series temporales, estacionalidad y segmentación en Power BI.
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE [NexoSaludDB];
GO

PRINT '==================================================================';
PRINT '  INICIANDO POBLAMIENTO HISTÓRICO MULTI-AÑO (2024, 2025, 2026)   ';
PRINT '==================================================================';

BEGIN TRANSACTION;

BEGIN TRY
    -- Nombres y Apellidos peruanos para generación aleatoria realista
    DECLARE @Nombres TABLE (id INT IDENTITY(1,1), nombre VARCHAR(50));
    INSERT INTO @Nombres (nombre) VALUES 
    ('Carlos'), ('María'), ('Juan'), ('Ana'), ('Luis'), ('Lucía'), ('Jorge'), ('Elena'),
    ('Diego'), ('Paola'), ('Gabriel'), ('Sofía'), ('Miguel'), ('Rosa'), ('Fernando'), ('Patricia'),
    ('Roberto'), ('Valeria'), ('Andrés'), ('Camila'), ('Javier'), ('Daniela'), ('Manuel'), ('Carmen'),
    ('Eduardo'), ('Natalia'), ('Ricardo'), ('Gabriela'), ('Alejandro'), ('Claudia');

    DECLARE @Apellidos TABLE (id INT IDENTITY(1,1), apellido VARCHAR(50));
    INSERT INTO @Apellidos (apellido) VALUES 
    ('García'), ('Flores'), ('Benites'), ('Chigne'), ('Zavaleta'), ('Alayo'), ('Mendoza'), ('Terrones'),
    ('Paredes'), ('Castillo'), ('Morales'), ('Rojas'), ('Vásquez'), ('Salazar'), ('Gutiérrez'), ('Quispe'),
    ('Mamani'), ('Huamán'), ('Cueva'), ('Vargas'), ('Silva'), ('Reyes'), ('Gómez'), ('Torres'),
    ('Díaz'), ('Peña'), ('Bendezú'), ('Bazán'), ('Cordero'), ('Carrasco');

    -- Catálogo de servicios y precios base
    DECLARE @ServiciosPrecios TABLE (id_servicio INT, precio DECIMAL(10,2));
    INSERT INTO @ServiciosPrecios (id_servicio, precio) VALUES 
    (1, 60.00),   -- Evaluación General
    (2, 80.00),   -- Limpieza / Profilaxis
    (3, 150.00),  -- Ortodoncia Inicial
    (4, 300.00),  -- Implante Dental
    (5, 120.00),  -- Restauración Estética
    (6, 200.00);  -- Blanqueamiento Dental

    -- Parámetros temporales: 2024 (12 meses), 2025 (12 meses), 2026 (meses 1 a 10)
    DECLARE @MesesConfig TABLE (anio INT, mes INT, cantidadRegistros INT);

    -- 2024: 15 registros por mes = 180 registros
    DECLARE @m INT = 1;
    WHILE @m <= 12
    BEGIN
        INSERT INTO @MesesConfig VALUES (2024, @m, 16);
        SET @m = @m + 1;
    END;

    -- 2025: 20 registros por mes = 240 registros
    SET @m = 1;
    WHILE @m <= 12
    BEGIN
        INSERT INTO @MesesConfig VALUES (2025, @m, 20);
        SET @m = @m + 1;
    END;

    -- 2026: 22 registros por mes de Enero a Octubre = 220 registros
    SET @m = 1;
    WHILE @m <= 10
    BEGIN
        -- Omitir septiembre 2026 porque ya cuenta con los 124 iniciales
        IF @m <> 9
            INSERT INTO @MesesConfig VALUES (2026, @m, 22);
        SET @m = @m + 1;
    END;

    DECLARE @CurAnio INT, @CurMes INT, @Cantidad INT;
    DECLARE @CurDia INT, @CurHora INT, @CurMinuto INT;
    DECLARE @FechaReg DATETIME2, @FechaDec DATETIME2, @FechaVal DATETIME2;
    DECLARE @IdPersona INT, @IdDisponibilidad INT, @IdSolicitud INT, @IdOpcion INT, @IdReserva INT, @IdPago INT;
    DECLARE @IdSede INT, @IdServicio INT, @IdProf INT;
    DECLARE @Precio DECIMAL(10,2), @MontoPago DECIMAL(10,2);
    DECLARE @Canal VARCHAR(50), @Estado VARCHAR(30), @ScoreRiesgo INT, @EtapaDunning VARCHAR(50);
    DECLARE @MotivoInc VARCHAR(50), @DescInc VARCHAR(200);

    DECLARE @NombreGen VARCHAR(50), @ApellidoGen VARCHAR(50), @DniGen CHAR(8), @EmailGen VARCHAR(100);
    DECLARE @DniCounter INT = 42000000;
    DECLARE @PagoCounter INT = 200;

    DECLARE config_cursor CURSOR FOR 
    SELECT anio, mes, cantidadRegistros FROM @MesesConfig ORDER BY anio, mes;

    OPEN config_cursor;
    FETCH NEXT FROM config_cursor INTO @CurAnio, @CurMes, @Cantidad;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @i INT = 1;
        WHILE @i <= @Cantidad
        BEGIN
            SET @DniCounter = @DniCounter + 1;
            SET @PagoCounter = @PagoCounter + 1;

            -- Generar fecha pseudo-aleatoria dentro del mes
            SET @CurDia = 1 + CAST(FLOOR(RAND() * 27) AS INT);
            SET @CurHora = 8 + CAST(FLOOR(RAND() * 11) AS INT);
            SET @CurMinuto = CAST(FLOOR(RAND() * 59) AS INT);

            SET @FechaReg = DATEFROMPARTS(@CurAnio, @CurMes, @CurDia);
            SET @FechaReg = DATEADD(HOUR, @CurHora, @FechaReg);
            SET @FechaReg = DATEADD(MINUTE, @CurMinuto, @FechaReg);

            -- Selección aleatoria de nombre, apellido, sede y servicio
            SELECT TOP 1 @NombreGen = nombre FROM @Nombres ORDER BY NEWID();
            SELECT TOP 1 @ApellidoGen = apellido FROM @Apellidos ORDER BY NEWID();
            SET @DniGen = CAST(@DniCounter AS CHAR(8));
            SET @EmailGen = LOWER(CONCAT(@NombreGen, '.', @ApellidoGen, @PagoCounter, '@gmail.com'));

            SET @IdSede = 1 + CAST(FLOOR(RAND() * 3) AS INT); -- 1, 2, 3
            SET @IdServicio = 1 + CAST(FLOOR(RAND() * 6) AS INT); -- 1 a 6
            SET @IdProf = 1 + CAST(FLOOR(RAND() * 4) AS INT); -- 1 a 4

            SELECT @Precio = precio FROM @ServiciosPrecios WHERE id_servicio = @IdServicio;
            SET @MontoPago = @Precio;

            -- Canal de pago ponderado: Yape (40%), Plin (20%), Tarjeta (25%), Transferencia (15%)
            DECLARE @rCanal FLOAT = RAND();
            IF @rCanal < 0.40 SET @Canal = 'Yape';
            ELSE IF @rCanal < 0.60 SET @Canal = 'Plin';
            ELSE IF @rCanal < 0.85 SET @Canal = 'Tarjeta (Web)';
            ELSE SET @Canal = 'Transferencia';

            -- Estado de pago ponderado:
            -- 86% Validado, 6% Pendiente (solo 2026), 5% Rechazado, 3% Revertido
            DECLARE @rEstado FLOAT = RAND();
            IF @CurAnio = 2026 AND @CurMes >= 8 AND @rEstado < 0.12
            BEGIN
                SET @Estado = 'PENDIENTE';
                SET @FechaDec = NULL;
                SET @FechaVal = NULL;
                SET @ScoreRiesgo = 40 + CAST(FLOOR(RAND() * 55) AS INT);
                SET @EtapaDunning = CASE WHEN @rEstado < 0.06 THEN 'Preventivo (T-48h)' ELSE 'Urgencia Clinica (T-24h)' END;
            END
            ELSE IF @rEstado < 0.88
            BEGIN
                SET @Estado = 'VALIDADO';
                SET @FechaDec = DATEADD(MINUTE, 5 + CAST(FLOOR(RAND() * 15) AS INT), @FechaReg);
                -- Validación rápida y realista entre 12 y 42 minutos tras la declaración
                SET @FechaVal = DATEADD(MINUTE, 12 + CAST(FLOOR(RAND() * 30) AS INT), @FechaDec);
                SET @ScoreRiesgo = CAST(FLOOR(RAND() * 35) AS INT);
                SET @EtapaDunning = 'Sin Notificación Previa';
            END
            ELSE IF @rEstado < 0.95
            BEGIN
                SET @Estado = 'RECHAZADO';
                SET @FechaDec = DATEADD(MINUTE, 10 + CAST(FLOOR(RAND() * 20) AS INT), @FechaReg);
                SET @FechaVal = DATEADD(MINUTE, 15 + CAST(FLOOR(RAND() * 25) AS INT), @FechaDec);
                SET @ScoreRiesgo = 65 + CAST(FLOOR(RAND() * 30) AS INT);
                SET @EtapaDunning = 'Cancelado (00:00h)';
            END
            ELSE
            BEGIN
                SET @Estado = 'REVERTIDO';
                SET @FechaDec = DATEADD(MINUTE, 10 + CAST(FLOOR(RAND() * 15) AS INT), @FechaReg);
                SET @FechaVal = DATEADD(MINUTE, 20 + CAST(FLOOR(RAND() * 30) AS INT), @FechaDec);
                SET @ScoreRiesgo = 75 + CAST(FLOOR(RAND() * 20) AS INT);
                SET @EtapaDunning = 'Cancelado (00:00h)';
            END;

            -- 1. Insertar Persona
            INSERT INTO dbo.Personas (
                nombres, apellidos, dni, email, numero, tipo_persona, 
                autoriza_contacto, estado_calidad, id_etapa_actual, fecha_registro
            )
            VALUES (
                @NombreGen, @ApellidoGen, @DniGen, @EmailGen, 
                CONCAT('9', CAST(10000000 + @DniCounter % 90000000 AS VARCHAR)),
                'Adulto', 1, 'Valido', 3, @FechaReg
            );
            SET @IdPersona = SCOPE_IDENTITY();

            -- 2. Insertar Disponibilidad médica
            INSERT INTO dbo.Disponibilidad (
                id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado
            )
            VALUES (
                @IdProf, @IdSede, CAST(@FechaReg AS DATE), 
                TIMEFROMPARTS(@CurHora, 0, 0, 0, 0),
                TIMEFROMPARTS(@CurHora + 1, 0, 0, 0, 0),
                CASE WHEN @Estado = 'VALIDADO' THEN 'Ocupado' ELSE 'Disponible' END
            );
            SET @IdDisponibilidad = SCOPE_IDENTITY();

            -- 3. Insertar Solicitud
            INSERT INTO dbo.Solicitudes (
                id_persona, id_servicio, fecha_solicitud, motivo, tipo_consulta, 
                prioridad, estado
            )
            VALUES (
                @IdPersona, @IdServicio, @FechaReg, 
                'Atención odontológica preventiva y correctiva', 
                'Tratamiento', 'Media', 
                CASE WHEN @Estado = 'VALIDADO' THEN 'Cerrada' ELSE 'En Proceso' END
            );
            SET @IdSolicitud = SCOPE_IDENTITY();

            -- 4. Insertar Opción
            INSERT INTO dbo.Opciones (
                id_solicitud, id_disponibilidad, precio_ofrecido, fecha_ofrecida, seleccionada
            )
            VALUES (
                @IdSolicitud, @IdDisponibilidad, @Precio, @FechaReg, 1
            );
            SET @IdOpcion = SCOPE_IDENTITY();

            -- 5. Insertar Reserva
            INSERT INTO dbo.Reservas (
                id_persona, id_solicitud, id_opcion, fecha_reserva, estado,
                confirmacion_explicita, fecha_confirmacion, fecha_vencimiento_bloqueo,
                ultima_alerta_dunning, score_riesgo_impago
            )
            VALUES (
                @IdPersona, @IdSolicitud, @IdOpcion, @FechaReg,
                CASE 
                    WHEN @Estado = 'VALIDADO' THEN 'Confirmada'
                    WHEN @Estado IN ('RECHAZADO', 'REVERTIDO') THEN 'Cancelada'
                    ELSE 'Pendiente'
                END,
                CASE WHEN @Estado = 'VALIDADO' THEN 1 ELSE 0 END,
                CASE WHEN @Estado = 'VALIDADO' THEN @FechaVal ELSE NULL END,
                DATEADD(DAY, 2, @FechaReg),
                @EtapaDunning,
                @ScoreRiesgo
            );
            SET @IdReserva = SCOPE_IDENTITY();

            -- 6. Insertar Pago
            INSERT INTO dbo.Pagos (
                id_persona, id_reserva, referencia_pago, importe, canal_pago,
                fecha_registro, fecha_declaracion, fecha_validacion, estado,
                comprobante, validado_por, observaciones, fecha_rechazo_reversion
            )
            VALUES (
                @IdPersona, @IdReserva,
                CONCAT('PR-', @CurAnio, RIGHT('00' + CAST(@CurMes AS VARCHAR), 2), '-', RIGHT('0000' + CAST(@PagoCounter AS VARCHAR), 4)),
                @MontoPago,
                @Canal,
                @FechaReg,
                @FechaDec,
                @FechaVal,
                @Estado,
                CASE WHEN @Estado <> 'PENDIENTE' THEN CONCAT('voucher_', @PagoCounter, '.jpg') ELSE NULL END,
                CASE WHEN @Estado = 'VALIDADO' THEN 1 ELSE NULL END,
                CASE WHEN @Estado = 'VALIDADO' THEN 'Pago bancario conciliado conforme' ELSE 'En proceso de verificación' END,
                CASE WHEN @Estado IN ('RECHAZADO', 'REVERTIDO') THEN @FechaVal ELSE NULL END
            );
            SET @IdPago = SCOPE_IDENTITY();

            -- 7. Si fue RECHAZADO o REVERTIDO, registrar Incidencia obligatoria
            IF @Estado IN ('RECHAZADO', 'REVERTIDO')
            BEGIN
                IF @Estado = 'REVERTIDO'
                BEGIN
                    SET @MotivoInc = 'CONTRACARGO_BANCARIO';
                    SET @DescInc = 'Titular desconoció la transacción con la entidad financiera posterior a la confirmación';
                END
                ELSE
                BEGIN
                    DECLARE @rMotivo FLOAT = RAND();
                    IF @rMotivo < 0.35 
                    BEGIN
                        SET @MotivoInc = 'COMPROBANTE_ILEGIBLE';
                        SET @DescInc = 'El comprobante digital adjuntado no permite visualizar el número de operación ni fecha';
                    END
                    ELSE IF @rMotivo < 0.70
                    BEGIN
                        SET @MotivoInc = 'MONTO_DISCREPANTE';
                        SET @DescInc = 'El monto transferido difiere de la condición económica pactada para la reserva médica';
                    END
                    ELSE
                    BEGIN
                        SET @MotivoInc = 'OPERACION_NO_HABIDA';
                        SET @DescInc = 'El código de operación declarado no figura acreditado en el extracto bancario de la clínica';
                    END;
                END;

                INSERT INTO dbo.Incidencias (
                    id_persona, id_pago, id_reserva, tipo, descripcion, prioridad,
                    estado, fecha_registro, fecha_resolucion, id_usuario_responsable, motivo_tipificado
                )
                VALUES (
                    @IdPersona, @IdPago, @IdReserva,
                    CASE WHEN @Estado = 'REVERTIDO' THEN 'PAGO_REVERTIDO' ELSE 'PAGO_RECHAZADO' END,
                    @DescInc,
                    'Alta',
                    'Cerrada',
                    @FechaVal,
                    @FechaVal,
                    1,
                    @MotivoInc
                );
            END;

            SET @i = @i + 1;
        END;

        FETCH NEXT FROM config_cursor INTO @CurAnio, @CurMes, @Cantidad;
    END;

    CLOSE config_cursor;
    DEALLOCATE config_cursor;

    COMMIT TRANSACTION;
    PRINT '>> Poblamiento histórico OLTP completado exitosamente en NexoSaludDB.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    IF CURSOR_STATUS('global', 'config_cursor') >= 0
    BEGIN
        CLOSE config_cursor;
        DEALLOCATE config_cursor;
    END;
    PRINT 'ERROR en poblamiento histórico: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
