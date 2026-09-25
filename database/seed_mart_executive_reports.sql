USE NexoSalud_Mart;
GO

-- 1. Agregar columna LeadsEnNegociacion a Fact_NegociacionLead si no existe
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Fact_NegociacionLead') 
      AND name = 'LeadsEnNegociacion'
)
BEGIN
    ALTER TABLE Fact_NegociacionLead ADD LeadsEnNegociacion INT DEFAULT 0;
END
GO

-- 2. Limpiar datos previos de hechos y dimensiones específicas para recargar limpiamente
DELETE FROM Fact_CaptacionBuyer;
DELETE FROM Fact_NegociacionLead;
DELETE FROM Fact_GestionPayer;
DELETE FROM Fact_AtencionCustomer;

DELETE FROM Dim_EstadoRegistro WHERE KeyEstadoRegistro > 0;
DELETE FROM Dim_Fuente WHERE KeyFuente > 0;
DELETE FROM Dim_Pasarela WHERE KeyPasarela > 0;
DELETE FROM Dim_Cobro WHERE KeyCobro > 0;
DELETE FROM Dim_EstadoAtencion WHERE KeyEstadoAtencion > 0;
DELETE FROM Dim_Negociador WHERE KeyNegociador > 0;

-- Asegurar Dim_Hora
IF NOT EXISTS (SELECT 1 FROM Dim_Hora WHERE KeyHora = 1)
BEGIN
    INSERT INTO Dim_Hora (KeyHora, Turno, Hora, Minuto)
    VALUES (1, 'Mañana', 9, 0);
END

-- ====================================================================
-- DIMENSIONES Y HECHOS: ETAPA BUYER
-- ====================================================================
-- Fuentes (Categorías)
IF NOT EXISTS (SELECT 1 FROM Dim_Fuente WHERE KeyFuente = 1)
    INSERT INTO Dim_Fuente (KeyFuente, id_fuente, id_campana, TipoOrigen, Campana)
    VALUES (1, 1, 1, 'Redes Sociales (Pauta / Meta Ads)', 'Campaña Primavera 2026');

IF NOT EXISTS (SELECT 1 FROM Dim_Fuente WHERE KeyFuente = 2)
    INSERT INTO Dim_Fuente (KeyFuente, id_fuente, id_campana, TipoOrigen, Campana)
    VALUES (2, 2, 2, 'Búsqueda Orgánica (SEO / Maps)', 'Presencia Orgánica');

-- Canales (Items)
IF NOT EXISTS (SELECT 1 FROM Dim_Canal WHERE KeyCanal = 1)
    INSERT INTO Dim_Canal (KeyCanal, id_canal, NombreCanal, TipoMedio)
    VALUES (1, 1, 'WhatsApp', 'Digital');
ELSE
    UPDATE Dim_Canal SET NombreCanal = 'WhatsApp' WHERE KeyCanal = 1;

IF NOT EXISTS (SELECT 1 FROM Dim_Canal WHERE KeyCanal = 2)
    INSERT INTO Dim_Canal (KeyCanal, id_canal, NombreCanal, TipoMedio)
    VALUES (2, 2, 'Instagram', 'Digital');
ELSE
    UPDATE Dim_Canal SET NombreCanal = 'Instagram' WHERE KeyCanal = 2;

IF NOT EXISTS (SELECT 1 FROM Dim_Canal WHERE KeyCanal = 3)
    INSERT INTO Dim_Canal (KeyCanal, id_canal, NombreCanal, TipoMedio)
    VALUES (3, 3, 'Facebook', 'Digital');
ELSE
    UPDATE Dim_Canal SET NombreCanal = 'Facebook' WHERE KeyCanal = 3;

IF NOT EXISTS (SELECT 1 FROM Dim_Canal WHERE KeyCanal = 4)
    INSERT INTO Dim_Canal (KeyCanal, id_canal, NombreCanal, TipoMedio)
    VALUES (4, 4, 'Página Web', 'Digital');
ELSE
    UPDATE Dim_Canal SET NombreCanal = 'Página Web' WHERE KeyCanal = 4;

IF NOT EXISTS (SELECT 1 FROM Dim_Canal WHERE KeyCanal = 5)
    INSERT INTO Dim_Canal (KeyCanal, id_canal, NombreCanal, TipoMedio)
    VALUES (5, 5, 'WhatsApp (Link en Google Maps)', 'Digital');
ELSE
    UPDATE Dim_Canal SET NombreCanal = 'WhatsApp (Link en Google Maps)' WHERE KeyCanal = 5;

-- Estados de Calidad (Columnas)
INSERT INTO Dim_EstadoRegistro (KeyEstadoRegistro, EstadoCalidad, AutorizacionContacto)
VALUES 
    (1, 'Válidos', 'Sí'),
    (2, 'Incompletos', 'No'),
    (3, 'Duplicados', 'No'),
    (4, 'Rechazados', 'No');

