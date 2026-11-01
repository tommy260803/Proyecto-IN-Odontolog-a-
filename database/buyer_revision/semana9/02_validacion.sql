USE NexoSaludDB;
GO

-- Validaciones posteriores al poblamiento de NexoSaludDB.
-- Ejecutar despues de 01_catalogos.sql y del importador Python.

SET NOCOUNT ON;

SELECT 'Etapas' AS tabla, COUNT(*) AS registros FROM Etapas
UNION ALL SELECT 'Canales', COUNT(*) FROM Canales
UNION ALL SELECT 'Fuentes', COUNT(*) FROM Fuentes
UNION ALL SELECT 'Sedes', COUNT(*) FROM Sedes
UNION ALL SELECT 'Servicios', COUNT(*) FROM Servicios
UNION ALL SELECT 'Tarifas', COUNT(*) FROM Tarifas
UNION ALL SELECT 'Profesionales', COUNT(*) FROM Profesionales
UNION ALL SELECT 'Disponibilidad', COUNT(*) FROM Disponibilidad
UNION ALL SELECT 'Campanas', COUNT(*) FROM Campanas
UNION ALL SELECT 'Personas', COUNT(*) FROM Personas
UNION ALL SELECT 'Interacciones', COUNT(*) FROM Interacciones
UNION ALL SELECT 'GastosCampana', COUNT(*) FROM GastosCampana
UNION ALL SELECT 'Solicitudes', COUNT(*) FROM Solicitudes
UNION ALL SELECT 'Reservas', COUNT(*) FROM Reservas
UNION ALL SELECT 'Pagos', COUNT(*) FROM Pagos;

-- Estas consultas deben devolver cero filas.
SELECT 'Canal fuera del catalogo permitido' AS validacion, id_canal, nombre
FROM Canales
WHERE nombre NOT IN ('WhatsApp', 'Instagram', 'Facebook', 'Página Web', 'Formulario Web', 'Llamada', 'Correo Electrónico', 'WhatsApp (Link en Google Maps)');

SELECT 'Personas sin etapa' AS validacion, p.id_persona
FROM Personas p
LEFT JOIN Etapas e ON e.id_etapa = p.id_etapa_actual
WHERE e.id_etapa IS NULL;

SELECT 'Interacciones sin persona' AS validacion, i.id_interaccion
FROM Interacciones i
LEFT JOIN Personas p ON p.id_persona = i.id_persona
WHERE p.id_persona IS NULL;

SELECT 'Pagos sin reserva' AS validacion, pa.id_pago
FROM Pagos pa
LEFT JOIN Reservas r ON r.id_reserva = pa.id_reserva
WHERE r.id_reserva IS NULL;

SELECT 'Reservas sin opcion' AS validacion, r.id_reserva
FROM Reservas r
LEFT JOIN Opciones o ON o.id_opcion = r.id_opcion
WHERE o.id_opcion IS NULL;

SELECT 'Pagos por estado' AS reporte, estado, COUNT(*) AS registros
FROM Pagos
GROUP BY estado;

SELECT 'Personas por zona' AS reporte, zona, COUNT(*) AS registros
FROM Personas
WHERE zona IS NOT NULL
GROUP BY zona
ORDER BY registros DESC;

-- ================================================================
-- VALIDACIONES BUYER: ejecutar DESPUES del ETL Buyer o del poblamiento completo de esta carpeta.
-- Coincidir valida datos observados; no reconstruye calidad historica ausente.
-- ================================================================
GO
SELECT origen_datos,COUNT(*) AS captaciones
FROM NexoSaludDB.dbo.CaptacionesBuyer GROUP BY origen_datos;

-- Una fila de hecho por persona/captacion; no debe devolver filas.
SELECT id_persona,COUNT(*) AS filas
FROM NexoSalud_Mart.dbo.fact_captacion_buyer
GROUP BY id_persona HAVING COUNT(*)>1;

