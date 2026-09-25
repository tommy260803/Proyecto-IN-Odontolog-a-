-- Catalogos iniciales para NexoSaludDB.
-- Contexto geografico: Trujillo, La Libertad, Peru.
-- Script idempotente: puede ejecutarse mas de una vez.

SET NOCOUNT ON;

-- Etapas del flujo comercial
INSERT INTO Etapas (nombre, descripcion)
SELECT v.nombre, v.descripcion
FROM (VALUES
    ('LEAD', 'Persona interesada pendiente de gestion'),
    ('BUYER', 'Persona con solicitud y propuesta activa'),
    ('PAYER', 'Persona con pago registrado'),
    ('CUSTOMER', 'Persona con atencion programada o realizada'),
    ('TURNED', 'Atencion finalizada y seguimiento postventa')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM Etapas e WHERE e.nombre = v.nombre);

-- Canales y fuentes de captacion
INSERT INTO Canales (nombre)
SELECT v.nombre
FROM (VALUES
    ('WhatsApp'),
    ('Instagram'),
    ('Facebook'),
    ('Página Web')
) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM Canales c WHERE c.nombre = v.nombre);

-- Normaliza datos de ejecuciones anteriores al catalogo del reporte.
DECLARE @canalWhatsApp INT = (SELECT id_canal FROM Canales WHERE nombre = 'WhatsApp');
DECLARE @canalConvenio INT = (SELECT id_canal FROM Canales WHERE nombre = 'Convenio Institucional');
IF @canalConvenio IS NOT NULL
BEGIN
    UPDATE Personas SET id_canal_origen = @canalWhatsApp WHERE id_canal_origen = @canalConvenio;
    UPDATE Interacciones SET id_canal = @canalWhatsApp WHERE id_canal = @canalConvenio;
    UPDATE PersonaPreferencias SET id_canal = @canalWhatsApp WHERE id_canal = @canalConvenio;
    UPDATE Campanas SET id_canal = @canalWhatsApp WHERE id_canal = @canalConvenio;
    DELETE FROM Canales WHERE id_canal = @canalConvenio;
END;

INSERT INTO Fuentes (nombre, descripcion)
SELECT v.nombre, v.descripcion
FROM (VALUES
    ('Busqueda Organica', 'Busqueda local de servicios odontologicos en Trujillo'),
    ('Redes Sociales', 'Campanas y contactos provenientes de Meta')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM Fuentes f WHERE f.nombre = v.nombre);

-- Seguridad y modalidades
INSERT INTO Roles (nombre)
SELECT v.nombre
FROM (VALUES ('Administrador'), ('Marketing'), ('Negociador'), ('Cobranza'), ('Soporte'), ('PostVenta')) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM Roles r WHERE r.nombre = v.nombre);

INSERT INTO Modalidades (nombre)
SELECT v.nombre
FROM (VALUES ('Presencial'), ('Virtual')) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM Modalidades m WHERE m.nombre = v.nombre);

INSERT INTO Horarios (dia_semana, hora_inicio, hora_fin)
SELECT v.dia_semana, CAST(v.hora_inicio AS time), CAST(v.hora_fin AS time)
FROM (VALUES
    (1, '08:00:00', '12:00:00'),
    (2, '14:00:00', '18:00:00'),
    (3, '08:00:00', '12:00:00'),
    (4, '14:00:00', '18:00:00'),
    (5, '08:00:00', '12:00:00'),
    (6, '09:00:00', '13:00:00')
) AS v(dia_semana, hora_inicio, hora_fin)
WHERE NOT EXISTS (
    SELECT 1
    FROM Horarios h
    WHERE h.dia_semana = v.dia_semana
      AND h.hora_inicio = CAST(v.hora_inicio AS time)
      AND h.hora_fin = CAST(v.hora_fin AS time)
);

