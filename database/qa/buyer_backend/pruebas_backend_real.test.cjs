// Runtime QA: rutas, clasificador/evaluador, Prisma y procedimientos reales.
// Solo Models.generateContent devuelve JSON controlado. No importa index.ts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { prepare, sourceHashes, stringify } = require('./entorno_qa.cjs');
const { installGeminiResponse } = require('./gemini_controlado.cjs');
const { inspect, subject, snapshot } = require('./consultas_qa.cjs');

test('Buyer QA: HTTP y evaluador reales con SQL real y respuesta Gemini controlada', { timeout: 240000 }, async t => {
  const env = prepare();
  const result = { version: env.version, prefix: env.prefix, startedUtc: new Date().toISOString(),
    connectionSourceBeforePin: env.source, simulation: 'Solo Models.generateContent, devuelve text JSON',
    productionCodeChanged: false, cases: [], http: [], sqlCalls: [], modelWrites: [], logs: [], externalHttpBlocked: [] };
  const originalConsole = { log: console.log, warn: console.warn, error: console.error };
  const captureLog = (...args) => result.logs.push(args.map(v => env.scrub(v instanceof Error ? v.message : typeof v === 'string' ? v : stringify(v))).join(' '));
  console.log = captureLog; console.warn = captureLog; console.error = captureLog;
  const originalFetch = global.fetch;
  let server, db, controlled, baseUrl, phase = 'setup', ctx = {};
  const fixtures = Object.fromEntries(['A','B','C','E'].map(code => [code, {
    code, name: env.prefix + code, email: (env.prefix + code).toLowerCase() + '@example.invalid',
  }]));
  const request = async (route, body) => {
    const response = await global.fetch(baseUrl + route, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
    const responseBody = await response.json();
    result.http.push({ phase, method: 'POST', route, requestBody: body, status: response.status, responseBody });
    return { status: response.status, body: responseBody };
  };
  const load = code => subject(db, fixtures[code].email);
  const adminBody = (code, message, service) => ({ firstName: fixtures[code].name, lastName: 'QA SINTETICO', email: fixtures[code].email,
    contactAuthorization: true, estado_calidad: 'Valido', serviceOfInterestId: service.id_servicio, concreteRequest: message });
  const saveCase = async (code, fn) => {
    phase = code;
    const item = { code, startedUtc: new Date().toISOString() };
    result.cases.push(item);
    try { await fn(item); item.result = 'APROBADO'; }
    catch (error) { item.result = 'FALLO'; item.error = env.errorInfo(error); throw error; }
    finally {
      item.finishedUtc = new Date().toISOString();
      try { item.persisted = await load(code === 'D' ? 'C' : code); } catch (error) { item.snapshotError = env.errorInfo(error); }
      env.save(`CASO_${code}.json`, item);
    }
  };
  const commercial = state => ({ requests: state.requests.map(v => v.id_solicitud), events: state.events.map(v => v.id_evento_etapa),
    intake: state.intake.map(v => ({ ...v })), interactions: state.interactions.map(v => v.id_interaccion), decisions: state.decisions.map(v => v.id_decision) });
  const noConversion = state => {
    assert.equal(state.person.Etapa.nombre, 'BUYER'); assert.equal(state.requests.length, 0);
    assert.equal(state.events.length, 0); assert.equal(state.intake.length, 0); assert.equal(state.captures.length, 1);
  };
  const converted = (state, outcome) => {
    assert.equal(outcome.estado, 'COMPLETADA'); assert.equal(outcome.accion, 'CONVERSION_LEAD');
    assert.equal(outcome.entregaLeadEstado, 'CONFIRMADA'); assert.equal(state.person.Etapa.nombre, 'LEAD');
    assert.equal(state.requests.length, 1); assert.equal(state.events.length, 1); assert.equal(state.intake.length, 1);
    const s = state.requests[0], e = state.events[0], a = state.intake[0], c = state.captures[0];
    assert.equal(outcome.id_solicitud, s.id_solicitud); assert.equal(outcome.id_evento_etapa, e.id_evento_etapa);
    assert.equal(e.id_solicitud, s.id_solicitud); assert.equal(e.id_captacion, c.id_captacion);
    assert.equal(e.id_persona, state.person.id_persona); assert.equal(e.clave_operacion_buyer, 'BUYER_LEAD:' + c.id_captacion);
    assert.equal(a.id_solicitud, s.id_solicitud); assert.equal(a.id_evento_etapa, e.id_evento_etapa);
    assert.equal(a.id_captacion, c.id_captacion); assert.equal(a.id_persona, state.person.id_persona);
    assert.equal(state.interactions.at(-1).id_solicitud, s.id_solicitud);
    const decision = state.decisions.at(-1), json = JSON.parse(decision.decision);
    assert.equal(json.id_solicitud, s.id_solicitud); assert.equal(json.id_evento_etapa, e.id_evento_etapa);
    assert.equal(json.entregaLeadEstado, 'CONFIRMADA');
  };
  try {
    env.backendRequire('tsx/cjs');
    ({ prisma: db } = env.backendRequire('./src/db.ts'));
    db.$use(async (params, next) => {
      if (params.action === 'queryRaw' || params.action === 'executeRaw') {
        const arg = params.args?.[0] ?? params.args?.query ?? params.args;
        const sql = typeof arg === 'string' ? arg : Array.isArray(arg) ? arg.join('?') : arg?.sql || '';
        if (/\bEXEC\s+dbo\.usp_(?:ConvertirBuyerALead|RegistrarEntradaAgenteLead)/i.test(sql)) {
          result.sqlCalls.push({ phase, sqlTemplate: sql.trim(), persistence: 'REAL_SQL_SERVER' });
        }
      } else if (/^(create|update|delete|upsert)/.test(params.action)) {
        result.modelWrites.push({ phase, model: params.model, action: params.action });
      }
      return next(params); // Nunca reemplaza ni fabrica el resultado de persistencia.
    });
    result.inspectionBefore = await inspect(db);
    const [exists] = await db.$queryRaw`SELECT COUNT(*) cantidad FROM dbo.Personas WHERE LEFT(nombres,LEN(${env.prefix}))=${env.prefix}`;
    assert.equal(exists.cantidad, 0, 'No reutilizar un prefijo existente');
    result.before = await snapshot(db, env.prefix);
    env.save('ESTADO_ANTES.json', { inspection: result.inspectionBefore, snapshot: result.before, version: env.version });
    global.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url || String(input));
      if (!baseUrl || url.origin !== baseUrl) {
        result.externalHttpBlocked.push({ host: url.hostname }); throw Error('QA_EXTERNAL_HTTP_BLOCKED');
      }
      return originalFetch(input, init);
    };
    controlled = installGeminiResponse(env.backendRequire, env.prefix);
    const { MartSyncService } = env.backendRequire('./src/services/martSyncService.ts');
    assert.equal(MartSyncService.isSyncEnabled(), false);
    const express = env.backendRequire('express');
    const app = express(); app.use(express.json());
    app.use((req, res, next) => {
      if (req.method !== 'POST' || !(/^\/api\/buyer(?:\/register|\/\d+\/evaluate|\/evaluations\/\d+\/retry)?$/.test(req.path))) {
        return res.status(403).json({ error: 'Ruta fuera del bloque QA' });
      }
      next();
    });
    app.use('/api/buyer', env.backendRequire('./src/routes/buyer.routes.ts').default);
    assert(!Object.keys(require.cache).some(f => /backend[\\/]src[\\/]index\.ts$/.test(f)));
    assert(!Object.keys(require.cache).some(f => /dunningScheduler\.ts$/.test(f)));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    baseUrl = 'http://127.0.0.1:' + server.address().port;
    result.isolation = { generalIndexLoaded: false, dunningLoaded: false, martEnabled: false, autoRecoveryInvoked: false,
      realClassifierAndEvaluator: true, realRouter: true, sdkMethodReplacedOnlyInMemory: true };
    const service = result.inspectionBefore.service;

    await t.test('A SOLO_CONSULTA: registro publico evalua automaticamente y persiste en SQL', async () => saveCase('A', async item => {
      const message = env.prefix + 'A ¿Cuál es el precio de la evaluación odontológica? Solo deseo información.';
      controlled.respond(message, { intencion: 'SOLO_CONSULTA', id_servicio: null });
      const n = controlled.calls.length;
      const response = await request('/api/buyer/register', { nombres: fixtures.A.name, apellidos: 'QA SINTETICO', email: fixtures.A.email,
        autoriza_contacto: true, mensaje: message });
      item.response = response;
      assert.equal(response.status, 200); assert.equal(response.body.success, true);
      assert.equal(response.body.data.intencion, 'SOLO_CONSULTA'); assert.equal(response.body.data.accion, 'SOLO_CONSULTA');
      assert.equal(controlled.calls.length - n, 1);
      const state = await load('A'); assert(state); noConversion(state);
      assert.equal(state.interactions.length, 1); assert.equal(state.interactions[0].mensaje, message);
      assert.equal(state.decisions.length, 1); assert.equal(state.decisions[0].id_interaccion, state.interactions[0].id_interaccion);
      assert.equal(state.decisions[0].accion, 'SOLO_CONSULTA'); assert.equal(JSON.parse(state.decisions[0].decision).estado, 'COMPLETADA');
      item.publicAutoEvaluation = true;
    }));

    await t.test('B AMBIGUA: registro administrativo y evaluacion explicita sin conversion', async () => saveCase('B', async item => {
      const message = env.prefix + 'B Hola, buenas tardes.';
      controlled.respond(message, { intencion: 'AMBIGUA', id_servicio: null });
      const n = controlled.calls.length;
      const registration = await request('/api/buyer', adminBody('B', message, service));
      item.registration = registration; assert.equal(registration.status, 201);
      let state = await load('B'); assert(state); noConversion(state);
      assert.equal(state.decisions.length, 0); assert.equal(controlled.calls.length, n);
      item.adminDoesNotEvaluateAutomatically = true;
      const evaluation = await request('/api/buyer/' + state.person.id_persona + '/evaluate', {});
      item.evaluation = evaluation; assert.equal(evaluation.status, 200);
      assert.equal(evaluation.body.data.intencion, 'AMBIGUA'); assert.equal(evaluation.body.data.accion, 'ACLARACION');
      assert(evaluation.body.data.aclaracion?.length > 0); assert.equal(controlled.calls.length - n, 1);
      state = await load('B'); noConversion(state);
      assert.equal(state.interactions[0].mensaje, message); assert.equal(state.decisions.length, 1);
      assert.equal(state.decisions[0].accion, 'ACLARACION'); assert.equal(state.decisions[0].requiere_revision, true);
    }));

    await t.test('C SOLICITA_RESERVA: conversion y recepcion SQL reales correctamente vinculadas', async () => saveCase('C', async item => {
      const message = env.prefix + 'C Quiero reservar una cita para ' + service.nombre + '.';
      controlled.respond(message, { intencion: 'SOLICITA_RESERVA', id_servicio: service.id_servicio });
      const n = controlled.calls.length;
      const registration = await request('/api/buyer', adminBody('C', message, service));
      item.registration = registration; assert.equal(registration.status, 201);
      let state = await load('C'); noConversion(state); assert.equal(state.decisions.length, 0); assert.equal(controlled.calls.length, n);
      const evaluation = await request('/api/buyer/' + state.person.id_persona + '/evaluate', {});
      item.evaluation = evaluation; assert.equal(evaluation.status, 200); assert.equal(controlled.calls.length - n, 1);
      state = await load('C'); converted(state, evaluation.body.data);
      assert.equal(state.requests[0].id_servicio, service.id_servicio);
      ctx.c = { passed: true, state, outcome: evaluation.body.data, sdkCalls: controlled.calls.length };
    }));

    await t.test('D Reintento de la misma interaccion conserva decision y conversion sin duplicados', async () => saveCase('D', async item => {
      assert(ctx.c?.passed, 'D no se puede validar porque C no completo la conversion');
      const before = ctx.c.state, n = controlled.calls.length;
      const evaluation = await request('/api/buyer/evaluations/' + before.interactions[0].id_interaccion + '/retry', {});
      item.evaluation = evaluation; assert.equal(evaluation.status, 200);
      const state = await load('C'); converted(state, evaluation.body.data);
      assert.equal(evaluation.body.data.id_decision, ctx.c.outcome.id_decision);
      assert.equal(evaluation.body.data.id_interaccion, ctx.c.outcome.id_interaccion);
      assert.equal(evaluation.body.data.contextFingerprint, ctx.c.outcome.contextFingerprint);
      assert.equal(evaluation.body.data.ya_convertido, true);
      assert.deepEqual(commercial(state), commercial(before));
      assert.equal(controlled.calls.length, n, 'No debe volver a clasificar una conversion completada');
      item.noNewSdkCall = true;
    }));

    await t.test('E Consulta nueva de contacto sintetico PAYER no se apropia de conversion anterior', async () => saveCase('E', async item => {
      phase = 'E_PREPARACION';
      const initial = env.prefix + 'E_INICIAL Quiero reservar una cita para ' + service.nombre + '.';
      controlled.respond(initial, { intencion: 'SOLICITA_RESERVA', id_servicio: service.id_servicio });
      const reg = await request('/api/buyer', adminBody('E', initial, service));
      item.fixtureRegistration = reg; assert.equal(reg.status, 201);
      let state = await load('E');
      const oldEval = await request('/api/buyer/' + state.person.id_persona + '/evaluate', {});
      item.fixtureConversion = oldEval; assert.equal(oldEval.status, 200);
      state = await load('E'); converted(state, oldEval.body.data);
      const payer = result.inspectionBefore.stages.find(s => s.nombre === 'PAYER');
      const changed = await db.$executeRaw`UPDATE dbo.Personas SET id_etapa_actual=${payer.id_etapa},fecha_actualizacion=SYSDATETIME()
        WHERE id_persona=${state.person.id_persona} AND nombres=${fixtures.E.name} AND email=${fixtures.E.email}`;
      assert.equal(changed, 1); item.fixturePayerStaging = 'UPDATE SQL real limitado a la persona sintetica; no valida el flujo de pagos';
      const prior = await load('E'); item.beforeNewMessage = prior;
      phase = 'E';
      const message = env.prefix + 'E_NUEVA ¿Cuáles son los horarios y precios? Solo información, no quiero otra cita.';
      controlled.respond(message, { intencion: 'SOLO_CONSULTA', id_servicio: null });
      const n = controlled.calls.length;
      const registration = await request('/api/buyer', adminBody('E', message, service));
      item.registration = registration; assert.equal(registration.status, 200); assert.equal(registration.body.id_persona, prior.person.id_persona);
      assert.equal(controlled.calls.length, n);
      state = await load('E'); assert.equal(state.person.Etapa.nombre, 'PAYER'); assert.equal(state.interactions.length, prior.interactions.length + 1);
      assert.equal(state.interactions.at(-1).mensaje, message); assert.equal(state.decisions.length, prior.decisions.length);
      const evaluation = await request('/api/buyer/' + state.person.id_persona + '/evaluate', {});
      item.evaluation = evaluation; assert.equal(evaluation.status, 200);
      const outcome = evaluation.body.data;
      assert.equal(outcome.intencion, 'SOLO_CONSULTA'); assert.equal(outcome.accion, 'SOLO_CONSULTA'); assert.equal(outcome.etapa_final, 'PAYER');
      assert(outcome.id_solicitud == null); assert(outcome.id_evento_etapa == null); assert.notEqual(outcome.ya_convertido, true);
      assert.equal(outcome.entregaLeadEstado, 'NO_APLICA'); assert.equal(controlled.calls.length - n, 1);
      state = await load('E'); assert.equal(state.person.Etapa.nombre, 'PAYER');
      assert.deepEqual(state.requests, prior.requests); assert.deepEqual(state.events, prior.events); assert.deepEqual(state.intake, prior.intake);
      assert.equal(state.interactions.at(-1).id_solicitud, null); assert.equal(state.decisions.length, prior.decisions.length + 1);
      assert.equal(state.decisions.at(-1).id_interaccion, state.interactions.at(-1).id_interaccion);
      assert(state.decisions.at(-1).id_decision !== prior.decisions[0].id_decision);
      assert.equal(JSON.parse(state.decisions.at(-1).decision).id_solicitud ?? null, null);
      assert.equal(state.decisions[0].decision, prior.decisions[0].decision);
    }));
  } catch (error) {
    result.setupOrHarnessFailure = env.errorInfo(error); throw error;
  } finally {
    phase = 'teardown';
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (controlled) { result.geminiCalls = controlled.calls; result.sdkConstructors = controlled.constructors(); controlled.restore(); }
    global.fetch = originalFetch;
    if (db) {
      try {
        result.after = await snapshot(db, env.prefix); result.inspectionAfter = await inspect(db);
        result.finalSubjects = {};
        for (const code of Object.keys(fixtures)) result.finalSubjects[code] = await load(code);
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
    result.result = result.setupOrHarnessFailure || result.teardownFailure || result.cases.length !== 5 || result.cases.some(c => c.result !== 'APROBADO') ? 'FALLO' : 'APROBADO';
    env.save('RESULTADOS.json', result);
    Object.assign(console, originalConsole);
    originalConsole.log('QA_EVIDENCIA=' + path.relative(env.root, env.output).replaceAll('\\', '/'));
    originalConsole.log('QA_RESULTADO=' + result.result);
    if (result.teardownFailure) assert.fail('Fallo al comprobar el estado final: ' + result.teardownFailure.message);
  }
});
