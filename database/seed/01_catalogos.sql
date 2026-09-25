-- =================================================================================
-- CATÁLOGOS BASE Y POBLAMIENTO TRANSACCIONAL PARA NEXOSALUDDB (Trujillo, Perú)
-- Fusión completa del ecosistema transaccional y dimensiones analíticas
-- =================================================================================

USE NexoSaludDB;
GO

SET NOCOUNT ON;

-- 1. Etapas del flujo comercial
INSERT INTO Etapas (nombre, descripcion)
SELECT v.nombre, v.descripcion
FROM (VALUES
    ('BUYER', 'Persona interesada y consentimiento inicial'),
    ('LEAD', 'Persona interesada en negociación activa'),
    ('PAYER', 'Persona con pago registrado y validado'),
    ('CUSTOMER', 'Persona con atención odontológica programada o realizada'),
    ('TURNED', 'Atención finalizada y seguimiento postventa')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM Etapas e WHERE e.nombre = v.nombre);

-- 2. Canales de comunicación
INSERT INTO Canales (nombre, activo)
SELECT v.nombre, 1
FROM (VALUES
    ('WhatsApp'),
    ('Instagram'),
    ('Facebook'),
    ('Página Web'),
    ('WhatsApp (Link en Google Maps)')
) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM Canales c WHERE c.nombre = v.nombre);

-- 3. Fuentes de atracción
INSERT INTO Fuentes (nombre, descripcion, activo)
SELECT v.nombre, v.descripcion, 1
FROM (VALUES
    ('Redes Sociales (Pauta / Meta Ads)', 'Campañas de adquisición pagada en Meta Ads'),
    ('Búsqueda Orgánica (SEO / Maps)', 'Búsqueda orgánica local y perfil Google Maps Trujillo')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM Fuentes f WHERE f.nombre = v.nombre);

-- 4. Campañas (asocian Fuente y Canal)
DECLARE @fMeta INT = (SELECT id_fuente FROM Fuentes WHERE nombre = 'Redes Sociales (Pauta / Meta Ads)');
DECLARE @fOrg INT = (SELECT id_fuente FROM Fuentes WHERE nombre = 'Búsqueda Orgánica (SEO / Maps)');

DECLARE @cWsp INT = (SELECT id_canal FROM Canales WHERE nombre = 'WhatsApp');
DECLARE @cIg INT = (SELECT id_canal FROM Canales WHERE nombre = 'Instagram');
DECLARE @cFb INT = (SELECT id_canal FROM Canales WHERE nombre = 'Facebook');
DECLARE @cWeb INT = (SELECT id_canal FROM Canales WHERE nombre = 'Página Web');
DECLARE @cMaps INT = (SELECT id_canal FROM Canales WHERE nombre = 'WhatsApp (Link en Google Maps)');

INSERT INTO Campanas (nombre, descripcion, id_fuente, id_canal, fecha_inicio, fecha_fin, activo)
SELECT v.nombre, v.descripcion, v.id_fuente, v.id_canal, '2026-09-01', '2026-09-30', 1
FROM (VALUES
    ('Meta Ads - WhatsApp Campaña Primavera', 'Captación pagada por WhatsApp Ads', @fMeta, @cWsp),
    ('Meta Ads - Instagram Campaña Primavera', 'Captación pagada por Instagram Ads', @fMeta, @cIg),
    ('Meta Ads - Facebook Campaña Primavera', 'Captación pagada por Facebook Ads', @fMeta, @cFb),
    ('SEO Orgánico - Página Web NexoSalud', 'Tráfico orgánico SEO portal Trujillo', @fOrg, @cWeb),
    ('Google Maps Ficha Local - WhatsApp Trujillo', 'Ficha local Google Maps con botón WhatsApp', @fOrg, @cMaps)
) AS v(nombre, descripcion, id_fuente, id_canal)
WHERE NOT EXISTS (SELECT 1 FROM Campanas c WHERE c.nombre = v.nombre);

-- 5. Roles y Modalidades
INSERT INTO Roles (nombre)
SELECT v.nombre
FROM (VALUES ('Administrador'), ('Marketing'), ('Negociador'), ('Cobranza'), ('Soporte'), ('PostVenta')) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM Roles r WHERE r.nombre = v.nombre);

INSERT INTO Modalidades (nombre)
SELECT v.nombre
FROM (VALUES ('Presencial'), ('Virtual')) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM Modalidades m WHERE m.nombre = v.nombre);

-- 6. Horarios
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
    SELECT 1 FROM Horarios h
    WHERE h.dia_semana = v.dia_semana AND h.hora_inicio = CAST(v.hora_inicio AS time) AND h.hora_fin = CAST(v.hora_fin AS time)
);

-- 7. Sedes en Trujillo
INSERT INTO Sedes (nombre, direccion, zona, activo)
SELECT v.nombre, v.direccion, v.zona, 1
FROM (VALUES
    ('Sede Centro Historico', 'Jr. Independencia 450, Centro Historico, Trujillo', 'Centro Historico'),
    ('Sede California', 'Av. Fátima 125, Victor Larco Herrera, Trujillo', 'Victor Larco Herrera'),
    ('Sede El Golf', 'Av. El Golf 680, Victor Larco Herrera, Trujillo', 'El Golf')
) AS v(nombre, direccion, zona)
WHERE NOT EXISTS (SELECT 1 FROM Sedes s WHERE s.nombre = v.nombre);

