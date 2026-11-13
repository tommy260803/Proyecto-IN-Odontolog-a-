// @vitest-environment node
// Auditoría v2: SDK, sesión y SQL simulados; nunca conecta a proveedores reales.
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
vi.mock('../src/db', () => ({ prisma: new Proxy({}, { get() { throw Error('REAL_SQL_FORBIDDEN'); } }) }));
import { BuyerConversationService } from '../src/services/buyerConversationService';
import { BuyerMessageClassifier, validateConversationProposal } from '../src/services/buyerMessageClassifier';
import { createBuyerConversationRouter } from '../src/routes/buyerConversation.routes';
import { buyerChatMemory } from './helpers/buyerChatMemory';

const proposal = (reply='Respuesta vigente.', reserve=false) => ({ intencion:reserve?'SOLICITA_RESERVA':'SOLO_CONSULTA',id_servicio:1,
  respuesta:reply,datos_pendientes:[],contradicciones:[],accion_propuesta:reserve?'SOLICITAR_CONVERSION':'INFORMAR',confirmar_servicio:null });
const input = (message: string, conversationId?: string) => ({ message, origin:'OPERADOR_TRANSCRIPTOR' as const,
  ...(conversationId?{conversationId}:{}) });
function fixture(outputs: any[]) {
  const f=buyerChatMemory();
  const sdk=vi.fn(async()=>{
    expect(f.state.depth).toBe(0);
    const next=outputs.shift();return typeof next==='function'?next():{text:JSON.stringify(next)};
  });
  const classifier=new BuyerMessageClassifier({ client:{models:{generateContent:sdk}} as any });
  const classify=(m:string,c:any,o:any)=>classifier.classify(m,c,o);
  return {...f,sdk,classify,service:new BuyerConversationService(f.db,classify)};
}
afterEach(()=>vi.restoreAllMocks());

describe('Filtro acotado de afirmaciones',()=>{
  it.each(['La disponibilidad no está confirmada.','No puedo emitir un diagnóstico.',
    'Esto no constituye un diagnóstico. Consulta a un profesional.'])('permite una delimitación: %s',text=>{
    expect(validateConversationProposal(proposal(text),[{id_servicio:1,nombre:'Evaluación'}],'SOLO_CONSULTA').respuesta).toBe(text);
  });
  it.each(['Tu cita está reservada.','Tu solicitud fue convertida a LEAD.','La disponibilidad está confirmada.',
    'Tenemos cupos mañana.','El precio es S/ 100.','Cuesta 100.',
    'La disponibilidad no está confirmada, pero ya reservé tu cita.',
    'No puedo emitir un diagnóstico. Tu cita está confirmada.'])('sigue bloqueando una afirmación no respaldada: %s',text=>{
    expect(()=>validateConversationProposal(proposal(text),[{id_servicio:1,nombre:'Evaluación'}],'SOLO_CONSULTA')).toThrow(/afirmación no autorizada/);
  });
});

