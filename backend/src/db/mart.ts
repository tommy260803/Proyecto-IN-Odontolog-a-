import sqlDefault, { ConnectionPool } from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

let sql: typeof sqlDefault;
try {
  // Permite autenticación de Windows en entornos locales con ODBC
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sql = require('mssql/msnodesqlv8');
} catch {
  // Fallback seguro a mssql estándar en entornos Linux / Render
  sql = sqlDefault;
}

const connectionString =
  process.env.MART_CONNECTION_STRING ||
  'Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSalud_Mart;Trusted_Connection=yes;TrustServerCertificate=yes;';

let poolPromise: Promise<ConnectionPool> | null = null;

export async function getMartPool(): Promise<ConnectionPool> {
  if (!poolPromise) {
    const config: any = {
      connectionString,
    };
    const pool = new sql.ConnectionPool(config);

    poolPromise = pool.connect().then((connectedPool) => {
      console.log('✅ [NexoSalud_Mart] Conexión establecida exitosamente al DataMart (sin Prisma).');
      return connectedPool;
    }).catch((err) => {
      console.error('❌ [NexoSalud_Mart] Error conectando a NexoSalud_Mart:', err.message);
      poolPromise = null;
      throw err;
    });
  }

  return poolPromise;
}

export async function queryMart<T = any>(queryText: string, params?: Record<string, any>): Promise<T[]> {
  const pool = await getMartPool();
  const request = pool.request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }
  const result = await request.query(queryText);
  return result.recordset as T[];
}

const oltpConnectionString =
  process.env.OLTP_CONNECTION_STRING ||
  'Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSaludDB;Trusted_Connection=yes;TrustServerCertificate=yes;';

let oltpPoolPromise: Promise<ConnectionPool> | null = null;

export async function getOltpPool(): Promise<ConnectionPool> {
  if (!oltpPoolPromise) {
    const pool = new sql.ConnectionPool({ connectionString: oltpConnectionString } as any);
    oltpPoolPromise = pool.connect().then((connectedPool) => {
      console.log('✅ [NexoSaludDB] Conexión establecida exitosamente a la BD Transaccional.');
      return connectedPool;
    }).catch((err) => {
      console.error('❌ [NexoSaludDB] Error conectando a NexoSaludDB:', err.message);
      oltpPoolPromise = null;
      throw err;
    });
  }
  return oltpPoolPromise;
}

export async function queryOltp<T = any>(queryText: string, params?: Record<string, any>): Promise<T[]> {
  const pool = await getOltpPool();
  const request = pool.request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }
  const result = await request.query(queryText);
  return result.recordset as T[];
}

export { sql as martSql };
