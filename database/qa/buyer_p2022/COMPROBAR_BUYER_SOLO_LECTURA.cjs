/* Sonda QA: monta exclusivamente buyer.routes, sin index.ts ni recuperadores.
 * No cambia el agente ni sus pruebas. No muestra cuerpos de pacientes o secretos.
 * Desde la raiz: node database/qa/buyer_p2022/COMPROBAR_BUYER_SOLO_LECTURA.cjs
 */
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const backendRequire = createRequire(path.join(root, 'backend/package.json'));
backendRequire('dotenv').config({ path: path.join(root, 'backend/.env'), quiet: true });
const base = process.env.SQLSERVER_URL;
const resolved = process.env.TEST_SQLSERVER_URL || (
  process.env.RUN_SQL_TESTS === 'true' && base
    ? base.replace(/database=[^;]+/i, 'database=NexoSalud_LeadEnsayoFinal') : base
);
if (resolved?.match(/(?:^|;)database=([^;]+)/i)?.[1] !== 'NexoSalud_LeadEnsayoFinal') {
  console.error('Destino configurado incorrecto: conexion bloqueada antes de crear Prisma.');
  process.exit(2);
}
const source = process.env.TEST_SQLSERVER_URL ? 'TEST_SQLSERVER_URL'
  : process.env.RUN_SQL_TESTS === 'true' ? 'SQLSERVER_URL con RUN_SQL_TESTS' : 'SQLSERVER_URL';
const savedLog = console.log.bind(console);
const captured = [];
function capture(...args) {
  for (const value of args) {
    if (value && typeof value === 'object' && value.code) {
      captured.push({ code: value.code, model: value.meta?.modelName });
    } else if (typeof value === 'string') {
      for (const match of value.matchAll(/(?:columna|column) '([^']+)'/gi)) {
        captured.push({ invalidColumn: match[1] });
      }
    }
  }
}
console.log = capture;
console.warn = capture;
console.error = capture;
process.env.DOTENV_CONFIG_QUIET = 'true';
backendRequire('tsx/cjs');
const { prisma } = backendRequire('./src/db.ts');

// Defensa adicional: bloquear operaciones Prisma de escritura, incluso si cambia la ruta.
const reads = new Set(['findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
prisma.$use(async (params, next) => {
  if (!reads.has(params.action)) {
    const rawArg = params.args?.query ?? params.args?.[0];
    const raw = typeof rawArg === 'string' ? rawArg
      : Array.isArray(rawArg) && rawArg.every(part => typeof part === 'string') ? rawArg.join('?') : rawArg?.sql;
    if (params.action !== 'queryRaw' || typeof raw !== 'string'
      || !/^\s*SELECT\b/i.test(raw) || /\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|EXEC(?:UTE)?)\b/i.test(raw)) {
      throw Object.assign(new Error('Operacion bloqueada por sonda de solo lectura.'), { code: 'QA_WRITE_BLOCKED' });
    }
  }
  return next(params);
});

(async () => {
  let server;
  try {
    const [identity] = await prisma.$queryRawUnsafe(
      "SELECT CAST(@@SERVERNAME AS nvarchar(128)) servidor, DB_NAME() base, SYSUTCDATETIME() fecha_utc"
    );
    if (identity.servidor !== 'DANIELPC' || identity.base !== 'NexoSalud_LeadEnsayoFinal') {
      throw Object.assign(new Error('Destino efectivo incorrecto.'), { code: 'QA_DESTINATION_BLOCKED' });
    }
    const app = backendRequire('express')();
    app.use('/api/buyer', backendRequire('./src/routes/buyer.routes.ts').default);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const url = `http://127.0.0.1:${server.address().port}`;
    const endpoints = [];
    const person = await prisma.personas.findFirst({ select: { id_persona: true }, orderBy: { id_persona: 'asc' } });
    if (!person) {
      endpoints.push({ route: '/api/buyer/:id_existente', status: null,
        result: 'INCOMPLETO_SIN_PERSONA', responseError: 'Ficha no ejecutada: no existe una persona para comprobarla.' });
    }
    for (const suffix of ['/api/buyer?page=1&pageSize=25', ...(person ? [`/api/buyer/${person.id_persona}`] : [])]) {
      const offset = captured.length;
      const response = await fetch(url + suffix, { signal: AbortSignal.timeout(30000) });
      const body = await response.json();
      endpoints.push({ route: suffix.replace(/\/\d+$/, '/:id_existente'), status: response.status,
        responseError: typeof body.error === 'string' ? body.error : null, captured: captured.slice(offset) });
    }
    const models = [];
    for (const model of ['solicitudes', 'opciones', 'promocionesLead', 'motivosRechazoLead', 'propuestasEconomicasLead', 'cambiosOpcionLead']) {
      try {
        await prisma[model].findMany({ take: 1 });
        models.push({ model, result: 'LECTURA_OK' });
      } catch (error) {
        models.push({ model, result: error.code || error.name });
      }
    }
    const complete = Boolean(person) && endpoints.length === 2;
    savedLog(JSON.stringify({ source, identity, complete, endpoints, models }, null, 2));
    if (!complete || endpoints.some(e => e.status !== 200) || models.some(m => m.result !== 'LECTURA_OK')
      || captured.some(e => e.code === 'QA_WRITE_BLOCKED')) process.exitCode = 1;
  } catch (error) {
    savedLog(JSON.stringify({ failure: error.code || error.name }));
    process.exitCode = 2;
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
})();
