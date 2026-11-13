// Prueba EN VIVO opt-in: HTTP, autenticación, Gemini y SQL reales. NO mocks.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..');
const req=createRequire(path.join(root,'backend/package.json'));
const {configuredQaTarget}=require('../buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs');
const local=require('./credencial_local.cjs');
const base='http://127.0.0.1:3001/api';
const buyer=Number(process.env.QA_BUYER_PERSON_ID||'11000');
if(!Number.isSafeInteger(buyer)||buyer<1||buyer>2147483647)throw Error('QA_INVALID_PERSON');
const run='QA_CHAT_REAL_'+new Date().toISOString().replace(/[:.]/g,'-');
const output=path.join(__dirname,'evidencias',run+'.json');
const evidence={run,at:new Date().toISOString(),realSql:true,realGemini:true,model:'gemini-3.5-flash-lite',cases:{},steps:[]};
let db,token;
const save=()=>{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?v.toString():v,2));};
async function http(method,route,body,key,authorized=true){
  const response=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(authorized&&token?{Authorization:'Bearer '+token}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={nonJson:true};}
  return {status:response.status,body:data};
}
async function login(){const secret=local.read();const r=await http('POST','/lead/commercial/staff/session',{email:secret.email,password:secret.password},null,false);
  assert.equal(r.status,200,'Login HTTP real');assert.equal(r.body.usuario.id_usuario,5);assert.equal(r.body.usuario.rol,'Administrador');
  token=r.body.token;assert.equal(typeof token,'string');return {status:r.status,id_usuario:r.body.usuario.id_usuario,rol:r.body.usuario.rol};}
async function snapshot(){return {
  subjects:await db.$queryRawUnsafe(`SELECT p.id_persona,e.nombre etapa,
    (SELECT COUNT(*) FROM dbo.Interacciones i WHERE i.id_persona=p.id_persona) interacciones,
    (SELECT COUNT(*) FROM dbo.DecisionesIA d WHERE d.id_persona=p.id_persona AND d.agente='BUYER_CHAT') decisiones_chat,
    (SELECT COUNT(*) FROM dbo.DecisionesIA d WHERE d.id_persona=p.id_persona AND d.agente='BUYER') evaluaciones,
    (SELECT COUNT(*) FROM dbo.Solicitudes s WHERE s.id_persona=p.id_persona) solicitudes,
    (SELECT COUNT(*) FROM dbo.EventosEtapa v WHERE v.id_persona=p.id_persona) eventos,
    (SELECT COUNT(*) FROM dbo.EntradasAgenteLead l WHERE l.id_persona=p.id_persona) entradas
    FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual WHERE p.id_persona IN(${buyer},11007) AND p.nombres LIKE 'QA[_]%' ORDER BY p.id_persona`),
  links:await db.$queryRawUnsafe(`SELECT i.id_interaccion,i.id_persona,i.id_usuario,i.id_solicitud,s.id_servicio,
    v.id_evento_etapa,v.id_captacion,l.id_solicitud recepcion_solicitud,l.id_evento_etapa recepcion_evento,
    JSON_VALUE(d.entrada,'$.conversationId') conversationId,JSON_VALUE(d.entrada,'$.status') estado_chat,d.id_decision turnId
    FROM dbo.Interacciones i LEFT JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud AND s.id_persona=i.id_persona
    LEFT JOIN dbo.EventosEtapa v ON v.id_solicitud=s.id_solicitud AND v.id_persona=i.id_persona
    LEFT JOIN dbo.EntradasAgenteLead l ON l.id_solicitud=s.id_solicitud
    LEFT JOIN dbo.DecisionesIA d ON d.id_interaccion=i.id_interaccion AND d.agente='BUYER_CHAT'
    WHERE i.id_persona IN(${buyer},11007) ORDER BY i.id_interaccion,v.id_evento_etapa`)};}