-- Fact_CaptacionBuyer
-- Septiembre 2026 -> KeyTiempo = 20260915
-- Redes Sociales (KeyFuente=1)
-- WhatsApp (KeyCanal=1): 250 válidos, 25 incompletos, 15 duplicados, 10 rechazados
INSERT INTO Fact_CaptacionBuyer (KeyTiempo, KeyFuente, KeyCanal, KeyEstadoRegistro, ContactosRegistrados, ContactosUtilizables, ConversionesALead)
VALUES 
    (20260915, 1, 1, 1, 250, 250, 80),
    (20260915, 1, 1, 2, 25, 0, 0),
    (20260915, 1, 1, 3, 15, 0, 0),
    (20260915, 1, 1, 4, 10, 0, 0),

-- Instagram (KeyCanal=2): 140, 18, 12, 5
    (20260915, 1, 2, 1, 140, 140, 45),
    (20260915, 1, 2, 2, 18, 0, 0),
    (20260915, 1, 2, 3, 12, 0, 0),
    (20260915, 1, 2, 4, 5, 0, 0),

-- Facebook (KeyCanal=3): 90, 12, 8, 5
    (20260915, 1, 3, 1, 90, 90, 30),
    (20260915, 1, 3, 2, 12, 0, 0),
    (20260915, 1, 3, 3, 8, 0, 0),
    (20260915, 1, 3, 4, 5, 0, 0),

-- Búsqueda Orgánica (KeyFuente=2)
-- Página Web (KeyCanal=4): 85, 5, 0, 0
    (20260915, 2, 4, 1, 85, 85, 28),
    (20260915, 2, 4, 2, 5, 0, 0),
    (20260915, 2, 4, 3, 0, 0, 0),
    (20260915, 2, 4, 4, 0, 0, 0),

-- WhatsApp (Link en Google Maps) (KeyCanal=5): 115, 8, 2, 0
    (20260915, 2, 5, 1, 115, 115, 38),
    (20260915, 2, 5, 2, 8, 0, 0),
    (20260915, 2, 5, 3, 2, 0, 0),
    (20260915, 2, 5, 4, 0, 0, 0);

-- ====================================================================
-- DIMENSIONES Y HECHOS: ETAPA LEAD
-- ====================================================================
-- Sedes
IF NOT EXISTS (SELECT 1 FROM Dim_Sede WHERE KeySede = 1)
    INSERT INTO Dim_Sede (KeySede, id_sede, Sede, Distrito, Zona)
    VALUES (1, 1, 'Sede Centro', 'Trujillo Centro', 'Centro');
ELSE
    UPDATE Dim_Sede SET Sede = 'Sede Centro' WHERE KeySede = 1;

IF NOT EXISTS (SELECT 1 FROM Dim_Sede WHERE KeySede = 2)
    INSERT INTO Dim_Sede (KeySede, id_sede, Sede, Distrito, Zona)
    VALUES (2, 2, 'Sede Norte', 'Trujillo Norte', 'Norte');
ELSE
    UPDATE Dim_Sede SET Sede = 'Sede Norte' WHERE KeySede = 2;

-- Negociadores
INSERT INTO Dim_Negociador (KeyNegociador, id_usuario, NombreNegociador)
VALUES 
    (1, 101, 'Operador_01'),
    (2, 102, 'Operador_02'),
    (3, 103, 'Operador_03'),
    (4, 104, 'Operador_04');

-- Fact_NegociacionLead
-- Sede Centro (KeySede=1):
-- Operador_01 (KeyNegociador=1): Convertidos a PAYER=32, En Negociación=43, Abandonados=10, Total=85
-- Operador_02 (KeyNegociador=2): Convertidos a PAYER=18, En Negociación=37, Abandonados=15, Total=70
-- Sede Norte (KeySede=2):
-- Operador_03 (KeyNegociador=3): Convertidos a PAYER=45, En Negociación=42, Abandonados=8, Total=95
-- Operador_04 (KeyNegociador=4): Convertidos a PAYER=15, En Negociación=33, Abandonados=12, Total=60
INSERT INTO Fact_NegociacionLead (
    KeyTiempo, KeySede, KeyNegociador, 
    LeadsCohorteEvaluable, LeadsConvertidosPayer14Dias, LeadsEnNegociacion, LeadsAbandonados,
    LeadsRequierenRespuesta, LeadsRespuestaUtil15Min, LeadsResultadoFinal
)
VALUES 
    (20260915, 1, 1, 85, 32, 43, 10, 85, 78, 42),
    (20260915, 1, 2, 70, 18, 37, 15, 70, 59, 33),
    (20260915, 2, 3, 95, 45, 42, 8, 95, 88, 53),
    (20260915, 2, 4, 60, 15, 33, 12, 60, 51, 27);

