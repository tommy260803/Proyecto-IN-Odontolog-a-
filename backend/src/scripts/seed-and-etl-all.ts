import { getOltpPool, getMartPool, queryMart, queryOltp } from '../db/mart';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🏁 INICIANDO EJECUCIÓN INTEGRAL: SEED TRANSACCIONAL -> ETL DATAMART\n');

  const oltpPool = await getOltpPool();
  const martPool = await getMartPool();

  // 1. Limpieza de NexoSaludDB
  console.log('🧹 1. Limpiando NexoSaludDB...');
  const clearPath = path.resolve(__dirname, '../../../database/clear_db.sql');
  const clearSql = fs.readFileSync(clearPath, 'utf8');
  await oltpPool.request().batch(clearSql);
  console.log('✅ NexoSaludDB reiniciada.');

  // 2. Ejecutar 01_catalogos.sql en NexoSaludDB
  console.log('🌱 2. Ejecutando database/seed/01_catalogos.sql en NexoSaludDB...');
  const seedPath = path.resolve(__dirname, '../../../database/seed/01_catalogos.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  const seedBatches = seedSql.split(/^GO\s*$/mi);
  let s = 1;
  for (const batch of seedBatches) {
    const trimmed = batch.trim();
    if (trimmed) {
      console.log(`   Ejecutando lote transaccional ${s}...`);
      await oltpPool.request().batch(trimmed);
      s++;
    }
  }
  console.log('✅ 01_catalogos.sql ejecutado con éxito en NexoSaludDB.');

  // 3. Ejecutar etl_populate_mart.sql en NexoSalud_Mart
  console.log('\n🔄 3. Ejecutando database/etl_populate_mart.sql en NexoSalud_Mart...');
  const etlPath = path.resolve(__dirname, '../../../database/etl_populate_mart.sql');
  const etlSql = fs.readFileSync(etlPath, 'utf8');
  const etlBatches = etlSql.split(/^GO\s*$/mi);
  let b = 1;
  for (const batch of etlBatches) {
    const trimmed = batch.trim();
    if (trimmed) {
      console.log(`   Ejecutando lote ETL ${b}...`);
      await martPool.request().batch(trimmed);
      b++;
    }
  }
  console.log('✅ etl_populate_mart.sql ejecutado con éxito en NexoSalud_Mart.');

  // 4. Verificación y Resultados
  console.log('\n📊 4. VERIFICACIÓN DE RESULTADOS EN DATAMART (NexoSalud_Mart):');

  console.log('\n--- ETAPA BUYER (Captación por Fuente y Canal) ---');
  const buyer = await queryMart(`
    SELECT f.TipoOrigen, c.NombreCanal, er.EstadoCalidad, SUM(fc.ContactosRegistrados) as Total
    FROM Fact_CaptacionBuyer fc
    JOIN Dim_Fuente f ON f.KeyFuente = fc.KeyFuente
    JOIN Dim_Canal c ON c.KeyCanal = fc.KeyCanal
    JOIN Dim_EstadoRegistro er ON er.KeyEstadoRegistro = fc.KeyEstadoRegistro
    GROUP BY f.TipoOrigen, c.NombreCanal, er.EstadoCalidad
    ORDER BY f.TipoOrigen, c.NombreCanal, er.EstadoCalidad
  `);
  console.table(buyer);

  console.log('\n--- ETAPA LEAD (Negociación por Sede y Operador) ---');
  const lead = await queryMart(`
    SELECT s.Sede, n.NombreNegociador, 
           SUM(fl.LeadsConvertidosPayer14Dias) as [Convertidos Payer],
           SUM(fl.LeadsEnNegociacion) as [En Negociacion],
           SUM(fl.LeadsAbandonados) as [Abandonados],
           SUM(fl.LeadsCohorteEvaluable) as [Total Leads]
    FROM Fact_NegociacionLead fl
    JOIN Dim_Sede s ON s.KeySede = fl.KeySede
    JOIN Dim_Negociador n ON n.KeyNegociador = fl.KeyNegociador
    GROUP BY s.Sede, n.NombreNegociador
    ORDER BY s.Sede, n.NombreNegociador
  `);
  console.table(lead);

  console.log('\n--- ETAPA PAYER (Recaudación por Modalidad y Canal) ---');
  const payer = await queryMart(`
    SELECT p.TipoMedio, p.MetodoPago, c.EstadoPago, SUM(fp.ImporteTotalCobro) as TotalSoles, COUNT(*) as Registros
    FROM Fact_GestionPayer fp
    JOIN Dim_Pasarela p ON p.KeyPasarela = fp.KeyPasarela
    JOIN Dim_Cobro c ON c.KeyCobro = fp.KeyCobro
    GROUP BY p.TipoMedio, p.MetodoPago, c.EstadoPago
    ORDER BY p.TipoMedio, p.MetodoPago, c.EstadoPago
  `);
  console.table(payer);

  console.log('\n--- ETAPA CUSTOMER (Prestación Clínica por Servicio) ---');
  const customer = await queryMart(`
    SELECT serv.Categoria, serv.ServicioOdontologico, dea.EstadoFinal, SUM(fa.CitasEvaluables) as Citas
    FROM Fact_AtencionCustomer fa
    JOIN Dim_Servicio serv ON serv.KeyServicio = fa.KeyServicio
    JOIN Dim_EstadoAtencion dea ON dea.KeyEstadoAtencion = fa.KeyEstadoAtencion
    GROUP BY serv.Categoria, serv.ServicioOdontologico, dea.EstadoFinal
    ORDER BY serv.Categoria, serv.ServicioOdontologico, dea.EstadoFinal
  `);
  console.table(customer);

  console.log('\n🎉 ¡PROCESO FINALIZADO EXITOSAMENTE!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