-- Cuenta tecnica para operaciones automaticas
DECLARE @rolAdmin INT = (SELECT id_rol FROM Roles WHERE nombre = 'Administrador');
IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE email = 'admin@odontologia-trujillo.pe')
BEGIN
    INSERT INTO Usuarios (nombres, apellidos, email, password_hash, id_rol)
    VALUES ('Ana', 'Ramos', 'admin@odontologia-trujillo.pe', 'REEMPLAZAR_HASH_EN_ENTORNO_REAL', @rolAdmin);
END;

-- Sedes reales de referencia dentro del entorno de Trujillo
INSERT INTO Sedes (nombre, direccion, zona)
SELECT v.nombre, v.direccion, v.zona
FROM (VALUES
    ('Sede Centro Historico', 'Jr. Independencia 450, Trujillo', 'Centro Historico'),
    ('Sede California', 'Av. Fátima 125, Victor Larco Herrera, Trujillo', 'Victor Larco Herrera'),
    ('Sede El Golf', 'Av. El Golf 680, Victor Larco Herrera, Trujillo', 'El Golf')
) AS v(nombre, direccion, zona)
WHERE NOT EXISTS (SELECT 1 FROM Sedes s WHERE s.nombre = v.nombre);

-- Servicios y tarifas de demostracion en soles
INSERT INTO Servicios (nombre, descripcion)
SELECT v.nombre, v.descripcion
FROM (VALUES
    ('Evaluacion odontologica', 'Evaluacion clinica inicial'),
    ('Limpieza dental', 'Profilaxis y limpieza dental'),
    ('Restauracion dental', 'Restauracion de piezas dentales'),
    ('Ortodoncia', 'Evaluacion y tratamiento de ortodoncia'),
    ('Blanqueamiento dental', 'Blanqueamiento dental profesional'),
    ('Control odontologico', 'Control y seguimiento de tratamiento')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM Servicios s WHERE s.nombre = v.nombre);

INSERT INTO Tarifas (id_servicio, precio, fecha_inicio, activo)
SELECT s.id_servicio, v.precio, CONVERT(datetime2, '2026-09-01T00:00:00'), 1
FROM (VALUES
    ('Evaluacion odontologica', 60.00),
    ('Limpieza dental', 100.00),
    ('Restauracion dental', 180.00),
    ('Ortodoncia', 150.00),
    ('Blanqueamiento dental', 350.00),
    ('Control odontologico', 50.00)
) AS v(nombre, precio)
JOIN Servicios s ON s.nombre = v.nombre
WHERE NOT EXISTS (
    SELECT 1 FROM Tarifas t
    WHERE t.id_servicio = s.id_servicio
      AND t.fecha_inicio = CONVERT(datetime2, '2026-09-01T00:00:00')
);

-- Profesionales y servicios que atienden
INSERT INTO Profesionales (nombres, apellidos, numero_colegiatura, especialidad)
SELECT v.nombres, v.apellidos, v.colegiatura, v.especialidad
FROM (VALUES
    ('Valeria', 'Mendoza', 'COP-TRU-1001', 'Odontologia General'),
    ('Diego', 'Salazar', 'COP-TRU-1002', 'Ortodoncia'),
    ('Lucia', 'Vasquez', 'COP-TRU-1003', 'Rehabilitacion Oral')
) AS v(nombres, apellidos, colegiatura, especialidad)
WHERE NOT EXISTS (
    SELECT 1 FROM Profesionales p
    WHERE p.nombres = v.nombres AND p.apellidos = v.apellidos
);

INSERT INTO ProfesionalServicio (id_profesional, id_servicio)
SELECT p.id_profesional, s.id_servicio
FROM (VALUES
    ('Valeria', 'Mendoza', 'Evaluacion odontologica'),
    ('Valeria', 'Mendoza', 'Limpieza dental'),
    ('Valeria', 'Mendoza', 'Restauracion dental'),
    ('Diego', 'Salazar', 'Evaluacion odontologica'),
    ('Diego', 'Salazar', 'Ortodoncia'),
    ('Lucia', 'Vasquez', 'Evaluacion odontologica'),
    ('Lucia', 'Vasquez', 'Blanqueamiento dental'),
    ('Lucia', 'Vasquez', 'Control odontologico')
) AS v(nombres, apellidos, servicio)
JOIN Profesionales p ON p.nombres = v.nombres AND p.apellidos = v.apellidos
JOIN Servicios s ON s.nombre = v.servicio
WHERE NOT EXISTS (
    SELECT 1 FROM ProfesionalServicio ps
    WHERE ps.id_profesional = p.id_profesional AND ps.id_servicio = s.id_servicio
);

