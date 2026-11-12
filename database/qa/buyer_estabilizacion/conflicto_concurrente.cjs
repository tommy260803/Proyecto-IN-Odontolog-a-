// Dos cuerpos distintos, una clave y SQL real: solo uno puede persistir.
const assert=require('node:assert/strict'),{once}=require('node:events');
const {prepare}=require('../buyer_backend/entorno_qa.cjs');
const {inspect,subject,snapshot}=require('../buyer_backend/consultas_qa.cjs');
const {installGeminiResponse}=require('../buyer_backend/gemini_controlado.cjs');
const env=prepare(),result={version:env.version,prefix:env.prefix,startedUtc:new Date().toISOString(),reads:[]};
let db,server,controlled;const originalFetch=global.fetch;const email=env.prefix.toLowerCase()+'@example.invalid';
(async()=>{try{
 env.backendRequire('tsx/cjs');({prisma:db}=env.backendRequire('./src/db.ts'));
 result.inspection=await inspect(db);result.before=await snapshot(db,env.prefix);
 assert.equal(await subject(db,email),null);
 db.$use(async(params,next)=>{const isRead=params.model==='DecisionesIA'&&params.action==='findFirst'&&params.args?.where?.entrada?.contains?.includes(env.prefix.toLowerCase());
  const r=await next(params);if(isRead)result.reads.push({transaction:params.runInTransaction,id:r?.id_decision??null});return r;});
 controlled=installGeminiResponse(env.backendRequire,env.prefix);
 const service=result.inspection.service;
 const messages=[env.prefix+'A Quiero solicitar una cita para evaluación odontológica.',env.prefix+'B Deseo reservar otra fecha para evaluación odontológica.'];
 messages.forEach(m=>controlled.respond(m,{intencion:'SOLICITA_RESERVA',id_servicio:service.id_servicio}));
 const express=env.backendRequire('express'),app=express();app.use(express.json());
 let count=0,release;const gate=new Promise(r=>release=r);const times=[];
 app.use(async(req,res,next)=>{times.push({entered:Date.now()});const i=times.length-1;res.on('finish',()=>times[i].finished=Date.now());
  if(++count===2)release();await gate;next();});
 app.use('/api/buyer',env.backendRequire('./src/routes/buyer.routes.ts').default);
 server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 global.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input.url);if(u.origin!==base)throw Error('QA_EXTERNAL_HTTP_BLOCKED');return originalFetch(input,init);};
 result.responses=await Promise.all(messages.map(async mensaje=>{const r=await fetch(base+'/api/buyer/register',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':env.prefix.toLowerCase()},
  body:JSON.stringify({nombres:env.prefix+'CONFLICTO',apellidos:'QA',email,autoriza_contacto:true,mensaje,id_servicio:service.id_servicio})});return{status:r.status,body:await r.json()};}));
 result.times=times;assert(Math.min(...times.map(x=>x.finished))>=Math.max(...times.map(x=>x.entered)));
 assert.deepEqual(result.responses.map(x=>x.status).sort(),[201,409]);
 assert.equal(result.responses.find(x=>x.status===409).body.code,'IDEMPOTENCY_CONFLICT');
 result.subject=await subject(db,email);const s=result.subject;
 assert.deepEqual([s.interactions.length,s.decisions.length,s.requests.length,s.events.length,s.intake.length],[1,1,1,1,1]);
 assert.equal(controlled.calls.length,1);result.calls=controlled.calls;
 result.after=await snapshot(db,env.prefix);
 result.outsidePrefixUnchanged=result.before.rows.every(x=>x.sha256_fuera_prefijo===result.after.rows.find(y=>y.table===x.table).sha256_fuera_prefijo);assert(result.outsidePrefixUnchanged);
 result.result='APROBADO';
}catch(e){result.result='FALLO';result.error={name:e.name,message:env.scrub(e.message)};}
finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(controlled)controlled.restore();global.fetch=originalFetch;if(db)await db.$disconnect();result.finishedUtc=new Date().toISOString();env.save('CONFLICTO_CONCURRENTE.json',result);console.log(JSON.stringify({result:result.result,evidence:env.output,reads:result.reads,responses:result.responses?.map(x=>x.status),person:result.subject?.person.id_persona,error:result.error},null,2));process.exitCode=result.result==='APROBADO'?0:1;}})();