const subject=(s,id)=>s.subjects.find(p=>p.id_persona===id);
async function persisted(person,r,body){
  const rows=await db.$queryRawUnsafe(`SELECT d.id_decision,d.id_persona,d.id_interaccion,d.entrada,i.mensaje,i.id_usuario
    FROM dbo.DecisionesIA d JOIN dbo.Interacciones i ON i.id_interaccion=d.id_interaccion
    WHERE d.id_decision=@P1 AND d.id_persona=@P2 AND d.agente='BUYER_CHAT'`,r.body.turnId,person);
  assert.equal(rows.length,1);const row=rows[0],turn=JSON.parse(row.entrada);
  assert.equal(row.id_interaccion,r.body.interactionId);assert.equal(row.mensaje,body.message);assert.equal(row.id_usuario,5);
  assert.deepEqual(turn.messages,r.body.messages);assert.equal(turn.status,r.body.status);assert.equal(turn.conversationId,r.body.conversationId);
  return {turnId:row.id_decision,interactionId:row.id_interaccion,exactMessagesMatch:true,operatorId:row.id_usuario};
}
async function send(label,person,body){const key=run+'_'+label;const before=await snapshot();
  const r=await http('POST',`/buyer/${person}/conversations/messages`,body,key);
  const step={label,person,key,request:body,response:r,before,after:await snapshot()};evidence.steps.push(step);save();
  assert.equal(r.status,200,label+' HTTP');assert.equal(r.body.status,'COMPLETADA',label+' estado');
  step.persisted=await persisted(person,r,body);save();return {r,step,key,body};}
