// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import { buyerChatMemory } from './helpers/buyerChatMemory';
// Cualquier uso accidental del cliente por defecto falla, nunca conecta a SQL Server.
const guard = vi.hoisted(() => ({ db: null as any }));
vi.mock('../src/db', () => ({ prisma: new Proxy({}, { get(_target, key) {
  if (!guard.db) throw Error('REAL_DATABASE_FORBIDDEN');
  return guard.db[key];
} }) }));
import { BuyerConversationService } from '../src/services/buyerConversationService';
import { BuyerMessageClassifier, validateClassificationResult } from '../src/services/buyerMessageClassifier';
import { BuyerEvaluationService } from '../src/services/buyerEvaluationService';
import { createBuyerConversationRouter } from '../src/routes/buyerConversation.routes';
import buyerRouter from '../src/routes/buyer.routes';

const sdkResult = (intencion='AMBIGUA',extra: any={}) => ({ intencion,id_servicio:intencion==='AMBIGUA'?null:1,
  respuesta:'¿Qué información necesitas sobre nuestros servicios?', datos_pendientes:[], contradicciones:[],
  accion_propuesta: intencion==='SOLICITA_RESERVA'?'SOLICITAR_CONVERSION':intencion==='SOLO_CONSULTA'?'INFORMAR':'ACLARAR', confirmar_servicio:null, ...extra });
function fixture(outputs: any[]) {
  const {db,state,services}=buyerChatMemory();
  const generateContent=vi.fn(async (_request: any) => {
    expect(state.depth).toBe(0);
    expect(state.interactions.length).toBeGreaterThan(0); // Guardado antes del SDK.
    const output=outputs.shift();if(output instanceof Error)throw output;
    if(typeof output==='function')return output(_request);
    return {text:JSON.stringify(output)};
  });
  const classifier=new BuyerMessageClassifier({client:{models:{generateContent}} as any,maxRetries:2});
  const classify=vi.fn((m: string,c: any,o: any)=>classifier.classify(m,c,o));
  return {db,state,services,generateContent,classify,
    service:new BuyerConversationService(db,classify)};
}
const input=(message: string,conversationId?: string)=>({message,origin:'OPERADOR_TRANSCRIPTOR' as const,...(conversationId?{conversationId}:{})});
afterEach(()=>{ vi.restoreAllMocks(); guard.db=null; });