-- 8. Negociadores y Usuarios
DECLARE @rolAdmin INT = (SELECT id_rol FROM Roles WHERE nombre = 'Administrador');
DECLARE @rolNegoc INT = (SELECT id_rol FROM Roles WHERE nombre = 'Negociador');

INSERT INTO Usuarios (nombres, apellidos, email, password_hash, id_rol, activo)
SELECT v.nombres, v.apellidos, v.email, 'HASH_PASSWORD_DEFAULT', v.id_rol, 1
FROM (VALUES
    ('Ana', 'Ramos (Operador 01)', 'ana.ramos@odontologia-trujillo.pe', @rolAdmin),
    ('Carlos', 'Benites (Operador 02)', 'carlos.benites@odontologia-trujillo.pe', @rolNegoc),
    ('María', 'Fernández (Operador 03)', 'maria.fernandez@odontologia-trujillo.pe', @rolNegoc),
    ('Jorge', 'Díaz (Operador 04)', 'jorge.diaz@odontologia-trujillo.pe', @rolNegoc)
) AS v(nombres, apellidos, email, id_rol)
WHERE NOT EXISTS (SELECT 1 FROM Usuarios u WHERE u.email = v.email);

-- 9. Servicios Odontológicos y Tarifas
INSERT INTO Servicios (nombre, descripcion, activo)
SELECT v.nombre, v.descripcion, 1
FROM (VALUES
    ('Evaluación General', 'Odontología Preventiva - Evaluación diagnóstica integral y odontograma'),
    ('Limpieza / Profilaxis', 'Odontología Preventiva - Profilaxis ultrasónica y destartraje'),
    ('Ortodoncia Inicial', 'Odontología Especializada - Brackets y estudio ortodóntico inicial'),
    ('Implante Dental', 'Odontología Especializada - Implantes dentales de titanio y rehabilitación'),
    ('Restauración Estética', 'Odontología Restauradora - Resinas compuestas estéticas'),
    ('Blanqueamiento Dental', 'Odontología Estética - Aclaramiento dental LED en consultorio')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM Servicios s WHERE s.nombre = v.nombre);

INSERT INTO Tarifas (id_servicio, precio, fecha_inicio, activo)
SELECT s.id_servicio, v.precio, '2026-09-01', 1
FROM (VALUES
    ('Evaluación General', 60.00),
    ('Limpieza / Profilaxis', 100.00),
    ('Ortodoncia Inicial', 150.00),
    ('Implante Dental', 1800.00),
    ('Restauración Estética', 180.00),
    ('Blanqueamiento Dental', 350.00)
) AS v(nombre, precio)
JOIN Servicios s ON s.nombre = v.nombre
WHERE NOT EXISTS (
    SELECT 1 FROM Tarifas t WHERE t.id_servicio = s.id_servicio AND t.fecha_inicio = '2026-09-01'
);

-- 10. Profesionales Odontólogos
INSERT INTO Profesionales (nombres, apellidos, numero_colegiatura, especialidad, activo)
SELECT v.nombres, v.apellidos, v.colegiatura, v.especialidad, 1
FROM (VALUES
    ('Valeria', 'Mendoza', 'COP-TRU-1001', 'Odontología Preventiva y General'),
    ('Diego', 'Salazar', 'COP-TRU-1002', 'Ortodoncia y Ortopedia Maxilar'),
    ('Lucía', 'Vásquez', 'COP-TRU-1003', 'Rehabilitación Oral e Implantes'),
    ('Renzo', 'Alva', 'COP-TRU-1004', 'Periodoncia y Cirugía Oral')
) AS v(nombres, apellidos, colegiatura, especialidad)
WHERE NOT EXISTS (
    SELECT 1 FROM Profesionales p WHERE p.nombres = v.nombres AND p.apellidos = v.apellidos
);

-- 11. Disponibilidad de referencia en Trujillo
DECLARE @sedeCentro INT = (SELECT id_sede FROM Sedes WHERE nombre = 'Sede Centro Historico');
DECLARE @sedeCalifornia INT = (SELECT id_sede FROM Sedes WHERE nombre = 'Sede California');
DECLARE @profValeria INT = (SELECT id_profesional FROM Profesionales WHERE nombres = 'Valeria');
DECLARE @profDiego INT = (SELECT id_profesional FROM Profesionales WHERE nombres = 'Diego');

INSERT INTO Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
SELECT v.id_prof, v.id_sede, '2026-09-15', CAST(v.h_ini AS time), CAST(v.h_fin AS time), 'Disponible'
FROM (VALUES
    (@profValeria, @sedeCentro, '09:00:00', '13:00:00'),
    (@profDiego, @sedeCalifornia, '14:00:00', '18:00:00')
) AS v(id_prof, id_sede, h_ini, h_fin)
WHERE NOT EXISTS (
    SELECT 1 FROM Disponibilidad d WHERE d.id_profesional = v.id_prof AND d.id_sede = v.id_sede AND d.fecha = '2026-09-15'
);

PRINT 'Catálogos base cargados exitosamente.';
GO

-- =================================================================================
-- SCRIPT DE POBLAMIENTO TRANSACCIONAL MASIVO DEL FUNNEL
-- Genera el flujo integral: 805 BUYER > 310 LEAD > 125 PAYER > 219 CUSTOMER > 80 TURNED
-- =================================================================================

SET NOCOUNT ON;

