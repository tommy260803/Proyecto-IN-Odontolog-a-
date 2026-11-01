/* NexoSalud -- diagnostico BUYER, solo lectura de bases permanentes.
   Ejecutar en SSMS sobre una copia de pruebas. Requiere ambas BD en la instancia.
   Crea solo una tabla temporal de sesion. No ejecuta migraciones ni el ETL.
   Las reglas propuestas no reconstruyen calidad/autorizacion historicas ausentes.
*/
SET NOCOUNT ON;
IF DB_ID(N'NexoSaludDB') IS NULL OR DB_ID(N'NexoSalud_Mart') IS NULL
    THROW 51000, 'Se requieren NexoSaludDB y NexoSalud_Mart.', 1;
GO

USE NexoSaludDB;
GO

-- 1. Contrato fisico OLTP disponible (no presupone migracion de oportunidades).
SELECT t.name AS tabla, c.name AS columna, ty.name AS tipo,
       c.max_length, c.is_nullable
FROM sys.tables t
JOIN sys.columns c ON c.object_id=t.object_id
JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('Personas','OportunidadesCaptacion','EventosEtapa',
                 'Interacciones','Solicitudes','DecisionesIA','GastosCampana')
ORDER BY t.name,c.column_id;

-- 2. Nombres/medidas reales del Mart: main tiene DDL PascalCase y codigo snake_case.
SELECT t.name AS tabla,c.name AS columna,ty.name AS tipo
FROM NexoSalud_Mart.sys.tables t
JOIN NexoSalud_Mart.sys.columns c ON c.object_id=t.object_id
JOIN NexoSalud_Mart.sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('Fact_CaptacionBuyer','fact_captacion_buyer',
                'Fact_OportunidadCaptacion','Fact_CaptacionBuyerDetalle')
ORDER BY t.name,c.column_id;

DECLARE @corte datetime2(7)=SYSDATETIME(); -- usar el mismo reloj que las fechas OLTP
SELECT @corte AS fecha_corte_diagnostico;

-- 3. Cohorte de identidad inicial. Evento real BUYER->LEAD, nunca etapa actual.
IF OBJECT_ID('tempdb..#BuyerRevision') IS NOT NULL DROP TABLE #BuyerRevision;
SELECT p.id_persona,p.fecha_registro,p.id_campana_origen,p.id_canal_origen,
       p.id_etapa_actual,p.estado_calidad,p.autoriza_contacto,
       ev.id_evento_etapa,ev.fecha_hora AS fecha_conversion,
       sol.fecha_solicitud,
       CASE WHEN p.estado_calidad='Valido' AND p.autoriza_contacto=1
            THEN 1 ELSE 0 END AS utilizable_segun_etl,
       CASE WHEN NULLIF(LTRIM(RTRIM(p.nombres)),'') IS NOT NULL
                  AND NULLIF(LTRIM(RTRIM(p.apellidos)),'') IS NOT NULL
                  AND (NULLIF(LTRIM(RTRIM(p.numero)),'') IS NOT NULL
                       OR NULLIF(LTRIM(RTRIM(p.email)),'') IS NOT NULL)
                  AND p.estado_calidad='Valido' AND p.autoriza_contacto=1
            THEN 1 ELSE 0 END AS utilizable_basico_propuesto,
       CASE WHEN DATEADD(DAY,14,p.fecha_registro)<=@corte THEN 1 ELSE 0 END
            AS cohorte_madura_14_dia
INTO #BuyerRevision
FROM dbo.Personas p
OUTER APPLY (
    SELECT TOP (1) e.id_evento_etapa,e.fecha_hora
    FROM dbo.EventosEtapa e
    JOIN dbo.Etapas eo ON eo.id_etapa=e.etapa_origen AND eo.nombre='BUYER'
    JOIN dbo.Etapas ed ON ed.id_etapa=e.etapa_destino AND ed.nombre='LEAD'
    WHERE e.id_persona=p.id_persona AND e.fecha_hora<=@corte
    ORDER BY e.fecha_hora,e.id_evento_etapa
) ev
OUTER APPLY (
    SELECT MIN(s.fecha_solicitud) AS fecha_solicitud
    FROM dbo.Solicitudes s
    WHERE s.id_persona=p.id_persona AND s.fecha_solicitud<=@corte
) sol
WHERE p.fecha_registro<=@corte;

