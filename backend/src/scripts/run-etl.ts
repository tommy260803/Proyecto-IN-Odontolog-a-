import fs from 'fs';
import path from 'path';
import { getMartPool } from '../db/mart';

async function run() {
  const pool = await getMartPool();
  const useInsert = process.argv.includes('--strategy=insert');
  const fileName = useInsert ? 'etl_populate_mart_insert.sql' : 'etl_populate_mart.sql';
  const filePath = path.resolve(__dirname, `../../../database/${fileName}`);
  
  console.log(`🚀 Iniciando ETL de NexoSalud [Estrategia: ${useInsert ? 'UPDATE + INSERT (WHERE NOT EXISTS)' : 'MERGE (Oficial)'}]`);
  console.log(`📄 Script: ${fileName}`);

  const sqlContent = fs.readFileSync(filePath, 'utf8');
  const batches = sqlContent.split(/^GO\s*$/mi);
  
  let i = 1;
  for (const batch of batches) {
    const trimmed = batch.trim();
    if (trimmed) {
      console.log(`Executing batch ${i}...`);
      await pool.request().batch(trimmed);
      i++;
    }
  }
  console.log(`✅ Proceso ETL completado con éxito! [${fileName}]`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error ejecutando ETL:', err);
  process.exit(1);
});
