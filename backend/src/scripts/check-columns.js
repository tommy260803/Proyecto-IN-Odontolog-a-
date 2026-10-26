const { executeSql } = require('./db-helper.js');

async function main() {
  const cols = await executeSql(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN ('Personas', 'DecisionesIA', 'Interacciones', 'Solicitudes')
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  console.log('Columns count:', cols.length);
  cols.forEach(c => console.log(`${c.TABLE_NAME}.${c.COLUMN_NAME} (${c.DATA_TYPE}, null:${c.IS_NULLABLE})`));
}

main().catch(console.error);