DECLARE @idBuyer INT = 1, @idLead INT = 2, @idPayer INT = 3, @idCustomer INT = 4, @idTurned INT = 5;

DECLARE @cWspMeta INT = (SELECT id_campana FROM Campanas WHERE nombre = 'Meta Ads - WhatsApp Campaña Primavera');
DECLARE @cIgMeta INT = (SELECT id_campana FROM Campanas WHERE nombre = 'Meta Ads - Instagram Campaña Primavera');
DECLARE @cFbMeta INT = (SELECT id_campana FROM Campanas WHERE nombre = 'Meta Ads - Facebook Campaña Primavera');
DECLARE @cWebSeo INT = (SELECT id_campana FROM Campanas WHERE nombre = 'SEO Orgánico - Página Web NexoSalud');
DECLARE @cWspMaps INT = (SELECT id_campana FROM Campanas WHERE nombre = 'Google Maps Ficha Local - WhatsApp Trujillo');

DECLARE @canalWsp INT = (SELECT id_canal FROM Canales WHERE nombre = 'WhatsApp');
DECLARE @canalIg INT = (SELECT id_canal FROM Canales WHERE nombre = 'Instagram');
DECLARE @canalFb INT = (SELECT id_canal FROM Canales WHERE nombre = 'Facebook');
DECLARE @canalWeb INT = (SELECT id_canal FROM Canales WHERE nombre = 'Página Web');
DECLARE @canalWspMaps INT = (SELECT id_canal FROM Canales WHERE nombre = 'WhatsApp (Link en Google Maps)');

DECLARE @uOp01 INT = (SELECT id_usuario FROM Usuarios WHERE email = 'ana.ramos@odontologia-trujillo.pe');
DECLARE @uOp02 INT = (SELECT id_usuario FROM Usuarios WHERE email = 'carlos.benites@odontologia-trujillo.pe');
DECLARE @uOp03 INT = (SELECT id_usuario FROM Usuarios WHERE email = 'maria.fernandez@odontologia-trujillo.pe');
DECLARE @uOp04 INT = (SELECT id_usuario FROM Usuarios WHERE email = 'jorge.diaz@odontologia-trujillo.pe');

DECLARE @sCentro INT = (SELECT id_sede FROM Sedes WHERE nombre = 'Sede Centro Historico');
DECLARE @sCalif INT = (SELECT id_sede FROM Sedes WHERE nombre = 'Sede California');

DECLARE @dispCentro INT = (SELECT TOP 1 id_disponibilidad FROM Disponibilidad WHERE id_sede = @sCentro);
DECLARE @dispCalif INT = (SELECT TOP 1 id_disponibilidad FROM Disponibilidad WHERE id_sede = @sCalif);

DECLARE @servEval INT = (SELECT id_servicio FROM Servicios WHERE nombre = 'Evaluación General');
DECLARE @servLimp INT = (SELECT id_servicio FROM Servicios WHERE nombre = 'Limpieza / Profilaxis');
DECLARE @servOrto INT = (SELECT id_servicio FROM Servicios WHERE nombre = 'Ortodoncia Inicial');
DECLARE @servImpl INT = (SELECT id_servicio FROM Servicios WHERE nombre = 'Implante Dental');

DECLARE @profValeria INT = (SELECT id_profesional FROM Profesionales WHERE nombres = 'Valeria');
DECLARE @profDiego INT = (SELECT id_profesional FROM Profesionales WHERE nombres = 'Diego');
DECLARE @profLucia INT = (SELECT id_profesional FROM Profesionales WHERE nombres = 'Lucía');

-- Tabla de nombres y apellidos de Trujillo
DECLARE @nombres TABLE (id INT IDENTITY(1,1), nom VARCHAR(50));
INSERT INTO @nombres (nom) VALUES 
  ('Carlos'), ('María'), ('José'), ('Lucía'), ('Jorge'), ('Ana'), ('Luis'), ('Rosa'), 
  ('Miguel'), ('Patricia'), ('Fernando'), ('Carmen'), ('David'), ('Elena'), ('Pedro'), 
  ('Diana'), ('Manuel'), ('Claudia'), ('César'), ('Sofía'), ('Alejandro'), ('Fiorella'), 
  ('Víctor'), ('Andrea'), ('Gabriel'), ('Valeria'), ('Daniel'), ('Camila'), ('Roberto'), 
  ('Milagros'), ('Gonzalo'), ('Renata'), ('Christian'), ('Paola'), ('Javier'), ('Adriana'), 
  ('Ricardo'), ('Silvia'), ('Eduardo'), ('Gabriela');

DECLARE @apellidos TABLE (id INT IDENTITY(1,1), ape VARCHAR(50));
INSERT INTO @apellidos (ape) VALUES 
  ('Rodríguez'), ('García'), ('Flores'), ('Benites'), ('Chigne'), ('Zavaleta'), ('Terrones'), 
  ('Alayo'), ('Mendoza'), ('Salazar'), ('Vásquez'), ('Cruz'), ('Paredes'), ('Ramos'), 
  ('Gutiérrez'), ('Chávez'), ('Castillo'), ('Díaz'), ('Torres'), ('Espinoza'), ('Reyes'), 
  ('Acosta'), ('López'), ('Morales'), ('Villanueva'), ('Bocanegra'), ('Aguilar'), ('Bazán');

