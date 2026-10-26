import { queryMart } from '../db/mart';
import fs from 'fs';
import path from 'path';

async function runEtl() {
  console.log('🔄 Ejecutando database/etl_populate_mart.sql...');
  const etlPath = path.resolve(__dirname, '../../../database/etl_populate_mart.sql');
  const etlSql = fs.readFileSync(etlPath, 'utf8');
  const etlBatches = etlSql.split(/^GO\s*$/mi);
  let b = 1;
  for (const batch of etlBatches) {
    const trimmed = batch.trim();
    if (trimmed) {
      console.log(`   Ejecutando lote ETL ${b}...`);
      await queryMart(trimmed);
      b++;
    }
  }
  console.log('✅ etl_populate_mart.sql ejecutado con éxito en NexoSalud_Mart.');

  console.log('\n📊 VERIFICACIÓN DE DATOS FACT_OPORTUNIDADCAPTACION:');
  const atom = await queryMart(`
    SELECT 
      COUNT(*) as TotalFilas,
      SUM(contacto_utilizable) as Utilizables,
      SUM(conversion_lead) as Conversiones,
      SUM(costo_atribuido_captacion) as CostoTotal
    FROM Fact_OportunidadCaptacion;
  `);
  console.table(atom);

  console.log('\n📊 VERIFICACIÓN DE DATOS FACT_CAPTACIONBUYER (AGREGADA):');
  const aggr = await queryMart(`
    SELECT 
      COUNT(*) as GruposAgregados,
      SUM(contacto_registrado) as Registrados,
      SUM(contacto_utilizable) as Utilizables,
      SUM(conversion_lead) as Conversiones,
      SUM(costo_atribuido_captacion) as CostoTotal
    FROM Fact_CaptacionBuyer;
  `);
  console.table(aggr);
}

runEtl().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
