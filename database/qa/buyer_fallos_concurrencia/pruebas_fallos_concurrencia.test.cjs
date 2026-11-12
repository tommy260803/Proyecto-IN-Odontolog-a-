const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { performance } = require('node:perf_hooks');
const { AsyncLocalStorage } = require('node:async_hooks');
const { prepare, sourceHashes, stringify } = require('./entorno_fallos.cjs');
const { install } = require('./gemini_fallos_controlados.cjs');
const { inspect, subject, snapshot } = require('../buyer_backend/consultas_qa.cjs');

function barrier(count, timeoutMs) {
  let release, reject, timer;
  const promise = new Promise((resolve, fail) => { release = resolve; reject = fail; });
  const arrivals = [];
  return { arrivals, arrive(label) {
    if (!timer) timer = setTimeout(() => reject(Error('QA_HARNESS_BARRIER_TIMEOUT')), timeoutMs);
    arrivals.push({ label, ms: performance.now(), utc: new Date().toISOString() });
    if (arrivals.length === count) { clearTimeout(timer); release(); }
    return promise;
  } };
}

test('Buyer QA fallos y concurrencia: SQL real y solo Gemini controlado', { timeout: 120000 }, async t => {
  const env = prepare(), storage = new AsyncLocalStorage();
  const originalConsole = { log: console.log, warn: console.warn, error: console.error };
  const originalFetch = global.fetch;
  const result = { version: env.version, prefix: env.prefix, connectionSourceBeforePin: env.source,
    startedUtc: new Date().toISOString(), cases: [], http: [], ingress: [], sqlCalls: [], idempotencyReads: [],
    modelWrites: [], prismaErrors: [], externalHttpBlocked: [], logs: [] };
  const captureLog = (...args) => result.logs.push(args.map(v => env.scrub(v instanceof Error ? v.message : typeof v === 'string' ? v : stringify(v))).join(' '));
  Object.assign(console, { log: captureLog, warn: captureLog, error: captureLog });
  const fixtures = Object.fromEntries(['AB','C'].map(code => [code, { name: env.prefix + code,
    email: (env.prefix + code).toLowerCase() + '@example.invalid', key: (env.prefix + code).toLowerCase() }]));
  const ingressGate = barrier(2, 8000);
  let db, controlled, server, baseUrl, phase = 'setup', ctx = {};
  const load = code => subject(db, fixtures[code].email);
  const body = (code, message, service) => ({ nombres: fixtures[code].name, apellidos: 'QA SINTETICO',
    email: fixtures[code].email, autoriza_contacto: true, mensaje: message, ...(service ? { id_servicio: service.id_servicio } : {}) });
  async function request(label, route, data, key) {
    const item = { label, route, requestBody: data, idempotencyKey: key, startedMs: performance.now(), startedUtc: new Date().toISOString() };
    result.http.push(item);
    try {
      const response = await global.fetch(baseUrl + route, { method: 'POST', headers: { 'Content-Type': 'application/json',
        'X-QA-Request': label, ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(data), signal: AbortSignal.timeout(45000) });
      item.status = response.status; item.responseBody = await response.json(); return item;
    } catch (error) { item.error = env.errorInfo(error); throw error; }
    finally { item.finishedMs = performance.now(); item.finishedUtc = new Date().toISOString(); }
  }
  const check = (checks, name, actual, expected) => checks.push({ name, actual, expected, passed: JSON.stringify(actual) === JSON.stringify(expected) });
  const runCase = async (code, fn) => {
    phase = code;
    const item = { code, startedUtc: new Date().toISOString(), checks: [] };
    result.cases.push(item);
    try { await fn(item); assert.deepEqual(item.checks.filter(x => !x.passed), [], 'Incumplimientos del contrato; conservar evidencia'); item.result = 'APROBADO'; }
    catch (error) { item.result = 'FALLO'; item.error = env.errorInfo(error); throw error; }
    finally {
      try { item.persisted = await load(code === 'C' ? 'C' : 'AB'); } catch (error) { item.snapshotError = env.errorInfo(error); }
      item.finishedUtc = new Date().toISOString(); env.save('CASO_' + code + '.json', item);
    }
  };
  try {
    env.backendRequire('tsx/cjs');
    ({ prisma: db } = env.backendRequire('./src/db.ts'));
    db.$use(async (params, next) => {
      const startedMs = performance.now(), label = storage.getStore()?.label || phase;
      const isKeyRead = params.model === 'DecisionesIA' && params.action === 'findFirst'
        && params.args?.where?.entrada?.contains?.includes(fixtures.C.key);
      if (params.action === 'queryRaw' || params.action === 'executeRaw') {
        const arg = params.args?.[0] ?? params.args?.query ?? params.args;
        const sql = typeof arg === 'string' ? arg : Array.isArray(arg) ? arg.join('?') : arg?.sql || '';
        if (/\bEXEC\s+dbo\.usp_(?:ConvertirBuyerALead|RegistrarEntradaAgenteLead)/i.test(sql)) result.sqlCalls.push({ label, startedMs, sqlTemplate: sql.trim(), persistence: 'REAL_SQL_SERVER' });
      } else if (/^(create|update|delete|upsert)/.test(params.action)) result.modelWrites.push({ label, startedMs, model: params.model, action: params.action });
      try {
        const value = await next(params); // Observacion; no barreras ni resultados fabricados en Prisma.
        if (isKeyRead) result.idempotencyReads.push({ label, startedMs, finishedMs: performance.now(), id_decision: value?.id_decision ?? null });
        return value;
      } catch (error) { result.prismaErrors.push({ label, model: params.model, action: params.action, error: env.errorInfo(error) }); throw error; }
    });
    result.inspectionBefore = await inspect(db);
    const [existing] = await db.$queryRaw`SELECT COUNT(*) cantidad FROM dbo.Personas WHERE LEFT(nombres,LEN(${env.prefix}))=${env.prefix}`;
    assert.equal(existing.cantidad, 0, 'No reutilizar sujetos ni prefijos');
    result.before = await snapshot(db, env.prefix);
    env.save('ESTADO_ANTES.json', { inspection: result.inspectionBefore, snapshot: result.before, version: env.version });
    controlled = install(env.backendRequire, env.prefix);
    global.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url || String(input));
      if (!baseUrl || url.origin !== baseUrl) { result.externalHttpBlocked.push({ host: url.hostname }); throw Error('QA_EXTERNAL_HTTP_BLOCKED'); }
      return originalFetch(input, init);
    };
    const { MartSyncService } = env.backendRequire('./src/services/martSyncService.ts');
    assert.equal(MartSyncService.isSyncEnabled(), false);
    const express = env.backendRequire('express'), app = express(); app.use(express.json());
    app.use(async (req, res, next) => {
      const label = req.get('X-QA-Request');
      if (req.method !== 'POST' || !/^\/api\/buyer(?:\/register|\/evaluations\/\d+\/retry)$/.test(req.path)
        || !['A','B','C1','C2'].includes(label)) return res.status(403).json({ error: 'Fuera del bloque QA' });
      const trace = { label, receivedMs: performance.now(), receivedUtc: new Date().toISOString() };
      result.ingress.push(trace);
      res.on('finish', () => { trace.finishedMs = performance.now(); trace.finishedUtc = new Date().toISOString(); trace.status = res.statusCode; });
      try {
        if (label.startsWith('C')) { await ingressGate.arrive(label); trace.gateReleasedMs = performance.now(); }
        storage.run({ label }, () => { trace.routerEnteredMs = performance.now(); next(); });
      } catch (error) { trace.harnessError = env.errorInfo(error); res.status(599).json({ error: error.message }); }
    });
    app.use('/api/buyer', env.backendRequire('./src/routes/buyer.routes.ts').default);
    assert(!Object.keys(require.cache).some(f => /backend[\\/]src[\\/]index\.ts$|dunningScheduler\.ts$/.test(f)));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); baseUrl = 'http://127.0.0.1:' + server.address().port;
    result.isolation = { generalIndexLoaded: false, dunningLoaded: false, martEnabled: false, autoRecoveryInvoked: false,
      realRouter: true, realClassifierEvaluatorPrisma: true, simulatedBoundary: 'GoogleGenAI.models.generateContent' };
    const service = result.inspectionBefore.service;
    const messageAB = env.prefix + 'AB Solo deseo información sobre el precio de la evaluación odontológica.';

    await t.test('A: fallo transitorio Gemini agotado, mensaje durable y evaluacion pendiente sin conversion', () => runCase('A', async item => {
      controlled.fail(messageAB);
      const start = controlled.calls.length;
      item.response = await request('A', '/api/buyer/register', body('AB', messageAB), fixtures.AB.key);
      const state = await load('AB'); item.stateAfterFailure = state;
      ctx.a = { state, response: item.response };
      const d = state?.decisions[0], json = d && JSON.parse(d.decision);
      const checks = item.checks;
      check(checks, 'HTTP recuperable', item.response.status, 202);
      check(checks, 'Mensaje guardado una vez', state?.interactions.map(x => x.mensaje), [messageAB]);
      check(checks, 'Decision unica', state?.decisions.length, 1);
      check(checks, 'Etapa preservada', state?.person.Etapa.nombre, 'BUYER');
      check(checks, 'Sin filas comerciales', [state?.requests.length,state?.events.length,state?.intake.length], [0,0,0]);
      check(checks, 'SDK agotado segun contrato default', controlled.calls.length - start, 3);
      check(checks, 'Tres errores 503 simulados', controlled.calls.slice(start).map(x => x.error?.status), [503,503,503]);
      check(checks, 'Estado persistido recuperable', json?.estado, 'PENDIENTE');
      check(checks, 'Accion de retry', d?.accion, 'REINTENTO_PENDIENTE');
      check(checks, 'Revision pendiente', d?.requiere_revision, true);
      check(checks, 'Intentos persistidos acumulados', json?.intentosRealizados, 3);
      check(checks, 'Error e historial persistidos', Boolean(json?.error?.includes('QA_GEMINI_503') && json?.historial_errores?.length === 1 && json.historial_errores[0] === json.error), true);
      check(checks, 'Identidad HTTP y SQL coincide', [item.response.responseBody.data?.id_interaccion,item.response.responseBody.data?.id_decision], [state?.interactions[0]?.id_interaccion,d?.id_decision]);
    }));

    await t.test('B: retry explicito de la misma interaccion conserva identidad y acumula intentos e historial', () => runCase('B', async item => {
      assert(ctx.a?.state?.interactions.length === 1 && ctx.a.state.decisions.length === 1, 'Bloqueo: A no dejo una interaccion y decision identificables');
      const before = ctx.a.state, previous = JSON.parse(before.decisions[0].decision), start = controlled.calls.length;
      controlled.respond(messageAB, { intencion: 'SOLO_CONSULTA', id_servicio: null });
      item.response = await request('B', '/api/buyer/evaluations/' + before.interactions[0].id_interaccion + '/retry', {});
      const state = await load('AB'), json = JSON.parse(state.decisions.at(-1).decision), out = item.response.responseBody.data;
      item.stateBeforeRetry = before;
      const checks = item.checks;
      check(checks, 'HTTP retry', item.response.status, 200);
      check(checks, 'Misma interaccion y mismo mensaje', state.interactions.map(x => [x.id_interaccion,x.mensaje]), before.interactions.map(x => [x.id_interaccion,x.mensaje]));
      check(checks, 'Misma decision reutilizada', state.decisions.map(x => x.id_decision), before.decisions.map(x => x.id_decision));
      check(checks, 'Mismo fingerprint', json.contextFingerprint, previous.contextFingerprint);
      check(checks, 'Evaluacion completada SQL y HTTP', [json.estado,out?.estado], ['COMPLETADA','COMPLETADA']);
      check(checks, 'Accion persistida', state.decisions[0].accion, 'SOLO_CONSULTA');
      check(checks, 'Acumulacion tres fallos mas un exito', [json.intentosRealizados,json.intentos_realizados,out?.intentosRealizados], [4,4,4]);
      check(checks, 'Historial previo conservado', json.historial_errores, previous.historial_errores);
      check(checks, 'Historial visible HTTP', out?.historial_errores, previous.historial_errores);
      check(checks, 'SDK solo una llamada nueva', controlled.calls.length - start, 1);
      check(checks, 'Sin conversion y permanece BUYER', [state.requests.length,state.events.length,state.intake.length,state.person.Etapa.nombre], [0,0,0,'BUYER']);
      check(checks, 'Identidad HTTP', [out?.id_interaccion,out?.id_decision], [before.interactions[0].id_interaccion,before.decisions[0].id_decision]);
    }));

    await t.test('C: dos registros publicos simultaneos con misma Idempotency-Key y conversion real', () => runCase('C', async item => {
      const message = env.prefix + 'C Quiero reservar una cita para ' + service.nombre + '.';
      const data = body('C', message, service);
      // Retardo exclusivo de la respuesta externa simulada; no se bloquea ni sustituye SQL.
      controlled.respond(message, { intencion: 'SOLICITA_RESERVA', id_servicio: service.id_servicio }, 600);
      let releaseStart;
      const ready = [], start = new Promise(resolve => { releaseStart = resolve; });
      const tasks = ['C1','C2'].map(async label => { ready.push(label); await start; return request(label, '/api/buyer/register', data, fixtures.C.key); });
      assert.deepEqual(ready, ['C1','C2']);
      item.clientReleasedMs = performance.now(); releaseStart();
      const responses = await Promise.allSettled(tasks);
      item.responses = responses.map(x => x.status === 'fulfilled' ? { status: x.status, response: x.value } : { status: x.status, error: env.errorInfo(x.reason) });
      const state = await load('C'); item.state = state;
      const traces = result.ingress.filter(x => x.label.startsWith('C'));
      const clients = result.http.filter(x => x.label.startsWith('C'));
      item.concurrency = { gateArrivals: ingressGate.arrivals, traces,
        overlapServerMs: traces.length === 2 ? Math.min(...traces.map(x => x.finishedMs)) - Math.max(...traces.map(x => x.routerEnteredMs)) : null,
        overlapClientMs: clients.length === 2 ? Math.min(...clients.map(x => x.finishedMs)) - Math.max(...clients.map(x => x.startedMs)) : null,
        idempotencyReads: result.idempotencyReads };
      const checks = item.checks;
      check(checks, 'Dos respuestas HTTP recibidas', responses.map(x => x.status), ['fulfilled','fulfilled']);
      check(checks, 'Ambas peticiones entraron antes de finalizar alguna', item.concurrency.overlapServerMs > 0, true);
      check(checks, 'Solapamiento tambien en cliente', item.concurrency.overlapClientMs > 0, true);
      check(checks, 'Barrera antes del router con ambas recibidas', traces.length === 2 && traces.every(x => x.gateReleasedMs >= Math.max(...ingressGate.arrivals.map(a => a.ms))), true);
      check(checks, 'Sin bloqueo del arnes', traces.some(x => x.harnessError), false);
      check(checks, 'Ambos HTTP exitosos', clients.map(x => [200,201].includes(x.status)), [true,true]);
      const replayTrace = traces.find(x => x.status === 200);
      const classification = controlled.calls.find(x => x.message === message);
      check(checks, 'Replay responde antes de terminar Gemini; no espera bajo transaccion', Boolean(replayTrace && classification && replayTrace.finishedMs < classification.finishedMs), true);
      const [personCount] = await db.$queryRaw`SELECT COUNT(*) cantidad FROM dbo.Personas WHERE email=${fixtures.C.email}`;
      check(checks, 'Persona unica', personCount.cantidad, 1);
      check(checks, 'Captacion unica', state?.captures.length, 1);
      check(checks, 'Interaccion unica por clave', state?.interactions.length, 1);
      check(checks, 'Decision unica por clave', state?.decisions.length, 1);
      check(checks, 'Una solicitud evento y entrada', [state?.requests.length,state?.events.length,state?.intake.length], [1,1,1]);
      check(checks, 'Etapa LEAD', state?.person.Etapa.nombre, 'LEAD');
      const s = state?.requests[0], e = state?.events[0], a = state?.intake[0], c = state?.captures[0];
      check(checks, 'FK comerciales vinculadas', Boolean(s && e && a && c && e.id_persona === state.person.id_persona
        && e.id_captacion === c.id_captacion && e.id_solicitud === s.id_solicitud && a.id_persona === state.person.id_persona
        && a.id_captacion === c.id_captacion && a.id_evento_etapa === e.id_evento_etapa && a.id_solicitud === s.id_solicitud), true);
      check(checks, 'Identidad de interaccion devuelta igual', new Set(clients.map(x => x.responseBody?.data?.id_interaccion)).size, 1);
      check(checks, 'Interaccion persistida enlazada', state?.interactions.map(x => x.id_solicitud), [s?.id_solicitud]);
      check(checks, 'Entrega confirmada en decision', state?.decisions.map(x => JSON.parse(x.decision).entregaLeadEstado), ['CONFIRMADA']);
      const sdkBeforeReplay = controlled.calls.length;
      item.replay = await request('B', '/api/buyer/register', data, fixtures.C.key);
      check(checks, 'Replay conserva interaccion y decision', [item.replay.responseBody.data?.id_interaccion,item.replay.responseBody.data?.id_decision], [state?.interactions[0]?.id_interaccion,state?.decisions[0]?.id_decision]);
      item.conflict = await request('B', '/api/buyer/register', { ...data, mensaje: message + ' Contenido diferente.' }, fixtures.C.key);
      check(checks, 'Misma clave con contenido distinto rechazada', [item.conflict.status,item.conflict.responseBody.code], [409,'IDEMPOTENCY_CONFLICT']);
      check(checks, 'Replay y conflicto no vuelven a clasificar', controlled.calls.length, sdkBeforeReplay);
      check(checks, 'Replay y conflicto no cambian filas persistidas', await load('C'), state);
    }));
  } catch (error) { result.setupOrHarnessFailure = env.errorInfo(error); throw error; }
  finally {
    phase = 'teardown';
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    global.fetch = originalFetch;
    if (controlled) { result.geminiCalls = controlled.calls; controlled.restore(); }
    if (db) {
      try {
        result.after = await snapshot(db, env.prefix); result.inspectionAfter = await inspect(db);
        result.finalSubjects = { AB: await load('AB'), C: await load('C') };
        result.historicalComparison = result.before?.rows.map(row => {
          const after = result.after.rows.find(x => x.table === row.table);
          return { table: row.table, before: row.total, after: after.total, syntheticRows: after.sinteticos,
            outsidePrefixHashSame: row.sha256_fuera_prefijo === after.sha256_fuera_prefijo,
            countDeltaMatchesSynthetic: BigInt(after.total) - BigInt(row.total) === BigInt(after.sinteticos) };
        });
        if (result.historicalComparison) assert(result.historicalComparison.every(x => x.outsidePrefixHashSame && x.countDeltaMatchesSynthetic));
        if (result.before) assert.deepEqual(result.before.other, result.after.other);
        result.sourceHashesAfter = sourceHashes(); assert.deepEqual(result.sourceHashesAfter, env.version.sourceHashes);
        assert.equal(result.externalHttpBlocked.length, 0);
      } catch (error) { result.teardownFailure = env.errorInfo(error); }
      finally { await db.$disconnect(); }
    }
    result.finishedUtc = new Date().toISOString();
    result.result = result.setupOrHarnessFailure || result.teardownFailure || result.cases.length !== 3 || result.cases.some(x => x.result !== 'APROBADO') ? 'FALLO' : 'APROBADO';
    env.save('RESULTADOS.json', result); Object.assign(console, originalConsole);
    console.log('QA_EVIDENCIA=' + env.output); console.log('QA_RESULTADO=' + result.result);
    if (result.teardownFailure) assert.fail('Fallo al comprobar el estado final: ' + result.teardownFailure.message);
  }
});
