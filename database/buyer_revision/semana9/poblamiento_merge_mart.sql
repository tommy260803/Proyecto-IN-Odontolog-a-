/* ETL EXCLUSIVO BUYER -- revision de Semana 9.
   No sustituye el poblamiento de LEAD/PAYER/CUSTOMER/TURNED.
   Estilo de laboratorio: preparar SELECT, MERGE de dimensiones, DELETE + INSERT del hecho.
   Ejecutar despues de init_oltp/init_mart nuevos O de migracion_buyer.sql.
   Detener el syncBuyer antiguo del backend antes de cargar este esquema.
   No infiere sede desde zona ni conversion desde Solicitudes/etapa actual.
*/
USE NexoSaludDB;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @corte DATETIME2=SYSDATETIME(),@bloqueo INT;
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC @bloqueo=sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
         @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
    IF @bloqueo<0 THROW 51200,'Otro ETL Buyer esta en ejecucion.',1;
    IF COL_LENGTH('NexoSalud_Mart.dbo.fact_captacion_buyer','id_persona') IS NULL
        THROW 51201,'Falta aplicar el DDL/migracion atomica Buyer.',1;

    -- 1. Incorporar identidades historicas aun sin captacion estructurada.
    -- Los valores observados NO prueban el estado que tenian al registrarse.
    -- No se inventan sede, servicio, motivo, autorizacion ni fecha de conversion.
    INSERT dbo.CaptacionesBuyer
        (id_persona,fecha_captacion,id_canal,id_fuente,id_campana,
         estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
    SELECT p.id_persona,p.fecha_registro,p.id_canal_origen,ca.id_fuente,p.id_campana_origen,
           p.estado_calidad,p.autoriza_contacto,p.fecha_autorizacion,'HISTORICO_OBSERVADO'
    FROM dbo.Personas p
    LEFT JOIN dbo.Campanas ca ON ca.id_campana=p.id_campana_origen
    WHERE p.fecha_registro<=@corte AND NOT EXISTS
        (SELECT 1 FROM dbo.CaptacionesBuyer c WHERE c.id_persona=p.id_persona);

    IF EXISTS (SELECT 1 FROM dbo.CaptacionesBuyer c JOIN dbo.Campanas ca
               ON ca.id_campana=c.id_campana WHERE c.id_fuente IS NOT NULL
               AND c.id_fuente<>ca.id_fuente)
        THROW 51202,'Captacion con fuente distinta de su campana.',1;
    IF EXISTS (SELECT 1 FROM dbo.EventosEtapa e JOIN dbo.CaptacionesBuyer c
               ON c.id_captacion=e.id_captacion WHERE e.id_persona<>c.id_persona)
        THROW 51203,'Evento vinculado a captacion de otra persona.',1;

    -- 2. Preparar datos al mismo corte. No hay promedio de grupos.
    SELECT v.* INTO #DatosBuyer FROM dbo.v_DatosCaptacionBuyer v
    WHERE v.fecha_captacion<=@corte;
    CREATE UNIQUE INDEX UQ_DatosBuyer_Persona ON #DatosBuyer(id_persona);

    -- 3. Miembros desconocidos (Key=0). Nunca usar sede/campana real por defecto.
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Tiempo WHERE KeyTiempo=0)
        INSERT NexoSalud_Mart.dbo.Dim_Tiempo
        VALUES (0,'19000101',1900,1,1,1);
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Sede WHERE KeySede=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Sede ON;
        INSERT NexoSalud_Mart.dbo.Dim_Sede (KeySede,id_sede,Sede,Distrito,Zona) VALUES (0,0,'No especificada','No especificado','No especificada');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Sede OFF;
    END;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Servicio WHERE KeyServicio=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Servicio ON;
        INSERT NexoSalud_Mart.dbo.Dim_Servicio (KeyServicio,id_servicio,ServicioOdontologico,Categoria,Procedimiento) VALUES (0,0,'No especificado','No especificada','No especificado');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Servicio OFF;
    END;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Canal WHERE KeyCanal=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Canal ON;
        INSERT NexoSalud_Mart.dbo.Dim_Canal (KeyCanal,id_canal,NombreCanal,TipoMedio) VALUES (0,0,'No especificado','No especificado');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Canal OFF;
    END;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Fuente WHERE KeyFuente=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Fuente ON;
        INSERT NexoSalud_Mart.dbo.Dim_Fuente (KeyFuente,id_fuente,id_campana,TipoOrigen,Campana) VALUES (0,0,0,'No especificada','Sin campana');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Fuente OFF;
    END;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_TipoPersona WHERE KeyTipoPersona=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_TipoPersona ON;
        INSERT NexoSalud_Mart.dbo.Dim_TipoPersona (KeyTipoPersona,id_persona,Ocupacion,RangoEdad) VALUES (0,0,'No especificada','No especificado');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_TipoPersona OFF;
    END;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_EstadoRegistro WHERE KeyEstadoRegistro=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_EstadoRegistro ON;
        INSERT NexoSalud_Mart.dbo.Dim_EstadoRegistro (KeyEstadoRegistro,EstadoCalidad,AutorizacionContacto) VALUES (0,'No especificado','NO');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_EstadoRegistro OFF;
    END;

    -- 4. Preparar fechas de captacion y conversion (roles de la misma dimension).
    MERGE NexoSalud_Mart.dbo.Dim_Tiempo AS dim
    USING (
        SELECT id_fecha=CAST(fecha_captacion AS DATE) FROM #DatosBuyer
        UNION
        SELECT CAST(fecha_conversion AS DATE) FROM #DatosBuyer
        WHERE fecha_conversion IS NOT NULL AND fecha_conversion<=@corte
    ) AS origen ON origen.id_fecha=dim.id_fecha
    WHEN NOT MATCHED THEN
        INSERT (KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia)
        VALUES (YEAR(origen.id_fecha)*10000+MONTH(origen.id_fecha)*100+DAY(origen.id_fecha),
                origen.id_fecha,YEAR(origen.id_fecha),DATEPART(QUARTER,origen.id_fecha),
                MONTH(origen.id_fecha),DAY(origen.id_fecha));
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

    -- Fuente/campana: incluir fuente conocida sin campana, sin escoger una campana arbitraria.
    MERGE NexoSalud_Mart.dbo.Dim_Fuente AS dim
    USING (
        SELECT f.id_fuente,c.id_campana,f.nombre AS TipoOrigen,c.nombre AS Campana
        FROM dbo.Fuentes f JOIN dbo.Campanas c ON c.id_fuente=f.id_fuente
        UNION ALL
        SELECT f.id_fuente,CAST(NULL AS INT),f.nombre,'Sin campana'
        FROM dbo.Fuentes f
    ) AS origen
    ON dim.id_fuente=origen.id_fuente
       AND ISNULL(dim.id_campana,0)=ISNULL(origen.id_campana,0)
    WHEN MATCHED THEN UPDATE SET dim.TipoOrigen=origen.TipoOrigen,dim.Campana=origen.Campana
    WHEN NOT MATCHED THEN INSERT (id_fuente,id_campana,TipoOrigen,Campana)
        VALUES (origen.id_fuente,origen.id_campana,origen.TipoOrigen,origen.Campana);

    MERGE NexoSalud_Mart.dbo.Dim_EstadoRegistro AS dim
    USING (
        SELECT DISTINCT estado_calidad AS EstadoCalidad,
               CASE WHEN autoriza_contacto=1 THEN 'SI' ELSE 'NO' END AS AutorizacionContacto
        FROM #DatosBuyer
    ) AS origen
    ON dim.EstadoCalidad=origen.EstadoCalidad
       AND dim.AutorizacionContacto=origen.AutorizacionContacto
    WHEN NOT MATCHED THEN INSERT (EstadoCalidad,AutorizacionContacto)
        VALUES (origen.EstadoCalidad,origen.AutorizacionContacto);

    -- 5. Un lookup debe devolver como maximo una fila. Abortamos antes de borrar el hecho.
    IF EXISTS (SELECT id_fecha FROM NexoSalud_Mart.dbo.Dim_Tiempo GROUP BY id_fecha HAVING COUNT(*)>1)
        THROW 51204,'Dim_Tiempo tiene fechas duplicadas.',1;
    IF EXISTS (SELECT id_sede FROM NexoSalud_Mart.dbo.Dim_Sede WHERE id_sede IS NOT NULL
               GROUP BY id_sede HAVING COUNT(*)>1)
        THROW 51205,'Dim_Sede tiene identificadores duplicados.',1;
    IF EXISTS (SELECT id_servicio FROM NexoSalud_Mart.dbo.Dim_Servicio WHERE id_servicio IS NOT NULL
               GROUP BY id_servicio HAVING COUNT(*)>1)
        THROW 51206,'Dim_Servicio tiene identificadores duplicados.',1;
    IF EXISTS (SELECT id_canal FROM NexoSalud_Mart.dbo.Dim_Canal WHERE id_canal IS NOT NULL
               GROUP BY id_canal HAVING COUNT(*)>1)
        THROW 51207,'Dim_Canal tiene identificadores duplicados.',1;
    IF EXISTS (SELECT id_fuente,ISNULL(id_campana,0) FROM NexoSalud_Mart.dbo.Dim_Fuente
               GROUP BY id_fuente,ISNULL(id_campana,0) HAVING COUNT(*)>1)
        THROW 51208,'Dim_Fuente tiene pares fuente/campana duplicados.',1;
    IF EXISTS (SELECT id_persona FROM NexoSalud_Mart.dbo.Dim_TipoPersona WHERE id_persona IS NOT NULL
               GROUP BY id_persona HAVING COUNT(*)>1)
        THROW 51209,'Dim_TipoPersona tiene personas duplicadas.',1;
    IF EXISTS (SELECT EstadoCalidad,AutorizacionContacto FROM NexoSalud_Mart.dbo.Dim_EstadoRegistro
               GROUP BY EstadoCalidad,AutorizacionContacto HAVING COUNT(*)>1)
        THROW 51210,'Dim_EstadoRegistro tiene combinaciones duplicadas.',1;

    -- 6. Gasto original por campana/mes; no se inventan importes si falta evidencia.
    SELECT id_campana,YEAR(fecha)*100+MONTH(fecha) AS anio_mes,
           CAST(SUM(importe)*100 AS BIGINT) AS centimos
    INTO #GastosBuyer FROM dbo.GastosCampana
    WHERE fecha<=CAST(@corte AS DATE)
    GROUP BY id_campana,YEAR(fecha)*100+MONTH(fecha);
    SELECT id_campana,YEAR(fecha_captacion)*100+MONTH(fecha_captacion) AS anio_mes,
           COUNT_BIG(*) AS cantidad
    INTO #CantidadBuyer FROM #DatosBuyer WHERE id_campana IS NOT NULL
    GROUP BY id_campana,YEAR(fecha_captacion)*100+MONTH(fecha_captacion);

    -- 7. Preparacion final: mismas cinco medidas, UNA fila por persona.
    SELECT b.id_persona,b.id_captacion,dt.KeyTiempo,
           CASE WHEN b.fecha_conversion<=@corte THEN dconv.KeyTiempo END AS KeyTiempoConversion,
           COALESCE(ds.KeySede,0) AS KeySede,COALESCE(dserv.KeyServicio,0) AS KeyServicio,
           COALESCE(dc.KeyCanal,0) AS KeyCanal,COALESCE(df.KeyFuente,0) AS KeyFuente,
           COALESCE(dtp.KeyTipoPersona,0) AS KeyTipoPersona,
           COALESCE(der.KeyEstadoRegistro,0) AS KeyEstadoRegistro,
           b.contacto_registrado,b.contacto_utilizable,
           CASE WHEN b.fecha_conversion<=@corte THEN 1 ELSE 0 END AS conversion_lead,
           CASE WHEN b.fecha_conversion<=@corte
                THEN CAST(DATEDIFF_BIG(SECOND,b.fecha_captacion,b.fecha_conversion)/86400.0
                          AS DECIMAL(18,6)) END AS tiempo_conversion_dia,
           CAST(CASE WHEN g.centimos IS NULL THEN NULL ELSE
                (g.centimos/q.cantidad + CASE WHEN
                    (SELECT COUNT_BIG(*) FROM #DatosBuyer b2
                     WHERE b2.id_campana=b.id_campana
                       AND YEAR(b2.fecha_captacion)*100+MONTH(b2.fecha_captacion)=g.anio_mes
                       AND b2.id_persona<=b.id_persona)<=g.centimos%q.cantidad
                 THEN 1 ELSE 0 END)/100.0 END AS DECIMAL(14,2)) AS costo_atribuido_captacion,
           b.fecha_captacion,
           CASE WHEN b.fecha_conversion<=@corte THEN b.fecha_conversion END AS fecha_conversion,
           CASE WHEN b.fecha_conversion<=@corte THEN b.id_evento_conversion END AS id_evento_conversion,
           b.origen_datos,@corte AS fecha_corte_etl
    INTO #HechoBuyer
    FROM #DatosBuyer b
    JOIN NexoSalud_Mart.dbo.Dim_Tiempo dt ON dt.id_fecha=CAST(b.fecha_captacion AS DATE)
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Tiempo dconv ON dconv.id_fecha=CAST(b.fecha_conversion AS DATE)
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Sede ds ON ds.id_sede=b.id_sede
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Servicio dserv ON dserv.id_servicio=b.id_servicio
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Canal dc ON dc.id_canal=b.id_canal
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Fuente df
        ON df.id_fuente=COALESCE(b.id_fuente,0)
       AND ISNULL(df.id_campana,0)=ISNULL(b.id_campana,0)
    LEFT JOIN NexoSalud_Mart.dbo.Dim_TipoPersona dtp ON dtp.id_persona=b.id_persona
    LEFT JOIN NexoSalud_Mart.dbo.Dim_EstadoRegistro der
        ON der.EstadoCalidad=b.estado_calidad
       AND der.AutorizacionContacto=CASE WHEN b.autoriza_contacto=1 THEN 'SI' ELSE 'NO' END
    LEFT JOIN #GastosBuyer g ON g.id_campana=b.id_campana
       AND g.anio_mes=YEAR(b.fecha_captacion)*100+MONTH(b.fecha_captacion)
    LEFT JOIN #CantidadBuyer q ON q.id_campana=b.id_campana AND q.anio_mes=g.anio_mes;
    CREATE UNIQUE INDEX UQ_HechoBuyer_Persona ON #HechoBuyer(id_persona);
    DECLARE @cantidad_origen BIGINT=(SELECT COUNT_BIG(*) FROM #DatosBuyer),
            @cantidad_destino BIGINT=(SELECT COUNT_BIG(*) FROM #HechoBuyer);
    IF @cantidad_origen<>@cantidad_destino
        THROW 51211,'Perdida o duplicacion de contactos antes de cargar.',1;

    -- 8. Carga completa SOLO de Buyer; si falla, la transaccion conserva el estado anterior.
    DELETE FROM NexoSalud_Mart.dbo.fact_captacion_buyer;
    INSERT NexoSalud_Mart.dbo.fact_captacion_buyer
        (id_persona,id_captacion,KeyTiempo,KeyTiempoConversion,KeySede,KeyServicio,
         KeyCanal,KeyFuente,KeyTipoPersona,KeyEstadoRegistro,contacto_registrado,
         contacto_utilizable,conversion_lead,tiempo_conversion_dia,costo_atribuido_captacion,
         fecha_captacion,fecha_conversion,id_evento_conversion,origen_datos,fecha_corte_etl)
    SELECT id_persona,id_captacion,KeyTiempo,KeyTiempoConversion,KeySede,KeyServicio,
           KeyCanal,KeyFuente,KeyTipoPersona,KeyEstadoRegistro,contacto_registrado,
           contacto_utilizable,conversion_lead,tiempo_conversion_dia,costo_atribuido_captacion,
           fecha_captacion,fecha_conversion,id_evento_conversion,origen_datos,fecha_corte_etl
    FROM #HechoBuyer;
    COMMIT;
    SELECT @corte AS fecha_corte,COUNT(*) AS contactos,
           SUM(contacto_utilizable) AS utilizables,SUM(conversion_lead) AS conversiones,
           SUM(costo_atribuido_captacion) AS costo_atribuido
    FROM NexoSalud_Mart.dbo.fact_captacion_buyer;
    -- Gastos sin contactos NO desaparecen: se exponen para conciliacion.
    SELECT g.id_campana,g.anio_mes,g.centimos/100.0 AS gasto_no_atribuido
    FROM #GastosBuyer g LEFT JOIN #CantidadBuyer q
      ON q.id_campana=g.id_campana AND q.anio_mes=g.anio_mes
    WHERE q.cantidad IS NULL;
    DROP TABLE #HechoBuyer;
    DROP TABLE #CantidadBuyer;
    DROP TABLE #GastosBuyer;
    DROP TABLE #DatosBuyer;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK;
    THROW;
END CATCH;
GO