-- 4. Totales, sin mezclar cohorte madura e inmadura en B1.
SELECT COUNT_BIG(*) AS contactos,
       SUM(utilizable_segun_etl) AS utilizables_regla_antigua,
       SUM(utilizable_basico_propuesto) AS utilizables_basicos_propuestos,
       SUM(CASE WHEN id_evento_etapa IS NOT NULL AND fecha_conversion>=fecha_registro
                THEN 1 ELSE 0 END) AS conversiones_con_evento,
       SUM(CASE WHEN cohorte_madura_14_dia=1 AND utilizable_basico_propuesto=1
                THEN 1 ELSE 0 END) AS utilizables_cohorte_madura,
       SUM(CASE WHEN cohorte_madura_14_dia=1 AND utilizable_basico_propuesto=1
                     AND fecha_conversion>=fecha_registro
                     AND fecha_conversion<=DATEADD(DAY,14,fecha_registro)
                THEN 1 ELSE 0 END) AS conversiones_utilizables_14d_cohorte_madura,
       SUM(CASE WHEN cohorte_madura_14_dia=0 THEN 1 ELSE 0 END) AS contactos_inmaduros
FROM #BuyerRevision;

-- 5. Fechas solicitud/evento discordantes; no exporta nombres, correo o telefono.
SELECT id_persona,fecha_registro,fecha_solicitud,fecha_conversion
FROM #BuyerRevision
WHERE fecha_solicitud<>fecha_conversion
   OR (fecha_solicitud IS NULL AND fecha_conversion IS NOT NULL)
   OR (fecha_solicitud IS NOT NULL AND fecha_conversion IS NULL);

-- 6. Evento anterior a captacion: requiere investigacion, no convertirlo en cero.
SELECT id_persona,id_evento_etapa,fecha_registro,fecha_conversion
FROM #BuyerRevision WHERE fecha_conversion<fecha_registro;

-- 7. Eventos repetidos por persona; pueden ser episodios distintos, no borrarlos.
SELECT e.id_persona,COUNT_BIG(*) AS eventos_buyer_lead
FROM dbo.EventosEtapa e
JOIN dbo.Etapas eo ON eo.id_etapa=e.etapa_origen AND eo.nombre='BUYER'
JOIN dbo.Etapas ed ON ed.id_etapa=e.etapa_destino AND ed.nombre='LEAD'
GROUP BY e.id_persona HAVING COUNT_BIG(*)>1;

-- 8. Estado actual no es historia. Valores >=2 dependen del catalogo real.
SELECT id_etapa,nombre FROM dbo.Etapas ORDER BY id_etapa;
SELECT b.id_persona,e.nombre AS etapa_actual,b.id_evento_etapa
FROM #BuyerRevision b
JOIN dbo.Etapas e ON e.id_etapa=b.id_etapa_actual
WHERE e.nombre IN ('LEAD','PAYER','CUSTOMER','TURNED')
  AND b.id_evento_etapa IS NULL;

-- 9. Kardinalidad de lookups: estos resultados indican riesgo de multiplicacion.
SELECT id_campana,COUNT_BIG(*) AS coincidencias
FROM NexoSalud_Mart.dbo.Dim_Fuente WHERE id_campana>0
GROUP BY id_campana HAVING COUNT_BIG(*)>1;
SELECT id_sede,COUNT_BIG(*) AS coincidencias
FROM NexoSalud_Mart.dbo.Dim_Sede WHERE id_sede>0
GROUP BY id_sede HAVING COUNT_BIG(*)>1;
SELECT id_canal,COUNT_BIG(*) AS coincidencias
FROM NexoSalud_Mart.dbo.Dim_Canal WHERE id_canal>0
GROUP BY id_canal HAVING COUNT_BIG(*)>1;
SELECT EstadoCalidad,AutorizacionContacto,COUNT_BIG(*) AS coincidencias
FROM NexoSalud_Mart.dbo.Dim_EstadoRegistro
GROUP BY EstadoCalidad,AutorizacionContacto HAVING COUNT_BIG(*)>1;

