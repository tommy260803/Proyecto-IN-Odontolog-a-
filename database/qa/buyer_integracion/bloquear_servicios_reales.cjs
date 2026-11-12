// Preload exclusivo de validacion local. No modifica archivos .env ni inicia servicios.
// Aplicar tambien a los workers mediante NODE_OPTIONS=--require=<ruta de este archivo>.
const net = require('node:net');
const blockedSql = 'sqlserver://127.0.0.1:1;database=QA_OFFLINE_BLOCKED;integratedSecurity=true;trustServerCertificate=true;';
Object.assign(process.env, {
  RUN_SQL_TESTS: 'false', RUN_LIVE_GEMINI_TESTS: 'false', QA_ENV: 'true',
  DISABLE_MART_SYNC: 'true', ENABLE_MART_SYNC: 'false', DUNNING_ENABLED: 'false',
  SQLSERVER_URL: blockedSql, TEST_SQLSERVER_URL: blockedSql,
  OLTP_CONNECTION_STRING: 'QA_OFFLINE_BLOCKED', MART_CONNECTION_STRING: 'QA_OFFLINE_BLOCKED',
  GEMINI_API_KEY: 'QA_OFFLINE_NO_REAL_KEY', DOTENV_CONFIG_QUIET: 'true',
});
const allowed = (host, port) => ['127.0.0.1','::1','localhost'].includes(String(host || 'localhost'))
  && Number(port) >= 1024 && ![1433,1434,3306,5432,6379,27017].includes(Number(port));
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const first = normalized[0];
  const options = first && typeof first === 'object' ? first : { port: first, host: typeof normalized[1] === 'string' ? normalized[1] : 'localhost' };
  if (!options.path && !allowed(options.host, options.port)) throw Error('QA_OFFLINE_TCP_BLOCKED');
  return connect.apply(this, args);
};
const originalFetch = global.fetch;
if (originalFetch) global.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url || String(input));
  if (!['http:','https:'].includes(url.protocol) || !allowed(url.hostname.replace(/^\[|\]$/g,''), url.port || (url.protocol === 'https:' ? 443 : 80))) {
    throw Error('QA_OFFLINE_HTTP_BLOCKED');
  }
  return originalFetch(input, init);
};