DECLARE @zonas TABLE (id INT IDENTITY(1,1), zona VARCHAR(50));
INSERT INTO @zonas (zona) VALUES 
  ('Centro Histórico'), ('California'), ('El Golf'), ('Víctor Larco Herrera'), 
  ('La Esperanza'), ('Huanchaco'), ('Florencia de Mora'), ('Moche'), ('San Andrés'), ('El Recreo');

-- =========================================================================
-- FASE 1: BUYER (805 Personas con estados de calidad exactos)
-- =========================================================================
DECLARE @g INT = 1;
DECLARE @countVal INT, @countInc INT, @countDup INT, @countRech INT, @idCamp INT, @idCanal INT;
DECLARE @j INT;
DECLARE @nom VARCHAR(50), @ape VARCHAR(50), @zn VARCHAR(50), @tel VARCHAR(20), @dni CHAR(8);
DECLARE @fechaReg DATETIME2, @idPersona INT;
DECLARE @totalPersonas INT = 0;

WHILE @g <= 5
BEGIN
  IF @g = 1 BEGIN SET @countVal=250; SET @countInc=25; SET @countDup=15; SET @countRech=10; SET @idCamp=@cWspMeta; SET @idCanal=@canalWsp; END
  IF @g = 2 BEGIN SET @countVal=140; SET @countInc=18; SET @countDup=12; SET @countRech=5;  SET @idCamp=@cIgMeta;  SET @idCanal=@canalIg;  END
  IF @g = 3 BEGIN SET @countVal=90;  SET @countInc=12; SET @countDup=8;  SET @countRech=5;  SET @idCamp=@cFbMeta;  SET @idCanal=@canalFb;  END
  IF @g = 4 BEGIN SET @countVal=85;  SET @countInc=5;  SET @countDup=0;  SET @countRech=0;  SET @idCamp=@cWebSeo;  SET @idCanal=@canalWeb; END
  IF @g = 5 BEGIN SET @countVal=115; SET @countInc=8;  SET @countDup=2;  SET @countRech=0;  SET @idCamp=@cWspMaps; SET @idCanal=@canalWspMaps; END

  -- Insertar Válidos
  SET @j = 1;
  WHILE @j <= @countVal
  BEGIN
    SET @totalPersonas = @totalPersonas + 1;
    SET @nom = (SELECT nom FROM @nombres WHERE id = ((@totalPersonas % 40) + 1));
    SET @ape = (SELECT ape FROM @apellidos WHERE id = ((@totalPersonas % 28) + 1));
    SET @zn = (SELECT zona FROM @zonas WHERE id = ((@totalPersonas % 10) + 1));
    SET @tel = '9' + CAST(10000000 + @totalPersonas AS VARCHAR);
    SET @dni = CAST(40000000 + @totalPersonas AS CHAR(8));
    SET @fechaReg = DATEADD(MINUTE, (@totalPersonas * 17) % 1440, DATEADD(DAY, (@totalPersonas % 28), '2026-09-01 08:00:00'));

    INSERT INTO Personas (nombres, apellidos, dni, email, numero, zona, tipo_persona, autoriza_contacto, fecha_autorizacion, estado_calidad, id_campana_origen, id_canal_origen, id_etapa_actual, fecha_registro)
    VALUES (@nom, @ape, @dni, LOWER(@nom + '.' + @ape + CAST(@totalPersonas AS VARCHAR) + '@gmail.com'), @tel, @zn, 'Adulto General', 1, @fechaReg, 'Valido', @idCamp, @idCanal, @idBuyer, @fechaReg);
    SET @idPersona = SCOPE_IDENTITY();

    INSERT INTO EventosEtapa (id_persona, etapa_destino, fecha_hora, motivo)
    VALUES (@idPersona, @idBuyer, @fechaReg, 'Ingreso inicial por campaña');

    SET @j = @j + 1;
  END

  -- Insertar Incompletos
  SET @j = 1;
  WHILE @j <= @countInc
  BEGIN
    SET @totalPersonas = @totalPersonas + 1;
    SET @nom = (SELECT nom FROM @nombres WHERE id = ((@totalPersonas % 40) + 1));
    SET @ape = (SELECT ape FROM @apellidos WHERE id = ((@totalPersonas % 28) + 1));
    SET @zn = (SELECT zona FROM @zonas WHERE id = ((@totalPersonas % 10) + 1));
    SET @tel = '9' + CAST(10000000 + @totalPersonas AS VARCHAR);
    SET @fechaReg = DATEADD(MINUTE, (@totalPersonas * 23) % 1440, DATEADD(DAY, (@totalPersonas % 28), '2026-09-01 08:00:00'));

    INSERT INTO Personas (nombres, apellidos, dni, email, numero, zona, tipo_persona, autoriza_contacto, fecha_autorizacion, estado_calidad, id_campana_origen, id_canal_origen, id_etapa_actual, fecha_registro)
    VALUES (@nom, @ape, NULL, NULL, @tel, @zn, 'Adulto General', 0, NULL, 'Incompleto', @idCamp, @idCanal, @idBuyer, @fechaReg);
    SET @idPersona = SCOPE_IDENTITY();

    INSERT INTO EventosEtapa (id_persona, etapa_destino, fecha_hora, motivo)
    VALUES (@idPersona, @idBuyer, @fechaReg, 'Registro incompleto');

    SET @j = @j + 1;
  END

  -- Insertar Duplicados
  SET @j = 1;
  WHILE @j <= @countDup
  BEGIN
    SET @totalPersonas = @totalPersonas + 1;
    SET @nom = (SELECT nom FROM @nombres WHERE id = ((@totalPersonas % 40) + 1));
    SET @ape = (SELECT ape FROM @apellidos WHERE id = ((@totalPersonas % 28) + 1));
    SET @zn = (SELECT zona FROM @zonas WHERE id = ((@totalPersonas % 10) + 1));
    SET @tel = '9' + CAST(10000000 + @totalPersonas AS VARCHAR);
    SET @fechaReg = DATEADD(MINUTE, (@totalPersonas * 31) % 1440, DATEADD(DAY, (@totalPersonas % 28), '2026-09-01 08:00:00'));

    INSERT INTO Personas (nombres, apellidos, dni, email, numero, zona, tipo_persona, autoriza_contacto, fecha_autorizacion, estado_calidad, id_campana_origen, id_canal_origen, id_etapa_actual, fecha_registro)
    VALUES (@nom, @ape, NULL, NULL, @tel, @zn, 'Adulto General', 0, NULL, 'Duplicado', @idCamp, @idCanal, @idBuyer, @fechaReg);
    SET @idPersona = SCOPE_IDENTITY();

    INSERT INTO EventosEtapa (id_persona, etapa_destino, fecha_hora, motivo)
    VALUES (@idPersona, @idBuyer, @fechaReg, 'Registro duplicado');

    SET @j = @j + 1;
  END

  -- Insertar Rechazados
  SET @j = 1;
  WHILE @j <= @countRech
  BEGIN
    SET @totalPersonas = @totalPersonas + 1;
    SET @nom = (SELECT nom FROM @nombres WHERE id = ((@totalPersonas % 40) + 1));
    SET @ape = (SELECT ape FROM @apellidos WHERE id = ((@totalPersonas % 28) + 1));
    SET @zn = (SELECT zona FROM @zonas WHERE id = ((@totalPersonas % 10) + 1));
    SET @tel = '9' + CAST(10000000 + @totalPersonas AS VARCHAR);
    SET @fechaReg = DATEADD(MINUTE, (@totalPersonas * 41) % 1440, DATEADD(DAY, (@totalPersonas % 28), '2026-09-01 08:00:00'));

    INSERT INTO Personas (nombres, apellidos, dni, email, numero, zona, tipo_persona, autoriza_contacto, fecha_autorizacion, estado_calidad, id_campana_origen, id_canal_origen, id_etapa_actual, fecha_registro)
    VALUES (@nom, @ape, NULL, NULL, @tel, @zn, 'Adulto General', 0, NULL, 'Rechazado', @idCamp, @idCanal, @idBuyer, @fechaReg);
    SET @idPersona = SCOPE_IDENTITY();

    INSERT INTO EventosEtapa (id_persona, etapa_destino, fecha_hora, motivo)
    VALUES (@idPersona, @idBuyer, @fechaReg, 'Rechazo de contacto');

    SET @j = @j + 1;
  END

  SET @g = @g + 1;
