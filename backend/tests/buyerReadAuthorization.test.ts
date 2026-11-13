// @vitest-environment node
// Rutas GET reales y autenticación real en memoria; únicamente Prisma/Mart simulados.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
const state=vi.hoisted(()=>({users:[] as any[],people:[] as any[]}));
const db=vi.hoisted(()=>({
  usuarios:{findUnique:vi.fn(async({where}:any)=>state.users.find(u=>where.email?u.email===where.email:u.id_usuario===where.id_usuario)||null)},
  etapas:{findFirst:vi.fn(async()=>({id_etapa:1,nombre:'BUYER'}))},
  personas:{findMany:vi.fn(async()=>structuredClone(state.people)),findUnique:vi.fn(async({where}:any)=>structuredClone(state.people.find(p=>p.id_persona===where.id_persona)||null)),count:vi.fn(async()=>2)},
  solicitudes:{findFirst:vi.fn(async({where}:any)=>state.people.flatMap(p=>p.Solicitudes.map((s:any)=>({...s,id_persona:p.id_persona}))).find(s=>s.id_persona===where.id_persona&&s.id_negociador===where.id_negociador)||null)},
  $queryRaw:vi.fn(async(parts:any)=>{
    const sql=parts.join('');if(!/^\s*SELECT\b/i.test(sql)||/AsignacionesPersonal/.test(sql))throw Error('UNEXPECTED_SQL');
    return [];
  }),
}));
vi.mock('../src/db',()=>({prisma:db}));
vi.mock('../src/services/martSyncService',()=>({MartSyncService:new Proxy({},{get(){throw Error('MART_FORBIDDEN');}})}));
vi.mock('../src/services/buyerMessageClassifier',()=>({
  classifyBuyerMessage:()=>{throw Error('GEMINI_FORBIDDEN');},redactBuyerConversationText:(s:string)=>s,
}));
import buyerRouter from '../src/routes/buyer.routes';
import { hashLeadStaffPassword, loginLeadStaff } from '../src/services/leadStaffAuth';

let server:ReturnType<ReturnType<typeof express>['listen']>,base:string;
const previousEnabled=process.env.LEAD_STAFF_AUTH_ENABLED,previousQa=process.env.LEAD_STAFF_AUTH_QA;
function person(id:number){return {id_persona:id,nombres:'QA',apellidos:'Prueba',email:null,numero:null,dni:null,autoriza_contacto:true,estado_calidad:'Valido',
  fecha_registro:new Date('2026-11-12T00:00:00Z'),Etapa:{nombre:'BUYER'},CanalOrigen:null,CampanaOrigen:null,EventosEtapa:[],Preferencias:[],DatosAcademicos:[],DatosLaborales:[],SaludOdontologica:[],
  Interacciones:[{id_interaccion:100+id,tipo:'BUYER_CHAT_ENTRADA',mensaje:`PRIVADO_CHAT_${id}`,fecha_hora:new Date(),Canal:null,Fuente:null},
    {id_interaccion:id,tipo:'CONSULTA',mensaje:'Consulta pública previa',fecha_hora:new Date(),Canal:null,Fuente:null}],
  Solicitudes:[{id_solicitud:id,id_negociador:id===2?2:null,motivo:`PRIVADO_CHAT_${id}`,Servicio:{nombre:'Evaluación'},id_servicio:1}],
  DecisionesIA:[{id_decision:200+id,id_interaccion:100+id,agente:'BUYER',entrada:JSON.stringify({conversationTurnId:300+id,mensaje:`PRIVADO_CHAT_${id}`}),
    decision:JSON.stringify({estado:'COMPLETADA',intencion:'SOLO_CONSULTA'}),accion:'SOLO_CONSULTA',resultado_revision:`PRIVADO_EVALUACION_${id}`,fecha_hora:new Date()},
    {id_decision:id,id_interaccion:id,agente:'BUYER',entrada:null,decision:'{}',accion:'SOLO_CONSULTA',resultado_revision:'Evaluación pública previa',fecha_hora:new Date()}]};}
