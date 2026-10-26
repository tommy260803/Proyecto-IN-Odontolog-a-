import sqlDefault, { ConnectionPool } from 'mssql';
import dotenv from 'dotenv';
import { prisma } from '../db';

dotenv.config();

const sql = sqlDefault;

export async function queryMart<T = any>(queryText: string, params?: Record<string, any>): Promise<T[]> {
  let sqlStatement = queryText;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const valStr = typeof value === 'number' ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
      sqlStatement = sqlStatement.replace(new RegExp(`@${key}\\b`, 'g'), valStr);
    }
  }
  const martDb = process.env.MART_DATABASE || 'NexoSalud_Mart';
  const oltpDb = process.env.OLTP_DATABASE || 'NexoSaludDB';
  try {
    const fullSql = `USE [${martDb}]; ${sqlStatement}`;
    const result = await prisma.$queryRawUnsafe(fullSql);
    return result as T[];
  } finally {
    await prisma.$queryRawUnsafe(`USE [${oltpDb}];`).catch(() => {});
  }
}

export async function queryOltp<T = any>(queryText: string, params?: Record<string, any>): Promise<T[]> {
  let sqlStatement = queryText;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const valStr = typeof value === 'number' ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
      sqlStatement = sqlStatement.replace(new RegExp(`@${key}\\b`, 'g'), valStr);
    }
  }
  const oltpDb = process.env.OLTP_DATABASE || 'NexoSaludDB';
  const fullSql = `USE [${oltpDb}]; ${sqlStatement}`;
  const result = await prisma.$queryRawUnsafe(fullSql);
  return result as T[];
}

const baseDbConfig = {
  user: process.env.DB_USER || 'nexouser',
  password: process.env.DB_PASSWORD || 'NexoSalud2026!',
  server: process.env.DB_SERVER || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: { encrypt: false, trustServerCertificate: true, requestTimeout: 60000 }
};

let martPoolPromise: Promise<ConnectionPool> | null = null;
export async function getMartPool(): Promise<ConnectionPool> {
  if (!martPoolPromise) {
    const martPool = new sql.ConnectionPool({
      ...baseDbConfig,
      database: process.env.MART_DATABASE || 'NexoSalud_Mart'
    });
    martPoolPromise = martPool.connect().catch((err) => {
      martPoolPromise = null;
      throw err;
    });
  }
  return martPoolPromise;
}

let oltpPoolPromise: Promise<ConnectionPool> | null = null;
export async function getOltpPool(): Promise<ConnectionPool> {
  if (!oltpPoolPromise) {
    const oltpPool = new sql.ConnectionPool({
      ...baseDbConfig,
      database: process.env.OLTP_DATABASE || 'NexoSaludDB'
    });
    oltpPoolPromise = oltpPool.connect().catch((err) => {
      oltpPoolPromise = null;
      throw err;
    });
  }
  return oltpPoolPromise;
}

export { sql as martSql };
