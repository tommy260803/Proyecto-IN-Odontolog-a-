// Utilidades QA. No sustituye Prisma, SQL, rutas ni el evaluador.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const backendRequire = createRequire(path.join(root, 'backend/package.json'));
const stringify = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const sourceFiles = ['backend/src/db.ts', 'backend/prisma/schema.prisma', 'backend/src/routes/buyer.routes.ts',
  'backend/src/services/buyerEvaluationService.ts', 'backend/src/services/buyerMessageClassifier.ts',
  'backend/src/services/leadIntake.ts', 'backend/src/services/martSyncService.ts', 'backend/src/types/buyer.ts'];
function sourceHashes() { return Object.fromEntries(sourceFiles.map(f => [f, hash(fs.readFileSync(path.join(root, f)))])); }
function prepare() {
  backendRequire('dotenv').config({ path: path.join(root, 'backend/.env'), quiet: true });
  const base = process.env.SQLSERVER_URL;
  const source = process.env.TEST_SQLSERVER_URL ? 'TEST_SQLSERVER_URL' : 'SQLSERVER_URL';
  const resolved = process.env.TEST_SQLSERVER_URL || (process.env.RUN_SQL_TESTS === 'true' && base
    ? base.replace(/database=[^;]+/i, 'database=NexoSalud_LeadEnsayoFinal') : base);
  if (resolved?.match(/(?:^|;)database=([^;]+)/i)?.[1] !== 'NexoSalud_LeadEnsayoFinal') throw Error('QA_DESTINATION_CONFIG_BLOCKED');
  // Solo afectan este proceso de pruebas. No se edita ningun archivo de entorno.
  process.env.TEST_SQLSERVER_URL = resolved;
  process.env.QA_ENV = 'true';
  process.env.RUN_SQL_TESTS = 'true';
  process.env.RUN_LIVE_GEMINI_TESTS = 'false';
  process.env.DISABLE_MART_SYNC = 'true';
  process.env.ENABLE_MART_SYNC = 'false';
  process.env.DUNNING_ENABLED = 'false';
  const realKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'QA_NO_KEY';
  process.env.DOTENV_CONFIG_QUIET = 'true';
  const runId = process.env.QA_BUYER_RUN_ID || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z') + '_' + crypto.randomBytes(3).toString('hex');
  if (!/^[0-9TZ_a-f]{12,32}$/.test(runId)) throw Error('QA_RUN_ID_INVALID');
  const prefix = 'QA_BBE_' + runId + '_';
  const output = path.join(__dirname, 'ejecucion_' + runId);
  fs.mkdirSync(output, { recursive: true });
  if (fs.existsSync(path.join(output, 'RESULTADOS.json'))) throw Error('QA_RUN_ALREADY_EXISTS');
  const save = (name, value) => fs.writeFileSync(path.join(output, name), stringify(value), { flag: 'wx' });
  const scrub = text => {
    let safe = String(text);
    for (const secret of [realKey, resolved, process.env.OLTP_CONNECTION_STRING, process.env.MART_CONNECTION_STRING].filter(Boolean)) safe = safe.split(secret).join('[REDACTADO]');
    return safe.replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTADO]').replace(/((?:password|pwd)=)[^;\s]+/gi, '$1[REDACTADO]');
  };
  const errorInfo = error => ({ name: error?.name, code: error?.code, message: scrub(error?.message || error),
    meta: error?.meta && JSON.parse(JSON.stringify(error.meta)) });
  return { root, backendRequire, source, prefix, runId, output, save, scrub, errorInfo,
    version: { branch: cp.execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim(),
      HEAD: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceHashes: sourceHashes() } };
}
module.exports = { prepare, stringify, sourceHashes };
