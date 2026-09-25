import { getMartPool, queryMart } from '../db/mart';

async function seedMartReports() {
  const pool = await getMartPool();
  console.log('🚀 Iniciando carga de dimensiones y hechos en NexoSalud_Mart...');

  // 1. Alter table if needed
  try {
    await pool.request().batch(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Fact_NegociacionLead') 
          AND name = 'LeadsEnNegociacion'
      )
      BEGIN
        ALTER TABLE Fact_NegociacionLead ADD LeadsEnNegociacion INT DEFAULT 0;
      END
    `);
    console.log('✅ Columna LeadsEnNegociacion verificada/agregada.');
  } catch (err: any) {
    console.log('Info LeadsEnNegociacion:', err.message);
  }

  // 2. Limpiar hechos
  await pool.request().batch(`
    DELETE FROM Fact_CaptacionBuyer;
    DELETE FROM Fact_NegociacionLead;
    DELETE FROM Fact_GestionPayer;
    DELETE FROM Fact_AtencionCustomer;
  `);
  console.log('✅ Tablas de hechos limpiadas.');

  // Helper para insertar en tabla con IDENTITY
  async function insertWithIdentity(tableName: string, insertSql: string) {
    await pool.request().batch(`
      SET IDENTITY_INSERT ${tableName} ON;
      ${insertSql}
      SET IDENTITY_INSERT ${tableName} OFF;
    `);
  }

  // 3. Dim_Fuente
  await pool.request().batch(`DELETE FROM Dim_Fuente WHERE KeyFuente IN (1, 2);`);
  await insertWithIdentity('Dim_Fuente', `
    INSERT INTO Dim_Fuente (KeyFuente, id_fuente, id_campana, TipoOrigen, Campana)
    VALUES 
      (1, 1, 1, 'Redes Sociales (Pauta / Meta Ads)', 'Campaña Meta Ads'),
      (2, 2, 2, 'Búsqueda Orgánica (SEO / Maps)', 'Google SEO & Maps');
  `);
  console.log('✅ Dim_Fuente cargada.');

  // 4. Dim_Canal
  await pool.request().batch(`DELETE FROM Dim_Canal WHERE KeyCanal IN (1, 2, 3, 4, 5);`);
  await insertWithIdentity('Dim_Canal', `
    INSERT INTO Dim_Canal (KeyCanal, id_canal, NombreCanal, TipoMedio)
    VALUES 
      (1, 1, 'WhatsApp', 'Digital'),
      (2, 2, 'Instagram', 'Digital'),
      (3, 3, 'Facebook', 'Digital'),
      (4, 4, 'Página Web', 'Digital'),
      (5, 5, 'WhatsApp (Link en Google Maps)', 'Digital');
  `);
  console.log('✅ Dim_Canal cargada.');

  // 5. Dim_EstadoRegistro
  await pool.request().batch(`DELETE FROM Dim_EstadoRegistro WHERE KeyEstadoRegistro IN (1, 2, 3, 4);`);
  await insertWithIdentity('Dim_EstadoRegistro', `
    INSERT INTO Dim_EstadoRegistro (KeyEstadoRegistro, EstadoCalidad, AutorizacionContacto)
    VALUES 
      (1, 'Válidos', 'SI'),
      (2, 'Incompletos', 'NO'),
      (3, 'Duplicados', 'NO'),
      (4, 'Rechazados', 'NO');
  `);
  console.log('✅ Dim_EstadoRegistro cargada.');

  // 6. Dim_Sede
  await pool.request().batch(`DELETE FROM Dim_Sede WHERE KeySede IN (1, 2);`);
  await insertWithIdentity('Dim_Sede', `
    INSERT INTO Dim_Sede (KeySede, id_sede, Sede, Distrito, Zona)
    VALUES 
      (1, 1, 'Sede Centro', 'Trujillo Centro', 'Centro'),
      (2, 2, 'Sede Norte', 'Trujillo Norte', 'Norte');
  `);
  console.log('✅ Dim_Sede cargada.');

  // 7. Dim_Negociador
  await pool.request().batch(`DELETE FROM Dim_Negociador WHERE KeyNegociador IN (1, 2, 3, 4);`);
  await insertWithIdentity('Dim_Negociador', `
    INSERT INTO Dim_Negociador (KeyNegociador, id_usuario, NombreNegociador)
    VALUES 
      (1, 101, 'Operador_01'),
      (2, 102, 'Operador_02'),
      (3, 103, 'Operador_03'),
      (4, 104, 'Operador_04');
  `);
  console.log('✅ Dim_Negociador cargada.');

  // 8. Dim_Pasarela
  await pool.request().batch(`DELETE FROM Dim_Pasarela WHERE KeyPasarela IN (1, 2, 3, 4);`);
  await insertWithIdentity('Dim_Pasarela', `
    INSERT INTO Dim_Pasarela (KeyPasarela, MetodoPago, EntidadFinanciera, TipoMedio)
    VALUES 
      (1, 'Yape', 'BCP', 'Billeteras Digitales'),
      (2, 'Plin', 'Interbank/BBVA', 'Billeteras Digitales'),
      (3, 'Transferencia', 'Interbancaria', 'Bancarizado'),
      (4, 'Tarjeta (Web)', 'Niubiz/Culqi', 'Bancarizado');
  `);
  console.log('✅ Dim_Pasarela cargada.');

  // 9. Dim_Cobro
  await pool.request().batch(`DELETE FROM Dim_Cobro WHERE KeyCobro IN (1, 2, 3);`);
  await insertWithIdentity('Dim_Cobro', `
    INSERT INTO Dim_Cobro (KeyCobro, EstadoPago, ComprobanteAdjunto)
    VALUES 
      (1, 'VALIDATED', 'SI'),
      (2, 'PENDING', 'NO'),
      (3, 'REJECTED', 'NO');
  `);
  console.log('✅ Dim_Cobro cargada.');

  // 10. Dim_Servicio
  await pool.request().batch(`DELETE FROM Dim_Servicio WHERE KeyServicio IN (10, 11, 12, 13);`);
  await insertWithIdentity('Dim_Servicio', `
    INSERT INTO Dim_Servicio (KeyServicio, id_servicio, ServicioOdontologico, Categoria, Procedimiento)
    VALUES 
      (10, 10, 'Evaluación General', 'Odontología Preventiva', 'Evaluación General'),
      (11, 11, 'Limpieza / Profilaxis', 'Odontología Preventiva', 'Limpieza / Profilaxis'),
      (12, 12, 'Ortodoncia Inicial', 'Odontología Especializada', 'Ortodoncia Inicial'),
      (13, 13, 'Implante Dental', 'Odontología Especializada', 'Implante Dental');
  `);
  console.log('✅ Dim_Servicio cargada.');

  // 11. Dim_EstadoAtencion
  await pool.request().batch(`DELETE FROM Dim_EstadoAtencion WHERE KeyEstadoAtencion IN (1, 2, 3);`);
  await insertWithIdentity('Dim_EstadoAtencion', `
    INSERT INTO Dim_EstadoAtencion (KeyEstadoAtencion, EstadoFinal, Asistencia)
    VALUES 
      (1, 'Atendidos', 'Asistió'),
      (2, 'No Asistió (No-Show)', 'No Asistió'),
      (3, 'Cancelados', 'Cancelado');
  `);
  console.log('✅ Dim_EstadoAtencion cargada.');

  // 12. Dim_Hora (para que no haya errores si se referencia)
  await pool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM Dim_Hora WHERE KeyHora = 1)
      INSERT INTO Dim_Hora (KeyHora, Turno, Hora, Minuto) VALUES (1, 'Mañana', 9, 0);
  `);

  // ====================================================================
  // INSERTAR HECHOS EXACTOS SEGÚN REPORTES PLANTEADOS POR EL USUARIO
  // ====================================================================

  // FACT BUYER (Período: Septiembre 2026 => KeyTiempo 20260915)
  await pool.request().batch(`
    INSERT INTO Fact_CaptacionBuyer (KeyTiempo, KeyFuente, KeyCanal, KeyEstadoRegistro, ContactosRegistrados, ContactosUtilizables, ConversionesALead)
    VALUES 
      -- Redes Sociales (Pauta / Meta Ads) (KeyFuente=1)
      -- WhatsApp (KeyCanal=1): 250, 25, 15, 10
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

      -- Búsqueda Orgánica (SEO / Maps) (KeyFuente=2)
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
  `);
  console.log('✅ Fact_CaptacionBuyer cargada con éxito.');

  // FACT LEAD
  await pool.request().batch(`
    INSERT INTO Fact_NegociacionLead (
      KeyTiempo, KeySede, KeyNegociador, 
      LeadsCohorteEvaluable, LeadsConvertidosPayer14Dias, LeadsEnNegociacion, LeadsAbandonados,
      LeadsRequierenRespuesta, LeadsRespuestaUtil15Min, LeadsResultadoFinal
    )
    VALUES 
      -- Sede Centro (KeySede=1)
      -- Operador_01: Convertidos=32, En Negociacion=43, Abandonados=10, Total=85
      (20260915, 1, 1, 85, 32, 43, 10, 85, 78, 42),
      -- Operador_02: Convertidos=18, En Negociacion=37, Abandonados=15, Total=70
      (20260915, 1, 2, 70, 18, 37, 15, 70, 59, 33),

      -- Sede Norte (KeySede=2)
      -- Operador_03: Convertidos=45, En Negociacion=42, Abandonados=8, Total=95
      (20260915, 2, 3, 95, 45, 42, 8, 95, 88, 53),
      -- Operador_04: Convertidos=15, En Negociacion=33, Abandonados=12, Total=60
      (20260915, 2, 4, 60, 15, 33, 12, 60, 51, 27);
  `);
  console.log('✅ Fact_NegociacionLead cargada con éxito.');

  // FACT PAYER
  await pool.request().batch(`
    INSERT INTO Fact_GestionPayer (KeyTiempo, KeyPasarela, KeyCobro, ImporteTotalCobro, PagosRegistrados, PagosValidados, PagosRechazados)
    VALUES 
      -- Billeteras Digitales
      -- Yape (KeyPasarela=1)
      (20260915, 1, 1, 4500.00, 45, 45, 0),
      (20260915, 1, 2, 200.00, 2, 0, 0),
      (20260915, 1, 3, 150.00, 2, 0, 2),

      -- Plin (KeyPasarela=2)
      (20260915, 2, 1, 2000.00, 20, 20, 0),
      (20260915, 2, 2, 100.00, 1, 0, 0),
      (20260915, 2, 3, 100.00, 1, 0, 1),

      -- Bancarizado
      -- Transferencia (KeyPasarela=3)
      (20260915, 3, 1, 8100.00, 30, 30, 0),
      (20260915, 3, 2, 1500.00, 5, 0, 0),
      (20260915, 3, 3, 400.00, 2, 0, 2),

      -- Tarjeta (Web) (KeyPasarela=4)
      (20260915, 4, 1, 4500.00, 18, 18, 0),
      (20260915, 4, 2, 0.00, 0, 0, 0),
      (20260915, 4, 3, 50.00, 1, 0, 1);
  `);
  console.log('✅ Fact_GestionPayer cargada con éxito.');

  // FACT CUSTOMER
  await pool.request().batch(`
    INSERT INTO Fact_AtencionCustomer (KeyTiempo, KeyServicio, KeyEstadoAtencion, CitasEvaluables, AtencionesRealizadas, CitasConInasistencia)
    VALUES 
      -- Odontología Preventiva
      -- Evaluación General (KeyServicio=10)
      (20260915, 10, 1, 85, 85, 0),
      (20260915, 10, 2, 12, 0, 12),
      (20260915, 10, 3, 3, 0, 0),

      -- Limpieza / Profilaxis (KeyServicio=11)
      (20260915, 11, 1, 45, 45, 0),
      (20260915, 11, 2, 5, 0, 5),
      (20260915, 11, 3, 2, 0, 0),

      -- Odontología Especializada
      -- Ortodoncia Inicial (KeyServicio=12)
      (20260915, 12, 1, 40, 40, 0),
      (20260915, 12, 2, 8, 0, 8),
      (20260915, 12, 3, 2, 0, 0),

      -- Implante Dental (KeyServicio=13)
      (20260915, 13, 1, 15, 15, 0),
      (20260915, 13, 2, 0, 0, 0),
      (20260915, 13, 3, 2, 0, 0);
  `);
  console.log('✅ Fact_AtencionCustomer cargada con éxito.');

  console.log('🎉 Todas las dimensiones y hechos para los reportes ejecutivos están en NexoSalud_Mart!');
  process.exit(0);
}

seedMartReports().catch((err) => {
  console.error('❌ Error al poblar NexoSalud_Mart:', err);
  process.exit(1);
});