-- Comparar tres medidas aditivas con el origen al corte de la carga.
DECLARE @corte DATETIME2=(SELECT MAX(fecha_corte_etl)
                         FROM NexoSalud_Mart.dbo.fact_captacion_buyer);
SELECT @corte AS corte_validado;
SELECT 'TRANSACCIONAL' AS origen,
       COUNT(*) AS contacto_registrado,
       SUM(contacto_utilizable) AS contacto_utilizable,
       SUM(CASE WHEN fecha_conversion<=@corte THEN 1 ELSE 0 END) AS conversion_lead
FROM NexoSaludDB.dbo.v_DatosCaptacionBuyer WHERE fecha_captacion<=@corte
UNION ALL
SELECT 'DIMENSIONAL',SUM(contacto_registrado),SUM(contacto_utilizable),SUM(conversion_lead)
FROM NexoSalud_Mart.dbo.fact_captacion_buyer;

-- Evidencia, duracion y contexto de cada persona. Debe devolver cero filas.
SELECT COALESCE(v.id_persona,f.id_persona) AS id_persona,
       v.id_evento_conversion AS evento_origen,f.id_evento_conversion AS evento_mart
FROM NexoSaludDB.dbo.v_DatosCaptacionBuyer v
FULL JOIN NexoSalud_Mart.dbo.fact_captacion_buyer f ON f.id_persona=v.id_persona
WHERE (v.fecha_captacion<=@corte OR v.id_persona IS NULL)
  AND (v.id_persona IS NULL OR f.id_persona IS NULL
       OR v.contacto_utilizable<>f.contacto_utilizable
       OR ISNULL(CASE WHEN v.fecha_conversion<=@corte THEN v.id_evento_conversion END,-1)
            <>ISNULL(f.id_evento_conversion,-1)
       OR v.fecha_captacion<>f.fecha_captacion
       OR ISNULL(CASE WHEN v.fecha_conversion<=@corte THEN v.fecha_conversion END,'19000101')
            <>ISNULL(f.fecha_conversion,'19000101')
       OR ISNULL(CASE WHEN v.fecha_conversion<=@corte
                 THEN CAST(DATEDIFF_BIG(SECOND,v.fecha_captacion,v.fecha_conversion)/86400.0
                           AS DECIMAL(18,6)) END,-1)<>ISNULL(f.tiempo_conversion_dia,-1));

-- No descartar en silencio eventos con cronologia imposible.
SELECT e.id_evento_etapa,e.id_persona,e.fecha_hora,c.fecha_captacion
FROM NexoSaludDB.dbo.EventosEtapa e
JOIN NexoSaludDB.dbo.CaptacionesBuyer c ON c.id_persona=e.id_persona
JOIN NexoSaludDB.dbo.Etapas eo ON eo.id_etapa=e.etapa_origen AND eo.nombre='BUYER'
JOIN NexoSaludDB.dbo.Etapas ed ON ed.id_etapa=e.etapa_destino AND ed.nombre='LEAD'
WHERE e.fecha_hora<c.fecha_captacion;

-- Sede/servicio desconocidos son visibles, no se asignan a una sede real.
SELECT KeySede,KeyServicio,COUNT(*) AS contactos
FROM NexoSalud_Mart.dbo.fact_captacion_buyer
GROUP BY KeySede,KeyServicio;

-- Gasto original = atribuido + pendiente de atribucion por campana/mes.
;WITH gasto AS (
    SELECT id_campana,YEAR(fecha)*100+MONTH(fecha) AS anio_mes,SUM(importe) AS importe
    FROM NexoSaludDB.dbo.GastosCampana WHERE fecha<=CAST(@corte AS DATE)
    GROUP BY id_campana,YEAR(fecha)*100+MONTH(fecha)
), atribuido AS (
    SELECT c.id_campana,YEAR(f.fecha_captacion)*100+MONTH(f.fecha_captacion) AS anio_mes,
           SUM(f.costo_atribuido_captacion) AS importe
    FROM NexoSalud_Mart.dbo.fact_captacion_buyer f
    JOIN NexoSaludDB.dbo.CaptacionesBuyer c ON c.id_captacion=f.id_captacion
    GROUP BY c.id_campana,YEAR(f.fecha_captacion)*100+MONTH(f.fecha_captacion)
)
SELECT g.id_campana,g.anio_mes,g.importe AS gasto_original,
       COALESCE(a.importe,0) AS gasto_atribuido,
       g.importe-COALESCE(a.importe,0) AS pendiente_atribucion
