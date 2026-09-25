import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.MART_CONNECTION_STRING ||
  'Server=localhost;Database=NexoSalud_Mart;Trusted_Connection=yes;TrustServerCertificate=yes;';

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getMartPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(connectionString);

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
  'Server=localhost;Database=NexoSaludDB;Trusted_Connection=yes;TrustServerCertificate=yes;';

let oltpPoolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getOltpPool(): Promise<sql.ConnectionPool> {
  if (!oltpPoolPromise) {
    const pool = new sql.ConnectionPool(oltpConnectionString);
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
