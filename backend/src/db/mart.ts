import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

function getDbConfig(isMart: boolean): sql.config | string {
  const envUrl = isMart ? process.env.MART_CONNECTION_STRING : (process.env.OLTP_CONNECTION_STRING || process.env.SQLSERVER_URL);
  if (envUrl && (envUrl.startsWith('sqlserver://') || envUrl.startsWith('mssql://') || envUrl.includes('Server='))) {
    return envUrl;
  }
  return {
    server: process.env.DB_SERVER || 'localhost',
    database: isMart ? (process.env.MART_DATABASE || 'NexoSalud_Mart') : (process.env.DB_DATABASE || 'NexoSaludDB'),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'yourStrong(!)Password',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    }
  };
}

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getMartPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const config = getDbConfig(true);
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

let oltpPoolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getOltpPool(): Promise<sql.ConnectionPool> {
  if (!oltpPoolPromise) {
    const config = getDbConfig(false);
    const pool = new sql.ConnectionPool(config);
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
