/* Captura catalogo, conteos y SHA-256 de JSON ordenado por PK. Solo SELECT.
 * No guarda valores de pacientes: solo metadatos y huellas.
 * node .../CAPTURAR_ESTADO_SOLO_LECTURA.cjs salida.json [captura_base.json]
 */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(root, 'backend/package.json'));
req('dotenv').config({ path: path.join(root, 'backend/.env'), quiet: true });
const configured = process.env.SQLSERVER_URL;
const url = process.env.TEST_SQLSERVER_URL || (process.env.RUN_SQL_TESTS === 'true' && configured
  ? configured.replace(/database=[^;]+/i, 'database=NexoSalud_LeadEnsayoFinal') : configured);
if (url?.match(/(?:^|;)database=([^;]+)/i)?.[1] !== 'NexoSalud_LeadEnsayoFinal') throw Error('Destino configurado incorrecto.');
const output = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !output.startsWith(__dirname + path.sep) || fs.existsSync(output)) throw Error('Se requiere archivo nuevo dentro de QA.');
const baseline = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
const { PrismaClient } = req('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url } }, log: [] });
const quote = value => '[' + value.replaceAll(']', ']]') + ']';
async function select(sql) {
  if (!/^\s*SELECT\b/i.test(sql)) throw Error('Solo se admiten SELECT.');
  return p.$queryRawUnsafe(sql);
}
(async () => {
  try {
    const [identity] = await select("SELECT CAST(@@SERVERNAME AS nvarchar(128)) servidor,DB_NAME() base,SYSUTCDATETIME() fecha_utc");
    if (identity.servidor !== 'DANIELPC' || identity.base !== 'NexoSalud_LeadEnsayoFinal') throw Error('Destino efectivo incorrecto.');
    const active = await select(`SELECT session_id,status,command FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID`);
    const transactions = await select(`SELECT s.session_id FROM sys.dm_tran_database_transactions d JOIN sys.dm_tran_session_transactions s ON s.transaction_id=d.transaction_id WHERE d.database_id=DB_ID() AND s.session_id<>@@SPID`);
    if (active.length || transactions.length) throw Error('Otros escritores potenciales en QA.');
    const columns = await select(`SELECT s.name esquema,t.name tabla,c.name columna,c.column_id,ty.name tipo,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed
      FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id
      JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE t.is_ms_shipped=0 ORDER BY s.name,t.name,c.column_id`);
    const keys = await select(`SELECT s.name esquema,t.name tabla,c.name columna,ic.key_ordinal FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
      JOIN sys.indexes i ON i.object_id=t.object_id AND i.is_primary_key=1 JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
      JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.key_ordinal>0 AND t.is_ms_shipped=0 ORDER BY s.name,t.name,ic.key_ordinal`);
    const objects = await select(`SELECT o.object_id,s.name esquema,o.name,o.type,o.parent_object_id,o.create_date,o.modify_date,
      CONVERT(varchar(64),HASHBYTES('SHA2_256',m.definition),2) definition_sha256 FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id
      LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id WHERE o.is_ms_shipped=0 ORDER BY s.name,o.object_id`);
    const indexes = await select(`SELECT s.name esquema,t.name tabla,i.index_id,i.name,i.type,i.is_unique,i.is_primary_key,i.is_unique_constraint,i.is_disabled,i.filter_definition,
      c.name columna,ic.key_ordinal,ic.is_descending_key,ic.is_included_column FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
      JOIN sys.indexes i ON i.object_id=t.object_id LEFT JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
      LEFT JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE t.is_ms_shipped=0 ORDER BY s.name,t.name,i.index_id,ic.index_column_id`);
    const constraints = await select(`SELECT s.name esquema,o.name,o.type,t.name tabla,
      COALESCE(ck.definition,dc.definition) definicion,ck.is_disabled,ck.is_not_trusted FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id
      JOIN sys.tables t ON t.object_id=o.parent_object_id LEFT JOIN sys.check_constraints ck ON ck.object_id=o.object_id
      LEFT JOIN sys.default_constraints dc ON dc.object_id=o.object_id WHERE o.is_ms_shipped=0 AND o.type IN ('C','D','PK','UQ') ORDER BY s.name,o.name`);
    const foreignKeys = await select(`SELECT s.name esquema,f.name,t.name tabla,c.name columna,rs.name esquema_ref,rt.name tabla_ref,rc.name columna_ref,
      f.is_disabled,f.is_not_trusted,f.delete_referential_action,f.update_referential_action FROM sys.foreign_keys f JOIN sys.schemas s ON s.schema_id=f.schema_id
      JOIN sys.tables t ON t.object_id=f.parent_object_id JOIN sys.foreign_key_columns fc ON fc.constraint_object_id=f.object_id
      JOIN sys.columns c ON c.object_id=fc.parent_object_id AND c.column_id=fc.parent_column_id JOIN sys.tables rt ON rt.object_id=f.referenced_object_id
      JOIN sys.schemas rs ON rs.schema_id=rt.schema_id JOIN sys.columns rc ON rc.object_id=fc.referenced_object_id AND rc.column_id=fc.referenced_column_id
      ORDER BY s.name,f.name,fc.constraint_column_id`);
    const tables = [];
    for (const name of [...new Set(columns.map(c => c.esquema + '.' + c.tabla))]) {
      const cols = columns.filter(c => c.esquema + '.' + c.tabla === name);
      const { esquema, tabla } = cols[0];
      const tableKeys = keys.filter(k => k.esquema === esquema && k.tabla === tabla);
      if (!tableKeys.length) throw Error('Tabla sin PK: no se puede garantizar orden estable.');
      const reference = baseline?.tables.find(t => t.name === name);
      const originalColumns = reference?.originalColumns || cols.map(c => c.columna);
      const full = quote(esquema) + '.' + quote(tabla);
      const order = tableKeys.map(k => quote(k.columna)).join(',');
      const hash = names => `CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT ${names.map(quote).join(',')} FROM ${full} ORDER BY ${order} FOR JSON PATH,INCLUDE_NULL_VALUES)),2)`;
      const [row] = await select(`SELECT (SELECT COUNT_BIG(*) FROM ${full}) cantidad,${hash(cols.map(c => c.columna))} contenido_sha256,${hash(originalColumns)} original_sha256`);
      tables.push({ name, originalColumns, ...row });
    }
    const result = { identity, active, transactions, serialization: 'FOR JSON PATH, INCLUDE_NULL_VALUES; ORDER BY PK; SHA2_256 de NVARCHAR; no compara paginas fisicas', tables,
      catalog: { objects, columns, keys, indexes, constraints, foreignKeys } };
    fs.writeFileSync(output, JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2), { flag: 'wx' });
    console.log(JSON.stringify({ output: path.relative(root, output), tables: tables.length, objects: objects.length, activeRequestsOtherThanCapture: active.length, otherTransactions: transactions.length }));
  } catch (error) {
    console.error(JSON.stringify({ failure: error.code || error.name, detail: error.meta?.code || (!error.code ? error.message : undefined) }));
    process.exitCode = 1;
  } finally { await p.$disconnect(); }
})();