END

PRINT 'Total Personas creadas en BUYER: ' + CAST(@totalPersonas AS VARCHAR);

-- =========================================================================
-- FASE 2: LEADs (310 Negociaciones distribuidas por Operador y Sede)
-- =========================================================================
DECLARE @valPersonas TABLE (row_num INT IDENTITY(1,1), id_persona INT, fecha_reg DATETIME2);
INSERT INTO @valPersonas (id_persona, fecha_reg)
SELECT id_persona, fecha_registro FROM Personas WHERE estado_calidad = 'Valido' ORDER BY id_persona;

DECLARE @convertedPersonas TABLE (conv_id INT IDENTITY(1,1), id_persona INT, id_solicitud INT, id_opcion INT, id_sede INT);

DECLARE @k INT = 1;
DECLARE @idSol INT, @idOpc INT, @idRes INT, @idPago INT, @idAten INT;
DECLARE @opId INT, @dispId INT, @estSol VARCHAR(30), @fechaSol DATETIME2;
DECLARE @isConverted BIT, @isAbandoned BIT;

WHILE @k <= 310
BEGIN
  SELECT @idPersona = id_persona, @fechaReg = fecha_reg FROM @valPersonas WHERE row_num = @k;
  SET @fechaSol = DATEADD(MINUTE, 35, @fechaReg);

  IF @k <= 85
  BEGIN
    SET @opId = @uOp01; SET @dispId = @dispCentro;
    IF @k <= 32 BEGIN SET @isConverted = 1; SET @isAbandoned = 0; SET @estSol = 'Convertida'; END
    ELSE IF @k <= 75 BEGIN SET @isConverted = 0; SET @isAbandoned = 0; SET @estSol = 'En Negociacion'; END
    ELSE BEGIN SET @isConverted = 0; SET @isAbandoned = 1; SET @estSol = 'Abandonada'; END
  END
  ELSE IF @k <= 155
  BEGIN
    SET @opId = @uOp02; SET @dispId = @dispCentro;
    IF @k <= 85 + 18 BEGIN SET @isConverted = 1; SET @isAbandoned = 0; SET @estSol = 'Convertida'; END
    ELSE IF @k <= 85 + 18 + 37 BEGIN SET @isConverted = 0; SET @isAbandoned = 0; SET @estSol = 'En Negociacion'; END
    ELSE BEGIN SET @isConverted = 0; SET @isAbandoned = 1; SET @estSol = 'Abandonada'; END
  END
  ELSE IF @k <= 250
  BEGIN
    SET @opId = @uOp03; SET @dispId = @dispCalif;
    IF @k <= 155 + 45 BEGIN SET @isConverted = 1; SET @isAbandoned = 0; SET @estSol = 'Convertida'; END
    ELSE IF @k <= 155 + 45 + 42 BEGIN SET @isConverted = 0; SET @isAbandoned = 0; SET @estSol = 'En Negociacion'; END
    ELSE BEGIN SET @isConverted = 0; SET @isAbandoned = 1; SET @estSol = 'Abandonada'; END
  END
  ELSE
  BEGIN
    SET @opId = @uOp04; SET @dispId = @dispCalif;
    IF @k <= 250 + 15 BEGIN SET @isConverted = 1; SET @isAbandoned = 0; SET @estSol = 'Convertida'; END
    ELSE IF @k <= 250 + 15 + 33 BEGIN SET @isConverted = 0; SET @isAbandoned = 0; SET @estSol = 'En Negociacion'; END
    ELSE BEGIN SET @isConverted = 0; SET @isAbandoned = 1; SET @estSol = 'Abandonada'; END
  END

  UPDATE Personas SET id_etapa_actual = @idLead WHERE id_persona = @idPersona;

  INSERT INTO EventosEtapa (id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo)
  VALUES (@idPersona, @idBuyer, @idLead, @fechaSol, @opId, 'Contacto y apertura de negociación');

  INSERT INTO Solicitudes (id_persona, id_servicio, fecha_solicitud, estado, fecha_primera_respuesta)
  VALUES (@idPersona, @servEval, @fechaSol, @estSol, DATEADD(MINUTE, 8, @fechaSol));
  SET @idSol = SCOPE_IDENTITY();

  INSERT INTO Opciones (id_solicitud, id_disponibilidad, precio_ofrecido, fecha_ofrecida, seleccionada)
  VALUES (@idSol, @dispId, 60.00, @fechaSol, 1);
  SET @idOpc = SCOPE_IDENTITY();

  IF @isConverted = 1
  BEGIN
    INSERT INTO @convertedPersonas (id_persona, id_solicitud, id_opcion, id_sede)
    VALUES (@idPersona, @idSol, @idOpc, CASE WHEN @opId IN (@uOp01, @uOp02) THEN @sCentro ELSE @sCalif END);
  END

  SET @k = @k + 1;