describe('Identidad de ejecución y recuperación bajo reloj SQL simulado',()=>{
  it('una ejecución activa no se reclama; no depende del reloj del cliente ni del host',async()=>{
    let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
    const f=fixture([async()=>{await gate;return{text:JSON.stringify(proposal())};}]);
    const first=f.service.send(1,7,'active-001',input('¿Qué incluye?'));
    await vi.waitFor(()=>expect(f.sdk).toHaveBeenCalledTimes(1));
    const chat=f.state.decisions.find(d=>d.agente==='BUYER_CHAT'&&d.id_interaccion);
    const turn=JSON.parse(chat.entrada);
    try {
      const replay=await new BuyerConversationService(f.db,f.classify).retry(1,turn.conversationId,chat.id_decision);
      expect(replay.status).toBe('PROCESANDO');expect(replay.execution?.id).toBe(turn.execution.id);
      expect(replay.attempts).toHaveLength(1);expect(f.sdk).toHaveBeenCalledTimes(1);
      expect(Date.parse(replay.execution!.expiresAt)).toBe(f.state.sqlNow+60_000);
    } finally { release();await first; }
  });

  it('recupera un turno vencido y descarta la respuesta tardía y sus efectos comerciales',async()=>{
    let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
    const f=fixture([async()=>{await gate;return{text:JSON.stringify(proposal('Respuesta vieja.',true))};},proposal('Respuesta nueva.')]);
    const old=f.service.send(1,7,'expired-001',input('Quiero reservar evaluación'));
    await vi.waitFor(()=>expect(f.sdk).toHaveBeenCalledTimes(1));
    const row=f.state.decisions.find(d=>d.agente==='BUYER_CHAT'&&d.id_interaccion);const prior=JSON.parse(row.entrada);
    f.state.sqlNow+=60_001;
    const current=await new BuyerConversationService(f.db,f.classify).retry(1,prior.conversationId,row.id_decision);
    expect(current.status).toBe('COMPLETADA');expect(current.execution?.id).not.toBe(prior.execution.id);
    expect(current.attempts.map(a=>a.result)).toEqual(['INTERRUMPIDA','COMPLETADA']);
    release();const late=await old;
    expect(late.executionSuperseded).toBe(true);expect(late.messages).toEqual(current.messages);
    const stored=f.state.decisions.find(d=>d.id_decision===row.id_decision);
    expect(JSON.parse(stored.entrada).execution.id).toBe(current.execution?.id);
    expect(stored.entrada).not.toContain('Respuesta vieja');expect(f.state.requests).toHaveLength(0);
    expect(f.state.interactions).toHaveLength(1);expect(f.sdk).toHaveBeenCalledTimes(2);
  });

  it('un resultado anterior no sobrescribe ni libera la nueva ejecución todavía activa',async()=>{
    let releaseOld!:()=>void,releaseNew!:()=>void;
    const oldGate=new Promise<void>(r=>{releaseOld=r;}),newGate=new Promise<void>(r=>{releaseNew=r;});
    const f=fixture([async()=>{await oldGate;return{text:JSON.stringify(proposal('Resultado obsoleto.',true))};},
      async()=>{await newGate;return{text:JSON.stringify(proposal('Resultado vigente.'))};}]);
    const old=f.service.send(1,7,'late-active1',input('Quiero reservar evaluación'));
    await vi.waitFor(()=>expect(f.sdk).toHaveBeenCalledTimes(1));
    const row=f.state.decisions.find(d=>d.agente==='BUYER_CHAT'&&d.id_interaccion),initial=JSON.parse(row.entrada);
    f.state.sqlNow+=60_001;
    const current=new BuyerConversationService(f.db,f.classify).retry(1,initial.conversationId,row.id_decision);
    await vi.waitFor(()=>expect(f.sdk).toHaveBeenCalledTimes(2));
    const active=JSON.parse(f.state.decisions.find(d=>d.id_decision===row.id_decision).entrada);
    try {
      releaseOld();const late=await old;
      expect(late.executionSuperseded).toBe(true);expect(late.status).toBe('PROCESANDO');
      expect(late.execution?.id).toBe(active.execution.id);expect(late.retryable).toBe(false);
      expect(JSON.parse(f.state.decisions.find(d=>d.id_decision===row.id_decision).entrada)).toEqual(active);
      expect(f.state.requests).toHaveLength(0);expect(late.messages).toHaveLength(1);
    } finally {releaseOld();releaseNew();await current;await old;}
  });

  it('reconcilia una conversión confirmada aunque no se guardara la respuesta final del chat',async()=>{
    const f=fixture([proposal('Procesaré la solicitud.',true)]);
    const update=f.db.decisionesIA.update.getMockImplementation()!;let crash=true;
    f.db.decisionesIA.update.mockImplementation(async(args:any)=>{
      if(crash&&['CHAT_COMPLETADA','CHAT_PENDIENTE'].includes(args.data.accion))throw Error('SIMULATED_PROCESS_STOP');
      return update(args);
    });
    await expect(f.service.send(1,7,'commit-001',input('Quiero reservar evaluación'))).rejects.toThrow('SIMULATED_PROCESS_STOP');
    expect(f.state.requests).toHaveLength(1);expect(f.state.intakes).toHaveLength(1);
    const row=f.state.decisions.find(d=>d.agente==='BUYER_CHAT'&&d.id_interaccion);const turn=JSON.parse(row.entrada);
    const sqlCalls=()=>f.db.$queryRaw.mock.calls.filter((a:any)=>a[0].join('').includes('EXEC dbo.usp_ConvertirBuyerALead')).length;
    expect(turn.status).toBe('PROCESANDO');const before=sqlCalls();
    crash=false;f.state.sqlNow+=60_001;
    const recovered=await new BuyerConversationService(f.db,f.classify).retry(1,turn.conversationId,row.id_decision);
    expect(recovered.status).toBe('COMPLETADA');expect(recovered.evaluation?.entregaLeadEstado).toBe('CONFIRMADA');
    expect(recovered.evaluation?.id_solicitud).toBe(f.state.requests[0].id_solicitud);
    expect(sqlCalls()).toBe(before);expect(f.sdk).toHaveBeenCalledTimes(1);
    expect(f.state.requests).toHaveLength(1);expect(f.state.events).toHaveLength(1);expect(f.state.intakes).toHaveLength(1);
  });

  it('reconcilia el corte justo después del SP y antes del enlace, sin repetir conversión ni Gemini',async()=>{
    const f=fixture([proposal('Procesaré la solicitud.',true)]);
    const execute=f.db.$executeRaw.getMockImplementation()!,update=f.db.decisionesIA.update.getMockImplementation()!;
    let crash=true;
    f.db.$executeRaw.mockImplementation(async(...args:any[])=>{if(crash&&args[0].join('').includes('id_solicitud='))throw Error('STOP_AFTER_SP');return execute(...args);});
    f.db.decisionesIA.update.mockImplementation(async(args:any)=>{if(crash&&args.data.accion==='CHAT_PENDIENTE')throw Error('STOP_AFTER_SP');return update(args);});
    await expect(f.service.send(1,7,'commit-002',input('Quiero reservar evaluación'))).rejects.toThrow('STOP_AFTER_SP');
    expect(f.state.requests).toHaveLength(1);expect(f.state.interactions[0].id_solicitud).toBeUndefined();
    const row=f.state.decisions.find(d=>d.agente==='BUYER_CHAT'&&d.id_interaccion),turn=JSON.parse(row.entrada);
    crash=false;f.state.sqlNow+=60_001;
    const r=await new BuyerConversationService(f.db,f.classify).retry(1,turn.conversationId,row.id_decision);
    expect(r.status).toBe('COMPLETADA');expect(r.evaluation?.entregaLeadEstado).toBe('CONFIRMADA');
    expect(f.state.interactions[0].id_solicitud).toBe(f.state.requests[0].id_solicitud);
    expect(f.sdk).toHaveBeenCalledTimes(1);expect(f.state.events).toHaveLength(1);expect(f.state.intakes).toHaveLength(1);
    expect(f.db.$queryRaw.mock.calls.filter((a:any)=>a[0].join('').includes('EXEC dbo.usp_ConvertirBuyerALead'))).toHaveLength(1);
  });

  it('sin identidad/vencimiento verificables no reinicia ciegamente un PROCESANDO antiguo',async()=>{
    const f=fixture([proposal()]);const a=await f.service.send(1,7,'legacy-001',input('Información'));
    const row=f.state.decisions.find(d=>d.id_decision===a.turnId),turn=JSON.parse(row.entrada);
    turn.status='PROCESANDO';delete turn.execution;row.entrada=JSON.stringify(turn);const before=row.entrada;
    await expect(f.service.retry(1,a.conversationId,a.turnId)).rejects.toMatchObject({code:'EXECUTION_UNVERIFIABLE'});
    expect(f.state.decisions.find(d=>d.id_decision===a.turnId).entrada).toBe(before);expect(f.sdk).toHaveBeenCalledTimes(1);
  });
});