describe('Chat Buyer fase 1: SDK y persistencia simulados, evaluador real',()=>{
  it('saludo con servicio declarado pide aclaración, persiste respuesta exacta y reconstruye historial',async()=>{
    const f=fixture([sdkResult('AMBIGUA',{respuesta:'Hola. ¿Deseas información o solicitar atención?'}),sdkResult('SOLO_CONSULTA')]);
    const a=await f.service.send(1,7,'saludo-001',input('Hola'));
    expect(a.status).toBe('COMPLETADA');expect(a.evaluation?.intencion).toBe('AMBIGUA');expect(a.evaluation?.id_servicio).toBeNull();
    expect(a.declaredServiceId).toBe(1);expect(a.analysis?.interpretedServiceId).toBeNull();
    expect(a.messages[0]).toMatchObject({role:'operador_transcriptor',actorId:7,text:'Hola'});
    expect(a.messages[1].text).toBe('Hola. ¿Deseas información o solicitar atención?');
    const history=await new BuyerConversationService(f.db,f.classify).history(1,a.conversationId);
    expect(history.turns[0].messages).toEqual(a.messages);
    await f.service.send(1,7,'saludo-002',input('¿Qué incluye?',a.conversationId));
    const prompt=JSON.parse(f.generateContent.mock.calls[1][0].contents);
    expect(prompt.history.map((x:any)=>x.text)).toContain('Hola. ¿Deseas información o solicitar atención?');
    expect(prompt.preferences.declaredServiceId).toBe(1);expect(prompt.preferences.source).toContain('PersonaPreferencias');
    expect(f.state.requests).toHaveLength(0);
  });
  it('consulta de precio responde sin inventar precio ni convertir',async()=>{
    const f=fixture([sdkResult('SOLO_CONSULTA',{respuesta:'No tengo un precio autorizado. Puedo orientarte sobre el servicio.'})]);
    const r=await f.service.send(1,7,'precio-001',input('¿Cuánto cuesta la evaluación?'));
    expect(r.evaluation).toMatchObject({accion:'SOLO_CONSULTA',etapa_final:'BUYER'});
    expect(f.state.requests).toHaveLength(0);expect(f.generateContent).toHaveBeenCalledTimes(1);
  });
  it('sí tras pregunta inequívoca persistida convierte y comunica SOLO el resultado posterior confirmado',async()=>{
    const f=fixture([sdkResult('AMBIGUA',{respuesta:'Puedo ayudarte a solicitar atención.',confirmar_servicio:1}),sdkResult('SOLICITA_RESERVA',{respuesta:'Voy a procesar tu solicitud.'})]);
    const a=await f.service.send(1,7,'confirm-001',input('Quisiera confirmar el siguiente paso'));
    expect(a.messages[1].text).toContain('¿Confirmas que deseas solicitar la conversión a LEAD');
    const b=await f.service.send(1,7,'confirm-002',input('Sí',a.conversationId));
    expect(b.evaluation).toMatchObject({accion:'CONVERSION_LEAD',entregaLeadEstado:'CONFIRMADA'});
    expect(b.messages[1]).toMatchObject({origin:'BACKEND_RESULTADO'});
    expect(b.messages[1].text).toContain(`solicitud #${b.evaluation?.id_solicitud}`);
    expect(f.state.requests).toHaveLength(1);expect(f.state.events).toHaveLength(1);expect(f.state.intakes).toHaveLength(1);
    expect(JSON.parse(f.generateContent.mock.calls[1][0].contents).confirmationServiceId).toBe(1);
  });
  it('sí sin contexto no convierte aunque el modelo lo proponga; otra pregunta no autoriza confirmar',async()=>{
    const f=fixture([sdkResult('AMBIGUA',{respuesta:'¿Deseas saber más?'}),sdkResult('SOLICITA_RESERVA')]);
    const a=await f.service.send(1,7,'sincontext1',input('Hola'));
    const b=await f.service.send(1,7,'sincontext2',input('Sí',a.conversationId));
    expect(b.evaluation).toMatchObject({intencion:'AMBIGUA',id_servicio:null,accion:'ACLARACION'});
    expect(f.state.requests).toHaveLength(0);
  });
  it('rechaza historia/turno de otra persona o conversación sin crear mensajes',async()=>{
    const f=fixture([sdkResult(),sdkResult(),sdkResult()]);
    const a=await f.service.send(1,7,'pertenece1',input('Hola'));
    const b=await f.service.send(2,7,'pertenece2',input('Hola'));
    const c=await f.service.send(1,7,'pertenece4',input('Hola'));
    const count=f.state.interactions.length;
    await expect(f.service.send(2,7,'pertenece3',input('Sí',a.conversationId))).rejects.toMatchObject({status:404});
    await expect(f.service.retry(1,b.conversationId,a.turnId)).rejects.toMatchObject({status:404});
    await expect(f.service.retry(1,c.conversationId,a.turnId)).rejects.toMatchObject({status:404});
    await expect(f.service.history(2,a.conversationId)).rejects.toMatchObject({status:404});
    expect(f.state.interactions).toHaveLength(count);
  });
  it('fallo Gemini y retry reutilizan mensaje/evaluación y conservan historial de intentos',async()=>{
    const f=fixture([new Error('simulated unavailable'),sdkResult('SOLO_CONSULTA')]);
    const a=await f.service.send(1,7,'fallo-0001',input('¿Qué incluye la evaluación?'));
    expect(a.status).toBe('PENDIENTE');expect(a.messages.some(m=>m.role==='asistente')).toBe(false);
    expect(a.messages[1].role).toBe('sistema');expect(f.generateContent).toHaveBeenCalledTimes(1);
    const b=await new BuyerConversationService(f.db,f.classify).retry(1,a.conversationId,a.turnId);
    expect(b.status).toBe('COMPLETADA');expect(b.interactionId).toBe(a.interactionId);expect(b.evaluation?.id_decision).toBe(a.evaluation?.id_decision);
    expect(b.evaluation?.intentosRealizados).toBe(2);expect(b.attempts.map(x=>x.result)).toEqual(['PENDIENTE','COMPLETADA']);
    expect(f.state.interactions).toHaveLength(1);expect(b.messages.filter(x=>x.role==='asistente')).toHaveLength(1);
    expect(b.messages[0].text).toBe('¿Qué incluye la evaluación?');
  });
  it('doble envío solapado reserva un turno; replay estable y conflicto sin escrituras extra',async()=>{
    let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
    const f=fixture([async()=>{await gate;return{text:JSON.stringify(sdkResult('SOLO_CONSULTA'))};}]);
    const first=f.service.send(1,7,'doble-0001',input('¿Qué incluye?'));
    await vi.waitFor(()=>expect(f.generateContent).toHaveBeenCalledTimes(1));
    const replay=await f.service.send(1,7,'doble-0001',input('¿Qué incluye?'));
    expect(replay.replayed).toBe(true);expect(replay.status).toBe('PROCESANDO');
    await expect(f.service.send(1,7,'doble-0001',input('Otro contenido'))).rejects.toMatchObject({status:409,code:'IDEMPOTENCY_CONFLICT'});
    expect(f.state.interactions).toHaveLength(1);release();const done=await first;
    const final=await f.service.send(1,7,'doble-0001',input('¿Qué incluye?'));
    expect(final.messages).toEqual(done.messages);expect(final.turnId).toBe(done.turnId);expect(f.generateContent).toHaveBeenCalledTimes(1);
  });
  it('PAYER conserva etapa e historial; consulta nueva no hereda solicitud histórica',async()=>{
    const f=fixture([sdkResult('SOLO_CONSULTA')]);f.state.people.get(1).Etapa.nombre='PAYER';
    f.state.requests.push({id_solicitud:44,id_persona:1});f.state.events.push({id_evento_etapa:55,id_solicitud:44,id_captacion:11});
    const r=await f.service.send(1,7,'payer-0001',input('¿Qué información tienen?'));
    expect(r.evaluation).toMatchObject({etapa_final:'PAYER',accion:'SOLO_CONSULTA'});expect(r.evaluation?.id_solicitud??null).toBeNull();
    expect(f.state.people.get(1).Etapa.nombre).toBe('PAYER');expect(f.state.requests).toHaveLength(1);expect(f.state.events).toHaveLength(1);
    expect(r.messages[1].text).not.toContain('#44');
  });
  it('persistencia ASCII conserva respuesta Unicode exacta y no manda datos de identidad al SDK',async()=>{
    const text='¿Cómo podemos ayudarte? 🦷';const f=fixture([sdkResult('SOLO_CONSULTA',{respuesta:text})]);
    const r=await f.service.send(1,7,'privado001',input('Paciente Privado, DNI 12345678, correo privado@example.invalid y teléfono 999888777. ¿Qué incluye?'));
    const prompt=f.generateContent.mock.calls[0][0].contents;
    for(const secret of ['Paciente Privado','12345678','privado@example.invalid','999888777'])expect(prompt).not.toContain(secret);
    const durable=await f.service.history(1,r.conversationId);expect(durable.turns[0].messages[1].text).toBe(text);
    const row=f.state.decisions.find(d=>d.id_decision===r.turnId);expect(row.entrada).toContain('\\ud83e');
  });
  it('rechaza una respuesta que afirma reserva ya realizada y queda recuperable',async()=>{
    const f=fixture([sdkResult('SOLICITA_RESERVA',{respuesta:'Tu cita está reservada.'})]);
    const r=await f.service.send(1,7,'falsedad01',input('Quiero reservar evaluación'));
    expect(r.status).toBe('PENDIENTE');expect(r.messages.some(m=>m.role==='asistente')).toBe(false);expect(f.state.requests).toHaveLength(0);
  });
  it('si falla SQL después de Gemini, retry usa propuesta durable sin otra llamada al modelo',async()=>{
    const f=fixture([sdkResult('SOLICITA_RESERVA')]);f.state.failConversion=true;
    const a=await f.service.send(1,7,'sql-fallo1',input('Quiero reservar evaluación'));
    expect(a.status).toBe('PENDIENTE');f.state.failConversion=false;
    const b=await new BuyerConversationService(f.db,f.classify).retry(1,a.conversationId,a.turnId);
    expect(b.status).toBe('COMPLETADA');expect(f.generateContent).toHaveBeenCalledTimes(1);expect(f.state.requests).toHaveLength(1);
  });
  it('contradicciones bloquean la conversión, sin debilitar AMBIGUA/id_servicio=null',async()=>{
    const f=fixture([sdkResult('SOLICITA_RESERVA',{contradicciones:['Horario seleccionado y mensaje distintos']})]);
    const r=await f.service.send(1,7,'contradic1',input('Quiero reservar evaluación'));
    expect(r.evaluation).toMatchObject({accion:'ACLARACION',intencion:'AMBIGUA',id_servicio:null});expect(f.state.requests).toHaveLength(0);
    expect(validateClassificationResult({intencion:'AMBIGUA',id_servicio:1},f.services).id_servicio).toBeNull();
  });
  it('el retry genérico no puede saltarse el orquestador administrativo del chat',async()=>{
    const f=fixture([new Error('fallo')]);const a=await f.service.send(1,7,'generico01',input('Hola'));
    await expect(BuyerEvaluationService.retryEvaluationByInteraction(a.interactionId,{dbClient:f.db})).rejects.toThrow('CHAT_REQUIRES_ADMINISTRATIVE_ORCHESTRATOR');
  });
  it('limita el contexto a 12 mensajes recientes sin borrar el historial persistido',async()=>{
    const f=fixture(Array.from({length:9},()=>sdkResult('SOLO_CONSULTA')));
    let conversationId: string|undefined;
    for(let n=0;n<9;n++){
      const r=await f.service.send(1,7,`historial-${n}`,input(`Consulta informativa ${n}`,conversationId));
      expect(r.status).toBe('COMPLETADA');conversationId=r.conversationId;
    }
    const prompt=JSON.parse(f.generateContent.mock.calls[8][0].contents);
    expect(prompt.history).toHaveLength(12);expect(JSON.stringify(prompt.history)).not.toContain('Consulta informativa 0');
    const history=await f.service.history(1,conversationId!);expect(history.turns).toHaveLength(9);
    expect(history.turns[0].messages[0].text).toBe('Consulta informativa 0');
  });
  it('un fallo Gemini en PAYER mantiene también la etapa correcta en la respuesta pendiente',async()=>{
    const f=fixture([new Error('fallo')]);f.state.people.get(1).Etapa.nombre='PAYER';
    const r=await f.service.send(1,7,'payerfail1',input('Hola'));
    expect(r.status).toBe('PENDIENTE');expect(r.evaluation?.etapa_final).toBe('PAYER');
    expect(f.state.people.get(1).Etapa.nombre).toBe('PAYER');
  });
  it('el saludo no puede convertir por tener un servicio seleccionado aunque el modelo se equivoque',async()=>{
    const f=fixture([sdkResult('SOLICITA_RESERVA')]);
    const r=await f.service.send(1,7,'saludoerr1',input('Hola'));
    expect(r.evaluation).toMatchObject({accion:'ACLARACION',id_servicio:null,intencion:'AMBIGUA'});
    expect(f.state.requests).toHaveLength(0);expect(r.messages[1].origin).toBe('BACKEND_VALIDACION');
    expect(r.analysis?.intention).toBe('SOLICITA_RESERVA'); // Propuesta modelo conservada; backend la rechazó.
  });
  it('servicio interpretado desconocido no se sustituye silenciosamente por el declarado',async()=>{
    const f=fixture([sdkResult('SOLICITA_RESERVA',{id_servicio:null})]);
    const r=await f.service.send(1,7,'desconocid1',input('Quiero reservar un tratamiento desconocido'));
    expect(r.declaredServiceId).toBe(1);expect(r.analysis?.interpretedServiceId).toBeNull();
    expect(r.evaluation).toMatchObject({accion:'ACLARACION',intencion:'AMBIGUA',id_servicio:null});
    expect(f.state.requests).toHaveLength(0);
  });
  it('una captación con conversión histórica no se adjudica al mensaje nuevo aunque figure BUYER',async()=>{
    const f=fixture([sdkResult('SOLICITA_RESERVA')]);
    f.state.requests.push({id_solicitud:44,id_persona:1});f.state.events.push({id_evento_etapa:55,id_solicitud:44,id_captacion:11});
    const r=await f.service.send(1,7,'historico1',input('Quiero reservar evaluación'));
    expect(r.evaluation).toMatchObject({accion:'ACLARACION',id_servicio:null});
    expect(f.state.requests).toHaveLength(1);expect(f.state.interactions[0].id_solicitud).toBeUndefined();
    expect(r.messages[1].text).toContain('No se atribuyó');
  });
});

