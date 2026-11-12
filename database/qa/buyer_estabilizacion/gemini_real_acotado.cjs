// Cuatro recorridos HTTP, SQL y Gemini reales. Solo sujetos nuevos; presupuesto de seis llamadas.
const assert = require('node:assert/strict');
const { once } = require('node:events');
const path = require('node:path');
const { createRequire } = require('node:module');
const br = createRequire(path.resolve('backend/package.json'));
br('dotenv').config({ path: path.resolve('backend/.env'), quiet: true });
const realKey = process.env.GEMINI_API_KEY;
const { prepare } = require('../buyer_backend/entorno_qa.cjs');
const { inspect, subject, snapshot } = require('../buyer_backend/consultas_qa.cjs');
const env = prepare();
const result = { startedUtc: new Date().toISOString(), prefix: env.prefix, version: env.version,
  mode: 'GEMINI_REAL_HTTP_SQL_REAL', cases: [], sdkCalls: [], providerHttp: [], maxCalls: 6 };
let db, server, baseUrl, originalClass, sdk;
const originalFetch = global.fetch;
const scrub = value => env.scrub(String(value).split(realKey || 'QA_MISSING_KEY_PLACEHOLDER').join('[REDACTADO]'));
const oldConsole = { log: console.log, warn: console.warn, error: console.error };
result.logs = [];
Object.assign(console, Object.fromEntries(Object.keys(oldConsole).map(k => [k, (...a) => result.logs.push(a.map(v => scrub(v instanceof Error ? v.message : String(v))).join(' '))])));
const fixtures = Object.fromEntries(['INFO','AMB','RES'].map(k => [k,{ name: env.prefix+k, email:(env.prefix+k).toLowerCase()+'@example.invalid' }]));
const load = k => subject(db, fixtures[k].email);
async function post(code, message, serviceId, previousId) {
  const body = { nombres: fixtures[code].name, apellidos: 'QA LIVE', email: fixtures[code].email,
    autoriza_contacto: true, mensaje: message, id_servicio: serviceId, ...(previousId ? {id_interaccion_previa:previousId}: {}) };
  const response = await global.fetch(baseUrl+'/api/buyer/register',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':(env.prefix+code+(previousId?'_RESP':'' )).toLowerCase()},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  return { body, status:response.status, response:await response.json() };
}
async function scenario(name, code, execute) {
  const item={name,startedUtc:new Date().toISOString()};result.cases.push(item);
  try { await execute(item); item.result='APROBADO'; }
  catch(e){item.result='FALLO';item.error={name:e.name,message:scrub(e.message)};}
  finally {item.sql=await load(code);item.finishedUtc=new Date().toISOString();}
}
(async()=>{
  try {
    if(!realKey || realKey.startsWith('QA_')) throw Error('GEMINI_API_KEY_REAL_NO_DISPONIBLE');
    process.env.GEMINI_API_KEY=realKey;
    br('tsx/cjs');({prisma:db}=br('./src/db.ts'));
    result.inspection=await inspect(db);result.before=await snapshot(db,env.prefix);
    const [existing]=await db.$queryRaw`SELECT COUNT(*) cantidad FROM dbo.Personas WHERE LEFT(nombres,LEN(${env.prefix}))=${env.prefix}`;
    assert.equal(existing.cantidad,0);
    sdk=br('@google/genai');originalClass=sdk.GoogleGenAI;
    sdk.GoogleGenAI=class extends originalClass{constructor(options){super(options);const realGenerate=this.models.generateContent.bind(this.models);this.models.generateContent=async request=>{
      if(result.sdkCalls.length>=6){const e=Error('QA_LIVE_CALL_BUDGET_EXHAUSTED');e.status=400;throw e;}
      const call={model:request.model,prompt:String(request.contents),startedUtc:new Date().toISOString()};result.sdkCalls.push(call);
      try {const response=await realGenerate(request);call.responseText=response.text;return response;}
      catch(e){call.error={status:e.status,message:scrub(e.message)};throw e;}
      finally{call.finishedUtc=new Date().toISOString();}
    };}};
    global.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url||String(input));
      if(url.origin===baseUrl)return originalFetch(input,init);
      if(url.hostname!=='generativelanguage.googleapis.com'||result.providerHttp.length>=6)throw Error('QA_EXTERNAL_HTTP_OR_BUDGET_BLOCKED');
      const entry={host:url.hostname,startedUtc:new Date().toISOString()};result.providerHttp.push(entry);
      const response=await originalFetch(input,init);entry.status=response.status;return response;
    };
    const express=br('express'),app=express();app.use(express.json());
    app.use((req,res,next)=>req.method==='POST'&&req.path==='/api/buyer/register'?next():res.sendStatus(403));
    app.use('/api/buyer',br('./src/routes/buyer.routes.ts').default);
    assert.equal(br('./src/services/martSyncService.ts').MartSyncService.isSyncEnabled(),false);
    assert(!Object.keys(require.cache).some(f=>/backend[\\/]src[\\/]index\.ts$|dunningScheduler\.ts$/.test(f)));
    server=app.listen(0,'127.0.0.1');await once(server,'listening');baseUrl='http://127.0.0.1:'+server.address().port;
    const service=result.inspection.service;
    await scenario('Consulta informativa','INFO',async item=>{
      item.http=await post('INFO','¿Cuánto cuesta una evaluación odontológica? Solo deseo información; no quiero reservar una cita.',service.id_servicio);
      assert.equal(item.http.status,200);assert.equal(item.http.response.data.intencion,'SOLO_CONSULTA');
      const s=await load('INFO');assert.equal(s.person.Etapa.nombre,'BUYER');assert.equal(s.interactions.length,1);assert.equal(s.decisions.length,1);assert.deepEqual([s.requests.length,s.events.length,s.intake.length],[0,0,0]);
    });
    await scenario('Saludo ambiguo','AMB',async item=>{
      item.http=await post('AMB','Hola, buenas tardes.',service.id_servicio);
      assert.equal(item.http.status,200);assert.equal(item.http.response.data.intencion,'AMBIGUA');assert.equal(item.http.response.data.accion,'ACLARACION');assert(item.http.response.data.aclaracion?.length>10);
      const s=await load('AMB');assert.equal(s.person.Etapa.nombre,'BUYER');assert.equal(s.requests.length,0);
    });
    await scenario('Solicitud explicita','RES',async item=>{
      item.http=await post('RES','Quiero solicitar una cita para una evaluación odontológica. Deseo reservarla.',service.id_servicio);
      assert.equal(item.http.status,201);assert.equal(item.http.response.data.accion,'CONVERSION_LEAD');assert.equal(item.http.response.data.entregaLeadEstado,'CONFIRMADA');
      const s=await load('RES');assert.equal(s.person.Etapa.nombre,'LEAD');assert.deepEqual([s.requests.length,s.events.length,s.intake.length],[1,1,1]);assert.equal(s.intake[0].id_evento_etapa,s.events[0].id_evento_etapa);assert.equal(s.intake[0].id_solicitud,s.requests[0].id_solicitud);
    });
    await scenario('Respuesta a aclaracion con contexto','AMB',async item=>{
      const previous=await load('AMB');assert.equal(previous.decisions[0]?.accion,'ACLARACION');
      item.http=await post('AMB','Sí, quiero solicitar una cita para una evaluación odontológica.',service.id_servicio,previous.interactions[0].id_interaccion);
      assert.equal(item.http.status,201);assert.equal(item.http.response.data.entregaLeadEstado,'CONFIRMADA');
      const s=await load('AMB');assert.equal(s.interactions.length,2);assert.equal(s.decisions.length,2);assert.deepEqual([s.requests.length,s.events.length,s.intake.length],[1,1,1]);
      const context=JSON.parse(s.decisions[1].entrada).contextoConversacional;assert.equal(context.idInteraccionPrevia,previous.interactions[0].id_interaccion);assert.equal(context.aclaracionPrevia,previous.decisions[0].resultado_revision);item.persistedContext=context;
    });
    result.after=await snapshot(db,env.prefix);result.inspectionAfter=await inspect(db);
    result.historicalHashesUnchanged=result.before.rows.every(x=>x.sha256_fuera_prefijo===result.after.rows.find(y=>y.table===x.table).sha256_fuera_prefijo);assert(result.historicalHashesUnchanged);
  }catch(e){result.error={name:e.name,message:scrub(e.message)};}
  finally{
    if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
    if(sdk&&originalClass)sdk.GoogleGenAI=originalClass;
    global.fetch=originalFetch;if(db)await db.$disconnect();Object.assign(console,oldConsole);
    result.finishedUtc=new Date().toISOString();result.result=result.error||result.cases.length!==4||result.cases.some(x=>x.result!=='APROBADO')?'FALLO':'APROBADO';
    env.save('GEMINI_REAL_RESULTADOS.json',JSON.parse(scrub(JSON.stringify(result,(_,v)=>typeof v==='bigint'?v.toString():v))));
    console.log(JSON.stringify({result:result.result,evidence:env.output,sdkCalls:result.sdkCalls.length,providerHttp:result.providerHttp.length,cases:result.cases.map(x=>({name:x.name,result:x.result,error:x.error,person:x.sql?.person.id_persona,interactions:x.sql?.interactions.map(i=>i.id_interaccion),requests:x.sql?.requests.map(i=>i.id_solicitud)})),error:result.error},null,2));
    process.exitCode=result.result==='APROBADO'?0:1;
  }
})();
