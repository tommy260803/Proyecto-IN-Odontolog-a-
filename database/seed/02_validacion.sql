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
SELECT 'Canal fuera del reporte' AS validacion, id_canal, nombre
FROM Canales
WHERE nombre = 'Convenio Institucional';

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