FROM gasto g LEFT JOIN atribuido a
  ON a.id_campana=g.id_campana AND a.anio_mes=g.anio_mes;

-- Falta de evidencia de costo: NULL no equivale a gasto cero.
SELECT COUNT(*) AS contactos_sin_costo_verificable
FROM NexoSalud_Mart.dbo.fact_captacion_buyer WHERE costo_atribuido_captacion IS NULL;
GO

-- ================================================================
-- RECONCILIACION BASICA DE TODAS LAS FASES.
-- Despues del poblamiento completo, diferencias deben ser cero.
-- No valida por si sola todas las reglas de negocio de las otras fases.
-- ================================================================
;WITH totales AS (
    SELECT 'BUYER: contactos' AS medida,
        (SELECT COUNT_BIG(*) FROM NexoSaludDB.dbo.Personas) AS transaccional,
        (SELECT COALESCE(SUM(CAST(contacto_registrado AS BIGINT)),0)
         FROM NexoSalud_Mart.dbo.fact_captacion_buyer) AS dimensional
    UNION ALL SELECT 'LEAD: solicitudes',
        (SELECT COUNT_BIG(*) FROM NexoSaludDB.dbo.Solicitudes),
        (SELECT COALESCE(SUM(CAST(cohorte_evaluable AS BIGINT)),0)
         FROM NexoSalud_Mart.dbo.fact_negociacion_lead)
    UNION ALL SELECT 'PAYER: pagos',
        (SELECT COUNT_BIG(*) FROM NexoSaludDB.dbo.Pagos),
        (SELECT COALESCE(SUM(CAST(pago_registrado AS BIGINT)),0)
         FROM NexoSalud_Mart.dbo.fact_gestion_payer)
    UNION ALL SELECT 'PAYER: pagos validados',
        (SELECT COUNT_BIG(*) FROM NexoSaludDB.dbo.Pagos
         WHERE UPPER(estado) IN ('VALIDATED','VALIDADO','CONFIRMADO')),
        (SELECT COALESCE(SUM(CAST(pago_validado AS BIGINT)),0)
         FROM NexoSalud_Mart.dbo.fact_gestion_payer)
    UNION ALL SELECT 'CUSTOMER: citas',
        (SELECT COUNT_BIG(*) FROM NexoSaludDB.dbo.Atenciones),
        (SELECT COALESCE(SUM(CAST(cita_evaluable AS BIGINT)),0)
         FROM NexoSalud_Mart.dbo.fact_atencion_customer)
    UNION ALL SELECT 'TURNED: seguimientos',
        (SELECT COUNT_BIG(*) FROM NexoSaludDB.dbo.Seguimientos),
        (SELECT COALESCE(SUM(CAST(seguimiento_registrado AS BIGINT)),0)
         FROM NexoSalud_Mart.dbo.fact_seguimiento_turned)
)
SELECT medida,transaccional,dimensional,dimensional-transaccional AS diferencia
FROM totales;

SELECT 'TRANSACCIONAL' AS origen,COALESCE(SUM(importe),0) AS importe_validado
FROM NexoSaludDB.dbo.Pagos WHERE UPPER(estado) IN ('VALIDATED','VALIDADO','CONFIRMADO')
UNION ALL
SELECT 'DIMENSIONAL',COALESCE(SUM(importe_total_cobro),0)
FROM NexoSalud_Mart.dbo.fact_gestion_payer;
GO