END

PRINT 'Total LEADs generados: 310 (Convertidos: 110, En Negociación: 155, Abandonados: 45)';

-- =========================================================================
-- FASE 3: PAYERs (125 Pagos y Recaudación Total: S/. 21,600.00)
-- =========================================================================
DECLARE @payerAssignments TABLE (
  pay_idx INT IDENTITY(1,1), 
  canal_pago VARCHAR(50), 
  importe DECIMAL(10,2), 
  estado VARCHAR(20),
  is_converted_user BIT
);

-- Yape (49 pagos: 45 Validado, 2 Pendiente, 2 Rechazado) -> S/4,850
DECLARE @cnt INT = 1;
WHILE @cnt <= 45 BEGIN INSERT INTO @payerAssignments VALUES ('Yape', 100.00, 'VALIDATED', 1); SET @cnt = @cnt + 1; END
WHILE @cnt <= 47 BEGIN INSERT INTO @payerAssignments VALUES ('Yape', 100.00, 'PENDING', 0); SET @cnt = @cnt + 1; END
WHILE @cnt <= 49 BEGIN INSERT INTO @payerAssignments VALUES ('Yape', 75.00, 'REJECTED', 0); SET @cnt = @cnt + 1; END

-- Plin (22 pagos: 20 Validado, 1 Pendiente, 1 Rechazado) -> S/2,200
SET @cnt = 1;
WHILE @cnt <= 20 BEGIN INSERT INTO @payerAssignments VALUES ('Plin', 100.00, 'VALIDATED', 1); SET @cnt = @cnt + 1; END
WHILE @cnt <= 21 BEGIN INSERT INTO @payerAssignments VALUES ('Plin', 100.00, 'PENDING', 0); SET @cnt = @cnt + 1; END
WHILE @cnt <= 22 BEGIN INSERT INTO @payerAssignments VALUES ('Plin', 100.00, 'REJECTED', 0); SET @cnt = @cnt + 1; END

-- Transferencia (34 pagos: 27 Validado x 300 = 8,100, 5 Pendiente x 300 = 1,500, 2 Rechazado x 200 = 400) -> S/10,000
SET @cnt = 1;
WHILE @cnt <= 27 BEGIN INSERT INTO @payerAssignments VALUES ('Transferencia', 300.00, 'VALIDATED', 1); SET @cnt = @cnt + 1; END
WHILE @cnt <= 32 BEGIN INSERT INTO @payerAssignments VALUES ('Transferencia', 300.00, 'PENDING', 0); SET @cnt = @cnt + 1; END
WHILE @cnt <= 34 BEGIN INSERT INTO @payerAssignments VALUES ('Transferencia', 200.00, 'REJECTED', 0); SET @cnt = @cnt + 1; END

-- Tarjeta (Web) (19 pagos: 18 Validado x 250 = 4,500, 0 Pendiente, 1 Rechazado x 50 = 50) -> S/4,550
SET @cnt = 1;
WHILE @cnt <= 18 BEGIN INSERT INTO @payerAssignments VALUES ('Tarjeta (Web)', 250.00, 'VALIDATED', 1); SET @cnt = @cnt + 1; END
WHILE @cnt <= 19 BEGIN INSERT INTO @payerAssignments VALUES ('Tarjeta (Web)', 50.00, 'REJECTED', 0); SET @cnt = @cnt + 1; END