async function scenario(name,action){try{await action();evidence.cases[name]={result:'PASS'};}catch(error){evidence.cases[name]={result:'FAIL',reason:error?.code==='ERR_ASSERTION'?String(error.message).slice(0,350):'HTTP_SQL_OR_PREREQUISITE_ERROR'};}save();console.log(name+': '+evidence.cases[name].result);}
async function main(){
  if(process.env.QA_BUYER_CHAT_REAL!=='true'||process.env.RUN_SQL_TESTS!=='false')throw Error('QA_OPT_IN_REQUIRED');
  req('dotenv').config({path:path.join(root,'backend/.env'),quiet:true});
  const url=process.env.TEST_SQLSERVER_URL||process.env.SQLSERVER_URL||'';if(!configuredQaTarget(url))throw Error('QA_CONFIGURED_TARGET_REJECTED');
  const {PrismaClient}=req('@prisma/client');db=new PrismaClient({datasources:{db:{url}},log:[]});
  const [target]=await db.$queryRawUnsafe('SELECT @@SERVERNAME servidor,DB_NAME() base');
  assert.equal(target.servidor,'DANIELPC');assert.equal(target.base,'NexoSalud_LeadEnsayoFinal');evidence.target=target;
  evidence.before=await snapshot();
  if(process.argv.includes('--reintentar-turno'))assert.ok(['BUYER','LEAD'].includes(subject(evidence.before,buyer)?.etapa));
  else assert.equal(subject(evidence.before,buyer)?.etapa,'BUYER');
  assert.equal(subject(evidence.before,11007)?.etapa,'PAYER');
  evidence.activeService=await db.$queryRawUnsafe('SELECT id_servicio,nombre,activo FROM dbo.Servicios WHERE id_servicio=1 AND activo=1');assert.equal(evidence.activeService.length,1);
  const noSession=await http('GET',`/buyer/${buyer}/conversations`,null,null,false);evidence.withoutSession=noSession;assert.equal(noSession.status,401);
  evidence.login=await login();const access=await http('GET',`/buyer/${buyer}/conversations`);evidence.authorizedAccess=access;assert.equal(access.status,200);save();
  if(process.argv.includes('--continuar-b')) {
    const previousPath=path.resolve(process.argv[process.argv.indexOf('--continuar-b')+1]||'');
    assert.equal(path.dirname(previousPath),path.join(__dirname,'evidencias'));
    const previous=JSON.parse(fs.readFileSync(previousPath,'utf8')),original=previous.steps.find(s=>s.label==='B1');
    assert.equal(original.person,buyer);evidence.continuationOf=previous.run;let resumed,converted;
    await scenario('B_RETRY_Y_CONTINUACION',async()=>{
      const cid=original.response.body.conversationId,turnId=original.response.body.turnId;
      const current=await http('GET',`/buyer/${buyer}/conversations/${cid}`);
      assert.equal(current.body.turns.find(t=>t.turnId===turnId)?.retryable,true);
      const before=await snapshot(),r=await http('POST',`/buyer/${buyer}/conversations/${cid}/turns/${turnId}/retry`,{});
      const step={label:'B1_RETRY',person:buyer,key:original.key,request:original.request,response:r,before,after:await snapshot()};evidence.steps.push(step);save();
      assert.equal(r.status,200);assert.equal(r.body.evaluation.accion,'ACLARACION');assert.equal(r.body.turnId,turnId);assert.equal(r.body.interactionId,original.response.body.interactionId);
      assert.equal(subject(step.after,buyer).interacciones,subject(before,buyer).interacciones);step.persisted=await persisted(buyer,r,original.request);
      resumed=await send('B2',buyer,{conversationId:cid,message:'Me refiero a evaluación odontológica; quiero información, todavía no quiero pedir una cita.',origin:'OPERADOR_TRANSCRIPTOR'});
      assert.equal(resumed.r.body.evaluation.accion,'SOLO_CONSULTA');assert.equal(subject(resumed.step.after,buyer).etapa,'BUYER');assert.equal(subject(resumed.step.after,buyer).solicitudes,0);
    });
    await scenario('C_CONVERSION_Y_RECEPCION_DIRECTAS',async()=>{
      assert.equal(evidence.cases.B_RETRY_Y_CONTINUACION.result,'PASS');
      converted=await send('C',buyer,{conversationId:original.response.body.conversationId,message:'Antes pedí información, pero ahora he decidido solicitar una cita de evaluación odontológica. Solicito expresamente que envíen mi solicitud para que me contacten; ya no busco solo información.',origin:'OPERADOR_TRANSCRIPTOR'});
      const e=converted.r.body.evaluation;assert.equal(e.accion,'CONVERSION_LEAD');assert.equal(e.entregaLeadEstado,'CONFIRMADA');
      const link=converted.step.after.links.find(l=>l.id_interaccion===converted.r.body.interactionId);
      assert.equal(link.id_solicitud,e.id_solicitud);assert.equal(link.id_evento_etapa,e.id_evento_etapa);assert.equal(link.recepcion_solicitud,e.id_solicitud);assert.equal(link.recepcion_evento,e.id_evento_etapa);
      assert.equal(subject(converted.step.after,buyer).etapa,'LEAD');for(const count of ['solicitudes','eventos','entradas'])assert.equal(subject(converted.step.after,buyer)[count],subject(converted.step.before,buyer)[count]+1);
    });
    await scenario('D_REPLAY_CONVERSION_FINAL',async()=>{
      assert.equal(evidence.cases.C_CONVERSION_Y_RECEPCION_DIRECTAS.result,'PASS');const before=await snapshot();
      const response=await http('POST',`/buyer/${buyer}/conversations/messages`,converted.body,converted.key),after=await snapshot();
      evidence.replay={key:converted.key,request:converted.body,response,before,after};save();assert.equal(response.status,200);assert.equal(response.body.replayed,true);
      for(const id of ['conversationId','turnId','interactionId'])assert.equal(response.body[id],converted.r.body[id]);
      assert.deepEqual(response.body.evaluation,converted.r.body.evaluation);assert.deepEqual(response.body.messages,converted.r.body.messages);assert.deepEqual(after,before);
    });
    await scenario('F_HISTORIAL_FINAL_NUEVA_SESION',async()=>{
      const route=`/buyer/${buyer}/conversations/${original.response.body.conversationId}`,first=await http('GET',route);assert.equal(first.status,200);
      assert.equal((await http('DELETE','/lead/commercial/staff/session')).status,204);assert.equal((await http('GET',route)).status,401);
      evidence.secondLogin=await login();const list=await http('GET',`/buyer/${buyer}/conversations?after=0&limit=1`),history=await http('GET',route);
      evidence.finalHistory={list,history};save();assert.equal(history.status,200);assert.equal(list.status,200);assert.deepEqual(history.body,first.body);
    });
    evidence.after=await snapshot();evidence.finishedAt=new Date().toISOString();if(Object.values(evidence.cases).some(c=>c.result!=='PASS'))process.exitCode=2;return;
  }
  const continuationMode=process.argv.includes('--reintentar-turno')?'--reintentar-turno':'--continuar-conversion';
  if(process.argv.includes(continuationMode)) {
    const previousPath=path.resolve(process.argv[process.argv.indexOf(continuationMode)+1]||'');
    assert.equal(path.dirname(previousPath),path.join(__dirname,'evidencias'));
    const previous=JSON.parse(fs.readFileSync(previousPath,'utf8'));
    evidence.continuationOf=previous.run;
    const original=previous.steps.find(s=>s.label===(continuationMode==='--reintentar-turno'?'C2':'C'));assert.ok(original);
    let converted;
    await scenario('C2_RESPUESTA_EXPLICITA_A_ACLARACION_REAL',async()=>{
      if(continuationMode==='--reintentar-turno') {
        const before=await snapshot();
        const current=await http('GET',`/buyer/${buyer}/conversations/${original.response.body.conversationId}`);
        assert.equal(current.status,200);assert.equal(current.body.turns.find(t=>t.turnId===original.response.body.turnId)?.retryable,true);
        const r=await http('POST',`/buyer/${buyer}/conversations/${original.response.body.conversationId}/turns/${original.response.body.turnId}/retry`,{});
        const step={label:'C3_RETRY',person:buyer,request:original.request,key:original.key,response:r,before,after:await snapshot()};evidence.steps.push(step);save();
        assert.equal(r.status,200);assert.equal(r.body.status,'COMPLETADA');assert.equal(r.body.turnId,original.response.body.turnId);assert.equal(r.body.interactionId,original.response.body.interactionId);
        assert.equal(subject(step.after,buyer).interacciones,subject(before,buyer).interacciones);
        step.persisted=await persisted(buyer,r,original.request);converted={r,step,key:original.key,body:original.request};
      } else converted=await send('C2',buyer,{conversationId:original.response.body.conversationId,
        message:original.response.body.analysis?.pendingData?.some(x=>/sede|horario/i.test(x))
          ? 'No tengo sede ni horario preferidos. Deseo solicitar la evaluación odontológica y que el equipo me contacte para coordinar esos detalles. Solicito expresamente que envíen mi solicitud; no estoy reservando una fecha ni un horario.'
          : 'Ahora he decidido solicitar la cita de evaluación odontológica. Antes solo quería información, pero ya cambié de decisión. Sí deseo que envíen mi solicitud para que me contacten; no estoy preguntando por más detalles.',origin:'OPERADOR_TRANSCRIPTOR'});
      const e=converted.r.body.evaluation;assert.equal(e.accion,'CONVERSION_LEAD');assert.equal(e.entregaLeadEstado,'CONFIRMADA');
      const link=converted.step.after.links.find(l=>l.id_interaccion===converted.r.body.interactionId);assert.ok(link);
      assert.equal(link.id_solicitud,e.id_solicitud);assert.equal(link.id_evento_etapa,e.id_evento_etapa);assert.equal(link.recepcion_solicitud,e.id_solicitud);assert.equal(link.recepcion_evento,e.id_evento_etapa);
      assert.equal(subject(converted.step.after,buyer).etapa,'LEAD');
      for(const count of ['solicitudes','eventos','entradas']) {
        const increment=subject(converted.step.before,buyer).etapa==='LEAD'&&count!=='entradas'?0:1;
        assert.equal(subject(converted.step.after,buyer)[count],subject(converted.step.before,buyer)[count]+increment);
      }
    });
    await scenario('D2_REPLAY_CONVERSION',async()=>{
      assert.equal(evidence.cases.C2_RESPUESTA_EXPLICITA_A_ACLARACION_REAL.result,'PASS');const before=await snapshot();
      const response=await http('POST',`/buyer/${buyer}/conversations/messages`,converted.body,converted.key);const after=await snapshot();
      evidence.replay={key:converted.key,request:converted.body,response,before,after};save();assert.equal(response.status,200);assert.equal(response.body.replayed,true);
      for(const id of ['conversationId','turnId','interactionId'])assert.equal(response.body[id],converted.r.body[id]);
      assert.deepEqual(response.body.evaluation,converted.r.body.evaluation);assert.deepEqual(response.body.messages,converted.r.body.messages);assert.deepEqual(after,before);
    });
    await scenario('F2_HISTORIAL_FINAL_OTRA_SESION',async()=>{
      const route=`/buyer/${buyer}/conversations/${original.response.body.conversationId}`;const first=await http('GET',route);assert.equal(first.status,200);
      assert.equal((await http('DELETE','/lead/commercial/staff/session')).status,204);assert.equal((await http('GET',route)).status,401);
      evidence.secondLogin=await login();const list=await http('GET',`/buyer/${buyer}/conversations?after=0&limit=1`);const history=await http('GET',route);
      evidence.finalHistory={list,history};save();assert.equal(list.status,200);assert.equal(history.status,200);assert.deepEqual(history.body,first.body);
      assert.ok(history.body.turns.some(t=>t.turnId===converted?.r.body.turnId));
    });
    evidence.after=await snapshot();evidence.finishedAt=new Date().toISOString();
    if(Object.values(evidence.cases).some(c=>c.result!=='PASS'))process.exitCode=2;
    return;
  }
  let a,b,c;
  await scenario('A_INFORMATIVA',async()=>{
    a=await send('A',buyer,{message:'¿En qué consiste una evaluación odontológica? Solo quiero información, no deseo solicitar una cita.',origin:'OPERADOR_TRANSCRIPTOR'});
    assert.equal(a.r.body.evaluation.accion,'SOLO_CONSULTA');assert.equal(subject(a.step.after,buyer).etapa,'BUYER');assert.equal(subject(a.step.after,buyer).solicitudes,subject(a.step.before,buyer).solicitudes);
  });
  await scenario('B_ACLARACION_Y_CONTINUACION',async()=>{
    assert.ok(a&&a.r.body.status==='COMPLETADA','Caso A necesario para seguir la misma conversación');
    b=await send('B1',buyer,{conversationId:a.r.body.conversationId,message:'Hola',origin:'OPERADOR_TRANSCRIPTOR'});
    assert.equal(b.r.body.evaluation.accion,'ACLARACION');
    const next=await send('B2',buyer,{conversationId:a.r.body.conversationId,message:'Me refiero a evaluación odontológica; quiero información, todavía no quiero pedir una cita.',origin:'OPERADOR_TRANSCRIPTOR'});
    assert.equal(next.r.body.conversationId,b.r.body.conversationId);assert.equal(next.r.body.evaluation.accion,'SOLO_CONSULTA');assert.equal(subject(next.step.after,buyer).etapa,'BUYER');
    assert.equal(subject(next.step.after,buyer).solicitudes,subject(b.step.before,buyer).solicitudes);
  });
  await scenario('C_CONVERSION_REAL',async()=>{
    assert.ok(a&&evidence.cases.B_ACLARACION_Y_CONTINUACION?.result==='PASS','Continuación previa requerida');
    c=await send('C',buyer,{conversationId:a.r.body.conversationId,message:'Antes pedí información, pero ahora he decidido solicitar una cita de evaluación odontológica. Solicito expresamente que envíen mi solicitud para que me contacten; ya no busco solo información.',origin:'OPERADOR_TRANSCRIPTOR'});
    const e=c.r.body.evaluation;assert.equal(e.accion,'CONVERSION_LEAD');assert.equal(e.entregaLeadEstado,'CONFIRMADA');
    const link=c.step.after.links.find(l=>l.id_interaccion===c.r.body.interactionId);assert.ok(link);assert.equal(link.id_solicitud,e.id_solicitud);assert.equal(link.id_evento_etapa,e.id_evento_etapa);assert.equal(link.recepcion_solicitud,e.id_solicitud);assert.equal(link.recepcion_evento,e.id_evento_etapa);
    assert.equal(subject(c.step.after,buyer).etapa,'LEAD');for(const count of ['solicitudes','eventos','entradas'])assert.equal(subject(c.step.after,buyer)[count],subject(c.step.before,buyer)[count]+1);
  });
  await scenario('D_REPLAY_MISMA_CLAVE_CUERPO',async()=>{
    assert.ok(c,'Envío C necesario');const before=await snapshot();const response=await http('POST',`/buyer/${buyer}/conversations/messages`,c.body,c.key);const after=await snapshot();
    evidence.replay={key:c.key,request:c.body,response,before,after};save();assert.equal(response.status,200);assert.equal(response.body.replayed,true);
    for(const id of ['conversationId','turnId','interactionId'])assert.equal(response.body[id],c.r.body[id]);assert.deepEqual(response.body.messages,c.r.body.messages);assert.deepEqual(response.body.evaluation,c.r.body.evaluation);assert.deepEqual(after,before);
  });
  await scenario('E_PAYER',async()=>{
    const e=await send('E',11007,{message:'¿En qué consiste una evaluación odontológica? Solo consulto información y no solicito una cita.',origin:'OPERADOR_TRANSCRIPTOR'});
    assert.equal(subject(e.step.after,11007).etapa,'PAYER');for(const count of ['solicitudes','eventos','entradas'])assert.equal(subject(e.step.after,11007)[count],subject(e.step.before,11007)[count]);
    assert.ok(!e.r.body.evaluation.id_solicitud);assert.ok(!e.r.body.evaluation.id_evento_etapa);assert.ok(!e.step.after.links.find(l=>l.id_interaccion===e.r.body.interactionId)?.id_solicitud);
  });
  await scenario('F_HISTORIAL_OTRA_SESION',async()=>{
    assert.ok(a,'Conversación A necesaria');const route=`/buyer/${buyer}/conversations/${a.r.body.conversationId}`;const first=await http('GET',route);assert.equal(first.status,200);
    const logout=await http('DELETE','/lead/commercial/staff/session');assert.equal(logout.status,204);const rejected=await http('GET',route);assert.equal(rejected.status,401);
    const newLogin=await login();const list=await http('GET',`/buyer/${buyer}/conversations?after=0&limit=1`);const second=await http('GET',route);
    evidence.newSession={logoutStatus:logout.status,oldSessionStatus:rejected.status,login:newLogin,list,history:second};save();assert.equal(list.status,200);assert.equal(second.status,200);assert.deepEqual(second.body,first.body);
    assert.ok(list.body.items.some(x=>x.conversationId===a.r.body.conversationId));assert.ok(second.body.turns.length>=1);
  });
  evidence.after=await snapshot();evidence.finishedAt=new Date().toISOString();
  if(Object.values(evidence.cases).some(c=>c.result!=='PASS'))process.exitCode=2;
}
main().catch(error=>{evidence.error=/^QA_[A-Z_]+$/.test(error?.message||'')?error.message:error?.code==='ERR_ASSERTION'?String(error.message).slice(0,300):'LIVE_TEST_FAILED';process.exitCode=1;})
 .finally(async()=>{if(token)await http('DELETE','/lead/commercial/staff/session').catch(()=>undefined);token=undefined;if(db)await db.$disconnect();save();console.log(JSON.stringify({run,cases:evidence.cases,error:evidence.error}));});