beforeAll(async()=>{
  process.env.LEAD_STAFF_AUTH_ENABLED='true';process.env.LEAD_STAFF_AUTH_QA='false';
  const password_hash=await hashLeadStaffPassword('SoloFixtureUnitario-2026!');
  state.users=[{id_usuario:1,nombres:'QA',apellidos:'Administrador',email:'admin@example.invalid',password_hash,activo:true,Rol:{nombre:'Administrador'}},
    {id_usuario:2,nombres:'QA',apellidos:'Negociador',email:'neg@example.invalid',password_hash,activo:true,Rol:{nombre:'Negociador'}}];
  state.people=[person(1),person(2)];const app=express();app.use(express.json());app.post('/api/lead/commercial/staff/session',loginLeadStaff);app.use('/api/buyer',buyerRouter);
  server=app.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${(server.address() as any).port}/api`;
});
afterEach(()=>{vi.restoreAllMocks();state.users.forEach(u=>u.activo=true);});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));
  if(previousEnabled===undefined)delete process.env.LEAD_STAFF_AUTH_ENABLED;else process.env.LEAD_STAFF_AUTH_ENABLED=previousEnabled;
  if(previousQa===undefined)delete process.env.LEAD_STAFF_AUTH_QA;else process.env.LEAD_STAFF_AUTH_QA=previousQa;
});
async function login(email='admin@example.invalid'){
 const r=await fetch(base+'/lead/commercial/staff/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'SoloFixtureUnitario-2026!'})});
 expect(r.status).toBe(200);return (await r.json()).token as string;
}
async function read(route:string,token?:string){const r=await fetch(base+route,{headers:token?{Authorization:'Bearer '+token}:{}});expect(r.status).toBe(200);return r.json();}
async function redacted(token?:string){
 for(const route of ['/buyer','/buyer?page=1&pageSize=2','/buyer/1']){
  const data=await read(route,token),serialized=JSON.stringify(data);
  expect(serialized).not.toContain('PRIVADO_CHAT_1');expect(serialized).not.toContain('PRIVADO_EVALUACION_1');
  const target=Array.isArray(data)?data.find(p=>p.id==='1'):data.items?data.items.find((p:any)=>p.id==='1'):data;
  expect(target.latestEvaluation?.isChatTurn).not.toBe(true);expect(target.hasChatConversation).not.toBe(true);
  expect(serialized).toContain('Consulta pública previa');
 }
}
describe('Autorización sobre GET Buyer reales',()=>{
 it('sin sesión o con token inventado no expone contenido ni evaluaciones de chat',async()=>{await redacted();await redacted('Z'.repeat(43));});
 it('sesión real vencida no expone chat en ficha ni listado',async()=>{
  const token=await login(),now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now+31*60_000);await redacted(token);
 });
 it('usuario real inactivo no expone chat en ficha ni listado',async()=>{
  const token=await login();state.users[0].activo=false;await redacted(token);
 });
 it('Negociador sin asignación no accede al chat de esa persona, pero sí a la asignada',async()=>{
  const token=await login('neg@example.invalid');await redacted(token);
  const list=await read('/buyer',token);expect(JSON.stringify(list.find((p:any)=>p.id==='2'))).toContain('PRIVADO_CHAT_2');
  expect(JSON.stringify(await read('/buyer/2',token))).toContain('PRIVADO_EVALUACION_2');
  expect((await fetch(base+'/buyer/1/conversations',{headers:{Authorization:'Bearer '+token}})).status).toBe(403);
 });
 it('Administrador autorizado recibe chat de ficha y listado con sesión comprobada',async()=>{
  const token=await login();for(const route of ['/buyer','/buyer/1']){
   const data=await read(route,token);expect(JSON.stringify(data)).toContain('PRIVADO_CHAT_1');expect(JSON.stringify(data)).toContain('PRIVADO_EVALUACION_1');
  }
 });
 it('los filtros SQL del listado limitan al Negociador por Solicitudes.id_negociador',async()=>{
  const token=await login('neg@example.invalid');await read('/buyer',token);
  const query=db.personas.findMany.mock.calls.at(-1)?.[0] as any;
  expect(query.include.Interacciones.where.OR).toContainEqual({Persona:{Solicitudes:{some:{id_negociador:2}}}});
  expect(query.include.DecisionesIA.where.OR).toContainEqual({Persona:{Solicitudes:{some:{id_negociador:2}}}});
 });
});