DECLARE @totalPagos INT = (SELECT COUNT(*) FROM @payerAssignments);
DECLARE @p INT = 1;
DECLARE @canalPago VARCHAR(50), @impPago DECIMAL(10,2), @estPago VARCHAR(20), @isConvUser BIT;
DECLARE @fVal DATETIME2, @uVal INT, @convPointer INT = 1, @otherPointer INT = 111;
DECLARE @targetPersona INT, @targetSol INT, @targetOpc INT;

WHILE @p <= @totalPagos
BEGIN
  SELECT @canalPago = canal_pago, @impPago = importe, @estPago = estado, @isConvUser = is_converted_user
  FROM @payerAssignments WHERE pay_idx = @p;

  IF @isConvUser = 1
  BEGIN
    SELECT @targetPersona = id_persona, @targetSol = id_solicitud, @targetOpc = id_opcion 
    FROM @convertedPersonas WHERE conv_id = @convPointer;
    SET @convPointer = @convPointer + 1;
  END
  ELSE
  BEGIN
    SELECT @targetPersona = id_persona FROM @valPersonas WHERE row_num = @otherPointer;
    SELECT @targetSol = id_solicitud FROM Solicitudes WHERE id_persona = @targetPersona;
    SELECT @targetOpc = id_opcion FROM Opciones WHERE id_solicitud = @targetSol;
    SET @otherPointer = @otherPointer + 1;
  END

  SET @fechaSol = (SELECT fecha_solicitud FROM Solicitudes WHERE id_solicitud = @targetSol);

  INSERT INTO Reservas (id_persona, id_solicitud, id_opcion, fecha_reserva, estado)
  VALUES (@targetPersona, @targetSol, @targetOpc, DATEADD(HOUR, 2, @fechaSol), 'Confirmada');
  SET @idRes = SCOPE_IDENTITY();

  IF @estPago = 'VALIDATED'
  BEGIN
    SET @uVal = @uOp01;
    SET @fVal = DATEADD(MINUTE, 15, @fechaSol);
  END
  ELSE IF @estPago = 'REJECTED'
  BEGIN
    SET @uVal = @uOp01;
    SET @fVal = DATEADD(MINUTE, 5, @fechaSol);
  END
  ELSE
  BEGIN
    SET @uVal = NULL;
    SET @fVal = NULL;
  END

  INSERT INTO Pagos (id_persona, id_reserva, importe, canal_pago, fecha_registro, fecha_validacion, estado, validado_por)
  VALUES (@targetPersona, @idRes, @impPago, @canalPago, DATEADD(HOUR, 2, @fechaSol), @fVal, @estPago, @uVal);

  IF @estPago = 'VALIDATED'
  BEGIN
    UPDATE Personas SET id_etapa_actual = @idPayer WHERE id_persona = @targetPersona;
    INSERT INTO EventosEtapa (id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo)
    VALUES (@targetPersona, @idLead, @idPayer, DATEADD(HOUR, 2, @fechaSol), @uOp01, 'Pago validado satisfactoriamente');
  END

  SET @p = @p + 1;
END

PRINT 'Total Pagos generados: 124 (VALIDATED: 110, PENDING: 8, REJECTED: 6 | Total: S/ 21,600.00)';

-- =========================================================================
-- FASE 4: CUSTOMERs (219 Citas de Atención Clínica)
-- =========================================================================
-- Odontología Preventiva:
--   Evaluación General (100): 85 Asistió, 12 No Asistió, 3 Cancelados
--   Limpieza / Profilaxis (52): 45 Asistió, 5 No Asistió, 2 Cancelados
-- Odontología Especializada:
--   Ortodoncia Inicial (50): 40 Asistió, 8 No Asistió, 2 Cancelados
--   Implante Dental (17): 15 Asistió, 0 No Asistió, 2 Cancelados
-- Total: 185 Atendidos, 25 No Asistió, 9 Cancelados = 219 Atenciones

DECLARE @a INT = 1;
DECLARE @idServAt INT, @idProfAt INT, @idSedeAt INT;
DECLARE @asist VARCHAR(20), @estServ VARCHAR(30);
DECLARE @fAten DATETIME2, @proc VARCHAR(200), @ind VARCHAR(300);