-- Disponibilidades necesarias para solicitudes, reservas y pagos de ejemplo
DECLARE @sedeCentro INT = (SELECT id_sede FROM Sedes WHERE nombre = 'Sede Centro Historico');
DECLARE @sedeCalifornia INT = (SELECT id_sede FROM Sedes WHERE nombre = 'Sede California');
DECLARE @sedeGolf INT = (SELECT id_sede FROM Sedes WHERE nombre = 'Sede El Golf');
DECLARE @profValeria INT = (SELECT id_profesional FROM Profesionales WHERE nombres = 'Valeria' AND apellidos = 'Mendoza');
DECLARE @profDiego INT = (SELECT id_profesional FROM Profesionales WHERE nombres = 'Diego' AND apellidos = 'Salazar');
DECLARE @profLucia INT = (SELECT id_profesional FROM Profesionales WHERE nombres = 'Lucia' AND apellidos = 'Vasquez');

INSERT INTO Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
SELECT v.id_profesional, v.id_sede, CONVERT(date, v.fecha), CAST(v.hora_inicio AS time), CAST(v.hora_fin AS time), 'Disponible'
FROM (VALUES
    (@profValeria, @sedeCentro, '2026-09-15', '09:00:00', '10:00:00'),
    (@profValeria, @sedeCalifornia, '2026-09-16', '14:00:00', '15:00:00'),
    (@profDiego, @sedeGolf, '2026-09-17', '10:00:00', '11:00:00'),
    (@profDiego, @sedeCentro, '2026-09-18', '15:00:00', '16:00:00'),
    (@profLucia, @sedeCalifornia, '2026-09-19', '09:00:00', '10:00:00')
) AS v(id_profesional, id_sede, fecha, hora_inicio, hora_fin)
WHERE NOT EXISTS (
    SELECT 1 FROM Disponibilidad d
    WHERE d.id_profesional = v.id_profesional
      AND d.id_sede = v.id_sede
      AND d.fecha = CONVERT(date, v.fecha)
      AND d.hora_inicio = CAST(v.hora_inicio AS time)
);

-- Campanas que seran referenciadas por los archivos externos
DECLARE @fuenteRedes INT = (SELECT id_fuente FROM Fuentes WHERE nombre = 'Redes Sociales');
DECLARE @fuenteOrganica INT = (SELECT id_fuente FROM Fuentes WHERE nombre = 'Busqueda Organica');
DECLARE @canalInstagram INT = (SELECT id_canal FROM Canales WHERE nombre = 'Instagram');
DECLARE @canalWeb INT = (SELECT id_canal FROM Canales WHERE nombre = 'Página Web');

INSERT INTO Campanas (nombre, descripcion, id_fuente, id_canal, fecha_inicio, fecha_fin)
SELECT v.nombre, v.descripcion, v.id_fuente, v.id_canal, CONVERT(date, '2026-09-01'), CONVERT(date, '2026-09-30')
FROM (VALUES
    ('Sonrie Trujillo Septiembre', 'Captacion local para evaluacion inicial', @fuenteRedes, @canalInstagram),
    ('Evaluacion Dental Trujillo', 'Campana de busqueda local', @fuenteOrganica, @canalWeb)
) AS v(nombre, descripcion, id_fuente, id_canal)
WHERE NOT EXISTS (SELECT 1 FROM Campanas c WHERE c.nombre = v.nombre);

PRINT 'Catalogos de Trujillo cargados correctamente.';
