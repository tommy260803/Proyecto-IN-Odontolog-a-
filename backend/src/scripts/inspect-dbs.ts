import { queryMart } from '../db/mart';

async function run() {
  const cols = await queryMart(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE DATA_TYPE IN ('varchar', 'char', 'nvarchar')
    ORDER BY CHARACTER_MAXIMUM_LENGTH, TABLE_NAME
  `);
  console.log('Short text columns:');
  console.table(cols.filter((c: any) => c.CHARACTER_MAXIMUM_LENGTH <= 10));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
