-- Genera 1,200 espacios de atencion para soportar el poblamiento masivo.
-- Contexto: sedes y profesionales de Trujillo, La Libertad, Peru.
-- Idempotente por profesional, sede, fecha y hora de inicio.

SET NOCOUNT ON;

;WITH Numeros AS (
    SELECT TOP (1200)
        ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS numero
    FROM sys.all_objects a
    CROSS JOIN sys.all_objects b
), ProfesionalesOrdenados AS (
    SELECT id_profesional, ROW_NUMBER() OVER (ORDER BY id_profesional) AS orden
    FROM Profesionales
    WHERE activo = 1
), SedesOrdenadas AS (
    SELECT id_sede, ROW_NUMBER() OVER (ORDER BY id_sede) AS orden
    FROM Sedes
    WHERE activo = 1
), Slots AS (
    SELECT
        n.numero,
        p.id_profesional,
        s.id_sede,
        CONVERT(date, DATEADD(day, (n.numero - 1) % 180, CONVERT(date, '2026-10-01'))) AS fecha,
        CONVERT(time, DATEADD(hour, 8 + ((n.numero - 1) % 10), CONVERT(datetime, '1900-01-01'))) AS hora_inicio,
        CONVERT(time, DATEADD(hour, 9 + ((n.numero - 1) % 10), CONVERT(datetime, '1900-01-01'))) AS hora_fin
    FROM Numeros n
    JOIN ProfesionalesOrdenados p ON p.orden = ((n.numero - 1) % (SELECT COUNT(*) FROM ProfesionalesOrdenados)) + 1
    JOIN SedesOrdenadas s ON s.orden = ((n.numero - 1) % (SELECT COUNT(*) FROM SedesOrdenadas)) + 1
)
INSERT INTO Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
SELECT id_profesional, id_sede, fecha, hora_inicio, hora_fin, 'Disponible'
FROM Slots
WHERE NOT EXISTS (
    SELECT 1
    FROM Disponibilidad d
    WHERE d.id_profesional = Slots.id_profesional
      AND d.id_sede = Slots.id_sede
      AND d.fecha = Slots.fecha
      AND d.hora_inicio = Slots.hora_inicio
);

SELECT 'Disponibilidades disponibles' AS reporte, COUNT(*) AS registros
FROM Disponibilidad
WHERE estado = 'Disponible';
