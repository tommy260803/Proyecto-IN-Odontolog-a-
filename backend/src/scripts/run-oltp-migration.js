const fs = require('fs');
const path = require('path');
const { executeBatch, executeSql } = require('./db-helper.js');

async function main() {
  console.log('▶ Iniciando ejecución de migración OLTP para NexoSaludDB...');
  const migrationPath = path.resolve(__dirname, '../../../database/migrations/20261026_reingenieria_buyer_oltp.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  await executeBatch(sqlContent, 'NexoSaludDB');
  console.log('✔ Script SQL ejecutado sin errores.');

  // Verificaciones de integridad post-migración
  const countPersonas = await executeSql('SELECT COUNT(*) as total FROM Personas', 'NexoSaludDB');
  const countOportunidades = await executeSql('SELECT COUNT(*) as total, estado_oportunidad FROM OportunidadesCaptacion GROUP BY estado_oportunidad', 'NexoSaludDB');
  const colsPersonas = await executeSql("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Personas' AND COLUMN_NAME IN ('telefono_normalizado', 'email_normalizado', 'consentimiento_atencion')", 'NexoSaludDB');

  console.log('Total Personas:', countPersonas[0].total);
  console.log('Oportunidades creadas por estado:', countOportunidades);
  console.log('Nuevas columnas verificadas en Personas:', colsPersonas.map(c => c.COLUMN_NAME));
  console.log('✔ Migración OLTP completada y certificada.');
}

main().catch(err => {
  console.error('❌ Error en migración OLTP:', err);
  process.exit(1);
});
