// Diagnóstico acotado: solo SELECT y GET; sin index.ts, modelos externos ni DML.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { prepare } = require('../buyer_backend/entorno_qa.cjs');
const env = prepare();
const phase = process.argv[2];
if (!['antes', 'despues'].includes(phase)) throw Error('Indicar antes o despues');
const output = path.join(__dirname, 'evidencias');
fs.mkdirSync(output, { recursive: true });
const file = path.join(output, `${phase}.json`);
if (fs.existsSync(file)) throw Error('La evidencia ya existe; conservarla antes de otra ejecución');
const result = { version: env.version, phase, startedUtc: new Date().toISOString(), subjects: [] };
let db, server;
const ids = '11000,11001,11002,11007'; // Lista fija y exclusiva de sujetos QA autorizados.
async function fingerprint() {
  const hashes = [];
  for (const [table, key] of [['Personas','id_persona'], ['PersonaPreferencias','id_preferencia'],
    ['CaptacionesBuyer','id_captacion'], ['Interacciones','id_interaccion'], ['DecisionesIA','id_decision'],
    ['Solicitudes','id_solicitud'], ['EventosEtapa','id_evento_etapa'], ['EntradasAgenteLead','id_solicitud']]) {
    const [r] = await db.$queryRawUnsafe(`SELECT COUNT(*) cantidad,
      CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FROM dbo.${table} t
        WHERE id_persona IN(${ids}) ORDER BY ${key} FOR JSON PATH,INCLUDE_NULL_VALUES)),2) sha256
      FROM dbo.${table} WHERE id_persona IN(${ids})`);
    hashes.push({ table, ...r });
  }
  return hashes;
}
(async () => {
  try {
    env.backendRequire('tsx/cjs');
    ({ prisma: db } = env.backendRequire('./src/db.ts'));
    const [identity] = await db.$queryRawUnsafe('SELECT @@SERVERNAME servidor,DB_NAME() base');
    assert.deepEqual(identity, { servidor: 'DANIELPC', base: 'NexoSalud_LeadEnsayoFinal' });
    result.identity = identity;
    result.otherRequests = await db.$queryRawUnsafe('SELECT session_id,command FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID');
    assert.equal(result.otherRequests.length, 0, 'Otra petición activa: detener comprobación aislada');
    result.before = await fingerprint();
    const express = env.backendRequire('express');
    const app = express();
    app.use((req, res, next) => req.method === 'GET' ? next() : res.sendStatus(405));
    app.use('/api/buyer', env.backendRequire('./src/routes/buyer.routes.ts').default);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    for (const id of [11000,11001,11002,11007]) {
      const [person] = await db.$queryRawUnsafe(`SELECT p.id_persona,p.nombres,e.nombre etapa,
        CONVERT(varchar(33),p.fecha_registro,126) registro_sql_sin_zona,
        p.fecha_registro registro_prisma FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual WHERE p.id_persona=${id}`);
      assert(person?.nombres.startsWith('QA_'), 'El sujeto no es sintético QA');
      const preferences = await db.$queryRawUnsafe(`SELECT id_preferencia,sede_preferida,id_horario,
        CONVERT(varchar(33),fecha_inicio,126) fecha_inicio,CONVERT(varchar(33),fecha_fin,126) fecha_fin
        FROM dbo.PersonaPreferencias WHERE id_persona=${id} ORDER BY id_preferencia DESC`);
      const events = await db.$queryRawUnsafe(`SELECT ev.id_evento_etapa,eo.nombre origen,ed.nombre destino,
        CONVERT(varchar(33),ev.fecha_hora,126) fecha_sql_sin_zona,ev.fecha_hora fecha_prisma,
        DATEDIFF(SECOND,p.fecha_registro,ev.fecha_hora) segundos_desde_registro
        FROM dbo.EventosEtapa ev JOIN dbo.Personas p ON p.id_persona=ev.id_persona
        LEFT JOIN dbo.Etapas eo ON eo.id_etapa=ev.etapa_origen JOIN dbo.Etapas ed ON ed.id_etapa=ev.etapa_destino
        WHERE ev.id_persona=${id} ORDER BY ev.fecha_hora,ev.id_evento_etapa`);
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/buyer/${id}`);
      const api = await response.json();
      result.subjects.push({ id, person, preferences, events, status: response.status, api });
      assert.equal(response.status, 200);
      // Los cuatro sujetos carecen de sede/horario. No derivar preferencias de la etapa o de Gemini.
      assert.equal(api.pref_sede_preferida, '');
      assert.equal(api.pref_id_horario, '');
      if (phase === 'despues') {
        assert.equal(api.currentStage, person.etapa);
        const transition = events.find(e => e.origen === 'BUYER' && e.destino === 'LEAD');
        assert.equal(api.convertedAt ?? null, transition?.fecha_prisma.toISOString() ?? null);
      }
    }
    result.clocks = await db.$queryRawUnsafe(`SELECT CONVERT(varchar(33),SYSDATETIME(),126) sql_local,
      CONVERT(varchar(33),SYSUTCDATETIME(),126) sql_utc,CONVERT(varchar(40),SYSDATETIMEOFFSET(),127) sql_offset`);
    result.nodeClock = { isoUtc: new Date().toISOString(), local: new Date().toString(),
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone, offsetMinutes: new Date().getTimezoneOffset() };
    result.defaults = await db.$queryRawUnsafe(`SELECT OBJECT_NAME(c.object_id) tabla,c.name columna,t.name tipo,dc.definition valor_default
      FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
      LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id
      WHERE (c.object_id=OBJECT_ID('dbo.Personas') AND c.name='fecha_registro')
      OR (c.object_id=OBJECT_ID('dbo.CaptacionesBuyer') AND c.name='fecha_captacion')
      OR (c.object_id=OBJECT_ID('dbo.EventosEtapa') AND c.name='fecha_hora')`);
    result.procedureClock = await db.$queryRawUnsafe(`SELECT OBJECT_NAME(object_id) procedimiento,
      CONVERT(varchar(64),HASHBYTES('SHA2_256',definition),2) sha256,
      SUBSTRING(definition,CASE WHEN CHARINDEX('@fecha DATETIME2',definition)>0 THEN CHARINDEX('@fecha DATETIME2',definition) ELSE 1 END,100) reloj
      FROM sys.sql_modules WHERE object_id=OBJECT_ID('dbo.usp_ConvertirBuyerALead')`);
    result.after = await fingerprint();
    assert.deepEqual(result.after, result.before, 'Los datos de los cuatro sujetos deben conservarse');
    result.result = 'APROBADO';
  } catch (e) {
    result.result = 'FALLO'; result.error = env.errorInfo(e); process.exitCode = 1;
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
    if (db) await db.$disconnect();
    result.finishedUtc = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(result, (_,v) => typeof v === 'bigint' ? v.toString() : v, 2), { flag: 'wx' });
    console.log(JSON.stringify({ result: result.result, file, identity: result.identity,
      subjects: result.subjects.map(s => ({ id: s.id, etapa: s.person.etapa, sede: s.api.pref_sede_preferida,
        horario: s.api.pref_id_horario, convertedAt: s.api.convertedAt })), error: result.error }, null, 2));
  }
})();
