const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { sourceHashes, stringify } = require('../buyer_backend/entorno_qa.cjs');
const root = path.resolve(__dirname, '../../..');
const backendRequire = createRequire(path.join(root, 'backend/package.json'));
function prepare() {
  backendRequire('dotenv').config({ path: path.join(root, 'backend/.env'), quiet: true });
  const source = process.env.TEST_SQLSERVER_URL ? 'TEST_SQLSERVER_URL' : 'SQLSERVER_URL';
  const base = process.env.SQLSERVER_URL;
  const resolved = process.env.TEST_SQLSERVER_URL || (process.env.RUN_SQL_TESTS === 'true' && base
    ? base.replace(/database=[^;]+/i, 'database=NexoSalud_LeadEnsayoFinal') : base);
  if (resolved?.match(/(?:^|;)database=([^;]+)/i)?.[1] !== 'NexoSalud_LeadEnsayoFinal') throw Error('QA_DESTINATION_CONFIG_BLOCKED');
  const secrets = [resolved, process.env.GEMINI_API_KEY, process.env.OLTP_CONNECTION_STRING, process.env.MART_CONNECTION_STRING].filter(Boolean);
  Object.assign(process.env, { TEST_SQLSERVER_URL: resolved, QA_ENV: 'true', RUN_SQL_TESTS: 'true',
    RUN_LIVE_GEMINI_TESTS: 'false', DISABLE_MART_SYNC: 'true', ENABLE_MART_SYNC: 'false', DUNNING_ENABLED: 'false',
    GEMINI_API_KEY: 'QA_NO_KEY', DOTENV_CONFIG_QUIET: 'true' });
  const runId = process.env.QA_BUYER_FAILURE_RUN_ID || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z') + '_' + crypto.randomBytes(3).toString('hex');
  if (!/^[0-9TZ_a-f]{12,32}$/.test(runId)) throw Error('QA_RUN_ID_INVALID');
  const prefix = 'QA_BFC_' + runId + '_';
  const output = path.join(__dirname, 'ejecucion_' + runId);
  fs.mkdirSync(output, { recursive: true });
  if (fs.existsSync(path.join(output, 'RESULTADOS.json'))) throw Error('QA_RUN_ALREADY_EXISTS');
  const scrub = value => {
    let text = String(value);
    for (const secret of secrets) text = text.split(secret).join('[REDACTADO]');
    return text.replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTADO]').replace(/((?:password|pwd)=)[^;\s]+/gi, '$1[REDACTADO]');
  };
  const errorInfo = error => ({ name: error?.name, code: error?.code, message: scrub(error?.message || error),
    meta: error?.meta && JSON.parse(scrub(JSON.stringify(error.meta))) });
  const hash = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex').toUpperCase();
  const reusedFiles = ['database/qa/buyer_backend/entorno_qa.cjs', 'database/qa/buyer_backend/consultas_qa.cjs'];
  return { root, backendRequire, source, prefix, runId, output, scrub, errorInfo,
    save: (name, value) => fs.writeFileSync(path.join(output, name), stringify(value), { flag: 'wx' }),
    version: { branch: cp.execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim(),
      HEAD: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      sourceHashes: sourceHashes(), reusedHarnessHashes: Object.fromEntries(reusedFiles.map(f => [f, hash(f)])) } };
}
module.exports = { prepare, sourceHashes, stringify };