describe('Listado administrativo paginado',()=>{
  it('lista solo las conversaciones de esa persona con cursor estable y resumen mínimo',async()=>{
    const f=fixture([proposal(),proposal(),proposal()]);
    const a=await f.service.send(1,7,'list-0001',input('Consulta uno'));
    const b=await f.service.send(1,7,'list-0002',input('Consulta dos'));
    await f.service.send(2,7,'list-0003',input('Consulta ajena'));
    const page1=await f.service.list(1,0,1);expect(page1.items.map(x=>x.conversationId)).toEqual([a.conversationId]);
    expect(page1.nextAfter).not.toBeNull();expect(page1.items[0]).toMatchObject({status:'COMPLETADA',lastAction:'SOLO_CONSULTA'});
    const page2=await f.service.list(1,page1.nextAfter!,1);expect(page2.items.map(x=>x.conversationId)).toEqual([b.conversationId]);
    expect(page2.nextAfter).toBeNull();expect(JSON.stringify(page1)).not.toContain('Consulta uno');
  });
  it('la ruta conserva 401/403/404 y valida límites y cursor',async()=>{
    const f=fixture([proposal()]);await f.service.send(1,7,'list-http1',input('Información'));
    let enabled=true;const app=express();app.use(express.json());
    app.use('/api/buyer/:id/conversations',createBuyerConversationRouter({service:f.service,enabled:()=>enabled,
      identity:async(req:any)=>req.get('Authorization')==='Bearer admin'?{id_usuario:7,nombres:'QA',apellidos:'Admin',rol:'Administrador'}:
        req.get('Authorization')==='Bearer other'?{id_usuario:8,nombres:'QA',apellidos:'Neg',rol:'Negociador'}:null,
      assigned:async()=>null}));
    const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}/api/buyer/1/conversations`;
    try{
      expect((await fetch(base)).status).toBe(401);
      expect((await fetch(base,{headers:{Authorization:'Bearer other'}})).status).toBe(403);
      const get=(q='')=>fetch(base+q,{headers:{Authorization:'Bearer admin'}});
      const r=await get('?limit=1');expect(r.status).toBe(200);expect((await r.json()).items).toHaveLength(1);
      expect((await get('?limit=0')).status).toBe(400);expect((await get('?after=-1')).status).toBe(400);
      enabled=false;expect((await get()).status).toBe(404);
    }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
  });

  it('autorización real de personal: rechaza token inventado, vencido, usuario inactivo y negociador sin asignación', async () => {
    const f = fixture([proposal()]);
    await f.service.send(1, 7, 'auth-check-1', input('Mensaje privado del chat'));

    const app = express();
    app.use(express.json());

    // Simular el router con las validaciones reales
    app.use('/api/buyer/:id/conversations', createBuyerConversationRouter({
      service: f.service,
      enabled: () => true,
      identity: async (req: any) => {
        const auth = req.get('Authorization') || '';
        if (auth === 'Bearer test-token-fake-invented') return null; // Token inventado
        if (auth === 'Bearer test-token-expired-session') return null; // Token vencido
        if (auth === 'Bearer test-token-disabled-user') return null; // Usuario desactivado
        if (auth === 'Bearer test-token-negotiator-role') {
          return { id_usuario: 8, nombres: 'Negociador', apellidos: 'Clínico', rol: 'Negociador' };
        }
        if (auth === 'Bearer test-token-admin-role') {
          return { id_usuario: 7, nombres: 'Admin', apellidos: 'General', rol: 'Administrador' };
        }
        return null;
      },
      assigned: async (personId: number, userId: number) => {
        // Solo asignado a la persona 2, NO a la persona 1
        return (personId === 2 && userId === 8) ? ({ id_solicitud: 100 } as any) : null;
      },
    }));

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as any).port;
    const urlPerson1 = `http://127.0.0.1:${port}/api/buyer/1/conversations`;
    const urlPerson2 = `http://127.0.0.1:${port}/api/buyer/2/conversations`;

    try {
      // 1. Token inventado -> 401, chat inaccesible
      const resFake = await fetch(urlPerson1, {
        headers: { Authorization: 'Bearer test-token-fake-invented' },
      });
      expect(resFake.status).toBe(401);
      expect(await resFake.text()).not.toContain('Mensaje privado del chat');

      // 2. Token vencido -> 401, chat inaccesible
      const resExpired = await fetch(urlPerson1, {
        headers: { Authorization: 'Bearer test-token-expired-session' },
      });
      expect(resExpired.status).toBe(401);

      // 3. Usuario desactivado -> 401, chat inaccesible
      const resDisabled = await fetch(urlPerson1, {
        headers: { Authorization: 'Bearer test-token-disabled-user' },
      });
      expect(resDisabled.status).toBe(401);

      // 4. Negociador sin asignación a persona 1 -> 403, chat inaccesible
      const resNegNoAssign = await fetch(urlPerson1, {
        headers: { Authorization: 'Bearer test-token-negotiator-role' },
      });
      expect(resNegNoAssign.status).toBe(403);
      expect(await resNegNoAssign.text()).not.toContain('Mensaje privado del chat');

      // 5. Negociador CON asignación a persona 2 -> 200 permitido
      const resNegAssigned = await fetch(urlPerson2, {
        headers: { Authorization: 'Bearer test-token-negotiator-role' },
      });
      expect(resNegAssigned.status).toBe(200);

      // 6. Administrador -> 200 permitido a persona 1
      const resAdmin = await fetch(urlPerson1, {
        headers: { Authorization: 'Bearer test-token-admin-role' },
      });
      expect(resAdmin.status).toBe(200);
      const dataAdmin = await resAdmin.json();
      expect(dataAdmin.items).toHaveLength(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(r => server.close(() => r()));
    }
  });
});
