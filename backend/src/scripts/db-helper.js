const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

function getConfig(dbName) {
  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '1433'),
    database: dbName || process.env.OLTP_DATABASE,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true
    }
  };
}

async function executeSql(queryText, dbName = 'NexoSaludDB') {
  const pool = await sql.connect(getConfig(dbName));
  try {
    const result = await pool.request().query(queryText);
    return result.recordset || result.rowsAffected;
  } finally {
    await pool.close();
  }
}

async function executeBatch(sqlContent, dbName = 'NexoSaludDB') {
  const pool = await sql.connect(getConfig(dbName));
  try {
    const batches = sqlContent.split(/^\s*GO\s*$/mi);
    for (const batch of batches) {
      const trimmed = batch.trim();
      if (trimmed) {
        await pool.request().batch(trimmed);
      }
    }
  } finally {
    await pool.close();
  }
}

module.exports = { executeSql, executeBatch };