WHILE @a <= 219
BEGIN
  IF @a <= 100
  BEGIN
    SET @idServAt = @servEval; SET @idProfAt = @profValeria; SET @idSedeAt = @sCentro;
    SELECT @idPersona = id_persona FROM (
      SELECT id_persona, ROW_NUMBER() OVER (ORDER BY id_persona) as rn FROM @convertedPersonas WHERE id_sede = @sCentro
    ) t WHERE rn = ((@a % 50) + 1);

    IF @a <= 85 BEGIN SET @asist = 'Asistió'; SET @estServ = 'Finalizado'; END
    ELSE IF @a <= 97 BEGIN SET @asist = 'No asistió'; SET @estServ = 'No presentado'; END
    ELSE BEGIN SET @asist = 'Cancelado'; SET @estServ = 'Cancelado'; END
  END
  ELSE IF @a <= 100 + 52
  BEGIN
    SET @idServAt = @servLimp; SET @idProfAt = @profValeria; SET @idSedeAt = @sCentro;
    SELECT @idPersona = id_persona FROM (
      SELECT id_persona, ROW_NUMBER() OVER (ORDER BY id_persona) as rn FROM @convertedPersonas WHERE id_sede = @sCentro
    ) t WHERE rn = (((@a - 100) % 50) + 1);

    IF @a <= 100 + 45 BEGIN SET @asist = 'Asistió'; SET @estServ = 'Finalizado'; END
    ELSE IF @a <= 100 + 50 BEGIN SET @asist = 'No asistió'; SET @estServ = 'No presentado'; END
    ELSE BEGIN SET @asist = 'Cancelado'; SET @estServ = 'Cancelado'; END
  END
  ELSE IF @a <= 100 + 52 + 50
  BEGIN
    SET @idServAt = @servOrto; SET @idProfAt = @profDiego; SET @idSedeAt = @sCalif;
    SELECT @idPersona = id_persona FROM (
      SELECT id_persona, ROW_NUMBER() OVER (ORDER BY id_persona) as rn FROM @convertedPersonas WHERE id_sede = @sCalif
    ) t WHERE rn = (((@a - 152) % 60) + 1);

    IF @a <= 100 + 52 + 40 BEGIN SET @asist = 'Asistió'; SET @estServ = 'Finalizado'; END
    ELSE IF @a <= 100 + 52 + 48 BEGIN SET @asist = 'No asistió'; SET @estServ = 'No presentado'; END
    ELSE BEGIN SET @asist = 'Cancelado'; SET @estServ = 'Cancelado'; END
  END
  ELSE
  BEGIN
    SET @idServAt = @servImpl; SET @idProfAt = @profLucia; SET @idSedeAt = @sCalif;
    SELECT @idPersona = id_persona FROM (
      SELECT id_persona, ROW_NUMBER() OVER (ORDER BY id_persona) as rn FROM @convertedPersonas WHERE id_sede = @sCalif
    ) t WHERE rn = (((@a - 202) % 60) + 1);

    IF @a <= 100 + 52 + 50 + 15 BEGIN SET @asist = 'Asistió'; SET @estServ = 'Finalizado'; END
    ELSE BEGIN SET @asist = 'Cancelado'; SET @estServ = 'Cancelado'; END
  END

  SET @idRes = (SELECT TOP 1 id_reserva FROM Reservas WHERE id_persona = @idPersona);
  IF @idRes IS NULL SET @idRes = 1;

  SET @fechaReg = (SELECT fecha_registro FROM Personas WHERE id_persona = @idPersona);
  SET @fAten = DATEADD(DAY, 2 + (@a % 20), @fechaReg);

  IF @asist = 'Asistió'
  BEGIN
    SET @proc = 'Procedimiento odontológico realizado con técnica aséptica estándar.';
    SET @ind = 'Indicaciones post-atención de higiene y cuidado brindadas al paciente.';
  END
  ELSE
  BEGIN
    SET @proc = NULL;
    SET @ind = NULL;
  END

  INSERT INTO Atenciones (id_persona, id_reserva, id_servicio, id_profesional, id_sede, fecha_atencion, fecha_inicio, fecha_fin, asistencia, estado_servicio, procedimiento_realizado, indicaciones_finales)
  VALUES (@idPersona, @idRes, @idServAt, @idProfAt, @idSedeAt, CAST(@fAten AS DATE), @fAten, DATEADD(MINUTE, 45, @fAten), @asist, @estServ, @proc, @ind);
  SET @idAten = SCOPE_IDENTITY();

  IF @asist = 'Asistió'
  BEGIN
    UPDATE Personas SET id_etapa_actual = @idCustomer WHERE id_persona = @idPersona;
    INSERT INTO EventosEtapa (id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo)
    VALUES (@idPersona, @idPayer, @idCustomer, @fAten, @uOp01, 'Atención clínica completada');
  END

  SET @a = @a + 1;
END

PRINT 'Total Atenciones generadas: 219 (Atendidos: 185, No Asistió: 25, Cancelados: 9)';

-- =========================================================================
-- FASE 5: TURNED (80 Seguimientos de Fidelización Post-Clínica)
-- =========================================================================
DECLARE @s INT = 1;
WHILE @s <= 80
BEGIN
  SELECT @idPersona = id_persona FROM @convertedPersonas WHERE conv_id = ((@s % 110) + 1);
  SET @fechaReg = (SELECT fecha_registro FROM Personas WHERE id_persona = @idPersona);
  SET @fAten = DATEADD(DAY, 4, @fechaReg);

  INSERT INTO Seguimientos (id_persona, id_atencion, id_usuario, fecha_hora, canal, tipo, resultado, satisfaccion)
  VALUES (@idPersona, @s, @uOp01, @fAten, 'WhatsApp', 'Encuesta NPS Post-Tratamiento', 'Paciente muy satisfecho con la atención en sede', 5);

  UPDATE Personas SET id_etapa_actual = @idTurned WHERE id_persona = @idPersona;

  INSERT INTO EventosEtapa (id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo)
  VALUES (@idPersona, @idCustomer, @idTurned, @fAten, @uOp01, 'Seguimiento y fidelización postventa');

  SET @s = @s + 1;
END

PRINT 'Total Seguimientos generados: 80';
PRINT 'Carga masiva finalizada. Base transaccional NexoSaludDB lista para ejecutar ETL.';
GO