-- 10. Fuente con multiples campanas: normal; no unir solo por id_fuente.
SELECT id_fuente,COUNT_BIG(*) AS filas_dimensionales
FROM NexoSalud_Mart.dbo.Dim_Fuente
GROUP BY id_fuente HAVING COUNT_BIG(*)>1;

-- 11. Reconciliacion financiera de origen por campana/mes.
;WITH gastos AS (
    SELECT id_campana,YEAR(fecha)*100+MONTH(fecha) AS anio_mes,
           SUM(importe) AS gasto
    FROM dbo.GastosCampana
    GROUP BY id_campana,YEAR(fecha)*100+MONTH(fecha)
), contactos AS (
    SELECT id_campana_origen,YEAR(fecha_registro)*100+MONTH(fecha_registro) AS anio_mes,
           COUNT_BIG(*) AS contactos
    FROM #BuyerRevision
    GROUP BY id_campana_origen,YEAR(fecha_registro)*100+MONTH(fecha_registro)
)
SELECT g.id_campana,g.anio_mes,g.gasto,COALESCE(c.contactos,0) AS contactos,
       CASE WHEN COALESCE(c.contactos,0)=0 THEN g.gasto ELSE 0 END
           AS gasto_sin_contactos_que_no_debe_desaparecer
FROM gastos g LEFT JOIN contactos c
    ON c.id_campana_origen=g.id_campana AND c.anio_mes=g.anio_mes;

-- 12. Resumen de captacion verificable desde el origen. No hay sede historica
-- estructurada en Personas: no inferirla del distrito ni de la primera solicitud.
SELECT YEAR(b.fecha_registro) AS anio,MONTH(b.fecha_registro) AS mes,
       COALESCE(f.nombre,'Fuente no especificada') AS fuente,
       COALESCE(c.nombre,'Canal no especificado') AS canal,
       COUNT_BIG(*) AS contacto_registrado
FROM #BuyerRevision b
LEFT JOIN dbo.Campanas ca ON ca.id_campana=b.id_campana_origen
LEFT JOIN dbo.Fuentes f ON f.id_fuente=ca.id_fuente
LEFT JOIN dbo.Canales c ON c.id_canal=b.id_canal_origen
GROUP BY YEAR(b.fecha_registro),MONTH(b.fecha_registro),f.nombre,c.nombre
ORDER BY anio,mes,fuente,canal;

-- 13. Si existe la migracion de oportunidades, auditar evidencia y asociaciones.
IF OBJECT_ID('dbo.OportunidadesCaptacion','U') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
    SELECT estado_oportunidad,COUNT_BIG(*) AS oportunidades
    FROM dbo.OportunidadesCaptacion GROUP BY estado_oportunidad;
    SELECT o.id_oportunidad,o.id_persona,o.id_solicitud,o.fecha_conversion
    FROM dbo.OportunidadesCaptacion o
    WHERE o.estado_oportunidad=''CONVERTIDO_LEAD''
      AND NOT EXISTS (
          SELECT 1 FROM dbo.EventosEtapa e
          JOIN dbo.Etapas eo ON eo.id_etapa=e.etapa_origen AND eo.nombre=''BUYER''
          JOIN dbo.Etapas ed ON ed.id_etapa=e.etapa_destino AND ed.nombre=''LEAD''
          WHERE e.id_persona=o.id_persona
      );
    SELECT o.id_oportunidad,o.id_persona,s.id_persona AS persona_solicitud
    FROM dbo.OportunidadesCaptacion o JOIN dbo.Solicitudes s
      ON s.id_solicitud=o.id_solicitud
    WHERE s.id_persona<>o.id_persona;
    SELECT o.id_oportunidad,o.id_fuente,c.id_fuente AS fuente_campana
    FROM dbo.OportunidadesCaptacion o JOIN dbo.Campanas c
      ON c.id_campana=o.id_campana
    WHERE o.id_fuente IS NOT NULL AND o.id_fuente<>c.id_fuente;';
END;

DROP TABLE #BuyerRevision;
