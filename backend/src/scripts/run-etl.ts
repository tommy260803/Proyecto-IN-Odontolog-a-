import fs from 'fs';
import path from 'path';
import { getMartPool } from '../db/mart';

async function run() {
  const pool = await getMartPool();
  const fileName = 'poblamiento_dimensional.sql';
  const filePath = path.resolve(__dirname, `../../../database/${fileName}`);
  
  console.log('Iniciando poblamiento dimensional de NexoSalud');
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
  console.log(`Proceso ETL completado: ${fileName}`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error ejecutando ETL:', err);
  process.exit(1);
});