-- ====================================================================
-- DIMENSIONES Y HECHOS: ETAPA PAYER
-- ====================================================================
-- Pasarelas (Modalidad / Canal)
INSERT INTO Dim_Pasarela (KeyPasarela, MetodoPago, EntidadFinanciera, TipoMedio)
VALUES 
    (1, 'Yape', 'BCP', 'Billeteras Digitales'),
    (2, 'Plin', 'Interbank/BBVA', 'Billeteras Digitales'),
    (3, 'Transferencia', 'Interbancaria', 'Bancarizado'),
    (4, 'Tarjeta (Web)', 'Niubiz/Culqi', 'Bancarizado');

-- Estados de Cobro
INSERT INTO Dim_Cobro (KeyCobro, EstadoPago, ComprobanteAdjunto)
VALUES 
    (1, 'VALIDATED', 'Sí'),
    (2, 'PENDING', 'Pendiente'),
    (3, 'REJECTED', 'No');

-- Fact_GestionPayer
-- Billeteras Digitales:
-- Yape: VALIDATED 4,500.00 | PENDING 200.00 | REJECTED 150.00 | Total 4,850.00
-- Plin: VALIDATED 2,000.00 | PENDING 100.00 | REJECTED 100.00 | Total 2,200.00
-- Bancarizado:
-- Transferencia: VALIDATED 8,100.00 | PENDING 1,500.00 | REJECTED 400.00 | Total 10,000.00
-- Tarjeta (Web): VALIDATED 4,500.00 | PENDING 0.00 | REJECTED 50.00 | Total 4,550.00
INSERT INTO Fact_GestionPayer (KeyTiempo, KeyPasarela, KeyCobro, ImporteTotalCobro, PagosRegistrados, PagosValidados, PagosRechazados)
VALUES 
    (20260915, 1, 1, 4500.00, 45, 45, 0),
    (20260915, 1, 2, 200.00, 2, 0, 0),
    (20260915, 1, 3, 150.00, 2, 0, 2),

    (20260915, 2, 1, 2000.00, 20, 20, 0),
    (20260915, 2, 2, 100.00, 1, 0, 0),
    (20260915, 2, 3, 100.00, 1, 0, 1),

    (20260915, 3, 1, 8100.00, 30, 30, 0),
    (20260915, 3, 2, 1500.00, 5, 0, 0),
    (20260915, 3, 3, 400.00, 2, 0, 2),

    (20260915, 4, 1, 4500.00, 18, 18, 0),
    (20260915, 4, 2, 0.00, 0, 0, 0),
    (20260915, 4, 3, 50.00, 1, 0, 1);

-- ====================================================================
-- DIMENSIONES Y HECHOS: ETAPA CUSTOMER
-- ====================================================================
-- Servicios Odontológicos (Categoría / Servicio)
DELETE FROM Dim_Servicio WHERE KeyServicio IN (10, 11, 12, 13);
INSERT INTO Dim_Servicio (KeyServicio, id_servicio, ServicioOdontologico, Categoria, Procedimiento)
VALUES 
    (10, 10, 'Evaluación General', 'Odontología Preventiva', 'Evaluación General'),
    (11, 11, 'Limpieza / Profilaxis', 'Odontología Preventiva', 'Limpieza / Profilaxis'),
    (12, 12, 'Ortodoncia Inicial', 'Odontología Especializada', 'Ortodoncia Inicial'),
    (13, 13, 'Implante Dental', 'Odontología Especializada', 'Implante Dental');

-- Estados de Atención
INSERT INTO Dim_EstadoAtencion (KeyEstadoAtencion, EstadoFinal, Asistencia)
VALUES 
    (1, 'Atendidos', 'Asistió'),
    (2, 'No Asistió (No-Show)', 'No Asistió'),
    (3, 'Cancelados', 'Cancelado');

-- Fact_AtencionCustomer
-- Odontología Preventiva:
-- Evaluación General: Atendidos 85 | No Asistió 12 | Cancelados 3 | Total 100
-- Limpieza / Profilaxis: Atendidos 45 | No Asistió 5 | Cancelados 2 | Total 52
-- Odontología Especializada:
-- Ortodoncia Inicial: Atendidos 40 | No Asistió 8 | Cancelados 2 | Total 50
-- Implante Dental: Atendidos 15 | No Asistió 0 | Cancelados 2 | Total 17
INSERT INTO Fact_AtencionCustomer (KeyTiempo, KeyServicio, KeyEstadoAtencion, CitasEvaluables, AtencionesRealizadas, CitasConInasistencia)
VALUES 
    (20260915, 10, 1, 85, 85, 0),
    (20260915, 10, 2, 12, 0, 12),
    (20260915, 10, 3, 3, 0, 0),

    (20260915, 11, 1, 45, 45, 0),
    (20260915, 11, 2, 5, 0, 5),
    (20260915, 11, 3, 2, 0, 0),

    (20260915, 12, 1, 40, 40, 0),
    (20260915, 12, 2, 8, 0, 8),
    (20260915, 12, 3, 2, 0, 0),

    (20260915, 13, 1, 15, 15, 0),
    (20260915, 13, 2, 0, 0, 0),
    (20260915, 13, 3, 2, 0, 0);

GO