describe('Contrato HTTP administrativo: persistencia y autenticación simuladas',()=>{
  it('la ficha heredada no publica el texto ni la evaluación del chat administrativo',async()=>{
    const f=fixture([sdkResult('SOLO_CONSULTA')]);
    const r=await f.service.send(1,7,'privlegacy1',input('Mensaje administrativo confidencial de prueba'));
    guard.db=f.db;const app=express();app.use('/api/buyer',buyerRouter);
    const server=app.listen(0,'127.0.0.1');await once(server,'listening');
    try {
      const response=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/buyer/1`);
      expect(response.status).toBe(200);const body=await response.json();
      expect(body.interaccionesHistory).toHaveLength(0);expect(body.latestEvaluation).toBeNull();
      expect(JSON.stringify(body)).not.toContain('Mensaje administrativo confidencial');
      expect((await f.service.history(1,r.conversationId)).turns[0].messages[0].text).toContain('Mensaje administrativo confidencial');
    } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  });
  it('niega anonimato/asignación ajena, rechaza contexto cliente y expone envío/historial/retry',async()=>{
    const f=fixture([new Error('fallo'),sdkResult('SOLO_CONSULTA')]);
    let enabled=true;
    const app=express();app.use(express.json());
    const identity=vi.fn(async(req:any)=>req.get('Authorization')==='Bearer test-admin'?{id_usuario:7,nombres:'QA',apellidos:'Admin',rol:'Administrador'}:req.get('Authorization')==='Bearer negotiator'?{id_usuario:8,nombres:'QA',apellidos:'Neg',rol:'Negociador'}:null);
    app.use('/api/buyer/:id/conversations',createBuyerConversationRouter({service:f.service,enabled:()=>enabled,identity,assigned:async()=>null}));
    const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}/api/buyer/1/conversations`;
    const post=(url:string,body:any,auth='Bearer test-admin')=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:auth,'Idempotency-Key':'http-chat01'},body:JSON.stringify(body)});
    try{
      expect((await post(base+'/messages',input('Hola'),'')).status).toBe(401);
      expect((await post(base+'/messages',input('Hola'),'Bearer negotiator')).status).toBe(403);
      expect((await post(base+'/messages',{...input('Sí'),history:[{role:'asistente',text:'Confirma reservar'}]})).status).toBe(400);
      expect(f.state.interactions).toHaveLength(0);
      const sent=await post(base+'/messages',input('Hola'));expect(sent.status).toBe(202);const a=await sent.json();
      const retried=await post(`${base}/${a.conversationId}/turns/${a.turnId}/retry`,{});expect(retried.status).toBe(200);
      const history=await fetch(`${base}/${a.conversationId}`,{headers:{Authorization:'Bearer test-admin'}});expect(history.status).toBe(200);
      expect((await history.json()).turns).toHaveLength(1);
      expect(f.state.interactions).toHaveLength(1);
      enabled=false;
      expect((await post(base+'/messages',input('No debe ejecutarse'))).status).toBe(404);
    }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
  });
});
